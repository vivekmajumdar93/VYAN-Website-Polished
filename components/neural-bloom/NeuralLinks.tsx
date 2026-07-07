'use client'

/**
 * NeuralLinks — up to 8000 concurrent synaptic link instances.
 * Each link: electric blue tube with a traveling white-violet pulse wave.
 * Links spawn/die within phase 3 (neural bloom), fade in 40ms, out 60ms.
 */

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NEURAL_LINKS } from '@/constants/neuralBloom'

const LINK_VERT = /* glsl */`
attribute vec3 aStart;
attribute vec3 aEnd;
attribute float aAge;
attribute float aLifetime;
attribute float aPhaseOffset;
varying float vUx;
varying float vAge;
varying float vPulsePhase;
varying float vAlpha;
void main(){
  vUx=position.x;
  vAge=aAge;
  vPulsePhase=aPhaseOffset;
  vec3 lp=mix(aStart,aEnd,vUx);
  vec3 ld=normalize(aEnd-aStart);
  vec3 up=abs(ld.y)<0.9?vec3(0.,1.,0.):vec3(1.,0.,0.);
  vec3 right=normalize(cross(ld,up));
  vec3 pu=cross(right,ld);
  float taper=sin(vUx*3.14159);
  float thick=mix(0.003,0.014,taper);
  float angle=position.y*6.2832;
  vec3 offset=(cos(angle)*right+sin(angle)*pu)*thick;
  float lt=max(aLifetime,0.001);
  float fi=clamp(aAge/0.04,0.,1.);
  float fo=clamp((lt-aAge)/0.06,0.,1.);
  vAlpha=min(fi,fo);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(lp+offset,1.);
}
`

const LINK_FRAG = /* glsl */`
uniform float uTime;
varying float vUx;
varying float vAge;
varying float vPulsePhase;
varying float vAlpha;
void main(){
  vec3 lc=vec3(0.176,0.435,1.0);
  float pp=mod(uTime*0.8+vPulsePhase,1.0);
  float pb=exp(-pow(vUx-pp,2.)*80.);
  float ns=exp(-vUx*vUx*180.)+exp(-(1.-vUx)*(1.-vUx)*180.);
  vec3 pulse=vec3(0.86,0.78,1.0);
  vec3 col=lc+pulse*pb*2.8+lc*ns*0.65;
  col*=1.6;
  float alpha=vAlpha*0.4;
  alpha=mix(alpha,alpha+pb*0.55,pb);
  if(alpha<0.01)discard;
  gl_FragColor=vec4(col,alpha);
}
`

