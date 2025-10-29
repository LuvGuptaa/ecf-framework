"use client"

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Video, Camera, Monitor, Play, Pause, Square, Download, AlertCircle } from "lucide-react"
import { RecordingService, type RecordingState, downloadBlob } from "@/lib/recording-service"
import { localDB } from "@/lib/local-db"
import { useToast } from "@/hooks/use-toast"
import type { Recording } from "@/lib/types"

interface RecordingControlsProps {
  sessionId: string | null
  onRecordingStateChange?: (isRecording: boolean) => void
}

export interface RecordingControlsRef {
  stopRecording: () => Promise<void>
}

export const RecordingControls = forwardRef<RecordingControlsRef, RecordingControlsProps>(
  function RecordingControls({ sessionId, onRecordingStateChange }, ref) {
  const { toast } = useToast()
  const [screenRecorder, setScreenRecorder] = useState<RecordingService | null>(null)
  const [cameraRecorder, setCameraRecorder] = useState<RecordingService | null>(null)
  const [screenState, setScreenState] = useState<RecordingState>({ isRecording: false, isPaused: false, duration: 0 })
  const [cameraState, setCameraState] = useState<RecordingState>({ isRecording: false, isPaused: false, duration: 0 })
  const [isSupported, setIsSupported] = useState(false)
  const [cameraAvailable, setCameraAvailable] = useState(false)
  const [settings, setSettings] = useState({
    enableScreen: true,
    enableCamera: true,
    enableAudio: false,
  })
  const [recordings, setRecordings] = useState<{
    screen?: Blob
    camera?: Blob
  }>({})

  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Check if recording is supported
    setIsSupported(RecordingService.isSupported())

    // Check camera availability
    RecordingService.isCameraAvailable().then(setCameraAvailable)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Notify parent component of recording state changes
    const isRecording = screenState.isRecording || cameraState.isRecording
    onRecordingStateChange?.(isRecording)
  }, [screenState.isRecording, cameraState.isRecording, onRecordingStateChange])

  // Expose stopRecording method to parent component
  useImperativeHandle(ref, () => ({
    stopRecording: async () => {
      await stopRecording()
    },
  }))

  const startRecording = async () => {
    try {
      console.log("[Recording] Starting recording with sessionId:", sessionId)
      const promises: Promise<void>[] = []

      if (settings.enableScreen) {
        const recorder = new RecordingService(setScreenState)
        setScreenRecorder(recorder)
        promises.push(
          recorder.startScreenRecording({
            video: true,
            audio: settings.enableAudio,
          }),
        )
      }

      if (settings.enableCamera && cameraAvailable) {
        const recorder = new RecordingService(setCameraState)
        setCameraRecorder(recorder)
        promises.push(
          recorder.startCameraRecording({
            video: true,
            audio: false, // Avoid audio feedback
          }),
        )
      }

      await Promise.all(promises)

      // Start duration update interval
      intervalRef.current = setInterval(() => {
        if (screenRecorder) {
          setScreenState(screenRecorder.getState())
        }
        if (cameraRecorder) {
          setCameraState(cameraRecorder.getState())
        }
      }, 1000)

      toast({
        title: "Recording Started",
        description: "Screen and camera recording has begun.",
      })
    } catch (error) {
      console.error("Error starting recording:", error)
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = async () => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      const promises: Promise<Blob | null>[] = []
      if (screenRecorder) promises.push(screenRecorder.stopRecording())
      if (cameraRecorder) promises.push(cameraRecorder.stopRecording())

      const [screenBlob, cameraBlob] = await Promise.all(promises)

      if (sessionId) {
        if (screenBlob) {
          await localDB.saveRecording({
            id: `${sessionId}-screen`,
            sessionId,
            type: "screen",
            blob: screenBlob,
            createdAt: new Date(),
          })
        }
        if (cameraBlob) {
          await localDB.saveRecording({
            id: `${sessionId}-camera`,
            sessionId,
            type: "camera",
            blob: cameraBlob,
            createdAt: new Date(),
          })
        }
      }

      setScreenRecorder(null)
      setCameraRecorder(null)

      toast({
        title: "Recording Stopped",
        description: "Your recordings have been saved locally.",
      })
    } catch (error) {
      console.error("Error stopping recording:", error)
      toast({
        title: "Recording Error",
        description: "Failed to stop or save the recording.",
        variant: "destructive",
      })
    }
  }

  const pauseRecording = () => {
    screenRecorder?.pauseRecording()
    cameraRecorder?.pauseRecording()
  }

  const resumeRecording = () => {
    screenRecorder?.resumeRecording()
    cameraRecorder?.resumeRecording()
  }

  const downloadRecording = (type: "screen" | "camera") => {
    const blob = recordings[type]
    if (blob) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      downloadBlob(blob, `${type}-recording-${timestamp}.webm`)
    }
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  if (!isSupported) {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Recording Not Supported</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your browser doesn't support screen or camera recording. You can still complete the test.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isRecording = screenState.isRecording || cameraState.isRecording
  const isPaused = screenState.isPaused || cameraState.isPaused

  return (
    <div className="space-y-4">
        {/* Recording Settings */}
        {!isRecording && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <Label htmlFor="screen-recording" className="flex items-center gap-2 cursor-pointer">
                <Monitor className="h-4 w-4 text-blue-500" />
                <span>Screen Recording</span>
              </Label>
              <Switch
                id="screen-recording"
                checked={settings.enableScreen}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableScreen: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <Label htmlFor="camera-recording" className="flex items-center gap-2 cursor-pointer">
                <Camera className="h-4 w-4 text-green-500" />
                <span>Camera Recording</span>
                {!cameraAvailable && <span className="text-xs text-muted-foreground">(Not available)</span>}
              </Label>
              <Switch
                id="camera-recording"
                checked={settings.enableCamera}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableCamera: checked }))}
                disabled={!cameraAvailable}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <Label htmlFor="audio-recording" className="flex items-center gap-2 cursor-pointer">
                <Video className="h-4 w-4 text-purple-500" />
                <span>Include Audio</span>
              </Label>
              <Switch
                id="audio-recording"
                checked={settings.enableAudio}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableAudio: checked }))}
              />
            </div>
          </div>
        )}

        {/* Recording Status */}
        {isRecording && (
          <div className="p-4 rounded-lg border bg-card space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
              Recording Active
            </div>

            {screenState.isRecording && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-blue-500" />
                  <span>Screen</span>
                </div>
                <span className="font-mono text-muted-foreground">{formatDuration(screenState.duration)}</span>
              </div>
            )}

            {cameraState.isRecording && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-green-500" />
                  <span>Camera</span>
                </div>
                <span className="font-mono text-muted-foreground">{formatDuration(cameraState.duration)}</span>
              </div>
            )}
          </div>
        )}

        {/* Control Buttons */}
        {!isRecording && Object.keys(recordings).length === 0 ? (
          <Button
            onClick={startRecording}
            className="w-full"
            size="lg"
            disabled={!settings.enableScreen && !settings.enableCamera}
          >
            <Video className="h-4 w-4 mr-2" />
            Start Recording
          </Button>
        ) : isRecording ? (
          <Button onClick={stopRecording} variant="destructive" className="w-full" size="lg">
            <Square className="h-4 w-4 mr-2" />
            Stop Recording
          </Button>
        ) : null}

        {/* Recording Previews */}
        {Object.keys(recordings).length > 0 && !isRecording && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Recording Preview</h3>
            {recordings.screen && (
              <div className="space-y-2">
                <Label>Screen Recording</Label>
                <video src={URL.createObjectURL(recordings.screen)} controls className="w-full rounded-lg" />
                <Button onClick={() => downloadRecording("screen")} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download Screen Recording
                </Button>
              </div>
            )}
            {recordings.camera && (
              <div className="space-y-2">
                <Label>Camera Recording</Label>
                <video src={URL.createObjectURL(recordings.camera)} controls className="w-full rounded-lg" />
                <Button onClick={() => downloadRecording("camera")} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download Camera Recording
                </Button>
              </div>
            )}
          </div>
        )}
    </div>
  );
});
