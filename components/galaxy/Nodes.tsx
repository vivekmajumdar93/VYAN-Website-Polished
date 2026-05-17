'use client'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { NODES, useGalaxyStore, type GalaxyNode } from '@/lib/store'

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

type OrbBuffers = {
  nodePos: Float32Array
  nodeCols: Float32Array
  nodeBase: { x: number; y: number; z: number; phase: number }[]
  linePts: Float32Array
  coreDustPos: Float32Array
  coreDustCol: Float32Array
  hazePos: Float32Array
  dustPos: Float32Array
  dustCol: Float32Array
  satellites: {
    pos: [number, number, number]
    speed: number
    seed: number
    pts: Float32Array
    lines: Float32Array
  }[]
}

const NODE_COUNT = 220
const CORE_COUNT = 1400
const HAZE_COUNT = 900
const DUST_COUNT = 900
const SAT_COUNT = 10

function buildOrbBuffers(colorA: string, colorB: string): OrbBuffers {
  const cA = new THREE.Color(colorA)
  const cB = new THREE.Color(colorB)
  const violet = new THREE.Color('#5200ff')

  // ---- 1. Network nodes (sphere distribution) ----
  const nodePos = new Float32Array(NODE_COUNT * 3)
  const nodeCols = new Float32Array(NODE_COUNT * 3)
  const nodeBase: { x: number; y: number; z: number; phase: number }[] = []
  const nodeVecs: THREE.Vector3[] = []

  for (let i = 0; i < NODE_COUNT; i++) {
    const r = Math.pow(Math.random(), 0.68) * 1.55
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.sin(phi) * Math.sin(theta)
    const z = r * Math.cos(phi)
    nodePos[i * 3] = x; nodePos[i * 3 + 1] = y; nodePos[i * 3 + 2] = z
    nodeBase.push({ x, y, z, phase: Math.random() * 10 })
    nodeVecs.push(new THREE.Vector3(x, y, z))
    const c = cA.clone().lerp(cB, Math.random())
    nodeCols[i * 3] = c.r; nodeCols[i * 3 + 1] = c.g; nodeCols[i * 3 + 2] = c.b
  }

  // ---- 2. Connection web ----
  const lineList: number[] = []
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      const d = nodeVecs[i].distanceTo(nodeVecs[j])
      if (d < 0.55 && Math.random() < 0.16) {
        lineList.push(nodeVecs[i].x, nodeVecs[i].y, nodeVecs[i].z, nodeVecs[j].x, nodeVecs[j].y, nodeVecs[j].z)
      }
    }
  }
  const linePts = new Float32Array(lineList)

  // ---- 3. Quantum stardust core ----
  const coreDustPos = new Float32Array(CORE_COUNT * 3)
  const coreDustCol = new Float32Array(CORE_COUNT * 3)
  for (let i = 0; i < CORE_COUNT; i++) {
    const r = Math.pow(Math.random(), 2.5) * 0.42
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    coreDustPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    coreDustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    coreDustPos[i * 3 + 2] = r * Math.cos(phi)
    const mix = Math.random()
    let c: THREE.Color
    if (mix < 0.33) c = cA.clone().lerp(violet, Math.random())
    else if (mix < 0.66) c = cB.clone().lerp(violet, Math.random())
    else c = cA.clone().lerp(cB, Math.random())
    coreDustCol[i * 3] = c.r; coreDustCol[i * 3 + 1] = c.g; coreDustCol[i * 3 + 2] = c.b
  }

  // ---- 4. Inner haze ----
  const hazePos = new Float32Array(HAZE_COUNT * 3)
  for (let i = 0; i < HAZE_COUNT; i++) {
    const r = Math.pow(Math.random(), 1.9) * 0.62
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    hazePos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    hazePos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    hazePos[i * 3 + 2] = r * Math.cos(phi)
  }

  // ---- 5. Outer stardust cloud ----
  const dustPos = new Float32Array(DUST_COUNT * 3)
  const dustCol = new Float32Array(DUST_COUNT * 3)
  for (let i = 0; i < DUST_COUNT; i++) {
    const r = rand(1.4, 3.6)
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    dustPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    dustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    dustPos[i * 3 + 2] = r * Math.cos(phi)
    const c = Math.random() < 0.4 ? cA : Math.random() < 0.5 ? cB : violet
    dustCol[i * 3] = c.r; dustCol[i * 3 + 1] = c.g; dustCol[i * 3 + 2] = c.b
  }

  // ---- 6. Floating satellite clusters ----
  const satellites: OrbBuffers['satellites'] = []
  for (let s = 0; s < SAT_COUNT; s++) {
    const pts: number[] = []
    const ptsVec: THREE.Vector3[] = []
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(rand(-0.18, 0.18), rand(-0.18, 0.18), rand(-0.18, 0.18))
      pts.push(p.x, p.y, p.z)
      ptsVec.push(p)
    }
    const lines: number[] = []
    for (let a = 0; a < ptsVec.length; a++) {
      for (let b = a + 1; b < ptsVec.length; b++) {
        if (ptsVec[a].distanceTo(ptsVec[b]) < 0.25) {
          lines.push(ptsVec[a].x, ptsVec[a].y, ptsVec[a].z, ptsVec[b].x, ptsVec[b].y, ptsVec[b].z)
        }
      }
    }
    satellites.push({
      pos: [rand(-1.6, 1.6), rand(-1.2, 1.2), rand(-1.0, 1.0)],
      speed: rand(0.1, 0.4),
      seed: Math.random() * 100,
      pts: new Float32Array(pts),
      lines: new Float32Array(lines),
    })
  }

  return { nodePos, nodeCols, nodeBase, linePts, coreDustPos, coreDustCol, hazePos, dustPos, dustCol, satellites }
}

