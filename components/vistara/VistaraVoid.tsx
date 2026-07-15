'use client'

import { useState, useCallback, useRef, Suspense, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture, Html } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GATEWAYS, type Gateway, assetPath } from '@/lib/vistara/gateways'
import { BackIcon, CloseIcon } from '@/components/icons/VyanIcons'

function rng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

const TEAR_GEO = (() => {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const y = t * 1.7 - 0.15
    const r = Math.sin(t * Math.PI) * 0.40 * (1 - t * 0.22)
    pts.push(new THREE.Vector2(r, y))
  }
  return new THREE.LatheGeometry(pts, 12)
})()

// Trunk: wide base → narrow waist → converges to near-point at crown.
// This creates the classic tree silhouette (NOT a vase).
function trunkStrand(i: number, N: number): THREE.Vector3[] {
  const θ  = (i / N) * Math.PI * 2
  const tw = θ + (i / N) * 1.1
  return [
    new THREE.Vector3(3.0 * Math.cos(θ),         0.0, 3.0 * Math.sin(θ)),          // wide base
    new THREE.Vector3(2.0 * Math.cos(θ + 0.08),  1.6, 2.0 * Math.sin(θ + 0.08)),
    new THREE.Vector3(0.8 * Math.cos(tw),         4.2, 0.8 * Math.sin(tw)),         // waist
    new THREE.Vector3(0.45 * Math.cos(tw + 0.18), 6.8, 0.45 * Math.sin(tw + 0.18)),
    new THREE.Vector3(0.25 * Math.cos(tw + 0.38), 9.0, 0.25 * Math.sin(tw + 0.38)), // converging tip → branches fan from here
  ]
}

function toLine(pts: THREE.Vector3[], seg: number): THREE.Line {
  const curve = new THREE.CatmullRomCurve3(pts)
  const geo   = new THREE.BufferGeometry().setFromPoints(curve.getPoints(seg))
  return new THREE.Line(geo)
}

// Hemisphere centred at trunk crown. All canopy geometry fans from this point.
const CROWN_Y = 9.2
const DOME_R  = 8.0   // hemisphere radius

// ARM_ANCHORS: 8 points on dome at φ=60° — outer perimeter where fruits hang
// x = 8·sin60° ≈ 6.93,  y = CROWN_Y + 8·cos60° = 9.2+4.0 = 13.2
const ARM_ANCHORS: [number, number, number][] = [
  [ 6.93, 13.2,  0.00],
  [ 4.90, 13.2,  4.90],
  [ 0.00, 13.2,  6.93],
  [-4.90, 13.2,  4.90],
  [-6.93, 13.2,  0.00],
  [-4.90, 13.2, -4.90],
  [ 0.00, 13.2, -6.93],
  [ 4.90, 13.2, -4.90],
]

// Fruits hang 1.4 units below anchor, pulled slightly inward
const FRUIT_POS: [number, number, number][] =
  ARM_ANCHORS.map(([x, y, z]) => [x * 0.82, y - 1.4, z * 0.82])

