'use client'

import {
  useRef, useState, useEffect, useCallback, useMemo,
} from 'react'
import type {
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
  MutableRefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import {
  VISTARA_PRODUCTS,
  CAMERA_ENTRY, CAMERA_ENTRY_LOOK,
  CAMERA_CAVE, CAMERA_CAVE_LOOK,
  SCROLL_DEPTH_PX, NODE_DWELL_MS, NODE_APPROACH_DIST,
  NODE_RADIUS,
  INACTIVITY_MIN_MS, INACTIVITY_MAX_MS,
  FADE_OUT_MS, BLACK_PAUSE_MS,
  CURRENT_COLORS,
} from '@/lib/vistara/config'
import {
  buildWebNodes, buildOrganicLine,
  spawnAmbientCurrent, createSignalWave,
  type WebNode, type ActiveCurrent, type LineState, type SignalWave,
} from '@/lib/vistara/neural'
import type { VistaraProduct } from '@/lib/vistara/config'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SystemState = 'ambient' | 'user-active' | 'node-locked' | 'fading' | 'black'

// ─── Line cache — built once per connection pair ───────────────────────────────

const LINE_CACHE = new Map<string, THREE.Vector3[]>()
function getLine(nodes: WebNode[], i: number, j: number): THREE.Vector3[] {
  const key = `${Math.min(i,j)}-${Math.max(i,j)}`
  if (!LINE_CACHE.has(key)) LINE_CACHE.set(key, buildOrganicLine(nodes[i].position, nodes[j].position))
  return LINE_CACHE.get(key)!
}

// ─── Starfield ──────────────────────────────────────────────────────────────────
// Dense static field of small glowing points filling the cave. Built once —
// no per-frame allocation. A slow rotation keeps it from feeling flat.

const STAR_COUNT = 4200

// Soft radial-gradient sprite — round glowing dots instead of hard squares.
function makeStarTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

function Starfield() {
  const pointsRef = useRef<THREE.Points>(null)
  const starTexture = useMemo(() => makeStarTexture(), [])

  const [positions, colors] = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3)
    const colors = new Float32Array(STAR_COUNT * 3)
    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1400
      positions[i * 3 + 1] = (Math.random() - 0.5) * 900
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1000 - 150
      const b = 0.35 + Math.random() * 0.65
      colors[i * 3] = b
      colors[i * 3 + 1] = b
      colors[i * 3 + 2] = Math.min(1, b + 0.12)
    }
    return [positions, colors]
  }, [])

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.002
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={starTexture}
        size={2.2}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ─── Persistent neural web ──────────────────────────────────────────────────────
// Every connection in the web is drawn once as a faint static thread, using the
// same curves the active currents travel along — built once into a single
// LineSegments geometry (one draw call, never updated).

function PersistentWeb({ nodesRef }: { nodesRef: MutableRefObject<WebNode[]> }) {
  const positions = useMemo(() => {
    const ns = nodesRef.current
    const seen = new Set<string>()
    const verts: number[] = []

    ns.forEach((node, i) => {
      node.connections.forEach(j => {
        const key = `${Math.min(i, j)}-${Math.max(i, j)}`
        if (seen.has(key)) return
        seen.add(key)

        const pts = getLine(ns, i, j)
        for (let p = 0; p < pts.length - 1; p++) {
          verts.push(pts[p].x, pts[p].y, pts[p].z, pts[p + 1].x, pts[p + 1].y, pts[p + 1].z)
        }
      })
    })

    return new Float32Array(verts)
  }, [nodesRef])

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#8a7bff" transparent opacity={0.12} />
    </lineSegments>
  )
}

// ─── Bloom layer ──────────────────────────────────────────────────────────────
// Adds the neon glow on top of nodes/currents/stars. Takes over rendering via
// a positive useFrame priority (r3f then skips its own render call).

function BloomLayer() {
  const { gl, scene, camera, size } = useThree()

  const composer = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.65, 0.5, 0.18)
    c.addPass(bloom)
    c.addPass(new OutputPass())
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setSize(size.width, size.height)
  }, [composer, size])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame(() => {
    composer.render()
  }, 1)

  return null
}

