// Advanced tracking service for precise coordinate and timing measurement

export interface DetailedTapCoordinate {
  screenX: number
  screenY: number
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  offsetX: number
  offsetY: number
  coordinatesBottomLeft: { x: number; y: number }
  elementDimensions: { width: number; height: number }
  timestamp: number
  performanceTimestamp: number
  reactionTime: number
  pressure: number
  pointerType: "mouse" | "touch" | "pen"
  cellIndex: number
  gridPosition: { row: number; col: number }
  isCorrect: boolean
  devicePixelRatio: number
  viewportSize: { width: number; height: number }
}

export interface TimingMeasurement {
  trialStartTime: number
  stimulusDisplayTime: number
  firstTapTime?: number
  correctTapTime?: number
  reactionTime?: number
  totalTrialTime: number
  frameRate?: number
}

interface MinimalSerialPort {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  writable: WritableStream<Uint8Array> | null
}

interface NavigatorWithSerial extends Navigator {
  serial?: {
    requestPort(): Promise<MinimalSerialPort>
  }
}

export class TrackingService {
  private frameRateMonitor: number[] = []
  private lastFrameTime = 0
  private serialPort: MinimalSerialPort | null = null
  private serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null

  // Enhanced coordinate tracking with multiple coordinate systems
  captureDetailedCoordinates(
    event: MouseEvent | TouchEvent,
    cellIndex: number,
    gridRows: number,
    gridCols: number,
    isCorrect: boolean,
    reactionTime: number,
  ): DetailedTapCoordinate {
    const timestamp = Date.now()
    const performanceTimestamp = performance.now()

    // Handle both mouse and touch events
    let clientX: number, clientY: number, screenX: number, screenY: number, pageX: number, pageY: number
    let pressure = 0
    let pointerType: "mouse" | "touch" | "pen" = "mouse"

    if (event.type.startsWith("touch")) {
      const touchEvent = event as TouchEvent
      const touch = touchEvent.touches[0] || touchEvent.changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
      screenX = touch.screenX
      screenY = touch.screenY
      pageX = touch.pageX
      pageY = touch.pageY
      pressure = (touch as Touch & { force?: number }).force || 0
      pointerType = "touch"
    } else {
      const mouseEvent = event as MouseEvent
      clientX = mouseEvent.clientX
      clientY = mouseEvent.clientY
      screenX = mouseEvent.screenX
      screenY = mouseEvent.screenY
      pageX = mouseEvent.pageX
      pageY = mouseEvent.pageY
      pressure = (mouseEvent as MouseEvent & { pressure?: number }).pressure || 0
    }

    // Calculate element-relative coordinates
    const target = event.target as HTMLElement
    const rect = target.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top

    // Calculate bottom-left coordinates
    const bottomLeftX = offsetX
    const bottomLeftY = rect.height - offsetY

    // Calculate grid position
    const row = Math.floor(cellIndex / gridCols)
    const col = cellIndex % gridCols

    return {
      screenX,
      screenY,
      clientX,
      clientY,
      pageX,
      pageY,
      offsetX,
      offsetY,
      coordinatesBottomLeft: { x: bottomLeftX, y: bottomLeftY },
      elementDimensions: { width: rect.width, height: rect.height },
      timestamp,
      performanceTimestamp,
      reactionTime,
      pressure,
      pointerType,
      cellIndex,
      gridPosition: { row, col },
      isCorrect,
      devicePixelRatio: window.devicePixelRatio,
      viewportSize: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    }
  }

  // High-precision timing measurement
  createTimingMeasurement(startTime: number): TimingMeasurement {
    const now = performance.now()
    return {
      trialStartTime: startTime,
      stimulusDisplayTime: now,
      totalTrialTime: now - startTime,
      frameRate: this.getCurrentFrameRate(),
    }
  }

  updateTimingWithTap(timing: TimingMeasurement, tapTime: number, isCorrect: boolean): TimingMeasurement {
    const updated = { ...timing }

    if (!updated.firstTapTime) {
      updated.firstTapTime = tapTime
    }

    if (isCorrect && !updated.correctTapTime) {
      updated.correctTapTime = tapTime
      updated.reactionTime = tapTime - timing.stimulusDisplayTime
    }

    updated.totalTrialTime = tapTime - timing.trialStartTime

    return updated
  }