// ── Crystal Tree ───────────────────────────────────────────────────────────────
function CrystalTree({ onFocusChange, hoveredId, onHover, onFruitClick }: {
  onFocusChange: (id: string | null) => void
  hoveredId: string | null
  onHover: (id: string | null) => void
  onFruitClick: (id: string) => void
}) {
  const treeRef  = useRef<THREE.Group>(null)
  const targetRY = useRef(0)
  const { camera } = useThree()

  // 70 trunk wire strands — converge to narrow tip at y=9
  const trunkLines = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: '#a8b8c8', transparent: true, opacity: 0.72 })
    return Array.from({ length: 70 }, (_, i) => {
      const l = toLine(trunkStrand(i, 70), 28)
      l.material = mat
      return l
    })
  }, [])

  // 8 main arm branches: from narrow crown tip → ARM_ANCHOR (bright, clear spines)
  const armLines = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: '#c8d8e8', transparent: true, opacity: 0.92 })
    return ARM_ANCHORS.map((anchor, i) => {
      const θ   = (i / 8) * Math.PI * 2
      // Origin RIGHT at the narrow trunk tip
      const org = new THREE.Vector3(Math.cos(θ) * 0.22, CROWN_Y, Math.sin(θ) * 0.22)
      const anc = new THREE.Vector3(...anchor)
      const mid = new THREE.Vector3(
        (org.x + anc.x) * 0.5,
        (org.y + anc.y) * 0.5 + 0.8,
        (org.z + anc.z) * 0.5,
      )
      const l = toLine([org, mid, anc], 28)
      l.material = mat
      return l
    })
  }, [])

  // 160 fill branches: straight spokes from crown → hemisphere surface.
  // Single RNG, φ: 3°–68° (golden angle azimuth) — true dome shape.
  const branchLines = useMemo(() => {
    const dimMat  = new THREE.LineBasicMaterial({ color: '#8090a8', transparent: true, opacity: 0.46 })
    const apexMat = new THREE.LineBasicMaterial({ color: '#c8d8e8', transparent: true, opacity: 0.80 })
    const lines: THREE.Line[] = []
    const r2 = rng(300)

    // One apex spoke straight to dome top
    const apexGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, CROWN_Y, 0),
      new THREE.Vector3(0, CROWN_Y + DOME_R + 0.3, 0),
    ])
    lines.push(new THREE.Line(apexGeo, apexMat))

    const PHI_MIN = 3  * Math.PI / 180   //  3°
    const PHI_MAX = 68 * Math.PI / 180   // 68°

    for (let i = 0; i < 159; i++) {
      const φ = PHI_MIN + (i / 159) * (PHI_MAX - PHI_MIN)
      const θ = i * 2.399                             // golden angle
      const R = DOME_R * (0.84 + r2() * 0.20)

      // Tip on hemisphere surface
      const tip = new THREE.Vector3(
        R * Math.sin(φ) * Math.cos(θ + (r2() - 0.5) * 0.18),
        CROWN_Y + R * Math.cos(φ),
        R * Math.sin(φ) * Math.sin(θ + (r2() - 0.5) * 0.18),
      )
      // All origins cluster tightly at trunk tip — this is the KEY visual difference
      const org = new THREE.Vector3(
        (r2() - 0.5) * 0.45,
        CROWN_Y - 0.1 + r2() * 0.3,
        (r2() - 0.5) * 0.45,
      )
      const geo = new THREE.BufferGeometry().setFromPoints([org, tip])
      lines.push(new THREE.Line(geo, dimMat))
    }
    return lines
  }, [])

  // 260 crystal drops uniformly scattered on dome surface (single RNG = no clustering)
  const dropMatrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    const arr: THREE.Matrix4[] = []
    const r2 = rng(600)

    for (let i = 0; i < 260; i++) {
      const φ = Math.acos(1 - r2() * 0.88)   // area-uniform sampling
      const θ = r2() * Math.PI * 2
      const R = DOME_R * (0.70 + r2() * 0.40)

      dummy.position.set(
        R * Math.sin(φ) * Math.cos(θ),
        CROWN_Y + R * Math.cos(φ) - r2() * 0.9,
        R * Math.sin(φ) * Math.sin(θ),
      )
      dummy.scale.setScalar(0.16 + r2() * 0.42)
      dummy.rotation.x = (r2() - 0.5) * 0.5
      dummy.rotation.z = (r2() - 0.5) * 0.3
      dummy.updateMatrix()
      arr.push(dummy.matrix.clone())
    }
    return arr
  }, [])

  const iMeshRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    if (!iMeshRef.current) return
    dropMatrices.forEach((m, i) => iMeshRef.current!.setMatrixAt(i, m))
    iMeshRef.current.instanceMatrix.needsUpdate = true
  }, [dropMatrices])

  useEffect(() => {
    const h = (e: WheelEvent) => { targetRY.current += e.deltaY * 0.0018 }
    window.addEventListener('wheel', h, { passive: true })
    return () => window.removeEventListener('wheel', h)
  }, [])

  const touchX = useRef(0)
  useEffect(() => {
    const ts = (e: TouchEvent) => { touchX.current = e.touches[0].clientX }
    const tm = (e: TouchEvent) => {
      targetRY.current -= (e.touches[0].clientX - touchX.current) * 0.008
      touchX.current = e.touches[0].clientX
    }
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchmove',  tm, { passive: true })
    return () => {
      window.removeEventListener('touchstart', ts)
      window.removeEventListener('touchmove', tm)
    }
  }, [])

  const focusClock = useRef(0)
  useFrame(({ clock }) => {
    if (!treeRef.current) return
    treeRef.current.rotation.y += (targetRY.current - treeRef.current.rotation.y) * 0.055

    if (clock.elapsedTime - focusClock.current > 0.12) {
      focusClock.current = clock.elapsedTime
      let bestId = null as string | null
      let bestD  = Infinity
      FRUIT_POS.forEach(([lx, ly, lz], i) => {
        const wp = new THREE.Vector3(lx, ly, lz).applyMatrix4(treeRef.current!.matrixWorld)
        const n  = wp.project(camera)
        const d  = n.x * n.x + n.y * n.y
        if (d < bestD && n.z < 1) { bestD = d; bestId = GATEWAYS[i].id }
      })
      onFocusChange(bestId)
    }
  })

  return (
    <group ref={treeRef}>
      {/* Base platform */}
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[3.4, 3.4, 0.14, 80]} />
        <meshStandardMaterial color="#070710" metalness={0.95} roughness={0.08} />
      </mesh>
      <mesh position={[0, -0.10, 0]}>
        <cylinderGeometry args={[3.1, 3.1, 0.03, 80]} />
        <meshStandardMaterial color="#12122a" metalness={1.0} roughness={0.04} />
      </mesh>

      {trunkLines.map((l, i)  => <primitive key={`t${i}`} object={l} />)}
      {armLines.map((l, i)    => <primitive key={`a${i}`} object={l} />)}
      {branchLines.map((l, i) => <primitive key={`b${i}`} object={l} />)}

      {/* Crystal drops — metallic material works on all mobile GPUs */}
      <instancedMesh ref={iMeshRef} args={[TEAR_GEO, undefined, 260]} renderOrder={2}>
        <meshStandardMaterial
          color="#ccddf0"
          metalness={0.88}
          roughness={0.06}
          emissive="#7799cc"
          emissiveIntensity={0.14}
        />
      </instancedMesh>

      {/* 8 product fruits hanging from arm anchors */}
      <Suspense fallback={null}>
        {GATEWAYS.map((gw, i) => (
          <ProductFruit
            key={gw.id}
            gw={gw}
            pos={FRUIT_POS[i]}
            anchorY={ARM_ANCHORS[i][1]}
            isHovered={hoveredId === gw.id}
            onHover={onHover}
            onClick={onFruitClick}
          />
        ))}
      </Suspense>
    </group>
  )
}

