'use client'

import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// ─── Scene parameters ─────────────────────────────────────────────────────────

const CAM_R        = 32
const DRIFT_SPD    = 0.016      // rad/s base
const CHANGE_MIN   = 9          // seconds between drift direction shifts
const CHANGE_MAX   = 22
const FLY_DUR      = 2.5        // seconds for camera fly-to
const PARTICLE_CNT = 2200
const BG_RECT_CNT  = 80

// ─── Easing ───────────────────────────────────────────────────────────────────

function eioC(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ─── Major rect definitions ───────────────────────────────────────────────────

interface MajorDef {
  id: number
  pos: [number, number, number]
  w: number
  h: number
  label: string
  app: string
  rotX: number
  rotY: number
}

const MAJOR_DEFS: MajorDef[] = [
  { id: 0, pos: [  0,   0,   0], w: 14, h:  9.5, label: 'NEXUS',  app: 'Dashboard', rotX:  0.00, rotY:  0.00 },
  { id: 1, pos: [ 22,   5, -14], w: 11, h:  7.5, label: 'AXIS',   app: 'Analytics', rotX:  0.06, rotY: -0.28 },
  { id: 2, pos: [-20,  -4, -10], w: 12, h:  8.0, label: 'VERTEX', app: 'Commerce',  rotX: -0.05, rotY:  0.22 },
  { id: 3, pos: [  9, -11, -22], w:  9, h:  6.5, label: 'PRISM',  app: 'Creator',   rotX:  0.08, rotY: -0.18 },
  { id: 4, pos: [-14,   9, -28], w: 10, h:  7.0, label: 'ORBIT',  app: 'Network',   rotX: -0.04, rotY:  0.30 },
  { id: 5, pos: [ 28,  -7, -32], w: 12, h:  8.0, label: 'ZENITH', app: 'Studio',    rotX:  0.06, rotY: -0.25 },
  { id: 6, pos: [-10,  14, -42], w: 11, h:  8.0, label: 'APEX',   app: 'Research',  rotX: -0.08, rotY:  0.15 },
]

// ─── Geometry builders ────────────────────────────────────────────────────────

function makeRectGeo(w: number, h: number): THREE.BufferGeometry {
  const hw = w / 2, hh = h / 2
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -hw, -hh, 0,  hw, -hh, 0,
     hw, -hh, 0,  hw,  hh, 0,
     hw,  hh, 0, -hw,  hh, 0,
    -hw,  hh, 0, -hw, -hh, 0,
  ]), 3))
  return g
}

// 4 corner L-brackets as paired line segments
function makeCornerGeo(w: number, h: number, f: number): THREE.BufferGeometry {
  const hw = w / 2, hh = h / 2, L = Math.min(w, h) * f
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -hw + L, -hh, 0, -hw, -hh, 0,   -hw, -hh, 0, -hw, -hh + L, 0,  // BL
     hw - L, -hh, 0,  hw, -hh, 0,    hw, -hh, 0,  hw, -hh + L, 0,  // BR
     hw - L,  hh, 0,  hw,  hh, 0,    hw,  hh, 0,  hw,  hh - L, 0,  // TR
    -hw + L,  hh, 0, -hw,  hh, 0,   -hw,  hh, 0, -hw,  hh - L, 0,  // TL
  ]), 3))
  return g
}

// ─── Background wireframe rectangles ─────────────────────────────────────────

interface BgItem {
  key: number
  pos: [number, number, number]
  rx: number; ry: number; rz: number
  op: number
  geo: THREE.BufferGeometry
}

