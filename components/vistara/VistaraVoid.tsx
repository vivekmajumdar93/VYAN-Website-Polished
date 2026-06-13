'use client'

import {
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  VISTARA_PRODUCTS,
  INACTIVITY_MIN_MS,
  INACTIVITY_MAX_MS,
  FADE_OUT_MS,
  BLACK_PAUSE_MS,
  CURRENT_COLORS,
  NODE_RADIUS,
} from '@/lib/vistara/config'
import type { VistaraProduct } from '@/lib/vistara/config'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Node {
  id: string
  productIdx: number
  x: number
  y: number
  depth: number
  connections: number[]
  glowIntensity: number
  isActive: boolean
  isDormant: boolean
  labelOpacity: number
  isEdge?: boolean
}

interface WebLine {
  from: number
  to: number
  cp1x: number
  cp1y: number
  cp2x: number
  cp2y: number
  pts: { x: number; y: number }[]
  baseOpacity: number
  energy: number
}

interface RopeCurrent {
  id: string
  linePath: number[]
  segIdx: number
  progress: number
  color: string
  speed: number
  strandCount: number
  strandPhase: number
  type: 'ambient' | 'signal'
  active: boolean
}

interface SignalWave {
  sourceIdx: number
  reached: Set<number>
  frontier: number[]
  color: string
  type: 'sleep' | 'wake'
  lastStep: number
}

interface Star {
  x: number
  y: number
  z: number
  r: number
  twinkle: number
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number) {
  if (!hex.startsWith('#')) return hex

  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map(c => c + c)
          .join('')
      : clean

  const num = parseInt(full, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255

  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
}

function makeStars(w: number, h: number, count = 620): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    z: Math.random(),
    r: 0.35 + Math.random() * 1.25,
    twinkle: Math.random() * Math.PI * 2,
  }))
}

// ─── Build bezier line points ──────────────────────────────────────────────────

function buildLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): {
  cp1x: number
  cp1y: number
  cp2x: number
  cp2y: number
  pts: { x: number; y: number }[]
} {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const snake = 0.24 + Math.random() * 0.26

  const px = -dy / dist
  const py = dx / dist

  const off1 = (Math.random() - 0.5) * dist * snake
  const off2 = (Math.random() - 0.5) * dist * snake

  const cp1x = x1 + dx * 0.32 + px * off1
  const cp1y = y1 + dy * 0.32 + py * off1
  const cp2x = x1 + dx * 0.68 + px * off2
  const cp2y = y1 + dy * 0.68 + py * off2

  const pts: { x: number; y: number }[] = []

  for (let i = 0; i <= 64; i++) {
    const t = i / 64
    const mt = 1 - t

    pts.push({
      x:
        mt ** 3 * x1 +
        3 * mt ** 2 * t * cp1x +
        3 * mt * t ** 2 * cp2x +
        t ** 3 * x2,
      y:
        mt ** 3 * y1 +
        3 * mt ** 2 * t * cp1y +
        3 * mt * t ** 2 * cp2y +
        t ** 3 * y2,
    })
  }

  return { cp1x, cp1y, cp2x, cp2y, pts }
}

// ─── Draw helpers ──────────────────────────────────────────────────────────────

