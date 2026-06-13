'use client'

import {
  useRef, useState, useEffect, useCallback, useMemo, useReducer,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import {
  VISTARA_PRODUCTS,
  CAMERA_ENTRY, CAMERA_ENTRY_LOOK,
  CAMERA_CAVE, CAMERA_CAVE_LOOK,
  SCROLL_DEPTH_PX, NODE_DWELL_MS, NODE_APPROACH_DIST,
  NODE_RADIUS, NODE_GLOW_RADIUS,
  CURRENT_SPEED, INACTIVITY_MIN_MS, INACTIVITY_MAX_MS,
  FADE_OUT_MS, BLACK_PAUSE_MS, FADE_IN_MS,
  CURRENT_COLORS,
} from '@/lib/vistara/config'
import {
  buildWebNodes, buildOrganicLine, edgeEntryPoint,
  bfsPath, spawnAmbientCurrent, createSignalWave,
  type WebNode, type ActiveCurrent, type LineState, type SignalWave,
} from '@/lib/vistara/neural'
import type { VistaraProduct } from '@/lib/vistara/config'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SystemState = 'ambient' | 'user-active' | 'node-locked' | 'fading' | 'black'

interface VistaraState {
  nodes: WebNode[]
  lines: Map<string, LineState>
  currents: ActiveCurrent[]
  signalWave: SignalWave | null
  systemState: SystemState
  activeNodeIdx: number | null
  globalOpacity: number
}

// ─── Line cache — built once per connection pair ───────────────────────────────

const LINE_CACHE = new Map<string, THREE.Vector3[]>()
function getLine(nodes: WebNode[], i: number, j: number): THREE.Vector3[] {
  const key = `${Math.min(i,j)}-${Math.max(i,j)}`
  if (!LINE_CACHE.has(key)) LINE_CACHE.set(key, buildOrganicLine(nodes[i].position, nodes[j].position))
  return LINE_CACHE.get(key)!
}

// ─── Single animated web line ──────────────────────────────────────────────────

function WebLine({ points, color, drawProgress, opacity }: {
  points: THREE.Vector3[]; color: string; drawProgress: number; opacity: number
}) {
  if (opacity < 0.01 || drawProgress < 0.01) return null
  const count = Math.max(2, Math.floor(points.length * drawProgress))
  const sliced = points.slice(0, count)
  const positions = new Float32Array(sliced.flatMap(p => [p.x, p.y, p.z]))
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1.5} />
    </line>
  )
}

// ─── Product node ──────────────────────────────────────────────────────────────

