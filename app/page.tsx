"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { History, Play } from "lucide-react"
import { dataService } from "@/lib/data-service"
import { useToast } from "@/hooks/use-toast"
import { useTestStore } from "@/lib/stores/test-store"
import { tasks } from "@/lib/tasks/registry"

export default function HomePage() {
  const router = useRouter()
  const { toast } = useToast()

  // Participant form state
  const [participantData, setParticipantData] = useState({
    name: "",
    age: "",
    email: "",
    notes: "",
  })

  const [selectedTaskId, setSelectedTaskId] = useState<string>("reaction-time")
  const [isLoading, setIsLoading] = useState(false)
  const [calibrationSeconds, setCalibrationSeconds] = useState(5)

  const handleParticipantChange = (field: string, value: string) => {
    setParticipantData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleStart = async () => {
    // Validate required fields
    if (!participantData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter the participant's name.",
        variant: "destructive",
      })
      return
    }

    if (!participantData.age || Number.parseInt(participantData.age) < 1) {
      toast({
        title: "Age Required",
        description: "Please enter a valid age.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Save participant to Firebase
      const cleanedParticipant = {
        name: participantData.name.trim(),
        age: Number.parseInt(participantData.age),
        email: participantData.email.trim() || undefined,
        notes: participantData.notes.trim() || undefined,
      }

      const { id: participantId } = await dataService.createParticipant(cleanedParticipant)

      const store = useTestStore.getState()
      store.setParticipant({
        id: participantId,
        ...cleanedParticipant,
      })
      store.setCalibrationDuration(calibrationSeconds * 1000)

      router.push(`/${selectedTaskId}?participantId=${participantId}`)
    } catch (error) {
      console.error("Error starting task:", error)
      toast({
        title: "Error",
        description: "Failed to create participant. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl" role="img" aria-label="Lightning bolt">
                ⚡
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Cognitive Assessment</h1>
              <p className="text-xs text-muted-foreground">Select a task and enter details</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/history")}>
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
        </div>
      </header>

      <div className="container max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card className="border-2 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Participant Information</CardTitle>
            <CardDescription>Enter details to begin the session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter participant name"
                  value={participantData.name}
                  onChange={(e) => handleParticipantChange("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="Enter age"
                  value={participantData.age}
                  onChange={(e) => handleParticipantChange("age", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={participantData.email}
                onChange={(e) => handleParticipantChange("email", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about the participant or test conditions"
                value={participantData.notes}
                onChange={(e) => handleParticipantChange("notes", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Task Selection */}
        <Card className="border-2 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Select Task</CardTitle>
            <CardDescription>Choose an activity to perform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Available Tasks</Label>
              <Select
                value={selectedTaskId}
                onValueChange={setSelectedTaskId}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select a task" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(tasks).map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      <span className="font-medium">{task.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {tasks[selectedTaskId] && (
                <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
                  {tasks[selectedTaskId].description}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="calibration">Calibration Duration (seconds)</Label>
              <p className="text-xs text-muted-foreground">Screen flashes black &amp; white before and after each task for syncing recordings.</p>
              <Input
                id="calibration"
                type="number"
                min="1"
                max="30"
                value={calibrationSeconds}
                onChange={(e) => setCalibrationSeconds(Number(e.target.value) || 5)}
              />
            </div>

            <Button
              onClick={handleStart}
              disabled={isLoading}
              className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⚡</span>
                  Setting up...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Configure Task
                  <Play className="h-4 w-4 fill-current" />
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
