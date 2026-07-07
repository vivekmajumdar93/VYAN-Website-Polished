'use client'

/**
 * ParticleEngine — 120 000-particle GPU-simulated swarm.
 * Uses GPUComputationRenderer for position/velocity physics.
 * Renders via InstancedMesh (Points) with custom GLSL.
 * Falls back gracefully when WebGL float textures unavailable.
 */

import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { PARTICLE_QUALITY } from '@/constants/neuralBloom'
import type { QualityTier } from '@/types/neuralBloom'

// Inline GPU shaders as template literals (webpack asset/source for .glsl
// files is configured but these are performance-critical and kept inline
// to avoid async loading delays during a time-sensitive transition)
const POSITION_SHADER = /* glsl */`
uniform sampler2D textureVelocity;
uniform float uDelta;
uniform float uPhase;
uniform float uElapsed;
uniform vec3 uOrbPosition;
void main(){
  vec2 uv=gl_FragCoord.xy/resolution.xy;
  vec4 pos=texture2D(texturePosition,uv);
  vec4 vel=texture2D(textureVelocity,uv);
  float life=pos.w;
  vec3 np=pos.xyz+vel.xyz*uDelta;
  if(uPhase>=4.0){
    float w=(uPhase-4.0)/2.0;
    float d=length(np-uOrbPosition);
    float si=w*0.15/max(d*d,0.01);
    np+=normalize(uOrbPosition-np)*si;
  }
  float ar=mix(0.1,0.4,clamp((uPhase-1.0)/6.0,0.,1.));
  life=clamp(life+uDelta*ar,0.,1.);
  if(life>=1.0){
    float seed=uv.x*1723.+uv.y*3491.+uElapsed*137.;
    float theta=mod(seed*0.1731,6.2832);
    float phi=mod(seed*0.0973,3.1416);
    float r=4.+mod(seed*0.0412,3.);
    np=vec3(r*sin(phi)*cos(theta),r*sin(phi)*sin(theta),r*cos(phi));
    life=0.;
  }
  gl_FragColor=vec4(np,life);
}
`

const VELOCITY_SHADER = /* glsl */`
uniform sampler2D texturePosition;
uniform float uDelta;
uniform float uTime;
uniform float uPhase;
uniform float uAttractorStrength;
uniform vec3 uOrbPosition;
uniform float uCancelled;

vec3 _vm289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 _vm289_4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 _vp(vec4 x){return _vm289_4(((x*34.)+1.)*x);}
vec4 _vts(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float vsn3(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=_vm289(i);
  vec4 p=_vp(_vp(_vp(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=_vts(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 vcurl(vec3 p){
  float e=0.0015;
  vec3 p1=p+vec3(31.416,57.721,19.283);vec3 p2=p+vec3(-72.345,15.693,84.214);
  float n1,n2;
  n1=vsn3(p+vec3(0,e,0));n2=vsn3(p-vec3(0,e,0));float dF1dy=(n1-n2)/(2.*e);
  n1=vsn3(p+vec3(0,0,e));n2=vsn3(p-vec3(0,0,e));float dF1dz=(n1-n2)/(2.*e);
  n1=vsn3(p1+vec3(e,0,0));n2=vsn3(p1-vec3(e,0,0));float dF2dx=(n1-n2)/(2.*e);
  n1=vsn3(p1+vec3(0,0,e));n2=vsn3(p1-vec3(0,0,e));float dF2dz=(n1-n2)/(2.*e);
  n1=vsn3(p2+vec3(e,0,0));n2=vsn3(p2-vec3(e,0,0));float dF3dx=(n1-n2)/(2.*e);
  n1=vsn3(p2+vec3(0,e,0));n2=vsn3(p2-vec3(0,e,0));float dF3dy=(n1-n2)/(2.*e);
  return vec3(dF3dy-dF2dz,dF1dz-dF3dx,dF2dx-dF1dy);
}
void main(){
  vec2 uv=gl_FragCoord.xy/resolution.xy;
  float ts=1./resolution.x;
  vec4 pd=texture2D(texturePosition,uv);
  vec4 vd=texture2D(textureVelocity,uv);
  vec3 pos=pd.xyz;vec3 vel=vd.xyz;
  vec3 ap=vec3(0.),av=vec3(0.),sf=vec3(0.);
  float cnt=0.,st=0.35;
  for(int di=-1;di<=1;di++){for(int dj=-1;dj<=1;dj++){
    if(di==0&&dj==0)continue;
    vec2 su=uv+vec2(float(di),float(dj))*ts;
    vec4 np=texture2D(texturePosition,su);vec4 nv=texture2D(textureVelocity,su);
    ap+=np.xyz;av+=nv.xyz;
    float d=length(np.xyz-pos);
    if(d<st&&d>0.001)sf+=normalize(pos-np.xyz)/d;
    cnt+=1.;
  }}
  ap/=cnt;av/=cnt;
  vec3 aln=(av-vel)*0.3;
  vec3 coh=(ap-pos)*0.06;
  vec3 sep=sf*0.4;
  float cs=0.25+uPhase*0.05;
  float cd=uCancelled>0.5?-1.:1.;
  vec3 curl=vcurl(pos*cs+vec3(0.,0.,uTime*0.18))*0.6*cd;
  vec3 toOrb=uOrbPosition-pos;
  float od=length(toOrb);
  float grav=uAttractorStrength*1.8/max(od*od,0.04);
  vec3 att=normalize(toOrb)*grav;
  float pp=0.;if(uPhase>=5.)pp=(uPhase-5.)*2.5;
  vec3 force=aln+coh+sep+curl+att+vec3(0.,0.,-pp);
  vel=vel*0.88+force*uDelta*45.;
  float spd=length(vel);
  if(spd>6.)vel=vel/spd*6.;
  gl_FragColor=vec4(vel,vd.w);
}
`

