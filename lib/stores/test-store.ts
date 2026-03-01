'use client'

import { create } from 'zustand'

import type { DetailedTapCoordinate, TestConfig } from '@/lib/types'

interface ParticipantState {
  id: string
  name: string
  age: number
  email?: string
  notes?: string
}

interface LastTrialResult {
  reactionTime: number
  wrongTapCount: number
  isCorrect: boolean
}

export interface TestStoreState {
  participant: ParticipantState | null
  config: TestConfig
  sessionId: string | null
  currentTrial: number
  totalTrials: number
  isTestActive: boolean
  startTime: number | null
  stimulusDisplayTime: number | null
  oddShapeIndex: number | null
  wrongTaps: DetailedTapCoordinate[]
  showResults: boolean
  lastTrialResult: LastTrialResult | null
  calibrationDuration: number
}

export interface TestStoreActions {
  setParticipant: (participant: ParticipantState | null) => void
  setConfig: (config: TestConfig) => void
  resetSessionState: () => void
  setSessionMeta: (params: { sessionId: string; totalTrials: number }) => void
  startTrial: (params: { oddShapeIndex: number; startTime: number; stimulusDisplayTime: number }) => void
  addWrongTap: (tap: DetailedTapCoordinate) => void
  completeTrial: (result: LastTrialResult) => void
  markResultsHidden: () => void
  advanceTrial: () => void
  setCurrentTrial: (index: number) => void
  setCalibrationDuration: (duration: number) => void
}

const defaultConfig: TestConfig = {
  shape: 'up',
  gridRows: 6,
  gridCols: 4,
  numberOfTrials: 10,
}

const initialState: TestStoreState = {
  participant: null,
  config: defaultConfig,
  sessionId: null,
  currentTrial: 0,
  totalTrials: defaultConfig.numberOfTrials,
  isTestActive: false,
  startTime: null,
  stimulusDisplayTime: null,
  oddShapeIndex: null,
  wrongTaps: [],
  showResults: false,
  lastTrialResult: null,
  calibrationDuration: 5000,
}

export type TestStoreSlice = TestStoreState & TestStoreActions

export const useTestStore = create<TestStoreSlice>((set, get) => ({
  ...initialState,

  setParticipant: (participant) => {
    const current = get().participant
    if (
      current &&
      participant &&
      current.id === participant.id &&
      current.name === participant.name &&
      current.age === participant.age &&
      current.email === participant.email &&
      current.notes === participant.notes
    ) {
      return
    }
    set({ participant })
  },

  setConfig: (config) => {
    const current = get().config
    if (
      current.shape === config.shape &&
      current.gridRows === config.gridRows &&
      current.gridCols === config.gridCols &&
      current.numberOfTrials === config.numberOfTrials
    ) {
      return
    }
    set({
      config,
      totalTrials: config.numberOfTrials,
    })
  },

  resetSessionState: () => {
    const { config } = get()
    set({
      sessionId: null,
      currentTrial: 0,
      totalTrials: config.numberOfTrials,
      isTestActive: false,
      startTime: null,
      stimulusDisplayTime: null,
      oddShapeIndex: null,
      wrongTaps: [],
      showResults: false,
      lastTrialResult: null,
    })
  },

  setSessionMeta: ({ sessionId, totalTrials }) => {
    set({
      sessionId,
      totalTrials,
      currentTrial: 0,
      showResults: false,
      isTestActive: false,
      startTime: null,
      stimulusDisplayTime: null,
      oddShapeIndex: null,
      wrongTaps: [],
      lastTrialResult: null,
    })
  },

  startTrial: ({ oddShapeIndex, startTime, stimulusDisplayTime }) => {
    set({
      isTestActive: true,
      startTime,
      stimulusDisplayTime,
      oddShapeIndex,
      wrongTaps: [],
      showResults: false,
      lastTrialResult: null,
    })
  },

  addWrongTap: (tap) => {
    set((state) => ({ wrongTaps: [...state.wrongTaps, tap] }))
  },

  completeTrial: (result) => {
    set({
      isTestActive: false,
      showResults: true,
      lastTrialResult: result,
      startTime: null,
      stimulusDisplayTime: null,
    })
  },

  markResultsHidden: () => {
    set({ showResults: false })
  },

  advanceTrial: () => {
    set((state) => ({
      currentTrial: Math.min(state.currentTrial + 1, state.totalTrials - 1),
      showResults: false,
      wrongTaps: [],
      lastTrialResult: null,
      startTime: null,
      stimulusDisplayTime: null,
      oddShapeIndex: null,
    }))
  },

  setCurrentTrial: (index: number) => {
    set({
      currentTrial: index,
      showResults: false,
      wrongTaps: [],
      lastTrialResult: null,
      startTime: null,
      stimulusDisplayTime: null,
      oddShapeIndex: null,
    })
  },

  setCalibrationDuration: (duration: number) => {
    set({ calibrationDuration: duration })
  },
}))

export type TestStore = typeof useTestStore
