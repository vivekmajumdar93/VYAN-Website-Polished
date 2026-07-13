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

// ── Gateway positions — scattered through 3D space ─────────────────────────────
// Near gateways fill the screen; deep ones pull the eye into the void.
const GW_POS: [number, number, number][] = [
  [-5.5,  2.8,   0],   // rtam        — near left
  [ 6.2,  3.2,  -3],   // ojas        — mid right
  [-3.2, -3.8,  -5],   // mudra       — mid left deep
  [ 5.0,  0.8,  -7],   // netra       — right deep
  [ 0.5,  1.8,  -2],   // akriti      — centre mid
  [-7.2, -0.5,  -9],   // sutra       — far left deep
  [ 3.5, -3.5,  -4],   // chitra-prana — mid right low
  [-1.5,  3.8, -12],   // maya        — deepest
]

// ── Gate dimensions ─────────────────────────────────────────────────────────────
const GW = 3.4   // gate width  in world units
const GH = 5.1   // gate height — tall, monolithic portals

// ── Stardust particle shaders ──────────────────────────────────────────────────

const DUST_VERT = /* glsl */`
uniform float uTime;
uniform float uSize;
attribute float aRand;

void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.09 + position.y * 1.73 + aRand * 6.28) * 0.45;
  p.y += cos(uTime * 0.07 + position.z * 1.41 + aRand * 3.14) * 0.30;
  p.z += sin(uTime * 0.11 + position.x * 2.07 + aRand * 9.42) * 0.20;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (260.0 / -mv.z) * (0.5 + 0.5 * aRand);
  gl_Position  = projectionMatrix * mv;
}
`
const DUST_FRAG = /* glsl */`
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.5, 1.0, d)) * 0.50;
  gl_FragColor = vec4(0.72, 0.78, 1.0, a);
}
`

// ── StarDust component ─────────────────────────────────────────────────────────

function StarDust() {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const N = 2800

  const [positions, randoms] = useMemo(() => {
    const pos  = new Float32Array(N * 3)
    const rand = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 38
      pos[i*3+1] = (Math.random() - 0.5) * 24
      pos[i*3+2] = (Math.random() - 0.5) * 28 - 6
      rand[i] = Math.random()
    }
    return [pos, rand]
  }, [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSize: { value: 1.8 },
  }), [])

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aRand"    args={[randoms,   1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={DUST_VERT}
        fragmentShader={DUST_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ── Neural web — pulsing gossamer threads between gateways ─────────────────────

function NeuralWeb() {
  const matRef = useRef<THREE.LineBasicMaterial>(null)

  const verts = useMemo(() => {
    const pts: number[] = []
    const THRESH = 12
    for (let i = 0; i < GW_POS.length; i++) {
      for (let j = i + 1; j < GW_POS.length; j++) {
        const [ax, ay, az] = GW_POS[i]
        const [bx, by, bz] = GW_POS[j]
        const d = Math.sqrt((ax-bx)**2 + (ay-by)**2 + (az-bz)**2)
        if (d < THRESH) pts.push(ax, ay, az, bx, by, bz)
      }
    }
    return new Float32Array(pts)
  }, [])

  useFrame(({ clock }) => {
    if (matRef.current)
      matRef.current.opacity = 0.035 + 0.025 * Math.sin(clock.elapsedTime * 0.35)
  })

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[verts, 3]} />
      </bufferGeometry>
      <lineBasicMaterial ref={matRef} color="#7755dd" transparent opacity={0.04} depthWrite={false} />
    </lineSegments>
  )
}

// ── Single gigantic gateway portal ────────────────────────────────────────────

