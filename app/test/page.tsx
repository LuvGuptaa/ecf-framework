"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, RotateCcw, Video } from "lucide-react"
import { dataService } from "@/lib/data-service"
import type { Trial } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { trackingService } from "@/lib/tracking-service"
import { RecordingControls, type RecordingControlsRef } from "@/components/recording-controls"
import { useTestStore } from "@/lib/stores/test-store"

const shapeIcons = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
}

const oppositeShapes = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
} as const

export default function TestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const gridRef = useRef<HTMLDivElement>(null)
  const recordingControlsRef = useRef<RecordingControlsRef>(null)
  const recordingControlsKeyRef = useRef(0) // Force remount on session change
  const pendingTrialsRef = useRef<Array<Omit<Trial, "id" | "createdAt">>>([])

  // Extract URL parameters with sane defaults and bounds
  const participantId = searchParams.get("participantId")
  const participantName = searchParams.get("participantName")
  const shapeParam = (searchParams.get("shape") as keyof typeof shapeIcons) || "up"
  const shape = shapeIcons[shapeParam] ? shapeParam : "up"
  const gridRows = Math.min(Math.max(Number.parseInt(searchParams.get("gridRows") ?? "6"), 1), 20)
  const gridCols = Math.min(Math.max(Number.parseInt(searchParams.get("gridCols") ?? "4"), 1), 20)
  const numberOfTrials = Math.min(Math.max(Number.parseInt(searchParams.get("numberOfTrials") ?? "10"), 1), 100)

  const [isRecording, setIsRecording] = useState(false)
  const [isReadyToStart, setIsReadyToStart] = useState(false)

  // Use individual selectors to avoid unnecessary re-renders
  const sessionId = useTestStore((state) => state.sessionId)
  const currentTrial = useTestStore((state) => state.currentTrial)
  const totalTrials = useTestStore((state) => state.totalTrials)
  const isTestActive = useTestStore((state) => state.isTestActive)
  const stimulusDisplayTime = useTestStore((state) => state.stimulusDisplayTime)
  const oddShapeIndex = useTestStore((state) => state.oddShapeIndex)
  const showResults = useTestStore((state) => state.showResults)
  const lastTrialResult = useTestStore((state) => state.lastTrialResult)

  const generateOddShapeIndex = useCallback(() => {
    return Math.floor(Math.random() * (gridRows * gridCols))
  }, [gridRows, gridCols])

  const startTrial = useCallback(() => {
    const start = performance.now()
    const stimulus = start + 16 // Approximates next frame

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

    store.setConfig({
      shape,
      gridRows,
      gridCols,
      numberOfTrials,
    })

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
          shape,
          gridRows,
          gridCols,
        })

        if (isCancelled) return

        useTestStore.getState().setSessionMeta({ sessionId: id, totalTrials: numberOfTrials })

        initializationStateRef.current = "completed"
        setIsReadyToStart(true)
      } catch (error) {
        console.error("Error initializing session:", error)
        toast({
          title: "Error",
          description: "Failed to initialize test session.",
          variant: "destructive",
        })
        if (!isCancelled) {
          initializationStateRef.current = "failed"
        }
      }
    }

    void initializeSession()

    return () => {
      isCancelled = true
      if (initializationStateRef.current === "running") {
        initializationStateRef.current = "idle"
      }
    }
  }, [
    participantId,
    participantName,
    shape,
    gridRows,
    gridCols,
    numberOfTrials,
    router,
    startTrial,
    toast,
  ])

  // sessionId is still used later

  const handleCellTap = useCallback(
    async (cellIndex: number, event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
      const state = useTestStore.getState()

      if (
        !state.isTestActive ||
        !state.sessionId ||
        state.startTime === null ||
        state.stimulusDisplayTime === null ||
        state.oddShapeIndex === null
      ) {
        return
      }

      const endTime = performance.now()
      const reactionTime = endTime - state.stimulusDisplayTime

      const detailedCoordinate = trackingService.captureDetailedCoordinates(
        event.nativeEvent,
        cellIndex,
        gridRows,
        gridCols,
        cellIndex === state.oddShapeIndex,
      )

      const isCorrect = cellIndex === state.oddShapeIndex

      if (!isCorrect) {
        state.addWrongTap(detailedCoordinate)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
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

      state.completeTrial({
        reactionTime,
        wrongTapCount: wrongTapsSnapshot.length,
        isCorrect: true,
      })
    },
    [gridCols, gridRows],
  )

  const nextTrial = useCallback(async () => {
    if (!sessionId) {
      return
    }

    const isFinalTrial = currentTrial + 1 >= totalTrials

    if (isFinalTrial) {
      try {
        // Stop recording if active
        console.log("[Test] Final trial - checking recording state:", {
          hasRef: !!recordingControlsRef.current,
          isRecording,
          sessionId
        })
        if (recordingControlsRef.current && isRecording) {
          try {
            console.log("[Test] Stopping recording...")
            await recordingControlsRef.current.stopRecording()
            console.log("[Test] Recording stopped successfully")
          } catch (recordingError) {
            console.error("Error stopping recording:", recordingError)
            // Continue even if recording stop fails
          }
        } else {
          console.log("[Test] No recording to stop or ref not available")
        }

        const trialsToPersist = pendingTrialsRef.current
        if (trialsToPersist.length > 0) {
          for (const pendingTrial of trialsToPersist) {
            await dataService.recordTrial(pendingTrial)
          }
          pendingTrialsRef.current = []
        }

        await dataService.completeSession(sessionId, {
          completedAt: new Date(),
        })
      } catch (error) {
        console.error("Error completing session:", error)
        toast({
          title: "Save failed",
          description: "We could not save this session. Please try again.",
          variant: "destructive",
        })
        return
      }

      router.push(`/results?sessionId=${sessionId}`)
      return
    }

    // Hide results first, then advance
    useTestStore.getState().markResultsHidden()
    useTestStore.getState().advanceTrial()

    // Small delay before starting next trial
    window.setTimeout(startTrial, 800)
  }, [currentTrial, isRecording, router, sessionId, startTrial, totalTrials, toast])

  // Auto-advance to next trial after 1 second
  useEffect(() => {
    if (!showResults || currentTrial + 1 >= totalTrials) {
      return
    }

    const timer = setTimeout(() => {
      void nextTrial()
    }, 1000)

    return () => clearTimeout(timer)
  }, [showResults, currentTrial, totalTrials, nextTrial])

  const retryTrial = useCallback(() => {
    if (pendingTrialsRef.current.length > 0) {
      pendingTrialsRef.current = pendingTrialsRef.current.slice(0, -1)
    }
    useTestStore.getState().markResultsHidden()
    window.setTimeout(startTrial, 1000)
  }, [startTrial])

  if (!participantId || !participantName || !shape) {
    return null
  }

  const BaseIcon = shapeIcons[shape]
  const OddIcon = shapeIcons[oppositeShapes[shape]]
  const progress = totalTrials > 0 ? ((currentTrial + (showResults ? 1 : 0)) / totalTrials) * 100 : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div>
            <h2 className="text-lg font-semibold">{participantName}</h2>
            <p className="text-xs text-muted-foreground">
              Trial {Math.min(currentTrial + 1, totalTrials)} of {totalTrials}
              {isRecording && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse"></span>
                  <span>Recording</span>
                </span>
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <Home className="h-4 w-4 mr-2" />
            Exit
          </Button>
        </div>
      </header>

      <div className="border-b">
        <Progress value={progress} className="h-1 rounded-none" />
      </div>

      {/* Recording controls are mounted but hidden to maintain state */}
      <div className={!isTestActive && !showResults && isReadyToStart && currentTrial === 0 ? "" : "hidden"}>
        <div className="container max-w-4xl mx-auto p-4 pt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                <CardTitle>Setup Recording (Optional)</CardTitle>
              </div>
              <CardDescription>Start screen and camera recording to capture the session</CardDescription>
            </CardHeader>
            <CardContent>
              <RecordingControls
                ref={recordingControlsRef}
                sessionId={sessionId}
                onRecordingStateChange={setIsRecording}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <main className="container max-w-4xl mx-auto p-4 py-8">
        <div className="space-y-6">
          {!isTestActive && !showResults && isReadyToStart && currentTrial === 0 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Test Instructions</CardTitle>
                <CardDescription>
                  Tap the arrow that points in a different direction from the others
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center gap-8 p-6 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Most arrows</p>
                    <BaseIcon className="h-12 w-12 text-blue-500 mx-auto" />
                  </div>
                  <div className="text-2xl text-muted-foreground">→</div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Tap this one!</p>
                    <OddIcon className="h-12 w-12 text-orange-500 mx-auto" />
                  </div>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                      1
                    </div>
                    <p>A grid of arrows will appear on the screen</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                      2
                    </div>
                    <p>Find and tap the arrow pointing in a different direction</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                      3
                    </div>
                    <p>Be as quick and accurate as possible - your reaction time is being measured</p>
                  </div>
                </div>

                <Button onClick={startTrial} className="w-full" size="lg">
                  Start Test
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isTestActive && oddShapeIndex !== null && (
          <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
            <div
              ref={gridRef}
              className="grid gap-4 mx-auto"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${gridRows}, 1fr)`,
              }}
            >
              {Array.from({ length: gridRows * gridCols }).map((_, index) => {
                const isOdd = index === oddShapeIndex
                const Icon = isOdd ? OddIcon : BaseIcon
                const buttonClasses = [
                  "aspect-square",
                  "h-20",
                  "w-20",
                  "p-0",
                  "touch-manipulation",
                  isOdd
                    ? "text-orange-500 border-orange-300 bg-orange-50"
                    : "text-blue-500 border-blue-300 bg-blue-50",
                ].join(" ")

                return (
                  <Button
                    key={index}
                    variant="outline"
                    className={buttonClasses}
                    onClick={(e) => handleCellTap(index, e)}
                    onTouchStart={(e) => e.preventDefault()}
                    onTouchEnd={(e) => {
                      e.preventDefault()
                      handleCellTap(index, e)
                    }}
                  >
                    <Icon className="h-10 w-10" />
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {showResults && lastTrialResult && (
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader className="text-center bg-gradient-to-b from-primary/5 to-transparent">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-3xl">✓</span>
                <CardTitle className="text-2xl">Trial Complete!</CardTitle>
              </div>
              <CardDescription className="text-base">Trial {currentTrial + 1} of {totalTrials}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-200">
                  <p className="text-5xl font-bold text-green-600 mb-1">{lastTrialResult.reactionTime.toFixed(0)}</p>
                  <p className="text-sm font-medium text-green-700">milliseconds</p>
                  <p className="text-xs text-muted-foreground mt-2">Reaction Time</p>
                </div>
                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 border-2 border-orange-200">
                  <p className="text-5xl font-bold text-orange-600 mb-1">{lastTrialResult.wrongTapCount}</p>
                  <p className="text-sm font-medium text-orange-700">incorrect</p>
                  <p className="text-xs text-muted-foreground mt-2">Wrong Taps</p>
                </div>
              </div>

              {currentTrial + 1 < totalTrials && (
                <div className="text-center py-4 px-6 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Next trial starting automatically...</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                    <p className="text-xs font-medium">1 second</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={nextTrial} className="flex-1 h-12" size="lg">
                  {currentTrial + 1 >= totalTrials ? "Complete Test" : "Continue Now →"}
                </Button>
                {currentTrial + 1 < totalTrials && (
                  <Button variant="outline" onClick={retryTrial} size="lg" className="h-12">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!isTestActive && !showResults && !isReadyToStart && (
          <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="animate-pulse">
                    <div className="h-3 w-3 bg-primary rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-muted-foreground">Preparing your test session...</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!isTestActive && !showResults && isReadyToStart && currentTrial > 0 && (
          <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="animate-pulse">
                    <div className="h-3 w-3 bg-primary rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-muted-foreground">Preparing next trial...</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
