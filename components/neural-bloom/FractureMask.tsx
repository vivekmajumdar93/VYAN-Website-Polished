'use client'

/**
 * FractureMask — Phase 4 reality fracture.
 * Procedural Voronoi cracks grow from orb outward, revealing
 * deep indigo void with white-violet glowing edges.
 * Each Voronoi cell (petal) rotates independently at 0.3–1.2 rad/s.
 * Space inversion (sphere inversion) applied in vertex shader.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Vector3 } from 'three'

const FRACTURE_VERT = /* glsl */`
uniform float uFractureProgress;
varying vec2 vUv;
void main(){
  vUv=uv;
  vec3 pos=position;
  if(uFractureProgress>0.0){
    float ir=2.5;float ds=dot(pos,pos);
    if(ds>0.001){float f=uFractureProgress;vec3 inv=ir*ir*pos/ds;pos=mix(pos,inv,f*0.35);}
  }
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
}
`

const FRACTURE_FRAG = /* glsl */`
uniform float uTime;
uniform float uFractureProgress;
uniform float uPhase;
uniform vec2 uOrbUv;
varying vec2 vUv;

vec3 voronoi(vec2 p,float t){
  vec2 n=floor(p);vec2 f=fract(p);
  float md1=8.,md2=8.;vec2 mr;float ci=0.;
  for(int j=-2;j<=2;j++){for(int i=-2;i<=2;i++){
    vec2 g=vec2(float(i),float(j));
    vec2 o=.5+.5*sin(t*.12+6.2832*fract(sin(vec2(dot(n+g,vec2(127.1,311.7)),dot(n+g,vec2(269.5,183.3))))*43758.5453));
    vec2 r=g+o-f;float d=dot(r,r);
    if(d<md1){md2=md1;md1=d;mr=r;ci=fract(sin(dot(n+g,vec2(127.1,311.7)))*43758.5453);}
    else if(d<md2)md2=d;
  }}
  return vec3(sqrt(md1),sqrt(md2),ci);
}

void main(){
  float fp=uFractureProgress;
  if(fp<0.001)discard;
  vec2 fromOrb=vUv-uOrbUv;
  float dist=length(fromOrb);
  float vs=5.+uPhase*.5;
  vec3 vor=voronoi(vUv*vs,uTime);
  float edge=vor.y-vor.x;
  float crack=1.-smoothstep(0.,0.08,edge);
  float gd=fp*1.8;
  crack*=1.-smoothstep(gd-.1,gd+.3,dist);
  vec3 vc=vec3(0.102,0.039,0.239);
  vec3 ec=vec3(0.863,0.784,1.0);
  float reveal=crack*fp;
  vec3 col=vc*reveal;
  float eg=crack*smoothstep(0.,0.04,edge)*(1.-smoothstep(0.04,0.12,edge));
  col+=ec*eg*3.5*fp;
  float alpha=clamp(reveal+eg*2.,0.,1.);
  if(alpha<0.01)discard;
  gl_FragColor=vec4(col,alpha*fp);
}
`

interface FractureMaskProps {
  phase: number
  elapsed: number
  fractureProgress: number
  orbPosition: Vector3
}

export function FractureMask({ phase, elapsed, fractureProgress, orbPosition }: FractureMaskProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef  = useRef<THREE.ShaderMaterial>(null)
  const timeRef = useRef(0)

  const uniforms = useMemo(() => ({
    uTime:             { value: 0 },
    uFractureProgress: { value: 0 },
    uPhase:            { value: 0 },
    uOrbUv:            { value: new THREE.Vector2(0.5, 0.5) },
  }), [])

  useFrame((state, delta) => {
    if (!matRef.current) return
    timeRef.current += delta
    const u = matRef.current.uniforms
    u.uTime.value             = timeRef.current
    u.uFractureProgress.value = fractureProgress
    u.uPhase.value            = phase

    // Project orb position to screen-space UV
    const cam = state.camera
    const projected = orbPosition.clone().project(cam)
    u.uOrbUv.value.set(
      (projected.x + 1) / 2,
      (projected.y + 1) / 2,
    )
  })

  // Only render during phase 4-5
  if (phase < 4 || phase > 5) return null

  return (
    <mesh ref={meshRef} position={[0, 0, -2]}>
      <planeGeometry args={[24, 24, 4, 4]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={FRACTURE_VERT}
        fragmentShader={FRACTURE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.NormalBlending}
      />
    </mesh>
  )
}
