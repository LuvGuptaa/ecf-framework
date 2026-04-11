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
        targetProbability: 10,
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

    const handleSubmit = () => {
        onConfigComplete(config)
    }

    return (
        <div className="space-y-6">
            <Card className="border-2">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-xl">Visual Oddball Configuration</CardTitle>
                    <CardDescription>Configure stimulus probability and timing. Target letter is E, shown one at a time at screen center.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Target (E) Probability (%)</Label>
                            <Input
                                type="number"
                                min="1"
                                max="50"
                                value={config.targetProbability}
                                onChange={(e) => handleChange("targetProbability", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Poisson distribution — remaining stimuli are random non-E letters</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Targets to Detect</Label>
                            <p className="text-sm text-muted-foreground pt-2">Fixed at exactly <strong className="text-foreground">2 E</strong> for this protocol.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Max Stimuli per Trial</Label>
                            <Input
                                type="number"
                                min="8"
                                max="50"
                                value={config.stimuliPerTrial}
                                onChange={(e) => handleChange("stimuliPerTrial", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Controls sequence length before the required 2nd E + 5-letter ending window (with no consecutive Es)</p>
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
                            <Label>Stimulus Duration (ms)</Label>
                            <Input
                                type="number"
                                min="50"
                                max="5000"
                                step="50"
                                value={config.stimulusDuration}
                                onChange={(e) => handleChange("stimulusDuration", e.target.value)}
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
                                <p className="text-muted-foreground">Target Prob.</p>
                                <p className="font-medium">{config.targetProbability}%</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Trials</p>
                                <p className="font-medium">{config.numberOfTrials}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Targets to Detect</p>
                                <p className="font-medium">2 (fixed)</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Stimulus</p>
                                <p className="font-medium">{config.stimulusDuration}ms + 100ms blank</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Fixation</p>
                                <p className="font-medium">{config.fixationDuration}ms</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Auto End Rule</p>
                                <p className="font-medium">2nd E + 5 letters</p>
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
