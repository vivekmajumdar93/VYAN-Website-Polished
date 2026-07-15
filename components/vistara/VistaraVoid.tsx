'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GATEWAYS, type Gateway, assetPath } from '@/lib/vistara/gateways'

// ─── helpers ──────────────────────────────────────────────────────────────────
function to3D(gw: Gateway): [number, number, number] {
  return [
    (gw.x / 100 - 0.5) * 10,
    -(gw.y / 100 - 0.5) * 6,
    -(1 - gw.depth) * 5,
  ]
}

function easeInExpo(t: number): number {
  return t <= 0 ? 0 : Math.pow(2, 10 * t - 10)
}

// ─── particle field ───────────────────────────────────────────────────────────
const N_PARTICLES = 300

function ParticleField({ spiralTarget, spiralT }: {
  spiralTarget: [number, number, number] | null
  spiralT: number
}) {
  const ptsRef = useRef<THREE.Points>(null)

  const { base, speed, phase } = useMemo(() => {
    const base: number[] = []
    const speed: number[] = []
    const phase: number[] = []
    for (let i = 0; i < N_PARTICLES; i++) {
      base.push((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8 - 2)
      speed.push(0.2 + Math.random() * 0.8)
      phase.push(Math.random() * Math.PI * 2)
    }
    return { base, speed, phase }
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(N_PARTICLES * 3)
    for (let i = 0; i < N_PARTICLES; i++) {
      p[i * 3] = base[i * 3]; p[i * 3 + 1] = base[i * 3 + 1]; p[i * 3 + 2] = base[i * 3 + 2]
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [base])

  useFrame(({ clock }) => {
    if (!ptsRef.current) return
    const attr = ptsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const t = clock.elapsedTime
    for (let i = 0; i < N_PARTICLES; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2]
      let px = bx + Math.sin(t * speed[i] * 0.35 + phase[i]) * 0.18
      let py = by + Math.cos(t * speed[i] * 0.28 + phase[i] * 1.3) * 0.14
      let pz = bz
      if (spiralTarget && spiralT > 0) {
        const pull = Math.min(spiralT, 1)
        px += (spiralTarget[0] - px) * pull * 0.9
        py += (spiralTarget[1] - py) * pull * 0.9
        pz += (spiralTarget[2] - pz) * pull * 0.9
      }
      attr.setXYZ(i, px, py, pz)
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ptsRef} geometry={geo}>
      <pointsMaterial color="#5577aa" size={0.035} transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  )
}

// ─── camera rig ───────────────────────────────────────────────────────────────
function CameraRig({ target, progress }: {
  target: [number, number, number] | null
  progress: number
}) {
  const { camera } = useThree()

  useFrame(({ clock }) => {
    if (target && progress > 0) {
      const [tx, ty, tz] = target
      const t = easeInExpo(Math.min(progress, 1))
      camera.position.x += (tx * 0.4 - camera.position.x) * t * 0.12
      camera.position.y += (ty * 0.25 - camera.position.y) * t * 0.12
      camera.position.z = 12 - t * 9
      camera.lookAt(tx, ty, tz)
    } else {
      const s = clock.elapsedTime
      const ax = Math.sin(s * 0.08) * 0.4
      const ay = Math.cos(s * 0.06) * 0.25
      camera.position.x += (ax - camera.position.x) * 0.02
      camera.position.y += (ay - camera.position.y) * 0.02
      camera.position.z += (12 - camera.position.z) * 0.04
      camera.lookAt(0, 0, 0)
    }
  })

  return null
}

// ─── bloom ────────────────────────────────────────────────────────────────────
function Bloom() {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.9, 0.5, 0.15))
    c.addPass(new OutputPass())
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])
  useEffect(() => { composer.setSize(size.width, size.height) }, [composer, size])
  useEffect(() => () => composer.dispose(), [composer])
  useFrame(() => composer.render(), 1)
  return null
}

// ─── orb position tracker ─────────────────────────────────────────────────────
function OrbPositionTracker({ posRef }: {
  posRef: React.MutableRefObject<Record<string, { x: number; y: number }>>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    GATEWAYS.forEach(gw => {
      const [wx, wy, wz] = to3D(gw)
      v.set(wx, wy, wz)
      v.project(camera)
      posRef.current[gw.id] = {
        x: (v.x + 1) / 2 * size.width,
        y: (-v.y + 1) / 2 * size.height,
      }
    })
  })

  return null
}

