// Recording service for screen and camera capture
export interface RecordingOptions {
  video: boolean
  audio: boolean
  videoBitsPerSecond?: number
  audioBitsPerSecond?: number
  mimeType?: string
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  error?: string
}

export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private stream: MediaStream | null = null
  private startTime = 0
  private pausedTime = 0
  private onStateChange?: (state: RecordingState) => void

  constructor(onStateChange?: (state: RecordingState) => void) {
    this.onStateChange = onStateChange
  }

  // Start screen recording
  async startScreenRecording(options: RecordingOptions = { video: true, audio: false }): Promise<void> {
    try {
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: options.audio,
      })

      await this.initializeRecording(stream, options)
    } catch (error) {
      console.error("Error starting screen recording:", error)
      this.notifyStateChange({
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: "Failed to start screen recording",
      })
      throw error
    }
  }

  // Start camera recording
  async startCameraRecording(options: RecordingOptions = { video: true, audio: false }): Promise<void> {
    try {
      // Request camera access (front-facing camera preferred)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // Front camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: options.audio,
      })

      await this.initializeRecording(stream, options)
    } catch (error) {
      console.error("Error starting camera recording:", error)
      this.notifyStateChange({
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: "Failed to start camera recording",
      })
      throw error
    }
  }

  // Start combined recording (screen + camera)
  async startCombinedRecording(options: RecordingOptions = { video: true, audio: false }): Promise<void> {
    try {
      // Get both screen and camera streams
      const [screenStream, cameraStream] = await Promise.all([
        navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: options.audio,
        }),
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false, // Avoid audio feedback
        }),
      ])

      // Combine streams (this is a simplified approach - in production you might want to use canvas composition)
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...cameraStream.getVideoTracks(),
        ...(options.audio ? screenStream.getAudioTracks() : []),
      ])

      await this.initializeRecording(combinedStream, options)
    } catch (error) {
      console.error("Error starting combined recording:", error)
      this.notifyStateChange({
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: "Failed to start combined recording",
      })
      throw error
    }
  }

  private async initializeRecording(stream: MediaStream, options: RecordingOptions): Promise<void> {
    this.stream = stream
    this.recordedChunks = []

    // Determine the best supported MIME type
    const mimeType = this.getSupportedMimeType(options.mimeType)

    const mediaRecorderOptions: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: options.videoBitsPerSecond || 2500000, // 2.5 Mbps
      audioBitsPerSecond: options.audioBitsPerSecond || 128000, // 128 kbps
    }

    this.mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstart = () => {
      this.startTime = Date.now()
      this.notifyStateChange({ isRecording: true, isPaused: false, duration: 0 })
    }

    this.mediaRecorder.onpause = () => {
      this.pausedTime = Date.now()
      this.notifyStateChange({ isRecording: true, isPaused: true, duration: this.getDuration() })
    }

    this.mediaRecorder.onresume = () => {
      this.startTime += Date.now() - this.pausedTime
      this.notifyStateChange({ isRecording: true, isPaused: false, duration: this.getDuration() })
    }

    this.mediaRecorder.onstop = () => {
      this.notifyStateChange({ isRecording: false, isPaused: false, duration: this.getDuration() })
    }

    this.mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event)
      this.notifyStateChange({
        isRecording: false,
        isPaused: false,
        duration: this.getDuration(),
        error: "Recording error occurred",
      })
    }

    // Handle stream ending (e.g., user stops screen share)
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        this.stopRecording()
      }
    })

    this.mediaRecorder.start(1000) // Collect data every second
  }

  private getSupportedMimeType(preferredType?: string): string {
    const types = [preferredType, "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].filter(
      Boolean,
    ) as string[]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return "video/webm" // Fallback
  }

  // Pause recording
  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause()
    }
  }

  // Resume recording
  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume()
    }
  }

  // Stop recording and return the recorded blob
  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null)
        return
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder?.mimeType || "video/webm",
        })

        // Clean up
        this.cleanup()

        resolve(blob)
      }

      if (this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop()
      } else {
        resolve(null)
      }
    })
  }

  // Get current recording duration
  private getDuration(): number {
    if (!this.startTime) return 0
    return Date.now() - this.startTime
  }

  // Clean up resources
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    this.mediaRecorder = null
    this.recordedChunks = []
    this.startTime = 0
    this.pausedTime = 0
  }

  // Get current state
  getState(): RecordingState {
    return {
      isRecording: this.mediaRecorder?.state === "recording" || this.mediaRecorder?.state === "paused",
      isPaused: this.mediaRecorder?.state === "paused",
      duration: this.getDuration(),
    }
  }

  // Check if recording is supported
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && window.MediaRecorder)
  }

  // Check camera availability
  static async isCameraAvailable(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some((device) => device.kind === "videoinput")
    } catch {
      return false
    }
  }

  private notifyStateChange(state: RecordingState): void {
    if (this.onStateChange) {
      this.onStateChange(state)
    }
  }
}

// Utility function to download blob as file
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Utility function to create video preview
export const createVideoPreview = (blob: Blob): string => {
  return URL.createObjectURL(blob)
}
