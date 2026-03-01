"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getTask } from "@/lib/tasks/registry"
import { useTestStore } from "@/lib/stores/test-store"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function TaskConfigPage({ params }: { params: { taskId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { taskId } = params
  const participantId = searchParams.get("participantId")

  const task = getTask(taskId)
  const store = useTestStore()

  // If we have a participantId in URL but not in store (e.g. refresh), 
  // we might want to fetch it. For now, we assume the user came from Home 
  // or the store is persisted/rehydrated if we had that logic.
  // Since we rely on the store for the flow: 

  useEffect(() => {
    if (!task) {
      router.push("/")
    }
  }, [task, router])

  if (!task) return null

  const handleComplete = (data?: Record<string, unknown>) => {
    // Save config to store
    store.setConfig(data)

    // Navigate to run
    // We keep participantId in query or just rely on store? 
    // Let's keep it clean and rely on store for "session" context.
    router.push(`/${taskId}/run`)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">{task.title}</h1>
          <p className="text-slate-600 mt-2">{task.description}</p>
        </div>

        <task.ConfigComponent onConfigComplete={handleConfigComplete} />
      </div>
    </div>
  )
}
