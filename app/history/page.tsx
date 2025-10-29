"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import type { TestSession } from "@/lib/types"
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

  const [sessions, setSessions] = useState<TestSession[]>([])
  const [filteredSessions, setFilteredSessions] = useState<TestSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: "",
    shapeFilter: "all",
    dateRange: "all",
    sortBy: "newest",
  })

  // Load all sessions (in a real app, you'd implement pagination)
  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const allSessions = await dataService.fetchSessions()
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
  }

  useEffect(() => {
    loadSessions()
  }, [])

  // Apply filters whenever filters or sessions change
  useEffect(() => {
    let filtered = [...sessions]

    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(
        (session) =>
          session.participantName.toLowerCase().includes(searchLower) ||
          session.participantId.toLowerCase().includes(searchLower),
      )
    }

    // Shape filter
    if (filters.shapeFilter !== "all") {
      filtered = filtered.filter((session) => session.shape === filters.shapeFilter)
    }

    // Date range filter
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

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "newest":
          return b.createdAt.getTime() - a.createdAt.getTime()
        case "oldest":
          return a.createdAt.getTime() - b.createdAt.getTime()
        case "name":
          return a.participantName.localeCompare(b.participantName)
        case "performance":
          const avgA = a.trials.length > 0 ? a.trials.reduce((sum, t) => sum + t.reactionTime, 0) / a.trials.length : 0
          const avgB = b.trials.length > 0 ? b.trials.reduce((sum, t) => sum + t.reactionTime, 0) / b.trials.length : 0
          return avgA - avgB
        default:
          return 0
      }
    })

    setFilteredSessions(filtered)
  }, [sessions, filters])

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const calculateSessionStats = (session: TestSession) => {
    if (session.trials.length === 0) {
      return {
        averageReactionTime: 0,
        totalWrongTaps: 0,
        accuracy: 0,
        completionRate: 0,
      }
    }

    const reactionTimes = session.trials.map((t) => t.reactionTime)
    const totalWrongTaps = session.trials.reduce((sum, t) => sum + t.wrongTaps.length, 0)
    const correctTrials = session.trials.filter((t) => t.isCorrect).length

    return {
      averageReactionTime: reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length,
      totalWrongTaps,
      accuracy: (correctTrials / session.trials.length) * 100,
      completionRate: session.completedAt ? 100 : (session.trials.length / 10) * 100, // Assuming 10 trials
    }
  }

  const exportSessionData = (session: TestSession) => {
    const stats = calculateSessionStats(session)
    const exportData = {
      session: {
        id: session.id,
        participant: session.participantName,
        shape: session.shape,
        gridSize: `${session.gridRows}x${session.gridCols}`,
        createdAt: session.createdAt.toISOString(),
        completedAt: session.completedAt?.toISOString(),
      },
      statistics: stats,
      trials: session.trials.map((trial) => ({
        trialNumber: trial.trialNumber,
        reactionTime: trial.reactionTime,
        isCorrect: trial.isCorrect,
        wrongTapCount: trial.wrongTaps.length,
        oddShapeIndex: trial.oddShapeIndex,
        coordinates: {
          correctTap: trial.correctTap,
          wrongTaps: trial.wrongTaps,
        },
        deviceInfo: trial.deviceInfo,
        performanceMetrics: trial.performanceMetrics,
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
        {/* Header */}
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

        {/* Filters */}
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
                    <SelectItem value="all">All Shapes</SelectItem>
                    <SelectItem value="up">Up Arrow</SelectItem>
                    <SelectItem value="down">Down Arrow</SelectItem>
                    <SelectItem value="left">Left Arrow</SelectItem>
                    <SelectItem value="right">Right Arrow</SelectItem>
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

            <div className="flex gap-2 mt-4">
              <Button onClick={exportAllData} variant="outline" disabled={filteredSessions.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export All ({filteredSessions.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sessions Grid */}
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
              const ShapeIcon = shapeIcons[session.shape]

              return (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {session.participantName}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <ShapeIcon className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={session.completedAt ? "default" : "secondary"}>
                          {session.completedAt ? "Complete" : "Incomplete"}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {session.createdAt.toLocaleDateString()} at {session.createdAt.toLocaleTimeString()}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Session Info */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Grid:</span>
                        <span className="ml-1 font-medium">
                          {session.gridRows}×{session.gridCols}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Trials:</span>
                        <span className="ml-1 font-medium">{session.trials.length}</span>
                      </div>
                    </div>

                    {/* Performance Stats */}
                    {session.trials.length > 0 && (
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

                    {/* Actions */}
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
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