function NanoOrb({ node }: { node: GalaxyNode }) {
  const groupRef = useRef<THREE.Group>(null!)
  const nodePtsRef = useRef<THREE.Points>(null!)
  const nodeMatRef = useRef<THREE.PointsMaterial>(null!)
  const webMatRef = useRef<THREE.LineBasicMaterial>(null!)
  const coreDustRef = useRef<THREE.Points>(null!)
  const coreDustMatRef = useRef<THREE.PointsMaterial>(null!)
  const hazeRef = useRef<THREE.Points>(null!)
  const dustRef = useRef<THREE.Points>(null!)
  const satellitesRef = useRef<THREE.Group>(null!)

  const [hover, setHover] = useState(false)
  const isSelected = useGalaxyStore((s) => s.selectedNode?.id === node.id)
  const setSelected = useGalaxyStore((s) => s.setSelected)
  const setHovered = useGalaxyStore((s) => s.setHovered)
  const seed = useMemo(() => Math.random() * 1000, [])
  const scaleRef = useRef(0.13)

  // colorA = node accent, colorB = violet companion
  const colorA = node.color
  const colorB = '#a066ff'

  const bufs = useMemo(() => buildOrbBuffers(colorA, colorB), [colorA, colorB])

  useFrame(({ clock }, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    const t = clock.elapsedTime
    if (!groupRef.current) return

    // Scale: small dot in galaxy view, blooms into full neural sphere when selected
    const target = isSelected ? 1.0 : hover ? 0.22 : 0.16
    scaleRef.current += (target - scaleRef.current) * Math.min(delta * 4, 0.25)
    groupRef.current.scale.setScalar(scaleRef.current)

    // Whole-orb tumble
    groupRef.current.rotation.y += delta * 0.18
    groupRef.current.rotation.x = Math.sin(t * 0.18 + seed) * 0.18
    groupRef.current.rotation.z = Math.cos(t * 0.11 + seed) * 0.08

    // Node turbulence (only when selected -> saves perf when 5 other orbs are tiny)
    if (isSelected && nodePtsRef.current) {
      const posAttr = nodePtsRef.current.geometry.attributes.position as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array
      for (let i = 0; i < NODE_COUNT; i++) {
        const base = bufs.nodeBase[i]
        arr[i * 3]     = base.x + Math.sin(t * 1.4 + base.phase) * 0.04
        arr[i * 3 + 1] = base.y + Math.cos(t * 1.8 + base.phase) * 0.04
        arr[i * 3 + 2] = base.z + Math.sin(t * 1.2 + base.phase) * 0.05
      }
      posAttr.needsUpdate = true
    }

    // Network shimmer
    if (webMatRef.current) webMatRef.current.opacity = 0.3 + Math.sin(t * 2.4 + seed) * 0.1
    if (nodeMatRef.current) nodeMatRef.current.opacity = 0.82 + Math.sin(t * 1.7 + seed) * 0.08

    // Core turbulence
    if (coreDustRef.current) {
      coreDustRef.current.rotation.y += delta * 0.55
      coreDustRef.current.rotation.x -= delta * 0.22
    }
    if (coreDustMatRef.current) coreDustMatRef.current.opacity = 0.82 + Math.sin(t * 2.5) * 0.08
    if (hazeRef.current) {
      hazeRef.current.rotation.y -= delta * 0.1
      hazeRef.current.rotation.z += delta * 0.07
    }
    if (dustRef.current) {
      dustRef.current.rotation.y += delta * 0.06
      dustRef.current.rotation.x += delta * 0.02
    }

    // Satellites
    if (satellitesRef.current) {
      satellitesRef.current.children.forEach((c, i) => {
        c.rotation.x += delta * (0.4 + i * 0.04)
        c.rotation.y += delta * (0.55 + i * 0.04)
        c.position.y += Math.sin(t + i) * 0.0008
      })
    }
  })

  return (
    <group ref={groupRef} position={node.position}>
      {/* Hit mesh for interaction (invisible sphere) */}
      <mesh
        onClick={(e) => { e.stopPropagation(); setSelected(node) }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); setHovered(node.id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); setHovered(null); document.body.style.cursor = 'default' }}
      >
        <sphereGeometry args={[3.0, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 1. Network nodes (200+) */}
      <points ref={nodePtsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bufs.nodePos, 3]} count={NODE_COUNT} />
          <bufferAttribute attach="attributes-color"    args={[bufs.nodeCols, 3]} count={NODE_COUNT} />
        </bufferGeometry>
        <pointsMaterial
          ref={nodeMatRef}
          size={0.055}
          vertexColors
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* 2. Connection web */}
      {bufs.linePts.length > 0 && (
        // @ts-ignore - lineSegments JSX element
        <lineSegments frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[bufs.linePts, 3]} count={bufs.linePts.length / 3} />
          </bufferGeometry>
          <lineBasicMaterial
            ref={webMatRef}
            color={colorB}
            transparent
            opacity={0.42}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {/* 3. Quantum stardust core */}
      <points ref={coreDustRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bufs.coreDustPos, 3]} count={CORE_COUNT} />
          <bufferAttribute attach="attributes-color"    args={[bufs.coreDustCol, 3]} count={CORE_COUNT} />
        </bufferGeometry>
        <pointsMaterial
          ref={coreDustMatRef}
          size={0.03}
          vertexColors
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* 4. Inner haze */}
      <points ref={hazeRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bufs.hazePos, 3]} count={HAZE_COUNT} />
        </bufferGeometry>
        <pointsMaterial
          color={colorB}
          size={0.018}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* 5. Floating satellites */}
      <group ref={satellitesRef}>
        {bufs.satellites.map((s, i) => (
          <group key={i} position={s.pos}>
            <points frustumCulled={false}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[s.pts, 3]} count={s.pts.length / 3} />
              </bufferGeometry>
              <pointsMaterial
                color={colorB}
                size={0.045}
                transparent
                opacity={0.9}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                sizeAttenuation
              />
            </points>
            {s.lines.length > 0 && (
              // @ts-ignore - lineSegments JSX element
              <lineSegments frustumCulled={false}>
                <bufferGeometry>
                  <bufferAttribute attach="attributes-position" args={[s.lines, 3]} count={s.lines.length / 3} />
                </bufferGeometry>
                <lineBasicMaterial color={colorA} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
              </lineSegments>
            )}
          </group>
        ))}
      </group>

      {/* 6. Outer stardust cloud */}
      <points ref={dustRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bufs.dustPos, 3]} count={DUST_COUNT} />
          <bufferAttribute attach="attributes-color"    args={[bufs.dustCol, 3]} count={DUST_COUNT} />
        </bufferGeometry>
        <pointsMaterial
          size={0.022}
          vertexColors
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

export default function Nodes() {
  return (
    <group>
      {NODES.map((n) => (
        <NanoOrb key={n.id} node={n} />
      ))}
    </group>
  )
}
