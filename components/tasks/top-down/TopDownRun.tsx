"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { renderToString } from "react-dom/server"
import { dataService } from "@/lib/data-service"
import { trackingService } from "@/lib/tracking-service"
import { ERPDisplay } from "@/components/tasks/shared/ERPDisplay"
import { JsPsychWrapper } from "@/components/tasks/shared/JsPsychWrapper"
import type { TopDownConfig, PatchItem } from "@/lib/types"

// Plugins
import htmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response"
import callFunctionPlugin from "@jspsych/plugin-call-function"

interface TopDownRunProps {
    config: TopDownConfig
    participant: { id: string; name: string; age: number; email?: string; notes?: string }
    onComplete: () => void
}

const BOTTOM_UP_LETTERS = "ABCDFGHIJKLMNOPQRSTUVWXYZ".split("")

function getRandomBottomUpLetter(): string {
    return BOTTOM_UP_LETTERS[Math.floor(Math.random() * BOTTOM_UP_LETTERS.length)]
}

function generatePatches(config: TopDownConfig, isBottomUpTrial: boolean): PatchItem[] {
    const totalCells = config.gridSize * config.gridSize
    const patches: PatchItem[] = []

    const fillCount = Math.round((config.fillPercentage / 100) * totalCells)
    const allIndices = Array.from({ length: totalCells }, (_, i) => i)

    for (let i = allIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]]
    }
    const filledIndices = new Set(allIndices.slice(0, fillCount))

    for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / config.gridSize)
        const col = i % config.gridSize

        if (!filledIndices.has(i)) continue

        const rand = Math.random() * 100

        if (isBottomUpTrial && rand < config.bottomUpTargetProbability) {
            patches.push({ type: "bottomUpTarget", row, col, letter: getRandomBottomUpLetter(), color: "#ff0000" })
        } else if (rand < config.bottomUpTargetProbability + config.targetProbability) {
            patches.push({ type: "target", row, col })
        } else if (rand < config.bottomUpTargetProbability + config.targetProbability + config.distractorProbability) {
            patches.push({ type: "distractor", row, col })
        } else {
            patches.push({ type: "distractor", row, col })
        }
    }

    return patches
}

export function TopDownRun({ config, participant, onComplete }: TopDownRunProps) {
    const router = useRouter()
    const [phase, setPhase] = useState<"idle" | "running" | "complete">("idle")
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [timeline, setTimeline] = useState<Record<string, unknown>[]>([])

    const startTask = async () => {
        // 1. Create session in DB
        const { id } = await dataService.createERPSession({
            participantId: participant.id,
            participantName: participant.name,
            taskType: "top-down",
            taskConfig: config,
        })
        setSessionId(id)

        // 2. Build jsPsych timeline
        const newTimeline = []

        // Initial fixation/calibration start marker
        newTimeline.push({
            type: callFunctionPlugin,
            func: () => {
                trackingService.startFrameRateMonitoring()
            }
        })

        for (let i = 0; i < config.numberOfTrials; i++) {
            const isBottomUp = Math.random() * 100 < config.bottomUpProbability
            const patches = generatePatches(config, isBottomUp)
            const trialHtml = renderToString(
                <ERPDisplay patches={patches} gridSize={config.gridSize} fullScreen patchSizeCm={config.patchSizeCm} />
            )

            // ITI (Inter-trial interval)
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="width: 100vw; height: 100vh; background: black; display: flex; align-items: center; justify-content: center;"><div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div></div>',
                choices: "NO_KEYS",
                trial_duration: config.interTrialInterval,
                trial_duration: config.interTrialInterval,
            })

            // Main stimulus
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: trialHtml,
                choices: [" "], // Spacebar
                trial_duration: config.maxTrialTime,
                data: {
                    task: 'top-down-trial',
                    trial_index: i,
                    isBottomUp,
                },
                on_start: () => {
                },
                on_finish: () => {
                }
            })
        }

        newTimeline.push({
            type: callFunctionPlugin,
            func: () => {
                trackingService.stopFrameRateMonitoring()
            }
        })

        setTimeline(newTimeline)
        setPhase("running")
    }

    const handleFinish = useCallback(() => {
        setPhase("complete")
        if (onComplete) {
            onComplete()
        } else if (sessionId) {
            router.push(`/results?sessionId=${sessionId}`)
        }
    }, [onComplete, router, sessionId])

    return (
        <div className="w-full h-screen bg-black text-white">
            {phase === "idle" && (
                <div className="flex flex-col items-center justify-center h-full space-y-8">
                    <h2 className="text-3xl font-bold">Top Down Search</h2>
                    <p className="text-gray-300 text-lg">Find targets (E) among distractors (Ǝ) in the grid</p>
                    {config.bottomUpProbability > 0 && (
                        <p className="text-red-400 text-sm">Some trials include <strong>red letter</strong> bottom-up targets</p>
                    )}
                    <p className="text-gray-400">Press <kbd className="px-2 py-1 bg-gray-700 rounded font-mono">Space</kbd> once after finding the target</p>
                    <button
                        onClick={startTask}
                        className="px-8 py-4 bg-white text-black rounded-lg text-xl font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Start Test
                    </button>
                </div>
            )}

            {phase === "running" && sessionId && (
                <JsPsychWrapper
                    timeline={timeline}
                    participantId={participant.id}
                    sessionId={sessionId}
                    taskName="top-down"
                    onFinish={handleFinish}
                />
            )}

            {phase === "complete" && (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <h2 className="text-3xl font-bold">Task Complete</h2>
                    <p className="text-gray-300">Processing data...</p>
                </div>
            )}
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
        </div>
    )
}
