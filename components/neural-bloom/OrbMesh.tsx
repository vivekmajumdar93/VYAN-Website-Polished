'use client'

/**
 * OrbMesh — the Medhā orb: violet plasma with breathing displacement,
 * energy veins, Fresnel edge, subsurface glow. Uses custom GLSL shaders.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Vector3, ShaderMaterial, Mesh, SphereGeometry } from 'three'
import { ORB_CONFIG } from '@/constants/neuralBloom'
import { smoothstep, lerp } from '@/lib/timeline'

// Orb shaders — inlined to avoid GLSL module complexity
const ORB_VERT = /* glsl */`
uniform float uTime;
uniform float uPhase;
uniform float uBrightness;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying vec3 vLocalPos;
varying float vFresnel;

vec3 _om289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 _om289_4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 _op(vec4 x){return _om289_4(((x*34.)+1.)*x);}
vec4 _ots(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float onoise3(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=_om289(i);
  vec4 p=_op(_op(_op(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=_ots(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
void main(){
  vUv=uv;vLocalPos=position;
  float breathe=sin(uTime*6.2832*0.8)*0.018;
  float surf=onoise3(position*2.4+vec3(0.,0.,uTime*0.22))*0.045+breathe;
  float vein=onoise3(position*5.+vec3(uTime*0.6,0.,0.))*0.02;
  float veinPulse=sin(uTime*3.5+position.x*7.)*0.012;
  vec3 disp=position+normal*(surf+veinPulse*vein);
  vec3 wn=normalize(normalMatrix*normal);
  vec3 wp=(modelMatrix*vec4(disp,1.)).xyz;
  vViewDir=normalize(cameraPosition-wp);
  float ct=max(0.,dot(wn,vViewDir));
  vFresnel=0.05+0.95*pow(1.-ct,5.);
  vNormal=normalize(normalMatrix*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(disp,1.);
}
`

const ORB_FRAG = /* glsl */`
uniform float uTime;
uniform float uPhase;
uniform float uBrightness;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying vec3 vLocalPos;
varying float vFresnel;

vec3 _fm289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 _fm289_4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 _fp(vec4 x){return _fm289_4(((x*34.)+1.)*x);}
vec4 _fts(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float fnoise3(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=_fm289(i);
  vec4 p=_fp(_fp(_fp(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=_fts(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
void main(){
  vec3 baseViolet=vec3(0.482,0.184,1.0);
  vec3 plasmaRed=vec3(0.545,0.0,0.2);
  vec3 veinBlue=vec3(0.176,0.435,1.0);
  vec3 fresnelWhite=vec3(0.9,0.82,1.0);
  float dist=length(vLocalPos);
  float plasma=pow(clamp(1.-dist*1.05,0.,1.),2.2);
  float pb=0.5+0.5*sin(uTime*6.2832*0.8+0.7);
  vec3 col=mix(baseViolet,plasmaRed,plasma*pb*0.65);
  float v1=fnoise3(vLocalPos*6.+vec3(uTime*0.8,0.,0.));
  float v2=fnoise3(vLocalPos*12.+vec3(0.,uTime*1.2,0.));
  float vp=pow(abs(v1*0.6+v2*0.4),3.5);
  float seed=vLocalPos.x*3.7+vLocalPos.y*2.1+vLocalPos.z*1.8;
  float pulse=sin(seed*4.-uTime*6.)*0.5+0.5;
  float vb=vp*pulse*(1.+uPhase*0.4);
  col+=veinBlue*vb*2.5;
  float sss=exp(-dist*3.5)*0.8+exp(-dist*1.8)*0.4;
  col+=baseViolet*sss*0.6;
  col=mix(col,fresnelWhite,vFresnel*0.85);
  col*=uBrightness;
  float ca=vFresnel*0.12;
  col.r*=1.+ca;col.b*=1.-ca*0.5;
  gl_FragColor=vec4(col,1.);
}
`

interface OrbMeshProps {
  phase: number
  elapsed: number
  position: Vector3
}

export function OrbMesh({ phase, elapsed, position }: OrbMeshProps) {
  const meshRef   = useRef<Mesh>(null)
  const matRef    = useRef<ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uPhase:      { value: 0 },
    uBrightness: { value: 1 },
  }), [])

  useFrame((_, delta) => {
    if (!matRef.current) return
    const u = matRef.current.uniforms
    u.uTime.value  += delta
    u.uPhase.value  = phase

    // Brightness ramps in phase 2 to 4.4x, then maintains
    let brightness = 1.0
    if (phase === 2) {
      const t = smoothstep(0, 1, (elapsed - 0.18) / 0.42)
      brightness = lerp(1.0, ORB_CONFIG.brightnessPhase2, t)
    } else if (phase >= 3 && phase <= 5) {
      brightness = ORB_CONFIG.brightnessPhase2
    } else if (phase === 6) {
      brightness = lerp(ORB_CONFIG.brightnessPhase2, 0.3, smoothstep(0, 1, (elapsed - 1.8) / 0.3))
    } else if (phase === 7) {
      brightness = 0.3
    }
    u.uBrightness.value = brightness

    // Pulsed scale during phase 1
    if (meshRef.current && phase === 1) {
      const t = (elapsed) / 0.18
      const pulse = 1 + Math.sin(t * Math.PI) * 0.12
      meshRef.current.scale.setScalar(pulse)
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1)
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[ORB_CONFIG.radius, ORB_CONFIG.segments, ORB_CONFIG.segments]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={ORB_VERT}
        fragmentShader={ORB_FRAG}
        uniforms={uniforms}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}
