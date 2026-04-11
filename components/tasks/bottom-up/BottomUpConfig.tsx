"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { BottomUpConfig } from "@/lib/types"

interface BottomUpConfigProps {
    onConfigComplete: (config: BottomUpConfig) => void
}

const COLOR_OPTIONS = [
    { label: "Red", value: "#ff0000" },
    { label: "Green", value: "#00cc00" },
    { label: "Blue", value: "#3399ff" },
    { label: "Yellow", value: "#ffcc00" },
    { label: "Orange", value: "#ff6600" },
    { label: "Magenta", value: "#ff00ff" },
    { label: "Cyan", value: "#00cccc" },
]

export function BottomUpConfigComponent({ onConfigComplete }: BottomUpConfigProps) {
    const [config, setConfig] = useState<BottomUpConfig>({
        targetColor: "#ff0000",
        gridSize: 6,
        numberOfTrials: 150,
        maxTrialTime: 1000,
        fixationDuration: 500,
        interTrialInterval: 900,
        stimulusDuration: 1000,
    })

    const handleChange = (field: keyof BottomUpConfig, value: string) => {
        setConfig((prev) => ({
            ...prev,
            [field]: field === "targetColor" ? value : Number(value),
        }))
    }

    const handleSubmit = () => {
        onConfigComplete(config)
    }

    return (
        <div className="space-y-6">
            <Card className="border-2">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-xl">Bottom Up Search Configuration</CardTitle>
                    <CardDescription>Find the differently colored target letter among white distractors. One target per slide.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Target Color */}
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Target Appearance</h4>
                        <div className="space-y-3">
                            <Label>Target Color</Label>
                            <div className="flex flex-wrap gap-3">
                                {COLOR_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleChange("targetColor", opt.value)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${config.targetColor === opt.value
                                            ? "border-white bg-white/10 shadow-lg"
                                            : "border-transparent bg-muted/50 hover:bg-muted"
                                            }`}
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full border border-white/20"
                                            style={{ backgroundColor: opt.value }}
                                        />
                                        <span className="text-sm font-medium">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <Label className="text-xs text-muted-foreground">Custom:</Label>
                                <Input
                                    type="color"
                                    value={config.targetColor}
                                    onChange={(e) => handleChange("targetColor", e.target.value)}
                                    className="w-12 h-8 p-0 border-0 cursor-pointer"
                                />
                                <span className="text-xs text-muted-foreground font-mono">{config.targetColor}</span>
                            </div>
                        </div>
                    </div>

                    {/* Grid */}
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Grid</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Grid Size (N×N)</Label>
                                <Input
                                    type="number"
                                    min="3"
                                    max="10"
                                    value={config.gridSize}
                                    onChange={(e) => handleChange("gridSize", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Number of Trials</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="300"
                                    value={config.numberOfTrials}
                                    onChange={(e) => handleChange("numberOfTrials", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Timing */}
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Timing</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Max Trial Time (ms)</Label>
                                <Input
                                    type="number"
                                    min="500"
                                    max="60000"
                                    step="500"
                                    value={config.maxTrialTime}
                                    onChange={(e) => handleChange("maxTrialTime", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Fixation Duration (ms)</Label>
                                <Input
                                    type="number"
                                    min="100"
                                    max="5000"
                                    step="100"
                                    value={config.fixationDuration}
                                    onChange={(e) => handleChange("fixationDuration", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="space-y-2">
                                <Label>Inter-Trial Interval (ms)</Label>
                                <Input
                                    type="number"
                                    min="100"
                                    max="5000"
                                    step="100"
                                    value={config.interTrialInterval}
                                    onChange={(e) => handleChange("interTrialInterval", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <span className="text-primary">●</span>
                            Configuration Summary
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                                <p className="text-muted-foreground">Grid</p>
                                <p className="font-medium">{config.gridSize} × {config.gridSize}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Trials</p>
                                <p className="font-medium">{config.numberOfTrials}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Target Color</p>
                                <p className="font-medium flex items-center gap-1">
                                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: config.targetColor }} />
                                    {COLOR_OPTIONS.find(c => c.value === config.targetColor)?.label || config.targetColor}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Fixation</p>
                                <p className="font-medium">{config.fixationDuration}ms</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Targets/Slide</p>
                                <p className="font-medium">1</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Max Time</p>
                                <p className="font-medium">{(config.maxTrialTime / 1000).toFixed(1)}s</p>
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
