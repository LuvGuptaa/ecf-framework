import type { ComponentType } from "react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>

export interface TaskDefinition {
    id: string
    title: string
    description: string
    ConfigComponent: ComponentType<AnyProps>
    RunComponent: ComponentType<AnyProps>
}
