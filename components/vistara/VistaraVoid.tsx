'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { NanoOrb } from '@/lib/vyan/objects/NanoOrb'
import { GATEWAYS, type Gateway } from '@/lib/vistara/gateways'
import { BackIcon, SendIcon, CloseIcon } from '@/components/icons/VyanIcons'

// ─── gyroscope constants ──────────────────────────────────────────────────────
const ORB_SIZES = [28, 24, 22, 30, 32, 26, 26, 34, 26]

interface OrbRingDef {
  a: number; b: number          // ellipse semi-axes in XZ plane
  localAngle: number             // starting angle on the ellipse (radians) — spreads orbs around ring
  colorOffset: number            // shift in 0–3 color cycle
  speed: number                  // primary spin speed
  spinAxis: 'X' | 'Y' | 'Z'
  df: [number, number, number]   // drift frequencies [x,y,z]
  da: [number, number, number]   // drift amplitudes  [x,y,z]
}
// localAngles spread 9 orbs evenly: π/2 + i*(2π/9) so no two start at same position
const _A = Math.PI / 2, _S = (2 * Math.PI) / 9
const ORB_RING_DEFS: OrbRingDef[] = [
  // 0: Ṛtam — wide oval, red start, Y spin
  { a:280, b:200, localAngle:_A+0*_S, colorOffset:0.0, speed:0.00080, spinAxis:'Y', df:[0.17,0.00,0.13], da:[0.22,0.00,0.15] },
  // 1: Ojas — circle, blue start, X spin
  { a:240, b:240, localAngle:_A+1*_S, colorOffset:1.0, speed:0.00060, spinAxis:'X', df:[0.00,0.19,0.14], da:[0.00,0.16,0.20] },
  // 2: Mudrā — tall portrait oval, purple start, Z spin
  { a:190, b:270, localAngle:_A+2*_S, colorOffset:2.0, speed:0.00100, spinAxis:'Z', df:[0.22,0.11,0.00], da:[0.10,0.18,0.00] },
  // 3: Netra — wide egg, mid-red start, Y spin
  { a:295, b:210, localAngle:_A+3*_S, colorOffset:0.5, speed:0.00070, spinAxis:'Y', df:[0.15,0.00,0.18], da:[0.20,0.00,0.12] },
  // 4: Ākṛti — large circle, mid-blue start, X spin
  { a:260, b:260, localAngle:_A+4*_S, colorOffset:1.5, speed:0.00090, spinAxis:'X', df:[0.00,0.21,0.16], da:[0.00,0.14,0.22] },
  // 5: Sūtra — squat oval, mid-purple start, Z spin
  { a:275, b:185, localAngle:_A+5*_S, colorOffset:2.3, speed:0.00065, spinAxis:'Z', df:[0.18,0.12,0.00], da:[0.12,0.20,0.00] },
  // 6: Chitra-Prāṇa — diagonal oval, orange-red start, Y spin
  { a:255, b:170, localAngle:_A+6*_S, colorOffset:0.3, speed:0.00085, spinAxis:'Y', df:[0.14,0.00,0.20], da:[0.18,0.00,0.16] },
  // 7: Māyā — widest ring, purple-red start, X spin
  { a:315, b:235, localAngle:_A+7*_S, colorOffset:2.7, speed:0.00075, spinAxis:'X', df:[0.00,0.16,0.13], da:[0.00,0.20,0.18] },
  // 8: Saṅgraha — circle, warm start, Z spin
  { a:225, b:225, localAngle:_A+8*_S, colorOffset:0.8, speed:0.00095, spinAxis:'Z', df:[0.20,0.00,0.15], da:[0.15,0.00,0.18] },
]

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
    float disc = 1.0 - smoothstep(0.08, 0.80, r);
    float core = exp(-r * r * 4.5);
    float a = (disc * 0.7 + core * 0.55) * vAlpha;
    if (a < 0.008) discard;
    // warm tail → cool head gradient driven by brightness
    vec3 col = mix(vec3(1.0, 0.88, 0.72), vec3(0.92, 0.97, 1.0), vAlpha);
    gl_FragColor = vec4(col, min(a, 1.0));
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
    float w1 = 0.5 + 0.5 * sin(theta *  3.0 + uTime * 0.18 + aPhase);
    float w2 = 0.5 + 0.5 * sin(theta *  9.0 - uTime * 0.11 + aPhase * 2.3);
    float w3 = 0.5 + 0.5 * sin(theta * 22.0 + uTime * 0.27 + aPhase * 5.0);
    float gap = 0.68 + 0.32 * sin(theta * 2.5 + uTime * 0.04);
    float density = w1 * (0.5 + 0.5 * w2) * (0.7 + 0.3 * w3) * gap;
    vAlpha = clamp(density * (0.78 + abs(uTilt) * 1.1), 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mv.z, 1.0);
    gl_PointSize = clamp(aSize * (480.0 / dist), aSize * 0.9, aSize * 2.2);
    gl_Position  = projectionMatrix * mv;
  }
`
const SATURN_FRAG = `
  uniform float uTime;
  uniform float uColorOffset;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float disc = step(r, 0.92);
    float a    = disc * vAlpha;
    if (a < 0.01) discard;
    float cycle = mod(uTime * 0.05 + uColorOffset, 3.0);
    vec3 red    = vec3(1.00, 0.12, 0.06);
    vec3 dblue  = vec3(0.08, 0.28, 1.00);
    vec3 purple = vec3(0.55, 0.05, 0.90);
    vec3 col;
    if      (cycle < 1.0) { col = mix(red,    dblue,  cycle);       }
    else if (cycle < 2.0) { col = mix(dblue,  purple, cycle - 1.0); }
    else                  { col = mix(purple, red,    cycle - 2.0); }
    col = col * 1.15 + vec3(0.02);
    gl_FragColor = vec4(col, min(a, 1.0));
  }
`
function createOrbRingGeo(a: number, b: number): THREE.BufferGeometry {
  const COUNT = 11000
  const geo   = new THREE.BufferGeometry()
  const pos   = new Float32Array(COUNT * 3)
  const sz    = new Float32Array(COUNT)
  const ph    = new Float32Array(COUNT)
  const halfW = a * 0.11  // ring width = 11% of major axis
  for (let i = 0; i < COUNT; i++) {
    const angle  = Math.random() * Math.PI * 2
    const u      = Math.random()
    const dw     = u < 0.28
      ? Math.random() * halfW * 0.55
      : u > 0.72
        ? halfW - Math.random() * halfW * 0.55
        : Math.random() * halfW
    const sc   = 1 + (dw / halfW - 0.5) * 0.22
    pos[i*3]   = a * sc * Math.cos(angle)
    pos[i*3+1] = (Math.random() - 0.5) * 2.2   // thin in Y
    pos[i*3+2] = b * sc * Math.sin(angle)
    sz[i]      = 0.4 + Math.random() * 0.7
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

// Returns the ideal overview camera Z for the current viewport aspect ratio.
// Portrait phones (narrow) need a farther camera so the ring system fits horizontally.
// Wide desktop screens need a closer camera so the system fills the screen meaningfully.
function computeOverviewZ(aspect: number): number {
  // t=0 at aspect≤0.5 (tall portrait), t=1 at aspect≥2.0 (ultra-wide)
  const t = Math.max(0, Math.min(1, (aspect - 0.5) / 1.5))
  return Math.max(550, Math.min(1100, Math.round(900 - 350 * t)))
}
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
          sz    = 14.0 - tT * 5.0    // head cluster: 14→9 px
          baseA = 1.5 - tT * 0.25    // head: 1.5→1.25 (env brings it ≤1 during fade edges)
        } else {
          sz    = 7.0 - tT * 5.8     // body: 7→1.2 px
          baseA = 1.1 - tT * 1.0     // body: 1.1→0.1
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
    for (let i = 0; i < GATEWAYS.length; i++) {
      const wp = worldRef.current[i]; if (!wp) continue
      v.copy(wp).project(camera)
      screenRef.current[i] = { x: (v.x+1)/2*size.width, y: (-v.y+1)/2*size.height }
    }
  })
  return null
}

// ─── shooting stars ──────────────────────────────────────────────────────────
// 2 stars · ~45 s cycle · stardust particle style matching Saturn rings
// Trail = many small discrete glowing dots, NOT a smooth gradient beam
const SS_N  = 2    // max stars on screen
const SS_TN = 280  // particle count per star — density creates the trail shape

const SS_VERT = `
  attribute vec3  aSeedPos;
  attribute vec3  aDir;
  attribute vec3  aRight;      // perpendicular axis for scatter
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aTrailFrac;
  attribute float aScatter;    // lateral offset (stardust scatter)
  attribute float aSzJitter;   // per-particle size variation
  attribute vec3  aCol;
  uniform   float uTime;
  varying   float vFrac;
  varying   vec3  vCol;
  varying   float vAlpha;
  void main() {
    float t      = mod(uTime * aSpeed + aPhase, 1.0);
    float fade   = min(smoothstep(0.0, 0.04, t), smoothstep(1.0, 0.93, t));
    vec3  head   = aSeedPos + aDir * t * 2600.0;
    // Trail particle: step back along direction + scatter perpendicular
    float trailD = aTrailFrac * 220.0;
    vec3  pos    = head - aDir * trailD + aRight * aScatter * trailD * 0.18;
    vFrac  = aTrailFrac;
    vCol   = aCol;
    // Head particles are fully bright; tail fades with trailFrac^2
    float sf = 1.0 - aTrailFrac;
    vAlpha = sf * sf * fade;
    vec4  mv   = modelViewMatrix * vec4(pos, 1.0);
    float dist = max(-mv.z, 1.0);
    // Small discrete dots — head up to ~14px, tail down to sub-pixel
    float sz = (6.0 + aSzJitter * 10.0) * sf * (400.0 / dist);
    gl_PointSize = clamp(sz, 0.4, 14.0);
    gl_Position  = projectionMatrix * mv;
  }