function ProductNode({ node, product, onActivate, globalOpacity }: {
  node: WebNode; product: VistaraProduct
  onActivate: () => void; globalOpacity: number
}) {
  const coreRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const t = useRef(0)

  const baseGlow = node.isActive ? 1 : node.glowIntensity
  const coreOpacity = baseGlow * globalOpacity * 0.9
  const glowOpacity = baseGlow * globalOpacity * 0.35

  useFrame((_, delta) => {
    t.current += delta
    if (!coreRef.current || !glowRef.current) return

    if (node.isActive) {
      const pulse = 1 + Math.sin(t.current * 2.2) * 0.12
      coreRef.current.scale.setScalar(pulse)
      glowRef.current.scale.setScalar(pulse * 2.4)
      if (ringRef.current) {
        ringRef.current.rotation.z += delta * 0.6
        ringRef.current.rotation.x += delta * 0.3
      }
    } else {
      const breathe = 1 + node.glowIntensity * Math.sin(t.current * 1.1) * 0.06
      coreRef.current.scale.setScalar(breathe)
      glowRef.current.scale.setScalar(breathe * 1.9)
    }
  })

  if (coreOpacity < 0.02 && !node.isActive) return null

  return (
    <group position={node.position}>
      {/* Core */}
      <mesh ref={coreRef} onClick={onActivate}>
        <sphereGeometry args={[NODE_RADIUS, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={coreOpacity} />
      </mesh>

      {/* Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[NODE_GLOW_RADIUS, 12, 12]} />
        <meshBasicMaterial
          color={node.isActive ? '#c026d3' : '#7b2fff'}
          transparent opacity={glowOpacity}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Active ring */}
      {node.isActive && (
        <mesh ref={ringRef}>
          <torusGeometry args={[NODE_RADIUS * 2.2, 0.4, 6, 40]} />
          <meshBasicMaterial color="#c026d3" transparent opacity={0.55 * globalOpacity} wireframe />
        </mesh>
      )}

      {/* Outer pulse ring when active */}
      {node.isActive && (
        <mesh>
          <torusGeometry args={[NODE_RADIUS * 3.5, 0.2, 6, 40]} />
          <meshBasicMaterial color="#7b2fff" transparent
            opacity={(0.2 + 0.15 * Math.sin(Date.now() * 0.003)) * globalOpacity} />
        </mesh>
      )}

      {/* HTML label — projects to screen correctly via drei */}
      <Html
        center
        distanceFactor={120}
        style={{ pointerEvents: node.isActive ? 'none' : 'all' }}
        occlude={false}
      >
        <div
          onClick={onActivate}
          style={{
            cursor: 'pointer',
            textAlign: 'center',
            opacity: Math.max(node.glowIntensity, node.isActive ? 1 : 0) * globalOpacity,
            transition: 'opacity 0.4s ease',
            userSelect: 'none',
            transform: 'translateY(28px)',
          }}
        >
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: '11px',
            letterSpacing: '0.25em',
            color: node.isActive ? 'rgba(255,200,220,0.95)' : 'rgba(255,255,255,0.8)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            textShadow: node.isActive ? '0 0 12px rgba(192,38,211,0.8)' : 'none',
          }}>
            {product.name}
          </div>
          <div style={{
            fontFamily: 'system-ui',
            fontSize: '8px',
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            marginTop: '3px',
            whiteSpace: 'nowrap',
          }}>
            {product.tagline}
          </div>
        </div>
      </Html>

      {/* Invisible click platform — larger than node, easier to tap */}
      <mesh onClick={onActivate}>
        <boxGeometry args={[NODE_RADIUS * 5, NODE_RADIUS * 5, NODE_RADIUS * 2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

// ─── Peripheral glow — nodes just outside frame cast edge light ────────────────

function PeripheralGlow({ nodes, camera, globalOpacity }: {
  nodes: WebNode[]; camera: THREE.Camera; globalOpacity: number
}) {
  // This is a CSS overlay — rendered in HTML layer, not Three.js
  return null // handled in HTML layer below
}

// ─── Camera controller ─────────────────────────────────────────────────────────

interface CameraState {
  scrollT: number           // 0–1 scroll progress
  dragX: number             // accumulated drag rotation X
  dragY: number             // accumulated drag rotation Y
  dwellNodeIdx: number | null
  isDwelling: boolean
}

function CameraRig({ scrollT, dragX, dragY, nodes, onDwellNode }: {
  scrollT: number; dragX: number; dragY: number
  nodes: WebNode[]; onDwellNode: (idx: number | null) => void
}) {
  const { camera } = useThree()
  const currentDragX = useRef(0)
  const currentDragY = useRef(0)
  const lastDwellIdx = useRef<number | null>(null)
  const dwellTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useFrame(() => {
    // Smooth drag
    currentDragX.current += (dragX * 0.006 - currentDragX.current) * 0.07
    currentDragY.current += (dragY * 0.003 - currentDragY.current) * 0.07

    // Ease scroll
    const eased = scrollT < 0.5
      ? 2 * scrollT * scrollT
      : 1 - Math.pow(-2 * scrollT + 2, 2) / 2

    // Camera position: entry → cave
    const basePos = new THREE.Vector3().lerpVectors(CAMERA_ENTRY, CAMERA_CAVE, eased)
    const baseLook = new THREE.Vector3().lerpVectors(CAMERA_ENTRY_LOOK, CAMERA_CAVE_LOOK, eased)

    // Apply drag offset
    basePos.x += Math.sin(currentDragX.current) * 50
    basePos.y += Math.sin(currentDragY.current) * 25
    baseLook.x += Math.sin(currentDragX.current) * 35

    camera.position.lerp(basePos, 0.05)
    camera.lookAt(baseLook)

    // Detect which product node is nearest — trigger dwell
    const camZ = camera.position.z
    const productNodes = nodes.filter(n => n.productIndex >= 0)

    let closestIdx: number | null = null
    let closestDist = Infinity

    nodes.forEach((node, i) => {
      if (node.productIndex < 0) return
      // Distance in Z — how close is camera to this node's depth
      const zDist = Math.abs(camZ - node.position.z - NODE_APPROACH_DIST)
      // Also check X/Y proximity in screen space (rough)
      const screenDist = Math.sqrt(
        Math.pow(camera.position.x - node.position.x, 2) +
        Math.pow(camera.position.y - node.position.y, 2)
      )
      const totalDist = zDist + screenDist * 0.3
      if (totalDist < 80 && totalDist < closestDist) {
        closestDist = totalDist
        closestIdx = i
      }
    })

    if (closestIdx !== lastDwellIdx.current) {
      lastDwellIdx.current = closestIdx
      onDwellNode(closestIdx)
    }
  })

  return null
}

// ─── Neural system — runs currents, signal waves, node glow ───────────────────

function NeuralSystem({
  nodes, setNodes,
  lines, setLines,
  currents, setCurrents,
  signalWave, setSignalWave,
  systemState,
}: {
  nodes: WebNode[]
  setNodes: (fn: (prev: WebNode[]) => WebNode[]) => void
  lines: Map<string, LineState>
  setLines: (fn: (prev: Map<string, LineState>) => Map<string, LineState>) => void
  currents: ActiveCurrent[]
  setCurrents: (fn: (prev: ActiveCurrent[]) => ActiveCurrent[]) => void
  signalWave: SignalWave | null
  setSignalWave: (s: SignalWave | null) => void
  systemState: SystemState
}) {
  const nodesRef = useRef(nodes)
  const linesRef = useRef(lines)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { linesRef.current = lines }, [lines])

  const lastAmbientSpawn = useRef(0)
  const ambientInterval = useRef(700 + Math.random() * 1100)
  const waveLastStep = useRef(0)

  useFrame((_, delta) => {
    const now = performance.now()
    const ns = nodesRef.current

    // ── Spawn ambient currents ──────────────────────────────────────────────
    if (systemState === 'ambient' || systemState === 'user-active') {
      const maxCurrents = systemState === 'user-active' ? 3 : 1
      const activeCurrents = currents.filter(c => c.progress < 1 || c.pathRemaining.length > 0)
      if (activeCurrents.length < maxCurrents && now - lastAmbientSpawn.current > ambientInterval.current) {
        const newCurrents = spawnAmbientCurrent(ns)
        if (newCurrents.length > 0) {
          setCurrents(prev => [...prev.filter(c => c.pathRemaining.length > 0 || c.progress < 1), ...newCurrents])
          lastAmbientSpawn.current = now
          ambientInterval.current = systemState === 'user-active'
            ? 300 + Math.random() * 500
            : 600 + Math.random() * 1200
        }
      }
    }

    // ── Advance currents ────────────────────────────────────────────────────
    setCurrents(prevCurrents => {
      const nextCurrents: ActiveCurrent[] = []
      const newLines = new Map(linesRef.current)

      for (const curr of prevCurrents) {
        const fromNode = ns[curr.fromIdx]
        const toNode = ns[curr.toIdx]
        if (!fromNode || !toNode) continue

        const lineKey = `${Math.min(curr.fromIdx, curr.toIdx)}-${Math.max(curr.fromIdx, curr.toIdx)}`
        const pts = getLine(ns, curr.fromIdx, curr.toIdx)
        const dist = fromNode.position.distanceTo(toNode.position)
        const newProgress = curr.progress + (delta * curr.speed) / Math.max(dist, 1)

        newLines.set(lineKey, {
          points: pts,
          color: curr.color,
          drawProgress: Math.min(newProgress, 1),
          opacity: 0.75,
          fadeAt: newProgress >= 1 ? now + 800 : Infinity,
        })

        if (newProgress >= 1) {
          // Reached toIdx — light it up if it's a product node
          if (toNode.productIndex >= 0 && !toNode.isDormant && !toNode.isActive) {
            setNodes(prev => prev.map((n, i) =>
              i === curr.toIdx ? { ...n, glowIntensity: 1 } : n
            ))
            setTimeout(() => {
              setNodes(prev => prev.map((n, i) =>
                i === curr.toIdx && !n.isActive ? { ...n, glowIntensity: 0 } : n
              ))
            }, 1800 + Math.random() * 800)
          }

          // Move to next segment
          if (curr.pathRemaining.length > 0) {
            nextCurrents.push({
              ...curr,
              fromIdx: curr.toIdx,
              toIdx: curr.pathRemaining[0],
              progress: 0,
              pathRemaining: curr.pathRemaining.slice(1),
            })
          }
          // else current is done — don't add back
        } else {
          nextCurrents.push({ ...curr, progress: newProgress })
        }
      }

      // Fade out expired lines
      const cleanLines = new Map<string, LineState>()
      newLines.forEach((line, key) => {
        if (line.fadeAt === Infinity || now < line.fadeAt) {
          cleanLines.set(key, line)
        } else {
          const fadeProgress = (now - line.fadeAt) / 600
          if (fadeProgress < 1) {
            cleanLines.set(key, { ...line, opacity: 0.75 * (1 - fadeProgress) })
          }
          // else fully faded — drop it
        }
      })

      setLines(() => cleanLines)
      return nextCurrents
    })

    // ── Signal wave propagation ─────────────────────────────────────────────
    if (signalWave && now - waveLastStep.current > 80) {
      waveLastStep.current = now
      const nextFrontier: number[] = []

      for (const nodeIdx of signalWave.frontier) {
        for (const neighbor of ns[nodeIdx].connections) {
          if (!signalWave.reachedSet.has(neighbor)) {
            signalWave.reachedSet.add(neighbor)
            nextFrontier.push(neighbor)

            // Draw signal line
            const lineKey = `${Math.min(nodeIdx, neighbor)}-${Math.max(nodeIdx, neighbor)}`
            const pts = getLine(ns, nodeIdx, neighbor)
            setLines(prev => new Map(prev).set(lineKey, {
              points: pts,
              color: signalWave.color,
              drawProgress: 1,
              opacity: 0.8,
              fadeAt: now + 500,
            }))

            // Apply wave effect to node
            if (ns[neighbor].productIndex >= 0) {
              if (signalWave.type === 'sleep') {
                setNodes(prev => prev.map((n, i) =>
                  i === neighbor && !n.isActive
                    ? { ...n, glowIntensity: 0.4, isDormant: true }
                    : n
                ))
                setTimeout(() => {
                  setNodes(prev => prev.map((n, i) =>
                    i === neighbor ? { ...n, glowIntensity: 0 } : n
                  ))
                }, 300 + Math.random() * 200)
              } else {
                setNodes(prev => prev.map((n, i) =>
                  i === neighbor
                    ? { ...n, isDormant: false, glowIntensity: 0.15 }
                    : n
                ))
              }
            }
          }
        }
      }

      if (nextFrontier.length === 0) {
        setSignalWave(null)
      } else {
        setSignalWave({ ...signalWave, frontier: nextFrontier })
      }
    }
  })

  return null
}

// ─── Main Vistara scene ────────────────────────────────────────────────────────

function VistaraScene({
  nodes, lines, currents, signalWave, systemState,
  setNodes, setLines, setCurrents, setSignalWave,
  globalOpacity, onNodeActivate, activeNodeIdx,
  scrollT, dragX, dragY, onDwellNode,
}: {
  nodes: WebNode[]; lines: Map<string, LineState>
  currents: ActiveCurrent[]; signalWave: SignalWave | null
  systemState: SystemState
  setNodes: (fn: (prev: WebNode[]) => WebNode[]) => void
  setLines: (fn: (prev: Map<string, LineState>) => Map<string, LineState>) => void
  setCurrents: (fn: (prev: ActiveCurrent[]) => ActiveCurrent[]) => void
  setSignalWave: (s: SignalWave | null) => void
  globalOpacity: number; onNodeActivate: (idx: number) => void
  activeNodeIdx: number | null; scrollT: number
  dragX: number; dragY: number; onDwellNode: (idx: number | null) => void
}) {
  const handleNodeClick = useCallback((idx: number) => {
    const wave = createSignalWave(idx, 'sleep')
    setSignalWave(wave)
    setNodes(prev => prev.map((n, i) => ({
      ...n,
      isActive: i === idx,
      isDormant: i !== idx && n.productIndex >= 0 ? true : n.isDormant,
      glowIntensity: i === idx ? 1 : n.glowIntensity,
    })))
    onNodeActivate(idx)
  }, [setSignalWave, setNodes, onNodeActivate])

  return (
    <>
      <CameraRig
        scrollT={scrollT} dragX={dragX} dragY={dragY}
        nodes={nodes} onDwellNode={onDwellNode}
      />

      <NeuralSystem
        nodes={nodes} setNodes={setNodes}
        lines={lines} setLines={setLines}
        currents={currents} setCurrents={setCurrents}
        signalWave={signalWave} setSignalWave={setSignalWave}
        systemState={systemState}
      />

      {/* Web lines */}
      {Array.from(lines.entries()).map(([key, line]) => (
        <WebLine
          key={key}
          points={line.points}
          color={line.color}
          drawProgress={line.drawProgress}
          opacity={line.opacity * globalOpacity}
        />
      ))}

      {/* Product nodes */}
      {nodes.map((node, i) => {
        if (node.productIndex < 0) return null
        const product = VISTARA_PRODUCTS[node.productIndex]
        return (
          <ProductNode
            key={i}
            node={node}
            product={product}
            onActivate={() => handleNodeClick(i)}
            globalOpacity={globalOpacity}
          />
        )
      })}
    </>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function VistaraVoid({ onBack }: { onBack?: () => void }) {
  const [nodes, setNodes] = useState<WebNode[]>(() => buildWebNodes())
  const [lines, setLines] = useState<Map<string, LineState>>(new Map())
  const [currents, setCurrents] = useState<ActiveCurrent[]>([])
  const [signalWave, setSignalWave] = useState<SignalWave | null>(null)
  const [systemState, setSystemState] = useState<SystemState>('ambient')
  const [activeNodeIdx, setActiveNodeIdx] = useState<number | null>(null)
  const [openProduct, setOpenProduct] = useState<VistaraProduct | null>(null)
  const [globalOpacity, setGlobalOpacity] = useState(1)
  const [scrollT, setScrollT] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [dwellNodeIdx, setDwellNodeIdx] = useState<number | null>(null)
  const [inCave, setInCave] = useState(false)

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDragging = useRef(false)
  const lastDrag = useRef({ x: 0, y: 0 })
  const dragAccum = useRef({ x: 0, y: 0 })
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dwellActive = useRef(false)

  // ── Inactivity timer ────────────────────────────────────────────────────────
  const scheduleInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    const delay = INACTIVITY_MIN_MS + Math.random() * (INACTIVITY_MAX_MS - INACTIVITY_MIN_MS)
    inactivityTimer.current = setTimeout(() => {
      setGlobalOpacity(0)
      setTimeout(() => {
        setActiveNodeIdx(null)
        setOpenProduct(null)
        setNodes(prev => prev.map(n => ({ ...n, isActive: false, isDormant: false, glowIntensity: 0 })))
        setSystemState('black')
        setTimeout(() => {
          setSystemState('ambient')
          setGlobalOpacity(1)
          scheduleInactivity()
        }, BLACK_PAUSE_MS)
      }, FADE_OUT_MS)
    }, delay)
  }, [])

  useEffect(() => {
    scheduleInactivity()
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current) }
  }, [scheduleInactivity])

  // ── Scroll ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setScrollT(prev => Math.min(Math.max(prev + e.deltaY / SCROLL_DEPTH_PX, 0), 1))
      // Entering cave
      setInCave(prev => scrollT > 0.4 ? true : prev)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [scrollT])

  // ── Drag ────────────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true
    lastDrag.current = { x: e.clientX, y: e.clientY }
    setSystemState(s => s === 'ambient' ? 'user-active' : s)
    scheduleInactivity()
  }, [scheduleInactivity])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    dragAccum.current.x += e.clientX - lastDrag.current.x
    dragAccum.current.y += e.clientY - lastDrag.current.y
    lastDrag.current = { x: e.clientX, y: e.clientY }
    setDragX(dragAccum.current.x)
    setDragY(dragAccum.current.y)
  }, [])

  const onPointerUp = useCallback(() => { isDragging.current = false }, [])

  // ── Touch ───────────────────────────────────────────────────────────────────
  const touchStart = useRef({ x: 0, y: 0 })
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    isDragging.current = true
    lastDrag.current = touchStart.current
    scheduleInactivity()
  }, [scheduleInactivity])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    const dx = e.touches[0].clientX - lastDrag.current.x
    const dy = e.touches[0].clientY - lastDrag.current.y
    dragAccum.current.x += dx
    dragAccum.current.y += dy
    lastDrag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setDragX(dragAccum.current.x)
    setDragY(dragAccum.current.y)
  }, [])

  const onTouchEnd = useCallback(() => { isDragging.current = false }, [])

  // ── Dwell ───────────────────────────────────────────────────────────────────
  const handleDwellNode = useCallback((idx: number | null) => {
    if (dwellTimer.current) clearTimeout(dwellTimer.current)
    setDwellNodeIdx(idx)
    if (idx !== null && !dwellActive.current) {
      dwellActive.current = true
      // Camera halts here for NODE_DWELL_MS — handled by CameraRig's lerp slowing
      dwellTimer.current = setTimeout(() => {
        dwellActive.current = false
      }, NODE_DWELL_MS)
    }
  }, [])

  // ── Node activation ─────────────────────────────────────────────────────────
  const handleNodeActivate = useCallback((idx: number) => {
    setActiveNodeIdx(idx)
    setOpenProduct(VISTARA_PRODUCTS[idx])
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    setSystemState('node-locked')
    scheduleInactivity()
  }, [scheduleInactivity])

  // ── Panel close ─────────────────────────────────────────────────────────────
  const handlePanelClose = useCallback(() => {
    setOpenProduct(null)
    const wakeWave = createSignalWave(activeNodeIdx ?? 0, 'wake')
    setSignalWave(wakeWave)
    setNodes(prev => prev.map(n => ({
      ...n, isActive: false, isDormant: false,
    })))
    setActiveNodeIdx(null)
    setSystemState('user-active')
    scheduleInactivity()
  }, [activeNodeIdx, scheduleInactivity])

  const isBlack = systemState === 'black'

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => {
        if (systemState === 'ambient') {
          setSystemState('user-active')
          scheduleInactivity()
        }
      }}
    >
      {/* Three.js canvas */}
      <motion.div
        animate={{ opacity: globalOpacity }}
        transition={{ duration: FADE_OUT_MS / 1000, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {!isBlack && (
          <Canvas
            camera={{ position: [0, 20, 180], fov: 65, near: 0.5, far: 2000 }}
            style={{ position: 'absolute', inset: 0 }}
            gl={{ antialias: true, alpha: false }}
          >
            <VistaraScene
              nodes={nodes} lines={lines}
              currents={currents} signalWave={signalWave}
              systemState={systemState}
              setNodes={setNodes} setLines={setLines}
              setCurrents={setCurrents} setSignalWave={setSignalWave}
              globalOpacity={globalOpacity}
              onNodeActivate={handleNodeActivate}
              activeNodeIdx={activeNodeIdx}
              scrollT={scrollT} dragX={dragX} dragY={dragY}
              onDwellNode={handleDwellNode}
            />
          </Canvas>
        )}
      </motion.div>

      {/* Peripheral glow — nodes outside frame cast edge light */}
      <PeripheralEdgeGlow nodes={nodes} activeNodeIdx={activeNodeIdx} />

      {/* Dwell indicator */}
      <AnimatePresence>
        {dwellNodeIdx !== null && !openProduct && (
          <motion.div
            key={dwellNodeIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'fixed',
              bottom: '12%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <div style={{
              fontFamily: 'system-ui',
              fontSize: '9px',
              letterSpacing: '0.28em',
              color: 'rgba(255,255,255,0.25)',
              textTransform: 'uppercase',
            }}>
              Tap to enter · {VISTARA_PRODUCTS[nodes[dwellNodeIdx]?.productIndex]?.name ?? ''}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cave hint */}
      <AnimatePresence>
        {inCave && !openProduct && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            style={{
              position: 'fixed', bottom: '5%', left: '50%',
              transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none',
            }}
          >
            <p style={{ fontFamily: 'system-ui', fontSize: '9px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase' }}>
              Drag to navigate
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product glass panel */}
      <AnimatePresence>
        {openProduct && (
          <ProductPanel product={openProduct} onClose={handlePanelClose} />
        )}
      </AnimatePresence>

      {/* Back button */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          onClick={onBack}
          style={{
            position: 'fixed', top: '22px', left: '22px', zIndex: 100,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '7px 14px',
            color: 'rgba(255,255,255,0.3)', fontSize: '10px',
            letterSpacing: '0.2em', textTransform: 'uppercase',
            fontFamily: 'system-ui', cursor: 'pointer',
          }}
        >
          ← Śūnya
        </motion.button>
      )}

      {/* VISTĀRA wordmark */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        style={{
          position: 'fixed', top: '22px', right: '22px', zIndex: 20,
          pointerEvents: 'none', textAlign: 'right',
        }}
      >
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.35em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
          Vistāra
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '8px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginTop: '3px' }}>
          The Manifestations
        </div>
      </motion.div>
    </div>
  )
}

