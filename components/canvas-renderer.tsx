"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react"
import { renderToStaticMarkup } from "react-dom/server"

interface CanvasRendererProps {
  phase: "idle" | "test" | "results" | "completed"
  participantName: string
  trialInfo: {
    current: number
    total: number
  }
  gridConfig: {
    rows: number
    cols: number
    shape: string
    oddShapeIndex: number | null
  }
  lastResult: {
    reactionTime: number
    wrongTapCount: number
    isCorrect: boolean
  } | null
  onStart: () => void
  onCellClick: (index: number, e: React.MouseEvent | React.TouchEvent) => void
  onNextTrial: () => void
  onCanvasReady: (canvas: HTMLCanvasElement) => void
}

const shapeIcons = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
} as const

type ShapeKey = keyof typeof shapeIcons

export function CanvasRenderer(props: CanvasRendererProps) {
  const {
    phase,
    participantName,
    trialInfo,
    gridConfig,
    lastResult,
    onStart,
    onCellClick,
    onNextTrial,
    onCanvasReady,
  } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Store props in ref to access latest values in animation loop without restarting it
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  }, [props])

  // Store active taps for visualization
  const tapsRef = useRef<Array<{ x: number, y: number, startTime: number }>>([])

  // Animation frame ref
  const rafRef = useRef<number>()

  // Initialize canvas and load images
  useEffect(() => {
    const loadImages = async () => {
      const loadedImages: Record<string, HTMLImageElement> = {}

      const shapes: ShapeKey[] = ["up", "down", "left", "right"]

      // Load base arrows
      for (const shape of shapes) {
        // Blue version (Base)
        const BaseIcon = shapeIcons[shape]
        const baseSvg = renderToStaticMarkup(
          <BaseIcon size={48} strokeWidth={2} color="#3b82f6" />
        )
        const baseImg = new Image()
        baseImg.src = `data:image/svg+xml;base64,${btoa(baseSvg)}`
        await new Promise((resolve) => (baseImg.onload = resolve))
        loadedImages[`${shape}-blue`] = baseImg

        // Orange version (Odd)
        const oddSvg = renderToStaticMarkup(
          <BaseIcon size={48} strokeWidth={2} color="#f97316" />
        )
        const oddImg = new Image()
        oddImg.src = `data:image/svg+xml;base64,${btoa(oddSvg)}`
        await new Promise((resolve) => (oddImg.onload = resolve))
        loadedImages[`${shape}-orange`] = oddImg
      }

      setImages(loadedImages)
    }

    loadImages()

    const handleResize = () => {
      if (canvasRef.current) {
        const { clientWidth, clientHeight } = canvasRef.current.parentElement || document.body
        const dpr = window.devicePixelRatio || 1

        canvasRef.current.width = clientWidth * dpr
        canvasRef.current.height = clientHeight * dpr

        setDimensions({ width: clientWidth, height: clientHeight })

        onCanvasReady(canvasRef.current)
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize()

    return () => window.removeEventListener("resize", handleResize)
  }, []) // Run once on mount

  // Helper for rounded rects
  const drawRoundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  // Render Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0) {
       rafRef.current = requestAnimationFrame(render)
       return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
       rafRef.current = requestAnimationFrame(render)
       return
    }

    const dpr = window.devicePixelRatio || 1
    const { width, height } = dimensions

    // Access latest props from ref
    const { phase, participantName, trialInfo, gridConfig, lastResult } = propsRef.current

    // Clear and set scale
    ctx.resetTransform()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)

    // Helper to center text
    const drawCenteredText = (text: string, x: number, y: number, font: string, color: string) => {
      ctx.font = font
      ctx.fillStyle = color
      ctx.textAlign = "center"
      ctx.fillText(text, x, y)
    }

    // Common Header
    const drawHeader = () => {
      ctx.fillStyle = "#f8fafc"
      ctx.fillRect(0, 0, width, 60)
      ctx.strokeStyle = "#e2e8f0"
      ctx.beginPath()
      ctx.moveTo(0, 60)
      ctx.lineTo(width, 60)
      ctx.stroke()

      ctx.textAlign = "left"
      ctx.font = "600 16px sans-serif"
      ctx.fillStyle = "#0f172a"
      ctx.fillText(participantName || "Participant", 20, 35)

      ctx.textAlign = "right"
      ctx.font = "14px sans-serif"
      ctx.fillStyle = "#64748b"
      ctx.fillText(
        `Trial ${Math.min(trialInfo.current + 1, trialInfo.total)} of ${trialInfo.total}`,
        width - 20,
        35
      )
    }

    drawHeader()

    const contentY = 80
    const contentHeight = height - 80

    if (phase === "idle") {
      // Instructions
      drawCenteredText("Test Instructions", width / 2, contentY + 50, "bold 24px sans-serif", "#0f172a")

      const lines = [
        "1. A grid of arrows will appear.",
        "2. Find the arrow pointing differently.",
        "3. Tap it as fast as you can!"
      ]

      lines.forEach((line, i) => {
        drawCenteredText(line, width / 2, contentY + 100 + (i * 30), "18px sans-serif", "#475569")
      })

      // Start Button
      const btnW = 200
      const btnH = 50
      const btnX = (width - btnW) / 2
      const btnY = contentY + 250

      ctx.fillStyle = "#0f172a"
      drawRoundRectPath(ctx, btnX, btnY, btnW, btnH, 8)
      ctx.fill()

      drawCenteredText("Start Test", width / 2, btnY + 32, "bold 18px sans-serif", "#ffffff")
    } else if (phase === "test") {
      // Grid
      const { rows, cols } = gridConfig
      const padding = 20
      const availableW = width - (padding * 2)
      const availableH = contentHeight - (padding * 2)

      const cellW = Math.min(80, availableW / cols)
      const cellH = Math.min(80, availableH / rows)
      const size = Math.min(cellW, cellH)

      const gridW = size * cols
      const gridH = size * rows

      const startX = (width - gridW) / 2
      const startY = 80 + (contentHeight - gridH) / 2

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const index = r * cols + c
          const x = startX + c * size
          const y = startY + r * size

          const isOdd = index === gridConfig.oddShapeIndex

          ctx.strokeStyle = isOdd ? "#fdba74" : "#93c5fd"
          ctx.lineWidth = 1
          ctx.fillStyle = isOdd ? "#fff7ed" : "#eff6ff"

          const gap = 4
          drawRoundRectPath(ctx, x + gap, y + gap, size - gap*2, size - gap*2, 8)
          ctx.fill()
          ctx.stroke()

          const iconSize = size * 0.6
          const iconX = x + (size - iconSize) / 2
          const iconY = y + (size - iconSize) / 2

          const shape = gridConfig.shape
          const oppositeShapes: Record<string, string> = {
            up: "down",
            down: "up",
            left: "right",
            right: "left",
          }

          const iconShape = isOdd ? oppositeShapes[shape] : shape
          const colorSuffix = isOdd ? "orange" : "blue"
          const imgKey = `${iconShape}-${colorSuffix}`

          const img = images[imgKey]
          if (img) {
            ctx.drawImage(img, iconX, iconY, iconSize, iconSize)
          }
        }
      }
    } else if (phase === "results" && lastResult) {
      // Results Card
      const cardW = Math.min(400, width - 40)
      const cardH = 300
      const cardX = (width - cardW) / 2
      const cardY = 80 + (contentHeight - cardH) / 2

      ctx.shadowColor = "rgba(0, 0, 0, 0.1)"
      ctx.shadowBlur = 10
      ctx.shadowOffsetY = 4

      ctx.fillStyle = "#ffffff"
      drawRoundRectPath(ctx, cardX, cardY, cardW, cardH, 12)
      ctx.fill()

      ctx.shadowColor = "transparent"

      ctx.fillStyle = "#0f172a"
      drawCenteredText("Trial Complete!", width / 2, cardY + 40, "bold 24px sans-serif", "#0f172a")

      drawCenteredText(`${lastResult.reactionTime.toFixed(0)} ms`, width / 2 - 80, cardY + 120, "bold 32px sans-serif", "#16a34a")
      drawCenteredText("Reaction Time", width / 2 - 80, cardY + 150, "14px sans-serif", "#64748b")

      drawCenteredText(`${lastResult.wrongTapCount}`, width / 2 + 80, cardY + 120, "bold 32px sans-serif", "#ea580c")
      drawCenteredText("Wrong Taps", width / 2 + 80, cardY + 150, "14px sans-serif", "#64748b")

      const btnW = 200
      const btnH = 50
      const btnX = (width - btnW) / 2
      const btnY = cardY + 220

      ctx.fillStyle = "#0f172a"
      drawRoundRectPath(ctx, btnX, btnY, btnW, btnH, 8)
      ctx.fill()

      const btnText = trialInfo.current + 1 >= trialInfo.total ? "Finish Test" : "Continue"
      drawCenteredText(btnText, width / 2, btnY + 32, "bold 16px sans-serif", "#ffffff")
    }

    // DRAW TAPS
    const now = performance.now()
    // Filter old taps (older than 600ms)
    tapsRef.current = tapsRef.current.filter(t => now - t.startTime < 600)

    tapsRef.current.forEach(tap => {
       const age = now - tap.startTime
       const progress = age / 600 // 0 to 1

       // Ease out
       const ease = 1 - Math.pow(1 - progress, 3)

       const radius = 10 + (ease * 40)
       const alpha = 1 - progress

       ctx.beginPath()
       ctx.arc(tap.x, tap.y, radius, 0, Math.PI * 2)
       ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.3})`
       ctx.fill()
       ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.8})`
       ctx.lineWidth = 2
       ctx.stroke()
    })

    rafRef.current = requestAnimationFrame(render)

  }, [dimensions, images])

  // Start/Update Loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(render)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [render])

  // Handle Clicks
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    let clientX, clientY
    if ('touches' in e) {
       clientX = e.touches[0].clientX
       clientY = e.touches[0].clientY
    } else {
       clientX = (e as React.MouseEvent).clientX
       clientY = (e as React.MouseEvent).clientY
    }

    const x = (clientX - rect.left)
    const y = (clientY - rect.top)

    // Add tap visual
    tapsRef.current.push({ x, y, startTime: performance.now() })

    // Hit Logic
    const { phase, gridConfig } = propsRef.current // Use latest props
    const contentY = 80
    const contentHeight = dimensions.height - 80

    if (phase === "idle") {
      const btnW = 200
      const btnH = 50
      const btnX = (dimensions.width - btnW) / 2
      const btnY = contentY + 250

      if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
        props.onStart()
      }
    } else if (phase === "test") {
      const { rows, cols } = gridConfig
      const padding = 20
      const availableW = dimensions.width - (padding * 2)
      const availableH = contentHeight - (padding * 2)
      const cellW = Math.min(80, availableW / cols)
      const cellH = Math.min(80, availableH / rows)
      const size = Math.min(cellW, cellH)
      const gridW = size * cols
      const gridH = size * rows
      const startX = (dimensions.width - gridW) / 2
      const startY = 80 + (contentHeight - gridH) / 2

      if (x >= startX && x <= startX + gridW && y >= startY && y <= startY + gridH) {
        const col = Math.floor((x - startX) / size)
        const row = Math.floor((y - startY) / size)
        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          props.onCellClick(row * cols + col, e)
        }
      }

    } else if (phase === "results") {
      const cardW = Math.min(400, dimensions.width - 40)
      const cardH = 300
      const cardX = (dimensions.width - cardW) / 2
      const cardY = 80 + (contentHeight - cardH) / 2
      const btnW = 200
      const btnH = 50
      const btnX = (dimensions.width - btnW) / 2
      const btnY = cardY + 220

      if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
        props.onNextTrial()
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full touch-none"
      onClick={handleClick}
    />
  )
}
