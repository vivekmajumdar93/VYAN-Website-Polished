'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { NanoOrb } from '@/lib/vyan/objects/NanoOrb'
import { GATEWAYS, type Gateway } from '@/lib/vistara/gateways'

// ─── gyroscope constants ──────────────────────────────────────────────────────
const ORB_SIZES = [28, 24, 22, 30, 32, 26, 26, 34]

const ORB_CFG: { ring: 'A' | 'B' | 'C'; localAngle: number }[] = [
  { ring: 'A', localAngle: Math.PI / 2 },                         // 0 Rtam
  { ring: 'B', localAngle: Math.PI / 2 },                         // 1 Ojas
  { ring: 'C', localAngle: Math.PI / 2 },                         // 2 Mudra
  { ring: 'A', localAngle: Math.PI / 2 + (2 * Math.PI) / 3 },    // 3 Netra
  { ring: 'B', localAngle: Math.PI / 2 + (2 * Math.PI) / 3 },    // 4 Akriti
  { ring: 'C', localAngle: Math.PI / 2 + Math.PI },               // 5 Sutra
  { ring: 'B', localAngle: Math.PI / 2 + (4 * Math.PI) / 3 },    // 6 ChitraPrana
  { ring: 'A', localAngle: Math.PI / 2 + (4 * Math.PI) / 3 },    // 7 Maya
]

const RING_RADII = { A: 280, B: 240, C: 200 } as const
const RING_SPEEDS = { A: 0.0008, B: 0.0006, C: 0.001 } as const
const FRONT = Math.PI / 2
const TRAVERSE_MS = 600

// ─── phantom orb palette — excluded from blue-violet (that's the gyroscope) ──
const PHANTOM_HEX = ['#ff5520', '#20d8a0', '#ff0055', '#aaff40', '#ff9020', '#cc40ff']

// ─── helpers ──────────────────────────────────────────────────────────────────
function easeInExpo(t: number) { return t <= 0 ? 0 : Math.pow(2, 10 * t - 10) }
function easeInOutCubic(t: number) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2 }

function nearestTarget(current: number, raw: number): number {
  let d = (raw - current) % (2 * Math.PI)
  if (d > Math.PI)  d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return current + d
}

// ─── shard generation ─────────────────────────────────────────────────────────
const PANEL_W = 440
const PANEL_H = 360
const SHARD_COLS = 7
const SHARD_ROWS = 6

interface ShardDef {
  cx: number; cy: number
  clipPath: string
  vx: number; vy: number; vr: number
  gradAngle: number
}

function mkShards(pw: number, ph: number): ShardDef[] {
  const cw = pw / SHARD_COLS
  const ch = ph / SHARD_ROWS
  const JITTER = 0.38

  const grid: [number, number][][] = []
  for (let r = 0; r <= SHARD_ROWS; r++) {
    const row: [number, number][] = []
    for (let c = 0; c <= SHARD_COLS; c++) {
      const jx = (c > 0 && c < SHARD_COLS) ? (Math.random() - 0.5) * cw * JITTER : 0
      const jy = (r > 0 && r < SHARD_ROWS) ? (Math.random() - 0.5) * ch * JITTER : 0
      row.push([
        Math.max(0, Math.min(pw, c * cw + jx)),
        Math.max(0, Math.min(ph, r * ch + jy)),
      ])
    }
    grid.push(row)
  }

  const shards: ShardDef[] = []
  for (let r = 0; r < SHARD_ROWS; r++) {
    for (let c = 0; c < SHARD_COLS; c++) {
      const tl = grid[r][c], tr = grid[r][c+1]
      const br = grid[r+1][c+1], bl = grid[r+1][c]
      const cx = (tl[0]+tr[0]+br[0]+bl[0]) / 4
      const cy = (tl[1]+tr[1]+br[1]+bl[1]) / 4
      const pt = (x: number, y: number) => `${(x/pw*100).toFixed(2)}% ${(y/ph*100).toFixed(2)}%`
      shards.push({
        cx, cy,
        clipPath: `polygon(${pt(...tl)},${pt(...tr)},${pt(...br)},${pt(...bl)})`,
        vx: (cx - pw/2) * (0.7 + Math.random() * 1.0),
        vy: (cy - ph/2) * (0.7 + Math.random() * 1.0),
        vr: (Math.random() - 0.5) * 480,
        gradAngle: Math.round(Math.random() * 360),
      })
    }
  }
  return shards
}

