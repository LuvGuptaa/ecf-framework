"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { TopDownConfig } from "@/lib/types"

interface TopDownConfigProps {
    onConfigComplete: (config: TopDownConfig) => void
}

export function TopDownConfigComponent({ onConfigComplete }: TopDownConfigProps) {
    const [config, setConfig] = useState<TopDownConfig>({
        targetProbability: 10,
        distractorProbability: 10,
        gridSize: 20,
        numberOfTrials: 150,
        maxTrialTime: 4000,
        slideDuration: 500,
        fillPercentage: 25,
        patchSizeCm: 0.7,
        targetsPerSlide: 2,
        fixationDuration: 1000,
        interTrialInterval: 1250,
        stimulusDuration: 4000,
    })

    const handleChange = (field: keyof TopDownConfig, value: string) => {
        setConfig((prev) => ({
            ...prev,
            [field]: Number(value),
        }))
    }

    const handleSubmit = () => {
        onConfigComplete({
            ...config,
            targetsPerSlide: 2,
        })
    }

    return (
        <div className="space-y-6">
            <Card className="border-2">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-xl">Top Down Conjunction Search Configuration</CardTitle>
                    <CardDescription>Configure grid, fill, and timing for top-down search with hash-surrounded patches</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Grid & Display */}
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Grid &amp; Display</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Grid Size (N×N)</Label>
                                <Input
                                    type="number"
                                    min="5"
                                    max="40"
                                    value={config.gridSize}
                                    onChange={(e) => handleChange("gridSize", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Fill Percentage (%)</Label>
                                <Input
                                    type="number"
                                    min="5"
                                    max="100"
                                    value={config.fillPercentage}
                                    onChange={(e) => handleChange("fillPercentage", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Patch Size (cm)</Label>
                                <Input
                                    type="number"
                                    min="0.3"
                                    max="3"
                                    step="0.1"
                                    value={config.patchSizeCm}
                                    onChange={(e) => handleChange("patchSizeCm", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Targets */}
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Targets</h4>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label>Targets per Slide</Label>
                                <Input
                                    type="number"
                                    value={2}
                                    disabled
                                />
                                <p className="text-xs text-muted-foreground">Fixed at exactly 2 E targets per slide (rest are Ǝ distractors)</p>
                            </div>
                        </div>
                    </div>

                    {/* Timing */}
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Timing</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Number of Trials</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="200"
                                    value={config.numberOfTrials}
                                    onChange={(e) => handleChange("numberOfTrials", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Trial Time (ms)</Label>
                                <Input
                                    type="number"
                                    min="1000"
                                    max="60000"
                                    step="1000"
                                    value={config.maxTrialTime}
                                    onChange={(e) => handleChange("maxTrialTime", e.target.value)}
                                />
                            </div>
                            {/* <div className="space-y-2">
                                <Label>Fixation Duration (ms)</Label>
                                <Input
                                    type="number"
                                    min="100"
                                    max="5000"
                                    step="100"
                                    value={config.fixationDuration}
                                    onChange={(e) => handleChange("fixationDuration", e.target.value)}
                                />
                            </div> */}
                        </div>
                        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                            <div className="space-y-2">
                                <Label>Stimulus Duration (ms)</Label>
                                <Input
                                    type="number"
                                    min="100"
                                    max="10000"
                                    step="100"
                                    value={config.stimulusDuration}
                                    onChange={(e) => handleChange("stimulusDuration", e.target.value)}
                                />
                            </div>
                        </div> */}
                    </div>

                    {/* Summary */}
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <span className="text-primary">●</span>
                            Configuration Summary
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                                <p className="text-muted-foreground">Grid</p>
                                <p className="font-medium">{config.gridSize} × {config.gridSize}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Fill</p>
                                <p className="font-medium">{config.fillPercentage}%</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Patch Size</p>
                                <p className="font-medium">{config.patchSizeCm} cm</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Trials</p>
                                <p className="font-medium">{config.numberOfTrials}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Targets/Slide</p>
                                <p className="font-medium">2</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Fixation</p>
                                <p className="font-medium">{config.fixationDuration}ms</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">ITI</p>
                                <p className="font-medium">{config.interTrialInterval}ms</p>
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
