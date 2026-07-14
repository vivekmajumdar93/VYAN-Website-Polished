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

// ── Seeded deterministic RNG ───────────────────────────────────────────────────
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

// ── Crystal teardrop geometry (shared) ────────────────────────────────────────
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

// ── Trunk strand: many wire fibres bundled, flared at base and canopy ──────────
function trunkStrand(i: number, N: number): THREE.Vector3[] {
  const θ  = (i / N) * Math.PI * 2
  const tw = θ + (i / N) * 1.1  // gentle twist
  return [
    new THREE.Vector3(2.6 * Math.cos(θ),       0.0, 2.6 * Math.sin(θ)),
    new THREE.Vector3(1.9 * Math.cos(θ + 0.08), 1.8, 1.9 * Math.sin(θ + 0.08)),
    new THREE.Vector3(0.9 * Math.cos(tw),        4.2, 0.9 * Math.sin(tw)),
    new THREE.Vector3(1.3 * Math.cos(tw + 0.18), 6.8, 1.3 * Math.sin(tw + 0.18)),
    new THREE.Vector3(2.0 * Math.cos(tw + 0.38), 9.0, 2.0 * Math.sin(tw + 0.38)),
  ]
}

// ── Branch: radiates from upper trunk into hemispherical canopy ────────────────
function branch(i: number, N: number, r: () => number): THREE.Vector3[] {
  const φ = Math.acos(1 - 2 * (i / N) * 0.88)
  const θ = (i * 2.399)  // golden angle spiral
  const rad = 5.2 + r() * 1.8

  const tx = rad * Math.sin(φ) * Math.cos(θ)
  const ty = 10.5 + rad * Math.cos(φ) * 0.55
  const tz = rad * Math.sin(φ) * Math.sin(θ)

  const sa = θ * 0.25
  const sx = (1.6 + r() * 0.6) * Math.cos(sa)
  const sy = 8.0 + r() * 2.0
  const sz = (1.6 + r() * 0.6) * Math.sin(sa)

  const mx = (sx * 0.35 + tx * 0.65)
  const my = (sy + ty) * 0.5 + r() * 1.2
  const mz = (sz * 0.35 + tz * 0.65)

  return [
    new THREE.Vector3(sx, sy, sz),
    new THREE.Vector3(mx, my, mz),
    new THREE.Vector3(tx + (r() - 0.5) * 0.4, ty + (r() - 0.5) * 0.3, tz + (r() - 0.5) * 0.4),
  ]
}

function toLine(pts: THREE.Vector3[], seg: number): THREE.Line {
  const curve = new THREE.CatmullRomCurve3(pts)
  const geo   = new THREE.BufferGeometry().setFromPoints(curve.getPoints(seg))
  return new THREE.Line(geo)
}

