'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { GATEWAYS, type Gateway } from '@/lib/vistara/gateways'

// ─── Scene parameters ─────────────────────────────────────────────────────────

const CAM_R        = 32
const FLY_DUR      = 2.5
// Overview orbit — sine-wave oscillation, constrained so every square stays in-frame.
// ±0.15 rad (≈ ±8.6°) keeps the widest square (Ojas at x=22) at 22° from frame-centre,
// well inside the 37.5° half-FOV.
const THETA_BASE   = Math.PI / 2
const THETA_RANGE  = 0.15          // horizontal swing amplitude (rad)
const PHI_BASE     = Math.PI / 2
const PHI_RANGE    = 0.06          // vertical bob amplitude (rad)
const THETA_SPD    = 0.042         // rad/s  → ~150 s full cycle
const PHI_SPD      = 0.031         // rad/s  → ~200 s full cycle
// Cursor/touch parallax — opposite direction, 1-2 cm max on screen.
// At CAM_R=32 with 75° FOV: 1 unit ≈ 39 px ≈ 0.4 cm, so 2.5 units ≈ 1 cm.
const LEAN_MAX     = 2.5
const LEAN_LERP    = 0.028
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

// ─── Scaled iframe ────────────────────────────────────────────────────────────
// Renders the embedded app at a tall "design height" and CSS-scales it down so
// the entire page fits the panel with zero panel-level scroll.
// The iframe viewport width = containerWidth / scale so content fills edge-to-edge.

const IFRAME_DESIGN_H = 900

function ScaledIframe({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ scale: 1, iframeW: 480 })

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      const scale = Math.min(height / IFRAME_DESIGN_H, 1)
      // iframeW: at this scale the iframe renders at iframeW px → appears as width px
      setFrame({ scale, iframeW: scale < 1 ? width / scale : width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: frame.iframeW,
        height: IFRAME_DESIGN_H,
        transform: `scale(${frame.scale})`,
        transformOrigin: 'top left',
      }}>
        <iframe
          src={src}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}

// ─── Background rects ─────────────────────────────────────────────────────────

// Muted palette for background rect wireframes — dark tones, low saturation
const BG_COLORS = [
  '#ffffff', '#ffffff', '#ffffff',  // white weighted heavier for contrast
  '#4466ff',  // deep blue
  '#7744ff',  // deep violet
  '#aa44ff',  // deep purple
  '#ff3355',  // dark crimson (brand family)
  '#22aacc',  // dark teal
  '#cc8800',  // dark amber
  '#44aa88',  // dark emerald
]

interface BgItem {
  key: number; pos: [number, number, number]
  rx: number; ry: number; rz: number; op: number
  color: string
  geo: THREE.BufferGeometry
}