function drawStarVoid(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  w: number,
  h: number,
  t: number,
  camOffX: number,
  camOffY: number,
  globalOpacity: number,
) {
  ctx.save()

  const bg = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    0,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.75,
  )

  bg.addColorStop(0, 'rgba(5,4,12,1)')
  bg.addColorStop(0.42, 'rgba(0,0,0,1)')
  bg.addColorStop(1, 'rgba(0,0,0,1)')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'lighter'

  stars.forEach(star => {
    const px = star.x + camOffX * (0.015 + star.z * 0.06)
    const py = star.y + camOffY * (0.015 + star.z * 0.06)

    if (px < -20 || px > w + 20 || py < -20 || py > h + 20) return

    const alpha =
      (0.08 + star.z * 0.42 + Math.sin(t * 0.018 + star.twinkle) * 0.16) *
      globalOpacity

    if (alpha <= 0) return

    ctx.beginPath()
    ctx.arc(px, py, star.r * (0.6 + star.z), 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(220,225,255,' + alpha + ')'
    ctx.fill()

    if (star.z > 0.86) {
      ctx.beginPath()
      ctx.arc(px, py, star.r * 4.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(125,90,255,' + alpha * 0.14 + ')'
      ctx.fill()
    }
  })

  ctx.restore()
}

function drawGlowPolyline(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string,
  alpha: number,
  width: number,
) {
  if (pts.length < 2 || alpha <= 0) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.strokeStyle = hexToRgba(color, alpha * 0.22)
  ctx.lineWidth = width * 6
  ctx.lineCap = 'round'
  ctx.shadowBlur = 20
  ctx.shadowColor = color
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.strokeStyle = hexToRgba(color, alpha * 0.55)
  ctx.lineWidth = width * 2.25
  ctx.lineCap = 'round'
  ctx.shadowBlur = 10
  ctx.shadowColor = color
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.strokeStyle = 'rgba(235,240,255,' + alpha + ')'
  ctx.lineWidth = Math.max(0.42, width * 0.5)
  ctx.lineCap = 'round'
  ctx.shadowBlur = 0
  ctx.stroke()

  ctx.restore()
}

function drawMicroNodesOnLine(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  t: number,
  opacity: number,
) {
  if (opacity <= 0) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let i = 5; i < pts.length; i += 8) {
    const p = pts[i]
    const tw = 0.5 + Math.sin(t * 0.03 + i * 0.7) * 0.5
    const a = opacity * (0.18 + tw * 0.52)

    ctx.beginPath()
    ctx.arc(p.x, p.y, 0.55 + tw * 0.8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(230,235,255,' + a + ')'
    ctx.fill()
  }

  ctx.restore()
}

function drawProductSphere(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  label: string,
  glow: number,
  active: boolean,
  t: number,
) {
  const pulse = active ? 1 + Math.sin(t * 0.06) * 0.08 : 1
  const r = radius * pulse

  ctx.save()

  ctx.globalCompositeOperation = 'lighter'

  const auraR = r * (4.8 + glow * 2.3)
  const aura = ctx.createRadialGradient(x, y, 0, x, y, auraR)

  aura.addColorStop(0, 'rgba(210,220,255,' + (0.18 + glow * 0.36) + ')')
  aura.addColorStop(0.24, 'rgba(130,90,255,' + (0.11 + glow * 0.25) + ')')
  aura.addColorStop(0.7, 'rgba(70,40,180,' + (0.03 + glow * 0.08) + ')')
  aura.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.beginPath()
  ctx.arc(x, y, auraR, 0, Math.PI * 2)
  ctx.fillStyle = aura
  ctx.fill()

  ctx.globalCompositeOperation = 'source-over'

  const sphere = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.45,
    r * 0.08,
    x,
    y,
    r,
  )

  sphere.addColorStop(0, 'rgba(95,100,140,0.46)')
  sphere.addColorStop(0.2, 'rgba(18,20,36,0.96)')
  sphere.addColorStop(0.72, 'rgba(2,2,8,0.99)')
  sphere.addColorStop(1, 'rgba(0,0,0,1)')

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = sphere
  ctx.fill()

  ctx.globalCompositeOperation = 'lighter'

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(225,230,255,' + (0.3 + glow * 0.48) + ')'
  ctx.lineWidth = active ? 1.5 : 0.9
  ctx.shadowBlur = active ? 22 : 12
  ctx.shadowColor = 'rgba(170,140,255,0.9)'
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x - r * 0.28, y - r * 0.34, r * 0.16, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,' + (0.14 + glow * 0.38) + ')'
  ctx.fill()

  ctx.globalCompositeOperation = 'source-over'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const fontSize = Math.max(7, Math.min(12, r * 0.24))
  ctx.font = fontSize + 'px Georgia, serif'

  ctx.fillStyle = active
    ? 'rgba(255,230,245,0.95)'
    : 'rgba(245,245,255,' + (0.56 + glow * 0.35) + ')'

  ctx.shadowBlur = active ? 16 : 8
  ctx.shadowColor = 'rgba(170,130,255,0.9)'

  ctx.fillText(label.toUpperCase(), x, y + 1, r * 1.55)

  ctx.restore()
}

// ─── Build node + web graph ────────────────────────────────────────────────────