`
const SS_FRAG = `
  varying float vFrac;
  varying vec3  vCol;
  varying float vAlpha;
  void main() {
    float r    = length(gl_PointCoord - vec2(0.5)) * 2.0;
    // Soft disc — individual glowing mote, not a solid blob
    float disc = 1.0 - smoothstep(0.3, 1.0, r);
    float core = exp(-r * r * 6.0);
    float a    = (disc * 0.6 + core * 0.9) * vAlpha;
    if (a < 0.01) discard;
    // Head particles pure-white core; tail retains colour
    float sf  = 1.0 - vFrac;
    vec3  col = mix(vCol, vec3(1.0), sf * 0.7);
    gl_FragColor = vec4(col, min(a, 1.0));
  }
`

function ShootingStars() {
  const total = SS_N * SS_TN
  const geo = useMemo(() => {
    const seedPos   = new Float32Array(total * 3)
    const dir       = new Float32Array(total * 3)
    const right     = new Float32Array(total * 3)
    const speed     = new Float32Array(total)
    const phase     = new Float32Array(total)
    const trailFrac = new Float32Array(total)
    const scatter   = new Float32Array(total)
    const szJitter  = new Float32Array(total)
    const col       = new Float32Array(total * 3)
    const palette   = [
      [1.0, 0.96, 0.88], [0.72, 0.88, 1.0],  [1.0, 0.82, 0.40],
      [1.0, 0.50, 0.25], [0.80, 0.55, 1.0],  [0.45, 0.92, 1.0],
      [1.0, 0.65, 0.85], [0.60, 1.0, 0.75],
    ]
    const PHASES = [0.0, 0.50]
    for (let s = 0; s < SS_N; s++) {
      // Random spawn position on a sphere
      const θ = Math.random() * Math.PI * 2
      const φ = Math.acos(2 * Math.random() - 1)
      const R = 350 + Math.random() * 450
      const sp = [
        R * Math.sin(φ) * Math.cos(θ),
        R * Math.sin(φ) * Math.sin(θ),
        (Math.random() * 2 - 1) * 350,
      ]
      // Random direction
      const dθ = Math.random() * Math.PI * 2
      const dφ = Math.acos(2 * Math.random() - 1)
      const dp = [Math.sin(dφ)*Math.cos(dθ), Math.sin(dφ)*Math.sin(dθ), Math.cos(dφ)]
      // Perpendicular axis for lateral scatter (cross with world-up or world-right)
      const up = Math.abs(dp[1]) < 0.9 ? [0,1,0] : [1,0,0]
      const rx = dp[1]*up[2] - dp[2]*up[1]
      const ry = dp[2]*up[0] - dp[0]*up[2]
      const rz = dp[0]*up[1] - dp[1]*up[0]
      const rl = Math.sqrt(rx*rx+ry*ry+rz*rz) || 1
      const rp = [rx/rl, ry/rl, rz/rl]

      const spd = 1.0 / 45.0
      const ph  = PHASES[s]
      const c   = palette[Math.floor(Math.random() * palette.length)]

      for (let t = 0; t < SS_TN; t++) {
        const i = s * SS_TN + t
        const frac = t / (SS_TN - 1)
        seedPos[i*3]=sp[0];  seedPos[i*3+1]=sp[1];  seedPos[i*3+2]=sp[2]
        dir[i*3]=dp[0];      dir[i*3+1]=dp[1];      dir[i*3+2]=dp[2]
        right[i*3]=rp[0];    right[i*3+1]=rp[1];    right[i*3+2]=rp[2]
        speed[i]     = spd
        phase[i]     = ph
        trailFrac[i] = frac
        // Signed scatter so particles spread both sides of the trail axis
        scatter[i]   = (Math.random() * 2 - 1)
        szJitter[i]  = Math.random()
        col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2]
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position',   new THREE.BufferAttribute(new Float32Array(total * 3), 3))
    g.setAttribute('aSeedPos',   new THREE.BufferAttribute(seedPos,   3))
    g.setAttribute('aDir',       new THREE.BufferAttribute(dir,       3))
    g.setAttribute('aRight',     new THREE.BufferAttribute(right,     3))
    g.setAttribute('aSpeed',     new THREE.BufferAttribute(speed,     1))
    g.setAttribute('aPhase',     new THREE.BufferAttribute(phase,     1))
    g.setAttribute('aTrailFrac', new THREE.BufferAttribute(trailFrac, 1))
    g.setAttribute('aScatter',   new THREE.BufferAttribute(scatter,   1))
    g.setAttribute('aSzJitter',  new THREE.BufferAttribute(szJitter,  1))
    g.setAttribute('aCol',       new THREE.BufferAttribute(col,       3))
    return g
  }, [])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SS_VERT, fragmentShader: SS_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])

  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime })

  return <points geometry={geo} material={mat} frustumCulled={false} />
}

// ─── core nebula — particle disc at gyroscope origin ─────────────────────────
// Replaces the billboard disc; uses differential rotation so inner particles
// orbit faster, giving a natural accretion-disc look in pure particle language.
const CORE_VERT = `
  attribute float aSize;
  attribute float aPhase;
  uniform   float uTime;
  varying   float vAlpha;
  void main() {
    float r   = length(vec2(position.x, position.z));
    // Differential rotation: inner particles orbit much faster than outer
    float spd = 0.30 / max(r * 0.022 + 0.08, 0.08);
    float ang = atan(position.z, position.x) + uTime * spd + aPhase * 0.15;
    vec3  pos = vec3(r * cos(ang), position.y, r * sin(ang));
    // Alpha: density wave * radial falloff — barely visible at edge, brighter at core
    float wave   = 0.45 + 0.55 * sin(ang * 6.0 - uTime * 0.7 + aPhase);
    float falloff = 1.0 - smoothstep(0.0, 48.0, r);
    vAlpha = clamp(wave * falloff * 0.65, 0.0, 1.0);
    vec4  mv   = modelViewMatrix * vec4(pos, 1.0);
    float dist = max(-mv.z, 1.0);
    gl_PointSize = clamp(aSize * (260.0 / dist), 0.3, 2.0);
    gl_Position  = projectionMatrix * mv;
  }
`
const CORE_FRAG = `
  uniform float uTime;
  varying float vAlpha;
  void main() {
    float r    = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float core = exp(-r * r * 9.0);
    float a    = core * vAlpha;
    if (a < 0.012) discard;
    // Same cycling gradient as Saturn rings — core and rings breathe as one system
    float cycle = mod(uTime * 0.04, 3.0);
    vec3 red    = vec3(1.00, 0.12, 0.06);
    vec3 dblue  = vec3(0.08, 0.28, 1.00);
    vec3 purple = vec3(0.55, 0.05, 0.90);
    vec3 col;
    if      (cycle < 1.0) { col = mix(red,    dblue,  cycle);       }
    else if (cycle < 2.0) { col = mix(dblue,  purple, cycle - 1.0); }
    else                  { col = mix(purple, red,    cycle - 2.0); }
    col = col * 1.10 + vec3(0.01);
    gl_FragColor = vec4(col, min(a, 1.0));
  }
`
function createCoreGeo(): THREE.BufferGeometry {
  const COUNT = 480
  const pos   = new Float32Array(COUNT * 3)
  const sz    = new Float32Array(COUNT)
  const ph    = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    // Square-root bias so most particles sit within inner 60% of disc
    const r     = Math.pow(Math.random(), 0.55) * 48
    pos[i*3]   = r * Math.cos(angle)
    pos[i*3+1] = (Math.random() - 0.5) * 6   // thin disc in XZ plane
    pos[i*3+2] = r * Math.sin(angle)
    sz[i]      = 0.4 + Math.random() * 1.4
    ph[i]      = Math.random() * Math.PI * 2
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sz,  1))
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(ph,  1))
  return geo
}
function CentralVortex() {
  const ptsRef = useRef<THREE.Points>(null)
  const geo    = useMemo(createCoreGeo, [])
  const mat    = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   CORE_VERT,
    fragmentShader: CORE_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime })
  return <points ref={ptsRef} geometry={geo} material={mat} frustumCulled={false} />
}

// ─── 3D starfield — static sphere of 1500 distant stars for camera parallax ──
const SF_VERT = `
  attribute float aSize;
  attribute vec3  aCol;
  varying   vec3  vCol;
  varying   float vA;
  void main() {
    vCol = aCol;
    vec4 mv   = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mv.z, 1.0);
    gl_PointSize = clamp(aSize * (320.0 / dist), 0.4, 3.5);
    vA = clamp(1.0 - dist * 0.00018, 0.18, 1.0);
    gl_Position  = projectionMatrix * mv;
  }
