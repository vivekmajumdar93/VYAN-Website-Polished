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
import { VistaraScene } from './scene/VistaraScene'

// ── Shaders ────────────────────────────────────────────────────────────────────

const orbVert = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const orbFrag = /* glsl */`
precision highp float;
uniform sampler2D uTex;
uniform vec3  uColor;
uniform float uHover;
uniform float uTime;
varying vec2 vUv;

void main() {
  vec2  c = vUv - 0.5;
  float r = length(c);

  // Sample image — slightly zoom to avoid edge sampling artefacts
  vec4 img = texture2D(uTex, (vUv - 0.5) * 0.92 + 0.5);

  // Soft dark vignette toward the perimeter
  float vign  = 1.0 - smoothstep(0.30, 0.50, r);
  vec3  lit   = img.rgb * (0.55 + 0.45 * vign);

  // Glow ring — narrow band near the edge
  float inner = smoothstep(0.48, 0.44, r);
  float outer = smoothstep(0.44, 0.38, r);
  float ring  = inner - outer;
  float pulse = 0.60 + 0.40 * sin(uTime * 1.3 + uHover * 1.57);
  float str   = ring * (0.85 + uHover * 2.2) * pulse;

  vec3  col   = lit + uColor * str;

  // Second faint outer corona
  float corona = smoothstep(0.50, 0.48, r) * (1.0 - inner) * 0.4 * (0.6 + uHover * 0.4);
  col += uColor * corona;

  // Fade to black at the very edge so bloom spills into void cleanly
  float alpha = smoothstep(0.50, 0.46, r);
  gl_FragColor = vec4(col, alpha);
}`

// ── Camera drift ───────────────────────────────────────────────────────────────

function CameraOrbit() {
  const { camera } = useThree()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const tx = Math.sin(t * 0.08) * 1.4
    const ty = Math.cos(t * 0.055) * 0.8
    camera.position.x += (tx - camera.position.x) * 0.018
    camera.position.y += (ty - camera.position.y) * 0.018
    camera.lookAt(0, 0, 0)
  })
  return null
}

// ── Bloom post-processing ──────────────────────────────────────────────────────

function Bloom() {
  const { gl, scene, camera, size } = useThree()

  const composer = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      1.1,   // strength
      0.55,  // radius
      0.08,  // threshold — low, so rings and coronas bloom
    )
    c.addPass(bloom)
    c.addPass(new OutputPass())
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])

  useEffect(() => { composer.setSize(size.width, size.height) }, [composer, size])
  useEffect(() => () => composer.dispose(), [composer])
  useFrame(() => composer.render(), 1)
  return null
}

// ── Connection web ─────────────────────────────────────────────────────────────
// Gossamer threads connecting each node to its two nearest neighbours.

function OrbWeb({ positions }: { positions: THREE.Vector3[] }) {
  const verts = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i < positions.length; i++) {
      positions
        .map((p, j) => ({ j, d: i === j ? Infinity : positions[i].distanceTo(p) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .forEach(({ j }) => {
          if (j > i) pts.push(...positions[i].toArray(), ...positions[j].toArray())
        })
    }
    return new Float32Array(pts)
  }, [positions])

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[verts, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#b090ff" transparent opacity={0.07} depthWrite={false} />
    </lineSegments>
  )
}

// ── Single product orb ─────────────────────────────────────────────────────────