// ─── Peripheral edge glow ──────────────────────────────────────────────────────
// Nodes outside the camera frustum cast a faint glow at the nearest screen edge

function PeripheralEdgeGlow({ nodes, activeNodeIdx }: {
  nodes: WebNode[]; activeNodeIdx: number | null
}) {
  // CSS radial gradients at screen edges for off-camera node hints
  const glowingNodes = nodes.filter(n =>
    n.productIndex >= 0 && (n.glowIntensity > 0.1 || n.isActive)
  )

  if (glowingNodes.length === 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {/* Subtle edge glows — cycle through positions */}
      {[
        { pos: '0 50%', dir: 'to right' },
        { pos: '100% 50%', dir: 'to left' },
        { pos: '50% 0', dir: 'to bottom' },
        { pos: '50% 100%', dir: 'to top' },
      ].map((edge, i) => (
        <motion.div
          key={i}
          animate={{
            opacity: [0, 0.04, 0, 0.03, 0],
          }}
          transition={{
            duration: 4 + i * 1.5,
            repeat: Infinity,
            delay: i * 1.2,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 30% 20% at ${edge.pos}, #7b2fff 0%, transparent 100%)`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Product glass panel ───────────────────────────────────────────────────────

function ProductPanel({ product, onClose }: {
  product: VistaraProduct; onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: '480px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px', backdropFilter: 'blur(24px)',
          padding: '36px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', marginBottom: '8px' }}>
              {product.name}
            </h2>
            <p style={{ fontFamily: 'system-ui', fontSize: '10px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
              {product.tagline}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontFamily: 'system-ui' }}>✕</button>
        </div>

        <p style={{ fontFamily: 'system-ui', fontSize: '14px', lineHeight: '1.75', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.02em', marginBottom: '28px' }}>
          {product.description}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'system-ui', cursor: 'pointer' }}>
            Learn More
          </button>
          <button style={{ padding: '12px 20px', background: 'rgba(123,47,255,0.18)', border: '1px solid rgba(123,47,255,0.3)', borderRadius: '10px', color: 'rgba(200,160,255,0.9)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'system-ui', cursor: 'pointer' }}>
            Engage
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