// ─── particles ────────────────────────────────────────────────────────────────
function ParticleField({ spiralTarget, spiralT }: {
  spiralTarget: THREE.Vector3 | null
  spiralT: number
}) {
  const ptsRef = useRef<THREE.Points>(null)
  const { base, spd, ph } = useMemo(() => {
    const base: number[] = [], spd: number[] = [], ph: number[] = []
    for (let i = 0; i < 300; i++) {
      base.push((Math.random()-0.5)*900, (Math.random()-0.5)*600, (Math.random()-0.5)*500-100)
      spd.push(0.2 + Math.random() * 0.8)
      ph.push(Math.random() * Math.PI * 2)
    }
    return { base, spd, ph }
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(300 * 3)
    for (let i = 0; i < 300; i++) { p[i*3]=base[i*3]; p[i*3+1]=base[i*3+1]; p[i*3+2]=base[i*3+2] }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [base])

  useFrame(({ clock }) => {
    if (!ptsRef.current) return
    const attr = ptsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const t = clock.elapsedTime
    for (let i = 0; i < 300; i++) {
      let px = base[i*3]   + Math.sin(t * spd[i] * 0.35 + ph[i]) * 5
      let py = base[i*3+1] + Math.cos(t * spd[i] * 0.28 + ph[i] * 1.3) * 4
      let pz = base[i*3+2]
      if (spiralTarget && spiralT > 0) {
        const pull = Math.min(spiralT, 1)
        px += (spiralTarget.x - px) * pull * 0.9
        py += (spiralTarget.y - py) * pull * 0.9
        pz += (spiralTarget.z - pz) * pull * 0.9
      }
      attr.setXYZ(i, px, py, pz)
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ptsRef} geometry={geo}>
      <pointsMaterial color="#3344aa" size={1.2} transparent opacity={0.4} sizeAttenuation depthWrite={false} />
    </points>
  )
}

// ─── phantom passing orbs ─────────────────────────────────────────────────────
// Distinct-colored orbs that cross the scene at intervals, visible 5-7s, no interaction
function PhantomOrbsSystem() {
  const parentRef = useRef<THREE.Group>(null)

  const pool = useMemo(() => {
    const POOL = 4
    return Array.from({ length: POOL }, (_, i) => {
      const hex = PHANTOM_HEX[i % PHANTOM_HEX.length]
      const col = new THREE.Color(hex)
      const size = 6 + Math.random() * 10

      const coreGeo = new THREE.SphereGeometry(size, 8, 8)
      const coreMat = new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const core = new THREE.Mesh(coreGeo, coreMat)

      // Soft corona halo — additive so it glows without covering the scene
      const haloGeo = new THREE.SphereGeometry(size * 4.5, 6, 6)
      const haloMat = new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const halo = new THREE.Mesh(haloGeo, haloMat)

      const group = new THREE.Group()
      group.add(core, halo)
      group.position.set(-3000, 0, 0) // park off-scene initially

      return {
        group, coreMat, haloMat,
        active: false,
        startT: 0,
        nextT: 4 + i * 10,   // staggered first triggers: 4s, 14s, 24s, 34s
        duration: 0,
        x0: 0, y0: 0, z0: 0,
        x1: 0, y1: 0, z1: 0,
      }
    })
  }, [])

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return
    pool.forEach(p => parent.add(p.group))
    return () => { pool.forEach(p => parent.remove(p.group)) }
  }, [pool])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    for (const pd of pool) {
      if (!pd.active) {
        if (t >= pd.nextT) {
          // Random crossing path at varying depths
          const dir  = Math.random() < 0.5 ? 1 : -1
          const depth = (Math.random() - 0.5) * 500   // z: -250 … +250
          const yA   = (Math.random() - 0.5) * 300
          const yB   = yA + (Math.random() - 0.5) * 80

          pd.x0 = -dir * 780; pd.y0 = yA; pd.z0 = depth
          pd.x1 =  dir * 780; pd.y1 = yB; pd.z1 = depth + (Math.random() - 0.5) * 60
          pd.startT   = t
          pd.duration = 5 + Math.random() * 2           // 5-7 s visible
          pd.nextT    = t + pd.duration + 9 + Math.random() * 13  // 9-22 s gap
          pd.active   = true
        } else {
          pd.coreMat.opacity = 0
          pd.haloMat.opacity = 0
        }
        continue
      }

      const p = Math.min((t - pd.startT) / pd.duration, 1)
      if (p >= 1) {
        pd.active = false
        pd.coreMat.opacity = 0
        pd.haloMat.opacity = 0
        pd.group.position.set(-3000, 0, 0)
        continue
      }

      // Smooth sin fade-in / fade-out envelope; additive blending amplifies visually
      const alpha = Math.sin(Math.PI * p)
      pd.coreMat.opacity = alpha * 0.55
      pd.haloMat.opacity = alpha * 0.07

      pd.group.position.set(
        pd.x0 + (pd.x1 - pd.x0) * p,
        pd.y0 + (pd.y1 - pd.y0) * p,
        pd.z0 + (pd.z1 - pd.z0) * p,
      )
    }
  })

  return <group ref={parentRef} />
}

// ─── screen position tracker ──────────────────────────────────────────────────
function ScreenTracker({ worldRef, screenRef }: {
  worldRef: React.MutableRefObject<Record<number, THREE.Vector3>>
  screenRef: React.MutableRefObject<Record<number, { x: number; y: number }>>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    for (let i = 0; i < 8; i++) {
      const wp = worldRef.current[i]
      if (!wp) continue
      v.copy(wp).project(camera)
      screenRef.current[i] = { x: (v.x+1)/2*size.width, y: (-v.y+1)/2*size.height }
    }
  })
  return null
}

// ─── vistara orb ─────────────────────────────────────────────────────────────
interface VistaraOrbProps {
  gateway: Gateway
  orbIdx: number
  orbSize: number
  ringType: 'A' | 'B' | 'C'
  localAngle: number
  ringRadius: number
  isFocused: boolean
  isHovered: boolean
  isPulled: boolean
  pullProgress: number
  pullTarget: THREE.Vector3 | null
  onHover: (id: string | null) => void
  onClick: (idx: number, id: string) => void
  worldPosRef: React.MutableRefObject<Record<number, THREE.Vector3>>
}

