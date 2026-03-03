"use client"

import { useState, useRef, useEffect } from "react"
import "jspsych/css/jspsych.css"

import { dataService } from "@/lib/data-service"

interface JsPsychWrapperProps {
    timeline: Record<string, unknown>[]
    participantId: string
    sessionId: string
    taskName: string
    onFinish?: () => void
}

export function JsPsychWrapper({
    timeline,
    participantId,
    sessionId,
    taskName,
    onFinish,
}: JsPsychWrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isRunning, setIsRunning] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsPsychRef = useRef<any>(null)

    useEffect(() => {
        if (!containerRef.current || isRunning) return
        setIsRunning(true)

        const runExperiment = async () => {
            const { initJsPsych } = await import('jspsych')

            const jsPsych = initJsPsych({
                display_element: containerRef.current!,
                on_finish: async () => {
                    const trials = jsPsych.data.get().values()

                    const taskTrials = trials.filter(
                        (t: Record<string, unknown>) =>
                            typeof t.task === 'string' && t.task.endsWith('-trial')
                    )

                    let correctCount = 0

                    for (const trial of taskTrials) {
                        try {
                            const rt = (trial.rt as number) ?? 0
                            const isCorrect = trial.correct !== false
                            if (isCorrect) correctCount++

                            await dataService.recordERPTrial({
                                sessionId,
                                reactionTime: rt,
                                isCorrect,
                                jsPsychData: trial as Record<string, unknown>,
                            })
                        } catch (e) {
                            console.error("Failed saving trial to Firebase:", e)
                        }
                    }

                    const accuracy = taskTrials.length > 0 ? (correctCount / taskTrials.length) * 100 : 0
                    console.log(`[JsPsych] Task accuracy: ${accuracy.toFixed(1)}%`)

                    await dataService.completeERPSession(sessionId, {
                        completedAt: new Date(),
                    })

                    if (onFinish) onFinish()
                },
            })

            jsPsychRef.current = jsPsych
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jsPsych.run(timeline as any)
        }

        runExperiment()

        return () => {
            if (jsPsychRef.current) {
                try {
                    jsPsychRef.current.endExperiment()
                } catch { /* already ended */ }
            }
        }
    }, [timeline, isRunning, participantId, sessionId, taskName, onFinish])

    return (
        <div className="w-full h-screen overflow-hidden bg-black" ref={containerRef} />
    )
}
