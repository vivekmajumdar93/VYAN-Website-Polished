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

// ── Nebula background shaders (clip-space quad — unaffected by camera) ─────────

const BG_VERT = /* glsl */`
void main() { gl_Position = vec4(position.xy, 0.9999, 1.0); }
`

const BG_FRAG = /* glsl */`
precision highp float;
uniform vec2  u_res;
uniform float u_t;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 114.51);
  return fract(p.x * p.y);
}
float n2d(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
  float v=0., a=.5;
  for(int i=0;i<7;i++){ v+=a*n2d(p); p=p*2.1+vec2(3.7,1.3); a*=.46; }
  return v;
}
float star(vec2 uv, float scale, float thresh, float sz) {
  vec2 g = floor(uv*scale);
  vec2 l = fract(uv*scale)-.5;
  float h = hash(g);
  float vis = step(thresh, h);
  float tw = .6+.4*sin(u_t*(1.2+2.1*hash(g+.5))+h*6.28);
  return (1.-smoothstep(0.,sz,length(l))) * vis * tw;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 st = (uv-.5); st.x *= u_res.x / u_res.y;
  float T = u_t * .014;
  float rad = length(st);
  float ang = atan(st.y, st.x) + rad*.5 + T*.25;
  vec2 wp = uv + vec2(cos(ang), sin(ang)) * rad * .06;
  vec2 q = vec2(fbm(wp+T*.13), fbm(wp+vec2(5.2,1.3)+T*.11));
  vec2 r = vec2(fbm(wp+3.1*q+vec2(1.7,9.2)+T*.08), fbm(wp+3.1*q+vec2(8.3,2.8)+T*.06));
  float cl = fbm(wp + 3.*r + T*.04);
  vec3 c = vec3(.006,.002,.015);
  c = mix(c, vec3(.11,.03,.27),  smoothstep(.20,.62,cl)  * .95);
  c = mix(c, vec3(.03,.05,.22),  smoothstep(.32,.72,q.x) * .75);
  c = mix(c, vec3(.26,.05,.17),  smoothstep(.42,.82,r.y) * .50);
  c = mix(c, vec3(.03,.11,.30),  smoothstep(.12,.52,q.y) * .60);
  c = mix(c, vec3(.20,.08,.32),  smoothstep(.50,.90,r.x) * .35);
  float vign = 1. - smoothstep(.55, 1.45, rad);
  c *= vign;
  c += vec3(.07,.02,.17) * (1.-smoothstep(0.,.65,rad));
  c += vec3(.03,.01,.08) * (1.-smoothstep(0.,.25,rad));
  vec3 sw = vec3(.92,.88,1.);
  c += sw      * star(uv+T*.025,  90., .90, .020);
  c += sw*.75  * star(uv+T*.018, 150., .92, .013);
  c += sw*1.35 * star(uv*.75+T*.012, 55., .87, .032);
  c = c / (c + .45);
  gl_FragColor = vec4(c, 1.);
}
`

// ── Orb shaders ────────────────────────────────────────────────────────────────

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

  vec4 img = texture2D(uTex, (vUv - 0.5) * 0.92 + 0.5);

  // Soft vignette — image stays visible near centre
  float vign = 1.0 - smoothstep(0.20, 0.50, r);
  vec3  lit  = img.rgb * (0.68 + 0.32 * vign);

  // Narrow glow ring near the edge — subtle base, brightens on hover
  float inner = smoothstep(0.48, 0.44, r);
  float outer = smoothstep(0.44, 0.38, r);
  float ring  = inner - outer;
  float pulse = 0.65 + 0.35 * sin(uTime * 1.3 + uHover * 1.57);
  float str   = ring * (0.35 + uHover * 0.90) * pulse;

  vec3 col = lit + uColor * str;

  // Faint outer corona — only visible near/on hover
  float corona = smoothstep(0.50, 0.48, r) * (1.0 - inner) * 0.16 * (0.5 + uHover * 0.5);
  col += uColor * corona;

  float alpha = smoothstep(0.50, 0.46, r);
  gl_FragColor = vec4(col, alpha);
}`

// ── Nebula background inside the R3F canvas ────────────────────────────────────

function NebulaBG() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    u_res: { value: new THREE.Vector2(1, 1) },
    u_t:   { value: 0 },
  }), [])

  useFrame(({ gl, clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.u_t.value = clock.elapsedTime
    gl.getDrawingBufferSize(matRef.current.uniforms.u_res.value)
  })

  return (
    <mesh renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={BG_VERT}
        fragmentShader={BG_FRAG}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

// ── Gentle camera figure-8 drift ───────────────────────────────────────────────

function CameraOrbit() {
  const { camera } = useThree()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    camera.position.x += (Math.sin(t * 0.08) * 1.2 - camera.position.x) * 0.018
    camera.position.y += (Math.cos(t * 0.055) * 0.7 - camera.position.y) * 0.018
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
    c.addPass(new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.28,  // strength  — gentle ring glow only
      0.50,  // radius
      0.42,  // threshold — only the bright ring bands bloom
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

// ── Gossamer connection web ────────────────────────────────────────────────────

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

// ── Full constellation — viewport-adaptive positions ───────────────────────────
// Uses useThree viewport (world-units) so orbs spread across the screen on any
// aspect ratio — portrait mobile and landscape desktop both fill correctly.

function Constellation({ onHover, onClick }: {
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  const { viewport } = useThree()

  const positions = useMemo(() =>
    GATEWAYS.map(gw => new THREE.Vector3(
      (gw.x / 100 - 0.5) * viewport.width  * 0.86,
      (0.5 - gw.y / 100) * viewport.height * 0.80,
      -gw.depth * 2,
    )),
    [viewport.width, viewport.height]
  )

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

      {/* ── Nebula + orbs — single WebGL context, no alpha compositing needed ── */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true }}
        dpr={[1, 1.5]}
      >
        <NebulaBG />
        <Suspense fallback={null}>
          <Constellation onHover={setHoveredId} onClick={handleOrbClick} />
        </Suspense>
        <CameraOrbit />
        <Bloom />
      </Canvas>

      {/* ── Hover tooltip ── */}
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

      {/* ── Wordmark ── */}
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

      {/* ── Back button ── */}
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

      {/* ── Interaction hint ── */}
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

// ── Gateway frosted glass panel ────────────────────────────────────────────────

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
