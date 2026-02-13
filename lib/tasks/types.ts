import type { ComponentType } from "react"

export interface TaskDefinition {
    id: string
    title: string
    description: string
    ConfigComponent: ComponentType<{
        onConfigComplete: (config: any) => void
    }>
    RunComponent: ComponentType<{
        config: any
        participant: any
        onComplete: () => void
    }>
}
