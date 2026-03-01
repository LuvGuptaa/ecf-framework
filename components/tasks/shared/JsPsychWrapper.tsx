"use client"

import { useState, useRef, useEffect } from "react"
import "jspsych/css/jspsych.css"
import { exportBehavioralData } from "@/lib/bids-export"
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

    useEffect(() => {
        if (!containerRef.current || isRunning) return
        setIsRunning(true)
        const runExperiment = async () => {
            // Dynamically import jsPsych since it requires window/DOM
            const { initJsPsych } = await import('jspsych')

            // 2. Setup JsPsych
            const jsPsych = initJsPsych({
                display_element: containerRef.current!,
                on_finish: async () => {
                    // Export behavioral data
                    const csvData = jsPsych.data.get().csv()
                    exportBehavioralData(participantId, taskName, csvData)

                    // Mark session complete in Firebase
                    await dataService.completeERPSession(sessionId, {
                        completedAt: new Date()
                    })

                    if (onFinish) onFinish()
                },
            })

            // 3. Run timeline
            jsPsych.run(timeline)
        }

        runExperiment()

        // Cleanup on unmount if user leaves early
        return () => { }
    }, [timeline, isRunning, participantId, sessionId, taskName, onFinish])

    return (
        <div className="w-full h-full min-h-screen bg-black" ref={containerRef} />
    )
}


