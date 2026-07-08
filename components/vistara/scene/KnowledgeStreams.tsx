'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Noise ──────────────────────────────────────────────────────────────────────
function hash(n: number) { return ((Math.sin(n) * 43758.5453) % 1 + 1) % 1 }
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz)
  const n000 = hash(ix     + iy * 57     + iz * 113)
  const n100 = hash(ix + 1 + iy * 57     + iz * 113)
  const n010 = hash(ix     + (iy+1)*57   + iz * 113)
  const n110 = hash(ix + 1 + (iy+1)*57   + iz * 113)
  const n001 = hash(ix     + iy * 57     + (iz+1)*113)
  const n101 = hash(ix + 1 + iy * 57     + (iz+1)*113)
  const n011 = hash(ix     + (iy+1)*57   + (iz+1)*113)
  const n111 = hash(ix + 1 + (iy+1)*57   + (iz+1)*113)
  const x00 = n000*(1-ux)+n100*ux, x10 = n010*(1-ux)+n110*ux
  const x01 = n001*(1-ux)+n101*ux, x11 = n011*(1-ux)+n111*ux
  const y0 = x00*(1-uy)+x10*uy, y1 = x01*(1-uy)+x11*uy
  return y0*(1-uz)+y1*uz
}
function curl(x: number, y: number, z: number, e = 0.04) {
  const dx = (noise3(x,y+e,z) - noise3(x,y-e,z) - noise3(x,y,z+e) + noise3(x,y,z-e)) / (2*e)
  const dy = (noise3(x,y,z+e) - noise3(x,y,z-e) - noise3(x+e,y,z) + noise3(x-e,y,z)) / (2*e)
  const dz = (noise3(x+e,y,z) - noise3(x-e,y,z) - noise3(x,y+e,z) + noise3(x,y-e,z)) / (2*e)
  return [dx, dy, dz]
}

// ── Flow path generator ────────────────────────────────────────────────────────
function makePaths(): THREE.CatmullRomCurve3[] {
  const paths: THREE.CatmullRomCurve3[] = []

  // Major sweeping arcs — match the reference image aesthetic
  const sweeps: number[][][] = [
    // Lower-left → sweep up → converge upper-center
    [[-7,-4,-6],[-4,-1,-4],[-1,1,-2],[1,2,0],[0,3,1]],
    // Right edge → cascade left → center
    [[7,-2,-5],[4,0,-3],[1,1,-1],[-1,2,0],[-2,3,1]],
    // Bottom → S-curve → upper right
    [[2,-5,-4],[1,-2,-2],[2,1,-1],[4,3,0],[5,4,1]],
    // Upper-left arc sweeping down
    [[-6,4,-5],[-3,2,-3],[-1,0,-1],[1,-1,0],[2,-2,1]],
    // Center-depth → foreground sweep
    [[-2,2,-8],[0,1,-5],[1,0,-2],[1,-1,0],[0,-2,1]],
    // Diagonal bottom-right → upper-left
    [[6,-4,-3],[3,-1,-2],[0,1,-1],[-3,3,0],[-5,4,1]],
    // Tight arc left side
    [[-5,0,-2],[-4,2,-1],[-3,3,0],[-2,2,1],[-1,1,2]],
    // Gentle sweep right side
    [[3,3,-4],[4,1,-2],[4,-1,0],[3,-3,1],[2,-4,2]],
  ]
  sweeps.forEach(pts => {
    paths.push(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))))
  })

  // Orbital/circular paths — like atom rings in reference image
  const orbitals: { cx: number; cy: number; cz: number; r: number; tiltX: number; tiltZ: number }[] = [
    { cx: -4, cy: 0.5, cz: -2,  r: 1.4, tiltX: 0.4,  tiltZ: 0.2 },
    { cx: -4, cy: -1,  cz: -1,  r: 0.9, tiltX: 1.2,  tiltZ: 0.6 },
    { cx: -3.5, cy: 1, cz: -3,  r: 0.6, tiltX: 0.8,  tiltZ: 1.0 },
    { cx: 1.5, cy: -2, cz: -1.5,r: 1.0, tiltX: 0.3,  tiltZ: 0.5 },
    { cx: 0, cy: 1.5,  cz: -5,  r: 1.8, tiltX: 0.1,  tiltZ: 0.9 },
  ]
  orbitals.forEach(o => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2
      pts.push(new THREE.Vector3(
        o.cx + Math.cos(a) * o.r,
        o.cy + Math.sin(a) * Math.cos(o.tiltX) * o.r,
        o.cz + Math.sin(a) * Math.sin(o.tiltX) * o.r * 0.6 + Math.cos(a) * Math.sin(o.tiltZ) * o.r * 0.3,
      ))
    }
    const c = new THREE.CatmullRomCurve3(pts)
    c.closed = true
    paths.push(c)
  })

  return paths
}

