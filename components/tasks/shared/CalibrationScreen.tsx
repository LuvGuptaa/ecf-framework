"use client"

import { useState, useEffect, useRef } from "react"
import { trackingService } from "@/lib/tracking-service"

const SERIAL_EVENT_IDS = {
    blackScreen: 200,
    whiteScreen: 201,
} as const

interface CalibrationScreenProps {
    /** Duration in ms */
    duration: number
    /** Flash interval in ms (default 500) */
    interval?: number
    /** Called when calibration finishes */
    onComplete: () => void
}

export function CalibrationScreen({
    duration,
    interval = 500,
    onComplete,
}: CalibrationScreenProps) {
    const [isWhite, setIsWhite] = useState(false)
    const startTimeRef = useRef<number | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        startTimeRef.current = Date.now()

        // Flash between black and white
        intervalRef.current = setInterval(() => {
            setIsWhite((prev) => !prev)
        }, interval)

        // Stop after duration
        const timeout = setTimeout(() => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            onComplete()
        }, duration)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            clearTimeout(timeout)
        }
    }, [duration, interval, onComplete])

    useEffect(() => {
        const markerId = isWhite ? SERIAL_EVENT_IDS.whiteScreen : SERIAL_EVENT_IDS.blackScreen
        void trackingService.sendSerialEvent(markerId)
    }, [isWhite])

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: isWhite ? "#ffffff" : "#000000",
                zIndex: 9999,
                transition: "none",
            }}
        />
    )
}
