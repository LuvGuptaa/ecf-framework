"use client"

import { useState, useCallback, useEffect } from "react"
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
const REQUIRED_TARGETS = 2
const LETTERS_AFTER_SECOND_TARGET = 5

function getRandomNonTargetLetter(): string {
    return NON_TARGET_LETTERS[Math.floor(Math.random() * NON_TARGET_LETTERS.length)]
}

/**
 * Generate a sequence that always contains at least two targets (E).
 *
 * Rules:
 * - Each position has `targetProbability`% chance of being E
 * - No consecutive Es
 * - If no response occurs, sequence ends after the 2nd E + 5 more letters
 * - The trailing 5 letters can include E as well
 */
function generateStimulusSequence(config: OddballConfig): { letter: string; type: PatchType }[] {
    const sequence: { letter: string; type: PatchType }[] = []
    const targetProb = config.targetProbability / 100
    let targetsSeen = 0
    let lastWasTarget = false

    // Reserve enough room to place two non-consecutive Es before the trailing window.
    const minPrefixLengthForNonConsecutiveTargets = (REQUIRED_TARGETS * 2) - 1
    const maxPrefixLength = Math.max(
        config.stimuliPerTrial - LETTERS_AFTER_SECOND_TARGET,
        minPrefixLengthForNonConsecutiveTargets,
    )

    while (targetsSeen < REQUIRED_TARGETS) {
        const targetsRemaining = REQUIRED_TARGETS - targetsSeen
        const slotsRemaining = maxPrefixLength - sequence.length

        const targetFeasible = !lastWasTarget && (slotsRemaining - 1) >= (targetsRemaining > 1 ? 2 * (targetsRemaining - 1) : 0)
        const normalFeasible = (slotsRemaining - 1) >= ((2 * targetsRemaining) - 1)

        const shouldPlaceTarget = targetFeasible && (!normalFeasible || Math.random() < targetProb)

        if (shouldPlaceTarget) {
            sequence.push({ letter: "E", type: "target" })
            targetsSeen++
            lastWasTarget = true
        } else {
            sequence.push({ letter: getRandomNonTargetLetter(), type: "normal" })
            lastWasTarget = false
        }
    }

    for (let i = 0; i < LETTERS_AFTER_SECOND_TARGET; i++) {
        const isTarget = !lastWasTarget && Math.random() < targetProb
        if (isTarget) {
            sequence.push({ letter: "E", type: "target" })
            lastWasTarget = true
        } else {
            sequence.push({ letter: getRandomNonTargetLetter(), type: "normal" })
            lastWasTarget = false
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
        if (phase !== "idle") return

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
        // WEB SERIAL API: ODDBALL TIMELINE
        for (let i = 0; i < config.numberOfTrials; i++) {
            const sequence = generateStimulusSequence(config)
            let endCurrentTrial = false

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
                    timeline: [{
                        type: htmlKeyboardResponse,
                        stimulus: stimHtml,
                        choices: [" "],
                        trial_duration: config.stimulusDuration,
                        response_ends_trial: true,
                        data: {
                            task: 'oddball-trial', // Mark this so it gets saved to firebase
                            trial_index: i,
                            stimulus_index: stimIdx,
                            letter: stim.letter,
                            target_type: stim.type,
                        },
                        on_finish: (data: Record<string, unknown>) => {
                            const pressedSpace = data.response !== null
                            data.space_pressed = pressedSpace
                            data.response_timestamp_ms = (data.rt as number | null) ?? null
                            if (pressedSpace) {
                                endCurrentTrial = true
                            }
                        },
                    }],
                    conditional_function: () => !endCurrentTrial,
                })

                if (stimIdx < sequence.length - 1) {
                    // The 100ms blank gap
                    newTimeline.push({
                        timeline: [{
                            type: htmlKeyboardResponse,
                            stimulus: '<div style="width: 100vw; height: 100vh; background: #000;"></div>',
                            choices: [" "],
                            trial_duration: BLANK_DURATION,
                            response_ends_trial: true,
                            data: {
                                task: 'oddball-gap',
                                trial_index: i,
                                stimulus_index: stimIdx,
                            },
                            on_finish: (data: Record<string, unknown>) => {
                                if (data.response !== null) {
                                    endCurrentTrial = true
                                }
                            },
                        }],
                        conditional_function: () => !endCurrentTrial,
                    })
                }
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

    // Allow spacebar to start as well
    useEffect(() => {
        if (phase !== "idle") return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return
            if (e.code === "Space" || e.key === " ") {
                e.preventDefault()
                startTask()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, config, participant])

    const handleFinish = useCallback(() => {
        setPhase("complete")
        if (onComplete) {
            onComplete()
        } else if (sessionId) {
            router.push(`/results?sessionId=${sessionId}`)
        }
    }, [onComplete, router, sessionId])

    return (
        <div className="w-full h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden">
            {phase === "idle" && (
                <div className="text-center space-y-8">
                    <h2 className="text-3xl font-bold">Visual Oddball</h2>
                    <p className="text-gray-300 text-lg">A fixation cross appears every trial, then single letters are shown at the same center location</p>
                    <p className="text-gray-400">Target letter is <kbd className="px-2 py-1 bg-gray-700 rounded font-mono text-white">E</kbd></p>
                    <p className="text-gray-400">Press <kbd className="px-2 py-1 bg-gray-700 rounded font-mono">Space</kbd> during a trial to end it immediately.</p>
                    <p className="text-gray-500 text-sm">If you do not press Space, each trial auto-ends after the 2nd E + 5 more letters.</p>
                    <button
                        onClick={startTask}
                        className="px-8 py-4 bg-white text-black rounded-lg text-xl font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Start Test
                    </button>
                    <p className="text-gray-500 text-sm">or press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded font-mono text-xs">Space</kbd> to begin</p>
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
