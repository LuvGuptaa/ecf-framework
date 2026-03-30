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
        description: "Find targets (E) and distractors (Ǝ) in a full-screen grid with hash patches. Each slide has exactly 2 targets. Press Space once after finding them.",
        ConfigComponent: TopDownConfigComponent,
        RunComponent: TopDownRun,
    },
    "visual-oddball": {
        id: "visual-oddball",
        title: "Visual Oddball",
        description: "Observe sequential single-letter stimuli at fixation. Press Space once during the sequence when 2 targets are detected.",
        ConfigComponent: OddballConfigComponent,
        RunComponent: OddballRun,
    },
}

export const getTask = (id: string) => tasks[id]
