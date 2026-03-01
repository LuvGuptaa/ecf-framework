import dynamic from "next/dynamic"
import type { TaskDefinition } from "./types"
import { ReactionConfig } from "@/components/tasks/reaction/ReactionConfig"
import { TopDownConfigComponent } from "@/components/tasks/top-down/TopDownConfig"
import { OddballConfigComponent } from "@/components/tasks/oddball/OddballConfig"

const ReactionRun = dynamic(
    () => import("@/components/tasks/reaction/ReactionRun").then(mod => mod.ReactionRun),
    { ssr: false }
)
const TopDownRun = dynamic(
    () => import("@/components/tasks/top-down/TopDownRun").then(mod => mod.TopDownRun),
    { ssr: false }
)
const OddballRun = dynamic(
    () => import("@/components/tasks/oddball/OddballRun").then(mod => mod.OddballRun),
    { ssr: false }
)

export const tasks: Record<string, TaskDefinition> = {
    "reaction-time": {
        id: "reaction-time",
        title: "Reaction Time Test",
        description: "Measure your reaction time by finding the odd shape in a grid.",
        ConfigComponent: ReactionConfig,
        RunComponent: ReactionRun,
    },
    "top-down-search": {
        id: "top-down-search",
        title: "Top Down Search",
        description: "Find targets (E) and distractors (Ǝ) in a full-screen grid. Some trials include red-letter bottom-up targets. Press Space once after finding the second target.",
        ConfigComponent: TopDownConfigComponent,
        RunComponent: TopDownRun,
    },
    "visual-oddball": {
        id: "visual-oddball",
        title: "Visual Oddball",
        description: "Observe sequential stimuli at a fixation cross. Targets and distractors appear one by one. Press Space twice after all stimuli are shown.",
        ConfigComponent: OddballConfigComponent,
        RunComponent: OddballRun,
    },
}

export const getTask = (id: string) => tasks[id]