function ProductOrb({ gw, pos, size: orbSize, onHover, onClick }: {
  gw: Gateway
  pos: THREE.Vector3
  size: number
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  const tex      = useTexture(assetPath(gw.filename))
  const meshRef  = useRef<THREE.Mesh>(null)
  const matRef   = useRef<THREE.ShaderMaterial>(null)
  const hoverRef = useRef(0)

  const uniforms = useMemo(() => ({
    uTex:   { value: tex },
    uColor: { value: new THREE.Color(gw.color) },
    uHover: { value: 0 },
    uTime:  { value: 0 },
  }), [tex, gw.color])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (matRef.current) {
      matRef.current.uniforms.uTime.value  = t
      matRef.current.uniforms.uHover.value +=
        (hoverRef.current - matRef.current.uniforms.uHover.value) * 0.09
    }
    if (meshRef.current) {
      const breathe = 1 + Math.sin(t * 0.75 + gw.orbitPhase) * 0.022
      const ox = Math.cos(t * gw.orbitSpeed * 900 + gw.orbitPhase) * gw.orbitRadius * 0.055
      const oy = Math.sin(t * gw.orbitSpeed * 900 + gw.orbitPhase) * gw.orbitRadius * 0.032
      meshRef.current.position.set(pos.x + ox, pos.y + oy, pos.z)
      meshRef.current.scale.setScalar(orbSize * breathe)
    }
  })

  return (
    <mesh
      ref={meshRef}
      renderOrder={1}
      onPointerOver={e => { e.stopPropagation(); hoverRef.current = 1; onHover(gw.id) }}
      onPointerOut={() => { hoverRef.current = 0; onHover(null) }}
      onClick={e => { e.stopPropagation(); onClick(gw.id) }}
    >
      <circleGeometry args={[0.5, 72]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={orbVert}
        fragmentShader={orbFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
      <Html
        center
        distanceFactor={10}
        occlude={false}
        style={{
          pointerEvents: 'none',
          textAlign: 'center',
          transform: 'translateY(62px)',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{
          fontFamily: 'var(--font-vyan)',
          fontSize: '10px',
          letterSpacing: '0.30em',
          color: gw.color,
          textTransform: 'uppercase',
          textShadow: `0 0 14px ${gw.color}90`,
        }}>
          {gw.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-vyan)',
          fontSize: '7px',
          letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.28)',
          textTransform: 'uppercase',
          marginTop: '3px',
        }}>
          {gw.tantra}
        </div>
      </Html>
    </mesh>
  )
}

// ── Full constellation ─────────────────────────────────────────────────────────

