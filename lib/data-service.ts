import {
  saveParticipant,
  saveTestSession,
  saveTrial,
  updateTestSession,
  getTestSession,
  getAllSessions,
  saveERPSession,
  saveERPTrial,
  updateERPSession,
  getERPSession,
  getAllERPSessions,
  deleteTestSession,
  deleteERPSession,
} from "./firebase-service"
import type {
  Participant,
  TestSession,
  Trial,
  Recording,
  ERPSession,
  ERPTrialData,
} from "./types"
import { localDB } from "./local-db"

type ParticipantInput = Omit<Participant, "id" | "createdAt">
type SessionInput = Pick<
  TestSession,
  | "participantId"
  | "participantName"
  | "shape"
  | "gridRows"
  | "gridCols"
  | "screenRecordingUrl"
  | "cameraRecordingUrl"
> & {
  completedAt?: Date
}
type TrialInput = Omit<Trial, "id" | "createdAt">

const logError = (message: string, error: unknown): Error => {
  console.error(`[DataService] Error: ${message}`, { error })
  return new Error(`${message}: ${error instanceof Error ? error.message : "An unknown error occurred"}`)
}

export const dataService = {
  async createParticipant(input: ParticipantInput): Promise<{ id: string }> {
    try {
      const id = await saveParticipant(input)
      return { id }
    } catch (error) {
      throw logError("Could not create participant", error)
    }
  },

  async createSession(input: SessionInput): Promise<{ id: string }> {
    try {
      const sessionData: Omit<TestSession, "id" | "createdAt"> = {
        ...input,
        trials: [],
        completedAt: input.completedAt,
        screenRecordingUrl: input.screenRecordingUrl,
        cameraRecordingUrl: input.cameraRecordingUrl,
      }
      const id = await saveTestSession(sessionData)
      return { id }
    } catch (error) {
      throw logError("Could not create session", error)
    }
  },

  async recordTrial(input: TrialInput): Promise<{ id: string }> {
    try {
      const trialData: Omit<Trial, "id" | "createdAt"> = { ...input }
      const id = await saveTrial(trialData)
      return { id }
    } catch (error) {
      throw logError("Could not record trial", error)
    }
  },

  async completeSession(sessionId: string, updates: Partial<TestSession> = {}) {
    try {
      await updateTestSession(sessionId, updates)
    } catch (error) {
      throw logError(`Could not complete session ${sessionId}`, error)
    }
  },

  async fetchSession(sessionId: string): Promise<TestSession | null> {
    try {
      const session = await getTestSession(sessionId)
      return session
    } catch (error) {
      throw logError(`Could not fetch session ${sessionId}`, error)
    }
  },

  async fetchSessions(options: { pageSize?: number } = {}): Promise<TestSession[]> {
    try {
      const { sessions } = await getAllSessions(options.pageSize ?? 50)
      return sessions
    } catch (error) {
      throw logError("Could not fetch sessions", error)
    }
  },

  async saveRecordingLocally(recording: Recording): Promise<void> {
    try {
      await localDB.saveRecording(recording)
    } catch (error) {
      throw logError("Could not save recording locally", error)
    }
  },

  async getLocalRecordings(sessionId: string): Promise<Recording[]> {
    try {
      return await localDB.getRecordingsBySession(sessionId)
    } catch (error) {
      throw logError(`Could not get local recordings for session ${sessionId}`, error)
    }
  },

  async createERPSession(input: Omit<ERPSession, "id" | "createdAt">): Promise<{ id: string }> {
    try {
      const id = await saveERPSession(input)
      return { id }
    } catch (error) {
      throw logError("Could not create ERP session", error)
    }
  },

  async recordERPTrial(input: ERPTrialData): Promise<{ id: string }> {
    try {
      const id = await saveERPTrial(input)
      return { id }
    } catch (error) {
      throw logError("Could not record ERP trial", error)
    }
  },

  async completeERPSession(sessionId: string, updates: Partial<ERPSession> = {}) {
    try {
      await updateERPSession(sessionId, updates)
    } catch (error) {
      throw logError(`Could not complete ERP session ${sessionId}`, error)
    }
  },

  async fetchERPSession(sessionId: string): Promise<ERPSession | null> {
    try {
      const session = await getERPSession(sessionId)
      return session
    } catch (error) {
      throw logError(`Could not fetch ERP session ${sessionId}`, error)
    }
  },

  async fetchERPSessions(): Promise<ERPSession[]> {
    try {
      const sessions = await getAllERPSessions()
      return sessions
    } catch (error) {
      throw logError("Could not fetch ERP sessions", error)
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await deleteTestSession(sessionId)
    } catch (error) {
      throw logError(`Could not delete test session ${sessionId}`, error)
    }
  },

  async deleteERPSession(sessionId: string): Promise<void> {
    try {
      await deleteERPSession(sessionId)
    } catch (error) {
      throw logError(`Could not delete ERP session ${sessionId}`, error)
    }
  },
}
