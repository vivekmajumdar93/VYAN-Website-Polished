'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { NanoOrb } from '@/lib/vyan/objects/NanoOrb'
import { GATEWAYS, type Gateway } from '@/lib/vistara/gateways'
import { BackIcon, SendIcon, CloseIcon } from '@/components/icons/VyanIcons'

// ─── gyroscope constants ──────────────────────────────────────────────────────
const ORB_SIZES = [28, 24, 22, 30, 32, 26, 26, 34]

const ORB_CFG: { ring: 'A' | 'B' | 'C'; localAngle: number }[] = [
  { ring: 'A', localAngle: Math.PI / 2 },
  { ring: 'B', localAngle: Math.PI / 2 },
  { ring: 'C', localAngle: Math.PI / 2 },
  { ring: 'A', localAngle: Math.PI / 2 + (2 * Math.PI) / 3 },
  { ring: 'B', localAngle: Math.PI / 2 + (2 * Math.PI) / 3 },
  { ring: 'C', localAngle: Math.PI / 2 + Math.PI },
  { ring: 'B', localAngle: Math.PI / 2 + (4 * Math.PI) / 3 },
  { ring: 'A', localAngle: Math.PI / 2 + (4 * Math.PI) / 3 },
]

const RING_RADII = { A: 280, B: 240, C: 200 } as const
const RING_SPEEDS = { A: 0.0008, B: 0.0006, C: 0.001 } as const
const FRONT = Math.PI / 2
const TRAVERSE_MS = 600

// ─── phantom orb configs — distinct non-blue colors, different densities ─────
// scale must match main orb GYRO_SCALE range (orbSize * 0.15 ≈ 3.3–5.1)
const PHANTOM_CONFIGS = [
  { colorA: '#ff8820', colorB: '#ff5000', brightness: 0.50, scale: 3.6 },
  { colorA: '#00e8a8', colorB: '#00b870', brightness: 0.42, scale: 3.0 },
  { colorA: '#ff0050', colorB: '#cc0030', brightness: 0.52, scale: 4.2 },
] as const

// ─── stardust trail shaders ───────────────────────────────────────────────────
const TRAIL_N    = 120
const TRAIL_HEAD = 18     // bright head cluster
const TRAIL_FRAC = 0.28   // trail length as fraction of total path

const TRAIL_VERT = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mv;
  }
`
const TRAIL_FRAG = `
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, r)) * vAlpha;
    if (a < 0.01) discard;
    // warm tail → cool head gradient driven by brightness
    vec3 col = mix(vec3(1.0, 0.86, 0.68), vec3(0.88, 0.94, 1.0), vAlpha);
    gl_FragColor = vec4(col, a);
  }
