"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react"
import type { TestConfig } from "@/lib/types"

const shapeIcons = {
    up: ArrowUp,
    down: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight,
}

interface ReactionConfigProps {
    onConfigComplete: (config: TestConfig) => void
}

export function ReactionConfig({ onConfigComplete }: ReactionConfigProps) {
    const [testConfig, setTestConfig] = useState<TestConfig>({
        shape: "up",
        gridRows: 6,
        gridCols: 4,
        numberOfTrials: 10,
    })

    // Start with default valid check
    // Actually, validation usually happens before 'Start'

    const handleConfigChange = (field: keyof TestConfig, value: string | number) => {
        setTestConfig((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleSubmit = () => {
        onConfigComplete(testConfig)
    }

    return (
        <div className="space-y-6">
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

                    <Button
                        onClick={handleSubmit}
                        className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                        size="lg"
                    >
                        <span className="flex items-center gap-2">
                            Start Activity
                            <span>→</span>
                        </span>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