function BackgroundRects() {
  const items = useMemo<BgItem[]>(() => {
    const rng  = (a: number, b: number) => a + Math.random() * (b - a)
    const pick = () => BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)]
    const base: BgItem[] = Array.from({ length: BG_RECT_CNT }, (_, i) => {
      const w = rng(0.6, 11), h = rng(0.5, 8.5)
      return {
        key: i,
        pos: [rng(-62, 62), rng(-40, 40), -4 - rng(0, 88)] as [number, number, number],
        rx: rng(-0.85, 0.85), ry: rng(-1.1, 1.1), rz: rng(-0.4, 0.4),
        op: rng(0.04, 0.26),
        color: pick(),
        geo: makeRectGeo(w, h),
      }
    })
    const nested: BgItem[] = []
    for (let i = 0; i < 10; i++) {
      const cx = rng(-48, 48), cy = rng(-30, 30), cz = -6 - rng(0, 65)
      const rx = rng(-0.3, 0.3), ry = rng(-0.45, 0.45), rz = rng(-0.18, 0.18)
      const w = rng(3, 10), h = rng(2.5, 7.5)
      const ws = rng(0.42, 0.70), hs = rng(0.42, 0.70)
      const c = pick()
      nested.push(
        { key: BG_RECT_CNT + i * 2,     pos: [cx, cy, cz],                                                         rx, ry, rz, op: rng(0.14, 0.32), color: c, geo: makeRectGeo(w, h) },
        { key: BG_RECT_CNT + i * 2 + 1, pos: [cx + rng(-0.3, 0.3), cy + rng(-0.3, 0.3), cz + rng(-0.6, 0.6)],     rx, ry, rz, op: rng(0.10, 0.24), color: c, geo: makeRectGeo(w * ws, h * hs) },
      )
    }
    return [...base, ...nested]
  }, [])

  return (
    <>
      {items.map(r => (
        <lineSegments key={r.key} geometry={r.geo}
          position={r.pos} rotation={[r.rx, r.ry, r.rz]}>
          <lineBasicMaterial color={r.color} transparent opacity={r.op} depthWrite={false} />
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
  const hoveredRef = useRef(false)
  const [isHov, setIsHov] = useState(false)

  useEffect(() => () => { document.body.style.cursor = '' }, [])

  useFrame(() => {
    if (!frameMat.current || !cornerMat.current) return
    const h = hoveredRef.current
    const tgtF = focused ? 0.92 : h ? 0.88 : 0.35
    frameMat.current.opacity  += (tgtF - frameMat.current.opacity)  * 0.09
    const tgtC = focused ? 0.12 : h ? 0.92 : 0.22
    cornerMat.current.opacity += (tgtC - cornerMat.current.opacity) * 0.09
  })

  return (
    <group position={def.pos} rotation={[def.rotX, def.rotY, 0]}>
      <lineSegments geometry={frameGeo}>
        <lineBasicMaterial ref={frameMat} color="#ffffff" transparent opacity={0.35} />
      </lineSegments>
      <lineSegments geometry={cornerGeo}>
        <lineBasicMaterial ref={cornerMat} color="#ff2a4a" transparent opacity={0.22} />
      </lineSegments>

      {/* Invisible hit surface */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerOver={(e) => {
          e.stopPropagation()
          hoveredRef.current = true
          setIsHov(true)
          document.body.style.cursor = 'pointer'
          if (frameMat.current)  frameMat.current.color.set(def.color)
          if (cornerMat.current) cornerMat.current.color.set(def.color)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          hoveredRef.current = false
          setIsHov(false)
          document.body.style.cursor = ''
          if (frameMat.current)  frameMat.current.color.set('#ffffff')
          if (cornerMat.current) cornerMat.current.color.set('#ff2a4a')
        }}
      >
        <planeGeometry args={[def.w, def.h]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Label — hidden when focused */}
      {!focused && (
        <Html position={[0, def.h / 2 + 0.65, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            color: isHov ? def.color : 'rgba(255,42,74,0.16)',
            fontSize: '11px', letterSpacing: '0.44em',
            fontFamily: 'var(--font-vyan)', whiteSpace: 'nowrap',
            textShadow: isHov ? `0 0 14px ${def.color}` : 'none',
            transition: 'color 0.25s, text-shadow 0.25s',
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
              color: 'rgba(255,42,74,0.72)', fontSize: '8px',
              letterSpacing: '0.5em', marginTop: -6,
            }}>
              {def.tantra}
            </div>
            <div style={{
              color: 'rgba(210,222,255,0.90)', fontSize: '11px',
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
  const { camera }   = useThree()
  const flyRef       = useRef<FlyState | null>(null)
  const prevFocRef   = useRef<Gateway | null>(null)
  const focusBasePos = useRef(new THREE.Vector3(0, 1, CAM_R))
  const elapsedRef   = useRef(0)
  const leanX        = useRef(0)
  const leanY        = useRef(0)

  // Compute the current orbit position (always valid — used for fly-back target too)
  const orbitPos = (t: number) => {
    const theta = THETA_BASE + Math.sin(t * THETA_SPD) * THETA_RANGE
    const phi   = PHI_BASE   + Math.sin(t * PHI_SPD + 1.4) * PHI_RANGE
    return new THREE.Vector3(
      CAM_R * Math.sin(phi) * Math.cos(theta),
      CAM_R * Math.cos(phi),
      CAM_R * Math.sin(phi) * Math.sin(theta),
    )
  }

  useFrame((state, delta) => {
    elapsedRef.current += delta
    const t = elapsedRef.current

    // ── Focus change → trigger fly ──────────────────────────────────────────
    if (focusDef !== prevFocRef.current) {
      const prev = prevFocRef.current
      prevFocRef.current = focusDef
      if (focusDef) {
        const lookTarget = new THREE.Vector3(...focusDef.pos)
        const normal = new THREE.Vector3(0, 0, 1)
          .applyEuler(new THREE.Euler(focusDef.rotX, focusDef.rotY, 0))
        const dist = Math.max(focusDef.w, focusDef.h) * 1.2 + 5
        const toPos = lookTarget.clone().addScaledVector(normal, dist)
        focusBasePos.current = toPos.clone()
        flyRef.current = {
          fromPos: camera.position.clone(),
          toPos,
          fromLook: new THREE.Vector3(0, 0, 0),
          toLook: lookTarget.clone(),
          elapsed: 0, dur: FLY_DUR,
        }
      } else {
        // Fly back to where the orbit currently is
        flyRef.current = {
          fromPos: camera.position.clone(),
          toPos:   orbitPos(t),
          fromLook: prev ? new THREE.Vector3(...prev.pos) : new THREE.Vector3(0, 0, 0),
          toLook:   new THREE.Vector3(0, 0, 0),
          elapsed: 0, dur: FLY_DUR * 0.65,
        }
        leanX.current = 0
        leanY.current = 0
      }
    }

    // ── Active fly ───────────────────────────────────────────────────────────
    if (flyRef.current) {
      const fly = flyRef.current
      fly.elapsed += delta
      const p = Math.min(fly.elapsed / fly.dur, 1)
      const ep = eioC(p)
      camera.position.lerpVectors(fly.fromPos, fly.toPos, ep)
      camera.lookAt(new THREE.Vector3().lerpVectors(fly.fromLook, fly.toLook, ep))
      leanX.current *= 0.92
      leanY.current *= 0.92
      if (p >= 1) flyRef.current = null
      return
    }

    // ── Cursor/touch parallax ────────────────────────────────────────────────
    // Interaction RIGHT → camera +X → grid appears to drift LEFT (opposite). ✓
    const lf = focusDef ? LEAN_MAX * 0.32 : LEAN_MAX
    leanX.current += (state.pointer.x * lf        - leanX.current) * LEAN_LERP
    leanY.current += (state.pointer.y * lf * 0.55 - leanY.current) * LEAN_LERP

    if (focusDef) {
      // Focused: stay at the fly destination + live parallax tilt
      const base = focusBasePos.current
      camera.position.set(base.x + leanX.current, base.y + leanY.current, base.z)
      camera.lookAt(...focusDef.pos)
    } else {
      // Overview: constrained sine-wave orbit + cursor parallax on top
      const base = orbitPos(t)
      camera.position.set(base.x + leanX.current, base.y + leanY.current, base.z)
      camera.lookAt(0, 0, 0)
    }
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
      {/* No solid background — canvas is transparent, video shows through */}
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

  // Slow-play the background video
  const videoBgRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = videoBgRef.current
    if (v) v.playbackRate = 0.35
  }, [])

  // Suppress NebulaFooter while panel is open
  useEffect(() => {
    if (expId !== null) document.body.classList.add('qg-exp-open')
    else                document.body.classList.remove('qg-exp-open')
    return () =>        document.body.classList.remove('qg-exp-open')
  }, [expId])

  // Broadcast panel open/close so Nāvika repositions to the opposite corner
  useEffect(() => {
    if (expId === null) {
      window.dispatchEvent(new CustomEvent('vyan:panel-state', { detail: { open: false } }));
      return;
    }
    const panelOnRight = (GATEWAYS[expId]?.pos[0] ?? 0) >= 0;
    window.dispatchEvent(new CustomEvent('vyan:panel-state', {
      detail: { open: true, corner: panelOnRight ? 'left' : 'right' },
    }));
  }, [expId])
  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent('vyan:panel-state', { detail: { open: false } }));
  }, [])

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
        from { transform: translateX(115%); opacity: 0.5; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      @keyframes qg-slide-out-right {
        from { transform: translateX(0);    opacity: 1; }
        to   { transform: translateX(115%); opacity: 0.5; }
      }
      @keyframes qg-slide-in-left {
        from { transform: translateX(-115%); opacity: 0.5; }
        to   { transform: translateX(0);     opacity: 1; }
      }
      @keyframes qg-slide-out-left {
        from { transform: translateX(0);     opacity: 1; }
        to   { transform: translateX(-115%); opacity: 0.5; }
      }
      @keyframes qg-dim-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes qg-dim-out {
        from { opacity: 1; }
        to   { opacity: 0; }
      }

      /* ── In-frame 3D glass panel ────────────────────────────────── */
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

      /* ── Floating experience panel ─────────────────────────────── */

      /* Slide/position wrapper — never receives pointer events itself */
      .qg-panel-wrapper {
        position: absolute;
        top: 20px;
        bottom: 20px;
        width: clamp(300px, 50vw, 840px);
        pointer-events: none;
      }
      .qg-panel-right { right: 20px; }
      .qg-panel-left  { left: 20px;  }

      /* Tablet */
      @media (min-width: 641px) and (max-width: 1024px) {
        .qg-panel-wrapper { width: clamp(280px, 62vw, 680px); }
      }

      /* Mobile — centered with symmetric insets */
      @media (max-width: 640px) {
        .qg-panel-wrapper,
        .qg-panel-right,
        .qg-panel-left {
          left: 14px !important;
          right: 14px !important;
          width: auto !important;
          top: 14px !important;
          bottom: 14px !important;
        }
      }

      /* The actual panel card — gradient border on all 4 sides */
      .qg-float-panel {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 3px;
        pointer-events: auto;
        box-shadow:
          0 24px 64px rgba(12, 32, 160, 0.34),
          0 6px 20px rgba(0, 0, 0, 0.55),
          0 0 0 1px rgba(50, 90, 255, 0.08);
        transition: transform 0.44s cubic-bezier(0.34, 1.56, 0.64, 1),
                    box-shadow 0.44s ease;
      }
      /* Hover lift — pointer devices only */
      @media (hover: hover) {
        .qg-float-panel:hover {
          transform: translateY(-7px);
          box-shadow:
            0 38px 90px rgba(16, 44, 200, 0.44),
            0 12px 32px rgba(0, 0, 0, 0.65),
            0 0 70px rgba(60, 30, 220, 0.20),
            0 0 0 1px rgba(80, 120, 255, 0.18);
        }
      }
      /* Animated gradient border — all 4 sides.
         No z-index:-1 here: ::before (position:absolute) naturally paints
         above non-positioned children in CSS order; mask-composite punches
         out the interior so the glass fill beneath shows through. */
      .qg-float-panel::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 3px;
        padding: 2px;
        background: linear-gradient(
          120deg,
          #1028ff 0%,
          #6020ff 20%,
          #a030ff 40%,
          #6020ff 60%,
          #1028ff 80%,
          #6020ff 100%
        );
        background-size: 400% 400%;
        animation: qg-border-travel 2.8s linear infinite;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: destination-out;
        mask-composite: exclude;
        pointer-events: none;
      }

      /* Glass fill for the floating panel */
      .qg-exp-glass {
        background: linear-gradient(160deg, rgba(4, 8, 54, 0.96) 0%, rgba(2, 4, 34, 0.93) 100%);
        backdrop-filter: blur(16px) saturate(130%);
        -webkit-backdrop-filter: blur(16px) saturate(130%);
        border-radius: 2px;
        overflow: hidden;
      }

      /* EXPERIENCE button in 3D card */
      .qg-exp-btn {
        margin-top: 6px;
        border: 1px solid rgba(255, 42, 74, 0.45);
        background: rgba(255, 42, 74, 0.08);
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
        background: rgba(255, 42, 74, 0.18);
        border-color: rgba(255, 42, 74, 0.75);
      }

      /* Hide footer while experience panel is open */
      body.qg-exp-open .nf-root {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
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
      if (expIdRef.current !== null) return
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
      if (expIdRef.current !== null) return
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

  // Derive panel animation values
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

      {/* Background video — slow loop behind the 3D scene */}
      <video
        ref={videoBgRef}
        autoPlay loop muted playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: 0.52,
          pointerEvents: 'none',
        }}
      >
        <source src="/videos/vistara-bg.mp4" type="video/mp4" />
      </video>

      {/* Depth vignette — darkens edges so 3D scene reads clearly */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 48%, rgba(2,5,9,0.18) 0%, rgba(2,5,9,0.72) 100%)',
        pointerEvents: 'none',
      }} />

      <Canvas
        camera={{ position: [0, 0, CAM_R], fov: 62, near: 0.5, far: 200 }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
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
          color: 'rgba(255,42,74,0.50)', fontSize: '9px',
          letterSpacing: '0.42em', fontFamily: 'var(--font-vyan)',
          marginTop: 2,
        }}>
          {focusId !== null
            ? `${focusId + 1} / ${N} · ESC TO RELEASE`
            : 'SCROLL OR ‹ › TO NAVIGATE · CLICK TO FOCUS'}
        </div>
      </div>

      {/* ── Floating experience panel ──────────────────────────────────────── */}
      {expDef && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>

          {/* Full-screen dim — shows 3D scene through it, click to close */}
          <div
            onClick={closeExp}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0, 2, 14, 0.62)',
              animation: dimAnim,
              cursor: 'pointer',
            }}
          />

          {/* Slide wrapper — positions panel on the appropriate side */}
          <div
            className={`qg-panel-wrapper ${isRight ? 'qg-panel-right' : 'qg-panel-left'}`}
            style={{ animation: panelAnim }}
            onClick={e => e.stopPropagation()}
          >
            {/* Floating card — gradient border on all 4 sides + hover lift */}
            <div className="qg-float-panel">

              {/* Glass fill */}
              <div className="qg-exp-glass" style={{
                width: '100%', height: '100%',
                boxSizing: 'border-box',
                display: 'flex', flexDirection: 'column',
              }}>

                {/* Header */}
                <div style={{
                  padding: '22px 28px 18px',
                  borderBottom: '1px solid rgba(26,64,255,0.14)',
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
                        textShadow: '0 0 20px rgba(255,42,74,0.38)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {expDef.name}
                      </div>
                      <div style={{
                        color: 'rgba(255,42,74,0.72)', fontFamily: 'var(--font-vyan)',
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
                    padding: '10px 28px 9px', flexShrink: 0,
                    color: 'rgba(190,210,255,0.82)', fontFamily: 'var(--font-vyan)',
                    fontSize: '9px', letterSpacing: '0.30em',
                    borderBottom: '1px solid rgba(26,64,255,0.12)',
                    textTransform: 'uppercase',
                  }}>
                    {expDef.tagline}
                  </div>
                ) : null}

                {/* Content — ScaledIframe fits the entire app in the panel without scroll */}
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                  {expDef.appUrl ? (
                    <ScaledIframe src={expDef.appUrl} />
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
                        color: 'rgba(200,215,255,0.80)',
                        fontSize: '10px', letterSpacing: '0.28em',
                        textAlign: 'center', maxWidth: 260,
                        lineHeight: 2.0, textTransform: 'uppercase',
                      }}>
                        {expDef.description || expDef.tagline || 'Experience coming soon.'}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
