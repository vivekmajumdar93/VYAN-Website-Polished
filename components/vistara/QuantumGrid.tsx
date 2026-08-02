'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { GATEWAYS, type Gateway } from '@/lib/vistara/gateways'

// ─── Scene parameters ─────────────────────────────────────────────────────────

const CAM_R        = 32
const DRIFT_SPD    = 0.016
const CHANGE_MIN   = 9
const CHANGE_MAX   = 22
const FLY_DUR      = 2.5
const PARTICLE_CNT = 2200
const BG_RECT_CNT  = 80

function eioC(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const N = GATEWAYS.length

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

function makeCornerGeo(w: number, h: number, f: number): THREE.BufferGeometry {
  const hw = w / 2, hh = h / 2, L = Math.min(w, h) * f
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -hw + L, -hh, 0, -hw, -hh, 0,   -hw, -hh, 0, -hw, -hh + L, 0,
     hw - L, -hh, 0,  hw, -hh, 0,    hw, -hh, 0,  hw, -hh + L, 0,
     hw - L,  hh, 0,  hw,  hh, 0,    hw,  hh, 0,  hw,  hh - L, 0,
    -hw + L,  hh, 0, -hw,  hh, 0,   -hw,  hh, 0, -hw,  hh - L, 0,
  ]), 3))
  return g
}

// ─── Background rects ─────────────────────────────────────────────────────────

interface BgItem {
  key: number; pos: [number, number, number]
  rx: number; ry: number; rz: number; op: number
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
        op: rng(0.04, 0.26),
        geo: makeRectGeo(w, h),
      }
    })
    const nested: BgItem[] = []
    for (let i = 0; i < 10; i++) {
      const cx = rng(-48, 48), cy = rng(-30, 30), cz = -6 - rng(0, 65)
      const rx = rng(-0.3, 0.3), ry = rng(-0.45, 0.45), rz = rng(-0.18, 0.18)
      const w = rng(3, 10), h = rng(2.5, 7.5)
      const ws = rng(0.42, 0.70), hs = rng(0.42, 0.70)
      nested.push(
        { key: BG_RECT_CNT + i * 2,     pos: [cx, cy, cz],                                                         rx, ry, rz, op: rng(0.14, 0.32), geo: makeRectGeo(w, h) },
        { key: BG_RECT_CNT + i * 2 + 1, pos: [cx + rng(-0.3, 0.3), cy + rng(-0.3, 0.3), cz + rng(-0.6, 0.6)],     rx, ry, rz, op: rng(0.10, 0.24), geo: makeRectGeo(w * ws, h * hs) },
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

// ─── Particles ────────────────────────────────────────────────────────────────

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
      <pointsMaterial color="#c8d8ff" size={0.07} sizeAttenuation transparent opacity={0.45} depthWrite={false} />
    </points>
  )
}

// ─── Depth grid ───────────────────────────────────────────────────────────────

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
  def: Gateway; focused: boolean; onClick: () => void
}) {
  const frameGeo  = useMemo(() => makeRectGeo(def.w, def.h),         [def.w, def.h])
  const cornerGeo = useMemo(() => makeCornerGeo(def.w, def.h, 0.13), [def.w, def.h])
  const frameMat  = useRef<THREE.LineBasicMaterial>(null!)
  const cornerMat = useRef<THREE.LineBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!frameMat.current || !cornerMat.current) return
    const tgtF = focused ? 0.92 : 0.52
    frameMat.current.opacity  += (tgtF - frameMat.current.opacity)  * 0.08
    const tgtC = focused ? 0.80 + 0.20 * Math.abs(Math.sin(t * 3.5)) : 0.36
    cornerMat.current.opacity += (tgtC - cornerMat.current.opacity) * 0.08
  })

  return (
    <group position={def.pos} rotation={[def.rotX, def.rotY, 0]}>
      <lineSegments geometry={frameGeo}>
        <lineBasicMaterial ref={frameMat} color="#ffffff" transparent opacity={0.48} />
      </lineSegments>
      <lineSegments geometry={cornerGeo}>
        <lineBasicMaterial ref={cornerMat} color="#1a40ff" transparent opacity={0.32} />
      </lineSegments>

      {/* Invisible hit surface */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick() }}>
        <planeGeometry args={[def.w, def.h]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Label — always faces camera */}
      <Html position={[0, def.h / 2 + 0.65, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          color: focused ? '#1a40ff' : 'rgba(26,64,255,0.38)',
          fontSize: '11px', letterSpacing: '0.44em',
          fontFamily: 'var(--font-vyan)', whiteSpace: 'nowrap',
          opacity: focused ? 1 : 0.7, transition: 'opacity 0.5s, color 0.5s',
          textShadow: focused ? '0 0 22px rgba(26,64,255,0.7)' : 'none',
        }}>
          {def.name.toUpperCase()}
        </div>
      </Html>

      {/* App panel */}
      {focused && (
        <Html position={[0, 0, 0.1]} center transform
          style={{ width: `${Math.round(def.w * 44)}px`, pointerEvents: 'auto' }}>
          <div style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid rgba(26,64,255,0.18)',
            borderLeft: '2px solid rgba(26,64,255,0.55)',
            background: 'rgba(2,3,10,0.94)',
            padding: '22px 24px',
            fontFamily: 'var(--font-vyan)',
          }}>
            <div style={{ fontSize: '8px', letterSpacing: '0.55em', color: 'rgba(26,64,255,0.35)', marginBottom: 6 }}>
              VYAN GATEWAY
            </div>
            <div style={{ fontSize: '28px', letterSpacing: '0.06em', marginBottom: 4, color: '#1a40ff' }}>
              {def.name}
            </div>
            <div style={{ fontSize: '9px', letterSpacing: '0.36em', color: 'rgba(26,64,255,0.55)', marginBottom: 14 }}>
              {def.tantra}
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.6, marginBottom: 12, color: 'rgba(255,255,255,0.75)' }}>
              {def.tagline}
            </div>
            <div style={{ fontSize: '10px', lineHeight: 1.8, color: 'rgba(255,255,255,0.32)' }}>
              {def.description}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Camera controller ────────────────────────────────────────────────────────

