"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { OddballConfig } from "@/lib/types"

interface OddballConfigProps {
    onConfigComplete: (config: OddballConfig) => void
}

export function OddballConfigComponent({ onConfigComplete }: OddballConfigProps) {
    const [config, setConfig] = useState<OddballConfig>({
        targetProbability: 15,
        distractorProbability: 15,
        numberOfTrials: 300,
        stimuliPerTrial: 18,
        maxTrialTime: 10000,
        fixationDuration: 500,
        stimulusDuration: 200,
        interTrialInterval: 1000,
        targetsToDetect: 2,
    })

    const handleChange = (field: keyof OddballConfig, value: string) => {
        setConfig((prev) => ({
            ...prev,
            [field]: Number(value),
        }))
    }

    const normalProbability = 100 - config.targetProbability - config.distractorProbability

    const handleSubmit = () => {
        if (config.targetProbability + config.distractorProbability > 100) return
        onConfigComplete(config)
    }

    return (
        <div className="space-y-6">
            <Card className="border-2">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-xl">Visual Oddball Configuration</CardTitle>
                    <CardDescription>Configure stimulus probabilities and timing. Target letter is E, shown one at a time at screen center.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Target (E) Probability (%)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={config.targetProbability}
                                onChange={(e) => handleChange("targetProbability", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Distractor Probability (%)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={config.distractorProbability}
                                onChange={(e) => handleChange("distractorProbability", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Normal Probability (%)</Label>
                            <Input type="number" value={normalProbability} disabled />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Stimuli per Trial</Label>
                            <Input
                                type="number"
                                min="1"
                                max="50"
                                value={config.stimuliPerTrial}
                                onChange={(e) => handleChange("stimuliPerTrial", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Number of Trials</Label>
                            <Input
                                type="number"
                                min="1"
                                max="500"
                                value={config.numberOfTrials}
                                onChange={(e) => handleChange("numberOfTrials", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Targets to Detect</Label>
                            <Input
                                type="number"
                                min="1"
                                max="10"
                                value={config.targetsToDetect}
                                onChange={(e) => handleChange("targetsToDetect", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fixation Cross Duration (ms)</Label>
                            <Input
                                type="number"
                                min="100"
                                max="5000"
                                step="100"
                                value={config.fixationDuration}
                                onChange={(e) => handleChange("fixationDuration", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Stimulus Display Duration (ms)</Label>
                            <Input
                                type="number"
                                min="100"
                                max="5000"
                                step="100"
                                value={config.stimulusDuration}
                                onChange={(e) => handleChange("stimulusDuration", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <span className="text-primary">●</span>
                            Configuration Summary
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                                <p className="text-muted-foreground">Stimuli/Trial</p>
                                <p className="font-medium">{config.stimuliPerTrial}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Trials</p>
                                <p className="font-medium">{config.numberOfTrials}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Targets to Detect</p>
                                <p className="font-medium">{config.targetsToDetect}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Fixation</p>
                                <p className="font-medium">{config.fixationDuration}ms</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Targets</p>
                                <p className="font-medium">{config.targetProbability}%</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Max Time</p>
                                <p className="font-medium">{(config.maxTrialTime / 1000).toFixed(1)}s</p>
                            </div>
                        </div>
                    </div>

                    {config.targetProbability + config.distractorProbability > 100 && (
                        <p className="text-destructive text-sm">Target + Distractor probability cannot exceed 100%</p>
                    )}

                    <Button
                        onClick={handleSubmit}
                        disabled={config.targetProbability + config.distractorProbability > 100}
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