function buildGraph(w: number, h: number): { nodes: Node[]; lines: WebLine[] } {
  const nodes: Node[] = []

  const productPlacements = [
    { rx: 0.28, ry: 0.26, depth: 0.58 },
    { rx: 0.59, ry: 0.23, depth: 0.48 },
    { rx: 0.46, ry: 0.51, depth: 0.82 },
    { rx: 0.14, ry: 0.60, depth: 0.52 },
    { rx: 0.73, ry: 0.50, depth: 0.7 },
    { rx: 0.40, ry: 0.82, depth: 0.62 },
    { rx: 0.84, ry: 0.82, depth: 0.76 },
  ]

  productPlacements.forEach((p, i) => {
    nodes.push({
      id: 'product-' + i,
      productIdx: i,
      x: w * p.rx + (Math.random() - 0.5) * w * 0.025,
      y: h * p.ry + (Math.random() - 0.5) * h * 0.025,
      depth: p.depth,
      connections: [],
      glowIntensity: 0.28,
      isActive: false,
      isDormant: false,
      labelOpacity: 1,
    })
  })

  const webCount = 58

  for (let i = 0; i < webCount; i++) {
    nodes.push({
      id: 'web-' + i,
      productIdx: -1,
      x: w * (0.02 + Math.random() * 0.96),
      y: h * (0.02 + Math.random() * 0.94),
      depth: 0.12 + Math.random() * 0.72,
      connections: [],
      glowIntensity: Math.random() * 0.4,
      isActive: false,
      isDormant: false,
      labelOpacity: 0,
    })
  }

  const edgeMargin = Math.max(w, h) * 0.12
  const edgeCountPerSide = 5

  for (let i = 0; i < edgeCountPerSide; i++) {
    const u = (i + 0.5) / edgeCountPerSide

    nodes.push({
      id: 'edge-top-' + i,
      productIdx: -1,
      x: w * u,
      y: -edgeMargin,
      depth: 0.2 + Math.random() * 0.7,
      connections: [],
      glowIntensity: 0,
      isActive: false,
      isDormant: false,
      labelOpacity: 0,
      isEdge: true,
    })

    nodes.push({
      id: 'edge-bottom-' + i,
      productIdx: -1,
      x: w * u,
      y: h + edgeMargin,
      depth: 0.2 + Math.random() * 0.7,
      connections: [],
      glowIntensity: 0,
      isActive: false,
      isDormant: false,
      labelOpacity: 0,
      isEdge: true,
    })

    nodes.push({
      id: 'edge-left-' + i,
      productIdx: -1,
      x: -edgeMargin,
      y: h * u,
      depth: 0.2 + Math.random() * 0.7,
      connections: [],
      glowIntensity: 0,
      isActive: false,
      isDormant: false,
      labelOpacity: 0,
      isEdge: true,
    })

    nodes.push({
      id: 'edge-right-' + i,
      productIdx: -1,
      x: w + edgeMargin,
      y: h * u,
      depth: 0.2 + Math.random() * 0.7,
      connections: [],
      glowIntensity: 0,
      isActive: false,
      isDormant: false,
      labelOpacity: 0,
      isEdge: true,
    })
  }

  const lines: WebLine[] = []
  const seen = new Set<string>()

  nodes.forEach((node, i) => {
    const dists = nodes
      .map((n, j) => ({ j, d: Math.hypot(n.x - node.x, n.y - node.y) }))
      .filter(({ j }) => j !== i)
      .filter(({ j }) => !(node.isEdge && nodes[j].isEdge))
      .sort((a, b) => a.d - b.d)

    const connectCount = node.isEdge
      ? 3
      : node.productIdx >= 0
        ? 9
        : 4 + Math.floor(Math.random() * 4)

    dists.slice(0, connectCount).forEach(({ j }) => {
      const key = Math.min(i, j) + '-' + Math.max(i, j)

      if (seen.has(key)) return

      seen.add(key)

      const lineData = buildLine(node.x, node.y, nodes[j].x, nodes[j].y)

      lines.push({
        from: i,
        to: j,
        cp1x: lineData.cp1x,
        cp1y: lineData.cp1y,
        cp2x: lineData.cp2x,
        cp2y: lineData.cp2y,
        pts: lineData.pts,
        baseOpacity: 0.018 + Math.random() * 0.045,
        energy: 0.4 + Math.random() * 1.2,
      })

      nodes[i].connections.push(j)
      nodes[j].connections.push(i)
    })
  })

  return { nodes, lines }
}

// ─── BFS path ─────────────────────────────────────────────────────────────────

