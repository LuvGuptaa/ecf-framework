"use client"

import { useRef, useEffect } from "react"
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
    const initRef = useRef(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsPsychRef = useRef<any>(null)

    useEffect(() => {
        if (!containerRef.current) return

        let isCancelled = false
        let innerJsPsych: any = null

        const runExperiment = async () => {
            const { initJsPsych } = await import('jspsych')

            if (isCancelled) return

            innerJsPsych = initJsPsych({
                display_element: containerRef.current!,
                on_finish: async () => {
                    const trials = innerJsPsych.data.get().values()

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

                    if (onFinish && !isCancelled) onFinish()
                },
            })

            jsPsychRef.current = innerJsPsych
            if (!isCancelled) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                innerJsPsych.run(timeline as any)
            }
        }

        runExperiment()

        return () => {
            isCancelled = true
            if (innerJsPsych) {
                try {
                    // Clear the DOM since we might remount
                    if (containerRef.current) {
                        containerRef.current.innerHTML = ''
                    }
                    innerJsPsych.endExperiment?.()
                } catch { /* ignore */ }
            }
            if (jsPsychRef.current) {
                try {
                    jsPsychRef.current.endExperiment?.()
                } catch { /* ignore */ }
            }
        }
    }, [timeline, participantId, sessionId, taskName, onFinish])

    // Lock body scroll while experiment is running
    useEffect(() => {
        const html = document.documentElement
        const body = document.body
        html.style.overflow = 'hidden'
        body.style.overflow = 'hidden'
        html.style.height = '100vh'
        body.style.height = '100vh'
        return () => {
            html.style.overflow = ''
            body.style.overflow = ''
            html.style.height = ''
            body.style.height = ''
        }
    }, [])

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                .jspsych-display-element {
                    max-height: 100vh !important;
                    height: 100vh !important;
                    overflow: hidden !important;
                }
                .jspsych-content-wrapper {
                    max-height: 100vh !important;
                    overflow: hidden !important;
                }
                .jspsych-content {
                    max-height: 100vh !important;
                    overflow: hidden !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
            `}} />
            <div className="w-full h-screen overflow-hidden bg-black" ref={containerRef} />
        </>
    )
}
