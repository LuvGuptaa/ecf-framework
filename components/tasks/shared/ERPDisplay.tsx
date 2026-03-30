"use client"

import type { PatchItem, PatchType } from "@/lib/types"

interface ERPDisplayProps {
    patches: PatchItem[]
    gridSize: number
    boldTargets?: boolean
    fullScreen?: boolean
    patchSizeCm?: number
    showHashes?: boolean
}

const PATCH_CHARS: Record<string, string> = {
    target: "E",
    distractor: "Ǝ",
    normal: "#",
}

export function ERPDisplay({
    patches,
    gridSize,
    boldTargets = false,
    fullScreen = false,
    showHashes = true,
}: ERPDisplayProps) {
    const cellSizeCss = fullScreen
        ? "1fr"
        : `${Math.min(Math.floor(70 / gridSize) * 10, 80)}px`

    const viewportMin = typeof window !== "undefined" ? Math.min(window.innerWidth, window.innerHeight) : 800
    const patchSizePx = fullScreen
        ? Math.max(Math.floor(viewportMin / gridSize), 12)
        : Math.min(Math.floor(70 / gridSize) * 10, 80)

    const fontSize = fullScreen
        ? Math.max(Math.round(patchSizePx * (showHashes ? 0.22 : 0.58)), 8)
        : Math.max(Math.floor(patchSizePx * 0.28), 10)

    const grid: (PatchItem | null)[][] = Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => null)
    )

    for (const patch of patches) {
        if (patch.row < gridSize && patch.col < gridSize) {
            grid[patch.row][patch.col] = patch
        }
    }

    const gap = fullScreen ? "0px" : "2px"

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridSize}, ${cellSizeCss})`,
                gridTemplateRows: `repeat(${gridSize}, ${cellSizeCss})`,
                gap,
                background: "#000",
                padding: "0",
                borderRadius: fullScreen ? "0" : "4px",
                ...(fullScreen
                    ? {
                        width: "100vw",
                        height: "100vh",
                        margin: "0 auto",
                    }
                    : {
                        display: "inline-grid",
                        padding: "8px",
                    }),
            }}
        >
            {grid.flat().map((patch, i) => {
                if (!patch) {
                    return (
                        <div
                            key={i}
                            style={{
                                width: fullScreen ? "100%" : patchSizePx,
                                height: fullScreen ? "100%" : patchSizePx,
                                background: "#000",
                            }}
                        />
                    )
                }

                const isBottomUp = patch.type === "bottomUpTarget"
                const centerChar = isBottomUp
                    ? (patch.letter ?? "X")
                    : (PATCH_CHARS[patch.type] ?? "#")
                const textColor = patch.color ?? (isBottomUp ? "#ff0000" : "#fff")

                const isBold = boldTargets && patch.type === "target"
                const weight = isBold ? 900 : 700

                if (!showHashes) {
                    return (
                        <div
                            key={i}
                            style={{
                                width: fullScreen ? "100%" : patchSizePx,
                                height: fullScreen ? "100%" : patchSizePx,
                                background: "#000",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontFamily: "'Courier New', Courier, monospace",
                                fontSize: `${fontSize}px`,
                                lineHeight: 1,
                                color: textColor,
                                fontWeight: weight,
                                userSelect: "none",
                            }}
                        >
                            {centerChar}
                        </div>
                    )
                }

                return (
                    <div
                        key={i}
                        style={{
                            width: fullScreen ? "100%" : patchSizePx,
                            height: fullScreen ? "100%" : patchSizePx,
                            background: "#000",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "'Courier New', Courier, monospace",
                            fontSize: `${fontSize}px`,
                            lineHeight: 1.1,
                            color: textColor,
                            whiteSpace: "pre",
                            fontWeight: weight,
                            userSelect: "none",
                        }}
                    >
                        <div style={{ textAlign: "center" }}>
                            <div>###</div>
                            <div>
                                #{centerChar}#
                            </div>
                            <div>###</div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

interface SinglePatchDisplayProps {
    type: PatchType
    size?: number
    color?: string
    showHashes?: boolean
}

export function SinglePatchDisplay({ type, size = 120, color, showHashes = true }: SinglePatchDisplayProps) {
    const centerChar = PATCH_CHARS[type] ?? "#"
    const textColor = color ?? "#fff"
    const fontSize = showHashes ? Math.floor(size * 0.22) : Math.floor(size * 0.5)

    return (
        <div
            style={{
                width: size,
                height: size,
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: `${fontSize}px`,
                lineHeight: 1.2,
                color: textColor,
                whiteSpace: "pre",
                fontWeight: 700,
                userSelect: "none",
                borderRadius: "4px",
            }}
        >
            {showHashes ? (
                <div style={{ textAlign: "center" }}>
                    <div>###</div>
                    <div>#{centerChar}#</div>
                    <div>###</div>
                </div>
            ) : (
                centerChar
            )}
        </div>
    )
}
