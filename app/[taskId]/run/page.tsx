"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { getTask } from "@/lib/tasks/registry"
import { useTestStore } from "@/lib/stores/test-store"
import { useERPStore } from "@/lib/stores/erp-store"
import { CalibrationScreen } from "@/components/tasks/shared/CalibrationScreen"
import { RecordingService } from "@/lib/recording-service"
import { localDB } from "@/lib/local-db"
import { Camera, Video } from "lucide-react"

type RunPhase = "permission" | "pre-calibration" | "task" | "post-calibration" | "done"

export default function TaskRunPage({ params }: { params: { taskId: string } }) {
  const router = useRouter()
  const { taskId } = params

  const task = getTask(taskId)
  const participant = useTestStore((state) => state.participant)
  const config = useTestStore((state) => state.config)
  const calibrationDuration = useTestStore((state) => state.calibrationDuration)

  const [phase, setPhase] = useState<RunPhase>("permission")
  const [isCameraRecording, setIsCameraRecording] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const cameraRecordingServiceRef = useRef<RecordingService | null>(null)

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

  const requestCameraAndStart = useCallback(async () => {
    setPermissionError(null)
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      const camRecorder = new RecordingService((state) => setIsCameraRecording(state.isRecording))
      cameraRecordingServiceRef.current = camRecorder
      await camRecorder.startStreamRecording(cameraStream)
      setPhase("pre-calibration")
    } catch (err: unknown) {
      const error = err as { name?: string }
      setPermissionError(
        error?.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access and try again."
          : "Could not access camera. Please check your device and try again."
      )
    }
  }, [])

  const handlePreCalibrationComplete = useCallback(() => {
    setPhase("task")
  }, [])

  const handleTaskComplete = useCallback(() => {
    setPhase("post-calibration")
  }, [])

  const handlePostCalibrationComplete = useCallback(async () => {
    if (cameraRecordingServiceRef.current) {
      const blob = await cameraRecordingServiceRef.current.stopRecording()
      const erpSessionId = useERPStore.getState().sessionId
      const testSessionId = useTestStore.getState().sessionId
      const sid = erpSessionId || testSessionId
      if (blob && sid) {
        await localDB.saveRecording({
          id: `${sid}-camera`,
          sessionId: sid,
          type: "camera",
          blob,
          createdAt: new Date(),
        })
      }
    }

    setPhase("done")
    const erpSessionId = useERPStore.getState().sessionId
    const testSessionId = useTestStore.getState().sessionId
    const sid = erpSessionId || testSessionId
    router.push(`/results?sessionId=${sid}`)
  }, [router])

  if (!task || !participant) return null

  if (phase === "permission") {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-center space-y-8 max-w-md px-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <Video className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white">Camera Permission Required</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              This experiment records your face via the camera during the task for research purposes.
              Please grant camera access when prompted by your browser.
            </p>
          </div>

          {permissionError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{permissionError}</p>
            </div>
          )}

          <button
            onClick={requestCameraAndStart}
            className="px-8 py-4 bg-white text-black rounded-lg text-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            Grant Camera Access & Start
          </button>
        </div>
      </div>
    )
  }

  if (phase === "pre-calibration") {
    return (
      <>
        <CalibrationScreen
          duration={calibrationDuration}
          onComplete={handlePreCalibrationComplete}
        />
        {isCameraRecording && <CameraIndicator />}
      </>
    )
  }

  if (phase === "post-calibration") {
    return (
      <>
        <CalibrationScreen
          duration={calibrationDuration}
          onComplete={handlePostCalibrationComplete}
        />
        {isCameraRecording && <CameraIndicator />}
      </>
    )
  }

  if (phase === "done") {
    return null
  }

  return (
    <>
      <task.RunComponent
        config={config}
        participant={participant}
        onComplete={handleTaskComplete}
      />
      {isCameraRecording && <CameraIndicator />}
    </>
  )
}

function CameraIndicator() {
  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-full shadow-sm border pointer-events-none z-[10000]">
      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
      <Camera className="h-3 w-3 text-slate-600" />
      <span className="text-xs font-medium text-slate-600">CAM</span>
    </div>
  )
}