// ── Product fruit ──────────────────────────────────────────────────────────────
function ProductFruit({ gw, pos, anchorY, isHovered, onHover, onClick }: {
  gw: Gateway
  pos: [number, number, number]
  anchorY: number
  isHovered: boolean
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  const tex      = useTexture(assetPath(gw.filename))
  const meshRef  = useRef<THREE.Mesh>(null)
  const matRef   = useRef<THREE.MeshStandardMaterial>(null)
  const glowRef  = useRef<THREE.Mesh>(null)
  const hov      = useRef(0)
  const emissive = useMemo(() => new THREE.Color(gw.color), [gw.color])

  const threadObj = useMemo(() => {
    const threadLen = anchorY - pos[1]
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.42, 0),
      new THREE.Vector3(0, threadLen, 0),
    ])
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#9aaabb', transparent: true, opacity: 0.65 }))
  }, [anchorY, pos])

  useFrame(({ clock }) => {
    hov.current += ((isHovered ? 1 : 0) - hov.current) * 0.09
    const t = clock.elapsedTime
    if (meshRef.current) {
      const s = 0.82 + hov.current * 0.38 + Math.sin(t * 0.9 + pos[0]) * 0.04
      meshRef.current.scale.setScalar(s)
    }
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.08 + hov.current * 0.88
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.08 + hov.current * 0.52 + Math.sin(t * 1.3) * 0.03
    }
  })

  return (
    <group position={pos}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.64, 16, 16]} />
        <meshBasicMaterial color={gw.color} transparent opacity={0.08} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh
        ref={meshRef}
        onPointerOver={e => { e.stopPropagation(); onHover(gw.id) }}
        onPointerOut={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onClick(gw.id) }}
      >
        <sphereGeometry args={[0.42, 36, 36]} />
        <meshStandardMaterial
          ref={matRef}
          map={tex}
          metalness={0.08}
          roughness={0.12}
          emissive={emissive}
          emissiveIntensity={0.08}
        />
      </mesh>
      <primitive object={threadObj} />
      <Html center distanceFactor={14} position={[0, -0.85, 0]} occlude={false}
        style={{ pointerEvents:'none', textAlign:'center', whiteSpace:'nowrap', opacity: isHovered ? 1 : 0, transition:'opacity 0.35s' }}
      >
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.28em', color:gw.color, textTransform:'uppercase', textShadow:`0 0 18px ${gw.color}` }}>{gw.name}</div>
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'7px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', marginTop:'4px' }}>{gw.tantra}</div>
      </Html>
    </group>
  )
}

