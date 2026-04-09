"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Home, Download, Share2, Play, Monitor, Camera } from "lucide-react"
import type { TestSession, ERPSession, Trial, ERPTrialData } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { useToast } from "@/hooks/use-toast"

type HistorySession = TestSession | ERPSession

const isERPSession = (session: HistorySession): session is ERPSession => {
  return "taskType" in session
}

export default function ResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const sessionId = searchParams.get("sessionId")
  const [session, setSession] = useState<HistorySession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [localRecordings, setLocalRecordings] = useState<
    Array<{ type: "screen" | "camera"; url: string; blob: Blob }>
  >([])

  useEffect(() => {
    if (!sessionId) {
      router.push("/")
      return
    }

    const loadSession = async () => {
      try {
        let sessionData: HistorySession | null = await dataService.fetchSession(sessionId)
        if (!sessionData) {
          sessionData = await dataService.fetchERPSession(sessionId)
        }
        setSession(sessionData)
      } catch (error) {
        console.error("Error loading session:", error)
        toast({
          title: "Error",
          description: "Failed to load test results.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()
  }, [sessionId, router, toast])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    let isSubscribed = true
    let generatedUrls: Array<{ type: "screen" | "camera"; url: string; blob: Blob }> = []

    const loadRecordings = async () => {
      try {
        const recordings = await dataService.getLocalRecordings(sessionId)
        if (!isSubscribed) return

        generatedUrls = recordings.map(({ type, blob }) => ({
          type,
          url: URL.createObjectURL(blob),
          blob,
        }))
        setLocalRecordings(generatedUrls)
      } catch (error) {
        console.error("Error loading local recordings:", error)
      }
    }

    void loadRecordings()

    return () => {
      isSubscribed = false
      generatedUrls.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [sessionId])

  const calculateStats = (session: HistorySession | null) => {
    if (!session) return null
    const trials = session.trials || []
    if (!trials.length) return null

    const reactionTimes = trials.map((t: Trial | ERPTrialData) => (t as { reactionTime?: number }).reactionTime ?? 0)
    let totalWrongTaps = 0
    let correctTrials = 0

    if (isERPSession(session)) {
      const erpTrials = trials as ERPTrialData[]
      // Only trials that required a response AND participant pressed space are counted logically in accuracy,
      // but as a simple fallback, we use isCorrect and the presence of reactionTime
      correctTrials = erpTrials.filter((t) => t.isCorrect && (t.reactionTime ?? 0) > 0).length
      totalWrongTaps = erpTrials.length - correctTrials
    } else {
      totalWrongTaps = (trials as Trial[]).reduce((sum, t) => sum + (t.wrongTaps?.length || 0), 0)
      correctTrials = (trials as Trial[]).filter((t) => t.isCorrect).length
    }

    return {
      averageReactionTime: reactionTimes.reduce((sum: number, rt: number) => sum + rt, 0) / reactionTimes.length,
      fastestReactionTime: Math.min(...reactionTimes),
      slowestReactionTime: Math.max(...reactionTimes),
      totalWrongTaps,
      accuracy: (correctTrials / trials.length) * 100,
    }
  }

  const handleExportData = () => {
    if (!session) return

    const data = {
      participant: {
        name: session.participantName,
        id: session.participantId,
      },
      session: {
        id: session.id,
        taskType: isERPSession(session) ? session.taskType : session.shape,
        gridSize: isERPSession(session)
          ? ("gridSize" in session.taskConfig ? `${session.taskConfig.gridSize}x${session.taskConfig.gridSize}` : "N/A")
          : `${session.gridRows}x${session.gridCols}`,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
      },
      trials: session.trials || [],
      summary: calculateStats(session),
      recordings: {
        screen: "screenRecordingUrl" in session ? session.screenRecordingUrl : undefined,
        camera: "cameraRecordingUrl" in session ? session.cameraRecordingUrl : undefined,
      },
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reaction-test-${session.participantName}-${session.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Data Exported",
      description: "Test data has been downloaded as JSON file.",
    })
  }

  const downloadLocalRecording = (blob: Blob, type: string, sessionIdParam: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${type}-recording-${sessionIdParam}-${Date.now()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Recording Downloaded",
      description: `${type} recording has been downloaded.`,
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-2xl font-bold">Session Not Found</h1>
          <p className="text-muted-foreground">The requested test session could not be found.</p>
          <Button onClick={() => router.push("/")}>Return Home</Button>
        </div>
      </div>
    )
  }

  const stats = calculateStats(session)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between px-4">
          <div>
            <h1 className="text-xl font-bold">Test Complete</h1>
            <p className="text-sm text-muted-foreground">{session.participantName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <Home className="h-4 w-4 mr-2" />
            Home
          </Button>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto p-4 py-8 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.averageReactionTime.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground mt-1">ms</div>
                <div className="text-sm font-medium mt-2">Average Time</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.fastestReactionTime.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground mt-1">ms</div>
                <div className="text-sm font-medium mt-2">Fastest Time</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.totalWrongTaps}</div>
                <div className="text-xs text-muted-foreground mt-1">total</div>
                <div className="text-sm font-medium mt-2">Wrong Taps</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.accuracy.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">accuracy</div>
                <div className="text-sm font-medium mt-2">Success Rate</div>
              </CardContent>
            </Card>
          </div>
        )}

        {localRecordings.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                <CardTitle>Session Recordings</CardTitle>
              </div>
              <CardDescription>View and download your locally stored recordings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {localRecordings.map(({ type, url, blob }) => (
                  <div key={type} className="rounded-lg border bg-card overflow-hidden">
                    <div className="aspect-video bg-black">
                      <video src={url} controls className="w-full h-full" preload="metadata" />
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {type === "screen" ? (
                            <Monitor className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Camera className="h-4 w-4 text-green-500" />
                          )}
                          <span className="font-medium text-sm capitalize">{type} Recording</span>
                        </div>
                        <Badge variant="secondary">Local</Badge>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => downloadLocalRecording(blob, type, session.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Trial Details</CardTitle>
            <CardDescription>Individual trial performance and tap timing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(session.trials || []).map((trial: Trial | ERPTrialData) => (
                <div key={(trial as Trial).id ?? (trial as { trialNumber?: number }).trialNumber} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Trial {(trial as Trial).trialNumber}</Badge>
                      <span className="font-medium text-green-600">{((trial as { reactionTime?: number }).reactionTime ?? 0).toFixed(0)}ms</span>
                      {(trial as Trial).frameRate && <span className="text-xs text-muted-foreground">{(trial as Trial).frameRate}fps</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isERPSession(session) ? (
                        <>
                          {(trial as Trial).wrongTaps?.length > 0 && <Badge variant="destructive">{(trial as Trial).wrongTaps.length} wrong</Badge>}
                          <Badge variant={(trial as Trial).wrongTaps?.length === 0 ? "default" : "secondary"}>
                            {(trial as Trial).wrongTaps?.length === 0 ? "Perfect" : "Completed"}
                          </Badge>
                        </>
                      ) : (
                        <Badge variant={((trial as ERPTrialData).reactionTime ?? 0) === 0 ? "destructive" : "default"}>
                          {((trial as ERPTrialData).reactionTime ?? 0) === 0 ? "No Response" : "Responded"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {!isERPSession(session) && (trial as Trial).wrongTaps?.length > 0 && (
                    <div className="p-3 space-y-2 bg-background">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Tap Sequence:</p>
                      {(trial as Trial).wrongTaps.map((tap, tapIndex) => (
                        <div key={tapIndex} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-destructive/5 border border-destructive/20">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
                              Wrong #{tapIndex + 1}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              Cell {tap.cellIndex} (Row {tap.gridPosition.row + 1}, Col {tap.gridPosition.col + 1})
                            </span>
                          </div>
                          <span className="font-medium text-destructive">{tap.reactionTime.toFixed(0)}ms</span>
                        </div>
                      ))}
                      {(trial as Trial).correctTap && (
                        <div className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-green-50 border border-green-200">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs border-green-600/40 text-green-600">
                              Correct
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              Cell {(trial as Trial).correctTap!.cellIndex} (Row {(trial as Trial).correctTap!.gridPosition.row + 1}, Col {(trial as Trial).correctTap!.gridPosition.col + 1})
                            </span>
                          </div>
                          <span className="font-medium text-green-600">{((trial as { reactionTime?: number }).reactionTime ?? 0).toFixed(0)}ms</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => router.push("/")} className="flex-1" size="lg">
            <Home className="h-4 w-4 mr-2" />
            Start New Test
          </Button>
          <Button variant="outline" onClick={handleExportData} size="lg">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" onClick={() => router.push("/history")} size="lg">
            <Share2 className="h-4 w-4 mr-2" />
            View History
          </Button>
        </div>
      </main>
    </div>
  )
}
