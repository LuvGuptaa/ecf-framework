"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { renderToString } from "react-dom/server"
import { dataService } from "@/lib/data-service"
import { trackingService } from "@/lib/tracking-service"
import { SinglePatchDisplay } from "@/components/tasks/shared/ERPDisplay"
import { JsPsychWrapper } from "@/components/tasks/shared/JsPsychWrapper"
import { useERPStore } from "@/lib/stores/erp-store"
import type { OddballConfig, PatchType } from "@/lib/types"

import htmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response"
import callFunctionPlugin from "@jspsych/plugin-call-function"

interface OddballRunProps {
    config: OddballConfig
    participant: { id: string; name: string; age: number; email?: string; notes?: string }
    onComplete: () => void
}

function generateStimulusSequence(config: OddballConfig): PatchType[] {
    const sequence: PatchType[] = []
    for (let i = 0; i < config.stimuliPerTrial; i++) {
        const rand = Math.random() * 100
        if (rand < config.targetProbability) {
            sequence.push("target")
        } else if (rand < config.targetProbability + config.distractorProbability) {
            sequence.push("distractor")
        } else {
            sequence.push("normal")
        }
    }
    return sequence
}

export function OddballRun({ config, participant, onComplete }: OddballRunProps) {
    const router = useRouter()
    const [phase, setPhase] = useState<"idle" | "running" | "complete">("idle")
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [timeline, setTimeline] = useState<Record<string, unknown>[]>([])

    const startTask = async () => {
        const { id } = await dataService.createERPSession({
            participantId: participant.id,
            participantName: participant.name,
            taskType: "visual-oddball",
            taskConfig: config,
        })
        setSessionId(id)
        useERPStore.getState().setSessionMeta({ sessionId: id, totalTrials: config.numberOfTrials })

        const newTimeline = []

        newTimeline.push({
            type: callFunctionPlugin,
            func: () => {
                trackingService.startFrameRateMonitoring()
            }
        })

        for (let i = 0; i < config.numberOfTrials; i++) {
            const sequence = generateStimulusSequence(config)

            // Initial Fixation
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="font-size: 120px; font-weight: 700; color: #fff; font-family: monospace;">✕</div>',
                choices: "NO_KEYS",
                trial_duration: config.fixationDuration,
            })

            // Sequence of Stimuli
            sequence.forEach((stimType, idx) => {
                const stimHtml = renderToString(
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <SinglePatchDisplay type={stimType} size={200} />
                    </div>
                )

                newTimeline.push({
                    type: htmlKeyboardResponse,
                    stimulus: stimHtml,
                    choices: "NO_KEYS",
                    trial_duration: config.stimulusDuration,
                    data: {
                        task: 'oddball-stimulus',
                        trial_index: i,
                        stimulus_index: idx,
                        stimulus_type: stimType
                    },
                    on_start: () => {
                    }
                })
            })

            // Response Phase (Press Space twice)
            // JS psych doesn't natively support "press space twice" easily in one htmlKeyboardResponse plugin
            // So we will just chain two of them.

            const responseHtml1 = `
        <div style="text-align: center; color: white;">
          <div style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Respond Now</div>
          <p style="color: #9ca3af;">Press Space twice (0/2)</p>
        </div>
      `
            const responseHtml2 = `
        <div style="text-align: center; color: white;">
          <div style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Respond Now</div>
          <p style="color: #9ca3af;">Press Space twice (1/2)</p>
        </div>
      `

            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: responseHtml1,
                choices: [" "], // Space
                trial_duration: config.maxTrialTime,
                on_start: () => { },
                on_finish: () => {
                }
            })

            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: responseHtml2,
                choices: [" "], // Space
                trial_duration: config.maxTrialTime, // Reset timer for 2nd press
                on_finish: () => {
                }
            })

            // Inter-Trial Interval
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div>',
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
        <div className="w-full h-screen bg-black text-white flex flex-col items-center justify-center">
            {phase === "idle" && (
                <div className="text-center space-y-8">
                    <h2 className="text-3xl font-bold">Visual Oddball</h2>
                    <p className="text-gray-300 text-lg">A fixation cross will appear, followed by stimuli one at a time</p>
                    <p className="text-gray-400">After all {config.stimuliPerTrial} stimuli, press <kbd className="px-2 py-1 bg-gray-700 rounded font-mono">Space</kbd> twice</p>
                    <button
                        onClick={startTask}
                        className="px-8 py-4 bg-white text-black rounded-lg text-xl font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Start Test
                    </button>
                </div>
            )}

            {phase === "running" && sessionId && (
                <div className="absolute inset-0">
                    <JsPsychWrapper
                        timeline={timeline}
                        participantId={participant.id}
                        sessionId={sessionId}
                        taskName="visual-oddball"
                        onFinish={handleFinish}
                    />
                </div>
            )}

            {phase === "complete" && (
                <div className="text-center space-y-4">
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
