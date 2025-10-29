"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, History } from "lucide-react"
import { dataService } from "@/lib/data-service"
import { useToast } from "@/hooks/use-toast"
import type { TestConfig } from "@/lib/types"
import { useTestStore } from "@/lib/stores/test-store"

const shapeIcons = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
}

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

  // Test configuration state
  const [testConfig, setTestConfig] = useState<TestConfig>({
    shape: "up" as const,
    gridRows: 6,
    gridCols: 4,
    numberOfTrials: 10,
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleParticipantChange = (field: string, value: string) => {
    setParticipantData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleConfigChange = (field: keyof TestConfig, value: any) => {
    setTestConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleStartTest = async () => {
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

      store.setConfig(testConfig)
      store.resetSessionState()

      // Navigate to test screen with participant ID and config
      const searchParams = new URLSearchParams({
        participantId,
        participantName: participantData.name.trim(),
        shape: testConfig.shape,
        gridRows: testConfig.gridRows.toString(),
        gridCols: testConfig.gridCols.toString(),
        numberOfTrials: testConfig.numberOfTrials.toString(),
      })

      router.push(`/test?${searchParams.toString()}`)
    } catch (error) {
      console.error("Error starting test:", error)
      toast({
        title: "Error",
        description: "Failed to start the test. Please try again.",
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
              {/* Using a simple emoji as a logo */}
              <span className="text-2xl" role="img" aria-label="Lightning bolt">
                ⚡
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Reaction Time Test</h1>
              <p className="text-xs text-muted-foreground">Visual reaction measurement</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/history")}>
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
        </div>
      </header>

      <div className="container max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card className="border-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Participant Information</CardTitle>
            <CardDescription>Enter details to begin the test</CardDescription>
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

        {/* Test Configuration */}
        <Card className="border-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Test Configuration</CardTitle>
            <CardDescription>Customize test parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Base Shape</Label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(shapeIcons).map(([shape, Icon]) => (
                  <Button
                    key={shape}
                    variant={testConfig.shape === shape ? "default" : "outline"}
                    className="h-16 flex flex-col gap-1"
                    onClick={() => handleConfigChange("shape", shape)}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs capitalize">{shape}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rows">Grid Rows</Label>
                <Select
                  value={testConfig.gridRows.toString()}
                  onValueChange={(value) => handleConfigChange("gridRows", Number.parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 3).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} rows
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cols">Grid Columns</Label>
                <Select
                  value={testConfig.gridCols.toString()}
                  onValueChange={(value) => handleConfigChange("gridCols", Number.parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 8 }, (_, i) => i + 3).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} columns
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trials">Number of Trials</Label>
                <Select
                  value={testConfig.numberOfTrials.toString()}
                  onValueChange={(value) => handleConfigChange("numberOfTrials", Number.parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 5, 10, 15, 20, 25, 30].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'trial' : 'trials'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-primary">●</span>
                Test Summary
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Grid Size</p>
                  <p className="font-medium">{testConfig.gridRows} × {testConfig.gridCols}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Cells</p>
                  <p className="font-medium">{testConfig.gridRows * testConfig.gridCols}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Base Shape</p>
                  <p className="font-medium capitalize">{testConfig.shape} arrow</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trials</p>
                  <p className="font-medium">{testConfig.numberOfTrials}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Start Test Button */}
        <Button
          onClick={handleStartTest}
          disabled={isLoading}
          className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⚡</span>
              Starting Test...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Begin Test
              <span>→</span>
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