function GatewayPortal({ gw, position, hoveredId, onHover, onClick }: {
  gw: Gateway
  position: [number, number, number]
  hoveredId: string | null
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  const tex      = useTexture(assetPath(gw.filename))
  const groupRef = useRef<THREE.Group>(null)
  const frameRef = useRef<THREE.Group>(null)
  const hoverVal = useRef(0)
  const lerpCol  = useMemo(() => new THREE.Color(), [])
  const baseCol  = useMemo(() => new THREE.Color(gw.color).multiplyScalar(0.50), [gw.color])
  const highCol  = useMemo(() => new THREE.Color(gw.color).multiplyScalar(2.20), [gw.color])
  const isHov    = hoveredId === gw.id

  // Fit texture to plane (cover — no stretching) once image loads
  useEffect(() => {
    if (!tex.image) return
    const imgAR   = tex.image.width / tex.image.height
    const planeAR = GW / GH
    if (imgAR > planeAR) {
      tex.repeat.set(planeAR / imgAR, 1)
      tex.offset.set((1 - planeAR / imgAR) / 2, 0)
    } else {
      tex.repeat.set(1, imgAR / planeAR)
      tex.offset.set(0, (1 - imgAR / planeAR) / 2)
    }
    tex.needsUpdate = true
  }, [tex])

  useFrame(({ clock }) => {
    hoverVal.current += ((isHov ? 1 : 0) - hoverVal.current) * 0.07

    const pulse = 0.72 + 0.28 * Math.sin(clock.elapsedTime * 1.3 + position[0] * 0.5)
    lerpCol.copy(baseCol).lerp(highCol, hoverVal.current * pulse)

    if (frameRef.current) {
      frameRef.current.children.forEach(child => {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
        if (mat?.color) mat.color.copy(lerpCol)
      })
    }

    if (groupRef.current) {
      const tiltY = isHov ? 0.06 : 0
      groupRef.current.rotation.y += (tiltY - groupRef.current.rotation.y) * 0.05
    }
  })

  const B = 0.06  // border bar thickness

  return (
    <group ref={groupRef} position={position}>

      {/* Image plane — fills the gate */}
      <mesh
        renderOrder={1}
        onPointerOver={e => { e.stopPropagation(); onHover(gw.id) }}
        onPointerOut={()  => onHover(null)}
        onClick={e =>        { e.stopPropagation(); onClick(gw.id) }}
      >
        <planeGeometry args={[GW, GH]} />
        <meshBasicMaterial map={tex} />
      </mesh>

      {/* Glowing frame bars — these bloom under UnrealBloomPass */}
      <group ref={frameRef}>
        <mesh position={[0,  GH/2 + B/2,  0.01]}><boxGeometry args={[GW + B*2, B, 0.01]} /><meshBasicMaterial color={gw.color} /></mesh>
        <mesh position={[0, -GH/2 - B/2,  0.01]}><boxGeometry args={[GW + B*2, B, 0.01]} /><meshBasicMaterial color={gw.color} /></mesh>
        <mesh position={[-GW/2 - B/2, 0,  0.01]}><boxGeometry args={[B, GH + B*2, 0.01]} /><meshBasicMaterial color={gw.color} /></mesh>
        <mesh position={[ GW/2 + B/2, 0,  0.01]}><boxGeometry args={[B, GH + B*2, 0.01]} /><meshBasicMaterial color={gw.color} /></mesh>
      </group>

      {/* Label beneath the gate */}
      <Html
        center
        distanceFactor={14}
        position={[0, -GH/2 - 0.55, 0]}
        occlude={false}
        style={{ pointerEvents: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}
      >
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '12px', letterSpacing: '0.32em', color: gw.color, textTransform: 'uppercase', textShadow: `0 0 22px ${gw.color}` }}>
          {gw.name}
        </div>
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '7px', letterSpacing: '0.20em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', marginTop: '5px' }}>
          {gw.tantra}
        </div>
      </Html>
    </group>
  )
}

// ── Cinematic camera traverse ──────────────────────────────────────────────────

function CameraTraverse({ target }: { target: THREE.Vector3 | null }) {
  const { camera } = useThree()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    let tx: number, ty: number, tz: number

    if (target) {
      tx = target.x * 0.38
      ty = target.y * 0.22
      tz = target.z + 9
    } else {
      tx = Math.sin(t * 0.055) * 4.0
      ty = Math.cos(t * 0.038) * 2.0
      tz = 15 + Math.sin(t * 0.030) * 2.5
    }

    camera.position.x += (tx - camera.position.x) * 0.011
    camera.position.y += (ty - camera.position.y) * 0.011
    camera.position.z += (tz - camera.position.z) * 0.011

    const lx = Math.sin(t * 0.022) * 2.0
    const ly = Math.cos(t * 0.018) * 1.0
    camera.lookAt(lx, ly, -5)
  })

  return null
}

// ── Bloom ──────────────────────────────────────────────────────────────────────

