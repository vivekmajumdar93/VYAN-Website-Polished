'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GATEWAYS, type Gateway } from '@/lib/vistara/gateways'

// ─── gyroscope constants ──────────────────────────────────────────────────────
// index → { ring, localAngle } for GATEWAYS array order
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
const RING_SPEEDS = { A: 0.0008, B: 0.0006, C: 0.001 } as const  // rad/frame @60fps
const FRONT = Math.PI / 2   // ring angle that puts orb at max-Z (facing camera)
const TRAVERSE_MS = 600

// ─── helpers ──────────────────────────────────────────────────────────────────
function easeInExpo(t: number) { return t <= 0 ? 0 : Math.pow(2, 10 * t - 10) }
function easeInOutCubic(t: number) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2 }

function nearestTarget(current: number, raw: number): number {
  let d = (raw - current) % (2 * Math.PI)
  if (d > Math.PI)  d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return current + d
}

// ─── shard generation — grid-based tiles that together form the full panel ─────
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

  // Build jittered grid: interior vertices get randomness, edges stay fixed
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
      // clip path in % of panel dimensions — tiles perfectly to cover entire panel
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

// ─── bloom ────────────────────────────────────────────────────────────────────
function Bloom() {
  const { gl, scene, camera, size } = useThree()
  const comp = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 1.0, 0.6, 0.12))
    c.addPass(new OutputPass())
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])
  useEffect(() => { comp.setSize(size.width, size.height) }, [comp, size])
  useEffect(() => () => comp.dispose(), [comp])
  useFrame(() => comp.render(), 1)
  return null
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

  const groupRef    = useRef<THREE.Group>(null)
  const networkRef  = useRef<THREE.Group>(null)
  const nodeMatRef  = useRef<THREE.PointsMaterial>(null)
  const lineMatRef  = useRef<THREE.LineBasicMaterial>(null)
  const hov         = useRef(0)
  const scaleRef    = useRef(1)

  // ── particle network geometry (same visual language as NanoOrb / Shunya) ──
  const { nodeGeo, lineGeo } = useMemo(() => {
    const R  = orbSize
    const CA = new THREE.Color('#0014ff')   // blue   — NanoOrb colorA
    const CB = new THREE.Color('#8833ff')   // violet — NanoOrb colorB
    const N  = 90

    const npos: number[] = [], ncol: number[] = []
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = Math.pow(Math.random(), 0.65) * R
      npos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi))
      const c = CA.clone().lerp(CB, Math.random())
      ncol.push(c.r, c.g, c.b)
    }

    const lpos: number[] = [], lcol: number[] = []
    const maxD2 = (R * 0.85) * (R * 0.85)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = npos[i*3]-npos[j*3], dy = npos[i*3+1]-npos[j*3+1], dz = npos[i*3+2]-npos[j*3+2]
        if (dx*dx + dy*dy + dz*dz < maxD2) {
          lpos.push(npos[i*3], npos[i*3+1], npos[i*3+2], npos[j*3], npos[j*3+1], npos[j*3+2])
          lcol.push(ncol[i*3], ncol[i*3+1], ncol[i*3+2], ncol[j*3], ncol[j*3+1], ncol[j*3+2])
        }
      }
    }

    const nodeGeo = new THREE.BufferGeometry()
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(npos), 3))
    nodeGeo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(ncol), 3))

    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lpos), 3))
    lineGeo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(lcol), 3))

    return { nodeGeo, lineGeo }
  }, [orbSize])

  useFrame((_, delta) => {
    const hovTarget = isHovered || isFocused ? 1 : 0
    hov.current += (hovTarget - hov.current) * 0.08

    const focused  = isFocused ? 1 : 0.55
    const pullFade = isPulled && pullProgress > 0 ? Math.max(0, 1 - pullProgress) : 1

    if (nodeMatRef.current) nodeMatRef.current.opacity = 0.9  * focused * pullFade * (1 + hov.current * 0.25)
    if (lineMatRef.current) lineMatRef.current.opacity = 0.28 * focused * pullFade * (1 + hov.current * 0.40)

    // slow gyroscopic rotation of the network itself
    if (networkRef.current) {
      networkRef.current.rotation.y += delta * 0.28
      networkRef.current.rotation.x += delta * 0.09
    }

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

      const targetScale = 1 + (isFocused ? 0.15 : 0) + hov.current * 0.12
      scaleRef.current += (targetScale - scaleRef.current) * 0.08
      groupRef.current.scale.setScalar(scaleRef.current)
    }
  })

  return (
    <group ref={groupRef} position={basePos}>
      {/* Invisible hit sphere */}
      <mesh
        onPointerOver={e => { e.stopPropagation(); onHover(gateway.id) }}
        onPointerOut={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onClick(orbIdx, gateway.id) }}
      >
        <sphereGeometry args={[orbSize * 1.2, 8, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={networkRef}>
        {/* Connection web */}
        <lineSegments>
          <primitive object={lineGeo} attach="geometry" />
          <lineBasicMaterial ref={lineMatRef} vertexColors transparent opacity={0.28}
            blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>

        {/* Node particles */}
        <points>
          <primitive object={nodeGeo} attach="geometry" />
          <pointsMaterial ref={nodeMatRef} vertexColors size={orbSize * 0.07}
            transparent opacity={0.9} sizeAttenuation
            blending={THREE.AdditiveBlending} depthWrite={false} />
        </points>

        {/* Bright stardust core */}
        <mesh>
          <sphereGeometry args={[orbSize * 0.10, 6, 6]} />
          <meshBasicMaterial color="#aabbff" transparent opacity={0.95}
            blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      <Html center distanceFactor={250} occlude={false}
        position={[0, -(orbSize * 1.3), 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{
            fontSize: isFocused ? '12px' : '9px',
            letterSpacing: '0.25em',
            color: isFocused ? 'rgba(180,200,255,0.8)' : 'rgba(140,160,255,0.35)',
            textTransform: 'uppercase',
            fontFamily: 'system-ui',
            transition: 'all 0.3s',
          }}>{gateway.name}</div>
          {isFocused && (
            <div style={{
              fontSize: '8px',
              letterSpacing: '0.15em',
              color: 'rgba(140,160,255,0.45)',
              textTransform: 'uppercase',
              fontFamily: 'system-ui',
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

  useFrame((_, delta) => {
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

    // Camera
    if (vortexTargetIdx !== null && vortexProgress > 0) {
      const wp = worldPosRef.current[vortexTargetIdx]
      if (wp) {
        const t = easeInExpo(Math.min(vortexProgress, 1))
        camera.position.lerp(new THREE.Vector3(wp.x * 0.3, wp.y * 0.2, 550 - t * 350), t * 0.12)
        camera.lookAt(wp)
      }
    } else {
      camera.position.lerp(new THREE.Vector3(0, 0, 550), 0.04)
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
      <Bloom />
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

      {/* Shards — full-panel tiles that together form the glass surface */}
      <div style={{ position:'absolute', width:PANEL_W, height:PANEL_H, pointerEvents:'none', zIndex:3 }}>
        {shards.map((sh, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: 0, top: 0,
            width: '100%', height: '100%',
            background: `linear-gradient(${sh.gradAngle}deg,
              rgba(130,175,255,0.52) 0%,
              rgba(55,95,210,0.22) 45%,
              rgba(100,145,255,0.38) 100%)`,
            clipPath: sh.clipPath,
            // rotate/translate from the shard's own centre so pieces fly outward naturally
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
      // First click: bring to focus
      triggerTraverse(idx)
      setFocusedIdx(idx)
      return
    }
    // Second click: enter vortex
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

  // Vignette
  const vig = vortexPhase === 'pull' ? vortexProgress * 0.5
    : vortexPhase === 'peak' ? 0.5 + vortexProgress * 0.5
    : vortexPhase === 'passage' ? 1 : 0

  // Expansion overlay
  const passCenter = vortexTargetIdx !== null ? screenPosRef.current[vortexTargetIdx] : null

  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden', zIndex:100, background:'#000000' }}>
      <style>{`@keyframes fadeIn { from{opacity:0} to{opacity:1} }`}</style>

      <Canvas
        camera={{ position:[0,0,550], fov:60, near:1, far:3000 }}
        style={{ position:'absolute', inset:0 }}
        gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1 }}
        dpr={[1, 1.5]}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 1)
          scene.background = new THREE.Color(0x000000)
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
