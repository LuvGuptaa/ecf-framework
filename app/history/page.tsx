"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Home,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  Clock,
  Target,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Trash2,
  Loader2,
} from "lucide-react"
import type { TestSession, ERPSession, Trial, ERPTrialData } from "@/lib/types"

type HistorySession = TestSession | ERPSession

const isERPSession = (session: HistorySession): session is ERPSession => {
  return "taskType" in session
}
import { dataService } from "@/lib/data-service"
import { useToast } from "@/hooks/use-toast"

const shapeIcons = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
}

interface FilterOptions {
  searchTerm: string
  shapeFilter: string
  dateRange: string
  sortBy: string
}

export default function HistoryPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [filteredSessions, setFilteredSessions] = useState<HistorySession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: "",
    shapeFilter: "all",
    dateRange: "all",
    sortBy: "newest",
  })

  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())

  const [deleteSessionTarget, setDeleteSessionTarget] = useState<HistorySession | null>(null)
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadSessions = useCallback(async () => {
    setIsLoading(true)
    try {
      const [classicSessions, erpSessions] = await Promise.all([
        dataService.fetchSessions(),
        dataService.fetchERPSessions(),
      ])
      const allSessions: HistorySession[] = [...classicSessions, ...erpSessions].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )
      setSessions(allSessions)
      setFilteredSessions(allSessions)
    } catch (error) {
      console.error("Error loading sessions:", error)
      toast({
        title: "Error",
        description: "Failed to load session history.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    let filtered = [...sessions]

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(
        (session) =>
          session.participantName.toLowerCase().includes(searchLower) ||
          session.participantId.toLowerCase().includes(searchLower),
      )
    }

    if (filters.shapeFilter !== "all") {
      filtered = filtered.filter((session) => {
        if (isERPSession(session)) {
          return session.taskType === filters.shapeFilter
        }
        return session.shape === filters.shapeFilter
      })
    }

    if (filters.dateRange !== "all") {
      const now = new Date()
      const filterDate = new Date()

      switch (filters.dateRange) {
        case "today":
          filterDate.setHours(0, 0, 0, 0)
          break
        case "week":
          filterDate.setDate(now.getDate() - 7)
          break
        case "month":
          filterDate.setMonth(now.getMonth() - 1)
          break
      }

      if (filters.dateRange !== "all") {
        filtered = filtered.filter((session) => session.createdAt >= filterDate)
      }
    }

    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "newest":
          return b.createdAt.getTime() - a.createdAt.getTime()
        case "oldest":
          return a.createdAt.getTime() - b.createdAt.getTime()
        case "name":
          return a.participantName.localeCompare(b.participantName)
        case "performance": {
          const getAvg = (s: HistorySession): number => {
            const trials = s.trials
            if (!trials || trials.length === 0) return 0
            return trials.reduce((sum: number, t: Trial | ERPTrialData) => sum + ((t as { reactionTime?: number }).reactionTime ?? 0), 0) / trials.length
          }
          return getAvg(a) - getAvg(b)
        }
        default:
          return 0
      }
    })

    setFilteredSessions(filtered)
  }, [sessions, filters])

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const toggleSelection = (sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedSessionIds.size === filteredSessions.length) {
      setSelectedSessionIds(new Set())
    } else {
      setSelectedSessionIds(new Set(filteredSessions.map((s) => s.id)))
    }
  }

  const confirmDeleteSelected = () => {
    if (selectedSessionIds.size === 0) return
    setIsDeletingMultiple(true)
  }

  const executeDeleteSelected = async () => {
    if (selectedSessionIds.size === 0) return

    setIsDeleting(true)
    try {
      const deletionPromises = filteredSessions
        .filter((s) => selectedSessionIds.has(s.id))
        .map(async (session) => {
          if (isERPSession(session)) {
            return dataService.deleteERPSession(session.id)
          } else {
            return dataService.deleteSession(session.id)
          }
        })

      await Promise.all(deletionPromises)
      toast({ title: "Sessions Deleted", description: `Successfully removed ${selectedSessionIds.size} session(s).` })
      setSelectedSessionIds(new Set())
      await loadSessions()
    } catch (error) {
      console.error("Error deleting sessions:", error)
      toast({ title: "Delete Failed", description: "Could not delete some sessions.", variant: "destructive" })
    } finally {
      setIsDeleting(false)
      setIsDeletingMultiple(false)
    }
  }

  const confirmDeleteSession = (session: HistorySession) => {
    setDeleteSessionTarget(session)
  }

  const executeDeleteSession = async () => {
    if (!deleteSessionTarget) return
    const session = deleteSessionTarget

    setIsDeleting(true)
    try {
      if (isERPSession(session)) {
        await dataService.deleteERPSession(session.id)
      } else {
        await dataService.deleteSession(session.id)
      }
      toast({ title: "Session Deleted", description: "The session has been permanently removed." })
      await loadSessions()
    } catch (error) {
      console.error("Error deleting session:", error)
      toast({ title: "Delete Failed", description: "Could not delete the session.", variant: "destructive" })
    } finally {
      setIsDeleting(false)
      setDeleteSessionTarget(null)
    }
  }

  const calculateSessionStats = (session: HistorySession) => {
    const trials = session.trials || []
    if (trials.length === 0) {
      return {
        averageReactionTime: 0,
        totalWrongTaps: 0,
        accuracy: 0,
        completionRate: 0,
      }
    }

    const reactionTimes = trials.map((t: Trial | ERPTrialData) => (t as { reactionTime?: number }).reactionTime ?? 0)
    let totalWrongTaps = 0
    let correctTrials = 0

    if (isERPSession(session)) {
      correctTrials = (trials as ERPTrialData[]).filter((t) => !t.timedOut).length
      totalWrongTaps = trials.length - correctTrials
    } else {
      totalWrongTaps = (trials as Trial[]).reduce((sum, t) => sum + (t.wrongTaps?.length || 0), 0)
      correctTrials = (trials as Trial[]).filter((t) => t.isCorrect).length
    }

    return {
      averageReactionTime: reactionTimes.reduce((sum: number, rt: number) => sum + rt, 0) / reactionTimes.length,
      totalWrongTaps,
      accuracy: (correctTrials / trials.length) * 100,
      completionRate: session.completedAt ? 100 : (trials.length / 10) * 100,
    }
  }

  const exportSessionData = (session: HistorySession) => {
    const stats = calculateSessionStats(session)
    const exportData = {
      session: {
        id: session.id,
        participant: session.participantName,
        taskType: isERPSession(session) ? session.taskType : session.shape,
        gridSize: isERPSession(session)
          ? ("gridSize" in session.taskConfig ? `${session.taskConfig.gridSize}x${session.taskConfig.gridSize}` : "N/A")
          : `${session.gridRows}x${session.gridCols}`,
        createdAt: session.createdAt.toISOString(),
        completedAt: session.completedAt?.toISOString(),
      },
      statistics: stats,
      trials: (session.trials || []).map((trial: Trial | ERPTrialData) => ({
        trialNumber: (trial as Trial).trialNumber,
        reactionTime: trial.reactionTime,
        isCorrect: trial.isCorrect !== undefined ? trial.isCorrect : !(trial as ERPTrialData).timedOut,
        wrongTapCount: (trial as Trial).wrongTaps ? (trial as Trial).wrongTaps.length : ((trial as ERPTrialData).timedOut ? 1 : 0),
        oddShapeIndex: (trial as Trial).oddShapeIndex,
        coordinates: {
          correctTap: (trial as Trial).correctTap,
          wrongTaps: (trial as Trial).wrongTaps,
        },
        deviceInfo: (trial as Trial).deviceInfo,
        performanceMetrics: (trial as Trial).performanceMetrics,
        keypresses: (trial as ERPTrialData).keypresses,
        patches: (trial as ERPTrialData).patches,
      })),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `session-${session.participantName}-${session.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Data Exported",
      description: `Session data for ${session.participantName} has been downloaded.`,
    })
  }

  const exportAllData = () => {
    const allData = {
      exportDate: new Date().toISOString(),
      totalSessions: filteredSessions.length,
      sessions: filteredSessions.map((session) => ({
        ...session,
        statistics: calculateSessionStats(session),
      })),
    }

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `all-sessions-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "All Data Exported",
      description: `${filteredSessions.length} sessions have been downloaded.`,
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Session History</h1>
            <p className="text-muted-foreground">
              {filteredSessions.length} of {sessions.length} sessions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSessions} size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => router.push("/")} className="shrink-0">
              <Home className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search participants..."
                    value={filters.searchTerm}
                    onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Shape</label>
                <Select value={filters.shapeFilter} onValueChange={(value) => handleFilterChange("shapeFilter", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Task Types</SelectItem>
                    <SelectItem value="up">Reactive: Up Arrow</SelectItem>
                    <SelectItem value="down">Reactive: Down Arrow</SelectItem>
                    <SelectItem value="left">Reactive: Left Arrow</SelectItem>
                    <SelectItem value="right">Reactive: Right Arrow</SelectItem>
                    <SelectItem value="top-down">ERP: Top-Down Search</SelectItem>
                    <SelectItem value="visual-oddball">ERP: Visual Oddball</SelectItem>
                    <SelectItem value="bottom-up">ERP: Bottom-Up Search</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange("dateRange", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange("sortBy", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name">Participant Name</SelectItem>
                    <SelectItem value="performance">Best Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 mt-4 items-center">
              <Button onClick={exportAllData} variant="outline" disabled={filteredSessions.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export All ({filteredSessions.length})
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                onClick={toggleSelectAll}
                className="shrink-0"
                disabled={filteredSessions.length === 0}
              >
                {selectedSessionIds.size === filteredSessions.length && filteredSessions.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
              {selectedSessionIds.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={confirmDeleteSelected}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedSessionIds.size})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 bg-muted rounded-full mx-auto flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">No Sessions Found</h3>
                  <p className="text-muted-foreground">
                    {sessions.length === 0
                      ? "No test sessions have been completed yet."
                      : "No sessions match your current filters."}
                  </p>
                </div>
                <Button onClick={() => router.push("/")} variant="outline">
                  Start New Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => {
              const stats = calculateSessionStats(session)
              const trialsLen = session.trials?.length || 0
              let ShapeIcon = Target
              let taskLabel = ""
              let gridLabel = ""

              if (isERPSession(session)) {
                taskLabel = `ERP: ${session.taskType}`
                gridLabel = "gridSize" in session.taskConfig ? `${session.taskConfig.gridSize}x${session.taskConfig.gridSize}` : "N/A"
              } else {
                taskLabel = `Reactive: ${session.shape}`
                gridLabel = `${session.gridRows}x${session.gridCols}`
                ShapeIcon = shapeIcons[session.shape] || Target
              }

              return (
                <Card
                  key={session.id}
                  className={`hover:shadow-md transition-shadow relative overflow-hidden ${selectedSessionIds.has(session.id) ? "border-primary ring-1 ring-primary" : ""
                    }`}
                >
                  <CardHeader className="pb-3 relative z-10">
                    <div className="absolute right-0 top-0 p-4">
                      <Checkbox
                        checked={selectedSessionIds.has(session.id)}
                        onCheckedChange={() => toggleSelection(session.id)}
                        aria-label={`Select session for ${session.participantName}`}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-2 pr-8">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{session.participantName}</span>
                        </CardTitle>
                        <Badge variant={session.completedAt ? "default" : "secondary"} className="shrink-0">
                          {session.completedAt ? "Complete" : "Incomplete"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ShapeIcon className="h-3 w-3" />
                        <span className="capitalize">{taskLabel}</span>
                      </div>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {session.createdAt.toLocaleDateString()} at {session.createdAt.toLocaleTimeString()}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Grid:</span>
                        <span className="ml-1 font-medium">{gridLabel}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Trials:</span>
                        <span className="ml-1 font-medium">{trialsLen}</span>
                      </div>
                    </div>

                    {trialsLen > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Avg Time:
                          </span>
                          <span className="font-medium">{stats.averageReactionTime.toFixed(0)}ms</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Accuracy:
                          </span>
                          <span className="font-medium">{stats.accuracy.toFixed(1)}%</span>
                        </div>

                        {stats.totalWrongTaps > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Wrong Taps:</span>
                            <span className="font-medium text-orange-600">{stats.totalWrongTaps}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => router.push(`/results?sessionId=${session.id}`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportSessionData(session)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => confirmDeleteSession(session)} className="shrink-0" title="Delete Session">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {(deleteSessionTarget || isDeletingMultiple) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-md p-6 m-4 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
            <p className="text-muted-foreground mb-6">
              {deleteSessionTarget
                ? `Are you sure you want to delete the session for ${deleteSessionTarget.participantName}?`
                : `Are you sure you want to delete ${selectedSessionIds.size} selected session(s)?`}{" "}
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteSessionTarget(null)
                  setIsDeletingMultiple(false)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={deleteSessionTarget ? executeDeleteSession : executeDeleteSelected}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