function bfs(nodes: Node[], from: number, to: number): number[] {
  if (from === to) return [from]

  const visited = new Set([from])
  const queue: number[][] = [[from]]

  while (queue.length) {
    const path = queue.shift()!
    const cur = path[path.length - 1]

    for (const nb of nodes[cur].connections) {
      if (nb === to) return [...path, nb]

      if (!visited.has(nb)) {
        visited.add(nb)
        queue.push([...path, nb])
      }
    }
  }

  return []
}

// ─── Spawn ambient current from screen edge ────────────────────────────────────

function spawnCurrent(nodes: Node[], id: string): RopeCurrent | null {
  const edgeNodes = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.isEdge)

  const productNodes = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.productIdx >= 0 && !n.isDormant)

  if (edgeNodes.length < 1 || productNodes.length < 1) return null

  const start = edgeNodes[Math.floor(Math.random() * edgeNodes.length)]

  const groupSize = 1 + Math.floor(Math.random() * Math.min(4, productNodes.length))
  const shuffled = [...productNodes].sort(() => Math.random() - 0.5)
  const group = shuffled.slice(0, groupSize)

  let fullPath: number[] = [start.i]

  for (let g = 0; g < group.length; g++) {
    const seg = bfs(nodes, fullPath[fullPath.length - 1], group[g].i)

    if (seg.length > 1) {
      fullPath.push(...seg.slice(1))
    }
  }

  if (fullPath.length < 2) return null

  return {
    id,
    linePath: fullPath,
    segIdx: 0,
    progress: 0,
    color: CURRENT_COLORS[Math.floor(Math.random() * CURRENT_COLORS.length)],
    speed: 0.007 + Math.random() * 0.007,
    strandCount: 3 + Math.floor(Math.random() * 3),
    strandPhase: Math.random() * Math.PI * 2,
    type: 'ambient',
    active: true,
  }
}

// ─── Draw twisted rope current ─────────────────────────────────────────────────

