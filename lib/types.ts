// Type definitions for the reaction time app
export interface Participant {
  id: string
  name: string
  age: number
  email?: string
  notes?: string
  createdAt: Date
}

export interface TestSession {
  id: string
  participantId: string
  participantName: string
  shape: "up" | "down" | "left" | "right"
  gridRows: number
  gridCols: number
  createdAt: Date
  completedAt?: Date
  trials: Trial[]
  screenRecordingUrl?: string
  cameraRecordingUrl?: string
}

export interface Trial {
  id: string
  sessionId: string
  trialNumber: number
  oddShapeIndex: number
  startTime: number
  endTime: number
  reactionTime: number
  isCorrect: boolean
  wrongTaps: DetailedTapCoordinate[]
  correctTap?: DetailedTapCoordinate
  createdAt: Date
  // Enhanced tracking data
  stimulusDisplayTime?: number
  firstTapTime?: number
  frameRate?: number
  deviceInfo?: any
  performanceMetrics?: any
}

export interface TapCoordinate {
  x: number
  y: number
  timestamp: number
  isCorrect: boolean
  cellIndex?: number
}

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
  // Cartesian coordinates (Bottom-Left origin)
  coordinatesBottomLeft: { x: number; y: number }
  // Element dimensions (Canvas size)
  elementDimensions: { width: number; height: number }
  // Timing information
  timestamp: number
  performanceTimestamp: number
  reactionTime: number
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

export interface TestConfig {
  shape: "up" | "down" | "left" | "right"
  gridRows: number
  gridCols: number
  numberOfTrials: number
}

export interface Recording {
  id: string;
  sessionId: string;
  type: "screen" | "camera";
  blob: Blob;
  createdAt: Date;
}