`
const SF_FRAG = `
  varying vec3  vCol;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float a = (1.0 - smoothstep(0.1, 1.0, r)) * vA;
    if (a < 0.015) discard;
    gl_FragColor = vec4(vCol, a);
  }
`
function StarField3D() {
  const { geo, mat } = useMemo(() => {
    const COUNT = 1500
    const g   = new THREE.BufferGeometry()
    const pos = new Float32Array(COUNT * 3)
    const col = new Float32Array(COUNT * 3)
    const sz  = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      // Uniform sphere distribution, radius 900–3600
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 900 + Math.random() * 2700
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta)
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i*3+2] = r * Math.cos(phi)
      // Color: mostly blue-white, some warm yellow, rare lavender
      const t = Math.random()
      if (t < 0.62) {
        col[i*3]=0.82+Math.random()*0.18; col[i*3+1]=0.88+Math.random()*0.12; col[i*3+2]=1.0
      } else if (t < 0.84) {
        col[i*3]=1.0; col[i*3+1]=0.93+Math.random()*0.07; col[i*3+2]=0.72+Math.random()*0.18
      } else {
        col[i*3]=0.86; col[i*3+1]=0.78; col[i*3+2]=1.0
      }
      sz[i] = 1.2 + Math.random() * 3.2
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aCol',     new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize',    new THREE.BufferAttribute(sz,  1))
    const m = new THREE.ShaderMaterial({
      vertexShader:   SF_VERT,
      fragmentShader: SF_FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
    })
    return { geo: g, mat: m }
  }, [])
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

// ─── vistara orb ─────────────────────────────────────────────────────────────
interface VistaraOrbProps {
  gateway: Gateway; orbIdx: number; orbSize: number
  basePos: [number, number, number]
  isFocused: boolean; isHovered: boolean; panelOpen: boolean
  isPulled: boolean; pullProgress: number; pullTarget: THREE.Vector3 | null
  onHover: (id: string | null) => void
  onClick: (idx: number, id: string) => void
  worldPosRef: React.MutableRefObject<Record<number, THREE.Vector3>>
  isOverview: boolean
}

function VistaraOrb({
  gateway, orbIdx, orbSize, basePos,
  isFocused, isHovered, panelOpen, isPulled, pullProgress, pullTarget,
  onHover, onClick, worldPosRef, isOverview,
}: VistaraOrbProps) {

  const groupRef  = useRef<THREE.Group>(null)
  const ZERO      = useMemo(() => new THREE.Vector3(), [])
  const scaleRef      = useRef(orbSize * 0.30)
  // throw state: age counts up from 0 when focus is acquired
  const throwRef      = useRef({ age: 10, prevFocused: false })

  const { camera } = useThree()

  const nanoOrb = useMemo(() => {
    const inst = new NanoOrb({
      id: gateway.id, title: gateway.name, subtitle: gateway.tagline,
      description: gateway.description, colorA: '#0033ff', colorB: '#0077ff',
    })
    inst.setVisible(true)
    return inst
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway.id])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime

    if (isHovered)      nanoOrb.setSignal('hover')
    else if (isFocused) nanoOrb.setSignal('listening')
    else                nanoOrb.setSignal('idle')
    nanoOrb.setVisualDim(isFocused || isHovered ? 1 : isOverview ? 0.82 : 0.55)

    nanoOrb.update(t, isHovered ? 0.5 : 0, isFocused, false, isFocused ? 1 : isOverview ? 0.55 : 0.3, 1, ZERO)

    // Track when focus is acquired and advance throw age
    if (isFocused !== throwRef.current.prevFocused) {
      throwRef.current.prevFocused = isFocused
      if (isFocused) throwRef.current.age = 0
    }
    if (throwRef.current.age < 1.0) throwRef.current.age += delta

    // Sin-bell scale spike: peaks at orbSize*2.5 at t=0.3s, gone by t=0.65s
    const throwAge  = throwRef.current.age
    const throwBell = isFocused && throwAge < 0.65
      ? Math.sin(Math.PI * Math.min(throwAge / 0.65, 1)) * (orbSize * 2.5)
      : 0
    const restScale    = orbSize * (isFocused ? 0.45 : 0.30)
    const targetScale  = restScale + throwBell
    const lerpSpeed    = throwBell > orbSize * 0.4 ? 0.30 : 0.08
    scaleRef.current  += (targetScale - scaleRef.current) * lerpSpeed
    nanoOrb.group.scale.multiplyScalar(scaleRef.current)

    if (groupRef.current) {
      const wp = new THREE.Vector3()
      groupRef.current.getWorldPosition(wp)
      worldPosRef.current[orbIdx] = wp

      if (isPulled && pullTarget && pullProgress > 0) {
        groupRef.current.position.lerp(pullTarget, pullProgress * pullProgress * 0.05)
      } else if (isFocused && throwAge < 0.65) {
        // Launch the orb toward the camera — compute direction in parent-local space
        const toCamera = new THREE.Vector3().subVectors(camera.position, wp).normalize()
        const parent   = groupRef.current.parent
        if (parent) toCamera.applyQuaternion(parent.quaternion.clone().invert())
        const throwDist = Math.sin(Math.PI * Math.min(throwAge / 0.65, 1)) * 180
        groupRef.current.position.set(
          basePos[0] + toCamera.x * throwDist,
          basePos[1] + toCamera.y * throwDist,
          basePos[2] + toCamera.z * throwDist,
        )
      } else {
        groupRef.current.position.set(...basePos)
      }
    }

  })

  const nameChars = Array.from(gateway.name)
  // Only reduce font for genuinely long names (8+ chars); never below 18px
  const nameLen = nameChars.length
  const nameFsF = nameLen <= 7 ? 28 : Math.max(18, Math.round(196 / nameLen))
  const nameFsU = Math.max(14, Math.round(nameFsF * 0.72))

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
      {/* φ label — hidden in overview to keep clean; visible in close-up */}
      {!isOverview && <Html center occlude={false} position={[0, 0, 0]}>
        <div
          onClick={e => { e.stopPropagation(); onClick(orbIdx, gateway.id) }}
          onMouseEnter={() => onHover(gateway.id)}
          onMouseLeave={() => onHover(null)}
          style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
        >
          {/* Name: bold italic uppercase, one letter per line */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {nameChars.map((char, i) => (
              <span key={i} style={{
                display: 'block',
                textAlign: 'center',
                fontSize: isFocused ? `${nameFsF}px` : `${nameFsU}px`,
                fontWeight: 700,
                fontStyle: 'italic',
                lineHeight: '1.15',
                color: isFocused ? '#ff4040' : 'rgba(200,35,35,0.45)',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-vyan)',
                opacity: isFocused ? 1 : 0.28,
                transition: 'color 0.3s, font-size 0.3s, opacity 0.3s',
                textShadow: isFocused
                  ? '0 0 48px rgba(255,60,60,1), 0 0 22px rgba(255,30,30,0.85), 0 0 8px rgba(220,0,0,0.95)'
                  : 'none',
              }}>{char}</span>
            ))}
          </div>
          {/* Tagline: normal weight, normal case, CSS-anchored below the column */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '10px',
            width: 'clamp(180px, 32vw, 300px)',
            textAlign: 'center',
            whiteSpace: 'normal',
            overflowWrap: 'break-word',
            fontSize: 'clamp(10px, min(1.6vw, 2.8vh), 14px)',
            letterSpacing: '0.08em',
            lineHeight: '1.4',
            color: 'rgba(255,120,100,0.85)',
            fontFamily: 'var(--font-vyan)',
            fontWeight: 400,
            fontStyle: 'normal',
            opacity: isFocused ? 1 : 0,
            transition: 'opacity 0.4s',
          }}>{gateway.tagline}</div>
        </div>
      </Html>}
    </group>
  )
}

// ─── gyroscope scene ─────────────────────────────────────────────────────────
interface CamAnimState {
  active: boolean; startPos: THREE.Vector3; endPos: THREE.Vector3
  startTarget: THREE.Vector3; endTarget: THREE.Vector3
  startT: number; duration: number
}

interface GyroSceneProps {
  focusedIdx: number; hoveredId: string | null
  onHover: (id: string | null) => void; onOrbClick: (idx: number, id: string) => void
  vortexTargetIdx: number | null; vortexProgressRef: React.MutableRefObject<number>; vortexPhase: VortexPhase
  worldPosRef: React.MutableRefObject<Record<number, THREE.Vector3>>
  screenPosRef: React.MutableRefObject<Record<number, { x: number; y: number }>>
  traverseRef: React.MutableRefObject<TraverseState>
  panelOpen: boolean
  onPhantomClick: () => void
  isOverview: boolean; orbitEnabled: boolean; onOverviewAnimDone: () => void
  overviewZRef: React.MutableRefObject<number>
}

function GyroScene({
  focusedIdx, hoveredId, onHover, onOrbClick,
  vortexTargetIdx, vortexProgressRef, vortexPhase,
  worldPosRef, screenPosRef, traverseRef, panelOpen, onPhantomClick,
  isOverview, orbitEnabled, onOverviewAnimDone, overviewZRef,
}: GyroSceneProps) {
  const ringGroupsRef = useRef<(THREE.Group | null)[]>(new Array(9).fill(null))
  const { camera, size } = useThree()
  const lookAt        = useRef(new THREE.Vector3())
  const spinAnglesRef = useRef<number[]>(new Array(9).fill(0))
  const prevFocusRef  = useRef(focusedIdx)
  const throwRef     = useRef({ startT: -10 })
  const controlsRef  = useRef<any>(null)
  const prevIsOverviewRef = useRef(isOverview)
  const pendingOverviewZRef = useRef<number | null>(null)
  const camAnimRef = useRef<CamAnimState>({
    active: false,
    startPos: new THREE.Vector3(), endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(), endTarget: new THREE.Vector3(),
    startT: 0, duration: 1.4,
  })
  // Arc traversal state — camera arcs through scene when switching focused orb
  const camTraverseRef = useRef({
    active: false, startT: 0, duration: 1.4,
    startPos: new THREE.Vector3(), midPos: new THREE.Vector3(),
    startLookAt: new THREE.Vector3(), endLookAt: new THREE.Vector3(),
  })

  // Mount: set camera to the viewport-appropriate overview distance immediately
  useEffect(() => {
    const z = computeOverviewZ((camera as THREE.PerspectiveCamera).aspect)
    overviewZRef.current = z
    if (isOverview) {
      camera.position.set(0, 0, z)
      if (controlsRef.current) { controlsRef.current.target.set(0, 0, 0); controlsRef.current.update() }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resize / orientation change: recompute and queue a smooth camera move
  useEffect(() => {
    const newZ = computeOverviewZ(size.width / size.height)
    overviewZRef.current = newZ
    if (isOverview) pendingOverviewZRef.current = newZ
  }, [size])

  // ── Per-orb ring materials and geometries ──
  const ringMats = useMemo(() => ORB_RING_DEFS.map(def => new THREE.ShaderMaterial({
    vertexShader: SATURN_VERT, fragmentShader: SATURN_FRAG,
    uniforms: { uTime: { value: 0 }, uTilt: { value: 0 }, uColorOffset: { value: def.colorOffset } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })), [])
  const ringGeos = useMemo(() => ORB_RING_DEFS.map(def => createOrbRingGeo(def.a, def.b)), [])

  useFrame(({ clock }, delta) => {
    const t   = clock.elapsedTime
    const tr  = traverseRef.current
    const frac60 = delta * 60

    // Mark traverse done after cooldown (camera arc handles the actual transition)
    if (tr.active && Date.now() - tr.startTime > 600) tr.active = false

    // Per-orb ring rotation — each ring spins on its own axis with gyroscopic drift
    ORB_RING_DEFS.forEach((def, i) => {
      spinAnglesRef.current[i] += def.speed * frac60
      const spin = spinAnglesRef.current[i]
      const grp  = ringGroupsRef.current[i]
      if (!grp) return
      const [fx, fy, fz] = def.df
      const [ax, ay, az] = def.da
      switch (def.spinAxis) {
        case 'Y': grp.rotation.set(Math.sin(t*fx)*ax, spin, Math.cos(t*fz)*az); break
        case 'X': grp.rotation.set(spin, Math.cos(t*fy)*ay, Math.sin(t*fz)*az); break
        case 'Z': grp.rotation.set(Math.cos(t*fx)*ax, Math.sin(t*fy)*ay, spin); break
      }
      ringMats[i].uniforms.uTime.value = t
      ringMats[i].uniforms.uTilt.value = (
        Math.abs(grp.rotation.x) + Math.abs(grp.rotation.y) + Math.abs(grp.rotation.z)
      )
    })

    // ── Orientation / resize repositioning (while in overview) ─────────────
    if (isOverview && !camAnimRef.current.active && pendingOverviewZRef.current !== null) {
      const newZ = pendingOverviewZRef.current
      pendingOverviewZRef.current = null
      if (Math.abs(newZ - camera.position.z) > 25) {
        const ca = camAnimRef.current
        ca.active = true
        ca.startPos.copy(camera.position)
        ca.endPos.set(0, 0, newZ)
        ca.startTarget.copy(lookAt.current)
        ca.endTarget.set(0, 0, 0)
        ca.startT = clock.elapsedTime
        ca.duration = 0.7
      }
    }

    // ── Overview ↔ close-up camera animation ──────────────────────────────
    if (prevIsOverviewRef.current !== isOverview) {
      prevIsOverviewRef.current = isOverview
      const ca = camAnimRef.current
      ca.active    = true
      ca.startPos.copy(camera.position)
      ca.endPos.set(0, 0, isOverview ? overviewZRef.current : 550)
      ca.startTarget.copy(lookAt.current)
      ca.endTarget.set(0, 0, 0)
      ca.startT    = clock.elapsedTime
      ca.duration  = isOverview ? 1.4 : 0.9
      // Sync prevFocusRef so no throw fires when landing in close-up
      if (!isOverview) prevFocusRef.current = focusedIdx
    }

    const ca = camAnimRef.current
    if (ca.active) {
      const tp = Math.min((clock.elapsedTime - ca.startT) / ca.duration, 1)
      const te = easeInOutCubic(tp)
      camera.position.lerpVectors(ca.startPos, ca.endPos, te)
      lookAt.current.lerpVectors(ca.startTarget, ca.endTarget, te)
      camera.lookAt(lookAt.current)
      if (tp >= 1) {
        ca.active = false
        if (isOverview) {
          if (controlsRef.current) { controlsRef.current.target.set(0,0,0); controlsRef.current.update() }
          onOverviewAnimDone()
        }
      }
      return
    }

    if (isOverview) return   // OrbitControls drives camera when enabled

    // Camera throw + arc traversal when focus changes
    if (prevFocusRef.current !== focusedIdx) {
      prevFocusRef.current = focusedIdx
      throwRef.current.startT = clock.elapsedTime

      // Begin arc traversal: pull back over the gyroscope, swoop to new orb
      const newWp = worldPosRef.current[focusedIdx]
      const ct = camTraverseRef.current
      ct.active = true
      ct.startT  = clock.elapsedTime
      ct.duration = 2.5
      ct.startPos.copy(camera.position)
      ct.startLookAt.copy(lookAt.current)
      if (newWp) {
        ct.endLookAt.copy(newWp)
        const pullZ = overviewZRef.current * 1.05
        ct.midPos.set(newWp.x * 0.55, newWp.y * 0.55, pullZ)
      } else {
        ct.endLookAt.set(0, 0, 0)
        ct.midPos.set(0, 0, overviewZRef.current * 1.05)
      }
    }
    const tp     = Math.min((clock.elapsedTime - throwRef.current.startT) / 0.55, 1)
    const throwZ = Math.sin(Math.PI * tp) * 160

    const vp = vortexProgressRef.current
    if (vortexTargetIdx !== null && vp > 0) {
      const wp = worldPosRef.current[vortexTargetIdx]
      if (wp) {
        const t2 = easeInExpo(Math.min(vp, 1))
        camera.position.lerp(new THREE.Vector3(wp.x*0.3, wp.y*0.2, 550 - t2*350), t2*0.12)
        camera.lookAt(wp)
      }
    } else {
      const ct = camTraverseRef.current
      if (ct.active) {
        const raw = Math.min((clock.elapsedTime - ct.startT) / ct.duration, 1)
        if (raw < 0.44) {
          // Phase 1 — pull back to midpoint while panning lookAt to new orb
          const ep = easeInOutCubic(raw / 0.44)
          camera.position.lerpVectors(ct.startPos, ct.midPos, ep)
          lookAt.current.lerpVectors(ct.startLookAt, ct.endLookAt, ep)
        } else {
          // Phase 2 — swoop into close-up; track live orb position as rings rotate
          const ep = easeInOutCubic((raw - 0.44) / 0.56)
          camera.position.lerpVectors(ct.midPos, new THREE.Vector3(0, 0, 550 - throwZ), ep)
          const liveWp = worldPosRef.current[focusedIdx]
          if (liveWp) ct.endLookAt.copy(liveWp)
          lookAt.current.copy(ct.endLookAt)
        }
        camera.lookAt(lookAt.current)
        if (raw >= 1) ct.active = false
      } else {
        camera.position.lerp(new THREE.Vector3(0, 0, 550 - throwZ), tp < 1 ? 0.28 : 0.04)
        const wp = worldPosRef.current[focusedIdx]
        if (wp) lookAt.current.lerp(wp, 0.04)
        else lookAt.current.lerp(new THREE.Vector3(), 0.04)
        camera.lookAt(lookAt.current)
      }
    }
  })

  const spiralTarget = vortexTargetIdx !== null ? (worldPosRef.current[vortexTargetIdx] ?? null) : null
  const spiralT = vortexPhase==='pull' ? vortexProgressRef.current : (vortexPhase==='peak'||vortexPhase==='passage') ? 1 : 0


  return (
    <>
      <OrbitControls ref={controlsRef} makeDefault enabled={orbitEnabled}
        enableDamping dampingFactor={0.07}
        minDistance={200} maxDistance={1600}
        enablePan={false} rotateSpeed={0.55} zoomSpeed={1.1}
      />
      <ambientLight intensity={0.04} />
      <StarField3D />
      <CentralVortex />
      <ParticleField spiralTarget={spiralTarget} spiralT={spiralT} />
      <PhantomOrbsSystem onPhantomClick={onPhantomClick} />
      <StarTrailsSystem />

      {ORB_RING_DEFS.map((def, i) => (
        <group key={i} ref={(el: THREE.Group | null) => { ringGroupsRef.current[i] = el }}>
          <points geometry={ringGeos[i]} material={ringMats[i]} frustumCulled={false} />
          <VistaraOrb
            gateway={GATEWAYS[i]} orbIdx={i} orbSize={ORB_SIZES[i]}
            basePos={[def.a * Math.cos(def.localAngle), 0, def.b * Math.sin(def.localAngle)]}
            isFocused={focusedIdx===i} isHovered={hoveredId===GATEWAYS[i].id}
            panelOpen={panelOpen && focusedIdx===i}
            isPulled={vortexTargetIdx!==null&&vortexTargetIdx!==i}
            pullProgress={vortexTargetIdx!==null&&vortexTargetIdx!==i?vortexProgressRef.current:0}
            pullTarget={vortexTargetIdx!==null?(worldPosRef.current[vortexTargetIdx]??null):null}
            onHover={onHover} onClick={onOrbClick} worldPosRef={worldPosRef} isOverview={isOverview}
          />
        </group>
      ))}

      <ScreenTracker worldRef={worldPosRef} screenRef={screenPosRef} />
    </>
  )
}

// ─── live app placeholder ─────────────────────────────────────────────────────
function LiveAppPlaceholder({ gateway }: { gateway: Gateway }) {
  const c = gateway.color
  return (
    <div style={{
      position:'relative', width:'100%', height:'190px',
      borderRadius:'10px', overflow:'hidden',
      background:'rgba(0,2,16,0.90)',
      border:`1px solid ${c}25`,
      marginBottom:'28px',
    }}>
      {/* Dot grid */}
      <div style={{
        position:'absolute', inset:0, opacity:0.45,
        backgroundImage:`radial-gradient(circle, ${c}30 1px, transparent 1px)`,
        backgroundSize:'18px 18px', backgroundPosition:'9px 9px',
      }} />
      {/* Scanning line */}
      <div style={{
        position:'absolute', left:0, right:0, height:'1px',
        background:`linear-gradient(90deg,transparent 0%,${c}88 30%,${c}cc 50%,${c}88 70%,transparent 100%)`,
        animation:'plhScan 3.4s ease-in-out infinite',
        zIndex:2,
      }} />
      {/* Corner TL */}
      <div style={{ position:'absolute', top:10, left:10, width:14, height:14, borderTop:`1px solid ${c}44`, borderLeft:`1px solid ${c}44` }} />
      {/* Corner TR */}
      <div style={{ position:'absolute', top:10, right:10, width:14, height:14, borderTop:`1px solid ${c}44`, borderRight:`1px solid ${c}44` }} />
      {/* Corner BL */}
      <div style={{ position:'absolute', bottom:10, left:10, width:14, height:14, borderBottom:`1px solid ${c}44`, borderLeft:`1px solid ${c}44` }} />
      {/* Corner BR */}
      <div style={{ position:'absolute', bottom:10, right:10, width:14, height:14, borderBottom:`1px solid ${c}44`, borderRight:`1px solid ${c}44` }} />
      {/* Center */}
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, zIndex:3 }}>
        <div style={{ fontSize:'7px', letterSpacing:'0.45em', textTransform:'uppercase', color:`${c}66`, fontFamily:'var(--font-vyan)', animation:'plhPulse 2.6s ease-in-out infinite' }}>
          Initialising Interface
        </div>
        <div style={{ width:'24px', height:'1px', background:`linear-gradient(90deg,transparent,${c}77,transparent)` }} />
        <div style={{ fontSize:'10px', letterSpacing:'0.24em', textTransform:'uppercase', color:`${c}44`, fontFamily:'var(--font-vyan)' }}>
          {gateway.tantra}
        </div>
      </div>
      {/* Bottom glow */}
      <div style={{ position:'absolute', bottom:0, left:'10%', right:'10%', height:'40px', background:`radial-gradient(ellipse at center bottom,${c}28 0%,transparent 70%)`, animation:'plhGlow 2.6s ease-in-out infinite', zIndex:1 }} />
    </div>
  )
}

// ─── per-gateway feature content ─────────────────────────────────────────────
const GATEWAY_DETAILS: Record<string, { features: { title: string; body: string }[] }> = {
  rtam: { features: [
    { title: 'Pravāha Mapping',       body: 'Visualises natural flow patterns in your life to surface hidden rhythms.' },
    { title: 'Conscious Scheduling',   body: 'Aligns your calendar to cosmic and personal energy cycles for effortless living.' },
    { title: 'Harmony Score',          body: 'Continuous metric tracking alignment between your intention and daily action.' },
  ]},
  ojas: { features: [
    { title: 'Pranic Rhythm Tracker',  body: 'Measures and charts your vital energy across every hour of the day.' },
    { title: 'Vitality Insights',      body: 'AI-powered pattern analysis across sleep, food, movement, and mind.' },
    { title: 'Circulation Dashboard',  body: 'Concentric ring visualisation of multi-dimensional wellness in real time.' },
  ]},
  mudra: { features: [
    { title: 'Global Entity Archive',  body: 'Structured knowledge repository for conscious organisations and individuals.' },
    { title: 'Permanence Protocol',    body: 'Immutable record system ensuring integrity across time and context.' },
    { title: 'Kośa Mapping',           body: 'Multi-layer entity profiling aligned with traditional wisdom frameworks.' },
  ]},
  netra: { features: [
    { title: 'Cross-Tantra Vision',    body: 'Observes patterns and anomalies across all VYAN systems simultaneously.' },
    { title: 'Awareness Engine',       body: 'Intelligent perception layer that surfaces what matters, when it matters.' },
    { title: 'Astronomical Sensing',   body: 'Real-time monitoring with cosmic-scale perspective on micro-scale events.' },
  ]},
  akriti: { features: [
    { title: 'Drishti-Driven Design',  body: 'Creates digital experiences shaped by your unique perspective and intention.' },
    { title: 'Prismatic Creation',     body: 'Refracts raw possibility into structured, beautiful digital artefacts.' },
    { title: 'Anubhava Studio',        body: 'Full-stack creative environment built for conscious digital making.' },
  ]},
  sutra: { features: [
    { title: 'Sangama Weaving',        body: 'Maps and strengthens intentional relationships between people and entities.' },
    { title: 'Vivek Connections',      body: 'Intelligent discernment layer for building networks that truly resonate.' },
    { title: 'Thread Intelligence',    body: 'Identifies dormant connections with high resonance potential waiting to unfold.' },
  ]},
  'chitra-prana': { features: [
    { title: 'Imagery Breathwork',     body: 'Infuses static visuals with life, motion, and intentional prāṇic energy.' },
    { title: 'Cosmic Aperture',        body: 'Wide-angle creative space for multi-modal visual storytelling at any scale.' },
    { title: 'Prāṇa Visualisation',    body: 'Renders the invisible life-force within imagery as perceptible moving form.' },
  ]},
  maya: { features: [
    { title: 'Reality Manifold',       body: 'Constructs layered digital realities from initial intention to tangible output.' },
    { title: 'Dynamic Gateway',        body: 'The most versatile portal — its nature adapts to what you need to create.' },
    { title: 'Manifestation Engine',   body: 'Bridges the gap between possibility-space and expressed digital form.' },
  ]},
  sangraha: { features: [
    { title: 'Essence Collection',     body: 'Gathers the most vital insights from all VYAN systems into a unified stream.' },
    { title: 'Knowledge Synthesis',    body: 'Weaves distributed wisdom threads into coherent, actionable understanding.' },
    { title: 'Integration Protocol',   body: 'Bridges all gateways so the whole becomes greater than the sum of its parts.' },
  ]},
}

// ─── glass panel (side-sliding) ───────────────────────────────────────────────
type PanelPhase = 'opening' | 'open' | 'closing'

function GlassPanel({ gateway, onClose, onBack, onEnter, side }: {
  gateway: Gateway; onClose: () => void; onBack: () => void; onEnter: () => void; side: 'left' | 'right'
}) {
  const [phase, setPhase] = useState<PanelPhase>('opening')
  const [step,  setStep]  = useState(0)   // stagger index: 0=hidden, 1..5=each section
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768
  )

  useEffect(() => {
    const t0 = setTimeout(() => setPhase('open'), 40)
    const t1 = setTimeout(() => setStep(1), 200)
    const t2 = setTimeout(() => setStep(2), 280)
    const t3 = setTimeout(() => setStep(3), 360)
    const t4 = setTimeout(() => setStep(4), 430)
    const t5 = setTimeout(() => setStep(5), 500)
    return () => { [t0,t1,t2,t3,t4,t5].forEach(clearTimeout) }
  }, [])

  const CLOSE_MS = 300
  const handleClose = useCallback(() => {
    setStep(0); setPhase('closing')
    setTimeout(onClose, CLOSE_MS)
  }, [onClose])
  const handleBack = useCallback(() => {
    setStep(0); setPhase('closing')
    setTimeout(onBack, CLOSE_MS)
  }, [onBack])

  const isLeft = side === 'left'
  const c      = gateway.color

  const slideTransform = phase === 'open'
    ? 'translate(0,0)'
    : isMobile
      ? 'translateY(100%)'
      : isLeft ? 'translateX(-100%)' : 'translateX(100%)'

  // Staggered reveal: each section lifts + fades in 60 ms after the previous
  const reveal = (s: number): React.CSSProperties => ({
    opacity:   step >= s ? 1 : 0,
    transform: step >= s ? 'translateY(0)' : 'translateY(10px)',
    transition:'opacity 0.38s, transform 0.38s',
  })

  // Shimmer direction alternates per orb: even=L→R, odd=R→L
  const orbIdx = GATEWAYS.findIndex(g => g.id === gateway.id)
  const shimmerAnim = orbIdx % 2 === 0 ? 'tagShimmerLR' : 'tagShimmerRL'

  return (
    <>
    <style>{`
      @keyframes tagShimmerLR {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
      @keyframes tagShimmerRL {
        0%   { background-position: -200% center; }
        100% { background-position:  200% center; }
      }
    `}</style>
    <div style={{
      position:'fixed', inset:0, zIndex:200, display:'flex',
      alignItems:     isMobile ? 'flex-end' : 'stretch',
      justifyContent: isMobile ? 'center' : isLeft ? 'flex-start' : 'flex-end',
    }}>
      {/* Backdrop — click outside to dismiss panel, stay on current orb */}
      <div onClick={handleClose} style={{
        position:'absolute', inset:0,
        background:'rgba(0,0,0,0.28)',
        opacity: phase === 'open' ? 1 : 0,
        transition:'opacity 300ms',
      }} />

      {/* Panel — glass: semi-transparent + backdrop-filter so orbs show through */}
      <div
        onPointerDown={e => e.stopPropagation()}
        onPointerMove={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        style={{
        position:'relative', zIndex:2,
        width:  isMobile ? '100%' : 'min(500px, 46vw)',
        height: isMobile ? '88vh' : '100vh',
        display:'flex', flexDirection:'column',
        borderRadius: isMobile ? '18px 18px 0 0' : '0',
        overflow:'hidden',
        background: isMobile ? 'rgba(4,7,26,0.78)' : 'rgba(4,7,26,0.62)',
        backdropFilter:'blur(26px) saturate(1.4)',
        WebkitBackdropFilter:'blur(26px) saturate(1.4)',
        boxShadow: isMobile
          ? `0 -4px 80px rgba(0,0,0,0.55), inset 0 1px 0 ${c}44`
          : isLeft
            ? `6px 0 60px rgba(0,0,0,0.50), inset -1px 0 0 ${c}55`
            : `-6px 0 60px rgba(0,0,0,0.50), inset 1px 0 0 ${c}55`,
        transform: slideTransform,
        // Spring overshoot on open (slight bounce-in); snappy accelerating ease on close
        transition: phase === 'closing'
          ? `transform ${CLOSE_MS}ms cubic-bezier(0.55,0,1,0.45)`
          : 'transform 500ms cubic-bezier(0.34,1.45,0.64,1)',
        willChange:'transform',
      }}>
        {/* Top accent line */}
        <div style={{ position:'absolute', top:0, left:'5%', right:'5%', height:'1px', zIndex:10,
          background:`linear-gradient(90deg,transparent,${c}99,${c}cc,${c}99,transparent)` }} />

        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ display:'flex', justifyContent:'center', paddingTop:'12px', paddingBottom:'4px', flexShrink:0 }}>
            <div style={{ width:'36px', height:'3px', borderRadius:'2px', background:'rgba(255,255,255,0.15)' }} />
          </div>
        )}

        {/* X — direct child of panel at zIndex 20 so scrollable area can't cover it */}
        <button onClick={handleClose} title="Dismiss · stay on this orb" style={{
          position:'absolute', top: isMobile ? 16 : 20, right: isMobile ? 18 : 22,
          width:'32px', height:'32px', borderRadius:'50%', zIndex:20,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          opacity: step >= 1 ? 0.65 : 0, transition:'opacity 0.3s, background 0.2s',
          padding:0, lineHeight:0,
        }}
        onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.opacity='1'; b.style.background='rgba(255,255,255,0.12)' }}
        onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.opacity='0.65'; b.style.background='rgba(255,255,255,0.06)' }}
        >
          <CloseIcon size={16} />
        </button>

        {/* Header */}
        <div style={{ flexShrink:0, padding: isMobile ? '14px 24px 0' : '24px 32px 0' }}>
          <div style={reveal(1)}>
            <span style={{
              display:'inline-block', padding:'2px 9px',
              border:`1px solid ${c}30`, borderRadius:'3px',
              fontSize:'7px', letterSpacing:'0.38em', textTransform:'uppercase',
              color:`${c}77`, fontFamily:'var(--font-vyan)',
            }}>{gateway.tantra}</span>
          </div>
        </div>

        {/* Scrollable content — each block reveals in sequence */}
        <div
          style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding: isMobile ? '14px 24px 0' : '16px 32px 0' }}
          onTouchStart={e => { e.stopPropagation(); (e.currentTarget as any)._tsY = e.touches[0].clientY }}
          onTouchMove={e => {
            e.stopPropagation()
            e.preventDefault()
            const el = e.currentTarget as HTMLDivElement
            const dy = (el as any)._tsY - e.touches[0].clientY;
            (el as any)._tsY = e.touches[0].clientY
            el.scrollTop += dy
          }}
        >
          <div style={reveal(2)}>
            <h2 style={{
              fontFamily:'var(--font-vyan)', fontSize: isMobile ? '24px' : '26px',
              letterSpacing:'0.13em', color:'#e80010',
              textTransform:'uppercase', margin:'10px 0 6px',
            }}>{gateway.name}</h2>
            <p style={{
              fontSize:'10px', letterSpacing:'0.18em',
              textTransform:'uppercase', fontFamily:'var(--font-vyan)', margin:'0 0 18px',
              background:'linear-gradient(90deg,#0a2fff 0%,#88aaff 30%,#cc99ff 55%,#6600cc 100%)',
              backgroundSize:'200% auto',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              backgroundClip:'text',
              animation:`${shimmerAnim} 3.5s linear infinite`,
            }}>{gateway.tagline}</p>
          </div>
          <div style={reveal(3)}>
            <div style={{ height:'1px', marginBottom:'18px', background:`linear-gradient(90deg,${c}55,transparent)` }} />
            <p style={{
              fontSize:'13px', lineHeight:'1.78', color:'rgba(255,255,255,0.50)',
              fontFamily:'var(--font-vyan)', letterSpacing:'0.03em', margin:'0 0 26px',
            }}>{gateway.description}</p>
          </div>
          <div style={reveal(4)}>
            {/* Gateway-specific feature cards */}
            <div style={{ marginBottom:'24px' }}>
              <div style={{ fontSize:'7px', letterSpacing:'0.32em', textTransform:'uppercase', color:'rgba(255,255,255,0.16)', fontFamily:'var(--font-vyan)', marginBottom:'12px' }}>
                Core Capabilities
              </div>
              {(GATEWAY_DETAILS[gateway.id]?.features ?? []).map((f, i) => (
                <div key={i} style={{
                  padding:'11px 14px', marginBottom:'8px', borderRadius:'8px',
                  background:`linear-gradient(135deg,${c}09 0%,transparent 100%)`,
                  border:`1px solid ${c}1a`,
                  display:'flex', alignItems:'flex-start', gap:'12px',
                }}>
                  <div style={{
                    flexShrink:0, width:'20px', height:'20px', borderRadius:'5px',
                    border:`1px solid ${c}33`, display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'8px', color:`${c}88`, fontFamily:'var(--font-vyan)', fontWeight:600,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize:'10px', letterSpacing:'0.16em', textTransform:'uppercase', color:`${c}cc`, fontFamily:'var(--font-vyan)', marginBottom:'4px' }}>{f.title}</div>
                    <div style={{ fontSize:'11px', lineHeight:'1.60', color:'rgba(255,255,255,0.36)', fontFamily:'var(--font-vyan)', letterSpacing:'0.02em' }}>{f.body}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Live Interface slot */}
            <div style={{ fontSize:'7px', letterSpacing:'0.32em', textTransform:'uppercase', color:'rgba(255,255,255,0.16)', fontFamily:'var(--font-vyan)', marginBottom:'10px' }}>
              Live Interface
            </div>
            {gateway.appUrl ? (
              <div style={{ marginBottom:'24px', borderRadius:'10px', overflow:'hidden', border:`1px solid ${c}20`, background:'rgba(0,2,18,0.70)' }}>
                <iframe
                  src={gateway.appUrl}
                  title={`${gateway.name} live app`}
                  style={{ width:'100%', height:'260px', border:'none', display:'block' }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  loading="lazy"
                />
              </div>
            ) : (
              <LiveAppPlaceholder gateway={gateway} />
            )}
          </div>
        </div>

        {/* Footer — three distinct actions */}
        <div style={{
          flexShrink:0, padding: isMobile ? '14px 24px 28px' : '14px 32px 28px',
          borderTop:'1px solid rgba(255,255,255,0.07)',
          background:'rgba(2,4,16,0.35)',
          ...reveal(5),
        }}>
          <div style={{ display:'flex', gap:'10px' }}>
            {/* Overview — close panel and zoom out to see all 8 orbs */}
            <button onClick={handleBack} title="Return to Overview" style={{
              flex:1, padding:'11px 0',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:'8px', color:'rgba(255,255,255,0.38)', fontSize:'9px',
              letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-vyan)',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'7px',
              transition:'color 0.2s, border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(255,255,255,0.70)'; b.style.borderColor='rgba(255,255,255,0.14)'; b.style.background='rgba(255,255,255,0.07)' }}
            onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(255,255,255,0.38)'; b.style.borderColor='rgba(255,255,255,0.07)'; b.style.background='rgba(255,255,255,0.04)' }}
            >
              <BackIcon size={15} />Overview
            </button>
            {/* Enter — launch this gateway's app */}
            <button onClick={onEnter} title="Enter gateway" style={{
              padding:'11px 24px',
              background:`${c}1a`, border:`1px solid ${c}55`,
              borderRadius:'8px', color:c, fontSize:'9px',
              letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-vyan)',
              cursor:'pointer', display:'flex', alignItems:'center', gap:'7px',
              boxShadow:`0 0 16px ${c}14`,
              transition:'background 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`${c}2a`; b.style.boxShadow=`0 0 26px ${c}2a` }}
            onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`${c}1a`; b.style.boxShadow=`0 0 16px ${c}14` }}
            >
              <SendIcon size={15} />Enter
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

// ─── coming soon panel ───────────────────────────────────────────────────────
function ComingSoonPanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<PanelPhase>('opening')
  const [step,  setStep]  = useState(0)

  useEffect(() => {
    const t0 = setTimeout(() => setPhase('open'), 40)
    const t1 = setTimeout(() => setStep(1), 200)
    const t2 = setTimeout(() => setStep(2), 290)
    const t3 = setTimeout(() => setStep(3), 375)
    return () => { [t0,t1,t2,t3].forEach(clearTimeout) }
  }, [])

  const CLOSE_MS = 280
  const handleClose = useCallback(() => {
    setStep(0); setPhase('closing')
    setTimeout(onClose, CLOSE_MS)
  }, [onClose])

  const reveal = (s: number): React.CSSProperties => ({
    opacity:   step >= s ? 1 : 0,
    transform: step >= s ? 'translateY(0)' : 'translateY(8px)',
    transition:'opacity 0.35s, transform 0.35s',
  })

  const panelT = phase === 'open'
    ? 'scale(1) translateY(0)'
    : phase === 'opening' ? 'scale(0.90) translateY(20px)'
    : 'scale(0.96) translateY(-10px)'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div onClick={handleClose} style={{
        position:'absolute', inset:0,
        background:'rgba(0,0,0,0.28)',
        backdropFilter:'blur(3px)', WebkitBackdropFilter:'blur(3px)',
        opacity: phase === 'open' ? 1 : 0, transition:'opacity 300ms',
      }} />
      <div style={{
        position:'relative', zIndex:2, width:380, maxWidth:'calc(100vw - 48px)',
        borderRadius:'18px', overflow:'hidden', textAlign:'center',
        background:'rgba(4,7,26,0.75)',
        backdropFilter:'blur(26px) saturate(1.4)', WebkitBackdropFilter:'blur(26px) saturate(1.4)',
        border:'1px solid rgba(80,120,255,0.18)',
        boxShadow:'0 8px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(120,150,255,0.18)',
        transform: panelT,
        opacity: phase === 'open' ? 1 : 0,
        transition: phase === 'closing'
          ? `transform ${CLOSE_MS}ms cubic-bezier(0.55,0,1,0.45), opacity ${CLOSE_MS}ms`
          : 'transform 500ms cubic-bezier(0.34,1.45,0.64,1), opacity 300ms 80ms',
        willChange:'transform, opacity',
      }}>
        {/* Top accent line */}
        <div style={{ position:'absolute', top:0, left:'20%', right:'20%', height:'1px',
          background:'linear-gradient(90deg,transparent,rgba(100,140,255,0.85),transparent)' }} />
        {/* X — high zIndex so it's always clickable */}
        <button onClick={handleClose} style={{
          position:'absolute', top:14, right:14, zIndex:20,
          width:'28px', height:'28px', borderRadius:'50%',
          background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          opacity: step >= 1 ? 0.6 : 0, transition:'opacity 0.3s, background 0.2s',
          padding:0, lineHeight:0,
        }}
        onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.opacity='1'; b.style.background='rgba(255,255,255,0.10)' }}
        onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.opacity='0.6'; b.style.background='rgba(255,255,255,0.05)' }}
        >
          <CloseIcon size={15} />
        </button>

        <div style={{ padding:'40px 32px 32px' }}>
          <div style={reveal(1)}>
            <div style={{ fontSize:'7px', letterSpacing:'0.42em', color:'rgba(100,140,255,0.50)', fontFamily:'var(--font-vyan)', textTransform:'uppercase', marginBottom:'18px' }}>
              Traversal Node
            </div>
          </div>
          <div style={reveal(2)}>
            <div style={{ fontSize:'24px', letterSpacing:'0.2em', color:'rgba(220,230,255,0.90)', fontFamily:'var(--font-vyan)', textTransform:'uppercase', marginBottom:'10px' }}>
              Coming Soon
            </div>
            <div style={{ width:'32px', height:'1px', background:'linear-gradient(90deg,transparent,rgba(100,140,255,0.65),transparent)', margin:'0 auto 16px' }} />
          </div>
          <div style={reveal(3)}>
            <p style={{ fontSize:'12px', lineHeight:1.75, color:'rgba(150,170,255,0.42)', fontFamily:'var(--font-vyan)', letterSpacing:'0.06em', margin:'0 0 28px' }}>
              This gateway is still forming in the field of consciousness.
            </p>
            <button onClick={handleClose} style={{
              padding:'10px 24px',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'8px', color:'rgba(255,255,255,0.40)', fontSize:'9px',
              letterSpacing:'0.22em', textTransform:'uppercase', fontFamily:'var(--font-vyan)',
              cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'7px',
              transition:'color 0.2s, border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(255,255,255,0.70)'; b.style.borderColor='rgba(255,255,255,0.15)'; b.style.background='rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(255,255,255,0.40)'; b.style.borderColor='rgba(255,255,255,0.08)'; b.style.background='rgba(255,255,255,0.04)' }}
            >
              <BackIcon size={15} />Return
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── traversal state ──────────────────────────────────────────────────────────
interface TraverseState {
  active: boolean; startTime: number
}
type VortexPhase = 'idle' | 'pull' | 'peak' | 'passage' | 'done'

// ─── main export ──────────────────────────────────────────────────────────────
export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void; onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [focusedIdx,      setFocusedIdx]      = useState(-1)
  const [hoveredId,       setHoveredId]       = useState<string | null>(null)
  const [vortexPhase,     setVortexPhase]     = useState<VortexPhase>('idle')
  const [vortexTargetIdx, setVortexTargetIdx] = useState<number | null>(null)
  const [showFlash,       setShowFlash]       = useState(false)
  const [showPanel,       setShowPanel]       = useState(false)
  const [panelGateway,    setPanelGateway]    = useState<Gateway | null>(null)
  const [panelSide,       setPanelSide]       = useState<'left' | 'right'>('left')
  const [showComingSoon,  setShowComingSoon]  = useState(false)
  const [isOverview,      setIsOverview]      = useState(true)
  const [orbitEnabled,    setOrbitEnabled]    = useState(true)   // camera already at z=1300 on load
  const isOverviewRef  = useRef(true)
  const overviewZRef   = useRef(750)
  useEffect(() => { isOverviewRef.current = isOverview }, [isOverview])

  const worldPosRef       = useRef<Record<number, THREE.Vector3>>({})
  const screenPosRef      = useRef<Record<number, { x: number; y: number }>>({})
  const vortexAnimRef     = useRef<number>(0)

  // ── Custom orbital cursor — mouse-only, hidden on touch/coarse devices ───────
  const hasFinePointer  = typeof window !== 'undefined' && window.matchMedia('(pointer:fine)').matches
  const cursorTargetRef = useRef({ x: -400, y: -400 })
  const cursorRingRef   = useRef({ x: -400, y: -400 })
  const ringDivRef      = useRef<HTMLDivElement>(null)
  const dotDivRef       = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hasFinePointer) return
    const onMove = (e: MouseEvent) => { cursorTargetRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove)
    let raf: number
    const tick = () => {
      const t = cursorTargetRef.current
      const r = cursorRingRef.current
      r.x += (t.x - r.x) * 0.14
      r.y += (t.y - r.y) * 0.14
      if (ringDivRef.current) ringDivRef.current.style.transform = `translate(${r.x}px,${r.y}px)`
      if (dotDivRef.current)  dotDivRef.current.style.transform  = `translate(${t.x}px,${t.y}px)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const vortexStartRef    = useRef(0)
  // vortexProgress as ref — avoids 75+ setState calls per vortex (each was a full React re-render)
  const vortexProgressRef = useRef(0)

  const traverseRef = useRef<TraverseState>({ active:false, startTime:0 })

  const triggerTraverse = useCallback((_newIdx: number) => {
    const tr = traverseRef.current
    tr.active=true; tr.startTime=Date.now()
  }, [])

  useEffect(() => {
    let cooldown = false
    const go = (dir: 1 | -1) => {
      if (cooldown || vortexPhase !== 'idle') return
      cooldown = true; setTimeout(() => { cooldown = false }, 700)
      setFocusedIdx(prev => { const next=(prev+dir+GATEWAYS.length)%GATEWAYS.length; triggerTraverse(next); return next })
    }
    const onWheel      = (e: WheelEvent)    => { if (isOverviewRef.current) return; if (Math.abs(e.deltaY)>5) go(e.deltaY>0?1:-1) }
    let tx = 0
    const onTouchStart = (e: TouchEvent)    => { tx = e.touches[0].clientX }
    const onTouchEnd   = (e: TouchEvent)    => { if (isOverviewRef.current) return; const dx=e.changedTouches[0].clientX-tx; if(Math.abs(dx)>=40) go(dx<0?1:-1) }
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
    // From overview: fly camera into close-up of this orb
    if (isOverview) {
      setIsOverview(false)
      setOrbitEnabled(false)
      setFocusedIdx(idx)
      triggerTraverse(idx)
      return
    }
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
        setPanelSide(idx % 2 === 0 ? 'left' : 'right')
        setVortexPhase('done')
        setTimeout(() => { setVortexPhase('idle'); setVortexTargetIdx(null) }, 200)
      }
    }
    vortexAnimRef.current = requestAnimationFrame(tick)
  }, [isOverview, vortexPhase, focusedIdx, triggerTraverse])

  useEffect(() => () => cancelAnimationFrame(vortexAnimRef.current), [])

  const handleClose = useCallback(() => { setShowPanel(false); setPanelGateway(null) }, [])
  const handleEnter = useCallback(() => {
    const gw = panelGateway; handleClose(); if (gw) onGatewayEnter?.(gw)
  }, [panelGateway, handleClose, onGatewayEnter])
  // Panel "Overview" button — dismiss panel and fly camera out to overview
  const handlePanelBack = useCallback(() => {
    setShowPanel(false); setPanelGateway(null)
    setIsOverview(true); setOrbitEnabled(false); setFocusedIdx(-1)
  }, [])

  const goToOverview = useCallback(() => {
    setIsOverview(true)
    setOrbitEnabled(false)
    setFocusedIdx(-1)
  }, [])
  const onOverviewAnimDone = useCallback(() => { setOrbitEnabled(true) }, [])

  const vig = vortexPhase==='pull' ? 0.28 : vortexPhase==='peak' ? 0.72 : vortexPhase==='passage' ? 1 : 0
  const passCenter = vortexTargetIdx!==null ? screenPosRef.current[vortexTargetIdx] : null

  return (
    <>
    <div style={{ position:'fixed', inset:0, overflow:'hidden', zIndex:100, background:'#000005', cursor: hasFinePointer ? 'none' : 'auto' }}>
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
        @keyframes plhScan {
          0%   { top: -2px; opacity: 0 }
          5%   { opacity: 1 }
          95%  { opacity: 0.8 }
          100% { top: 100%; opacity: 0 }
        }
        @keyframes plhPulse {
          0%, 100% { opacity: 0.5 }
          50%      { opacity: 1.0 }
        }
        @keyframes plhGlow {
          0%, 100% { opacity: 0.5 }
          50%      { opacity: 1.0 }
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
        camera={{ position:[0,0,750], fov:60, near:1, far:4000 }}
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
          isOverview={isOverview} orbitEnabled={orbitEnabled} onOverviewAnimDone={onOverviewAnimDone}
          overviewZRef={overviewZRef}
        />
        <ShootingStars />
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

      {/* Custom orbital cursor — mouse only, not rendered on touch devices */}
      {hasFinePointer && <>
        <div ref={ringDivRef} style={{
          position:'fixed', top:0, left:0, pointerEvents:'none', zIndex:9500,
          width: hoveredId ? 52 : 32, height: hoveredId ? 52 : 32,
          marginLeft: hoveredId ? -26 : -16, marginTop: hoveredId ? -26 : -16,
          borderRadius:'50%',
          border: hoveredId ? '1.5px solid rgba(72,160,255,0.85)' : '1px solid rgba(120,180,255,0.50)',
          boxShadow: hoveredId ? '0 0 18px rgba(50,130,255,0.50), inset 0 0 8px rgba(80,160,255,0.15)' : '0 0 7px rgba(80,160,255,0.18)',
          transition:'width 0.24s cubic-bezier(0.34,1.45,0.64,1), height 0.24s cubic-bezier(0.34,1.45,0.64,1), margin 0.24s cubic-bezier(0.34,1.45,0.64,1), border-color 0.22s ease, box-shadow 0.22s ease',
          willChange:'transform',
        }} />
        <div ref={dotDivRef} style={{
          position:'fixed', top:0, left:0, pointerEvents:'none', zIndex:9501,
          width:4, height:4, marginLeft:-2, marginTop:-2,
          borderRadius:'50%',
          background: hoveredId ? 'rgba(120,200,255,0.92)' : 'rgba(180,210,255,0.62)',
          boxShadow: hoveredId ? '0 0 6px rgba(80,160,255,0.9)' : 'none',
          transition:'background 0.22s ease, box-shadow 0.22s ease',
          willChange:'transform',
        }} />
      </>}

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

      {/* Sound console shortcut — opens the global SoundConsole panel */}
      <button
        onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('vyan:sound-toggle')) }}
        title="Acoustic Console"
        style={{
          position:'fixed', top:'68px', left:'22px', zIndex:40,
          background:'none', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', gap:7, padding:0,
          opacity:0.55, transition:'opacity 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.55' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(100,160,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        <span style={{ fontFamily:'var(--font-vyan)', fontSize:10, letterSpacing:'0.2em', color:'rgba(100,160,255,0.70)' }}>ACOUSTIC</span>
      </button>

      <p style={{ position:'fixed', bottom:'5%', left:'50%', transform:'translateX(-50%)', zIndex:40, pointerEvents:'none', fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.25em', color:'rgba(255,255,255,0.10)', textTransform:'uppercase', margin:0, whiteSpace:'nowrap' }}>
        {isOverview ? 'Scroll · Pinch · Drag to explore · Tap an orb to enter' : 'Scroll to traverse · Click focused orb to enter'}
      </p>

      {!isOverview && (
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
      )}

      {showPanel && panelGateway && (
        <GlassPanel gateway={panelGateway} onClose={handleClose} onBack={handlePanelBack} onEnter={handleEnter} side={panelSide} />
      )}
      {showComingSoon && (
        <ComingSoonPanel onClose={() => setShowComingSoon(false)} />
      )}
    </div>

    {/* Overview button — outside stacking context so zIndex:9200 beats NebulaFooter:9100 */}
    {!isOverview && (
      <button
        onClick={goToOverview}
        style={{
          position:'fixed', bottom:'22px', right:'22px', zIndex:9200,
          background:'rgba(6,10,28,0.72)', border:'1px solid rgba(55,90,200,0.28)',
          borderRadius:'8px', padding:'8px 16px', cursor:'pointer',
          fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.22em',
          color:'rgba(90,150,255,0.55)', textTransform:'uppercase',
          backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
          transition:'color 0.25s, border-color 0.25s, background 0.25s',
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement
          b.style.color='rgba(150,200,255,0.95)'; b.style.borderColor='rgba(80,140,255,0.55)'; b.style.background='rgba(10,18,50,0.90)'
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement
          b.style.color='rgba(90,150,255,0.55)'; b.style.borderColor='rgba(55,90,200,0.28)'; b.style.background='rgba(6,10,28,0.72)'
        }}
      >
        Overview
      </button>
    )}
    </>
  )
}
