import type { TaskDefinition } from "./types"
import { ReactionConfig } from "@/components/tasks/reaction/ReactionConfig"
import { ReactionRun } from "@/components/tasks/reaction/ReactionRun"

export const tasks: Record<string, TaskDefinition> = {
    "reaction-time": {
        id: "reaction-time",
        title: "Reaction Time Test",
        description: "Measure your reaction time by finding the odd shape in a grid.",
        ConfigComponent: ReactionConfig,
        RunComponent: ReactionRun,
    },
}

export const getTask = (id: string) => tasks[id]
