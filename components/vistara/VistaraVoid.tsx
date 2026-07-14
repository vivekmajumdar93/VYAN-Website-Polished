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

function trunkStrand(i: number, N: number): THREE.Vector3[] {
  const θ  = (i / N) * Math.PI * 2
  const tw = θ + (i / N) * 1.1
  return [
    new THREE.Vector3(2.6 * Math.cos(θ),        0.0, 2.6 * Math.sin(θ)),
    new THREE.Vector3(1.9 * Math.cos(θ + 0.08), 1.8, 1.9 * Math.sin(θ + 0.08)),
    new THREE.Vector3(0.9 * Math.cos(tw),        4.2, 0.9 * Math.sin(tw)),
    new THREE.Vector3(1.3 * Math.cos(tw + 0.18), 6.8, 1.3 * Math.sin(tw + 0.18)),
    new THREE.Vector3(2.0 * Math.cos(tw + 0.38), 9.0, 2.0 * Math.sin(tw + 0.38)),
  ]
}

function toLine(pts: THREE.Vector3[], seg: number): THREE.Line {
  const curve = new THREE.CatmullRomCurve3(pts)
  const geo   = new THREE.BufferGeometry().setFromPoints(curve.getPoints(seg))
  return new THREE.Line(geo)
}

// ARM_ANCHORS: where each main branch terminates (the hanging point).
// Fruits hang 1.3 units BELOW each anchor.
const ARM_ANCHORS: [number, number, number][] = [
  [ 4.8, 14.5,  0.0],
  [ 3.4, 13.2,  3.4],
  [ 0.0, 14.0,  4.8],
  [-3.4, 12.8,  3.4],
  [-4.8, 14.3,  0.0],
  [-3.4, 12.2, -3.4],
  [ 0.0, 13.5, -4.8],
  [ 3.4, 12.2, -3.4],
]

// Fruits hang BELOW their anchor point
const FRUIT_POS: [number, number, number][] =
  ARM_ANCHORS.map(([x, y, z]) => [x, y - 1.35, z])

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

  // 70 trunk wire strands
  const trunkLines = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: '#a8b8c8', transparent: true, opacity: 0.72 })
    return Array.from({ length: 70 }, (_, i) => {
      const l = toLine(trunkStrand(i, 70), 28)
      l.material = mat
      return l
    })
  }, [])

  // 8 main arm branches — trunk crown → anchor point (bright spine)
  const armLines = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: '#b8ccde', transparent: true, opacity: 0.88 })
    return ARM_ANCHORS.map((anchor, i) => {
      const θ      = (i / 8) * Math.PI * 2
      const origin = new THREE.Vector3(1.6 * Math.cos(θ), 9.2, 1.6 * Math.sin(θ))
      const anc    = new THREE.Vector3(...anchor)
      // Mid control point arcs upward above the straight line
      const mid = new THREE.Vector3(
        origin.x * 0.30 + anc.x * 0.70,
        Math.max(origin.y, anc.y) + 0.8,
        origin.z * 0.30 + anc.z * 0.70,
      )
      const l = toLine([origin, mid, anc], 30)
      l.material = mat
      return l
    })
  }, [])

  // 120 fill branches — all start from crown, arc upward to dome surface.
  // Uses golden-angle spiral on upper hemisphere so they form a proper dome.
  const branchLines = useMemo(() => {
    const mat  = new THREE.LineBasicMaterial({ color: '#8898b2', transparent: true, opacity: 0.55 })
    const lines: THREE.Line[] = []

    for (let i = 0; i < 120; i++) {
      const r2 = rng(300 + i * 7)

      // Distribute tips on upper hemisphere (φ: 0=top → 75°=outer edge)
      const φ   = (i / 120) * Math.PI * 0.42      // 0 → 75°
      const θ   = i * 2.399                         // golden angle
      const rad = 4.0 + r2() * 2.8

      // Origin clusters around trunk crown
      const oR = 0.8 + r2() * 0.9
      const origin = new THREE.Vector3(
        oR * Math.cos(θ),
        8.6 + r2() * 0.8,
        oR * Math.sin(θ),
      )

      // Tip on dome surface
      const tipR = rad * Math.sin(φ)
      const tipY = 9.5 + rad * Math.cos(φ) * 0.80 + (r2() - 0.5) * 0.5
      const tipθ = θ + (r2() - 0.5) * 0.25
      const tip  = new THREE.Vector3(tipR * Math.cos(tipθ), tipY, tipR * Math.sin(tipθ))

      // Mid control: always above both endpoints → natural upward arc
      const mid = new THREE.Vector3(
        origin.x * 0.32 + tip.x * 0.68,
        Math.max(origin.y, tip.y) + 0.5 + r2() * 0.7,
        origin.z * 0.32 + tip.z * 0.68,
      )

      const l = toLine([origin, mid, tip], 12)
      l.material = mat
      lines.push(l)
    }
    return lines
  }, [])

  // 240 crystal drops hanging from dome surface
  const dropMatrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    const arr: THREE.Matrix4[] = []
    for (let i = 0; i < 240; i++) {
      const r2  = rng(600 + i * 11)
      const φ   = r2() * Math.PI * 0.44
      const θ   = r2() * Math.PI * 2
      const rad = 3.5 + r2() * 3.0
      const tipR = rad * Math.sin(φ)
      const tipY = 9.5 + rad * Math.cos(φ) * 0.80
      const p = new THREE.Vector3(
        tipR * Math.cos(θ) + (r2() - 0.5) * 1.4,
        tipY - r2() * 1.0,
        tipR * Math.sin(θ) + (r2() - 0.5) * 1.4,
      )
      const s = 0.18 + r2() * 0.44
      dummy.position.copy(p)
      dummy.scale.setScalar(s)
      dummy.rotation.x = (r2() - 0.5) * 0.4
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
      {/* Base */}
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

      {/* Crystal drops */}
      <instancedMesh ref={iMeshRef} args={[TEAR_GEO, undefined, 240]} renderOrder={2}>
        <meshPhysicalMaterial
          color="#ddeeff"
          metalness={0.05}
          roughness={0.04}
          transmission={0.80}
          transparent
          ior={1.9}
          thickness={0.35}
          emissive="#99bbdd"
          emissiveIntensity={0.10}
        />
      </instancedMesh>

      {/* Product fruits hanging from arm anchors */}
      <Suspense fallback={null}>
        {GATEWAYS.map((gw, i) => (
          <ProductFruit
            key={gw.id}
            gw={gw}
            pos={FRUIT_POS[i]}
            anchor={ARM_ANCHORS[i]}
            isHovered={hoveredId === gw.id}
            onHover={onHover}
            onClick={onFruitClick}
          />
        ))}
      </Suspense>
    </group>
  )
}

