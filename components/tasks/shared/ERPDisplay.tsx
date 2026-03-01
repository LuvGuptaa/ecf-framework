"use client"

import type { PatchItem, PatchType } from "@/lib/types"

interface ERPDisplayProps {
    patches: PatchItem[]
    gridSize: number
    boldTargets?: boolean
    fullScreen?: boolean
    patchSizeCm?: number
}

const PATCH_CHARS: Record<string, string> = {
    target: "E",
    distractor: "Ǝ",
    normal: "#",
}

// ~37.8px per cm on a standard 96dpi screen
const PX_PER_CM = 37.8

export function ERPDisplay({
    patches,
    gridSize,
    boldTargets = false,
    fullScreen = false,
    patchSizeCm = 0.7,
}: ERPDisplayProps) {
    // In full-screen mode: use viewport height as the square side length
    // Each cell = viewportHeight / gridSize
    // In non-fullscreen: use the legacy fixed sizing
    const cellSizeCss = fullScreen
        ? `calc(100vh / ${gridSize})`
        : `${Math.min(Math.floor(70 / gridSize) * 10, 80)}px`

    const patchSizePx = fullScreen
        ? Math.floor(window.innerHeight / gridSize)
        : Math.min(Math.floor(70 / gridSize) * 10, 80)

    const fontSize = fullScreen
        ? Math.max(Math.round(patchSizePx * 0.6), 8)
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
                        width: "100vh",   /* square: width = height */
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
                                width: patchSizePx,
                                height: patchSizePx,
                                background: "#000",
                            }}
                        />
                    )
                }

                const isBottomUp = patch.type === "bottomUpTarget"
                const centerChar = isBottomUp
                    ? (patch.letter ?? "X")
                    : (PATCH_CHARS[patch.type] ?? "#")
                const textColor = isBottomUp
                    ? (patch.color ?? "#ff0000")
                    : "#fff"

                const isBold = boldTargets && patch.type === "target"
                const weight = isBold ? 900 : 700

                if (fullScreen) {
                    // Simplified single-letter display for full-screen mode
                    return (
                        <div
                            key={i}
                            style={{
                                width: patchSizePx,
                                height: patchSizePx,
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

                // Legacy 3x3 hash pattern for non-fullscreen
                return (
                    <div
                        key={i}
                        style={{
                            width: patchSizePx,
                            height: patchSizePx,
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
}

export function SinglePatchDisplay({ type, size = 120 }: SinglePatchDisplayProps) {
    const centerChar = PATCH_CHARS[type] ?? "#"
    const fontSize = Math.floor(size * 0.22)

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
                color: "#fff",
                whiteSpace: "pre",
                fontWeight: 700,
                userSelect: "none",
                borderRadius: "4px",
            }}
        >
            <div style={{ textAlign: "center" }}>
                <div>###</div>
                <div>#{centerChar}#</div>
                <div>###</div>
            </div>
        </div>
    )
}
