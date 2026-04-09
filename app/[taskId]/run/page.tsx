"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { getTask, tasks } from "@/lib/tasks/registry"
import { useTestStore } from "@/lib/stores/test-store"
import { useERPStore } from "@/lib/stores/erp-store"
import { CalibrationScreen } from "@/components/tasks/shared/CalibrationScreen"
import { RecordingService, downloadRecordingsAsZip } from "@/lib/recording-service"
import { Video, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"

type RunPhase = "permission" | "pre-calibration" | "task" | "post-calibration" | "saving" | "done"
type PermissionStep = "initial" | "screen-requested" | "screen-granted" | "camera-requested"

export default function TaskRunPage({ params }: { params: { taskId: string } }) {
  const router = useRouter()
  const { taskId } = params

  const task = getTask(taskId)
  const participant = useTestStore((state) => state.participant)
  const config = useTestStore((state) => state.config)
  const calibrationDuration = useTestStore((state) => state.calibrationDuration)

  const [phase, setPhase] = useState<RunPhase>("permission")
  const [permissionStep, setPermissionStep] = useState<PermissionStep>("initial")
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const cameraRecordingServiceRef = useRef<RecordingService | null>(null)
  const screenRecordingServiceRef = useRef<RecordingService | null>(null)

  useEffect(() => {
    useERPStore.getState().resetSessionState()
    useTestStore.getState().resetSessionState()
  }, [])

  useEffect(() => {
    if (!task) {
      router.push("/")
      return
    }
    if (!participant) {
      router.push(`/${taskId}`)
    }
  }, [task, participant, taskId, router])

  const requestScreenAccess = useCallback(async () => {
    setPermissionError(null)
    setPermissionStep("screen-requested")
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
        // @ts-expect-error - preferCurrentTab is a valid property in modern browsers
        preferCurrentTab: true,
      })
      const screenRecorder = new RecordingService()
      screenRecordingServiceRef.current = screenRecorder
      await screenRecorder.startStreamRecording(screenStream)
      
      setPermissionStep("screen-granted")
    } catch (err: unknown) {
      setPermissionStep("initial")
      const error = err as { name?: string }
      if (error?.name === "NotAllowedError" || error?.name === "NotFoundError") {
        setPermissionError("Screen recording permission was denied. This is required for the experiment.")
      } else {
        setPermissionError("Could not access screen recording. Please check browser permissions.")
      }
    }
  }, [])

  const requestCameraAccess = useCallback(async () => {
    setPermissionError(null)
    setPermissionStep("camera-requested")
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      const camRecorder = new RecordingService()
      cameraRecordingServiceRef.current = camRecorder
      await camRecorder.startStreamRecording(cameraStream)
      
      setPhase("pre-calibration")
    } catch (err: unknown) {
      setPermissionStep("screen-granted")
      const error = err as { name?: string }
      if (error?.name === "NotAllowedError") {
        setPermissionError("Camera permission was denied. Both screen and camera are required.")
      } else {
        setPermissionError("Could not access camera. Please check your device and try again.")
      }
    }
  }, [])

  const handlePreCalibrationComplete = useCallback(() => {
    setPhase("task")
  }, [])

  const handleTaskComplete = useCallback(() => {
    setPhase("post-calibration")
  }, [])

  const handlePostCalibrationComplete = useCallback(async () => {
    setPhase("saving")

    const name = participant?.name || "participant"
    let cameraResult: { blob: Blob; mimeType: string } | null = null
    let screenResult: { blob: Blob; mimeType: string } | null = null

    // Stop camera recording
    if (cameraRecordingServiceRef.current) {
      const blob = await cameraRecordingServiceRef.current.stopRecording()
      if (blob) {
        cameraResult = { blob, mimeType: cameraRecordingServiceRef.current.mimeType }
      }
    }

    // Stop screen recording
    if (screenRecordingServiceRef.current) {
      const blob = await screenRecordingServiceRef.current.stopRecording()
      if (blob) {
        screenResult = { blob, mimeType: screenRecordingServiceRef.current.mimeType }
      }
    }

    // Download both as a zip
    if (cameraResult || screenResult) {
      await downloadRecordingsAsZip(name, {
        screen: screenResult,
        camera: cameraResult,
      })
    }

    setPhase("done")
    const erpSessionId = useERPStore.getState().sessionId
    const testSessionId = useTestStore.getState().sessionId
    const sid = erpSessionId || testSessionId
    router.push(`/results?sessionId=${sid}`)
  }, [router, participant])

  if (!task || !participant) return null

  if (phase === "permission") {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-center space-y-8 max-w-md px-6">
          <div className="mx-auto w-24 h-24 rounded-full bg-white/10 flex items-center justify-center space-x-2">
            <Monitor className="h-8 w-8 text-white" />
            <Video className="h-8 w-8 text-white" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white">Permissions Required</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              This experiment requires both screen and camera recording for research purposes.
              You will be prompted to grant these access rights sequentially.
            </p>
          </div>

          {permissionError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{permissionError}</p>
            </div>
          )}

          <div className="flex flex-col space-y-4">
            {permissionStep === "initial" || permissionStep === "screen-requested" ? (
              <Button
                onClick={requestScreenAccess}
                disabled={permissionStep === "screen-requested"}
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg"
              >
                {permissionStep === "screen-requested" ? "Waiting for Screen Share..." : "1. Share Entire Screen"}
              </Button>
            ) : (
              <Button
                disabled
                className="w-full h-14 bg-green-900/50 text-green-400 border border-green-500/30 font-semibold text-lg"
              >
                ✓ Screen Shared
              </Button>
            )}

            {(permissionStep === "screen-granted" || permissionStep === "camera-requested") && (
              <Button
                onClick={requestCameraAccess}
                disabled={permissionStep === "camera-requested"}
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg animate-in fade-in"
              >
                {permissionStep === "camera-requested" ? "Waiting for Camera..." : "2. Allow Camera Access"}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (phase === "pre-calibration") {
    return (
      <CalibrationScreen
        duration={calibrationDuration}
        onComplete={handlePreCalibrationComplete}
      />
    )
  }

  if (phase === "post-calibration") {
    return (
      <CalibrationScreen
        duration={calibrationDuration}
        onComplete={handlePostCalibrationComplete}
      />
    )
  }

  if (phase === "saving") {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-white text-lg font-medium">Preparing recordings…</p>
          <p className="text-gray-400 text-sm">Your zip file will download automatically.</p>
        </div>
      </div>
    )
  }

  if (phase === "done") {
    return null
  }

  return (
    <task.RunComponent
      config={config}
      participant={participant}
      onComplete={handleTaskComplete}
    />
  )
}