interface FlyState {
  fromPos: THREE.Vector3; toPos: THREE.Vector3
  fromLook: THREE.Vector3; toLook: THREE.Vector3
  elapsed: number; dur: number
}

function CameraController({ focusDef }: { focusDef: Gateway | null }) {
  const { camera } = useThree()
  const sphereRef  = useRef({ theta: Math.PI / 2, phi: Math.PI / 2 })
  const velRef     = useRef({ dTheta: DRIFT_SPD, dPhi: DRIFT_SPD * 0.28 })
  const nextChgRef = useRef(CHANGE_MIN + Math.random() * (CHANGE_MAX - CHANGE_MIN))
  const elapsedRef = useRef(0)
  const flyRef     = useRef<FlyState | null>(null)
  const prevFocRef = useRef<Gateway | null>(null)

  useFrame((_, delta) => {
    elapsedRef.current += delta

    if (focusDef !== prevFocRef.current) {
      prevFocRef.current = focusDef
      if (focusDef) {
        const lookTarget = new THREE.Vector3(...focusDef.pos)
        const normal = new THREE.Vector3(0, 0, 1)
          .applyEuler(new THREE.Euler(focusDef.rotX, focusDef.rotY, 0))
        const dist = Math.max(focusDef.w, focusDef.h) * 1.2 + 5
        flyRef.current = {
          fromPos: camera.position.clone(),
          toPos: lookTarget.clone().addScaledVector(normal, dist),
          fromLook: new THREE.Vector3(0, 0, 0),
          toLook: lookTarget.clone(),
          elapsed: 0, dur: FLY_DUR,
        }
      } else {
        const { x, y, z } = camera.position
        const r = camera.position.length()
        sphereRef.current = {
          phi:   Math.acos(Math.max(-1, Math.min(1, y / r))),
          theta: Math.atan2(z, x),
        }
        flyRef.current = null
      }
    }

    if (flyRef.current) {
      const fly = flyRef.current
      fly.elapsed += delta
      const p = Math.min(fly.elapsed / fly.dur, 1)
      const ep = eioC(p)
      camera.position.lerpVectors(fly.fromPos, fly.toPos, ep)
      camera.lookAt(new THREE.Vector3().lerpVectors(fly.fromLook, fly.toLook, ep))
      if (p >= 1) flyRef.current = null
      return
    }

    if (focusDef) {
      camera.lookAt(...focusDef.pos)
      return
    }

    // Free drift
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

// ─── Scene ────────────────────────────────────────────────────────────────────

function QuantumScene({ focusId, focusDef, setFocusId }: {
  focusId: number | null
  focusDef: Gateway | null
  setFocusId: (id: number | null) => void
}) {
  return (
    <>
      <color attach="background" args={['#020509']} />
      <fog   attach="fog"        args={['#020509', 52, 145]} />
      <CameraController focusDef={focusDef} />
      <BackgroundRects />
      <Particles />
      <DepthGrid />
      {GATEWAYS.map((def, idx) => (
        <MajorRect key={def.id} def={def}
          focused={focusId === idx}
          onClick={() => setFocusId(focusId === idx ? null : idx)} />
      ))}
    </>
  )
}

// ─── Nav button ───────────────────────────────────────────────────────────────

function NavBtn({ onClick, children, style }: {
  onClick: () => void; children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent',
      border: '1px solid rgba(26,64,255,0.22)',
      color: 'rgba(26,64,255,0.55)', width: 44, height: 44,
      fontFamily: 'var(--font-vyan)',
      fontSize: '20px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'border-color 0.2s, color 0.2s',
      outline: 'none',
      ...style,
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,64,255,0.6)'; (e.currentTarget as HTMLElement).style.color = '#1a40ff' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,64,255,0.22)'; (e.currentTarget as HTMLElement).style.color = 'rgba(26,64,255,0.55)' }}
    >
      {children}
    </button>
  )
}

// ─── QuantumGrid ─────────────────────────────────────────────────────────────

export function QuantumGrid({ onBack }: { onBack?: () => void }) {
  const [focusId, setFocusId] = useState<number | null>(null)
  const focusDef = focusId !== null ? (GATEWAYS[focusId] ?? null) : null

  const goNext = useCallback(() =>
    setFocusId(p => p === null ? 0 : (p + 1) % N), [])
  const goPrev = useCallback(() =>
    setFocusId(p => p === null ? N - 1 : (p - 1 + N) % N), [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev() }
      if (e.key === 'Escape')     setFocusId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // Scroll + touch navigation with shared cooldown
  const navCooldown = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (navCooldown.current) return
      if (Math.abs(e.deltaY) < 20) return
      navCooldown.current = true
      setTimeout(() => { navCooldown.current = false }, 700)
      if (e.deltaY > 0) goNext(); else goPrev()
    }

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return
      const dx = touchStartX.current - e.changedTouches[0].clientX
      touchStartX.current = null
      if (Math.abs(dx) < 40) return   // too short, ignore
      if (navCooldown.current) return
      navCooldown.current = true
      setTimeout(() => { navCooldown.current = false }, 700)
      if (dx > 0) goNext(); else goPrev()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [goNext, goPrev])

  const currentDef = focusDef

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#020509' }}>
      <Canvas
        camera={{ position: [0, 0, CAM_R], fov: 62, near: 0.5, far: 200 }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <QuantumScene focusId={focusId} focusDef={focusDef} setFocusId={setFocusId} />
        </Suspense>
      </Canvas>

      {/* Back button */}
      {onBack && (
        <button onClick={onBack} style={{
          position: 'fixed', top: 24, left: 24, zIndex: 10,
          background: 'transparent', border: '1px solid rgba(26,64,255,0.25)',
          color: 'rgba(26,64,255,0.55)', padding: '8px 18px',
          fontFamily: 'var(--font-vyan)',
          fontSize: '11px', letterSpacing: '0.38em', cursor: 'pointer', outline: 'none',
        }}>
          ← BACK
        </button>
      )}

      {/* Left / Right nav arrows */}
      <div style={{
        position: 'fixed', left: 24, top: '50%', transform: 'translateY(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <NavBtn onClick={goPrev}>‹</NavBtn>
      </div>
      <div style={{
        position: 'fixed', right: 24, top: '50%', transform: 'translateY(-50%)',
        zIndex: 10,
      }}>
        <NavBtn onClick={goNext}>›</NavBtn>
      </div>

      {/* Counter + name strip */}
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        pointerEvents: 'none', userSelect: 'none',
      }}>
        {currentDef && (
          <div style={{
            color: '#1a40ff', fontSize: '10px', letterSpacing: '0.44em',
            fontFamily: 'var(--font-vyan)', opacity: 0.8,
          }}>
            {currentDef.tantra}
          </div>
        )}
        {/* Dot indicator */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {GATEWAYS.map((d, idx) => (
            <div key={d.id} style={{
              width: focusId === idx ? 18 : 5,
              height: 2,
              background: focusId === idx ? '#1a40ff' : 'rgba(26,64,255,0.20)',
              transition: 'width 0.3s, background 0.3s',
              borderRadius: 1,
            }} />
          ))}
        </div>
        <div style={{
          color: 'rgba(26,64,255,0.22)', fontSize: '9px',
          letterSpacing: '0.42em', fontFamily: 'var(--font-vyan)',
          marginTop: 2,
        }}>
          {focusId !== null
            ? `${focusId + 1} / ${N} · ESC TO RELEASE`
            : 'SCROLL OR ‹ › TO NAVIGATE · CLICK TO FOCUS'}
        </div>
      </div>
    </div>
  )
}