function BackgroundRects() {
  const items = useMemo<BgItem[]>(() => {
    const rng = (a: number, b: number) => a + Math.random() * (b - a)
    const base: BgItem[] = Array.from({ length: BG_RECT_CNT }, (_, i) => {
      const w = rng(0.6, 11), h = rng(0.5, 8.5)
      return {
        key: i,
        pos: [rng(-62, 62), rng(-40, 40), -4 - rng(0, 88)] as [number, number, number],
        rx: rng(-0.85, 0.85), ry: rng(-1.1, 1.1), rz: rng(-0.4, 0.4),
        op: rng(0.04, 0.28),
        geo: makeRectGeo(w, h),
      }
    })

    // Add 10 nested rect pairs at similar positions for depth layering
    const nested: BgItem[] = []
    for (let i = 0; i < 10; i++) {
      const cx = rng(-48, 48), cy = rng(-30, 30), cz = -6 - rng(0, 65)
      const rx = rng(-0.3, 0.3), ry = rng(-0.45, 0.45), rz = rng(-0.18, 0.18)
      const w = rng(3, 10), h = rng(2.5, 7.5)
      const ws = rng(0.42, 0.70), hs = rng(0.42, 0.70)
      nested.push(
        { key: BG_RECT_CNT + i * 2,     pos: [cx, cy, cz],                          rx, ry, rz, op: rng(0.14, 0.32), geo: makeRectGeo(w, h) },
        { key: BG_RECT_CNT + i * 2 + 1, pos: [cx + rng(-0.3, 0.3), cy + rng(-0.3, 0.3), cz + rng(-0.6, 0.6)], rx, ry, rz, op: rng(0.10, 0.24), geo: makeRectGeo(w * ws, h * hs) },
      )
    }

    return [...base, ...nested]
  }, [])

  return (
    <>
      {items.map(r => (
        <lineSegments key={r.key} geometry={r.geo}
          position={r.pos} rotation={[r.rx, r.ry, r.rz]}>
          <lineBasicMaterial color="#ffffff" transparent opacity={r.op} depthWrite={false} />
        </lineSegments>
      ))}
    </>
  )
}

// ─── Particle cloud ───────────────────────────────────────────────────────────