// ── Product fruit — hangs below its arm anchor ─────────────────────────────────
function ProductFruit({ gw, pos, anchor, isHovered, onHover, onClick }: {
  gw: Gateway
  pos: [number, number, number]
  anchor: [number, number, number]
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

  // Thread: from sphere-top up to the arm anchor (in local space of fruit group)
  const threadObj = useMemo(() => {
    const dy = anchor[1] - pos[1]   // ≈ 1.35 — distance from fruit center to anchor
    const g  = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.42, 0),  // sphere top
      new THREE.Vector3(0, dy, 0),    // arm anchor
    ])
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#9aaabb', transparent: true, opacity: 0.60 }))
  }, [anchor, pos])

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
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.64, 16, 16]} />
        <meshBasicMaterial color={gw.color} transparent opacity={0.08} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      {/* Product sphere */}
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
      {/* Thread upward to arm anchor */}
      <primitive object={threadObj} />
      {/* Hover label */}
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
      <pointLight position={[0, 28, 6]}   intensity={5.5} color="#ffffff" decay={2} />
      <pointLight position={[-8, 14, 8]}  intensity={2.0} color="#c0d8ff" decay={2} />
      <pointLight position={[10, 10, -4]} intensity={1.2} color="#fff0d0" decay={2} />
      <pointLight position={[0, 0.5, 0]}  intensity={0.6} color="#6080a0" decay={2} />
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
        camera={{ position:[0, 8.5, 32], fov:52, near:0.1, far:300 }}
        style={{ position:'absolute', inset:0 }}
        gl={{ antialias:true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        dpr={[1, 1.5]}
        onCreated={({ gl, scene, camera }) => {
          gl.setClearColor(0x000000, 1)
          scene.background = new THREE.Color(0x000000)
          camera.lookAt(0, 8.5, 0)
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
            initial={{ opacity:0, y:8 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-6 }}
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
        Scroll or swipe to rotate · Click a fruit to enter
      </motion.p>

      <AnimatePresence>
        {showPanel && panelGateway && (
          <GatewayPanel
            gateway={panelGateway}
            onClose={handleClose}
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
