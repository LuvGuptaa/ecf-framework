"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getTask } from "@/lib/tasks/registry"
import { useTestStore } from "@/lib/stores/test-store"

export default function TaskRunPage({ params }: { params: { taskId: string } }) {
  const router = useRouter()
  const { taskId } = params
  
  const task = getTask(taskId)
  const participant = useTestStore((state) => state.participant)
  const config = useTestStore((state) => state.config)

  useEffect(() => {
     if (!task) {
         router.push("/")
         return
     }
     
     if (!participant) {
         // Missing participant data, redirect to setup
         router.push(`/${taskId}`)
     }
  }, [task, participant, taskId, router])

  if (!task || !participant) return null

  const handleComplete = () => {
      // Could route to a generic results page or task specific
      // For now, let the component decide or route to a generic one
      // The ReactionRun component routed to /results?sessionId=...
      // but strictly speaking, the page should handle routing on completion if we want to be generic.
      // However, our Task definition has `onComplete` prop in RunComponent.
      // Let's pass a handler.
      const sessionId = useTestStore.getState().sessionId
      router.push(`/results?sessionId=${sessionId}`)
  }

  return (
    <task.RunComponent 
        config={config} 
        participant={participant} 
        onComplete={handleComplete} 
    />
  )
}