`

// ─── saturn ring shaders ──────────────────────────────────────────────────────
const SATURN_VERT = `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uTilt;
  varying float vAlpha;
  void main() {
    float theta = atan(position.y, position.x);
    float w1 = 0.5 + 0.5 * sin(theta *  2.0 + uTime * 0.18 + aPhase);
    float w2 = 0.5 + 0.5 * sin(theta *  6.0 - uTime * 0.11 + aPhase * 2.3);
    float w3 = 0.5 + 0.5 * sin(theta * 14.0 + uTime * 0.27 + aPhase * 5.0);
    float gap = 0.75 + 0.25 * sin(theta * 1.5 + uTime * 0.04);
    float density = w1 * (0.4 + 0.6 * w2) * (0.65 + 0.35 * w3) * gap;
    vAlpha = clamp(density * (0.35 + abs(uTilt) * 2.5), 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (550.0 / max(-mv.z, 1.0));
    gl_Position  = projectionMatrix * mv;
  }
`
const SATURN_FRAG = `
  uniform float uTime;
  varying float vAlpha;
  void main() {
    float r    = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float disc = 1.0 - smoothstep(0.05, 0.9, r);
    float sprk = exp(-r * r * 7.0);
    float a    = (disc * 0.6 + sprk * 0.4) * vAlpha;
    if (a < 0.008) discard;
    float cycle = mod(uTime * 0.05, 3.0);
    vec3 red    = vec3(0.95, 0.07, 0.04);
    vec3 dblue  = vec3(0.02, 0.15, 0.95);
    vec3 purple = vec3(0.38, 0.02, 0.62);
    vec3 col;
    if      (cycle < 1.0) { col = mix(red,    dblue,  cycle);       }
    else if (cycle < 2.0) { col = mix(dblue,  purple, cycle - 1.0); }
    else                  { col = mix(purple, red,    cycle - 2.0); }
    gl_FragColor = vec4(col, a);
  }
`
function createSaturnRingGeo(radius: number): THREE.BufferGeometry {
  const COUNT  = 2200
  const geo    = new THREE.BufferGeometry()
  const pos    = new Float32Array(COUNT * 3)
  const sz     = new Float32Array(COUNT)
  const ph     = new Float32Array(COUNT)
  const rInner = radius * 0.78
  const rOuter = radius * 1.22
  for (let i = 0; i < COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const u     = Math.random()
    const r     = u < 0.22
      ? rInner + Math.random() * radius * 0.12
      : u > 0.78
        ? rOuter - Math.random() * radius * 0.12
        : rInner + Math.random() * (rOuter - rInner)
    pos[i*3]   = r * Math.cos(angle)
    pos[i*3+1] = r * Math.sin(angle)
    pos[i*3+2] = (Math.random() - 0.5) * 4
    sz[i]      = 1.5 + Math.random() * 3.5
    ph[i]      = Math.random() * Math.PI * 2
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sz,  1))
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(ph,  1))
  return geo
}

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

// ─── particle field ───────────────────────────────────────────────────────────
function ParticleField({ spiralTarget, spiralT }: { spiralTarget: THREE.Vector3 | null; spiralT: number }) {
  const ptsRef = useRef<THREE.Points>(null)
  const { base, spd, ph } = useMemo(() => {
    const base: number[] = [], spd: number[] = [], ph: number[] = []
    for (let i = 0; i < 300; i++) {
      base.push((Math.random()-0.5)*900, (Math.random()-0.5)*600, (Math.random()-0.5)*500-100)
      spd.push(0.2 + Math.random() * 0.8); ph.push(Math.random() * Math.PI * 2)
    }
    return { base, spd, ph }
  }, [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(300 * 3)
    for (let i = 0; i < 300; i++) { p[i*3]=base[i*3]; p[i*3+1]=base[i*3+1]; p[i*3+2]=base[i*3+2] }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g
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

// ─── phantom passing orbs — same NanoOrb structure, different colors/depths ──
function randomPhantomPath(pd: { x0:number;y0:number;z0:number;x1:number;y1:number;z1:number }) {
  const rx = () => (Math.random() - 0.5) * 340
  const rz = () => (Math.random() - 0.5) * 500
  // Pick one of 8 trajectory types for gyroscopic variety
  const type = Math.floor(Math.random() * 8)
  const d = rz()
  switch (type) {
    case 0: pd.x0=-820;pd.y0=rx();pd.z0=d;  pd.x1=820; pd.y1=rx();pd.z1=d+(Math.random()-0.5)*80;  break // L→R
    case 1: pd.x0=820; pd.y0=rx();pd.z0=d;  pd.x1=-820;pd.y1=rx();pd.z1=d+(Math.random()-0.5)*80;  break // R→L
    case 2: pd.x0=rx();pd.y0=520; pd.z0=d;  pd.x1=rx();pd.y1=-520;pd.z1=d+(Math.random()-0.5)*80;  break // T→B
    case 3: pd.x0=rx();pd.y0=-520;pd.z0=d;  pd.x1=rx();pd.y1=520; pd.z1=d+(Math.random()-0.5)*80;  break // B→T
    case 4: pd.x0=-820;pd.y0=440; pd.z0=rz();pd.x1=820;pd.y1=-440;pd.z1=rz();                       break // diag NW→SE
    case 5: pd.x0=820; pd.y0=-440;pd.z0=rz();pd.x1=-820;pd.y1=440;pd.z1=rz();                       break // diag SE→NW
    case 6: pd.x0=-820;pd.y0=-440;pd.z0=rz();pd.x1=600; pd.y1=360;pd.z1=rz();                       break // diag SW→NE arc
    default:pd.x0=820; pd.y0=440; pd.z0=rz();pd.x1=-600;pd.y1=-360;pd.z1=rz();                      break // diag NE→SW arc
  }
}

function PhantomOrbsSystem({ onPhantomClick }: { onPhantomClick: () => void }) {
  const clickMeshRefs = [
    useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null),
  ]

  const pool = useMemo(() => {
    return PHANTOM_CONFIGS.map((cfg, i) => {
      const no = new NanoOrb({
        id: `phantom-${i}`, title: '', subtitle: '', description: '',
        colorA: cfg.colorA, colorB: cfg.colorB,
      })
      no.setVisible(true)
      no.group.visible = false
      return {
        nanoOrb: no, posVec: new THREE.Vector3(),
        brightness: cfg.brightness, scale: cfg.scale,
        active: false, startT: 0,
        nextT: 4 + i * 10,  // staggered: 4s, 14s, 24s
        duration: 0,
        x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0,
      }
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    pool.forEach((pd, i) => {
      if (!pd.active) {
        if (t >= pd.nextT) {
          randomPhantomPath(pd)
          pd.startT = t
          pd.duration = 14 + Math.random() * 10   // 14–24 s slow cross
          pd.nextT = t + pd.duration + 8 + Math.random() * 12
          pd.active = true
          pd.nanoOrb.group.visible = true
          pd.nanoOrb.setSignal('idle')
        } else {
          if (clickMeshRefs[i].current) clickMeshRefs[i].current!.visible = false
          return
        }
      }

      const p = Math.min((t - pd.startT) / pd.duration, 1)
      if (p >= 1) {
        pd.active = false
        pd.nanoOrb.group.visible = false
        if (clickMeshRefs[i].current) clickMeshRefs[i].current!.visible = false
        return
      }

      const alpha = Math.sin(Math.PI * p)
      pd.posVec.set(
        pd.x0 + (pd.x1 - pd.x0) * p,
        pd.y0 + (pd.y1 - pd.y0) * p,
        pd.z0 + (pd.z1 - pd.z0) * p,
      )
      pd.nanoOrb.setVisualDim(alpha * pd.brightness)
      pd.nanoOrb.update(t, 0, false, false, 0.55, 0.8, pd.posVec)
      pd.nanoOrb.group.scale.multiplyScalar(pd.scale)

      // Keep invisible click sphere co-located with the orb
      if (clickMeshRefs[i].current) {
        clickMeshRefs[i].current!.position.copy(pd.posVec)
        clickMeshRefs[i].current!.visible = true
      }
    })
  })

  return (
    <>
      {pool.map((pd, i) => <primitive key={i} object={pd.nanoOrb.group} />)}
      {PHANTOM_CONFIGS.map((_, i) => (
        <mesh key={`pc-${i}`} ref={clickMeshRefs[i]} visible={false}
          onClick={e => { e.stopPropagation(); onPhantomClick() }}>
          <sphereGeometry args={[28, 8, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}
    </>
  )
}

// ─── stardust star trails — Three.js ShaderMaterial with per-vertex glow ────
function StarTrailsSystem() {
  const parentRef = useRef<THREE.Group>(null)

  const trails = useMemo(() => {
    const N = TRAIL_N
    return Array.from({ length: 6 }, (_, i) => {
      const positions = new Float32Array(N * 3)
      const sizes     = new Float32Array(N)
      const alphas    = new Float32Array(N)
      const phases    = new Float32Array(N)
      const scatterX  = new Float32Array(N)
      const scatterY  = new Float32Array(N)

      for (let j = 0; j < N; j++) {
        positions[j*3] = -5000  // park off-scene
        phases[j] = Math.random() * Math.PI * 2
      }

      const geo = new THREE.BufferGeometry()
      const pA = new THREE.BufferAttribute(positions, 3)
      const sA = new THREE.BufferAttribute(sizes, 1)
      const aA = new THREE.BufferAttribute(alphas, 1)
      geo.setAttribute('position', pA)
      geo.setAttribute('aSize',    sA)
      geo.setAttribute('aAlpha',   aA)

      const mat = new THREE.ShaderMaterial({
        vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })

      return {
        points: new THREE.Points(geo, mat),
        posAttr: pA, sizeAttr: sA, alphaAttr: aA,
        phases, scatterX, scatterY,
        active: false, startT: 0,
        nextT: i * 3 + 1,   // 1s, 4s, 7s, 10s, 13s, 16s
        duration: 0,
        x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0,
      }
    })
  }, [])

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return
    trails.forEach(tr => parent.add(tr.points))
    return () => { trails.forEach(tr => parent.remove(tr.points)) }
  }, [trails])

  useFrame(({ clock }) => {
    const t  = clock.elapsedTime
    const N  = TRAIL_N
    const H  = TRAIL_HEAD

    for (const td of trails) {
      if (!td.active) {
        if (t >= td.nextT) {
          // Randomize angle: horizontal, diagonal, or steep diagonal
          const depth = 300 + Math.random() * 150  // z 300-450, close to camera
          const angle = (Math.random() - 0.5) * Math.PI * 0.6 // ±54°
          const len = 900
          const cx = (Math.random() - 0.5) * 200
          const cy = (Math.random() - 0.5) * 200
          td.x0 = cx - Math.cos(angle)*len; td.y0 = cy - Math.sin(angle)*len; td.z0 = depth
          td.x1 = cx + Math.cos(angle)*len; td.y1 = cy + Math.sin(angle)*len; td.z1 = depth+(Math.random()-0.5)*40
          td.startT  = t
          td.duration = 1.8 + Math.random() * 1.4
          td.nextT   = t + td.duration + 6 + Math.random() * 10
          td.active  = true
          // Fresh scatter for this pass
          for (let j = 0; j < N; j++) {
            const isH = j < H
            const tT  = isH ? 0 : (j - H) / (N - H)
            const sp  = isH ? 4 : 13 * tT
            td.scatterX[j] = (Math.random()-0.5) * sp * 2
            td.scatterY[j] = (Math.random()-0.5) * sp * 2
          }
        } else {
          for (let j = 0; j < N; j++) td.alphaAttr.setX(j, 0)
          td.alphaAttr.needsUpdate = true
          continue
        }
      }

      const p = Math.min((t - td.startT) / td.duration, 1)
      if (p >= 1) {
        td.active = false
        for (let j = 0; j < N; j++) td.alphaAttr.setX(j, 0)
        td.alphaAttr.needsUpdate = true
        continue
      }

      // Global fade-in 8%, fade-out 12%
      const env = Math.min(p / 0.08, 1) * Math.min((1 - p) / 0.12, 1)

      for (let j = 0; j < N; j++) {
        const isH  = j < H
        const tT   = isH ? j / H : (j - H) / (N - H)
        const pLoc = isH ? p : p - tT * TRAIL_FRAC

        if (pLoc < 0) {
          td.posAttr.setXYZ(j, -5000, 0, 0)
          td.alphaAttr.setX(j, 0)
          continue
        }

        const cp = Math.min(pLoc, 1)
        const bx = td.x0 + (td.x1 - td.x0) * cp
        const by = td.y0 + (td.y1 - td.y0) * cp
        const bz = td.z0 + (td.z1 - td.z0) * cp

        // Shimmer — gives particles the micro-oscillation / twinkle
        const sh  = Math.sin(t * 8   + td.phases[j])       * 2.8
        const sh2 = Math.cos(t * 6   + td.phases[j] * 1.4) * 2.8

        td.posAttr.setXYZ(j, bx + td.scatterX[j] + sh, by + td.scatterY[j] + sh2, bz)

        // Size and brightness taper from head to tail
        let sz: number, baseA: number
        if (isH) {
          sz    = 8.0 - tT * 3.0     // head cluster: 8→5 px
          baseA = 1.0 - tT * 0.15    // head: 1.0→0.85
        } else {
          sz    = 4.5 - tT * 3.8     // body: 4.5→0.7 px
          baseA = 0.9 - tT * 0.8     // body: 0.9→0.1
        }
        td.sizeAttr.setX(j, Math.max(0.5, sz))
        td.alphaAttr.setX(j, Math.max(0, baseA) * env)
      }

      td.posAttr.needsUpdate = true
      td.sizeAttr.needsUpdate = true
      td.alphaAttr.needsUpdate = true
    }
  })

  return <group ref={parentRef} />
}

// ─── screen position tracker ──────────────────────────────────────────────────
function ScreenTracker({ worldRef, screenRef }: {
  worldRef:  React.MutableRefObject<Record<number, THREE.Vector3>>
  screenRef: React.MutableRefObject<Record<number, { x: number; y: number }>>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    for (let i = 0; i < 8; i++) {
      const wp = worldRef.current[i]; if (!wp) continue
      v.copy(wp).project(camera)
      screenRef.current[i] = { x: (v.x+1)/2*size.width, y: (-v.y+1)/2*size.height }
    }
  })
  return null
}

// ─── vistara orb ─────────────────────────────────────────────────────────────
interface VistaraOrbProps {
  gateway: Gateway; orbIdx: number; orbSize: number
  ringType: 'A' | 'B' | 'C'; localAngle: number; ringRadius: number
  isFocused: boolean; isHovered: boolean; panelOpen: boolean
  isPulled: boolean; pullProgress: number; pullTarget: THREE.Vector3 | null
  onHover: (id: string | null) => void
  onClick: (idx: number, id: string) => void
  worldPosRef: React.MutableRefObject<Record<number, THREE.Vector3>>
}

function VistaraOrb({
  gateway, orbIdx, orbSize, ringType, localAngle, ringRadius,
  isFocused, isHovered, panelOpen, isPulled, pullProgress, pullTarget,
  onHover, onClick, worldPosRef,
}: VistaraOrbProps) {
  const basePos = useMemo<[number,number,number]>(() => {
    if (ringType === 'B') return [0, ringRadius*Math.cos(localAngle), ringRadius*Math.sin(localAngle)]
    return [ringRadius*Math.cos(localAngle), 0, ringRadius*Math.sin(localAngle)]
  }, [ringType, localAngle, ringRadius])

  const groupRef  = useRef<THREE.Group>(null)
  const ZERO      = useMemo(() => new THREE.Vector3(), [])
  // Animated scale: smoothly grows larger when focused so the orb appears thrown toward the lens
  const scaleRef      = useRef(orbSize * 0.15)
  const burstRef      = useRef(-10)
  const prevPanelOpen = useRef(false)

  const nanoOrb = useMemo(() => {
    const inst = new NanoOrb({
      id: gateway.id, title: gateway.name, subtitle: gateway.tagline,
      description: gateway.description, colorA: '#0033ff', colorB: '#0077ff',
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
    // Focused orb always significantly brighter — non-focused dim to not overpower focused label
    nanoOrb.setVisualDim(isFocused || isHovered ? 1 : 0.28)

    nanoOrb.update(t, isHovered ? 0.5 : 0, isFocused, false, isFocused ? 1 : 0.10, 1, ZERO)

    // On panel open for this orb: fire a sin-bell burst so the node web appears
    // to unfold outward — glass shards are timed to begin assembling at the peak
    if (isFocused && panelOpen && !prevPanelOpen.current) burstRef.current = t
    prevPanelOpen.current = isFocused && panelOpen
    const bp    = Math.min((t - burstRef.current) / 0.65, 1)
    const burst = isFocused ? Math.sin(Math.PI * bp) * (orbSize * 1.0) : 0
    const targetScale = orbSize * (isFocused ? 0.22 : 0.15) + burst
    scaleRef.current += (targetScale - scaleRef.current) * 0.06
    nanoOrb.group.scale.multiplyScalar(scaleRef.current)

    if (groupRef.current) {
      const wp = new THREE.Vector3()
      groupRef.current.getWorldPosition(wp)
      worldPosRef.current[orbIdx] = wp
      if (isPulled && pullTarget && pullProgress > 0) {
        groupRef.current.position.lerp(pullTarget, pullProgress * pullProgress * 0.05)
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
      {/* φ name — one letter per line, column bisects orb center */}
      <Html center occlude={false} distanceFactor={380}
        position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {Array.from(gateway.name).map((char, i) => (
            <span key={i} style={{
              display: 'block',
              textAlign: 'center',
              fontSize: isFocused ? '28px' : '20px',
              lineHeight: '1.15',
              color: isFocused ? '#ff4040' : 'rgba(210,40,40,0.85)',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-vyan)',
              transition: 'color 0.3s, font-size 0.3s',
              textShadow: isFocused
                ? '0 0 28px rgba(255,50,50,0.85), 0 0 10px rgba(180,0,0,0.65)'
                : '0 0 12px rgba(180,20,20,0.55)',
            }}>{char}</span>
          ))}
        </div>
      </Html>
      {/* φ tagline — horizontal, below orb, fades when not focused */}
      <Html center occlude={false} distanceFactor={380}
        position={[0, -(orbSize * 1.8), 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          textAlign: 'center',
          maxWidth: 'clamp(130px, 38vw, 260px)',
          wordBreak: 'break-word',
          whiteSpace: 'normal',
          fontSize: 'clamp(10px, min(1.6vw, 2.8vh), 15px)',
          letterSpacing: '0.12em',
          lineHeight: '1.4',
          color: 'rgba(255,120,100,0.85)',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-vyan)',
          opacity: isFocused ? 1 : 0,
          transition: 'opacity 0.4s',
        }}>{gateway.tagline}</div>
      </Html>
    </group>
  )
}

// ─── gyroscope scene ─────────────────────────────────────────────────────────
interface GyroSceneProps {
  focusedIdx: number; hoveredId: string | null
  onHover: (id: string | null) => void; onOrbClick: (idx: number, id: string) => void
  vortexTargetIdx: number | null; vortexProgressRef: React.MutableRefObject<number>; vortexPhase: VortexPhase
  worldPosRef: React.MutableRefObject<Record<number, THREE.Vector3>>
  screenPosRef: React.MutableRefObject<Record<number, { x: number; y: number }>>
  traverseRef: React.MutableRefObject<TraverseState>
  panelOpen: boolean
  onPhantomClick: () => void
}

function GyroScene({
  focusedIdx, hoveredId, onHover, onOrbClick,
  vortexTargetIdx, vortexProgressRef, vortexPhase,
  worldPosRef, screenPosRef, traverseRef, panelOpen, onPhantomClick,
}: GyroSceneProps) {
  const ringARef = useRef<THREE.Group>(null)
  const ringBRef = useRef<THREE.Group>(null)
  const ringCRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const lookAt       = useRef(new THREE.Vector3())
  const anglesRef    = useRef({ A: 0, B: 0, C: 0 })
  const prevFocusRef = useRef(focusedIdx)
  const throwRef     = useRef({ startT: -10 })

  // ── Saturn ring materials — one per ring so uniforms are independent ──
  const ringAMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SATURN_VERT, fragmentShader: SATURN_FRAG,
    uniforms: { uTime: { value: 0 }, uTilt: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])
  const ringBMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SATURN_VERT, fragmentShader: SATURN_FRAG,
    uniforms: { uTime: { value: 0 }, uTilt: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])
  const ringCMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SATURN_VERT, fragmentShader: SATURN_FRAG,
    uniforms: { uTime: { value: 0 }, uTilt: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])
  const ringAGeo = useMemo(() => createSaturnRingGeo(RING_RADII.A), [])
  const ringBGeo = useMemo(() => createSaturnRingGeo(RING_RADII.B), [])
  const ringCGeo = useMemo(() => createSaturnRingGeo(RING_RADII.C), [])

  useFrame(({ clock }, delta) => {
    const t   = clock.elapsedTime
    const tr  = traverseRef.current
    const frac60 = delta * 60

    if (tr.active) {
      const elapsed = Date.now() - tr.startTime
      const p = easeInOutCubic(Math.min(elapsed / TRAVERSE_MS, 1))
      const s = 0.2 * frac60
      anglesRef.current.A = tr.ringAActive ? tr.ringAStart + (tr.ringATarget - tr.ringAStart)*p : anglesRef.current.A + RING_SPEEDS.A*s
      anglesRef.current.B = tr.ringBActive ? tr.ringBStart + (tr.ringBTarget - tr.ringBStart)*p : anglesRef.current.B + RING_SPEEDS.B*s
      anglesRef.current.C = tr.ringCActive ? tr.ringCStart + (tr.ringCTarget - tr.ringCStart)*p : anglesRef.current.C + RING_SPEEDS.C*s
      if (elapsed >= TRAVERSE_MS) tr.active = false
    } else {
      anglesRef.current.A += RING_SPEEDS.A * frac60
      anglesRef.current.B += RING_SPEEDS.B * frac60
      anglesRef.current.C += RING_SPEEDS.C * frac60
    }

    // Primary spin axes + slow precession drifts → rings sweep through diagonal space
    // Each ring gets 2 secondary drift axes at incommensurate frequencies so they
    // never lock into horizontal/vertical planes.
    if (ringARef.current) ringARef.current.rotation.set(
      Math.sin(t * 0.17) * 0.22,   // X drift — tilts A's spin axis diagonally
      anglesRef.current.A,           // primary Y spin
      Math.cos(t * 0.13) * 0.15,   // Z drift — adds roll precession
    )
    if (ringBRef.current) ringBRef.current.rotation.set(
      anglesRef.current.B,           // primary X spin
      Math.cos(t * 0.19) * 0.16,   // Y drift — yaw precession
      Math.sin(t * 0.14) * 0.20,   // Z drift — tilts B's spin axis diagonally
    )
    if (ringCRef.current) ringCRef.current.rotation.set(
      Math.cos(t * 0.22) * 0.10,   // X drift — stacks with inner 45° static tilt
      Math.sin(t * 0.11) * 0.18,   // Y drift — sweeps C through oblique planes
      anglesRef.current.C,           // primary Z spin
    )

    // Saturn ring colour/density — tilt magnitude drives particle visibility
    ringAMat.uniforms.uTime.value = t
    ringAMat.uniforms.uTilt.value = Math.abs(Math.sin(t * 0.17) * 0.22) + Math.abs(Math.cos(t * 0.13) * 0.15)
    ringBMat.uniforms.uTime.value = t
    ringBMat.uniforms.uTilt.value = Math.abs(Math.cos(t * 0.19) * 0.16) + Math.abs(Math.sin(t * 0.14) * 0.20)
    ringCMat.uniforms.uTime.value = t
    ringCMat.uniforms.uTilt.value = Math.abs(Math.cos(t * 0.22) * 0.10) + Math.abs(Math.sin(t * 0.11) * 0.18)

    // Camera throw when focus changes — orb appears to jump toward lens
    if (prevFocusRef.current !== focusedIdx) {
      prevFocusRef.current = focusedIdx
      throwRef.current.startT = clock.elapsedTime
    }
    const tp     = Math.min((clock.elapsedTime - throwRef.current.startT) / 0.75, 1)
    const throwZ = Math.sin(Math.PI * tp) * 72

    const vp = vortexProgressRef.current
    if (vortexTargetIdx !== null && vp > 0) {
      const wp = worldPosRef.current[vortexTargetIdx]
      if (wp) {
        const t2 = easeInExpo(Math.min(vp, 1))
        camera.position.lerp(new THREE.Vector3(wp.x*0.3, wp.y*0.2, 550 - t2*350), t2*0.12)
        camera.lookAt(wp)
      }
    } else {
      camera.position.lerp(new THREE.Vector3(0, 0, 550 - throwZ), tp < 1 ? 0.18 : 0.04)
      const wp = worldPosRef.current[focusedIdx]
      if (wp) lookAt.current.lerp(wp, 0.04)
      else lookAt.current.lerp(new THREE.Vector3(), 0.04)
      camera.lookAt(lookAt.current)
    }
  })

  const spiralTarget = vortexTargetIdx !== null ? (worldPosRef.current[vortexTargetIdx] ?? null) : null
  const spiralT = vortexPhase==='pull' ? vortexProgressRef.current : (vortexPhase==='peak'||vortexPhase==='passage') ? 1 : 0


  return (
    <>
      <ambientLight intensity={0.04} />
      <ParticleField spiralTarget={spiralTarget} spiralT={spiralT} />
      <PhantomOrbsSystem onPhantomClick={onPhantomClick} />
      <StarTrailsSystem />

      <group ref={ringARef}>
        <points rotation={[Math.PI/2, 0, 0]} geometry={ringAGeo}>
          <primitive object={ringAMat} attach="material" />
        </points>
        {[0, 3, 7].map(idx => (
          <VistaraOrb key={idx} gateway={GATEWAYS[idx]} orbIdx={idx} orbSize={ORB_SIZES[idx]}
            ringType="A" localAngle={ORB_CFG[idx].localAngle} ringRadius={RING_RADII.A}
            isFocused={focusedIdx===idx} isHovered={hoveredId===GATEWAYS[idx].id}
            panelOpen={panelOpen && focusedIdx===idx}
            isPulled={vortexTargetIdx!==null&&vortexTargetIdx!==idx}
            pullProgress={vortexTargetIdx!==null&&vortexTargetIdx!==idx?vortexProgressRef.current:0}
            pullTarget={vortexTargetIdx!==null?(worldPosRef.current[vortexTargetIdx]??null):null}
            onHover={onHover} onClick={onOrbClick} worldPosRef={worldPosRef} />
        ))}
      </group>

      <group ref={ringBRef}>
        <points rotation={[0, Math.PI/2, 0]} geometry={ringBGeo}>
          <primitive object={ringBMat} attach="material" />
        </points>
        {[1, 4, 6].map(idx => (
          <VistaraOrb key={idx} gateway={GATEWAYS[idx]} orbIdx={idx} orbSize={ORB_SIZES[idx]}
            ringType="B" localAngle={ORB_CFG[idx].localAngle} ringRadius={RING_RADII.B}
            isFocused={focusedIdx===idx} isHovered={hoveredId===GATEWAYS[idx].id}
            panelOpen={panelOpen && focusedIdx===idx}
            isPulled={vortexTargetIdx!==null&&vortexTargetIdx!==idx}
            pullProgress={vortexTargetIdx!==null&&vortexTargetIdx!==idx?vortexProgressRef.current:0}
            pullTarget={vortexTargetIdx!==null?(worldPosRef.current[vortexTargetIdx]??null):null}
            onHover={onHover} onClick={onOrbClick} worldPosRef={worldPosRef} />
        ))}
      </group>

      <group ref={ringCRef}>
        <group rotation={[Math.PI/4, 0, 0]}>
          <points rotation={[Math.PI/2, 0, 0]} geometry={ringCGeo}>
            <primitive object={ringCMat} attach="material" />
          </points>
          {[2, 5].map(idx => (
            <VistaraOrb key={idx} gateway={GATEWAYS[idx]} orbIdx={idx} orbSize={ORB_SIZES[idx]}
              ringType="C" localAngle={ORB_CFG[idx].localAngle} ringRadius={RING_RADII.C}
              isFocused={focusedIdx===idx} isHovered={hoveredId===GATEWAYS[idx].id}
              panelOpen={panelOpen && focusedIdx===idx}
              isPulled={vortexTargetIdx!==null&&vortexTargetIdx!==idx}
              pullProgress={vortexTargetIdx!==null&&vortexTargetIdx!==idx?vortexProgressRef.current:0}
              pullTarget={vortexTargetIdx!==null?(worldPosRef.current[vortexTargetIdx]??null):null}
              onHover={onHover} onClick={onOrbClick} worldPosRef={worldPosRef} />
          ))}
        </group>
      </group>

      <ScreenTracker worldRef={worldPosRef} screenRef={screenPosRef} />
    </>
  )
}

// ─── glass panel ─────────────────────────────────────────────────────────────
type PanelPhase = 'opening' | 'open' | 'closing'

function GlassPanel({ gateway, onClose, onEnter }: {
  gateway: Gateway; onClose: () => void; onEnter: () => void
}) {
  const [phase, setPhase] = useState<PanelPhase>('opening')
  const [contentVisible, setContentVisible] = useState(false)

  useEffect(() => {
    // 200ms delay lets the node-web burst peak before panel starts fading in
    const t1 = setTimeout(() => { setPhase('open'); setContentVisible(true) }, 600)
    return () => clearTimeout(t1)
  }, [])

  const handleClose = useCallback(() => {
    setContentVisible(false); setPhase('closing')
    setTimeout(onClose, 300)
  }, [onClose])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      {/* Overlay — single fade, no animation cost */}
      <div onClick={handleClose} style={{
        position:'absolute', inset:0, background:'rgba(0,0,0,0.82)',
        opacity: phase === 'closing' ? 0 : 1, transition:'opacity 280ms',
      }} />

      {/* Panel shell — the ONLY element that animates. One GPU compositing layer. */}
      <div style={{
        position:'relative', zIndex:2, width:PANEL_W, maxWidth:'calc(100vw - 48px)',
        borderRadius:'20px', overflow:'hidden',
        transform: phase === 'open'
          ? 'scale(1) translateY(0px)'
          : phase === 'opening' ? 'scale(0.88) translateY(16px)'
          : 'scale(0.96) translateY(-8px)',
        opacity: phase === 'open' ? 1 : 0,
        transition: phase === 'closing'
          ? 'transform 260ms cubic-bezier(0.4,0,1,1), opacity 240ms'
          : 'transform 500ms cubic-bezier(0.34,1.15,0.64,1) 200ms, opacity 400ms 200ms',
        willChange: 'transform, opacity',
      }}>
        {/* Glass sheen — single div, multi-angle gradients, zero clipPath */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:1,
          background:`
            linear-gradient(22deg,  rgba(140,185,255,0.08) 0%, transparent 55%),
            linear-gradient(158deg, rgba(60,100,210,0.06)  0%, transparent 55%),
            linear-gradient(70deg,  rgba(110,160,255,0.05) 20%, transparent 65%),
            linear-gradient(250deg, rgba(80,130,220,0.04)  10%, transparent 50%)
          `,
        }} />

        {/* Content box — solid background, no backdropFilter */}
        <div style={{
          position:'relative', zIndex:2, padding:'34px',
          background:'rgba(5,10,36,0.88)',
          border:'1px solid rgba(80,140,255,0.22)',
          borderRadius:'20px',
          boxShadow:'0 0 80px rgba(40,80,200,0.18), inset 0 0 40px rgba(20,40,120,0.12)',
        }}>
          <div style={{ position:'absolute', top:0, left:'12%', right:'12%', height:'1px',
            background:`linear-gradient(90deg,transparent,${gateway.color}60,transparent)` }} />
          {/* Close icon — top right corner */}
          <button onClick={handleClose} style={{
            position:'absolute', top:'14px', right:'14px', zIndex:3,
            background:'none', border:'none', cursor:'pointer', padding:'4px',
            opacity: contentVisible ? 0.55 : 0, transition:'opacity 0.3s',
            lineHeight:0,
          }}>
            <CloseIcon size={22} />
          </button>
          <div style={{ opacity: contentVisible ? 1 : 0, transition:'opacity 0.3s 0.1s' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.28em', color:gateway.color,
              fontFamily:'var(--font-vyan)', textTransform:'uppercase', marginBottom:'7px' }}>{gateway.tantra}</div>
            <h2 style={{ fontFamily:'var(--font-vyan)', fontSize:'24px', letterSpacing:'0.18em',
              color:'rgba(255,255,255,0.92)', textTransform:'uppercase', margin:'0 0 6px' }}>{gateway.name}</h2>
            <p style={{ fontSize:'10px', letterSpacing:'0.15em', color:`${gateway.color}b3`,
              textTransform:'uppercase', fontFamily:'var(--font-vyan)', margin:'0 0 22px' }}>{gateway.tagline}</p>
            <p style={{ fontSize:'14px', lineHeight:'1.75', color:'rgba(255,255,255,0.58)',
              fontFamily:'var(--font-vyan)', letterSpacing:'0.02em', margin:'0 0 28px' }}>{gateway.description}</p>

            {/* ── LIVE APP SLOT ── Set gateway.appUrl to embed a live app here ── */}
            {gateway.appUrl && (
              <div style={{ marginBottom:'28px', borderRadius:'12px', overflow:'hidden',
                border:'1px solid rgba(80,140,255,0.18)', background:'rgba(0,2,18,0.60)' }}>
                <iframe
                  src={gateway.appUrl}
                  title={`${gateway.name} live app`}
                  style={{ width:'100%', height:'280px', border:'none', display:'block' }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  loading="lazy"
                />
              </div>
            )}

            <div style={{ display:'flex', gap:'12px' }}>
              <button onClick={handleClose} style={{ flex:1, padding:'12px',
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:'10px', color:'rgba(255,255,255,0.45)', fontSize:'10px',
                letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-vyan)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                <BackIcon size={18} />Return
              </button>
              <button onClick={onEnter} style={{ padding:'12px 26px',
                background:`${gateway.color}26`, border:`1px solid ${gateway.color}60`,
                borderRadius:'10px', color:gateway.color, fontSize:'10px',
                letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-vyan)',
                cursor:'pointer', boxShadow:`0 0 20px ${gateway.color}1f`,
                display:'flex', alignItems:'center', gap:'8px' }}>
                <SendIcon size={18} />Enter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── coming soon panel ───────────────────────────────────────────────────────
function ComingSoonPanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<PanelPhase>('opening')
  useEffect(() => {
    const t = setTimeout(() => setPhase('open'), 600)
    return () => clearTimeout(t)
  }, [])
  const handleClose = useCallback(() => { setPhase('closing'); setTimeout(onClose, 300) }, [onClose])
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div onClick={handleClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.82)', opacity: phase==='closing'?0:1, transition:'opacity 280ms' }} />
      <div style={{
        position:'relative', zIndex:2, width:380, maxWidth:'calc(100vw - 48px)',
        borderRadius:'20px', overflow:'hidden', textAlign:'center',
        transform: phase==='open' ? 'scale(1) translateY(0px)' : phase==='opening' ? 'scale(0.88) translateY(16px)' : 'scale(0.96) translateY(-8px)',
        opacity: phase==='open' ? 1 : 0,
        transition: phase==='closing' ? 'transform 260ms cubic-bezier(0.4,0,1,1), opacity 240ms' : 'transform 500ms cubic-bezier(0.34,1.15,0.64,1) 200ms, opacity 400ms 200ms',
        willChange: 'transform, opacity',
      }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:'linear-gradient(22deg,rgba(140,185,255,0.08) 0%,transparent 55%),linear-gradient(158deg,rgba(60,100,210,0.06) 0%,transparent 55%)',
        }} />
        <div style={{ position:'relative', zIndex:2, padding:'48px 34px', background:'rgba(4,8,30,0.92)', border:'1px solid rgba(80,140,255,0.20)', borderRadius:'20px', boxShadow:'0 0 60px rgba(40,80,200,0.15)' }}>
          <button onClick={handleClose} style={{ position:'absolute', top:'14px', right:'14px', background:'none', border:'none', cursor:'pointer', padding:'4px', opacity:0.5, lineHeight:0 }}>
            <CloseIcon size={22} />
          </button>
          <div style={{ fontSize:'8px', letterSpacing:'0.35em', color:'rgba(100,150,255,0.55)', fontFamily:'var(--font-vyan)', textTransform:'uppercase', marginBottom:'20px' }}>Traversal Node</div>
          <div style={{ fontSize:'26px', letterSpacing:'0.2em', color:'rgba(220,230,255,0.92)', fontFamily:'var(--font-vyan)', textTransform:'uppercase', marginBottom:'14px' }}>Coming Soon</div>
          <p style={{ fontSize:'12px', lineHeight:1.7, color:'rgba(150,170,255,0.48)', fontFamily:'var(--font-vyan)', letterSpacing:'0.06em', marginBottom:'32px' }}>
            This gateway is still forming in the field of consciousness.
          </p>
          <button onClick={handleClose} style={{ padding:'12px 28px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'rgba(255,255,255,0.48)', fontSize:'10px', letterSpacing:'0.22em', textTransform:'uppercase', fontFamily:'var(--font-vyan)', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'8px' }}>
            <BackIcon size={18} />Return
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── traversal state ──────────────────────────────────────────────────────────
interface TraverseState {
  active: boolean; startTime: number
  ringAActive: boolean; ringAStart: number; ringATarget: number
  ringBActive: boolean; ringBStart: number; ringBTarget: number
  ringCActive: boolean; ringCStart: number; ringCTarget: number
}
type VortexPhase = 'idle' | 'pull' | 'peak' | 'passage' | 'done'

// ─── main export ──────────────────────────────────────────────────────────────
export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void; onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [focusedIdx,      setFocusedIdx]      = useState(0)
  const [hoveredId,       setHoveredId]       = useState<string | null>(null)
  const [vortexPhase,     setVortexPhase]     = useState<VortexPhase>('idle')
  const [vortexTargetIdx, setVortexTargetIdx] = useState<number | null>(null)
  const [showFlash,       setShowFlash]       = useState(false)
  const [showPanel,       setShowPanel]       = useState(false)
  const [panelGateway,    setPanelGateway]    = useState<Gateway | null>(null)
  const [showComingSoon,  setShowComingSoon]  = useState(false)

  const worldPosRef       = useRef<Record<number, THREE.Vector3>>({})
  const screenPosRef      = useRef<Record<number, { x: number; y: number }>>({})
  const vortexAnimRef     = useRef<number>(0)
  const vortexStartRef    = useRef(0)
  // vortexProgress as ref — avoids 75+ setState calls per vortex (each was a full React re-render)
  const vortexProgressRef = useRef(0)

  const traverseRef = useRef<TraverseState>({
    active:false, startTime:0,
    ringAActive:false, ringAStart:0, ringATarget:0,
    ringBActive:false, ringBStart:0, ringBTarget:0,
    ringCActive:false, ringCStart:0, ringCTarget:0,
  })

  const triggerTraverse = useCallback((newIdx: number) => {
    const cfg = ORB_CFG[newIdx]
    const angles = { A: 0, B: 0, C: 0 }
    const rawTarget = FRONT - cfg.localAngle
    const tr = traverseRef.current
    tr.active=true; tr.startTime=Date.now()
    tr.ringAActive=false; tr.ringBActive=false; tr.ringCActive=false
    if (cfg.ring==='A') { tr.ringAActive=true; tr.ringAStart=angles.A; tr.ringATarget=nearestTarget(angles.A, rawTarget) }
    else if (cfg.ring==='B') { tr.ringBActive=true; tr.ringBStart=angles.B; tr.ringBTarget=nearestTarget(angles.B, rawTarget) }
    else { tr.ringCActive=true; tr.ringCStart=angles.C; tr.ringCTarget=nearestTarget(angles.C, rawTarget) }
  }, [])

  useEffect(() => {
    let cooldown = false
    const go = (dir: 1 | -1) => {
      if (cooldown || vortexPhase !== 'idle') return
      cooldown = true; setTimeout(() => { cooldown = false }, 700)
      setFocusedIdx(prev => { const next=(prev+dir+8)%8; triggerTraverse(next); return next })
    }
    const onWheel      = (e: WheelEvent)    => { if (Math.abs(e.deltaY)>5) go(e.deltaY>0?1:-1) }
    let tx = 0
    const onTouchStart = (e: TouchEvent)    => { tx = e.touches[0].clientX }
    const onTouchEnd   = (e: TouchEvent)    => { const dx=e.changedTouches[0].clientX-tx; if(Math.abs(dx)>=40) go(dx<0?1:-1) }
    window.addEventListener('wheel',      onWheel,      { passive:true })
    window.addEventListener('touchstart', onTouchStart, { passive:true })
    window.addEventListener('touchend',   onTouchEnd,   { passive:true })
    return () => {
      window.removeEventListener('wheel',      onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [vortexPhase, triggerTraverse])

  const handleOrbClick = useCallback((idx: number, id: string) => {
    if (vortexPhase !== 'idle') return
    if (idx !== focusedIdx) { triggerTraverse(idx); setFocusedIdx(idx); return }
    setVortexTargetIdx(idx); setVortexPhase('pull')
    vortexStartRef.current = performance.now()
    let curPhase = 'pull'
    const tick = () => {
      const el = performance.now() - vortexStartRef.current
      if (el < 400) {
        vortexProgressRef.current = el / 400
        if (curPhase !== 'pull') { curPhase = 'pull'; setVortexPhase('pull') }
        vortexAnimRef.current = requestAnimationFrame(tick)
      } else if (el < 800) {
        vortexProgressRef.current = (el - 400) / 400
        if (curPhase !== 'peak') { curPhase = 'peak'; setVortexPhase('peak') }
        vortexAnimRef.current = requestAnimationFrame(tick)
      } else if (el < 1200) {
        vortexProgressRef.current = (el - 800) / 400
        if (curPhase !== 'passage') { curPhase = 'passage'; setVortexPhase('passage') }
        vortexAnimRef.current = requestAnimationFrame(tick)
      } else {
        vortexProgressRef.current = 0
        setShowFlash(true); setTimeout(() => setShowFlash(false), 80)
        const gw = GATEWAYS.find(g => g.id === id)!; setPanelGateway(gw); setShowPanel(true)
        setVortexPhase('done')
        setTimeout(() => { setVortexPhase('idle'); setVortexTargetIdx(null) }, 200)
      }
    }
    vortexAnimRef.current = requestAnimationFrame(tick)
  }, [vortexPhase, focusedIdx, triggerTraverse])

  useEffect(() => () => cancelAnimationFrame(vortexAnimRef.current), [])

  const handleClose = useCallback(() => { setShowPanel(false); setPanelGateway(null) }, [])
  const handleEnter = useCallback(() => {
    const gw = panelGateway; handleClose(); if (gw) onGatewayEnter?.(gw)
  }, [panelGateway, handleClose, onGatewayEnter])

  const vig = vortexPhase==='pull' ? 0.28 : vortexPhase==='peak' ? 0.72 : vortexPhase==='passage' ? 1 : 0
  const passCenter = vortexTargetIdx!==null ? screenPosRef.current[vortexTargetIdx] : null

  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden', zIndex:100, background:'#000005' }}>
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
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes passageExpand { from{transform:scale(0);opacity:0} to{transform:scale(130);opacity:1} }
        @keyframes nebFloat1 {
          0%,100%{transform:translate(-4%,6%) scale(1.0)} 33%{transform:translate(6%,-3%) scale(1.15)} 66%{transform:translate(-2%,10%) scale(0.92)}
        }
        @keyframes nebFloat2 {
          0%,100%{transform:translate(5%,-5%) scale(0.94)} 40%{transform:translate(-6%,8%) scale(1.1)} 70%{transform:translate(3%,-2%) scale(1.04)}
        }
        @keyframes nebFloat3 {
          0%,100%{transform:translate(3%,10%) scale(1.05)} 50%{transform:translate(-8%,-3%) scale(0.88)}
        }
      `}</style>

      {/* Background nebula atmosphere (behind Canvas) */}
      <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:'72vw', height:'62vh', top:'-8%', left:'-12%',
          background:'radial-gradient(ellipse at center, rgba(160,0,220,0.16) 0%, rgba(90,0,160,0.06) 55%, transparent 100%)',
          filter:'blur(56px)', animation:'nebFloat1 28s ease-in-out infinite' }} />
        <div style={{ position:'absolute', width:'62vw', height:'52vh', top:'38%', right:'-8%',
          background:'radial-gradient(ellipse at center, rgba(0,160,190,0.14) 0%, rgba(0,90,130,0.06) 55%, transparent 100%)',
          filter:'blur(44px)', animation:'nebFloat2 22s ease-in-out infinite' }} />
        <div style={{ position:'absolute', width:'54vw', height:'44vh', bottom:'4%', left:'18%',
          background:'radial-gradient(ellipse at center, rgba(190,70,0,0.13) 0%, rgba(130,35,0,0.05) 55%, transparent 100%)',
          filter:'blur(40px)', animation:'nebFloat3 32s ease-in-out infinite' }} />
        <div style={{ position:'absolute', width:'80vw', height:'32vh', top:'18%', left:'50%',
          background:'radial-gradient(ellipse at center, rgba(130,0,190,0.13) 0%, rgba(70,0,130,0.05) 60%, transparent 100%)',
          filter:'blur(36px)', animation:'nebSweep1 38s linear infinite', animationDelay:'-8s' }} />
        <div style={{ position:'absolute', width:'68vw', height:'26vh', top:'58%', left:'50%',
          background:'radial-gradient(ellipse at center, rgba(0,140,170,0.12) 0%, rgba(0,70,110,0.05) 60%, transparent 100%)',
          filter:'blur(40px)', animation:'nebSweep2 44s linear infinite', animationDelay:'-20s' }} />
      </div>

      {/* Canvas — transparent so background nebula shows through */}
      <Canvas
        camera={{ position:[0,0,550], fov:60, near:1, far:3000 }}
        style={{ position:'absolute', inset:0, zIndex:2 }}
        gl={{ antialias:true, alpha:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1 }}
        dpr={[1, 1.5]}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0) }}
      >
        <GyroScene
          focusedIdx={focusedIdx} hoveredId={hoveredId}
          onHover={setHoveredId} onOrbClick={handleOrbClick}
          vortexTargetIdx={vortexTargetIdx} vortexProgressRef={vortexProgressRef} vortexPhase={vortexPhase}
          worldPosRef={worldPosRef} screenPosRef={screenPosRef} traverseRef={traverseRef}
          panelOpen={showPanel} onPhantomClick={() => setShowComingSoon(true)}
        />
      </Canvas>

      {/* Foreground nebula (in front of canvas) */}
      <div style={{ position:'absolute', inset:0, zIndex:3, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:'55vw', height:'22vh', top:'8%', left:'50%',
          background:'radial-gradient(ellipse at center, rgba(210,100,0,0.09) 0%, rgba(140,50,0,0.03) 65%, transparent 100%)',
          filter:'blur(32px)', animation:'nebSweepFg 41s linear infinite', animationDelay:'-9s' }} />
        <div style={{ position:'absolute', width:'48vw', height:'18vh', top:'65%', left:'50%',
          background:'radial-gradient(ellipse at center, rgba(0,180,150,0.08) 0%, transparent 65%)',
          filter:'blur(28px)', animation:'nebSweep1 35s linear infinite', animationDelay:'-24s' }} />
      </div>

      {/* Blue edge vignette */}
      <div style={{
        position:'fixed', inset:0, zIndex:5, pointerEvents:'none',
        background:`radial-gradient(ellipse at center, transparent 35%, rgba(0,10,60,${vig.toFixed(2)}) 100%)`,
        transition: vig===0 ? 'background 0.6s' : 'none',
      }} />

      {vortexPhase==='passage' && passCenter && (
        <div key={`passage-${vortexTargetIdx}`} style={{
          position:'fixed', left:passCenter.x-10, top:passCenter.y-10, width:20, height:20,
          borderRadius:'50%',
          background:'radial-gradient(circle at center, #8866ff 0%, #4422cc 35%, #110066 70%, #000010 100%)',
          transformOrigin:'center center', zIndex:170, pointerEvents:'none',
          animation:'passageExpand 400ms linear forwards',
        }} />
      )}

      <div style={{ position:'fixed', inset:0, zIndex:190, pointerEvents:'none', background:'#4488ff',
        opacity:showFlash?1:0, transition:showFlash?'none':'opacity 80ms' }} />

      <div style={{ position:'fixed', top:'22px', right:'24px', zIndex:40, pointerEvents:'none', textAlign:'right' }}>
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.40em', color:'rgba(212,180,80,0.55)', textTransform:'uppercase' }}>Vistāra</div>
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'8px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.18)', textTransform:'uppercase', marginTop:'3px' }}>The Manifestations</div>
      </div>

      {onBack && (
        <button onClick={onBack} style={{ position:'fixed', top:'22px', left:'22px', zIndex:40, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
          <BackIcon size={28} />
          <span style={{ fontFamily:'var(--font-vyan)', fontSize:11, letterSpacing:'0.2em', color:'rgba(100,160,255,0.70)' }}>ŚŪNYA MAṆḌALA</span>
        </button>
      )}

      <p style={{ position:'fixed', bottom:'5%', left:'50%', transform:'translateX(-50%)', zIndex:40, pointerEvents:'none', fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.25em', color:'rgba(255,255,255,0.10)', textTransform:'uppercase', margin:0, whiteSpace:'nowrap' }}>
        Scroll to traverse · Click focused orb to enter
      </p>

      <div style={{ position:'fixed', bottom:'12%', left:'50%', transform:'translateX(-50%)', zIndex:40, pointerEvents:'none', textAlign:'center' }}>
        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
          {GATEWAYS.map((_, i) => (
            <div key={i} style={{
              width: i===focusedIdx?18:5, height:3, borderRadius:2,
              background: i===focusedIdx?'rgba(140,160,255,0.7)':'rgba(100,120,200,0.25)',
              transition:'all 0.4s',
            }} />
          ))}
        </div>
      </div>

      {showPanel && panelGateway && (
        <GlassPanel gateway={panelGateway} onClose={handleClose} onEnter={handleEnter} />
      )}
      {showComingSoon && (
        <ComingSoonPanel onClose={() => setShowComingSoon(false)} />
      )}
    </div>
  )
}