// ─── Persistent line pool ──────────────────────────────────────────────────────
// All web/current/signal lines are drawn from a fixed pool of pre-allocated
// THREE.Line objects whose geometry is mutated in place every frame — this
// avoids allocating new Float32Arrays / bufferGeometries (and the React
// re-renders that would come with state-driven JSX) at 60fps.

const LINE_POINTS = 33
const MAX_LINE_SLOTS = 18

function LinePool({ linesRef, globalOpacityRef }: {
  linesRef: MutableRefObject<Map<string, LineState>>
  globalOpacityRef: MutableRefObject<number>
}) {
  const slots = useMemo(() => Array.from({ length: MAX_LINE_SLOTS }, () => {
    const positions = new Float32Array(LINE_POINTS * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setDrawRange(0, 0)
    const material = new THREE.LineBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    })
    const line = new THREE.Line(geometry, material)
    line.visible = false
    line.frustumCulled = false
    return { line, geometry, material, positions }
  }), [])

  useFrame(() => {
    const entries = Array.from(linesRef.current.values())
    const globalOpacity = globalOpacityRef.current

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const line = entries[i]

      if (!line) {
        if (slot.line.visible) slot.line.visible = false
        continue
      }

      const count = Math.max(2, Math.min(LINE_POINTS, Math.floor(line.points.length * line.drawProgress)))

      for (let p = 0; p < count; p++) {
        const pt = line.points[p]
        slot.positions[p * 3] = pt.x
        slot.positions[p * 3 + 1] = pt.y
        slot.positions[p * 3 + 2] = pt.z
      }

      slot.geometry.setDrawRange(0, count)
      slot.geometry.attributes.position.needsUpdate = true
      slot.material.color.set(line.color)
      slot.material.opacity = line.opacity * globalOpacity
      slot.line.visible = slot.material.opacity > 0.01
    }
  })

  return (
    <>
      {slots.map((s, i) => <primitive key={i} object={s.line} />)}
    </>
  )
}

// ─── Product node ──────────────────────────────────────────────────────────────
// Reads live state from nodesRef every frame and mutates its own materials/
// meshes directly — never re-renders in response to glow/active/dormant changes.