// ─── glass orb ────────────────────────────────────────────────────────────────
interface GlassOrbProps {
  gateway: Gateway
  isHovered: boolean
  onHover: (id: string | null) => void
  onClick: (id: string) => void
  pullTarget: [number, number, number] | null
  pullProgress: number
}

function GlassOrb({ gateway, isHovered, onHover, onClick, pullTarget, pullProgress }: GlassOrbProps) {
  const basePos = useMemo(() => to3D(gateway), [gateway])
  const radius = 0.20 + gateway.depth * 0.25

  const groupRef   = useRef<THREE.Group>(null)
  const outerMatRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const innerMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const ringMatRef  = useRef<THREE.MeshBasicMaterial>(null)
  const ringRef     = useRef<THREE.Mesh>(null)
  const lightRef    = useRef<THREE.PointLight>(null)
  const hov         = useRef(0)
  const phaseOff    = useRef(gateway.orbitPhase)
  const pulseT      = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    hov.current += ((isHovered ? 1 : 0) - hov.current) * 0.09
    const h = hov.current

    phaseOff.current += gateway.orbitSpeed * 60 * delta
    const ox = Math.cos(phaseOff.current) * gateway.orbitRadius * 0.005
    const oy = Math.sin(phaseOff.current * 0.7) * gateway.orbitRadius * 0.003

    let gx = basePos[0] + ox
    let gy = basePos[1] + oy
    let gz = basePos[2]

    if (pullTarget && pullProgress > 0) {
      const t = pullProgress * pullProgress
      gx += (pullTarget[0] - gx) * t
      gy += (pullTarget[1] - gy) * t
      gz += (pullTarget[2] - gz) * t
    }

    groupRef.current?.position.set(gx, gy, gz)

    const pullFade = pullTarget && pullProgress > 0 ? Math.max(0, 1 - pullProgress) : 1

    if (outerMatRef.current) {
      outerMatRef.current.opacity = 0.15 * pullFade
    }
    if (innerMatRef.current) {
      innerMatRef.current.emissiveIntensity = 2.4 + h * 1.6
      innerMatRef.current.opacity = 0.6 * pullFade
    }

    pulseT.current += delta * 1.2 * Math.PI * 2
    const pct = (pulseT.current % (Math.PI * 2)) / (Math.PI * 2)

    if (ringMatRef.current) {
      ringMatRef.current.opacity = (isHovered ? 0.7 : 0.4) * Math.sin(pct * Math.PI) * pullFade
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1.0 + pct * 0.8)
    }
    if (lightRef.current) {
      lightRef.current.intensity = (isHovered ? 1.6 : 0.8) * pullFade
    }
  })

  const imgPx = Math.round(gateway.scale * 200)
  const floatAnim = `vfloat${(Math.round(gateway.orbitPhase * 10)) % 4}`

  return (
    <group ref={groupRef} position={basePos}>
      {/* Invisible hit sphere */}
      <mesh
        onPointerOver={e => { e.stopPropagation(); onHover(gateway.id) }}
        onPointerOut={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onClick(gateway.id) }}
      >
        <sphereGeometry args={[radius * 2.0, 8, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Outer glass sphere */}
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshPhysicalMaterial
          ref={outerMatRef}
          color="#4488ff"
          transparent
          opacity={0.15}
          roughness={0.0}
          metalness={0.0}
          transmission={0.95}
          thickness={1.2}
          envMapIntensity={2.0}
          ior={1.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner glow sphere */}
      <mesh>
        <sphereGeometry args={[radius * 0.6, 24, 24]} />
        <meshStandardMaterial
          ref={innerMatRef}
          color="#88ccff"
          emissive="#2266ff"
          emissiveIntensity={2.4}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>

      {/* Pulse ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[radius * 1.2, radius * 0.04, 6, 32]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color="#4499ff"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner point light */}
      <pointLight ref={lightRef} color="#6699ff" intensity={0.8} distance={120} decay={2} />

      {/* Floating product image */}
      <Html center distanceFactor={12} occlude={false} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            width: imgPx,
            height: imgPx,
            animation: `${floatAnim} 4s ease-in-out infinite`,
            animationDelay: `${gateway.orbitPhase * 0.5}s`,
          }}
        >
          <img
            src={assetPath(gateway.filename)}
            alt={gateway.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              mixBlendMode: 'screen',
              opacity: isHovered ? 0.85 : 0.45,
              filter: isHovered ? 'brightness(1.4) saturate(1.3)' : 'none',
              transform: isHovered ? 'scale(1.08)' : 'scale(1)',
              transition: 'opacity 0.3s, filter 0.3s, transform 0.3s',
            }}
          />
        </div>
      </Html>
    </group>
  )
}

