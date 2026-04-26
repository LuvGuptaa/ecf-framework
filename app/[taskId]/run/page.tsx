"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { getTask } from "@/lib/tasks/registry"
import { useTestStore } from "@/lib/stores/test-store"
import { useERPStore } from "@/lib/stores/erp-store"
import { CalibrationScreen } from "@/components/tasks/shared/CalibrationScreen"
import { RecordingService, downloadRecordingsAsZip } from "@/lib/recording-service"
import { trackingService } from "@/lib/tracking-service"
import { Video, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"

type RunPhase = "permission" | "pre-calibration" | "task" | "post-calibration" | "saving" | "done"
type PermissionStep = "initial" | "screen-requested" | "screen-granted" | "camera-requested"

const SERIAL_TEST_ID = 999

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
  const [serialSupported, setSerialSupported] = useState(false)
  const [serialConnected, setSerialConnected] = useState(false)
  const [serialBusy, setSerialBusy] = useState(false)
  const [serialStatus, setSerialStatus] = useState("Web Serial is disconnected.")

  const cameraRecordingServiceRef = useRef<RecordingService | null>(null)
  const screenRecordingServiceRef = useRef<RecordingService | null>(null)

  useEffect(() => {
    useERPStore.getState().resetSessionState()
    useTestStore.getState().resetSessionState()
    trackingService.setSerialEventEmissionEnabled(false)
  }, [])

  useEffect(() => {
    setSerialSupported(trackingService.isWebSerialSupported())
    setSerialConnected(trackingService.isSerialConnected())
  }, [])

  useEffect(() => {
    return () => {
      trackingService.setSerialEventEmissionEnabled(false)
      void trackingService.disconnectSerial()
    }
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

  const handleConnectSerial = useCallback(async () => {
    setSerialBusy(true)
    setSerialStatus("Connecting to serial device...")

    try {
      await trackingService.connectSerial(9600)
      setSerialConnected(true)
      setSerialStatus("Connected. Marker output stays locked until screen/camera are granted and calibration begins.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not connect to serial device."
      setSerialConnected(false)
      setSerialStatus(message)
    } finally {
      setSerialBusy(false)
    }
  }, [])

  const handleDisconnectSerial = useCallback(async () => {
    setSerialBusy(true)
    await trackingService.disconnectSerial()
    setSerialConnected(false)
    setSerialStatus("Serial disconnected.")
    setSerialBusy(false)
  }, [])

  const handleSendSerialTest = useCallback(async () => {
    setSerialBusy(true)
    const sent = await trackingService.sendSerialEvent(SERIAL_TEST_ID, Date.now(), { bypassEmissionGate: true })
    if (sent) {
      setSerialStatus(`Sent test packet ${SERIAL_TEST_ID},<timestamp>.`)
    } else {
      setSerialStatus("Serial writer is not connected.")
    }
    setSerialBusy(false)
  }, [])

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
      trackingService.setSerialEventEmissionEnabled(false)
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

      trackingService.setSerialEventEmissionEnabled(true)
      setPhase("pre-calibration")
    } catch (err: unknown) {
      trackingService.setSerialEventEmissionEnabled(false)
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

          <div className="rounded-lg border border-white/20 bg-white/5 p-4 text-left space-y-3">
            <p className="text-sm font-semibold text-white">Optional: Web Serial Test</p>
            <p className="text-xs text-gray-400">Packet format: id,timestamp followed by a newline.</p>

            {!serialSupported && (
              <p className="text-xs text-yellow-300">
                Web Serial is not supported in this browser. Use a Chromium-based browser over HTTPS or localhost.
              </p>
            )}

            {serialSupported && (
              <>
                <div className="flex flex-col gap-2">
                  {!serialConnected ? (
                    <Button
                      onClick={handleConnectSerial}
                      disabled={serialBusy}
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      {serialBusy ? "Connecting Serial..." : "Connect Serial (9600)"}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleDisconnectSerial}
                      disabled={serialBusy}
                      className="w-full h-11 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold"
                    >
                      Disconnect Serial
                    </Button>
                  )}

                  <Button
                    onClick={handleSendSerialTest}
                    disabled={!serialConnected || serialBusy}
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  >
                    Send Test Packet ({SERIAL_TEST_ID})
                  </Button>
                </div>

                <p className="text-xs text-gray-300">{serialStatus}</p>
              </>
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
