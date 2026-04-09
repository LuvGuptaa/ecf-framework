"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { dataService } from "@/lib/data-service"
import { trackingService } from "@/lib/tracking-service"
import { JsPsychWrapper } from "@/components/tasks/shared/JsPsychWrapper"
import { useERPStore } from "@/lib/stores/erp-store"
import type { OddballConfig, PatchType } from "@/lib/types"

// Plugins are imported dynamically inside startTask to prevent SSR crashes

interface OddballRunProps {
    config: OddballConfig
    participant: { id: string; name: string; age: number; email?: string; notes?: string }
    onComplete: () => void
}

const NON_TARGET_LETTERS = "ABCDFGHIJKLMNOPQRSTUVWXYZ".split("") // excludes E

function getRandomNonTargetLetter(): string {
    return NON_TARGET_LETTERS[Math.floor(Math.random() * NON_TARGET_LETTERS.length)]
}

/**
 * Generate a stimulus sequence with Poisson-distributed targets (E).
 *
 * Rules:
 * - Each position has `targetProbability`% chance of being E
 * - No two consecutive Es
 * - Trial ends exactly 5 letters after the Nth target (N = targetsToDetect)
 * - If the Nth target never appears within `stimuliPerTrial` letters, end anyway
 */
function generateStimulusSequence(config: OddballConfig): { letter: string; type: PatchType }[] {
    const sequence: { letter: string; type: PatchType }[] = []
    const targetProb = config.targetProbability / 100
    const targetsNeeded = config.targetsToDetect || 2
    let targetsSeen = 0
    let lettersAfterLastNeededTarget = -1 // -1 means we haven't hit target N yet
    let lastWasTarget = false

    for (let i = 0; i < config.stimuliPerTrial; i++) {
        // Check if we've completed 5 letters after the Nth target
        if (lettersAfterLastNeededTarget >= 5) {
            break
        }

        let isTarget = false
        if (!lastWasTarget && targetsSeen < 100) {
            // Poisson-style: each slot independently has targetProb chance
            isTarget = Math.random() < targetProb
        }

        if (isTarget) {
            sequence.push({ letter: "E", type: "target" })
            targetsSeen++
            lastWasTarget = true

            if (targetsSeen >= targetsNeeded && lettersAfterLastNeededTarget === -1) {
                lettersAfterLastNeededTarget = 0
            }
        } else {
            sequence.push({ letter: getRandomNonTargetLetter(), type: "normal" })
            lastWasTarget = false

            if (lettersAfterLastNeededTarget >= 0) {
                lettersAfterLastNeededTarget++
            }
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
        const [
            { default: htmlKeyboardResponse },
            { default: callFunctionPlugin }
        ] = await Promise.all([
            import("@jspsych/plugin-html-keyboard-response"),
            import("@jspsych/plugin-call-function")
        ])

        const { id } = await dataService.createERPSession({
            participantId: participant.id,
            participantName: participant.name,
            taskType: "visual-oddball",
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

        const BLANK_DURATION = 100

        for (let i = 0; i < config.numberOfTrials; i++) {
            const sequence = generateStimulusSequence(config)

            // Fixation cross before every trial
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="font-size: 80px; font-weight: 700; color: #fff; font-family: monospace; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; background: #000;">+</div>',
                choices: "NO_KEYS",
                trial_duration: config.fixationDuration,
                data: {
                    task: 'oddball-fixation',
                    trial_index: i,
                },
            })

            // Run the sequence. For Oddball, we usually want them to press Space whenever.
            // Using a jsPsych timeline variable or just a loop of trials.
            sequence.forEach((stim, stimIdx) => {
                const stimHtml = `
                    <div style="position:relative;width:100vw;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                        <div style="position:relative;width:140px;height:140px;display:flex;align-items:center;justify-content:center;font-size:120px;font-weight:700;color:#fff;font-family:'Courier New',Courier,monospace;line-height:1;user-select:none;">
                            ${stim.letter}
                        </div>
                    </div>
                `
                // The letter stimulus
                newTimeline.push({
                    type: htmlKeyboardResponse,
                    stimulus: stimHtml,
                    choices: [" "],
                    trial_duration: config.stimulusDuration,
                    response_ends_trial: false, // Don't end trial early if they press space
                    data: {
                        task: 'oddball-trial', // Mark this so it gets saved to firebase
                        trial_index: i,
                        stimulus_index: stimIdx,
                        letter: stim.letter,
                        target_type: stim.type,
                    },
                    on_finish: (data: Record<string, unknown>) => {
                        data.space_pressed = data.response !== null
                        data.response_timestamp_ms = (data.rt as number | null) ?? null
                    },
                })

                // The 100ms blank gap
                newTimeline.push({
                    type: htmlKeyboardResponse,
                    stimulus: '<div style="width: 100vw; height: 100vh; background: #000;"></div>',
                    choices: [" "],
                    trial_duration: BLANK_DURATION,
                    response_ends_trial: false,
                })
            })

            // Inter-Trial Interval (blank black screen)
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="width: 100vw; height: 100vh; background: black;"></div>',
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

    const targetsNeeded = config.targetsToDetect || 2

    return (
        <div className="w-full h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden">
            {phase === "idle" && (
                <div className="text-center space-y-8">
                    <h2 className="text-3xl font-bold">Visual Oddball</h2>
                    <p className="text-gray-300 text-lg">A fixation cross appears every trial, then single letters are shown at the same center location</p>
                    <p className="text-gray-400">Target letter is <kbd className="px-2 py-1 bg-gray-700 rounded font-mono text-white">E</kbd></p>
                    <p className="text-gray-400">Press <kbd className="px-2 py-1 bg-gray-700 rounded font-mono">Space</kbd> once, during the sequence, when you detect {targetsNeeded} targets</p>
                    <p className="text-gray-500 text-sm">Trial ends 5 letters after the {targetsNeeded === 2 ? "2nd" : `${targetsNeeded}th`} E</p>
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
                    taskName="visual-oddball"
                    onFinish={handleFinish}
                />
            )}

            {phase === "complete" && (
                <div className="text-center space-y-4">
                    <h2 className="text-3xl font-bold">Task Complete</h2>
                    <p className="text-gray-300">Processing data...</p>
                </div>
            )}
        </div>
    )
}
