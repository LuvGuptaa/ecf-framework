import type { ComponentType } from "react"

export interface TaskDefinition {
    id: string
    title: string
    description: string
    ConfigComponent: ComponentType<{
        onConfigComplete: (config: Record<string, unknown>) => void
    }>
    RunComponent: ComponentType<{
        config: Record<string, unknown>
        participant: Record<string, unknown>
        onComplete: () => void
    }>
}