function VistaraOrb({
  gateway, orbIdx, orbSize, ringType, localAngle, ringRadius,
  isFocused, isHovered, isPulled, pullProgress, pullTarget,
  onHover, onClick, worldPosRef,
}: VistaraOrbProps) {
  const basePos = useMemo<[number, number, number]>(() => {
    if (ringType === 'B') return [0, ringRadius * Math.cos(localAngle), ringRadius * Math.sin(localAngle)]
    return [ringRadius * Math.cos(localAngle), 0, ringRadius * Math.sin(localAngle)]
  }, [ringType, localAngle, ringRadius])

  const groupRef = useRef<THREE.Group>(null)
  const ZERO     = useMemo(() => new THREE.Vector3(), [])
  const GYRO_SCALE = orbSize * 0.15

  const nanoOrb = useMemo(() => {
    const inst = new NanoOrb({
      id:          gateway.id,
      title:       gateway.name,
      subtitle:    gateway.tagline,
      description: gateway.description,
      colorA:      '#0014ff',
      colorB:      '#5600ff',
    })
    inst.setVisible(true)
    return inst
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway.id])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    if (isHovered)      nanoOrb.setSignal('hover')
    else if (isFocused) nanoOrb.setSignal('listening')
    else                nanoOrb.setSignal('idle')
    nanoOrb.setVisualDim(isFocused || isHovered ? 1 : 0.55)

    nanoOrb.update(t, isHovered ? 0.5 : 0, isFocused, false, isFocused ? 1 : 0.3, 1, ZERO)
    nanoOrb.group.scale.multiplyScalar(GYRO_SCALE)

    if (groupRef.current) {
      const wp = new THREE.Vector3()
      groupRef.current.getWorldPosition(wp)
      worldPosRef.current[orbIdx] = wp

      if (isPulled && pullTarget && pullProgress > 0) {
        const p2 = pullProgress * pullProgress
        groupRef.current.position.lerp(pullTarget, p2 * 0.05)
      } else {
        groupRef.current.position.set(...basePos)
      }
    }
  })

  return (
    <group ref={groupRef} position={basePos}>
      <mesh
        onPointerOver={e => { e.stopPropagation(); onHover(gateway.id) }}
        onPointerOut={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onClick(orbIdx, gateway.id) }}
      >
        <sphereGeometry args={[orbSize * 0.7, 8, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <primitive object={nanoOrb.group} />

      <Html center distanceFactor={250} occlude={false}
        position={[0, -(orbSize * 0.9), 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{
            fontSize: isFocused ? '12px' : '9px',
            letterSpacing: '0.25em',
            color: isFocused ? 'rgba(180,200,255,0.8)' : 'rgba(140,160,255,0.35)',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-vyan)',
            transition: 'all 0.3s',
          }}>{gateway.name}</div>
          {isFocused && (
            <div style={{
              fontSize: '8px',
              letterSpacing: '0.15em',
              color: 'rgba(140,160,255,0.45)',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-vyan)',
              marginTop: '4px',
            }}>{gateway.tagline}</div>
          )}
        </div>
      </Html>
    </group>
  )
}

// ─── gyroscope rings ──────────────────────────────────────────────────────────
interface GyroSceneProps {
  focusedIdx: number
  hoveredId: string | null
  onHover: (id: string | null) => void
  onOrbClick: (idx: number, id: string) => void
  vortexTargetIdx: number | null
  vortexProgress: number
  vortexPhase: VortexPhase
  worldPosRef: React.MutableRefObject<Record<number, THREE.Vector3>>
  screenPosRef: React.MutableRefObject<Record<number, { x: number; y: number }>>
  traverseRef: React.MutableRefObject<TraverseState>
}