const PARTICLE_VERT = /* glsl */`
uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform float uTime;
uniform float uPhase;
uniform vec3 uOrbPosition;
attribute vec2 aParticleUv;
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
void main(){
  vec4 pd=texture2D(uPositionTexture,aParticleUv);
  vec4 vd=texture2D(uVelocityTexture,aParticleUv);
  vec3 pos=pd.xyz;float life=pd.w;vec3 vel=vd.xyz;
  float spd=length(vel);
  float t=clamp(spd/4.,0.,1.);
  vec3 vi=vec3(0.482,0.184,1.);vec3 bl=vec3(0.176,0.435,1.);vec3 go=vec3(0.831,0.659,0.325);
  float gn=clamp((uPhase-5.5)*2.,0.,1.);
  vColor=mix(mix(vi,bl,t),go,gn);
  float lf=life<0.05?life/0.05:life>0.9?1.-(life-0.9)/0.1:1.;
  float pf=clamp(uPhase-0.5,0.,1.);
  vAlpha=lf*pf;
  vGlow=mix(0.4,1.,clamp(spd/3.,0.,1.));
  float dO=length(pos-uOrbPosition);
  float nO=clamp(1.-dO/2.5,0.,1.);
  gl_PointSize=mix(1.5,5.,nO*vGlow);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
}
`