// ── Product fruit positions inside the canopy ──────────────────────────────────
const FRUIT_POS: [number, number, number][] = [
  [ 3.8,  15.5,  1.2],
  [-3.2,  15.0, -1.8],
  [ 6.0,  12.5,  3.8],
  [-6.2,  12.0, -3.2],
  [ 1.8,  13.5, -5.8],
  [-2.0,  11.5,  6.0],
  [ 5.2,  10.5, -4.8],
  [-4.5,  10.0,  4.5],
]

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

  // Trunk wires
  const trunkLines = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: '#a0b0c0', transparent: true, opacity: 0.70 })
    return Array.from({ length: 70 }, (_, i) => {
      const l = toLine(trunkStrand(i, 70), 28)
      l.material = mat
      return l
    })
  }, [])

  // Branch wires
  const branchLines = useMemo(() => {
    const r   = rng(77)
    const mat = new THREE.LineBasicMaterial({ color: '#7888a0', transparent: true, opacity: 0.52 })
    return Array.from({ length: 180 }, (_, i) => {
      const l = toLine(branch(i, 180, rng(77 + i)), 16)
      l.material = mat
      return l
    })
  }, [])

  // Crystal drop instance transforms
  const dropMatrices = useMemo(() => {
    const r     = rng(123)
    const dummy = new THREE.Object3D()
    const mats  = new THREE.InstancedBufferAttribute(new Float32Array(300 * 16), 16)
    const arr: THREE.Matrix4[] = []
    for (let i = 0; i < 300; i++) {
      const bi  = Math.floor(r() * 180)
      const t   = 0.45 + r() * 0.55
      const pts = branch(bi, 180, rng(77 + bi))
      const c   = new THREE.CatmullRomCurve3(pts)
      const p   = c.getPoint(t)
      dummy.position.set(p.x + (r() - 0.5) * 0.35, p.y - r() * 0.45, p.z + (r() - 0.5) * 0.35)
      const s = 0.35 + r() * 0.55
      dummy.scale.set(s, s, s)
      dummy.rotation.x = (r() - 0.5) * 0.5
      dummy.rotation.z = (r() - 0.5) * 0.3
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

  // Scroll → rotation
  useEffect(() => {
    const h = (e: WheelEvent) => { targetRY.current += e.deltaY * 0.0018 }
    window.addEventListener('wheel', h, { passive: true })
    return () => window.removeEventListener('wheel', h)
  }, [])

  // Touch swipe → rotation
  const touchX = useRef(0)
  useEffect(() => {
    const ts = (e: TouchEvent) => { touchX.current = e.touches[0].clientX }
    const tm = (e: TouchEvent) => {
      targetRY.current -= (e.touches[0].clientX - touchX.current) * 0.008
      touchX.current = e.touches[0].clientX
    }
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchmove',  tm, { passive: true })
    return () => { window.removeEventListener('touchstart', ts); window.removeEventListener('touchmove', tm) }
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
      {/* Mirror disc */}
      <mesh position={[0, -0.10, 0]}>
        <cylinderGeometry args={[3.1, 3.1, 0.03, 80]} />
        <meshStandardMaterial color="#12122a" metalness={1.0} roughness={0.04} />
      </mesh>

      {/* Trunk strands */}
      {trunkLines.map((l, i) => <primitive key={`t${i}`} object={l} />)}
      {/* Branch strands */}
      {branchLines.map((l, i) => <primitive key={`b${i}`} object={l} />)}

      {/* Crystal drops (instanced for performance) */}
      <instancedMesh ref={iMeshRef} args={[TEAR_GEO, undefined, 300]} renderOrder={2}>
        <meshPhysicalMaterial
          color="#ddeeff"
          metalness={0.05}
          roughness={0.04}
          transmission={0.80}
          transparent
          ior={1.9}
          thickness={0.35}
          emissive="#99bbdd"
          emissiveIntensity={0.08}
        />
      </instancedMesh>

      {/* 8 product fruits */}
      <Suspense fallback={null}>
        {GATEWAYS.map((gw, i) => (
          <ProductFruit
            key={gw.id}
            gw={gw}
            pos={FRUIT_POS[i]}
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

function ProductFruit({ gw, pos, isHovered, onHover, onClick }: {
  gw: Gateway
  pos: [number, number, number]
  isHovered: boolean
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  const tex       = useTexture(assetPath(gw.filename))
  const meshRef   = useRef<THREE.Mesh>(null)
  const matRef    = useRef<THREE.MeshStandardMaterial>(null)
  const glowRef   = useRef<THREE.Mesh>(null)
  const hov       = useRef(0)
  const emissive  = useMemo(() => new THREE.Color(gw.color), [gw.color])

  useFrame(({ clock }) => {
    hov.current += ((isHovered ? 1 : 0) - hov.current) * 0.09
    const t = clock.elapsedTime
    if (meshRef.current) {
      const s = 0.82 + hov.current * 0.45 + Math.sin(t * 0.9 + pos[0]) * 0.05
      meshRef.current.scale.setScalar(s)
    }
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.07 + hov.current * 0.85
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.10 + hov.current * 0.55 + Math.sin(t * 1.3) * 0.03
    }
  })

  return (
    <group position={pos}>
      {/* Outer glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.15, 16, 16]} />
        <meshBasicMaterial color={gw.color} transparent opacity={0.10} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      {/* Product sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={e => { e.stopPropagation(); onHover(gw.id) }}
        onPointerOut={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onClick(gw.id) }}
      >
        <sphereGeometry args={[0.78, 40, 40]} />
        <meshStandardMaterial
          ref={matRef}
          map={tex}
          metalness={0.08}
          roughness={0.12}
          emissive={emissive}
          emissiveIntensity={0.07}
        />
      </mesh>
      {/* Hanging thread */}
      <primitive object={(() => {
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.78, 0), new THREE.Vector3(0, 1.55, 0)])
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#8899bb', transparent: true, opacity: 0.50 }))
        return l
      })()} />
      {/* Label on hover */}
      <Html center distanceFactor={14} position={[0, -1.25, 0]} occlude={false}
        style={{ pointerEvents:'none', textAlign:'center', whiteSpace:'nowrap', opacity: isHovered ? 1 : 0, transition:'opacity 0.35s' }}
      >
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.28em', color:gw.color, textTransform:'uppercase', textShadow:`0 0 18px ${gw.color}` }}>{gw.name}</div>
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'7px', letterSpacing:'0.18em', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', marginTop:'4px' }}>{gw.tantra}</div>
      </Html>
    </group>
  )
}

// ── Scene lighting ─────────────────────────────────────────────────────────────

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.12} />
      {/* Main spotlight from above — creates the dramatic crystal sparkle */}
      <pointLight position={[0, 28, 6]}  intensity={5.0} color="#ffffff" decay={2} />
      {/* Side fill — cool blue rim */}
      <pointLight position={[-8, 14, 8]} intensity={2.0} color="#c0d8ff" decay={2} />
      {/* Warm accent from right */}
      <pointLight position={[10, 10, -4]} intensity={1.2} color="#fff0d0" decay={2} />
      {/* Under-glow off the reflective base */}
      <pointLight position={[0, 0.5, 0]} intensity={0.6} color="#6080a0" decay={2} />
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

      {/* ── Focused fruit nameplate ── */}
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

      {/* ── Wordmark ── */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.2 }}
        style={{ position:'fixed', top:'22px', right:'24px', zIndex:40, pointerEvents:'none', textAlign:'right' }}
      >
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.40em', color:'rgba(212,180,80,0.55)', textTransform:'uppercase' }}>Vistāra</div>
        <div style={{ fontFamily:'var(--font-vyan)', fontSize:'8px', letterSpacing:'0.22em', color:'rgba(255,255,255,0.18)', textTransform:'uppercase', marginTop:'3px' }}>The Manifestations</div>
      </motion.div>

      {/* ── Back ── */}
      {onBack && (
        <motion.button initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.8 }}
          onClick={onBack}
          style={{ position:'fixed', top:'22px', left:'22px', zIndex:40, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color:'#9B59FF' }}
        >
          <BackIcon size={28} />
          <span style={{ fontFamily:'var(--font-vyan)', fontSize:11, letterSpacing:'0.2em', opacity:0.7 }}>ŚŪNYA MAṆḌALA</span>
        </motion.button>
      )}

      {/* ── Hint ── */}
      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:3 }}
        style={{ position:'fixed', bottom:'5%', left:'50%', transform:'translateX(-50%)', zIndex:40, pointerEvents:'none', fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.25em', color:'rgba(255,255,255,0.10)', textTransform:'uppercase', margin:0 }}
      >
        Scroll or swipe to rotate · Click a fruit to enter
      </motion.p>

      {/* ── Gateway panel ── */}
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