function Particles() {
  const geo = useMemo(() => {
    const pos = new Float32Array(PARTICLE_CNT * 3)
    for (let i = 0; i < PARTICLE_CNT; i++) {
      pos[i * 3    ] = (Math.random() - 0.5) * 140
      pos[i * 3 + 1] = (Math.random() - 0.5) * 95
      pos[i * 3 + 2] = (Math.random() - 0.5) * 115 - 10
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  return (
    <points geometry={geo}>
      <pointsMaterial color="#c8d8ff" size={0.07} sizeAttenuation
        transparent opacity={0.45} depthWrite={false} />
    </points>
  )
}

// ─── Depth grid (perspective floor) ──────────────────────────────────────────

function DepthGrid() {
  const geo = useMemo(() => {
    const pts: number[] = []
    const S = 62, step = 14, y = -25
    for (let x = -S; x <= S; x += step) pts.push(x, y, -S, x, y, S)
    for (let z = -S; z <= S; z += step) pts.push(-S, y, z, S, y, z)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
    return g
  }, [])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#0c1d3a" transparent opacity={0.55} />
    </lineSegments>
  )
}

// ─── Major rect ───────────────────────────────────────────────────────────────

function MajorRect({ def, focused, onClick }: {
  def: MajorDef
  focused: boolean
  onClick: () => void
}) {
  const frameGeo  = useMemo(() => makeRectGeo(def.w, def.h),         [def.w, def.h])
  const cornerGeo = useMemo(() => makeCornerGeo(def.w, def.h, 0.13), [def.w, def.h])
  const frameMat  = useRef<THREE.LineBasicMaterial>(null!)
  const cornerMat = useRef<THREE.LineBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!frameMat.current || !cornerMat.current) return
    const tgtF = focused ? 0.92 : 0.55
    frameMat.current.opacity  += (tgtF - frameMat.current.opacity)  * 0.08
    const tgtC = focused ? 0.80 + 0.20 * Math.abs(Math.sin(t * 3.5)) : 0.38
    cornerMat.current.opacity += (tgtC - cornerMat.current.opacity) * 0.08
  })

  const panelWidth = Math.round(def.w * 44)

  return (
    <group position={def.pos} rotation={[def.rotX, def.rotY, 0]}>
      {/* Frame */}
      <lineSegments geometry={frameGeo}>
        <lineBasicMaterial ref={frameMat} color="#c4d4f8" transparent opacity={0.55} />
      </lineSegments>

      {/* Corner brackets */}
      <lineSegments geometry={cornerGeo}>
        <lineBasicMaterial ref={cornerMat} color="#dde8ff" transparent opacity={0.38} />
      </lineSegments>

      {/* Invisible clickable surface */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick() }}>
        <planeGeometry args={[def.w, def.h]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Label — always faces camera (no transform) */}
      <Html
        position={[0, def.h / 2 + 0.65, 0]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          color: '#96aee0',
          fontSize: '10px',
          letterSpacing: '0.44em',
          fontFamily: 'ui-monospace, "Cascadia Code", monospace',
          whiteSpace: 'nowrap',
          opacity: focused ? 1 : 0.45,
          transition: 'opacity 0.5s',
          textShadow: focused ? '0 0 16px rgba(148,176,255,0.9)' : 'none',
        }}>
          {def.label}
        </div>
      </Html>

      {/* App panel — placed in 3D space inside the rect */}
      {focused && (
        <Html
          position={[0, 0, 0.1]}
          center
          transform
          style={{ width: `${panelWidth}px`, pointerEvents: 'auto' }}
        >
          <div style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid rgba(148,176,255,0.20)',
            background: 'rgba(2,5,18,0.90)',
            padding: '22px 24px',
            fontFamily: 'ui-monospace, "Cascadia Code", monospace',
            color: '#96aee0',
          }}>
            <div style={{
              fontSize: '8px', letterSpacing: '0.48em',
              opacity: 0.35, marginBottom: 8,
            }}>
              MODULE · {def.label}
            </div>
            <div style={{
              fontSize: '22px', letterSpacing: '0.16em',
              marginBottom: 16, color: '#c4d4f8',
            }}>
              {def.app.toUpperCase()}
            </div>
            <div style={{
              fontSize: '10px', lineHeight: 1.8, opacity: 0.32,
            }}>
              Interface layer active.<br />
              Application integration pending.
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Camera controller ────────────────────────────────────────────────────────

interface FlyState {
  fromPos:  THREE.Vector3
  toPos:    THREE.Vector3
  fromLook: THREE.Vector3
  toLook:   THREE.Vector3
  elapsed:  number
  dur:      number
}

