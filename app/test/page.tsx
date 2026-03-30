"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { dataService } from "@/lib/data-service"
import type { Trial } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { trackingService } from "@/lib/tracking-service"
import { useTestStore } from "@/lib/stores/test-store"
import { RecordingService, downloadRecordingsLocally } from "@/lib/recording-service"
import { CanvasRenderer } from "@/components/canvas-renderer"
import { Camera, Monitor } from "lucide-react"

const shapeIcons = {
  up: true,
  down: true,
  left: true,
  right: true,
}

export default function TestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const recordingServiceRef = useRef<RecordingService | null>(null)
  const cameraRecordingServiceRef = useRef<RecordingService | null>(null)
  const pendingTrialsRef = useRef<Array<Omit<Trial, "id" | "createdAt">>>([])

  const participantId = searchParams.get("participantId")
  const participantName = searchParams.get("participantName")
  const shapeParam = (searchParams.get("shape") as keyof typeof shapeIcons) || "up"
  const shape = shapeIcons[shapeParam as keyof typeof shapeIcons] ? shapeParam : "up"
  const gridRows = Math.min(Math.max(Number.parseInt(searchParams.get("gridRows") ?? "6"), 1), 20)
  const gridCols = Math.min(Math.max(Number.parseInt(searchParams.get("gridCols") ?? "4"), 1), 20)
  const numberOfTrials = Math.min(Math.max(Number.parseInt(searchParams.get("numberOfTrials") ?? "10"), 1), 100)

  const [isRecording, setIsRecording] = useState(false)
  const [isCameraRecording, setIsCameraRecording] = useState(false)
  const [isReadyToStart, setIsReadyToStart] = useState(false)

  const sessionId = useTestStore((state) => state.sessionId)
  const currentTrial = useTestStore((state) => state.currentTrial)
  const totalTrials = useTestStore((state) => state.totalTrials)
  const isTestActive = useTestStore((state) => state.isTestActive)
  const oddShapeIndex = useTestStore((state) => state.oddShapeIndex)
  const showResults = useTestStore((state) => state.showResults)
  const lastTrialResult = useTestStore((state) => state.lastTrialResult)

  const generateOddShapeIndex = useCallback(() => {
    return Math.floor(Math.random() * (gridRows * gridCols))
  }, [gridRows, gridCols])

  const startTrial = useCallback(() => {
    const start = performance.now()
    const stimulus = start

    trackingService.startFrameRateMonitoring()

    useTestStore.getState().startTrial({
      oddShapeIndex: generateOddShapeIndex(),
      startTime: start,
      stimulusDisplayTime: stimulus,
    })
  }, [generateOddShapeIndex])

  const initializationStateRef = useRef<"idle" | "running" | "completed" | "failed">("idle")

  useEffect(() => {
    if (initializationStateRef.current === "completed" || initializationStateRef.current === "running") {
      return
    }

    if (!participantId || !participantName) {
      router.push("/")
      return
    }

    initializationStateRef.current = "running"

    const store = useTestStore.getState()
    store.setConfig({ shape: shape as "up" | "down" | "left" | "right", gridRows, gridCols, numberOfTrials })
    store.setParticipant({
      id: participantId,
      name: participantName,
      age: store.participant?.age ?? 0,
      email: store.participant?.email,
      notes: store.participant?.notes,
    })
    store.resetSessionState()

    let isCancelled = false

    const initializeSession = async () => {
      try {
        const { id } = await dataService.createSession({
          participantId,
          participantName,
          shape: shape as "up" | "down" | "left" | "right",
          gridRows,
          gridCols,
        })

        if (isCancelled) return

        useTestStore.getState().setSessionMeta({ sessionId: id, totalTrials: numberOfTrials })
        initializationStateRef.current = "completed"
        setIsReadyToStart(true)
      } catch (error) {
        console.error("Error initializing session:", error)
        toast({ title: "Error", description: "Failed to initialize test session.", variant: "destructive" })
        if (!isCancelled) initializationStateRef.current = "failed"
      }
    }

    void initializeSession()

    return () => {
      isCancelled = true
      if (initializationStateRef.current === "running") initializationStateRef.current = "idle"
    }
  }, [participantId, participantName, shape, gridRows, gridCols, numberOfTrials, router, toast])

  const handleCanvasReady = useCallback(async (canvas: HTMLCanvasElement) => {
    if (recordingServiceRef.current) return

    try {
      const stream = canvas.captureStream(30)
      const recorder = new RecordingService((state) => {
        setIsRecording(state.isRecording)
      })
      recordingServiceRef.current = recorder
      await recorder.startStreamRecording(stream)
    } catch (e) {
      console.error("Failed to start canvas recording", e)
      toast({
        title: "Recording Failed",
        description: "Could not start automatic screen recording.",
        variant: "destructive"
      })
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      })
      const camRecorder = new RecordingService((state) => {
        setIsCameraRecording(state.isRecording)
      })
      cameraRecordingServiceRef.current = camRecorder
      await camRecorder.startStreamRecording(cameraStream)
    } catch (e) {
      console.warn("Camera access denied or failed", e)
      toast({
        title: "Camera Unavailable",
        description: "Camera recording could not be started. Check permissions.",
        variant: "default"
      })
    }
  }, [toast])

  const finishSession = useCallback(async () => {
    if (!sessionId) return

    try {
      const [screenBlob, cameraBlob] = await Promise.all([
        recordingServiceRef.current?.stopRecording() ?? Promise.resolve(null),
        cameraRecordingServiceRef.current?.stopRecording() ?? Promise.resolve(null),
      ])

      await downloadRecordingsLocally(participantName || "participant", {
        screen: screenBlob,
        camera: cameraBlob,
      })

      const trialsToPersist = pendingTrialsRef.current
      if (trialsToPersist.length > 0) {
        for (const pendingTrial of trialsToPersist) {
          await dataService.recordTrial(pendingTrial)
        }
        pendingTrialsRef.current = []
      }
      await dataService.completeSession(sessionId, { completedAt: new Date() })
    } catch (error) {
      console.error("Error completing session:", error)
      toast({ title: "Save failed", description: "Could not save session.", variant: "destructive" })
      return
    }
    router.push(`/results?sessionId=${sessionId}`)
  }, [sessionId, router, toast])

  const handleCellTap = useCallback(async (cellIndex: number, event: React.MouseEvent | React.TouchEvent) => {
    const state = useTestStore.getState()
    if (!state.isTestActive || !state.sessionId || state.startTime === null || state.stimulusDisplayTime === null || state.oddShapeIndex === null) {
      return
    }

    const endTime = performance.now()
    const reactionTime = endTime - state.stimulusDisplayTime
    const isCorrect = cellIndex === state.oddShapeIndex

    const detailedCoordinate = trackingService.captureDetailedCoordinates(
      event.nativeEvent as MouseEvent | TouchEvent,
      cellIndex,
      gridRows,
      gridCols,
      isCorrect,
      reactionTime,
    )

    if (!isCorrect) {
      state.addWrongTap(detailedCoordinate)
      if (navigator.vibrate) navigator.vibrate(50)
      return
    }

    trackingService.stopFrameRateMonitoring()
    const wrongTapsSnapshot = [...state.wrongTaps]
    const deviceInfo = trackingService.getDeviceInfo()
    const performanceMetrics = trackingService.getPerformanceMetrics()

    const trialData: Omit<Trial, "id" | "createdAt"> = {
      sessionId: state.sessionId,
      trialNumber: state.currentTrial + 1,
      oddShapeIndex: state.oddShapeIndex,
      startTime: state.startTime,
      endTime,
      reactionTime,
      isCorrect: true,
      wrongTaps: wrongTapsSnapshot,
      correctTap: detailedCoordinate,
      stimulusDisplayTime: state.stimulusDisplayTime,
      firstTapTime: wrongTapsSnapshot.length > 0 ? wrongTapsSnapshot[0].performanceTimestamp : endTime,
      frameRate: trackingService.getCurrentFrameRate(),
      deviceInfo,
      performanceMetrics,
    }

    pendingTrialsRef.current = [...pendingTrialsRef.current, trialData]
    state.completeTrial({ reactionTime, wrongTapCount: wrongTapsSnapshot.length, isCorrect: true })

    const isFinalTrial = state.currentTrial + 1 >= state.totalTrials

    if (isFinalTrial) {
      void finishSession()
    } else {
      state.markResultsHidden()
      state.advanceTrial()
      startTrial()
    }
  }, [gridCols, gridRows, finishSession, startTrial])

  const getPhase = () => {
    if (!isReadyToStart) return "idle"
    if (!isTestActive && !showResults && currentTrial === 0) return "idle"
    if (isTestActive) return "test"
    if (showResults) return "results"
    return "idle"
  }

  if (!participantId || !participantName || !shape) return null

  return (
    <div className="test-page w-full h-screen bg-background overflow-hidden relative">
      <CanvasRenderer
        phase={getPhase()}
        participantName={participantName}
        trialInfo={{ current: currentTrial, total: totalTrials }}
        gridConfig={{ rows: gridRows, cols: gridCols, shape: shape as string, oddShapeIndex }}
        lastResult={lastTrialResult}
        onStart={startTrial}
        onCellClick={handleCellTap}
        onNextTrial={finishSession}
        onCanvasReady={handleCanvasReady}
      />

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
        {isRecording && (
          <div className="flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-full shadow-sm border animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
            <Monitor className="h-3 w-3 text-slate-600" />
            <span className="text-xs font-medium text-slate-600">REC</span>
          </div>
        )}
        {isCameraRecording && (
          <div className="flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-full shadow-sm border animate-in fade-in slide-in-from-top-2 duration-300 delay-100">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <Camera className="h-3 w-3 text-slate-600" />
            <span className="text-xs font-medium text-slate-600">CAM</span>
          </div>
        )}
      </div>
    </div>
  )
}