// ── Lighting ───────────────────────────────────────────────────────────────────
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.10} />
      <pointLight position={[0, 30, 8]}   intensity={6.0} color="#ffffff" decay={2} />
      <pointLight position={[-8, 16, 8]}  intensity={2.0} color="#c0d8ff" decay={2} />
      <pointLight position={[10, 12, -4]} intensity={1.2} color="#fff0d0" decay={2} />
      <pointLight position={[0,  0.5, 0]} intensity={0.6} color="#6080a0" decay={2} />
    </>
  )
}

// ── Bloom ──────────────────────────────────────────────────────────────────────
function Bloom() {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.65, 0.55, 0.28))
    c.addPass(new OutputPass())
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])
  useEffect(() => { composer.setSize(size.width, size.height) }, [composer, size])
  useEffect(() => () => composer.dispose(), [composer])
  useFrame(() => composer.render(), 1)
  return null
}

// ── Main export ────────────────────────────────────────────────────────────────
export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void
  onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)
  const [focusedId,    setFocusedId]    = useState<string | null>(null)
  const [showPanel,    setShowPanel]    = useState(false)
  const [panelGateway, setPanelGateway] = useState<Gateway | null>(null)

  const handleClick = useCallback((id: string) => {
    const gw = GATEWAYS.find(g => g.id === id)
    if (!gw) return
    setPanelGateway(gw)
    setShowPanel(true)
  }, [])

  const handleClose = useCallback(() => {
    setShowPanel(false)
    setPanelGateway(null)
  }, [])

  const focusedGw = focusedId ? GATEWAYS.find(g => g.id === focusedId) : null

  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden', zIndex:100, background:'#000' }}>
      <Canvas
        camera={{ position:[0, 9.0, 26], fov:52, near:0.1, far:300 }}
        style={{ position:'absolute', inset:0 }}
        gl={{ antialias:true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        dpr={[1, 1.5]}
        onCreated={({ gl, scene, camera }) => {
          gl.setClearColor(0x000000, 1)
          scene.background = new THREE.Color(0x000000)
          camera.lookAt(0, 9.0, 0)
        }}
      >
        <Lighting />
        <CrystalTree
          onFocusChange={setFocusedId}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onFruitClick={handleClick}
        />
        <Bloom />
      </Canvas>

      <AnimatePresence>
        {focusedGw && !showPanel && (
          <motion.div
            key={focusedGw.id}
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.3 }}
            style={{ position:'fixed', bottom:'12%', left:'50%', transform:'translateX(-50%)', textAlign:'center', pointerEvents:'none', zIndex:40 }}
          >
            <div style={{ fontFamily:'var(--font-vyan)', fontSize:'13px', letterSpacing:'0.32em', color:focusedGw.color, textTransform:'uppercase', textShadow:`0 0 28px ${focusedGw.color}`, marginBottom:'5px' }}>{focusedGw.name}</div>
            <div style={{ fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.20em', color:'rgba(255,255,255,0.35)', textTransform:'uppercase' }}>{focusedGw.tagline}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.2 }}
        style={{ position:'fixed', top:'22px', right:'24px', zIndex:40, pointerEvents:'none', textAlign:'right' }}
      >
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.40em', color:'rgba(212,180,80,0.55)', textTransform:'uppercase' }}>Vistāra</div>
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'8px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.18)', textTransform:'uppercase', marginTop:'3px' }}>The Manifestations</div>
      </motion.div>

      {onBack && (
        <motion.button initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.8 }}
          onClick={onBack}
          style={{ position:'fixed', top:'22px', left:'22px', zIndex:40, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color:'#9B59FF' }}
        >
          <BackIcon size={28} />
          <span style={{ fontFamily:'var(--font-vyan)', fontSize:11, letterSpacing:'0.2em', opacity:0.7 }}>ŚŪNYA MAṆḌALA</span>
        </motion.button>
      )}

      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:3 }}
        style={{ position:'fixed', bottom:'5%', left:'50%', transform:'translateX(-50%)', zIndex:40, pointerEvents:'none', fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.25em', color:'rgba(255,255,255,0.10)', textTransform:'uppercase', margin:0 }}
      >
        Scroll or swipe to rotate · Tap a fruit to enter
      </motion.p>

      <AnimatePresence>
        {showPanel && panelGateway && (
          <GatewayPanel gateway={panelGateway} onClose={handleClose}
            onEnter={() => { handleClose(); onGatewayEnter?.(panelGateway) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Gateway detail panel ───────────────────────────────────────────────────────
function GatewayPanel({ gateway, onClose, onEnter }: {
  gateway: Gateway; onClose: () => void; onEnter: () => void
}) {
  const [ch, setCh] = useState(false)
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.4 }}
      style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}
        style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.82)', backdropFilter:'blur(14px)' }}
      />
      <motion.div
        initial={{ opacity:0, scale:0.88, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.88, y:20 }}
        transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}
        style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'460px', background:'rgba(255,255,255,0.03)', border:`1px solid ${gateway.color}28`, borderRadius:'20px', backdropFilter:'blur(24px)', padding:'34px', boxShadow:`0 0 70px ${gateway.color}18` }}
      >
        <div style={{ position:'absolute', top:0, left:'12%', right:'12%', height:'1px', background:`linear-gradient(90deg,transparent,${gateway.color}60,transparent)` }} />
        <div style={{ marginBottom:'22px' }}>
          <div style={{ fontSize:'9px', letterSpacing:'0.28em', color:`${gateway.color}80`, fontFamily:'var(--font-vyan)', textTransform:'uppercase', marginBottom:'7px' }}>{gateway.tantra}</div>
          <h2 style={{ fontFamily:'var(--font-vyan)', fontSize:'24px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.92)', textTransform:'uppercase', marginBottom:'6px', textShadow:`0 0 30px ${gateway.color}40` }}>{gateway.name}</h2>
          <p style={{ fontFamily:'var(--font-vyan)', fontSize:'10px', letterSpacing:'0.15em', color:`${gateway.color}70`, textTransform:'uppercase' }}>{gateway.tagline}</p>
        </div>
        <button onMouseEnter={() => setCh(true)} onMouseLeave={() => setCh(false)} onClick={onClose}
          style={{ position:'absolute', top:16, right:16, background:'none', border:'none', cursor:'pointer' }}
        >
          <CloseIcon size={24} isHovered={ch} />
        </button>
        <p style={{ fontFamily:'var(--font-vyan)', fontSize:'14px', lineHeight:'1.75', color:'rgba(255,255,255,0.55)', letterSpacing:'0.02em', marginBottom:'30px' }}>{gateway.description}</p>
        <div style={{ display:'flex', gap:'12px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', color:'rgba(255,255,255,0.45)', fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-vyan)', cursor:'pointer' }}>Return</button>
          <button onClick={onEnter} style={{ padding:'12px 26px', background:`${gateway.color}15`, border:`1px solid ${gateway.color}40`, borderRadius:'10px', color:gateway.color, fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-vyan)', cursor:'pointer' }}>Enter</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