function GyroScene({
  focusedIdx, hoveredId, onHover, onOrbClick,
  vortexTargetIdx, vortexProgress, vortexPhase,
  worldPosRef, screenPosRef, traverseRef,
}: GyroSceneProps) {
  const ringARef = useRef<THREE.Group>(null)
  const ringBRef = useRef<THREE.Group>(null)
  const ringCRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const lookAt = useRef(new THREE.Vector3(0, 0, 0))
  const anglesRef = useRef({ A: 0, B: 0, C: 0 })

  // Camera throw state — fires a brief zoom-toward-orb impulse when focus changes
  const prevFocusRef = useRef(focusedIdx)
  const throwRef     = useRef({ startT: -10 })

  useFrame(({ clock }, delta) => {
    const tr = traverseRef.current
    const frac60 = delta * 60

    if (tr.active) {
      const elapsed = Date.now() - tr.startTime
      const p = easeInOutCubic(Math.min(elapsed / TRAVERSE_MS, 1))
      const slowMult = 0.2 * frac60

      if (tr.ringAActive) {
        anglesRef.current.A = tr.ringAStart + (tr.ringATarget - tr.ringAStart) * p
      } else {
        anglesRef.current.A += RING_SPEEDS.A * slowMult
      }
      if (tr.ringBActive) {
        anglesRef.current.B = tr.ringBStart + (tr.ringBTarget - tr.ringBStart) * p
      } else {
        anglesRef.current.B += RING_SPEEDS.B * slowMult
      }
      if (tr.ringCActive) {
        anglesRef.current.C = tr.ringCStart + (tr.ringCTarget - tr.ringCStart) * p
      } else {
        anglesRef.current.C += RING_SPEEDS.C * slowMult
      }
      if (elapsed >= TRAVERSE_MS) tr.active = false
    } else {
      anglesRef.current.A += RING_SPEEDS.A * frac60
      anglesRef.current.B += RING_SPEEDS.B * frac60
      anglesRef.current.C += RING_SPEEDS.C * frac60
    }

    if (ringARef.current) ringARef.current.rotation.y = anglesRef.current.A
    if (ringBRef.current) ringBRef.current.rotation.x = anglesRef.current.B
    if (ringCRef.current) ringCRef.current.rotation.z = anglesRef.current.C

    // Detect focus change → trigger throw impulse
    if (prevFocusRef.current !== focusedIdx) {
      prevFocusRef.current = focusedIdx
      throwRef.current.startT = clock.elapsedTime
    }
    const throwElapsed = clock.elapsedTime - throwRef.current.startT
    const throwDur = 0.75
    const tp = Math.min(throwElapsed / throwDur, 1)
    // Smooth sin bell: 0 at start and end, peak at midpoint → zoom-in pulse
    const throwZ = Math.sin(Math.PI * tp) * 72

    // Camera
    if (vortexTargetIdx !== null && vortexProgress > 0) {
      const wp = worldPosRef.current[vortexTargetIdx]
      if (wp) {
        const t = easeInExpo(Math.min(vortexProgress, 1))
        camera.position.lerp(new THREE.Vector3(wp.x * 0.3, wp.y * 0.2, 550 - t * 350), t * 0.12)
        camera.lookAt(wp)
      }
    } else {
      // Faster lerp during throw so the impulse is felt immediately
      const camLerp = tp < 1 ? 0.18 : 0.04
      camera.position.lerp(new THREE.Vector3(0, 0, 550 - throwZ), camLerp)
      const wp = worldPosRef.current[focusedIdx]
      if (wp) lookAt.current.lerp(wp, 0.04)
      else lookAt.current.lerp(new THREE.Vector3(0, 0, 0), 0.04)
      camera.lookAt(lookAt.current)
    }
  })

  const spiralTarget = vortexTargetIdx !== null ? (worldPosRef.current[vortexTargetIdx] ?? null) : null
  const spiralT = vortexPhase === 'pull' ? vortexProgress : vortexPhase === 'peak' || vortexPhase === 'passage' ? 1 : 0

  const ringMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2233aa', emissive: '#1122aa', emissiveIntensity: 0.4,
    transparent: true, opacity: 0.08, depthWrite: false,
  }), [])

  return (
    <>
      <ambientLight intensity={0.04} />
      <ParticleField spiralTarget={spiralTarget} spiralT={spiralT} />
      <PhantomOrbsSystem />

      {/* ── Ring A (Y-axis, horizontal equatorial) ── */}
      <group ref={ringARef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[280, 1.5, 8, 128]} />
          <primitive object={ringMat} attach="material" />
        </mesh>
        {[0, 3, 7].map(idx => (
          <VistaraOrb key={idx}
            gateway={GATEWAYS[idx]}
            orbIdx={idx}
            orbSize={ORB_SIZES[idx]}
            ringType="A"
            localAngle={ORB_CFG[idx].localAngle}
            ringRadius={RING_RADII.A}
            isFocused={focusedIdx === idx}
            isHovered={hoveredId === GATEWAYS[idx].id}
            isPulled={vortexTargetIdx !== null && vortexTargetIdx !== idx}
            pullProgress={vortexTargetIdx !== null && vortexTargetIdx !== idx ? vortexProgress : 0}
            pullTarget={vortexTargetIdx !== null ? (worldPosRef.current[vortexTargetIdx] ?? null) : null}
            onHover={onHover}
            onClick={onOrbClick}
            worldPosRef={worldPosRef}
          />
        ))}
      </group>

      {/* ── Ring B (X-axis, vertical meridional) ── */}
      <group ref={ringBRef}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[240, 1.5, 8, 128]} />
          <primitive object={ringMat} attach="material" />
        </mesh>
        {[1, 4, 6].map(idx => (
          <VistaraOrb key={idx}
            gateway={GATEWAYS[idx]}
            orbIdx={idx}
            orbSize={ORB_SIZES[idx]}
            ringType="B"
            localAngle={ORB_CFG[idx].localAngle}
            ringRadius={RING_RADII.B}
            isFocused={focusedIdx === idx}
            isHovered={hoveredId === GATEWAYS[idx].id}
            isPulled={vortexTargetIdx !== null && vortexTargetIdx !== idx}
            pullProgress={vortexTargetIdx !== null && vortexTargetIdx !== idx ? vortexProgress : 0}
            pullTarget={vortexTargetIdx !== null ? (worldPosRef.current[vortexTargetIdx] ?? null) : null}
            onHover={onHover}
            onClick={onOrbClick}
            worldPosRef={worldPosRef}
          />
        ))}
      </group>

      {/* ── Ring C (Z-axis rotation, 45° diagonal) ── */}
      <group ref={ringCRef}>
        <group rotation={[Math.PI / 4, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[200, 1.5, 8, 128]} />
            <primitive object={ringMat} attach="material" />
          </mesh>
          {[2, 5].map(idx => (
            <VistaraOrb key={idx}
              gateway={GATEWAYS[idx]}
              orbIdx={idx}
              orbSize={ORB_SIZES[idx]}
              ringType="C"
              localAngle={ORB_CFG[idx].localAngle}
              ringRadius={RING_RADII.C}
              isFocused={focusedIdx === idx}
              isHovered={hoveredId === GATEWAYS[idx].id}
              isPulled={vortexTargetIdx !== null && vortexTargetIdx !== idx}
              pullProgress={vortexTargetIdx !== null && vortexTargetIdx !== idx ? vortexProgress : 0}
              pullTarget={vortexTargetIdx !== null ? (worldPosRef.current[vortexTargetIdx] ?? null) : null}
              onHover={onHover}
              onClick={onOrbClick}
              worldPosRef={worldPosRef}
            />
          ))}
        </group>
      </group>

      <ScreenTracker worldRef={worldPosRef} screenRef={screenPosRef} />
    </>
  )
}

// ─── glass panel ─────────────────────────────────────────────────────────────
type PanelPhase = 'shattering' | 'hold' | 'reforming' | 'open' | 'closing'