function ProductNode({ nodesRef, index, product, onActivate, globalOpacityRef }: {
  nodesRef: MutableRefObject<WebNode[]>
  index: number
  product: VistaraProduct
  onActivate: () => void
  globalOpacityRef: MutableRefObject<number>
}) {
  const coreRef = useRef<THREE.Mesh>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const shellMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const ring1MatRef = useRef<THREE.MeshBasicMaterial>(null)
  const ring2MatRef = useRef<THREE.MeshBasicMaterial>(null)
  const pulseMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const t = useRef(0)

  const position = nodesRef.current[index].position
  const accent = CURRENT_COLORS[index % CURRENT_COLORS.length]

  useFrame((_, delta) => {
    t.current += delta

    const node = nodesRef.current[index]
    const globalOpacity = globalOpacityRef.current
    // Every node carries a steady ambient glow (gently breathing) so the web
    // reads as a constellation of live nodes, not dark dots that only light
    // up when a current happens to pass through.
    const ambient = 0.42 + Math.sin(t.current * 0.6 + index * 1.7) * 0.08
    const baseGlow = node.isActive ? 1 : Math.max(node.glowIntensity, ambient)

    if (coreMatRef.current) coreMatRef.current.opacity = baseGlow * globalOpacity
    if (shellMatRef.current) shellMatRef.current.opacity = (0.3 + baseGlow * 0.5) * globalOpacity
    if (ring1MatRef.current) ring1MatRef.current.opacity = (0.25 + baseGlow * 0.45) * globalOpacity
    if (ring2MatRef.current) ring2MatRef.current.opacity = (0.18 + baseGlow * 0.35) * globalOpacity

    // Slow independent rotation on each ring/shell — every node reads as a
    // small armillary instrument rather than a static glowing dot.
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.35
      ring1Ref.current.rotation.y += delta * 0.12
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += delta * 0.28
      ring2Ref.current.rotation.z += delta * 0.2
    }
    if (shellRef.current) shellRef.current.rotation.y += delta * 0.08

    if (coreRef.current) {
      const pulse = node.isActive
        ? 1 + Math.sin(t.current * 2.2) * 0.12
        : 1 + ambient * Math.sin(t.current * 1.1) * 0.06
      coreRef.current.scale.setScalar(pulse)
    }

    if (pulseMatRef.current) {
      pulseMatRef.current.opacity = node.isActive
        ? (0.2 + 0.15 * Math.sin(Date.now() * 0.003)) * globalOpacity
        : 0
    }

    if (labelRef.current) {
      const labelOpacity = Math.max(node.glowIntensity, node.isActive ? 1 : 0.45) * globalOpacity
      labelRef.current.style.opacity = String(labelOpacity)
      labelRef.current.style.pointerEvents = node.isActive ? 'none' : 'all'
    }
  })

  return (
    <group position={position}>
      {/* Core crystal */}
      <mesh ref={coreRef} onClick={onActivate}>
        <icosahedronGeometry args={[NODE_RADIUS * 0.8, 0]} />
        <meshBasicMaterial ref={coreMatRef} color="#ffffff" transparent opacity={0} />
      </mesh>

      {/* Faceted wireframe shell */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[NODE_RADIUS * 1.4, 0]} />
        <meshBasicMaterial ref={shellMatRef} color={accent} transparent opacity={0} wireframe />
      </mesh>

      {/* Orbital ring 1 — tilted */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[NODE_RADIUS * 2.2, 0.1, 6, 48]} />
        <meshBasicMaterial ref={ring1MatRef} color={accent} transparent opacity={0} />
      </mesh>

      {/* Orbital ring 2 — counter-tilted */}
      <mesh ref={ring2Ref} rotation={[0, 0, Math.PI / 2.4]}>
        <torusGeometry args={[NODE_RADIUS * 2.8, 0.08, 6, 48]} />
        <meshBasicMaterial ref={ring2MatRef} color="#ffffff" transparent opacity={0} />
      </mesh>

      {/* Outer pulse ring when active */}
      <mesh>
        <torusGeometry args={[NODE_RADIUS * 3.5, 0.2, 6, 40]} />
        <meshBasicMaterial ref={pulseMatRef} color={accent} transparent opacity={0} />
      </mesh>

      {/* HTML label — projects to screen correctly via drei */}
      <Html
        center
        distanceFactor={120}
        occlude={false}
      >
        <div
          ref={labelRef}
          onClick={onActivate}
          style={{
            cursor: 'pointer',
            textAlign: 'center',
            opacity: 0,
            transition: 'opacity 0.4s ease',
            userSelect: 'none',
            transform: 'translateY(28px)',
          }}
        >
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: '11px',
            letterSpacing: '0.25em',
            color: 'rgba(255,255,255,0.8)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
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

// ─── Camera controller ─────────────────────────────────────────────────────────

function CameraRig({ scrollRef, dragRef, nodesRef, onDwellNode }: {
  scrollRef: MutableRefObject<number>
  dragRef: MutableRefObject<{ x: number; y: number }>
  nodesRef: MutableRefObject<WebNode[]>
  onDwellNode: (idx: number | null) => void
}) {
  const { camera } = useThree()
  const currentDragX = useRef(0)
  const currentDragY = useRef(0)
  const lastDwellIdx = useRef<number | null>(null)

  useFrame(() => {
    const dragX = dragRef.current.x
    const dragY = dragRef.current.y
    const scrollT = scrollRef.current

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
    const nodes = nodesRef.current

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
// Mutates nodesRef/linesRef/currentsRef/signalWaveRef in place every frame.
// Deliberately does NOT call any React state setters here — that was the
// source of the 60fps full-tree re-render that caused the freeze/lag.

function NeuralSystem({
  nodesRef, linesRef, currentsRef, signalWaveRef, systemStateRef,
}: {
  nodesRef: MutableRefObject<WebNode[]>
  linesRef: MutableRefObject<Map<string, LineState>>
  currentsRef: MutableRefObject<ActiveCurrent[]>
  signalWaveRef: MutableRefObject<SignalWave | null>
  systemStateRef: MutableRefObject<SystemState>
}) {
  const lastAmbientSpawn = useRef(0)
  const ambientInterval = useRef(700 + Math.random() * 1100)
  const waveLastStep = useRef(0)

  useFrame((_, delta) => {
    const now = performance.now()
    const ns = nodesRef.current
    const systemState = systemStateRef.current

    // ── Spawn ambient currents ──────────────────────────────────────────────
    if (systemState === 'ambient' || systemState === 'user-active') {
      const maxCurrents = systemState === 'user-active' ? 4 : 2
      const activeCurrents = currentsRef.current.filter(c => c.progress < 1 || c.pathRemaining.length > 0)

      if (activeCurrents.length < maxCurrents && now - lastAmbientSpawn.current > ambientInterval.current) {
        const newCurrents = spawnAmbientCurrent(ns)

        if (newCurrents.length > 0) {
          currentsRef.current = [...activeCurrents, ...newCurrents]
          lastAmbientSpawn.current = now
          ambientInterval.current = systemState === 'user-active'
            ? 200 + Math.random() * 350
            : 350 + Math.random() * 700
        }
      }
    }

    // ── Advance currents ────────────────────────────────────────────────────
    const nextCurrents: ActiveCurrent[] = []

    for (const curr of currentsRef.current) {
      const fromNode = ns[curr.fromIdx]
      const toNode = ns[curr.toIdx]
      if (!fromNode || !toNode) continue

      const lineKey = `${Math.min(curr.fromIdx, curr.toIdx)}-${Math.max(curr.fromIdx, curr.toIdx)}`
      const pts = getLine(ns, curr.fromIdx, curr.toIdx)
      const dist = fromNode.position.distanceTo(toNode.position)
      const newProgress = curr.progress + (delta * curr.speed) / Math.max(dist, 1)

      linesRef.current.set(lineKey, {
        points: pts,
        color: curr.color,
        drawProgress: Math.min(newProgress, 1),
        opacity: 1,
        fadeAt: newProgress >= 1 ? now + 800 : Infinity,
      })

      if (newProgress >= 1) {
        // Reached toIdx — light it up if it's a product node
        if (toNode.productIndex >= 0 && !toNode.isDormant && !toNode.isActive) {
          toNode.glowIntensity = 1

          setTimeout(() => {
            const n = nodesRef.current[curr.toIdx]
            if (n && !n.isActive) n.glowIntensity = 0
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

    currentsRef.current = nextCurrents

    // ── Fade out expired lines ──────────────────────────────────────────────
    linesRef.current.forEach((line, key) => {
      if (line.fadeAt === Infinity || now < line.fadeAt) return

      const fadeProgress = (now - line.fadeAt) / 600

      if (fadeProgress < 1) {
        line.opacity = 0.75 * (1 - fadeProgress)
      } else {
        linesRef.current.delete(key)
      }
    })

    // ── Signal wave propagation ─────────────────────────────────────────────
    const wave = signalWaveRef.current

    if (wave && now - waveLastStep.current > 80) {
      waveLastStep.current = now
      const nextFrontier: number[] = []

      for (const nodeIdx of wave.frontier) {
        for (const neighbor of ns[nodeIdx].connections) {
          if (!wave.reachedSet.has(neighbor)) {
            wave.reachedSet.add(neighbor)
            nextFrontier.push(neighbor)

            // Draw signal line
            const lineKey = `${Math.min(nodeIdx, neighbor)}-${Math.max(nodeIdx, neighbor)}`
            const pts = getLine(ns, nodeIdx, neighbor)

            linesRef.current.set(lineKey, {
              points: pts,
              color: wave.color,
              drawProgress: 1,
              opacity: 0.8,
              fadeAt: now + 500,
            })

            // Apply wave effect to node
            const nb = ns[neighbor]
            if (nb.productIndex >= 0) {
              if (wave.type === 'sleep') {
                if (!nb.isActive) {
                  nb.glowIntensity = 0.4
                  nb.isDormant = true
                }

                setTimeout(() => {
                  const n = nodesRef.current[neighbor]
                  if (n) n.glowIntensity = 0
                }, 300 + Math.random() * 200)
              } else {
                nb.isDormant = false
                nb.glowIntensity = 0.15
              }
            }
          }
        }
      }

      if (nextFrontier.length === 0) {
        signalWaveRef.current = null
      } else {
        wave.frontier = nextFrontier
      }
    }
  })

  return null
}

// ─── Main Vistara scene ────────────────────────────────────────────────────────

function VistaraScene({
  nodesRef, linesRef, currentsRef, signalWaveRef, systemStateRef,
  globalOpacityRef, onNodeActivate,
  scrollRef, dragRef, onDwellNode,
}: {
  nodesRef: MutableRefObject<WebNode[]>
  linesRef: MutableRefObject<Map<string, LineState>>
  currentsRef: MutableRefObject<ActiveCurrent[]>
  signalWaveRef: MutableRefObject<SignalWave | null>
  systemStateRef: MutableRefObject<SystemState>
  globalOpacityRef: MutableRefObject<number>
  onNodeActivate: (idx: number) => void
  scrollRef: MutableRefObject<number>
  dragRef: MutableRefObject<{ x: number; y: number }>
  onDwellNode: (idx: number | null) => void
}) {
  const handleNodeClick = useCallback((idx: number) => {
    signalWaveRef.current = createSignalWave(idx, 'sleep')

    nodesRef.current.forEach((n, i) => {
      n.isActive = i === idx
      if (i !== idx && n.productIndex >= 0) n.isDormant = true
      if (i === idx) n.glowIntensity = 1
    })

    onNodeActivate(idx)
  }, [nodesRef, signalWaveRef, onNodeActivate])

  return (
    <>
      <CameraRig
        scrollRef={scrollRef} dragRef={dragRef}
        nodesRef={nodesRef} onDwellNode={onDwellNode}
      />

      <NeuralSystem
        nodesRef={nodesRef}
        linesRef={linesRef}
        currentsRef={currentsRef}
        signalWaveRef={signalWaveRef}
        systemStateRef={systemStateRef}
      />

      <Starfield />
      <PersistentWeb nodesRef={nodesRef} />

      <LinePool linesRef={linesRef} globalOpacityRef={globalOpacityRef} />
      <BloomLayer />

      {/* Product nodes */}
      {nodesRef.current.map((node, i) => {
        if (node.productIndex < 0) return null
        const product = VISTARA_PRODUCTS[node.productIndex]
        return (
          <ProductNode
            key={i}
            nodesRef={nodesRef}
            index={i}
            product={product}
            onActivate={() => handleNodeClick(i)}
            globalOpacityRef={globalOpacityRef}
          />
        )
      })}
    </>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function VistaraVoid({ onBack }: { onBack?: () => void }) {
  const nodesRef = useRef<WebNode[]>(buildWebNodes())
  const linesRef = useRef<Map<string, LineState>>(new Map())
  const currentsRef = useRef<ActiveCurrent[]>([])
  const signalWaveRef = useRef<SignalWave | null>(null)
  const systemStateRef = useRef<SystemState>('ambient')
  const globalOpacityRef = useRef(1)
  const activeNodeIdxRef = useRef<number | null>(null)
  const scrollRef = useRef(0)
  const dragRef = useRef({ x: 0, y: 0 })
  const dragAccum = useRef({ x: 0, y: 0 })
  const inCaveRef = useRef(false)

  const [openProduct, setOpenProduct] = useState<VistaraProduct | null>(null)
  const [globalOpacity, setGlobalOpacity] = useState(1)
  const [dwellNodeIdx, setDwellNodeIdx] = useState<number | null>(null)
  const [inCave, setInCave] = useState(false)
  const [isBlack, setIsBlack] = useState(false)

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDragging = useRef(false)
  const lastDrag = useRef({ x: 0, y: 0 })
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dwellActive = useRef(false)

  // ── Inactivity timer ────────────────────────────────────────────────────────
  const scheduleInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    const delay = INACTIVITY_MIN_MS + Math.random() * (INACTIVITY_MAX_MS - INACTIVITY_MIN_MS)

    inactivityTimer.current = setTimeout(() => {
      globalOpacityRef.current = 0
      setGlobalOpacity(0)

      setTimeout(() => {
        activeNodeIdxRef.current = null
        setOpenProduct(null)

        nodesRef.current.forEach(n => {
          n.isActive = false
          n.isDormant = false
          n.glowIntensity = 0
        })

        systemStateRef.current = 'black'
        setIsBlack(true)

        setTimeout(() => {
          systemStateRef.current = 'ambient'
          setIsBlack(false)
          globalOpacityRef.current = 1
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
      scrollRef.current = Math.min(Math.max(scrollRef.current + e.deltaY / SCROLL_DEPTH_PX, 0), 1)

      if (scrollRef.current > 0.4 && !inCaveRef.current) {
        inCaveRef.current = true
        setInCave(true)
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  // ── Drag ────────────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    isDragging.current = true
    lastDrag.current = { x: e.clientX, y: e.clientY }

    if (systemStateRef.current === 'ambient') systemStateRef.current = 'user-active'
    scheduleInactivity()
  }, [scheduleInactivity])

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!isDragging.current) return

    dragAccum.current.x += e.clientX - lastDrag.current.x
    dragAccum.current.y += e.clientY - lastDrag.current.y
    lastDrag.current = { x: e.clientX, y: e.clientY }

    dragRef.current = { x: dragAccum.current.x, y: dragAccum.current.y }
  }, [])

  const onPointerUp = useCallback(() => { isDragging.current = false }, [])

  // ── Touch ───────────────────────────────────────────────────────────────────
  const touchStart = useRef({ x: 0, y: 0 })

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    isDragging.current = true
    lastDrag.current = touchStart.current
    scheduleInactivity()
  }, [scheduleInactivity])

  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!isDragging.current) return

    const dx = e.touches[0].clientX - lastDrag.current.x
    const dy = e.touches[0].clientY - lastDrag.current.y
    dragAccum.current.x += dx
    dragAccum.current.y += dy
    lastDrag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }

    dragRef.current = { x: dragAccum.current.x, y: dragAccum.current.y }
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
    activeNodeIdxRef.current = idx
    setOpenProduct(VISTARA_PRODUCTS[idx])

    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    systemStateRef.current = 'node-locked'
    scheduleInactivity()
  }, [scheduleInactivity])

  // ── Panel close ─────────────────────────────────────────────────────────────
  const handlePanelClose = useCallback(() => {
    setOpenProduct(null)

    signalWaveRef.current = createSignalWave(activeNodeIdxRef.current ?? 0, 'wake')

    nodesRef.current.forEach(n => {
      n.isActive = false
      n.isDormant = false
    })

    activeNodeIdxRef.current = null
    systemStateRef.current = 'user-active'
    scheduleInactivity()
  }, [scheduleInactivity])

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
        if (systemStateRef.current === 'ambient') {
          systemStateRef.current = 'user-active'
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
            dpr={[1, 1.5]}
          >
            <VistaraScene
              nodesRef={nodesRef}
              linesRef={linesRef}
              currentsRef={currentsRef}
              signalWaveRef={signalWaveRef}
              systemStateRef={systemStateRef}
              globalOpacityRef={globalOpacityRef}
              onNodeActivate={handleNodeActivate}
              scrollRef={scrollRef} dragRef={dragRef}
              onDwellNode={handleDwellNode}
            />
          </Canvas>
        )}
      </motion.div>

      {/* Peripheral glow — soft edge pulses */}
      <PeripheralEdgeGlow />

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
              Tap to enter · {VISTARA_PRODUCTS[nodesRef.current[dwellNodeIdx]?.productIndex]?.name ?? ''}
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
        <button
          onClick={onBack}
          style={{
            position: 'fixed', bottom: '24px', left: '22px', zIndex: 100,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px', padding: '8px 16px',
            color: 'rgba(255,255,255,0.6)', fontSize: '10px',
            letterSpacing: '0.2em', textTransform: 'uppercase',
            fontFamily: 'system-ui', cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          ← Śūnya
        </button>
      )}

      {/* VISTĀRA wordmark */}
      <div
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
      </div>
    </div>
  )
}

// ─── Peripheral edge glow ──────────────────────────────────────────────────────
// Subtle, ever-present radial glow pulses at the screen edges.

function PeripheralEdgeGlow() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {[
        { pos: '0 50%' },
        { pos: '100% 50%' },
        { pos: '50% 0' },
        { pos: '50% 100%' },
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