// ── Vertex / Fragment shaders for point sprites ────────────────────────────────
const VERT = `
uniform float time;
attribute float phase;
attribute float speed;
attribute float pathIdx;
attribute float isCrimson;
varying float vBrightness;
varying float vCrimson;

void main() {
  vBrightness = 0.4 + 0.6 * abs(sin(phase * 6.28318 + time * 0.8));
  vCrimson = isCrimson;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  float d = -mvPos.z;
  gl_PointSize = (3.5 - isCrimson * 0.5) * (6.0 / max(d, 0.5)) * vBrightness;
  gl_Position = projectionMatrix * mvPos;
}
`
const FRAG = `
varying float vBrightness;
varying float vCrimson;

void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float alpha = (1.0 - r * 2.0) * vBrightness;
  alpha = pow(alpha, 1.4);
  // blue-white knowledge stream vs crimson cognition vein
  vec3 col = mix(vec3(0.55, 0.75, 1.0), vec3(0.85, 0.08, 0.18), vCrimson);
  col = mix(col, vec3(1.0), vBrightness * 0.4);
  gl_FragColor = vec4(col, alpha * 0.85);
}
`

const TOTAL  = 8000
const CRIMSON_COUNT = 1400

export function KnowledgeStreams() {
  const meshRef = useRef<THREE.Points>(null)

  // Pre-sample paths into lookup tables for fast per-frame access
  const pathData = useMemo(() => {
    const paths = makePaths()
    const SAMPLES = 256
    // Sample each path into a flat float array
    const sampled: number[][] = paths.map(p => {
      const pts: number[] = []
      for (let i = 0; i <= SAMPLES; i++) {
        const v = p.getPoint(i / SAMPLES)
        pts.push(v.x, v.y, v.z)
      }
      return pts
    })
    return { paths, sampled, count: paths.length, SAMPLES }
  }, [])

  // Per-particle attributes (static)
  const attrs = useMemo(() => {
    const pos      = new Float32Array(TOTAL * 3)
    const phases   = new Float32Array(TOTAL)
    const speeds   = new Float32Array(TOTAL)
    const pathIdxs = new Float32Array(TOTAL)
    const crimson  = new Float32Array(TOTAL)

    const nPaths = pathData.count
    for (let i = 0; i < TOTAL; i++) {
      const isCrim  = i < CRIMSON_COUNT
      // Bias crimson particles toward fewer paths (first 4 sweeping arcs)
      const maxPath = isCrim ? Math.min(4, nPaths) : nPaths
      const pIdx    = Math.floor(Math.random() * maxPath)
      const ph      = Math.random()
      const pts     = pathData.sampled[pIdx]
      const si      = Math.min(Math.floor(ph * pathData.SAMPLES) * 3, pts.length - 3)
      pos[i*3]   = pts[si]   + (Math.random() - 0.5) * 0.12
      pos[i*3+1] = pts[si+1] + (Math.random() - 0.5) * 0.12
      pos[i*3+2] = pts[si+2] + (Math.random() - 0.5) * 0.08
      phases[i]   = ph
      speeds[i]   = (isCrim ? 0.0006 : 0.0004) + Math.random() * 0.0008
      pathIdxs[i] = pIdx
      crimson[i]  = isCrim ? 1 : 0
    }
    return { pos, phases, speeds, pathIdxs, crimson }
  }, [pathData])

  const posRef     = useRef(attrs.pos.slice())
  const phaseRef   = useRef(attrs.phases.slice())

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position',  new THREE.BufferAttribute(posRef.current, 3))
    g.setAttribute('phase',     new THREE.BufferAttribute(attrs.phases, 1))
    g.setAttribute('speed',     new THREE.BufferAttribute(attrs.speeds, 1))
    g.setAttribute('pathIdx',   new THREE.BufferAttribute(attrs.pathIdxs, 1))
    g.setAttribute('isCrimson', new THREE.BufferAttribute(attrs.crimson, 1))
    return g
  }, [attrs])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { time: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [])

  useFrame((_, delta) => {
    mat.uniforms.time.value += delta

    const pos    = posRef.current
    const phases = phaseRef.current
    const { speeds, pathIdxs, sampled, SAMPLES } = { ...attrs, ...pathData }

    for (let i = 0; i < TOTAL; i++) {
      phases[i] += speeds[i]
      if (phases[i] > 1) phases[i] -= 1

      const pIdx  = pathIdxs[i]
      const pts   = sampled[pIdx]
      const si    = Math.min(Math.floor(phases[i] * SAMPLES) * 3, pts.length - 3)

      // Curl noise turbulence
      const cx = pos[i*3], cy = pos[i*3+1], cz = pos[i*3+2]
      const [cu, cv, cw] = curl(cx * 0.5, cy * 0.5, cz * 0.5 + mat.uniforms.time.value * 0.03)

      pos[i*3]   = pts[si]   + cu * 0.06 + (Math.random() - 0.5) * 0.002
      pos[i*3+1] = pts[si+1] + cv * 0.06 + (Math.random() - 0.5) * 0.002
      pos[i*3+2] = pts[si+2] + cw * 0.04
    }

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    posAttr.array = pos
    posAttr.needsUpdate = true

    const phAttr = geo.getAttribute('phase') as THREE.BufferAttribute
    ;(phAttr.array as Float32Array).set(phases)
    phAttr.needsUpdate = true
  })

  return <points ref={meshRef} geometry={geo} material={mat} />
}