// Tube geometry for one link: segments along X (0→1), ring around Y
function buildTubeGeo(segments = 12, rings = 5): THREE.BufferGeometry {
  const geo  = new THREE.BufferGeometry()
  const verts: number[] = []
  const indices: number[] = []

  for (let si = 0; si <= segments; si++) {
    const u = si / segments
    for (let ri = 0; ri <= rings; ri++) {
      const angle = (ri / rings) * Math.PI * 2
      verts.push(u, angle, 0)
    }
  }
  for (let si = 0; si < segments; si++) {
    for (let ri = 0; ri < rings; ri++) {
      const a = si * (rings + 1) + ri
      const b = a + rings + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  geo.setIndex(indices)
  return geo
}

const MAX_LINKS = NEURAL_LINKS.maxConcurrent

interface NeuralLinksProps {
  phase: number
  elapsed: number
  linkCount: number
  orbPosition: THREE.Vector3
}

interface LinkState {
  startX: number; startY: number; startZ: number
  endX: number;   endY: number;   endZ: number
  age: number
  lifetime: number
  phaseOffset: number
  active: boolean
}

export function NeuralLinks({ phase, elapsed, linkCount, orbPosition }: NeuralLinksProps) {
  const meshRef  = useRef<THREE.Mesh>(null)
  const matRef   = useRef<THREE.ShaderMaterial>(null)
  const stateRef = useRef<LinkState[]>([])
  const timeRef  = useRef(0)

  // Pre-allocate link state pool
  useEffect(() => {
    stateRef.current = Array.from({ length: MAX_LINKS }, () => ({
      startX: 0, startY: 0, startZ: 0,
      endX: 0,   endY: 0,   endZ: 0,
      age: 0, lifetime: 0, phaseOffset: 0, active: false,
    }))
  }, [])

  const tubeGeo = useMemo(() => buildTubeGeo(10, 4), [])

  // Instanced mesh
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), [])

  // Instance attribute buffers (updated each frame)
  const instanceStartAttr = useRef<THREE.InstancedBufferAttribute | null>(null)
  const instanceEndAttr   = useRef<THREE.InstancedBufferAttribute | null>(null)
  const ageAttr           = useRef<THREE.InstancedBufferAttribute | null>(null)
  const lifetimeAttr      = useRef<THREE.InstancedBufferAttribute | null>(null)
  const phaseOffAttr      = useRef<THREE.InstancedBufferAttribute | null>(null)

  const instancedGeo = useMemo(() => {
    const geo   = tubeGeo.clone()
    const starts = new Float32Array(MAX_LINKS * 3)
    const ends   = new Float32Array(MAX_LINKS * 3)
    const ages   = new Float32Array(MAX_LINKS)
    const lifes  = new Float32Array(MAX_LINKS)
    const phases = new Float32Array(MAX_LINKS)

    const sa = new THREE.InstancedBufferAttribute(starts, 3)
    const ea = new THREE.InstancedBufferAttribute(ends,   3)
    const aa = new THREE.InstancedBufferAttribute(ages,   1)
    const la = new THREE.InstancedBufferAttribute(lifes,  1)
    const pa = new THREE.InstancedBufferAttribute(phases, 1)

    geo.setAttribute('aStart',       sa)
    geo.setAttribute('aEnd',         ea)
    geo.setAttribute('aAge',         aa)
    geo.setAttribute('aLifetime',    la)
    geo.setAttribute('aPhaseOffset', pa)

    instanceStartAttr.current = sa
    instanceEndAttr.current   = ea
    ageAttr.current           = aa
    lifetimeAttr.current      = la
    phaseOffAttr.current      = pa

    return geo
  }, [tubeGeo])

  useFrame((_, delta) => {
    if (!matRef.current) return
    timeRef.current += delta
    matRef.current.uniforms.uTime.value = timeRef.current

    const links  = stateRef.current
    const inBloom = phase === 3 || phase === 4

    if (!inBloom) {
      // Kill all links outside phase 3-4
      links.forEach(l => { l.active = false; l.age = l.lifetime + 1 })
    }

    // Age active links, respawn if dead
    let activeCount = 0
    for (let i = 0; i < MAX_LINKS; i++) {
      const l = links[i]
      if (l.active) {
        l.age += delta
        if (l.age > l.lifetime) l.active = false
        else activeCount++
      }
    }

    // Spawn new links up to linkCount if in phase 3
    if (phase === 3 && activeCount < Math.min(linkCount, MAX_LINKS)) {
      const spawn = Math.min(linkCount - activeCount, 20) // max 20 new per frame
      let spawned = 0
      for (let i = 0; i < MAX_LINKS && spawned < spawn; i++) {
        const l = links[i]
        if (!l.active) {
          // Random start/end near orb with some scatter
          const r1 = 0.8 + Math.random() * 2.5
          const t1 = Math.random() * Math.PI * 2
          const p1 = Math.acos(2 * Math.random() - 1)
          l.startX = orbPosition.x + r1 * Math.sin(p1) * Math.cos(t1)
          l.startY = orbPosition.y + r1 * Math.sin(p1) * Math.sin(t1)
          l.startZ = orbPosition.z + r1 * Math.cos(p1)

          const r2 = 0.8 + Math.random() * 2.5
          const t2 = Math.random() * Math.PI * 2
          const p2 = Math.acos(2 * Math.random() - 1)
          l.endX = orbPosition.x + r2 * Math.sin(p2) * Math.cos(t2)
          l.endY = orbPosition.y + r2 * Math.sin(p2) * Math.sin(t2)
          l.endZ = orbPosition.z + r2 * Math.cos(p2)

          l.age         = 0
          l.lifetime    = NEURAL_LINKS.minLifetime + Math.random() *
            (NEURAL_LINKS.maxLifetime - NEURAL_LINKS.minLifetime)
          l.phaseOffset = Math.random()
          l.active      = true
          spawned++
        }
      }
    }

    // Upload instance data
    const sa = instanceStartAttr.current
    const ea = instanceEndAttr.current
    const aa = ageAttr.current
    const la = lifetimeAttr.current
    const pa = phaseOffAttr.current
    if (!sa || !ea || !aa || !la || !pa) return

    const sd = sa.array as Float32Array
    const ed = ea.array as Float32Array
    const ad = aa.array as Float32Array
    const ld = la.array as Float32Array
    const pd = pa.array as Float32Array

    for (let i = 0; i < MAX_LINKS; i++) {
      const l = links[i]
      const i3 = i * 3
      sd[i3] = l.startX; sd[i3+1] = l.startY; sd[i3+2] = l.startZ
      ed[i3] = l.endX;   ed[i3+1] = l.endY;   ed[i3+2] = l.endZ
      ad[i]  = l.age
      ld[i]  = l.lifetime
      pd[i]  = l.phaseOffset
    }

    sa.needsUpdate = true; ea.needsUpdate = true
    aa.needsUpdate = true; la.needsUpdate = true
    pa.needsUpdate = true
  })

  return (
    <mesh ref={meshRef} geometry={instancedGeo} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={LINK_VERT}
        fragmentShader={LINK_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
