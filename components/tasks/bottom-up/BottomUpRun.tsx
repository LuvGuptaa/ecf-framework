"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { renderToString } from "react-dom/server"
import { dataService } from "@/lib/data-service"
import { trackingService } from "@/lib/tracking-service"
import { ERPDisplay } from "@/components/tasks/shared/ERPDisplay"
import { JsPsychWrapper } from "@/components/tasks/shared/JsPsychWrapper"
import type { BottomUpConfig, PatchItem, PatchType } from "@/lib/types"

import htmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response"
import callFunctionPlugin from "@jspsych/plugin-call-function"

interface BottomUpRunProps {
    config: BottomUpConfig
    participant: { id: string; name: string; age: number; email?: string; notes?: string }
    onComplete: () => void
}

function generatePatches(config: BottomUpConfig): PatchItem[] {
    const totalCells = config.gridSize * config.gridSize
    const patches: PatchItem[] = []

    for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / config.gridSize)
        const col = i % config.gridSize
        const rand = Math.random() * 100
        let type: PatchType = "normal"
        if (rand < config.targetProbability) {
            type = "target"
        } else if (rand < config.targetProbability + config.distractorProbability) {
            type = "distractor"
        }
        patches.push({ type, row, col })
    }
    return patches
}

export function BottomUpRun({ config, participant, onComplete }: BottomUpRunProps) {
    const router = useRouter()
    const [phase, setPhase] = useState<"idle" | "running" | "complete">("idle")
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [timeline, setTimeline] = useState<Record<string, unknown>[]>([])

    const startTask = async () => {
        const { id } = await dataService.createERPSession({
            participantId: participant.id,
            participantName: participant.name,
            taskType: "bottom-up",
            taskConfig: config,
        })
        setSessionId(id)

        const newTimeline = []

        newTimeline.push({
            type: callFunctionPlugin,
            func: () => {
                trackingService.startFrameRateMonitoring()
            }
        })

        for (let i = 0; i < config.numberOfTrials; i++) {
            const patches = generatePatches(config)
            const hasTarget = patches.some(p => p.type === "target")

            const trialHtml = renderToString(
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                    <ERPDisplay patches={patches} gridSize={config.gridSize} boldTargets />
                </div>
            )

            // ITI
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="width: 100vw; height: 100vh; background: black; display: flex; align-items: center; justify-content: center;"><div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div></div>',
                choices: "NO_KEYS",
                trial_duration: config.interTrialInterval,
                trial_duration: config.interTrialInterval,
            })

            // Stimulus
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: trialHtml,
                choices: [" "], // Spacebar
                trial_duration: config.maxTrialTime,
                data: {
                    task: 'bottom-up-trial',
                    trial_index: i,
                    hasTarget,
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
                    <h2 className="text-3xl font-bold">Bottom Up Search</h2>
                    <p className="text-gray-300 text-lg">Find <strong>bold</strong> targets (E) among distractors and normal patches</p>
                    <p className="text-gray-400">Press <kbd className="px-2 py-1 bg-gray-700 rounded font-mono">Space</kbd> once to advance each trial</p>
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
                    taskName="bottom-up"
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