function drawRopeCurrent(
  ctx: CanvasRenderingContext2D,
  line: WebLine,
  progress: number,
  color: string,
  strandCount: number,
  strandPhase: number,
  t: number,
  trailProgress: number,
  cameraDepth: number,
) {
  const pts = line.pts
  const startIdx = Math.floor(trailProgress * (pts.length - 1))
  const endIdx = Math.floor(progress * (pts.length - 1))

  if (endIdx - startIdx < 2) return

  const visiblePts = pts.slice(startIdx, endIdx + 1)
  const totalPts = visiblePts.length

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  drawGlowPolyline(
    ctx,
    visiblePts,
    color,
    0.45 + cameraDepth * 0.35,
    1.4 + cameraDepth * 1.4,
  )

  for (let s = 0; s < strandCount; s++) {
    const phaseOffset = (s / strandCount) * Math.PI * 2 + strandPhase
    const strandColor = s === 1 ? '#ffffff' : color

    ctx.beginPath()

    for (let i = 0; i < totalPts; i++) {
      const pt = visiblePts[i]
      const localT = i / Math.max(totalPts - 1, 1)

      const segProgress =
        startIdx / pts.length + localT * ((endIdx - startIdx) / pts.length)

      const twistAngle = segProgress * Math.PI * 8 + phaseOffset + t * 0.035
      const twistAmp = 3.2 + cameraDepth * 3

      let perpX = 0
      let perpY = 0

      if (i < totalPts - 1) {
        const next = visiblePts[i + 1]
        const dx = next.x - pt.x
        const dy = next.y - pt.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1

        perpX = -dy / len
        perpY = dx / len
      }

      const twist = Math.sin(twistAngle) * twistAmp
      const rx = pt.x + perpX * twist
      const ry = pt.y + perpY * twist

      if (i === 0) ctx.moveTo(rx, ry)
      else ctx.lineTo(rx, ry)
    }

    const strandAlpha = s === 1 ? 0.68 : 0.48

    ctx.strokeStyle = hexToRgba(strandColor, strandAlpha)
    ctx.lineWidth = s === 1 ? 0.75 : 1.15
    ctx.lineCap = 'round'
    ctx.shadowBlur = s === 1 ? 5 : 11
    ctx.shadowColor = color
    ctx.stroke()
  }

  const leadPt = visiblePts[visiblePts.length - 1]

  if (leadPt) {
    const glow = ctx.createRadialGradient(
      leadPt.x,
      leadPt.y,
      0,
      leadPt.x,
      leadPt.y,
      24,
    )

    glow.addColorStop(0, 'rgba(255,255,255,0.92)')
    glow.addColorStop(0.25, hexToRgba(color, 0.72))
    glow.addColorStop(1, hexToRgba(color, 0))

    ctx.beginPath()
    ctx.arc(leadPt.x, leadPt.y, 24, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
  }

  ctx.restore()
}

// ─── Main Vistara canvas ───────────────────────────────────────────────────────

export function VistaraVoid({ onBack }: { onBack?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const stateRef = useRef({
    nodes: [] as Node[],
    lines: [] as WebLine[],
    stars: [] as Star[],
    currents: [] as RopeCurrent[],
    signalWave: null as SignalWave | null,
    cameraDepth: 0,
    dragX: 0,
    dragY: 0,
    smoothDragX: 0,
    smoothDragY: 0,
    t: 0,
    lastCurrentSpawn: 0,
    currentInterval: 700,
    systemState: 'ambient' as 'ambient' | 'user-active' | 'node-locked',
    globalOpacity: 1,
    inactivityTimer: null as ReturnType<typeof setTimeout> | null,
    activeNodeIdx: null as number | null,
  })

  const [openProduct, setOpenProduct] = useState<VistaraProduct | null>(null)
  const [globalOpacity, setGlobalOpacity] = useState(1)

  const isDragging = useRef(false)
  const lastDrag = useRef({ x: 0, y: 0 })
  const scrollRef = useRef(0)
  const touchStartY = useRef(0)

  const scheduleInactivity = useCallback(() => {
    const s = stateRef.current

    if (s.systemState === 'node-locked') return

    if (s.inactivityTimer) clearTimeout(s.inactivityTimer)

    const delay =
      INACTIVITY_MIN_MS +
      Math.random() * (INACTIVITY_MAX_MS - INACTIVITY_MIN_MS)

    s.inactivityTimer = setTimeout(() => {
      setGlobalOpacity(0)
      s.globalOpacity = 0

      setTimeout(() => {
        s.activeNodeIdx = null
        s.systemState = 'ambient'
        s.currents = []

        s.nodes.forEach(n => {
          n.isActive = false
          n.isDormant = false
          n.glowIntensity = n.productIdx >= 0 ? 0.28 : 0
        })

        s.signalWave = null

        setTimeout(() => {
          s.globalOpacity = 1
          setGlobalOpacity(1)
          scheduleInactivity()
        }, BLACK_PAUSE_MS)
      }, FADE_OUT_MS)
    }, delay)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const s = stateRef.current

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      const { nodes, lines } = buildGraph(canvas.width, canvas.height)

      s.nodes = nodes
      s.lines = lines
      s.stars = makeStars(canvas.width, canvas.height)
      s.currents = []
    }

    resize()
    window.addEventListener('resize', resize)
    scheduleInactivity()

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      const ctx = canvas.getContext('2d')

      if (!ctx) return

      s.t++
      const t = s.t

      s.smoothDragX += (s.dragX * 0.005 - s.smoothDragX) * 0.06
      s.smoothDragY += (s.dragY * 0.003 - s.smoothDragY) * 0.06

      const camOffX = Math.sin(s.smoothDragX) * w * 0.12
      const camOffY = Math.sin(s.smoothDragY) * h * 0.08
      const camZ = s.cameraDepth

      ctx.clearRect(0, 0, w, h)
      ctx.globalAlpha = 1

      drawStarVoid(ctx, s.stars, w, h, t, camOffX, camOffY, s.globalOpacity)

      ctx.globalAlpha = s.globalOpacity

      // Neural web
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      s.lines.forEach(line => {
        const fromNode = s.nodes[line.from]
        const toNode = s.nodes[line.to]

        const avgDepth = (fromNode.depth + toNode.depth) / 2
        const depthVis = 0.45 + camZ * 0.55
        const dormantPenalty = fromNode.isDormant || toNode.isDormant ? 0.25 : 1

        const activeLine = s.currents.some(curr => {
          for (let i = 0; i < curr.linePath.length - 1; i++) {
            const a = curr.linePath[i]
            const b = curr.linePath[i + 1]

            if (
              (a === line.from && b === line.to) ||
              (a === line.to && b === line.from)
            ) {
              return true
            }
          }

          return false
        })

        const lineOpacity =
          (line.baseOpacity * line.energy * depthVis +
            (activeLine ? 0.055 : 0)) *
          dormantPenalty *
          s.globalOpacity

        if (lineOpacity < 0.003) return

        const offX = camOffX * (1 - avgDepth * 0.5)
        const offY = camOffY * (1 - avgDepth * 0.5)

        ctx.save()
        ctx.translate(offX, offY)

        const colorPick = activeLine
          ? CURRENT_COLORS[Math.floor((line.energy * 999) % CURRENT_COLORS.length)]
          : '#bfc6ff'

        drawGlowPolyline(
          ctx,
          line.pts,
          colorPick,
          activeLine ? lineOpacity * 2.4 : lineOpacity,
          activeLine ? 1.15 + avgDepth * 1.2 : 0.45 + avgDepth * 0.45,
        )

        drawMicroNodesOnLine(ctx, line.pts, t, lineOpacity * 1.6)

        ctx.restore()
      })

      ctx.restore()

      // Currents
      const now = performance.now()

      if (
        (s.systemState === 'ambient' || s.systemState === 'user-active') &&
        now - s.lastCurrentSpawn > s.currentInterval
      ) {
        const maxC = s.systemState === 'user-active' ? 3 : 2
        const active = s.currents.filter(c => c.active).length

        if (active < maxC) {
          const nc = spawnCurrent(s.nodes, 'c-' + now)

          if (nc) {
            s.currents.push(nc)
            s.lastCurrentSpawn = now
            s.currentInterval =
              s.systemState === 'user-active'
                ? 260 + Math.random() * 360
                : 500 + Math.random() * 900
          }
        }
      }

      s.currents = s.currents.filter(c => c.active)

      s.currents.forEach(curr => {
        if (!curr.active || curr.linePath.length < 2) return

        const fromIdx = curr.linePath[curr.segIdx]
        const toIdx = curr.linePath[curr.segIdx + 1]

        if (toIdx === undefined) {
          curr.active = false
          return
        }

        const line = s.lines.find(
          l =>
            (l.from === fromIdx && l.to === toIdx) ||
            (l.from === toIdx && l.to === fromIdx),
        )

        if (!line) {
          curr.segIdx++
          curr.progress = 0
          return
        }

        const avgDepth = (s.nodes[fromIdx].depth + s.nodes[toIdx].depth) / 2
        const offX = camOffX * (1 - avgDepth * 0.5)
        const offY = camOffY * (1 - avgDepth * 0.5)
        const pts = line.from === fromIdx ? line.pts : [...line.pts].reverse()

        curr.progress += curr.speed * (s.systemState === 'user-active' ? 1.25 : 1)
        const trailStart = Math.max(0, curr.progress - 0.38)

        ctx.save()
        ctx.translate(offX, offY)

        drawRopeCurrent(
          ctx,
          { ...line, pts },
          Math.min(curr.progress, 1),
          curr.color,
          curr.strandCount,
          curr.strandPhase + t * 0.008,
          t,
          trailStart,
          camZ,
        )

        ctx.restore()

        if (curr.progress >= 1) {
          const destNode = s.nodes[toIdx]

          if (
            destNode.productIdx >= 0 &&
            !destNode.isDormant &&
            !destNode.isActive
          ) {
            destNode.glowIntensity = 1

            setTimeout(() => {
              if (!destNode.isActive) destNode.glowIntensity = 0.32
            }, 1800 + Math.random() * 600)
          }

          curr.segIdx++
          curr.progress = 0

          if (curr.segIdx >= curr.linePath.length - 1) {
            curr.active = false
          }
        }
      })

      // Signal wave
      const wave = s.signalWave

      if (wave && now - wave.lastStep > 70) {
        wave.lastStep = now

        const next: number[] = []

        wave.frontier.forEach(idx => {
          s.nodes[idx].connections.forEach(nb => {
            if (!wave.reached.has(nb)) {
              wave.reached.add(nb)
              next.push(nb)

              const nbNode = s.nodes[nb]

              if (nbNode.productIdx >= 0) {
                if (wave.type === 'sleep') {
                  nbNode.glowIntensity = 0.22
                  nbNode.isDormant = true

                  setTimeout(() => {
                    nbNode.glowIntensity = 0.08
                  }, 300)
                } else {
                  nbNode.isDormant = false
                  nbNode.glowIntensity = 0.38
                }
              }
            }
          })
        })

        wave.frontier = next

        if (next.length === 0) {
          s.signalWave = null
        }
      }

      // Product spheres
      s.nodes.forEach((node, i) => {
        if (node.productIdx < 0) return

        const product = VISTARA_PRODUCTS[node.productIdx]
        if (!product) return

        const depthScale = 0.55 + node.depth * 0.75
        const offX = camOffX * (1 - node.depth * 0.5)
        const offY = camOffY * (1 - node.depth * 0.5)

        const nx = node.x + offX
        const ny = node.y + offY

        const baseGlow = node.isActive
          ? 1
          : node.isDormant
            ? 0.08
            : Math.max(node.glowIntensity, 0.34)

        const nodeR =
          NODE_RADIUS *
          depthScale *
          (node.isActive ? 1.5 : 1.25) *
          (0.9 + camZ * 0.45)

        ctx.save()
        ctx.globalCompositeOperation = 'lighter'

        node.connections.forEach(nbIdx => {
          const nb = s.nodes[nbIdx]

          const line = s.lines.find(
            l =>
              (l.from === i && l.to === nbIdx) ||
              (l.from === nbIdx && l.to === i),
          )

          if (!line) return

          const avgDepth = (node.depth + nb.depth) / 2
          const lx = camOffX * (1 - avgDepth * 0.5)
          const ly = camOffY * (1 - avgDepth * 0.5)

          ctx.save()
          ctx.translate(lx, ly)

          drawGlowPolyline(
            ctx,
            line.from === i ? line.pts : [...line.pts].reverse(),
            '#dfe6ff',
            baseGlow * 0.035,
            0.8,
          )

          ctx.restore()
        })

        ctx.restore()

        drawProductSphere(
          ctx,
          nx,
          ny,
          nodeR,
          product.name,
          baseGlow,
          node.isActive,
          t,
        )

        node.labelOpacity += ((baseGlow > 0.12 ? 1 : 0) - node.labelOpacity) * 0.06
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)

      if (s.inactivityTimer) clearTimeout(s.inactivityTimer)
    }
  }, [scheduleInactivity])

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()

      scrollRef.current = Math.min(
        Math.max(scrollRef.current + e.deltaY / 600, 0),
        1,
      )

      stateRef.current.cameraDepth = scrollRef.current
    }

    window.addEventListener('wheel', onWheel, { passive: false })

    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    isDragging.current = true
    lastDrag.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
  }, [])

  const onTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      const dy = e.touches[0].clientY - touchStartY.current

      scrollRef.current = Math.min(
        Math.max(scrollRef.current - dy * 0.002, 0),
        1,
      )

      stateRef.current.cameraDepth = scrollRef.current

      const dx2 = e.touches[0].clientX - lastDrag.current.x
      const dy2 = e.touches[0].clientY - lastDrag.current.y

      stateRef.current.dragX += dx2
      stateRef.current.dragY += dy2

      lastDrag.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }

      stateRef.current.systemState = 'user-active'
      scheduleInactivity()
    },
    [scheduleInactivity],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      isDragging.current = true

      lastDrag.current = {
        x: e.clientX,
        y: e.clientY,
      }

      stateRef.current.systemState = 'user-active'
      scheduleInactivity()
    },
    [scheduleInactivity],
  )

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!isDragging.current) return

    stateRef.current.dragX += e.clientX - lastDrag.current.x
    stateRef.current.dragY += e.clientY - lastDrag.current.y

    lastDrag.current = {
      x: e.clientX,
      y: e.clientY,
    }
  }, [])

  const onPointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const lockNode = useCallback((idx: number) => {
    const s = stateRef.current

    s.activeNodeIdx = idx
    s.systemState = 'node-locked'

    if (s.inactivityTimer) {
      clearTimeout(s.inactivityTimer)
      s.inactivityTimer = null
    }

    s.signalWave = {
      sourceIdx: idx,
      reached: new Set([idx]),
      frontier: [idx],
      color: CURRENT_COLORS[Math.floor(Math.random() * CURRENT_COLORS.length)],
      type: 'sleep',
      lastStep: performance.now(),
    }

    s.nodes.forEach((n, j) => {
      n.isActive = j === idx

      if (j !== idx && n.productIdx >= 0) {
        n.isDormant = true
      }
    })

    const product = VISTARA_PRODUCTS[s.nodes[idx].productIdx]
    if (product) setOpenProduct(product)
  }, [])

  const handleCanvasClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const s = stateRef.current

      if (s.systemState !== 'node-locked') {
        s.systemState = 'user-active'
      }

      scheduleInactivity()

      const rect = canvasRef.current!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const camOffX = Math.sin(s.smoothDragX) * rect.width * 0.12
      const camOffY = Math.sin(s.smoothDragY) * rect.height * 0.08

      let hitIdx = -1

      s.nodes.forEach((node, i) => {
        if (node.productIdx < 0) return

        const offX = camOffX * (1 - node.depth * 0.5)
        const offY = camOffY * (1 - node.depth * 0.5)

        const nx = node.x + offX
        const ny = node.y + offY

        const depthScale = 0.55 + node.depth * 0.75
        const hitR =
          NODE_RADIUS *
            depthScale *
            1.55 *
            (0.9 + s.cameraDepth * 0.45) +
          24

        const dist = Math.hypot(mx - nx, my - ny)

        if (dist < hitR) hitIdx = i
      })

      if (hitIdx >= 0) {
        lockNode(hitIdx)
      }
    },
    [scheduleInactivity, lockNode],
  )

  const handlePanelClose = useCallback(() => {
    setOpenProduct(null)

    const s = stateRef.current
    const source = s.activeNodeIdx ?? 0

    s.signalWave = {
      sourceIdx: source,
      reached: new Set([source]),
      frontier: [source],
      color: '#ffffff',
      type: 'wake',
      lastStep: performance.now(),
    }

    s.nodes.forEach(n => {
      n.isActive = false

      if (n.productIdx >= 0) {
        n.isDormant = false
        n.glowIntensity = 0.34
      }
    })

    s.activeNodeIdx = null
    s.systemState = 'user-active'

    scheduleInactivity()
  }, [scheduleInactivity])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
        cursor: isDragging.current ? 'grabbing' : 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => onPointerUp()}
      onClick={() => {
        if (stateRef.current.systemState !== 'node-locked') {
          stateRef.current.systemState = 'user-active'
          scheduleInactivity()
        }
      }}
    >
      <motion.canvas
        ref={canvasRef}
        animate={{ opacity: globalOpacity }}
        transition={{ duration: FADE_OUT_MS / 1000 }}
        onClick={handleCanvasClick}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        style={{
          position: 'fixed',
          bottom: '6%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'system-ui',
            fontSize: '9px',
            letterSpacing: '0.25em',
            color: 'rgba(255,255,255,0.18)',
            textTransform: 'uppercase',
          }}
        >
          Scroll to enter the web · Drag to rotate
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        style={{
          position: 'fixed',
          top: '22px',
          right: '22px',
          zIndex: 20,
          pointerEvents: 'none',
          textAlign: 'right',
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '11px',
            letterSpacing: '0.35em',
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
          }}
        >
          Vistāra
        </div>

        <div
          style={{
            fontFamily: 'system-ui',
            fontSize: '8px',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.18)',
            textTransform: 'uppercase',
            marginTop: '3px',
          }}
        >
          The Manifestations
        </div>
      </motion.div>

      {onBack && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={onBack}
          style={{
            position: 'fixed',
            top: '22px',
            left: '22px',
            zIndex: 20,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '7px 14px',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontFamily: 'system-ui',
            cursor: 'pointer',
          }}
        >
          ← Śūnya
        </motion.button>
      )}

      <AnimatePresence>
        {openProduct && (
          <ProductPanel product={openProduct} onClose={handlePanelClose} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Product glass panel ───────────────────────────────────────────────────────

function ProductPanel({
  product,
  onClose,
}: {
  product: VistaraProduct
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '480px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          backdropFilter: 'blur(24px)',
          padding: '36px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '22px',
                letterSpacing: '0.25em',
                color: 'rgba(255,255,255,0.9)',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              {product.name}
            </h2>

            <p
              style={{
                fontFamily: 'system-ui',
                fontSize: '10px',
                letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
              }}
            >
              {product.tagline}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.4)',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        </div>

        <p
          style={{
            fontFamily: 'system-ui',
            fontSize: '14px',
            lineHeight: '1.75',
            color: 'rgba(255,255,255,0.65)',
            letterSpacing: '0.02em',
            marginBottom: '28px',
          }}
        >
          {product.description}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontFamily: 'system-ui',
              cursor: 'pointer',
            }}
          >
            Learn More
          </button>

          <button
            style={{
              padding: '12px 20px',
              background: 'rgba(123,47,255,0.18)',
              border: '1px solid rgba(123,47,255,0.3)',
              borderRadius: '10px',
              color: 'rgba(200,160,255,0.9)',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontFamily: 'system-ui',
              cursor: 'pointer',
            }}
          >
            Engage
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}