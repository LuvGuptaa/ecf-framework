"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { dataService } from "@/lib/data-service"
import { trackingService } from "@/lib/tracking-service"
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

const NON_TARGET_LETTERS = "ABCDFGHIJKLMNOPQRSTUVWXYZ".split("") // excludes E

function getRandomNonTargetLetter(): string {
    return NON_TARGET_LETTERS[Math.floor(Math.random() * NON_TARGET_LETTERS.length)]
}

function generateStimulusSequence(config: OddballConfig): { letter: string; type: PatchType }[] {
    const sequence: { letter: string; type: PatchType }[] = []
    for (let i = 0; i < config.stimuliPerTrial; i++) {
        const rand = Math.random() * 100
        if (rand < config.targetProbability) {
            sequence.push({ letter: "E", type: "target" })
        } else if (rand < config.targetProbability + config.distractorProbability) {
            sequence.push({ letter: getRandomNonTargetLetter(), type: "distractor" })
        } else {
            sequence.push({ letter: getRandomNonTargetLetter(), type: "normal" })
        }
    }
    return sequence
}

function buildAnimatedOddballStimulus(
    sequence: { letter: string; type: PatchType }[],
    stimulusDuration: number,
    trialIndex: number
): string {
    const totalDuration = sequence.length * stimulusDuration
    const keyframes: string[] = []
    const spans = sequence.map((stim, idx) => {
        const keyframeName = `oddball_${trialIndex}_${idx}`
        const startPct = (idx / sequence.length) * 100
        const endPct = ((idx + 1) / sequence.length) * 100
        const hideBefore = Math.max(startPct - 0.01, 0)
        const hideAfter = Math.min(endPct + 0.01, 100)

        keyframes.push(`
            @keyframes ${keyframeName} {
                0%, ${hideBefore}% { opacity: 0; }
                ${startPct}%, ${endPct}% { opacity: 1; }
                ${hideAfter}%, 100% { opacity: 0; }
            }
        `)

        return `<span style="position:absolute;opacity:0;animation:${keyframeName} ${totalDuration}ms linear 1 forwards;">${stim.letter}</span>`
    })

    return `
        <div style="position:relative;width:100vw;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <style>${keyframes.join("\n")}</style>
            <div style="position:relative;width:140px;height:140px;display:flex;align-items:center;justify-content:center;font-size:120px;font-weight:700;color:#fff;font-family:'Courier New',Courier,monospace;line-height:1;user-select:none;">
                ${spans.join("")}
            </div>
        </div>
    `
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

        const newTimeline: Record<string, unknown>[] = []

        newTimeline.push({
            type: callFunctionPlugin,
            func: () => {
                trackingService.startFrameRateMonitoring()
            }
        })

        const targetsNeeded = config.targetsToDetect || 2

        for (let i = 0; i < config.numberOfTrials; i++) {
            const sequence = generateStimulusSequence(config)
            const trialDuration = Math.max(1, sequence.length * config.stimulusDuration)

            // Fixation cross before every trial
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: '<div style="font-size: 80px; font-weight: 700; color: #fff; font-family: monospace; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh;">+</div>',
                choices: "NO_KEYS",
                trial_duration: config.fixationDuration,
                data: {
                    task: 'oddball-fixation',
                    trial_index: i,
                },
            })

            // Present the full stimulus sequence in one trial.
            // Participant presses Space once while the sequence is visible.
            newTimeline.push({
                type: htmlKeyboardResponse,
                stimulus: buildAnimatedOddballStimulus(sequence, config.stimulusDuration, i),
                choices: [" "],
                trial_duration: trialDuration,
                data: {
                    task: 'oddball-trial',
                    trial_index: i,
                    targetsNeeded,
                    sequence_letters: sequence.map((s) => s.letter),
                    sequence_types: sequence.map((s) => s.type),
                    sequence_duration: trialDuration,
                },
                on_finish: (data: Record<string, unknown>) => {
                    data.space_pressed = data.response !== null
                    data.response_timestamp_ms = (data.rt as number | null) ?? null
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

    const targetsNeeded = config.targetsToDetect || 2

    return (
        <div className="w-full h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden">
            {phase === "idle" && (
                <div className="text-center space-y-8">
                    <h2 className="text-3xl font-bold">Visual Oddball</h2>
                    <p className="text-gray-300 text-lg">A fixation cross appears every trial, then single letters are shown at the same center location</p>
                    <p className="text-gray-400">Target letter is <kbd className="px-2 py-1 bg-gray-700 rounded font-mono text-white">E</kbd></p>
                    <p className="text-gray-400">Press <kbd className="px-2 py-1 bg-gray-700 rounded font-mono">Space</kbd> once, during the sequence, when you detect {targetsNeeded} targets</p>
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
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
        </div>
    )
}