const PARTICLE_FRAG = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
void main(){
  vec2 c=gl_PointCoord-0.5;float r=length(c);
  if(r>0.5)discard;
  float core=exp(-r*r*28.);float halo=exp(-r*r*8.)*0.55;float glow=exp(-r*r*2.5)*0.25;
  float alpha=(core+halo+glow)*vAlpha;
  vec3 col=mix(vColor,vec3(1.),core*0.7);
  col*=1.+vGlow*1.4;
  gl_FragColor=vec4(col,alpha);
}
`

interface ParticleEngineProps {
  phase: number
  elapsed: number
  attractorStrength: number
  orbPosition: Vector3
  quality: QualityTier
  cancelled: boolean
}

export function ParticleEngine({
  phase,
  elapsed,
  attractorStrength,
  orbPosition,
  quality,
  cancelled,
}: ParticleEngineProps) {
  const { gl } = useThree()
  const config = PARTICLE_QUALITY[quality]

  const gpuRef    = useRef<unknown>(null)
  const posVarRef = useRef<unknown>(null)
  const velVarRef = useRef<unknown>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const matRef    = useRef<THREE.ShaderMaterial>(null)
  const timeRef   = useRef(0)
  const [ready, setReady] = useState(false)

  // Build geometry with per-particle UVs
  const geometry = useMemo(() => {
    const count = config.count
    const size  = config.gpuSize
    const geo   = new THREE.BufferGeometry()
    const uvs   = new Float32Array(count * 2)
    const pos   = new Float32Array(count * 3) // dummy positions (overridden in vert)
    for (let i = 0; i < count; i++) {
      const x = (i % size) / size + 0.5 / size
      const y = Math.floor(i / size) / size + 0.5 / size
      uvs[i * 2]     = x
      uvs[i * 2 + 1] = y
      pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0
    }
    geo.setAttribute('position',      new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aParticleUv',   new THREE.BufferAttribute(uvs, 2))
    return geo
  }, [config.count, config.gpuSize])

  const uniforms = useMemo(() => ({
    uPositionTexture: { value: null as THREE.Texture | null },
    uVelocityTexture: { value: null as THREE.Texture | null },
    uTime:            { value: 0 },
    uPhase:           { value: 0 },
    uOrbPosition:     { value: orbPosition.clone() },
  }), [orbPosition])

  // Init GPU computation
  useEffect(() => {
    let cancelled_internal = false

    import('three/examples/jsm/misc/GPUComputationRenderer.js').then(({ GPUComputationRenderer }) => {
      if (cancelled_internal) return
      const size = config.gpuSize
      const gpu  = new GPUComputationRenderer(size, size, gl)

      try {
        gpu.setDataType(THREE.FloatType)
      } catch {
        // WebGL1 fallback: try HalfFloatType
        try { gpu.setDataType(THREE.HalfFloatType) } catch { /* */ }
      }

      const posTex = gpu.createTexture()
      const velTex = gpu.createTexture()
      const posData = posTex.image.data as unknown as Float32Array
      const velData = velTex.image.data as unknown as Float32Array

      for (let i = 0; i < size * size; i++) {
        const i4 = i * 4
        const theta = Math.random() * Math.PI * 2
        const phi   = Math.acos(2 * Math.random() - 1)
        const r     = 3 + Math.random() * 4
        posData[i4]     = r * Math.sin(phi) * Math.cos(theta)
        posData[i4 + 1] = r * Math.sin(phi) * Math.sin(theta)
        posData[i4 + 2] = r * Math.cos(phi)
        posData[i4 + 3] = Math.random()
        velData[i4]     = (Math.random() - 0.5) * 0.05
        velData[i4 + 1] = (Math.random() - 0.5) * 0.05
        velData[i4 + 2] = (Math.random() - 0.5) * 0.05
        velData[i4 + 3] = Math.random()
      }

      const posVar = gpu.addVariable('texturePosition', POSITION_SHADER, posTex)
      const velVar = gpu.addVariable('textureVelocity', VELOCITY_SHADER, velTex)

      gpu.setVariableDependencies(posVar, [posVar, velVar])
      gpu.setVariableDependencies(velVar, [posVar, velVar])

      // Set initial uniforms on computation materials
      const posUni = posVar.material.uniforms as Record<string, { value: unknown }>
      posUni.uDelta       = { value: 0.016 }
      posUni.uPhase       = { value: 0 }
      posUni.uElapsed     = { value: 0 }
      posUni.uOrbPosition = { value: orbPosition.clone() }

      const velUni = velVar.material.uniforms as Record<string, { value: unknown }>
      velUni.uDelta             = { value: 0.016 }
      velUni.uTime              = { value: 0 }
      velUni.uPhase             = { value: 0 }
      velUni.uAttractorStrength = { value: 0 }
      velUni.uOrbPosition       = { value: orbPosition.clone() }
      velUni.uCancelled         = { value: 0 }

      const err = gpu.init()
      if (err) {
        console.error('[NeuralBloom] GPU init error:', err)
        return
      }

      gpuRef.current    = gpu
      posVarRef.current = posVar
      velVarRef.current = velVar
      setReady(true)
    }).catch(err => {
      console.error('[NeuralBloom] GPUComputationRenderer unavailable:', err)
    })

    return () => {
      cancelled_internal = true
      if (gpuRef.current) {
        try { (gpuRef.current as { dispose?: () => void }).dispose?.() } catch {}
        gpuRef.current = null
      }
    }
  }, [gl, config.gpuSize, orbPosition])

  useFrame((_, delta) => {
    if (!ready || !gpuRef.current) return
    const gpu    = gpuRef.current as {
      compute: () => void
      getCurrentRenderTarget: (v: unknown) => THREE.WebGLRenderTarget
    }
    const posVar = posVarRef.current
    const velVar = velVarRef.current

    timeRef.current += delta

    // Update GPU uniform values
    if (posVar) {
      const pu = (posVar as { material: { uniforms: Record<string, { value: unknown }> } })
        .material.uniforms
      pu.uDelta.value       = Math.min(delta, 0.033)
      pu.uPhase.value       = phase
      pu.uElapsed.value     = elapsed
      pu.uOrbPosition.value = orbPosition
    }
    if (velVar) {
      const vu = (velVar as { material: { uniforms: Record<string, { value: unknown }> } })
        .material.uniforms
      vu.uDelta.value             = Math.min(delta, 0.033)
      vu.uTime.value              = timeRef.current
      vu.uPhase.value             = phase
      vu.uAttractorStrength.value = attractorStrength
      vu.uOrbPosition.value       = orbPosition
      vu.uCancelled.value         = cancelled ? 1 : 0
    }

    // Run GPU computation step
    gpu.compute()

    // Feed result textures to render material
    if (matRef.current && posVar && velVar) {
      matRef.current.uniforms.uPositionTexture.value =
        gpu.getCurrentRenderTarget(posVar).texture
      matRef.current.uniforms.uVelocityTexture.value =
        gpu.getCurrentRenderTarget(velVar).texture
      matRef.current.uniforms.uTime.value  = timeRef.current
      matRef.current.uniforms.uPhase.value = phase
      matRef.current.uniforms.uOrbPosition.value = orbPosition
    }
  })

  if (!ready) return null

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={PARTICLE_VERT}
        fragmentShader={PARTICLE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
      />
    </points>
  )
}