  // Frame rate monitoring for performance analysis
  startFrameRateMonitoring(): void {
    this.frameRateMonitor = []
    this.lastFrameTime = performance.now()
    this.monitorFrame()
  }

  private monitorFrame = (): void => {
    const currentTime = performance.now()
    const deltaTime = currentTime - this.lastFrameTime

    if (deltaTime > 0) {
      const fps = 1000 / deltaTime
      this.frameRateMonitor.push(fps)

      // Keep only last 60 frames
      if (this.frameRateMonitor.length > 60) {
        this.frameRateMonitor.shift()
      }
    }

    this.lastFrameTime = currentTime
    requestAnimationFrame(this.monitorFrame)
  }

  getCurrentFrameRate(): number {
    if (this.frameRateMonitor.length === 0) return 60 // Default assumption

    const sum = this.frameRateMonitor.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.frameRateMonitor.length)
  }

  stopFrameRateMonitoring(): void {
    this.frameRateMonitor = []
  }

  isWebSerialSupported(): boolean {
    if (typeof navigator === "undefined") return false
    return "serial" in navigator
  }

  isSerialConnected(): boolean {
    return this.serialWriter !== null
  }

  async connectSerial(baudRate = 9600): Promise<void> {
    if (!this.isWebSerialSupported()) {
      throw new Error("Web Serial API is not supported in this browser.")
    }

    if (this.serialWriter || this.serialPort) {
      await this.disconnectSerial()
    }

    const serialNavigator = navigator as NavigatorWithSerial
    if (!serialNavigator.serial) {
      throw new Error("Web Serial API is unavailable.")
    }

    const port = await serialNavigator.serial.requestPort()
    await port.open({ baudRate })

    if (!port.writable) {
      await port.close()
      throw new Error("Selected serial port is not writable.")
    }

    this.serialPort = port
    this.serialWriter = port.writable.getWriter()
  }

  async sendSerialEvent(id: number | string, timestamp: number = Date.now()): Promise<boolean> {
    if (!this.serialWriter) {
      return false
    }

    try {
      const encoder = new TextEncoder()
      const message = `${id},${timestamp}\n`
      await this.serialWriter.write(encoder.encode(message))
      console.log("[Serial] Sent:", message.trim())
      return true
    } catch (error) {
      console.error("[Serial] Failed to send:", error)
      return false
    }
  }

  async disconnectSerial(): Promise<void> {
    if (this.serialWriter) {
      try {
        this.serialWriter.releaseLock()
      } catch {
        // Ignore lock-release errors while cleaning up the writer.
      }
      this.serialWriter = null
    }

    if (this.serialPort) {
      try {
        await this.serialPort.close()
      } catch {
        // Ignore port-close errors when disconnecting.
      }
      this.serialPort = null
    }
  }

  // Device and environment information
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      devicePixelRatio: window.devicePixelRatio,
      screenResolution: {
        width: screen.width,
        height: screen.height,
      },
      viewportSize: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
    }
  }

  // Performance metrics
  getPerformanceMetrics() {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: this.getFirstPaint(),
      firstContentfulPaint: this.getFirstContentfulPaint(),
      memoryUsage: this.getMemoryUsage(),
    }
  }

  private getFirstPaint(): number {
    const paintEntries = performance.getEntriesByType("paint")
    const firstPaint = paintEntries.find((entry) => entry.name === "first-paint")
    return firstPaint ? firstPaint.startTime : 0
  }

  private getFirstContentfulPaint(): number {
    const paintEntries = performance.getEntriesByType("paint")
    const firstContentfulPaint = paintEntries.find((entry) => entry.name === "first-contentful-paint")
    return firstContentfulPaint ? firstContentfulPaint.startTime : 0
  }

  private getMemoryUsage() {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory
    if (memory) {
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      }
    }
    return null
  }
}

// Singleton instance
export const trackingService = new TrackingService()