function Constellation({ onHover, onClick }: {
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  const positions = useMemo(() =>
    GATEWAYS.map(gw => new THREE.Vector3(
      (gw.x / 100 - 0.5) * 14,
      (0.5 - gw.y / 100) * 9,
      -gw.depth * 3,
    )),
  [])

  return (
    <>
      <OrbWeb positions={positions} />
      {GATEWAYS.map((gw, i) => (
        <ProductOrb
          key={gw.id}
          gw={gw}
          pos={positions[i]}
          size={gw.scale * 21}
          onHover={onHover}
          onClick={onClick}
        />
      ))}
    </>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void
  onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)
  const [activeId,     setActiveId]     = useState<string | null>(null)
  const [showPanel,    setShowPanel]    = useState(false)
  const [panelGateway, setPanelGateway] = useState<Gateway | null>(null)

  const hoveredGateway = hoveredId ? GATEWAYS.find(g => g.id === hoveredId) ?? null : null

  const handleOrbClick = useCallback((id: string) => {
    const gw = GATEWAYS.find(g => g.id === id)
    if (!gw) return
    setActiveId(id)
    setPanelGateway(gw)
    setShowPanel(true)
  }, [])

  const handlePanelClose = useCallback(() => {
    setShowPanel(false)
    setActiveId(null)
    setPanelGateway(null)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 2 }}>

      {/* ── Procedural void nebula (portal → body, zIndex 1) ── */}
      <VistaraScene
        onOrbHover={setHoveredId}
        onOrbClick={handleOrbClick}
        hoveredId={hoveredId}
        activeId={activeId}
      />

      {/* ── Three.js constellation (transparent over nebula) ── */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0, zIndex: 3 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <Constellation onHover={setHoveredId} onClick={handleOrbClick} />
        </Suspense>
        <CameraOrbit />
        <Bloom />
      </Canvas>

      {/* ── UI: hover tooltip ── */}
      <AnimatePresence>
        {hoveredGateway && !showPanel && (
          <motion.div
            key={hoveredGateway.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed', bottom: '14%', left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center', pointerEvents: 'none', zIndex: 40,
            }}
          >
            <div style={{
              fontFamily: 'var(--font-vyan)', fontSize: '13px',
              letterSpacing: '0.32em', color: hoveredGateway.color,
              textTransform: 'uppercase',
              textShadow: `0 0 24px ${hoveredGateway.color}`,
              marginBottom: '5px',
            }}>
              {hoveredGateway.name}
            </div>
            <div style={{
              fontFamily: 'var(--font-vyan)', fontSize: '9px',
              letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
            }}>
              {hoveredGateway.tagline}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── UI: wordmark ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
        style={{
          position: 'fixed', top: '22px', right: '24px',
          zIndex: 40, pointerEvents: 'none', textAlign: 'right',
        }}
      >
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '11px', letterSpacing: '0.4em', color: 'rgba(212,180,80,0.55)', textTransform: 'uppercase' }}>
          Vistāra
        </div>
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '8px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', marginTop: '3px' }}>
          The Manifestations
        </div>
      </motion.div>

      {/* ── UI: back ── */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          onClick={onBack}
          style={{
            position: 'fixed', top: '22px', left: '22px', zIndex: 40,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, color: '#9B59FF',
          }}
        >
          <BackIcon size={28} />
          <span style={{ fontFamily: 'var(--font-vyan)', fontSize: 11, letterSpacing: '0.2em', opacity: 0.7 }}>
            ŚŪNYA MAṆḌALA
          </span>
        </motion.button>
      )}

      {/* ── UI: interaction hint ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}
        style={{
          position: 'fixed', bottom: '5%', left: '50%',
          transform: 'translateX(-50%)', zIndex: 40, pointerEvents: 'none',
        }}
      >
        <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '9px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.13)', textTransform: 'uppercase' }}>
          Hover to discover · Click to enter
        </p>
      </motion.div>

      {/* ── Gateway detail panel ── */}
      <AnimatePresence>
        {showPanel && panelGateway && (
          <GatewayPanel
            gateway={panelGateway}
            onClose={handlePanelClose}
            onEnter={() => { handlePanelClose(); onGatewayEnter?.(panelGateway) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Gateway glass panel ────────────────────────────────────────────────────────

function GatewayPanel({ gateway, onClose, onEnter }: {
  gateway: Gateway
  onClose: () => void
  onEnter: () => void
}) {
  const [closeHov, setCloseHov] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 20 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: '460px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${gateway.color}25`,
          borderRadius: '20px', backdropFilter: 'blur(24px)', padding: '34px',
          boxShadow: `0 0 60px ${gateway.color}12`,
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: '1px', background: `linear-gradient(90deg, transparent, ${gateway.color}55, transparent)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '0.28em', color: `${gateway.color}80`, fontFamily: 'var(--font-vyan)', textTransform: 'uppercase', marginBottom: '7px' }}>
              {gateway.tantra}
            </div>
            <h2 style={{ fontFamily: 'var(--font-vyan)', fontSize: '24px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', marginBottom: '6px', textShadow: `0 0 30px ${gateway.color}35` }}>
              {gateway.name}
            </h2>
            <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '10px', letterSpacing: '0.15em', color: `${gateway.color}70`, textTransform: 'uppercase' }}>
              {gateway.tagline}
            </p>
          </div>
          <button
            onMouseEnter={() => setCloseHov(true)}
            onMouseLeave={() => setCloseHov(false)}
            onClick={onClose}
            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', zIndex: 10 }}
          >
            <CloseIcon size={24} isHovered={closeHov} />
          </button>
        </div>
        <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '14px', lineHeight: '1.75', color: 'rgba(255,255,255,0.58)', letterSpacing: '0.02em', marginBottom: '30px' }}>
          {gateway.description}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.45)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer' }}>
            Return
          </button>
          <button onClick={onEnter} style={{ padding: '12px 26px', background: `${gateway.color}15`, border: `1px solid ${gateway.color}38`, borderRadius: '10px', color: gateway.color, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer', boxShadow: `0 0 20px ${gateway.color}12` }}>
            Enter
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