function GlassPanel({ gateway, onClose, onEnter }: {
  gateway: Gateway; onClose: () => void; onEnter: () => void
}) {
  const shards = useMemo(() => mkShards(PANEL_W, PANEL_H), [])
  const [phase, setPhase] = useState<PanelPhase>('shattering')
  const [contentVisible, setContentVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'),      350)
    const t2 = setTimeout(() => setPhase('reforming'), 500)
    const t3 = setTimeout(() => { setPhase('open'); setContentVisible(true) }, 1000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const handleClose = useCallback(() => {
    setContentVisible(false)
    setPhase('closing')
    setTimeout(onClose, 420)
  }, [onClose])

  const isScattered = phase === 'shattering' || phase === 'hold' || phase === 'closing'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div onClick={handleClose}
        style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(12px)' }}
      />

      {/* Shards — overflow:hidden when assembled so they respect the panel's rounded border */}
      <div style={{
        position: 'absolute', width: PANEL_W, height: PANEL_H,
        pointerEvents: 'none', zIndex: 3,
        overflow: isScattered ? 'visible' : 'hidden',
        borderRadius: isScattered ? '0' : '20px',
      }}>
        {shards.map((sh, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: 0, top: 0,
            width: '100%', height: '100%',
            // Near-transparent so the background orb system shows through faintly
            background: `linear-gradient(${sh.gradAngle}deg,
              rgba(160,200,255,0.07) 0%,
              rgba(70,110,220,0.04) 45%,
              rgba(130,170,255,0.06) 100%)`,
            clipPath: sh.clipPath,
            transformOrigin: `${(sh.cx / PANEL_W * 100).toFixed(2)}% ${(sh.cy / PANEL_H * 100).toFixed(2)}%`,
            transform: isScattered
              ? `translate(${sh.vx}px,${sh.vy}px) rotate(${sh.vr}deg)`
              : 'translate(0,0) rotate(0deg)',
            opacity: phase === 'closing' ? 0 : 1,
            transition: phase === 'shattering'
              ? 'transform 350ms cubic-bezier(0.16,1,0.3,1)'
              : phase === 'hold' ? 'none'
              : phase === 'closing' ? 'transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 300ms'
              : 'transform 500ms cubic-bezier(0.65,0,0.35,1)',
          }} />
        ))}
      </div>

      {/* Panel */}
      <div style={{
        position: 'relative', zIndex: 2, width:'100%', maxWidth:'460px', padding:'34px',
        background: phase === 'open' || phase === 'closing' ? 'rgba(8,16,48,0.45)' : 'transparent',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(80,140,255,0.22)',
        borderRadius: '20px',
        boxShadow: '0 0 80px rgba(40,80,200,0.18), inset 0 0 40px rgba(20,40,120,0.12)',
        opacity: phase === 'open' ? 1 : 0,
        transition: 'opacity 0.3s, background 0.3s',
      }}>
        <div style={{ position:'absolute', top:0, left:'12%', right:'12%', height:'1px',
          background:`linear-gradient(90deg,transparent,${gateway.color}60,transparent)` }} />

        <div style={{ opacity: contentVisible ? 1 : 0, transition: 'opacity 0.3s 0.1s' }}>
          <div style={{ fontSize:'9px', letterSpacing:'0.28em', color:gateway.color,
            fontFamily:'var(--font-vyan)', textTransform:'uppercase', marginBottom:'7px' }}>
            {gateway.tantra}
          </div>
          <h2 style={{ fontFamily:'var(--font-vyan)', fontSize:'24px', letterSpacing:'0.18em',
            color:'rgba(255,255,255,0.92)', textTransform:'uppercase', margin:'0 0 6px' }}>
            {gateway.name}
          </h2>
          <p style={{ fontSize:'10px', letterSpacing:'0.15em', color:`${gateway.color}b3`,
            textTransform:'uppercase', fontFamily:'var(--font-vyan)', margin:'0 0 22px' }}>
            {gateway.tagline}
          </p>
          <p style={{ fontSize:'14px', lineHeight:'1.75', color:'rgba(255,255,255,0.58)',
            fontFamily:'var(--font-vyan)', letterSpacing:'0.02em', margin:'0 0 28px' }}>
            {gateway.description}
          </p>
          <div style={{ display:'flex', gap:'12px' }}>
            <button onClick={handleClose} style={{ flex:1, padding:'12px',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'10px', color:'rgba(255,255,255,0.45)', fontSize:'10px',
              letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-vyan)', cursor:'pointer' }}>
              Return
            </button>
            <button onClick={onEnter} style={{ padding:'12px 26px',
              background:`${gateway.color}26`, border:`1px solid ${gateway.color}60`,
              borderRadius:'10px', color:gateway.color, fontSize:'10px',
              letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-vyan)',
              cursor:'pointer', boxShadow:`0 0 20px ${gateway.color}1f` }}>
              Enter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── traversal state ──────────────────────────────────────────────────────────
interface TraverseState {
  active: boolean
  startTime: number
  ringAActive: boolean; ringAStart: number; ringATarget: number
  ringBActive: boolean; ringBStart: number; ringBTarget: number
  ringCActive: boolean; ringCStart: number; ringCTarget: number
}

type VortexPhase = 'idle' | 'pull' | 'peak' | 'passage' | 'done'

// ─── main export ──────────────────────────────────────────────────────────────
export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void
  onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [focusedIdx,      setFocusedIdx]      = useState(0)
  const [hoveredId,       setHoveredId]       = useState<string | null>(null)
  const [vortexPhase,     setVortexPhase]     = useState<VortexPhase>('idle')
  const [vortexProgress,  setVortexProgress]  = useState(0)
  const [vortexTargetIdx, setVortexTargetIdx] = useState<number | null>(null)
  const [showFlash,       setShowFlash]       = useState(false)
  const [showPanel,       setShowPanel]       = useState(false)
  const [panelGateway,    setPanelGateway]    = useState<Gateway | null>(null)

  const worldPosRef   = useRef<Record<number, THREE.Vector3>>({})
  const screenPosRef  = useRef<Record<number, { x: number; y: number }>>({})
  const vortexAnimRef = useRef<number>(0)
  const vortexStartRef = useRef(0)

  const traverseRef = useRef<TraverseState>({
    active: false, startTime: 0,
    ringAActive: false, ringAStart: 0, ringATarget: 0,
    ringBActive: false, ringBStart: 0, ringBTarget: 0,
    ringCActive: false, ringCStart: 0, ringCTarget: 0,
  })

  // ── traversal trigger ────────────────────────────────────────────────────────
  const triggerTraverse = useCallback((newIdx: number, currentAngles?: { A: number; B: number; C: number }) => {
    const cfg = ORB_CFG[newIdx]
    const angles = currentAngles ?? { A: 0, B: 0, C: 0 }
    const rawTarget = FRONT - cfg.localAngle

    const tr = traverseRef.current
    tr.active = true
    tr.startTime = Date.now()
    tr.ringAActive = false
    tr.ringBActive = false
    tr.ringCActive = false

    if (cfg.ring === 'A') {
      tr.ringAActive = true
      tr.ringAStart = angles.A
      tr.ringATarget = nearestTarget(angles.A, rawTarget)
    } else if (cfg.ring === 'B') {
      tr.ringBActive = true
      tr.ringBStart = angles.B
      tr.ringBTarget = nearestTarget(angles.B, rawTarget)
    } else {
      tr.ringCActive = true
      tr.ringCStart = angles.C
      tr.ringCTarget = nearestTarget(angles.C, rawTarget)
    }
  }, [])

  // ── scroll / swipe handlers ───────────────────────────────────────────────────
  useEffect(() => {
    let cooldown = false
    const go = (dir: 1 | -1) => {
      if (cooldown || vortexPhase !== 'idle') return
      cooldown = true
      setTimeout(() => { cooldown = false }, 700)
      setFocusedIdx(prev => {
        const next = (prev + dir + 8) % 8
        triggerTraverse(next)
        return next
      })
    }

    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > 5) go(e.deltaY > 0 ? 1 : -1) }

    let tx = 0
    const onTouchStart = (e: TouchEvent) => { tx = e.touches[0].clientX }
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - tx
      if (Math.abs(dx) >= 40) go(dx < 0 ? 1 : -1)
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [vortexPhase, triggerTraverse])

  // ── orb click ─────────────────────────────────────────────────────────────────
  const handleOrbClick = useCallback((idx: number, id: string) => {
    if (vortexPhase !== 'idle') return
    if (idx !== focusedIdx) {
      triggerTraverse(idx)
      setFocusedIdx(idx)
      return
    }
    setVortexTargetIdx(idx)
    setVortexPhase('pull')
    vortexStartRef.current = performance.now()

    const tick = () => {
      const el = performance.now() - vortexStartRef.current
      if (el < 400) {
        setVortexProgress(el / 400)
        setVortexPhase('pull')
        vortexAnimRef.current = requestAnimationFrame(tick)
      } else if (el < 800) {
        setVortexProgress((el - 400) / 400)
        setVortexPhase('peak')
        vortexAnimRef.current = requestAnimationFrame(tick)
      } else if (el < 1200) {
        setVortexProgress((el - 800) / 400)
        setVortexPhase('passage')
        vortexAnimRef.current = requestAnimationFrame(tick)
      } else {
        setShowFlash(true)
        setTimeout(() => setShowFlash(false), 80)
        const gw = GATEWAYS.find(g => g.id === id)!
        setPanelGateway(gw)
        setShowPanel(true)
        setVortexPhase('done')
        setVortexProgress(0)
        setTimeout(() => { setVortexPhase('idle'); setVortexTargetIdx(null) }, 200)
      }
    }
    vortexAnimRef.current = requestAnimationFrame(tick)
  }, [vortexPhase, focusedIdx, triggerTraverse])

  useEffect(() => () => cancelAnimationFrame(vortexAnimRef.current), [])

  const handleClose = useCallback(() => { setShowPanel(false); setPanelGateway(null) }, [])
  const handleEnter = useCallback(() => {
    const gw = panelGateway; handleClose()
    if (gw) onGatewayEnter?.(gw)
  }, [panelGateway, handleClose, onGatewayEnter])

  const vig = vortexPhase === 'pull' ? vortexProgress * 0.5
    : vortexPhase === 'peak' ? 0.5 + vortexProgress * 0.5
    : vortexPhase === 'passage' ? 1 : 0

  const passCenter = vortexTargetIdx !== null ? screenPosRef.current[vortexTargetIdx] : null

  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden', zIndex:100, background:'#000005' }}>

      {/* ── CSS keyframes ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes nebDrift1 {
          0%,100% { transform: translateX(-5%) translateY(8%) scale(1.0) }
          50%      { transform: translateX(8%) translateY(-4%) scale(1.18) }
        }
        @keyframes nebDrift2 {
          0%,100% { transform: translateX(6%) translateY(-6%) scale(0.90) }
          50%      { transform: translateX(-7%) translateY(10%) scale(1.12) }
        }
        @keyframes nebDrift3 {
          0%,100% { transform: translateX(4%) translateY(12%) scale(1.06) }
          50%      { transform: translateX(-9%) translateY(-4%) scale(0.86) }
        }
        @keyframes nebSweep1 {
          0%   { transform: translateX(calc(-50% - 150vw)) scaleY(1.2); opacity: 0 }
          7%   { opacity: 0.085 }
          93%  { opacity: 0.085 }
          100% { transform: translateX(calc(-50% + 150vw)) scaleY(0.9); opacity: 0 }
        }
        @keyframes nebSweep2 {
          0%   { transform: translateX(calc(-50% + 150vw)) scaleY(0.85); opacity: 0 }
          7%   { opacity: 0.065 }
          93%  { opacity: 0.065 }
          100% { transform: translateX(calc(-50% - 150vw)) scaleY(1.1); opacity: 0 }
        }
        @keyframes nebSweepFg {
          0%   { transform: translateX(calc(-50% - 130vw)); opacity: 0 }
          8%   { opacity: 0.055 }
          92%  { opacity: 0.055 }
          100% { transform: translateX(calc(-50% + 130vw)); opacity: 0 }
        }
        @keyframes stTrail1 {
          0%    { transform: translateX(-130vw) rotate(-9deg); opacity: 0 }
          0.5%  { opacity: 1 }
          4%    { transform: translateX(130vw) rotate(-9deg); opacity: 0 }
          4.1%  { opacity: 0 }
          100%  { opacity: 0 }
        }
        @keyframes stTrail2 {
          0%    { transform: translateX(-130vw) rotate(-4deg); opacity: 0 }
          0.5%  { opacity: 0.82 }
          3.5%  { transform: translateX(130vw) rotate(-4deg); opacity: 0 }
          3.6%  { opacity: 0 }
          100%  { opacity: 0 }
        }
        @keyframes stTrail3 {
          0%    { transform: translateX(130vw) rotate(11deg); opacity: 0 }
          0.5%  { opacity: 0.90 }
          4.5%  { transform: translateX(-130vw) rotate(11deg); opacity: 0 }
          4.6%  { opacity: 0 }
          100%  { opacity: 0 }
        }
        @keyframes stTrail4 {
          0%    { transform: translateX(-130vw) rotate(-2deg); opacity: 0 }
          0.5%  { opacity: 0.70 }
          3%    { transform: translateX(130vw) rotate(-2deg); opacity: 0 }
          3.1%  { opacity: 0 }
          100%  { opacity: 0 }
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* ── Background nebula atmosphere (behind Canvas) ───────────────── */}
      <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none', overflow:'hidden' }}>

        {/* Static large nebula volumes — hydrogen, oxygen, sulfur band colors */}
        <div style={{
          position:'absolute', width:'72vw', height:'62vh', top:'-8%', left:'-12%',
          background:'radial-gradient(ellipse at center, rgba(160,0,220,0.14) 0%, rgba(90,0,160,0.05) 55%, transparent 100%)',
          filter:'blur(64px)',
          animation:'nebDrift1 58s ease-in-out infinite',
        }} />
        <div style={{
          position:'absolute', width:'62vw', height:'52vh', top:'38%', right:'-8%',
          background:'radial-gradient(ellipse at center, rgba(0,160,190,0.12) 0%, rgba(0,90,130,0.05) 55%, transparent 100%)',
          filter:'blur(52px)',
          animation:'nebDrift2 47s ease-in-out infinite',
        }} />
        <div style={{
          position:'absolute', width:'54vw', height:'44vh', bottom:'4%', left:'18%',
          background:'radial-gradient(ellipse at center, rgba(190,70,0,0.11) 0%, rgba(130,35,0,0.04) 55%, transparent 100%)',
          filter:'blur(48px)',
          animation:'nebDrift3 68s ease-in-out infinite',
        }} />

        {/* Sweeping nebula wisps — left→right */}
        <div style={{
          position:'absolute', width:'80vw', height:'32vh', top:'18%', left:'50%',
          background:'radial-gradient(ellipse at center, rgba(130,0,190,0.11) 0%, rgba(70,0,130,0.04) 60%, transparent 100%)',
          filter:'blur(38px)',
          animation:'nebSweep1 52s linear infinite',
          animationDelay:'-17s',
        }} />
        {/* Sweeping nebula wisps — right→left */}
        <div style={{
          position:'absolute', width:'68vw', height:'26vh', top:'58%', left:'50%',
          background:'radial-gradient(ellipse at center, rgba(0,140,170,0.10) 0%, rgba(0,70,110,0.04) 60%, transparent 100%)',
          filter:'blur(44px)',
          animation:'nebSweep2 66s linear infinite',
          animationDelay:'-30s',
        }} />
      </div>

      {/* ── Three.js canvas (transparent so background nebula shows through) */}
      <Canvas
        camera={{ position:[0,0,550], fov:60, near:1, far:3000 }}
        style={{ position:'absolute', inset:0, zIndex:2 }}
        gl={{ antialias:true, alpha:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1 }}
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
      >
        <GyroScene
          focusedIdx={focusedIdx}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onOrbClick={handleOrbClick}
          vortexTargetIdx={vortexTargetIdx}
          vortexProgress={vortexProgress}
          vortexPhase={vortexPhase}
          worldPosRef={worldPosRef}
          screenPosRef={screenPosRef}
          traverseRef={traverseRef}
        />
      </Canvas>

      {/* ── Foreground nebula wisps (in front of Canvas, behind UI) ──────── */}
      <div style={{ position:'absolute', inset:0, zIndex:3, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{
          position:'absolute', width:'55vw', height:'22vh', top:'8%', left:'50%',
          background:'radial-gradient(ellipse at center, rgba(210,100,0,0.09) 0%, rgba(140,50,0,0.03) 65%, transparent 100%)',
          filter:'blur(32px)',
          animation:'nebSweepFg 41s linear infinite',
          animationDelay:'-9s',
        }} />
        <div style={{
          position:'absolute', width:'48vw', height:'18vh', top:'65%', left:'50%',
          background:'radial-gradient(ellipse at center, rgba(0,180,150,0.08) 0%, transparent 65%)',
          filter:'blur(28px)',
          animation:'nebSweep1 35s linear infinite',
          animationDelay:'-24s',
        }} />
      </div>

      {/* ── Star trails (shooting stars) ──────────────────────────────────── */}
      <div style={{ position:'absolute', inset:0, zIndex:4, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{
          position:'absolute', top:'22%', left:0,
          width:'210px', height:'1.5px',
          background:'linear-gradient(90deg, transparent 0%, rgba(200,215,255,0.5) 30%, rgba(255,255,255,0.95) 70%, rgba(255,255,255,0.3) 88%, transparent 100%)',
          filter:'blur(0.5px)',
          animation:'stTrail1 26s linear infinite',
          animationDelay:'-4s',
        }} />
        <div style={{
          position:'absolute', top:'68%', left:0,
          width:'165px', height:'1px',
          background:'linear-gradient(90deg, transparent 0%, rgba(200,220,255,0.4) 25%, rgba(255,255,255,0.88) 68%, transparent 100%)',
          animation:'stTrail2 20s linear infinite',
          animationDelay:'-11s',
        }} />
        <div style={{
          position:'absolute', top:'42%', left:0,
          width:'245px', height:'2px',
          background:'linear-gradient(270deg, transparent 0%, rgba(210,230,255,0.5) 30%, rgba(255,255,255,0.92) 70%, rgba(255,255,255,0.2) 88%, transparent 100%)',
          filter:'blur(0.8px)',
          animation:'stTrail3 32s linear infinite',
          animationDelay:'-21s',
        }} />
        <div style={{
          position:'absolute', top:'80%', left:0,
          width:'135px', height:'1px',
          background:'linear-gradient(90deg, transparent 0%, rgba(180,200,255,0.35) 20%, rgba(255,255,255,0.80) 65%, transparent 100%)',
          animation:'stTrail4 22s linear infinite',
          animationDelay:'-14s',
        }} />
      </div>

      {/* Blue edge vignette */}
      <div style={{
        position:'fixed', inset:0, zIndex:5, pointerEvents:'none',
        background:`radial-gradient(ellipse at center, transparent 35%, rgba(0,10,60,${vig.toFixed(2)}) 100%)`,
        transition: vig === 0 ? 'background 0.6s' : 'none',
      }} />

      {/* Passage expansion overlay */}
      {vortexPhase === 'passage' && passCenter && (
        <div style={{
          position:'fixed',
          left: passCenter.x - 10,
          top:  passCenter.y - 10,
          width: 20, height: 20,
          borderRadius:'50%',
          background:'radial-gradient(circle at center, #8866ff 0%, #4422cc 35%, #110066 70%, #000010 100%)',
          transform:`scale(${vortexProgress * 130})`,
          transformOrigin:'center center',
          zIndex:170, pointerEvents:'none',
          opacity:vortexProgress, transition:'none',
        }} />
      )}

      {/* Flash */}
      <div style={{
        position:'fixed', inset:0, zIndex:190, pointerEvents:'none',
        background:'#4488ff',
        opacity: showFlash ? 1 : 0,
        transition: showFlash ? 'none' : 'opacity 80ms',
      }} />

      {/* Title */}
      <div style={{ position:'fixed', top:'22px', right:'24px', zIndex:40, pointerEvents:'none', textAlign:'right' }}>
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.40em', color:'rgba(212,180,80,0.55)', textTransform:'uppercase' }}>Vistāra</div>
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'8px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.18)', textTransform:'uppercase', marginTop:'3px' }}>The Manifestations</div>
      </div>

      {/* Back */}
      {onBack && (
        <button onClick={onBack} style={{ position:'fixed', top:'22px', left:'22px', zIndex:40, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color:'#9B59FF' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          <span style={{ fontFamily:'var(--font-vyan)', fontSize:11, letterSpacing:'0.2em', opacity:0.7 }}>ŚŪNYA MAṆḌALA</span>
        </button>
      )}

      {/* Hint */}
      <p style={{ position:'fixed', bottom:'5%', left:'50%', transform:'translateX(-50%)', zIndex:40, pointerEvents:'none', fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.25em', color:'rgba(255,255,255,0.10)', textTransform:'uppercase', margin:0, whiteSpace:'nowrap' }}>
        Scroll to traverse · Click focused orb to enter
      </p>

      {/* Focused orb indicator */}
      <div style={{ position:'fixed', bottom:'12%', left:'50%', transform:'translateX(-50%)', zIndex:40, pointerEvents:'none', textAlign:'center' }}>
        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
          {GATEWAYS.map((_, i) => (
            <div key={i} style={{
              width: i === focusedIdx ? 18 : 5,
              height: 3, borderRadius: 2,
              background: i === focusedIdx ? 'rgba(140,160,255,0.7)' : 'rgba(100,120,200,0.25)',
              transition: 'all 0.4s',
            }} />
          ))}
        </div>
      </div>

      {/* Glass panel */}
      {showPanel && panelGateway && (
        <GlassPanel gateway={panelGateway} onClose={handleClose} onEnter={handleEnter} />
      )}
    </div>
  )
}
