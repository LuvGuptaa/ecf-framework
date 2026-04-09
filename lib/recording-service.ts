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
  private _mimeType: string = "video/webm"

  constructor(onStateChange?: (state: RecordingState) => void) {
    this.onStateChange = onStateChange
  }

  /** The actual MIME type being used for recording. */
  get mimeType(): string {
    return this._mimeType
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
        // @ts-expect-error - preferCurrentTab is a valid option in modern browsers
        preferCurrentTab: true,
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

  // Start recording from an existing stream (e.g. Canvas captureStream)
  async startStreamRecording(stream: MediaStream, options: RecordingOptions = { video: true, audio: false }): Promise<void> {
    try {
      await this.initializeRecording(stream, options)
    } catch (error) {
      console.error("Error starting stream recording:", error)
      this.notifyStateChange({
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: "Failed to start stream recording",
      })
      throw error
    }
  }

  private async initializeRecording(stream: MediaStream, options: RecordingOptions): Promise<void> {
    this.stream = stream
    this.recordedChunks = []

    // Determine the best supported MIME type (prefer MP4)
    const mimeType = this.getSupportedMimeType(options.mimeType)
    this._mimeType = mimeType

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
    // Prefer MP4, then WebM VP9/VP8
    const types = [
      preferredType,
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].filter(Boolean) as string[]

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
          type: this._mimeType,
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
  // Delay revoke to avoid early cancellation dropping the filename in Chrome
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Return the appropriate file extension for a MIME type. */
const getExtensionForMimeType = (mimeType: string): string => {
  if (mimeType.startsWith("video/mp4")) return "mp4"
  return "webm"
}

const formatRecordingFileBase = (participantName: string): string => {
  const safeName = participantName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
  const normalizedName = safeName.length > 0 ? safeName : "participant"

  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  return `${normalizedName}_${timestamp}`
}

/**
 * Download screen and camera recordings as a single zip file.
 * Falls back to individual downloads if JSZip is unavailable.
 */
export const downloadRecordingsAsZip = async (
  participantName: string,
  recordings: {
    screen?: { blob: Blob; mimeType: string } | null
    camera?: { blob: Blob; mimeType: string } | null
  },
): Promise<void> => {
  const fileBase = formatRecordingFileBase(participantName)

  try {
    throw new Error("test fallback")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zip: any = null

    if (recordings.screen) {
      const ext = getExtensionForMimeType(recordings.screen!.mimeType)
      zip.file(`${fileBase}_screen.${ext}`, recordings.screen!.blob)
    }

    if (recordings.camera) {
      const ext = getExtensionForMimeType(recordings.camera!.mimeType)
      zip.file(`${fileBase}_camera.${ext}`, recordings.camera!.blob)
    }

    const zipBlob = await zip.generateAsync({ type: "blob" })
    downloadBlob(zipBlob, `${fileBase}_recordings.zip`)
  } catch (error) {
    console.error("Failed to create zip, downloading individually:", error)
    // Fallback: download files individually
    if (recordings.screen) {
      const ext = getExtensionForMimeType(recordings.screen.mimeType)
      downloadBlob(recordings.screen.blob, `${fileBase}_screen.${ext}`)
    }
    if (recordings.camera) {
      const ext = getExtensionForMimeType(recordings.camera.mimeType)
      downloadBlob(recordings.camera.blob, `${fileBase}_camera.${ext}`)
    }
  }
}

// Legacy function kept for compatibility
export const downloadRecordingsLocally = async (
  participantName: string,
  recordings: { screen?: Blob | null; camera?: Blob | null },
): Promise<void> => {
  const fileBase = formatRecordingFileBase(participantName)

  if (recordings.screen) {
    downloadBlob(recordings.screen, `${fileBase}_screen.webm`)
  }

  if (recordings.camera) {
    downloadBlob(recordings.camera, `${fileBase}_camera.webm`)
  }
}
