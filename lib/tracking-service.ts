// Advanced tracking service for precise coordinate and timing measurement
export interface DetailedTapCoordinate {
  // Screen coordinates
  screenX: number
  screenY: number
  // Client coordinates (relative to viewport)
  clientX: number
  clientY: number
  // Page coordinates (including scroll)
  pageX: number
  pageY: number
  // Element-relative coordinates
  offsetX: number
  offsetY: number
  // Timing information
  timestamp: number
  performanceTimestamp: number
  // Touch/mouse information
  pressure?: number
  pointerType: "mouse" | "touch" | "pen"
  // Grid information
  cellIndex: number
  gridPosition: { row: number; col: number }
  // Correctness
  isCorrect: boolean
  // Device information
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

export class TrackingService {
  private frameRateMonitor: number[] = []
  private lastFrameTime = 0

  // Enhanced coordinate tracking with multiple coordinate systems
  captureDetailedCoordinates(
    event: MouseEvent | TouchEvent,
    cellIndex: number,
    gridRows: number,
    gridCols: number,
    isCorrect: boolean,
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
      pressure = (touch as any).force || 0
      pointerType = "touch"
    } else {
      const mouseEvent = event as MouseEvent
      clientX = mouseEvent.clientX
      clientY = mouseEvent.clientY
      screenX = mouseEvent.screenX
      screenY = mouseEvent.screenY
      pageX = mouseEvent.pageX
      pageY = mouseEvent.pageY
      pressure = (mouseEvent as any).pressure || 0
    }

    // Calculate element-relative coordinates
    const target = event.target as HTMLElement
    const rect = target.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top

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
      timestamp,
      performanceTimestamp,
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
    const memory = (performance as any).memory
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
