"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getTask } from "@/lib/tasks/registry"
import { useTestStore } from "@/lib/stores/test-store"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function TaskConfigPage({ params }: { params: { taskId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { taskId } = params

  const task = getTask(taskId)
  const store = useTestStore()

  useEffect(() => {
    if (!task) {
      router.push("/")
    }
  }, [task, router])

  if (!task) return null

  const handleComplete = (data?: Record<string, unknown>) => {
    store.setConfig(data)
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
        <task.ConfigComponent onConfigComplete={handleComplete} />
      </div>
    </div>
  )
}