function Bloom() {
  const { gl, scene, camera, size } = useThree()

  const composer = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    c.addPass(new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.55,   // strength — frame bars glow dramatically
      0.60,   // radius
      0.12,   // low threshold — base glow always blooms slightly
    ))
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
  const [showPanel,    setShowPanel]    = useState(false)
  const [panelGateway, setPanelGateway] = useState<Gateway | null>(null)
  const [camTarget,    setCamTarget]    = useState<THREE.Vector3 | null>(null)

  const handleClick = useCallback((id: string) => {
    const gw  = GATEWAYS.find(g => g.id === id)
    if (!gw) return
    const idx = GATEWAYS.indexOf(gw)
    const pos = GW_POS[idx]
    setCamTarget(new THREE.Vector3(pos[0], pos[1], pos[2]))
    setPanelGateway(gw)
    setShowPanel(true)
  }, [])

  const handleClose = useCallback(() => {
    setShowPanel(false)
    setPanelGateway(null)
    setCamTarget(null)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 2 }}>

      <Canvas
        camera={{ position: [0, 0, 15], fov: 55, near: 0.1, far: 220 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true }}
        dpr={[1, 1.5]}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 1)
          scene.background = new THREE.Color(0x000000)
        }}
      >
        <StarDust />
        <NeuralWeb />
        <Suspense fallback={null}>
          {GATEWAYS.map((gw, i) => (
            <GatewayPortal
              key={gw.id}
              gw={gw}
              position={GW_POS[i]}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onClick={handleClick}
            />
          ))}
        </Suspense>
        <CameraTraverse target={camTarget} />
        <Bloom />
      </Canvas>

      {/* ── Wordmark ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
        style={{ position: 'fixed', top: '22px', right: '24px', zIndex: 40, pointerEvents: 'none', textAlign: 'right' }}
      >
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '11px', letterSpacing: '0.40em', color: 'rgba(212,180,80,0.55)', textTransform: 'uppercase' }}>Vistāra</div>
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '8px',  letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', marginTop: '3px' }}>The Manifestations</div>
      </motion.div>

      {/* ── Back ── */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          onClick={onBack}
          style={{ position: 'fixed', top: '22px', left: '22px', zIndex: 40, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#9B59FF' }}
        >
          <BackIcon size={28} />
          <span style={{ fontFamily: 'var(--font-vyan)', fontSize: 11, letterSpacing: '0.2em', opacity: 0.7 }}>ŚŪNYA MAṆḌALA</span>
        </motion.button>
      )}

      {/* ── Hint ── */}
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.5 }}
        style={{ position: 'fixed', bottom: '5%', left: '50%', transform: 'translateX(-50%)', zIndex: 40, pointerEvents: 'none', fontFamily: 'var(--font-vyan)', fontSize: '9px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.10)', textTransform: 'uppercase', margin: 0 }}
      >
        Traverse the realm · Click to enter
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

// ── Gateway detail panel ────────────────────────────────────────────────────────

function GatewayPanel({ gateway, onClose, onEnter }: {
  gateway: Gateway
  onClose: () => void
  onEnter: () => void
}) {
  const [closeHov, setCloseHov] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(14px)' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 20 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '460px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${gateway.color}28`, borderRadius: '20px', backdropFilter: 'blur(24px)', padding: '34px', boxShadow: `0 0 70px ${gateway.color}18` }}
      >
        <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: '1px', background: `linear-gradient(90deg,transparent,${gateway.color}60,transparent)` }} />
        <div style={{ marginBottom: '22px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.28em', color: `${gateway.color}80`, fontFamily: 'var(--font-vyan)', textTransform: 'uppercase', marginBottom: '7px' }}>{gateway.tantra}</div>
          <h2 style={{ fontFamily: 'var(--font-vyan)', fontSize: '24px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', marginBottom: '6px', textShadow: `0 0 30px ${gateway.color}40` }}>{gateway.name}</h2>
          <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '10px', letterSpacing: '0.15em', color: `${gateway.color}70`, textTransform: 'uppercase' }}>{gateway.tagline}</p>
        </div>
        <button onMouseEnter={() => setCloseHov(true)} onMouseLeave={() => setCloseHov(false)} onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
          <CloseIcon size={24} isHovered={closeHov} />
        </button>
        <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '14px', lineHeight: '1.75', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em', marginBottom: '30px' }}>{gateway.description}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.45)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer' }}>Return</button>
          <button onClick={onEnter} style={{ padding: '12px 26px', background: `${gateway.color}15`, border: `1px solid ${gateway.color}40`, borderRadius: '10px', color: gateway.color, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer' }}>Enter</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
