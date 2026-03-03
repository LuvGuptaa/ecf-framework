import type { ComponentType } from "react"

export interface TaskDefinition {
    id: string
    title: string
    description: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ConfigComponent: ComponentType<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunComponent: ComponentType<any>
}
