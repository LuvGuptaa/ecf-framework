"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { renderToString } from "react-dom/server"
import { dataService } from "@/lib/data-service"
import { trackingService } from "@/lib/tracking-service"
import { ERPDisplay } from "@/components/tasks/shared/ERPDisplay"
import { JsPsychWrapper } from "@/components/tasks/shared/JsPsychWrapper"
import { useERPStore } from "@/lib/stores/erp-store"
import type { TopDownConfig, PatchItem } from "@/lib/types"

import htmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response"
import callFunctionPlugin from "@jspsych/plugin-call-function"

const TARGETS_PER_SLIDE = 2

interface TopDownRunProps {
    config: TopDownConfig
    participant: { id: string; name: string; age: number; email?: string; notes?: string }
    onComplete: () => void
}

function generatePatches(config: TopDownConfig): PatchItem[] {
    const totalCells = config.gridSize * config.gridSize
    const patches: PatchItem[] = []

    const fillCount = Math.round((config.fillPercentage / 100) * totalCells)
    const allIndices = Array.from({ length: totalCells }, (_, i) => i)

    // Shuffle indices
    for (let i = allIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]]
    }
    const filledIndices = allIndices.slice(0, fillCount)

    // Place exactly targetsPerSlide targets, rest are distractors
    const targetCount = Math.min(TARGETS_PER_SLIDE, filledIndices.length)

    filledIndices.forEach((cellIndex, idx) => {
        const row = Math.floor(cellIndex / config.gridSize)
        const col = cellIndex % config.gridSize

        if (idx < targetCount) {
            patches.push({ type: "target", row, col })
        } else {
            patches.push({ type: "distractor", row, col })
        }
    })

    // Shuffle patches so targets aren't always first in grid
    for (let i = patches.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[patches[i], patches[j]] = [patches[j], patches[i]]
    }

    return patches
}

export function TopDownRun({ config, participant, onComplete }: TopDownRunProps) {
    const router = useRouter()
    const [phase, setPhase] = useState<"idle" | "running" | "complete">("idle")
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [timeline, setTimeline] = useState<Record<string, unknown>[]>([])

    useEffect(() => {
        setPhase("idle")
        setSessionId(null)
        setTimeline([])
    }, [])

    const startTask = async () => {
        const { id } = await dataService.createERPSession({
            participantId: participant.id,
            participantName: participant.name,
            taskType: "top-down",
            taskConfig: config,
        })
        setSessionId(id)
        useERPStore.getState().setSessionMeta({ sessionId: id, totalTrials: config.numberOfTrials })

        const newTimeline: Record<string, unknown>[] = []

        newTimeline.push({
            type: callFunctionPlugin,
            func: () => {
                trackingService.startFrameRateMonitoring()
            }
        })

        for (let i = 0; i < config.numberOfTrials; i++) {
            const patches = generatePatches(config)
            const trialHtml = renderToString(
                <ERPDisplay patches={patches} gridSize={config.gridSize} fullScreen patchSizeCm={config.patchSizeCm} showHashes={true} />
            )

            // Fixation cross before each trial
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="width: 100vw; height: 100vh; background: black; display: flex; align-items: center; justify-content: center;"><div style="font-size: 80px; font-weight: 700; color: #fff; font-family: monospace;">+</div></div>',
                choices: "NO_KEYS",
                trial_duration: config.fixationDuration,
                data: {
                    task: 'top-down-fixation',
                    trial_index: i,
                },
            })

            // Stimulus grid
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: trialHtml,
                choices: [" "],
                trial_duration: config.maxTrialTime,
                data: {
                    task: 'top-down-trial',
                    trial_index: i,
                    targetCount: TARGETS_PER_SLIDE,
                },
            })

            // Inter-Trial Interval
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="width: 100vw; height: 100vh; background: black; display: flex; align-items: center; justify-content: center;"><div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div></div>',
                choices: "NO_KEYS",
                trial_duration: config.interTrialInterval,
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
        <div className="w-full h-screen bg-black text-white overflow-hidden">
            {phase === "idle" && (
                <div className="flex flex-col items-center justify-center h-full space-y-8">
                    <h2 className="text-3xl font-bold">Top Down Conjunction Search</h2>
                    <p className="text-gray-300 text-lg">Find targets (<span className="font-mono">E</span>) among distractors (<span className="font-mono">Ǝ</span>) in the grid</p>
                    <p className="text-gray-400">Each slide has exactly {TARGETS_PER_SLIDE} targets, and both targets and distractors are shown as # patches</p>
                    <p className="text-gray-400">Press <kbd className="px-2 py-1 bg-gray-700 rounded font-mono">Space</kbd> once after finding the targets</p>
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