// ─── shard generation ─────────────────────────────────────────────────────────
interface ShardData {
  angle: number; dist: number; rotate: number; clipPath: string
}

const SHARDS: ShardData[] = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 3 - 1) * 0.3
  const dist = 180 + (i % 5) * 30
  const rotate = (i % 7 - 3) * 30
  const pts = Array.from({ length: 5 }, (__, j) => {
    const a = (j / 5) * Math.PI * 2 + (j % 2) * 0.6
    const r = 38 + (j % 3) * 20
    return `${50 + Math.cos(a) * r}% ${50 + Math.sin(a) * r}%`
  })
  return { angle, dist, rotate, clipPath: `polygon(${pts.join(', ')})` }
})

// ─── glass panel ─────────────────────────────────────────────────────────────
type PanelPhase = 'shattering' | 'hold' | 'reforming' | 'open' | 'closing'

function GlassPanel({ gateway, onClose, onEnter }: {
  gateway: Gateway
  onClose: () => void
  onEnter: () => void
}) {
  const [phase, setPhase] = useState<PanelPhase>('shattering')
  const [contentVisible, setContentVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 280)
    const t2 = setTimeout(() => setPhase('reforming'), 430)
    const t3 = setTimeout(() => { setPhase('open'); setContentVisible(true) }, 900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const handleClose = useCallback(() => {
    setContentVisible(false)
    setPhase('closing')
    setTimeout(onClose, 400)
  }, [onClose])

  const isOut = phase === 'shattering' || phase === 'hold' || phase === 'closing'

  const shardTransition =
    phase === 'shattering' ? 'transform 280ms cubic-bezier(0.16,1,0.3,1)' :
    phase === 'hold'       ? 'none' :
    phase === 'closing'    ? 'transform 280ms cubic-bezier(0.16,1,0.3,1), opacity 280ms' :
    'transform 450ms cubic-bezier(0.65,0,0.35,1)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)' }}
      />

      {/* Shards */}
      {SHARDS.map((shard, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: '110px',
            height: '110px',
            left: '50%',
            top: '50%',
            marginLeft: '-55px',
            marginTop: '-55px',
            background: `linear-gradient(${Math.round(shard.angle * 57)}deg, rgba(100,160,255,0.4) 0%, rgba(180,210,255,0.15) 50%, rgba(68,136,255,0.08) 100%)`,
            clipPath: shard.clipPath,
            transform: isOut
              ? `translate(${Math.cos(shard.angle) * shard.dist}px, ${Math.sin(shard.angle) * shard.dist}px) rotate(${shard.rotate}deg)`
              : 'translate(0,0) rotate(0)',
            opacity: phase === 'closing' ? 0 : 1,
            transition: shardTransition,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      ))}

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '460px',
          padding: '34px',
          background: 'rgba(10,20,60,0.4)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(100,160,255,0.25)',
          borderRadius: '20px',
          boxShadow: '0 0 60px rgba(68,136,255,0.15)',
          opacity: phase === 'open' ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      >
        {/* Accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '12%', right: '12%', height: '1px',
          background: `linear-gradient(90deg, transparent, ${gateway.color}60, transparent)`,
        }} />

        <div style={{ opacity: contentVisible ? 1 : 0, transition: 'opacity 0.3s 0.1s' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.28em', color: gateway.color, fontFamily: 'var(--font-vyan)', textTransform: 'uppercase', marginBottom: '7px' }}>
            {gateway.tantra}
          </div>
          <h2 style={{ fontFamily: 'var(--font-vyan)', fontSize: '24px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', margin: '0 0 6px' }}>
            {gateway.name}
          </h2>
          <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: `${gateway.color}b3`, textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', margin: '0 0 22px' }}>
            {gateway.tagline}
          </p>
          <p style={{ fontSize: '14px', lineHeight: '1.75', color: 'rgba(255,255,255,0.58)', fontFamily: 'var(--font-vyan)', letterSpacing: '0.02em', margin: '0 0 28px' }}>
            {gateway.description}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleClose}
              style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.45)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer' }}
            >
              Return
            </button>
            <button
              onClick={onEnter}
              style={{ padding: '12px 26px', background: `${gateway.color}26`, border: `1px solid ${gateway.color}60`, borderRadius: '10px', color: gateway.color, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer', boxShadow: `0 0 20px ${gateway.color}1f` }}
            >
              Enter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────
type VortexPhase = 'idle' | 'pull' | 'peak' | 'passage' | 'done'

export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void
  onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [hoveredId,     setHoveredId]     = useState<string | null>(null)
  const [vortexPhase,   setVortexPhase]   = useState<VortexPhase>('idle')
  const [vortexProgress, setVortexProgress] = useState(0)
  const [vortexTargetId, setVortexTargetId] = useState<string | null>(null)
  const [showFlash,     setShowFlash]     = useState(false)
  const [showPanel,     setShowPanel]     = useState(false)
  const [panelGateway,  setPanelGateway]  = useState<Gateway | null>(null)
  const animRef    = useRef<number>(0)
  const startRef   = useRef(0)
  const orbPosRef  = useRef<Record<string, { x: number; y: number }>>({})

  const vortexTarget3D = useMemo((): [number, number, number] | null => {
    if (!vortexTargetId) return null
    const gw = GATEWAYS.find(g => g.id === vortexTargetId)
    return gw ? to3D(gw) : null
  }, [vortexTargetId])

  const handleOrbClick = useCallback((id: string) => {
    if (vortexPhase !== 'idle') return
    setVortexTargetId(id)
    setVortexPhase('pull')
    startRef.current = performance.now()

    const tick = () => {
      const elapsed = performance.now() - startRef.current
      if (elapsed < 400) {
        setVortexProgress(elapsed / 400)
        setVortexPhase('pull')
        animRef.current = requestAnimationFrame(tick)
      } else if (elapsed < 800) {
        setVortexProgress((elapsed - 400) / 400)
        setVortexPhase('peak')
        animRef.current = requestAnimationFrame(tick)
      } else if (elapsed < 1200) {
        setVortexProgress((elapsed - 800) / 400)
        setVortexPhase('passage')
        animRef.current = requestAnimationFrame(tick)
      } else {
        setShowFlash(true)
        setTimeout(() => setShowFlash(false), 80)
        const gw = GATEWAYS.find(g => g.id === id)!
        setPanelGateway(gw)
        setShowPanel(true)
        setVortexPhase('done')
        setVortexProgress(0)
        setTimeout(() => { setVortexPhase('idle'); setVortexTargetId(null) }, 200)
      }
    }
    animRef.current = requestAnimationFrame(tick)
  }, [vortexPhase])

  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  const handleClose = useCallback(() => {
    setShowPanel(false)
    setPanelGateway(null)
  }, [])

  const handleEnter = useCallback(() => {
    const gw = panelGateway
    handleClose()
    if (gw) onGatewayEnter?.(gw)
  }, [panelGateway, handleClose, onGatewayEnter])

  // Pull progress for non-target orbs
  const getPull = useCallback((id: string): number => {
    if (!vortexTargetId || id === vortexTargetId) return 0
    if (vortexPhase === 'pull') return vortexProgress
    if (vortexPhase === 'peak' || vortexPhase === 'passage') return 1
    return 0
  }, [vortexPhase, vortexProgress, vortexTargetId])

  // Camera progress (0-1 for pull, 1-2 for peak, 2-3 for passage)
  const camProgress =
    vortexPhase === 'pull'    ? vortexProgress :
    vortexPhase === 'peak'    ? 1 + vortexProgress :
    vortexPhase === 'passage' ? 2 + vortexProgress : 0

  // Vignette intensity
  const vig =
    vortexPhase === 'pull'    ? vortexProgress * 0.5 :
    vortexPhase === 'peak'    ? 0.5 + vortexProgress * 0.5 :
    vortexPhase === 'passage' ? 1 : 0

  // Expanding orb overlay during passage
  const passCenter = vortexTargetId ? orbPosRef.current[vortexTargetId] : null

  const spiralT =
    vortexPhase === 'pull'    ? vortexProgress :
    vortexPhase === 'peak'    ? 1 :
    vortexPhase === 'passage' ? 1 : 0

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 100, background: '#000000' }}>
      {/* Float keyframes */}
      <style>{`
        @keyframes vfloat0 { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-8px) } }
        @keyframes vfloat1 { 0%,100%{ transform:translateY(-4px) } 50%{ transform:translateY(4px) } }
        @keyframes vfloat2 { 0%,100%{ transform:translateY(-8px) } 50%{ transform:translateY(0) } }
        @keyframes vfloat3 { 0%,100%{ transform:translateY(4px) } 50%{ transform:translateY(-4px) } }
      `}</style>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 12], fov: 55, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        dpr={[1, 1.5]}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 1)
          scene.background = new THREE.Color(0x000000)
        }}
      >
        <ambientLight intensity={0.03} />

        <ParticleField spiralTarget={vortexTarget3D} spiralT={spiralT} />

        {GATEWAYS.map(gw => (
          <GlassOrb
            key={gw.id}
            gateway={gw}
            isHovered={hoveredId === gw.id}
            onHover={setHoveredId}
            onClick={handleOrbClick}
            pullTarget={vortexTargetId && vortexTargetId !== gw.id ? vortexTarget3D : null}
            pullProgress={getPull(gw.id)}
          />
        ))}

        <CameraRig
          target={vortexTargetId ? vortexTarget3D : null}
          progress={camProgress > 0 ? Math.min(camProgress / 3, 1) : 0}
        />

        <OrbPositionTracker posRef={orbPosRef} />
        <Bloom />
      </Canvas>

      {/* Blue edge vignette */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,20,80,${vig.toFixed(2)}) 100%)`,
        transition: vig === 0 ? 'background 0.6s' : 'none',
      }} />

      {/* Expanding orb overlay (passage phase) */}
      {vortexPhase === 'passage' && passCenter && (
        <div style={{
          position: 'fixed',
          left: passCenter.x - 10,
          top: passCenter.y - 10,
          width: 20,
          height: 20,
          transform: `scale(${vortexProgress * 120})`,
          transformOrigin: 'center center',
          background: 'radial-gradient(circle at center, #88ccff 0%, #4488ff 35%, #1144bb 70%, #000820 100%)',
          borderRadius: '50%',
          zIndex: 170,
          pointerEvents: 'none',
          opacity: vortexProgress,
          transition: 'none',
        }} />
      )}

      {/* Screen flash */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 190, pointerEvents: 'none',
        background: '#4488ff',
        opacity: showFlash ? 1 : 0,
        transition: showFlash ? 'none' : 'opacity 80ms',
      }} />

      {/* UI: title */}
      <div style={{ position: 'fixed', top: '22px', right: '24px', zIndex: 40, pointerEvents: 'none', textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '11px', letterSpacing: '0.40em', color: 'rgba(212,180,80,0.55)', textTransform: 'uppercase' }}>Vistāra</div>
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '8px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', marginTop: '3px' }}>The Manifestations</div>
      </div>

      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          style={{ position: 'fixed', top: '22px', left: '22px', zIndex: 40, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#9B59FF' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          <span style={{ fontFamily: 'var(--font-vyan)', fontSize: 11, letterSpacing: '0.2em', opacity: 0.7 }}>ŚŪNYA MAṆḌALA</span>
        </button>
      )}

      {/* Hint */}
      <p style={{ position: 'fixed', bottom: '5%', left: '50%', transform: 'translateX(-50%)', zIndex: 40, pointerEvents: 'none', fontFamily: 'var(--font-vyan)', fontSize: '9px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.10)', textTransform: 'uppercase', margin: 0, whiteSpace: 'nowrap' }}>
        Click an orb to enter
      </p>

      {/* Glass panel */}
      {showPanel && panelGateway && (
        <GlassPanel gateway={panelGateway} onClose={handleClose} onEnter={handleEnter} />
      )}
    </div>
  )
}