function CameraController({ focusDef }: { focusDef: MajorDef | null }) {
  const { camera } = useThree()

  // Start at theta=π/2, phi=π/2 → [0, 0, CAM_R] — matches Canvas initial camera
  const sphereRef  = useRef({ theta: Math.PI / 2, phi: Math.PI / 2 })
  const velRef     = useRef({ dTheta: DRIFT_SPD, dPhi: DRIFT_SPD * 0.28 })
  const nextChgRef = useRef(CHANGE_MIN + Math.random() * (CHANGE_MAX - CHANGE_MIN))
  const elapsedRef = useRef(0)
  const flyRef     = useRef<FlyState | null>(null)
  const prevFocRef = useRef<MajorDef | null>(null)

  useFrame((_, delta) => {
    elapsedRef.current += delta

    // Focus changed → begin fly animation
    if (focusDef !== prevFocRef.current) {
      prevFocRef.current = focusDef

      if (focusDef) {
        const lookTarget = new THREE.Vector3(...focusDef.pos)
        const normal = new THREE.Vector3(0, 0, 1)
          .applyEuler(new THREE.Euler(focusDef.rotX, focusDef.rotY, 0))
        const dist = Math.max(focusDef.w, focusDef.h) * 1.2 + 5
        flyRef.current = {
          fromPos:  camera.position.clone(),
          toPos:    lookTarget.clone().addScaledVector(normal, dist),
          fromLook: new THREE.Vector3(0, 0, 0),
          toLook:   lookTarget.clone(),
          elapsed:  0,
          dur:      FLY_DUR,
        }
      } else {
        // Unfocus — re-sync drift sphere to current camera position so orbit resumes smoothly
        const { x, y, z } = camera.position
        const r = camera.position.length()
        sphereRef.current = {
          phi:   Math.acos(Math.max(-1, Math.min(1, y / r))),
          theta: Math.atan2(z, x),
        }
        flyRef.current = null
      }
    }

    // Fly in progress
    if (flyRef.current) {
      const fly = flyRef.current
      fly.elapsed += delta
      const p  = Math.min(fly.elapsed / fly.dur, 1)
      const ep = eioC(p)
      camera.position.lerpVectors(fly.fromPos, fly.toPos, ep)
      camera.lookAt(new THREE.Vector3().lerpVectors(fly.fromLook, fly.toLook, ep))
      if (p >= 1) flyRef.current = null
      return
    }

    // Focused & fly done — hold position, face the rect
    if (focusDef) {
      camera.lookAt(...focusDef.pos)
      return
    }

    // ── Free drift ────────────────────────────────────────────────────────────

    // Change direction periodically
    if (elapsedRef.current >= nextChgRef.current) {
      const spd = DRIFT_SPD * (0.45 + Math.random() * 1.1)
      velRef.current = {
        dTheta: (Math.random() < 0.5 ? 1 : -1) * spd * (0.55 + Math.random() * 0.9),
        dPhi:   (Math.random() < 0.5 ? 1 : -1) * spd * 0.28,
      }
      nextChgRef.current = elapsedRef.current + CHANGE_MIN + Math.random() * (CHANGE_MAX - CHANGE_MIN)
    }

    const { theta, phi } = sphereRef.current
    const { dTheta, dPhi } = velRef.current
    const newTheta = theta + dTheta * delta
    const newPhi   = Math.max(0.25, Math.min(Math.PI - 0.25, phi + dPhi * delta))
    sphereRef.current = { theta: newTheta, phi: newPhi }

    camera.position.set(
      CAM_R * Math.sin(newPhi) * Math.cos(newTheta),
      CAM_R * Math.cos(newPhi),
      CAM_R * Math.sin(newPhi) * Math.sin(newTheta),
    )
    camera.lookAt(0, 0, 0)
  })

  return null
}

// ─── Scene root ───────────────────────────────────────────────────────────────

function QuantumScene() {
  const [focusId, setFocusId] = useState<number | null>(null)
  const focusDef = focusId !== null
    ? (MAJOR_DEFS.find(d => d.id === focusId) ?? null)
    : null

  return (
    <>
      <color attach="background" args={['#020509']} />
      <fog   attach="fog"        args={['#020509', 52, 145]} />
      <CameraController focusDef={focusDef} />
      <BackgroundRects />
      <Particles />
      <DepthGrid />
      {MAJOR_DEFS.map(def => (
        <MajorRect
          key={def.id}
          def={def}
          focused={focusId === def.id}
          onClick={() => setFocusId(p => p === def.id ? null : def.id)}
        />
      ))}
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export function QuantumGrid({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#020509' }}>
      <Canvas
        camera={{ position: [0, 0, CAM_R], fov: 62, near: 0.5, far: 200 }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <QuantumScene />
        </Suspense>
      </Canvas>

      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: 'fixed', top: 24, left: 24, zIndex: 10,
            background: 'transparent',
            border: '1px solid rgba(148,176,255,0.28)',
            color: '#7890c8', padding: '8px 18px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '10px', letterSpacing: '0.38em',
            cursor: 'pointer', outline: 'none',
          }}
        >
          ← BACK
        </button>
      )}

      <div style={{
        position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(148,176,255,0.25)', fontSize: '9px',
        letterSpacing: '0.42em', fontFamily: 'ui-monospace, monospace',
        pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
      }}>
        CLICK A FRAME TO FOCUS · CLICK AGAIN TO RELEASE
      </div>
    </div>
  )
}
