'use client'

import { create } from 'zustand'
import type {
    ERPTaskType,
    ERPKeypress,
    PatchItem,
    PatchType,
    TopDownConfig,
    OddballConfig,
    BottomUpConfig,
} from '@/lib/types'

interface ParticipantState {
    id: string
    name: string
    age: number
    email?: string
    notes?: string
}

export interface ERPStoreState {
    participant: ParticipantState | null
    taskType: ERPTaskType | null
    config: TopDownConfig | OddballConfig | BottomUpConfig | null
    sessionId: string | null
    currentTrial: number
    totalTrials: number
    isActive: boolean
    trialStartTime: number | null
    keypresses: ERPKeypress[]
    patches: PatchItem[]
    stimulusSequence: PatchType[]
    currentStimulusIndex: number
    phase: 'idle' | 'fixation' | 'stimulus' | 'response' | 'between' | 'complete'
}

export interface ERPStoreActions {
    setParticipant: (participant: ParticipantState | null) => void
    setTaskType: (taskType: ERPTaskType) => void
    setConfig: (config: TopDownConfig | OddballConfig | BottomUpConfig) => void
    setSessionMeta: (params: { sessionId: string; totalTrials: number }) => void
    resetSessionState: () => void
    startTrial: (params: { patches: PatchItem[]; startTime: number }) => void
    startOddballTrial: (params: { stimulusSequence: PatchType[]; startTime: number }) => void
    addKeypress: (keypress: ERPKeypress) => void
    advanceStimulusIndex: () => void
    setPhase: (phase: ERPStoreState['phase']) => void
    completeTrial: () => void
    advanceTrial: () => void
}

const initialState: ERPStoreState = {
    participant: null,
    taskType: null,
    config: null,
    sessionId: null,
    currentTrial: 0,
    totalTrials: 0,
    isActive: false,
    trialStartTime: null,
    keypresses: [],
    patches: [],
    stimulusSequence: [],
    currentStimulusIndex: 0,
    phase: 'idle',
}

export type ERPStoreSlice = ERPStoreState & ERPStoreActions

export const useERPStore = create<ERPStoreSlice>((set, get) => ({
    ...initialState,

    setParticipant: (participant) => {
        const current = get().participant
        if (
            current &&
            participant &&
            current.id === participant.id &&
            current.name === participant.name
        ) {
            return
        }
        set({ participant })
    },

    setTaskType: (taskType) => set({ taskType }),

    setConfig: (config) => set({ config, totalTrials: config.numberOfTrials }),

    setSessionMeta: ({ sessionId, totalTrials }) => {
        set({
            sessionId,
            totalTrials,
            currentTrial: 0,
            isActive: false,
            trialStartTime: null,
            keypresses: [],
            patches: [],
            stimulusSequence: [],
            currentStimulusIndex: 0,
            phase: 'idle',
        })
    },

    resetSessionState: () => {
        const { config } = get()
        set({
            sessionId: null,
            currentTrial: 0,
            totalTrials: config?.numberOfTrials ?? 0,
            isActive: false,
            trialStartTime: null,
            keypresses: [],
            patches: [],
            stimulusSequence: [],
            currentStimulusIndex: 0,
            phase: 'idle',
        })
    },

    startTrial: ({ patches, startTime }) => {
        set({
            isActive: true,
            trialStartTime: startTime,
            keypresses: [],
            patches,
            phase: 'stimulus',
        })
    },

    startOddballTrial: ({ stimulusSequence, startTime }) => {
        set({
            isActive: true,
            trialStartTime: startTime,
            keypresses: [],
            stimulusSequence,
            currentStimulusIndex: 0,
            phase: 'fixation',
        })
    },

    addKeypress: (keypress) => {
        set((state) => ({ keypresses: [...state.keypresses, keypress] }))
    },

    advanceStimulusIndex: () => {
        set((state) => ({ currentStimulusIndex: state.currentStimulusIndex + 1 }))
    },

    setPhase: (phase) => set({ phase }),

    completeTrial: () => {
        set({
            isActive: false,
            phase: 'between',
        })
    },

    advanceTrial: () => {
        set((state) => ({
            currentTrial: state.currentTrial + 1,
            isActive: false,
            trialStartTime: null,
            keypresses: [],
            patches: [],
            stimulusSequence: [],
            currentStimulusIndex: 0,
            phase: 'idle',
        }))
    },
}))
