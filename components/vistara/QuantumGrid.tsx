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

function MajorRect({ def, focused, expOpen, onClick, onExperience }: {
  def: Gateway; focused: boolean; expOpen: boolean; onClick: () => void; onExperience: () => void
}) {
  const frameGeo  = useMemo(() => makeRectGeo(def.w, def.h),         [def.w, def.h])
  const cornerGeo = useMemo(() => makeCornerGeo(def.w, def.h, 0.13), [def.w, def.h])
  const frameMat  = useRef<THREE.LineBasicMaterial>(null!)
  const cornerMat = useRef<THREE.LineBasicMaterial>(null!)

  useFrame(() => {
    if (!frameMat.current || !cornerMat.current) return
    const tgtF = focused ? 0.88 : 0.38
    frameMat.current.opacity  += (tgtF - frameMat.current.opacity)  * 0.08
    const tgtC = focused ? 0.10 : 0.22
    cornerMat.current.opacity += (tgtC - cornerMat.current.opacity) * 0.08
  })

  return (
    <group position={def.pos} rotation={[def.rotX, def.rotY, 0]}>
      <lineSegments geometry={frameGeo}>
        <lineBasicMaterial ref={frameMat} color="#ffffff" transparent opacity={0.48} />
      </lineSegments>
      <lineSegments geometry={cornerGeo}>
        <lineBasicMaterial ref={cornerMat} color="#ff2a4a" transparent opacity={0.22} />
      </lineSegments>

      {/* Invisible hit surface */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick() }}>
        <planeGeometry args={[def.w, def.h]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Label — hidden when focused */}
      {!focused && (
        <Html position={[0, def.h / 2 + 0.65, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            color: 'rgba(255,42,74,0.16)',
            fontSize: '11px', letterSpacing: '0.44em',
            fontFamily: 'var(--font-vyan)', whiteSpace: 'nowrap',
          }}>
            {def.name.toUpperCase()}
          </div>
        </Html>
      )}

      {/* Focused glass panel — hidden when experience overlay is open */}
      {focused && !expOpen && (
        <Html position={[0, 0, 0.1]} center transform
          style={{ width: `${Math.round(def.w * 44)}px`, pointerEvents: 'auto' }}>
          <div className="qg-panel" style={{
            padding: '24px 20px 20px',
            fontFamily: 'var(--font-vyan)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 10,
            boxSizing: 'border-box', width: '100%',
          }}>
            <img src="/logo-symbol.png" alt="VYAN"
              style={{ width: 38, height: 38, objectFit: 'contain', opacity: 0.88 }} />
            <div style={{
              color: '#ff2a4a', fontSize: '26px', letterSpacing: '0.08em',
              textAlign: 'center', textShadow: '0 0 18px rgba(255,42,74,0.45)',
            }}>
              {def.name}
            </div>
            <div style={{
              color: 'rgba(255,42,74,0.42)', fontSize: '8px',
              letterSpacing: '0.5em', marginTop: -6,
            }}>
              {def.tantra}
            </div>
            <div style={{
              color: 'rgba(200,212,255,0.62)', fontSize: '11px',
              lineHeight: 1.72, textAlign: 'center', padding: '2px 6px',
            }}>
              {def.description || def.tagline || 'Coming soon.'}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onExperience() }}
              className="qg-exp-btn"
            >
              EXPERIENCE
            </button>
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

function QuantumScene({ focusId, focusDef, setFocusId, onExperience, expOpen }: {
  focusId: number | null
  focusDef: Gateway | null
  setFocusId: (id: number | null) => void
  onExperience: (idx: number) => void
  expOpen: boolean
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
          expOpen={expOpen}
          onClick={() => setFocusId(focusId === idx ? null : idx)}
          onExperience={() => onExperience(idx)} />
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
  const [focusId,    setFocusId]    = useState<number | null>(null)
  const [expId,      setExpId]      = useState<number | null>(null)
  const [expClosing, setExpClosing] = useState(false)
  const focusDef = focusId !== null ? (GATEWAYS[focusId] ?? null) : null
  const expDef   = expId   !== null ? (GATEWAYS[expId]   ?? null) : null
  // Ref so event-handler closures always see current expId without re-registering
  const expIdRef = useRef<number | null>(null)
  useEffect(() => { expIdRef.current = expId }, [expId])

  const closeExp = useCallback(() => {
    setExpClosing(true)
    setTimeout(() => { setExpId(null); setExpClosing(false) }, 520)
  }, [])

  // Inject animated glass + gradient border CSS once
  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'qg-styles'
    s.textContent = `
      @keyframes qg-border-travel {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes qg-slide-in-right {
        from { transform: translateX(110%); opacity: 0.4; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      @keyframes qg-slide-out-right {
        from { transform: translateX(0);    opacity: 1; }
        to   { transform: translateX(110%); opacity: 0.4; }
      }
      @keyframes qg-slide-in-left {
        from { transform: translateX(-110%); opacity: 0.4; }
        to   { transform: translateX(0);     opacity: 1; }
      }
      @keyframes qg-slide-out-left {
        from { transform: translateX(0);     opacity: 1; }
        to   { transform: translateX(-110%); opacity: 0.4; }
      }
      @keyframes qg-dim-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes qg-dim-out {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
      @keyframes qg-edge-travel {
        0%   { background-position: 0% 0%; }
        100% { background-position: 0% 100%; }
      }
      /* Gradient border via pseudo-element mask — interior punched out */
      .qg-panel {
        position: relative;
        background: rgba(4, 8, 48, 0.18);
        border-radius: 2px;
        isolation: isolate;
      }
      .qg-panel::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 2px;
        padding: 3px;
        background: linear-gradient(120deg, #1a40ff 0%, #6b25ff 25%, #9c2fff 50%, #6b25ff 75%, #1a40ff 100%);
        background-size: 400% 400%;
        animation: qg-border-travel 3s linear infinite;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: destination-out;
        mask-composite: exclude;
        z-index: -1;
      }
      /* Solid glass for DOM overlays — backdrop-filter works here */
      .qg-exp-glass {
        background: linear-gradient(160deg, rgba(4,8,52,0.94) 0%, rgba(2,4,32,0.90) 100%);
        backdrop-filter: blur(14px) saturate(130%);
        -webkit-backdrop-filter: blur(14px) saturate(130%);
      }
      /* Side panel container */
      .qg-side-panel {
        width: clamp(300px, 52vw, 900px);
        height: 100%;
        position: relative;
        flex-shrink: 0;
        overflow: hidden;
      }
      @media (max-width: 640px) {
        .qg-side-panel { width: 92vw; }
      }
      /* Animated gradient line on the inner edge */
      .qg-side-edge {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 3px;
        background: linear-gradient(
          to bottom,
          transparent 0%,
          #1a40ff 15%,
          #6b25ff 35%,
          #9c2fff 50%,
          #6b25ff 65%,
          #1a40ff 85%,
          transparent 100%
        );
        background-size: 100% 300%;
        animation: qg-edge-travel 2.8s ease-in-out infinite alternate;
        z-index: 10;
        pointer-events: none;
      }
      .qg-exp-btn {
        margin-top: 6px;
        border: 1px solid rgba(255,42,74,0.45);
        background: rgba(255,42,74,0.08);
        color: #ff2a4a;
        padding: 9px 28px;
        font-family: var(--font-vyan);
        font-size: 10px;
        letter-spacing: 0.42em;
        cursor: pointer;
        outline: none;
        transition: background 0.2s, border-color 0.2s;
      }
      .qg-exp-btn:hover {
        background: rgba(255,42,74,0.18);
        border-color: rgba(255,42,74,0.75);
      }
    `
    if (!document.getElementById('qg-styles')) document.head.appendChild(s)
    return () => { document.getElementById('qg-styles')?.remove() }
  }, [])

  const goNext = useCallback(() =>
    setFocusId(p => p === null ? 0 : (p + 1) % N), [])
  const goPrev = useCallback(() =>
    setFocusId(p => p === null ? N - 1 : (p - 1 + N) % N), [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (expIdRef.current !== null) {
        if (e.key === 'Escape') { e.preventDefault(); closeExp() }
        return
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev() }
      if (e.key === 'Escape')     setFocusId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, closeExp])

  // Scroll + touch navigation with shared cooldown
  const navCooldown = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (expIdRef.current !== null) return  // overlay open — block nav
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
      if (expIdRef.current !== null) return  // overlay open — block nav
      if (Math.abs(dx) < 40) return
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

  // Derive side panel animation values
  const isRight   = expDef ? expDef.pos[0] >= 0 : true
  const panelAnim = expDef
    ? expClosing
      ? `${isRight ? 'qg-slide-out-right' : 'qg-slide-out-left'} 0.50s cubic-bezier(0.4,0,0.8,0.85) both`
      : `${isRight ? 'qg-slide-in-right'  : 'qg-slide-in-left'}  0.65s cubic-bezier(0.16,1,0.3,1) both`
    : ''
  const dimAnim = expDef
    ? expClosing ? 'qg-dim-out 0.42s ease both' : 'qg-dim-in 0.38s ease both'
    : ''

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#020509' }}>
      <Canvas
        camera={{ position: [0, 0, CAM_R], fov: 62, near: 0.5, far: 200 }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <QuantumScene focusId={focusId} focusDef={focusDef} setFocusId={setFocusId}
            onExperience={(idx) => setExpId(idx)} expOpen={expId !== null} />
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
            color: '#ff2a4a', fontSize: '10px', letterSpacing: '0.44em',
            fontFamily: 'var(--font-vyan)', opacity: 0.7,
          }}>
            {currentDef.tantra}
          </div>
        )}
        {/* Dot indicator */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {GATEWAYS.map((_, idx) => (
            <div key={idx} style={{
              width: focusId === idx ? 18 : 5,
              height: 2,
              background: focusId === idx ? '#ff2a4a' : 'rgba(255,42,74,0.20)',
              transition: 'width 0.3s, background 0.3s',
              borderRadius: 1,
            }} />
          ))}
        </div>
        <div style={{
          color: 'rgba(255,42,74,0.22)', fontSize: '9px',
          letterSpacing: '0.42em', fontFamily: 'var(--font-vyan)',
          marginTop: 2,
        }}>
          {focusId !== null
            ? `${focusId + 1} / ${N} · ESC TO RELEASE`
            : 'SCROLL OR ‹ › TO NAVIGATE · CLICK TO FOCUS'}
        </div>
      </div>

      {/* ── Experience side panel ──────────────────────────────────────────── */}
      {expDef && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex',
          flexDirection: isRight ? 'row' : 'row-reverse',
        }}>
          {/* Dim backdrop — shows 3D scene through it, click to close */}
          <div
            onClick={closeExp}
            style={{
              flex: 1,
              background: 'rgba(0,2,14,0.68)',
              animation: dimAnim,
              cursor: 'pointer',
            }}
          />

          {/* Side panel */}
          <div className="qg-side-panel" style={{ animation: panelAnim }}>
            {/* Animated gradient line on the inner edge */}
            <div className="qg-side-edge" style={{
              [isRight ? 'left' : 'right']: 0,
            }} />

            {/* Glass fill */}
            <div className="qg-exp-glass" style={{
              width: '100%', height: '100%',
              boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>

              {/* Header */}
              <div style={{
                padding: '22px 28px 18px',
                borderBottom: '1px solid rgba(26,64,255,0.16)',
                flexShrink: 0,
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <img src="/logo-symbol.png" alt="VYAN"
                    style={{ width: 30, height: 30, objectFit: 'contain', opacity: 0.85, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      color: '#ff2a4a', fontFamily: 'var(--font-vyan)',
                      fontSize: '22px', letterSpacing: '0.08em',
                      textShadow: '0 0 20px rgba(255,42,74,0.40)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {expDef.name}
                    </div>
                    <div style={{
                      color: 'rgba(255,42,74,0.38)', fontFamily: 'var(--font-vyan)',
                      fontSize: '8px', letterSpacing: '0.52em', marginTop: 3,
                    }}>
                      {expDef.tantra}
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeExp}
                  style={{
                    background: 'none', border: '1px solid rgba(255,42,74,0.28)',
                    color: 'rgba(255,42,74,0.55)', fontSize: '15px',
                    cursor: 'pointer', fontFamily: 'var(--font-vyan)',
                    padding: '5px 9px', lineHeight: 1, flexShrink: 0,
                    transition: 'color 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLButtonElement
                    b.style.color = '#ff2a4a'; b.style.borderColor = 'rgba(255,42,74,0.65)'
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLButtonElement
                    b.style.color = 'rgba(255,42,74,0.55)'; b.style.borderColor = 'rgba(255,42,74,0.28)'
                  }}
                >✕</button>
              </div>

              {/* Tagline strip */}
              {expDef.tagline ? (
                <div style={{
                  padding: '10px 28px 9px',
                  flexShrink: 0,
                  color: 'rgba(180,200,255,0.32)',
                  fontFamily: 'var(--font-vyan)',
                  fontSize: '9px', letterSpacing: '0.30em',
                  borderBottom: '1px solid rgba(26,64,255,0.08)',
                  textTransform: 'uppercase',
                }}>
                  {expDef.tagline}
                </div>
              ) : null}

              {/* Content */}
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {expDef.appUrl ? (
                  <iframe
                    src={expDef.appUrl}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allow="fullscreen"
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 20,
                    fontFamily: 'var(--font-vyan)',
                  }}>
                    <img src="/logo-symbol.png" alt="VYAN"
                      style={{ width: 54, opacity: 0.20 }} />
                    <div style={{
                      color: '#ff2a4a', fontSize: '20px',
                      letterSpacing: '0.10em', opacity: 0.55,
                    }}>
                      {expDef.name}
                    </div>
                    <div style={{
                      color: 'rgba(190,205,255,0.28)',
                      fontSize: '10px', letterSpacing: '0.28em',
                      textAlign: 'center', maxWidth: 260, lineHeight: 2.0,
                      textTransform: 'uppercase',
                    }}>
                      {expDef.description || expDef.tagline || 'Experience coming soon.'}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
