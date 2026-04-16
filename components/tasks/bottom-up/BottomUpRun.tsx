"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { renderToString } from "react-dom/server"
import { dataService } from "@/lib/data-service"
import { trackingService } from "@/lib/tracking-service"
import { ERPDisplay } from "@/components/tasks/shared/ERPDisplay"
import { JsPsychWrapper } from "@/components/tasks/shared/JsPsychWrapper"
import { useERPStore } from "@/lib/stores/erp-store"
import type { BottomUpConfig, PatchItem } from "@/lib/types"

import htmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response"
import callFunctionPlugin from "@jspsych/plugin-call-function"

const SERIAL_EVENT_IDS = {
    experimentStart: 100,
    experimentEnd: 101,
    blackScreen: 200,
    fixationCross: 210,
} as const

interface BottomUpRunProps {
    config: BottomUpConfig
    participant: { id: string; name: string; age: number; email?: string; notes?: string }
    onComplete: () => void
}

function generatePatches(config: BottomUpConfig): PatchItem[] {
    const totalCells = config.gridSize * config.gridSize
    const patches: PatchItem[] = []

    // Pick one random cell for the target
    const targetIndex = Math.floor(Math.random() * totalCells)

    for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / config.gridSize)
        const col = i % config.gridSize

        if (i === targetIndex) {
            // Single target with configurable color
            patches.push({
                type: "target",
                row,
                col,
                color: config.targetColor,
            })
        } else {
            // Distractors use the same patch format in white
            patches.push({
                type: "distractor",
                row,
                col,
                color: "#ffffff",
            })
        }
    }
    return patches
}

export function BottomUpRun({ config, participant, onComplete }: BottomUpRunProps) {
    const router = useRouter()
    const [phase, setPhase] = useState<"idle" | "running" | "complete">("idle")
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [timeline, setTimeline] = useState<Record<string, unknown>[]>([])

    const startTask = async () => {
        await trackingService.sendSerialEvent(SERIAL_EVENT_IDS.experimentStart)

        const { id } = await dataService.createERPSession({
            participantId: participant.id,
            participantName: participant.name,
            taskType: "bottom-up",
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
        // WEB SERIAL API: BOTTOM UP TIMELINE
        for (let i = 0; i < config.numberOfTrials; i++) {
            const patches = generatePatches(config)

            const trialHtml = renderToString(
                <ERPDisplay patches={patches} gridSize={config.gridSize} showHashes={true} />
            )
            const wrappedStimulus = `<div style="width:100vw;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;">${trialHtml}</div>`

            // Fixation cross before each trial
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="width: 100vw; height: 100vh; background: black; display: flex; align-items: center; justify-content: center;"><div style="font-size: 80px; font-weight: 700; color: #fff; font-family: monospace;">+</div></div>',
                choices: "NO_KEYS",
                trial_duration: config.fixationDuration,
                data: {
                    task: 'bottom-up-fixation',
                    trial_index: i,
                    serialEventId: SERIAL_EVENT_IDS.fixationCross,
                },
            })

            // Stimulus grid
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: wrappedStimulus,
                choices: [" "],
                trial_duration: config.maxTrialTime,
                data: {
                    task: 'bottom-up-trial',
                    trial_index: i,
                    targetColor: config.targetColor,
                },
            })

            // Inter-Trial Interval
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="width: 100vw; height: 100vh; background: black; display: flex; align-items: center; justify-content: center;"><div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div></div>',
                choices: "NO_KEYS",
                trial_duration: config.interTrialInterval,
                data: {
                    task: 'bottom-up-iti',
                    trial_index: i,
                    serialEventId: SERIAL_EVENT_IDS.blackScreen,
                },
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
        void trackingService.sendSerialEvent(SERIAL_EVENT_IDS.experimentEnd)
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
                    <h2 className="text-3xl font-bold">Bottom Up Search</h2>
                    <p className="text-gray-300 text-lg">
                        Find the <strong style={{ color: config.targetColor }}>differently colored</strong> letter among white distractors
                    </p>
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
