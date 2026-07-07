'use client'

/**
 * ReconstructionLayer — Phase 6-7 assembly.
 * Particle dissolve into Medhā realm elements drawn as glowing GLSL outlines.
 * Elements appear in sequence: floor → arch → composer → MEDHA text → dots → pendants.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const RECON_VERT = /* glsl */`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`

const RECON_FRAG = /* glsl */`
uniform float uTime;
uniform float uProgress;
varying vec2 vUv;

vec2 _rm289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 _rm289_3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec3 _rp(vec3 x){return _rm289_3(((x*34.)+1.)*x);}
float rsn2(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=_rm289(i);
  vec3 p=_rp(_rp(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
  vec3 x2=2.*fract(p*C.www)-1.;vec3 h=abs(x2)-.5;vec3 ox=floor(x2+.5);vec3 a0=x2-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}

float gline(vec2 uv,vec2 a,vec2 b,float r){
  vec2 pa=uv-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
  float d=length(pa-ba*h);return exp(-d*d/(r*r));
}
float gbox(vec2 uv,vec2 cen,vec2 sz,float r){
  vec2 hs=sz*.5;vec2 p=uv-cen;vec2 d=abs(p)-hs;
  float dist=length(max(d,0.))+min(max(d.x,d.y),0.);
  return (1.-smoothstep(0.,r,dist+r*.5))+max(0.,-dist)*.07;
}

void main(){
  float p=uProgress;
  vec3 vi=vec3(0.482,0.184,1.);vec3 bl=vec3(0.176,0.435,1.);
  vec3 go=vec3(0.831,0.659,0.325);vec3 wh=vec3(.9,.82,1.);
  vec3 vi2=vec3(0.102,0.039,0.239);
  float noise=rsn2(vUv*6.+vec2(uTime*.3,0.))*.5+.5;
  float diss=smoothstep(p-.12,p+.12,noise);
  vec3 col=vec3(0.);float alpha=0.;

  // Background void
  float bg=clamp(p*3.5,0.,1.);
  col+=vi2*bg*diss;alpha=bg*diss*.85;

  // Composer bar
  float cr=clamp((p-.1)*5.,0.,1.);
  float cb=gbox(vUv,vec2(.5,.88),vec2(.55,.06),.006)*cr;
  col+=mix(bl,wh,cb)*cb*3.;alpha=max(alpha,cb*cr);

  // MEDHA letters (5 glowing box-outlines)
  float tr=clamp((p-.25)*4.,0.,1.);
  for(int li=0;li<5;li++){
    float lx=.28+float(li)*.09;float ly=.44;
    float s=gline(vUv,vec2(lx,ly-.025),vec2(lx+.065,ly-.025),.0025)
           +gline(vUv,vec2(lx,ly),      vec2(lx+.065,ly),      .0025)
           +gline(vUv,vec2(lx,ly-.025), vec2(lx,ly+.025),      .0025)
           +gline(vUv,vec2(lx+.065,ly-.025),vec2(lx+.065,ly+.025),.0025);
    col+=wh*s*tr*2.8;alpha=max(alpha,s*tr*.9);
  }

  // DORMANT subtitle
  float dr=clamp((p-.4)*5.,0.,1.);
  for(int li=0;li<7;li++){
    float lx=.295+float(li)*.058;float ly=.485;
    float s=gline(vUv,vec2(lx,ly-.012),vec2(lx+.04,ly-.012),.0012)
           +gline(vUv,vec2(lx,ly-.012),vec2(lx,ly+.012),.0012);
    col+=vi*s*dr*2.;alpha=max(alpha,s*dr*.7);
  }

  // Arch
  float ar=clamp((p-.35)*4.,0.,1.);
  for(int ai=-8;ai<=8;ai++){
    float at=float(ai)/8.;
    float ax=.5+sin(at*3.14159)*.22;float ay=.55-(1.-abs(at))*.24;
    float ad=length(vUv-vec2(ax,ay));float ag=exp(-ad*ad/.0000064);
    col+=go*ag*3.*ar;alpha=max(alpha,ag*ar*.9);
  }

  // Neural strip dots
  float ndr=clamp((p-.55)*5.,0.,1.);
  for(int di=0;di<7;di++){
    float dx=.33+float(di)*.055;float dt=clamp((ndr-float(di)*.09)*6.,0.,1.);
    float dd=length(vUv-vec2(dx,.72));float dg=exp(-dd*dd/.000025)*dt;
    col+=bl*dg*4.;alpha=max(alpha,dg*.8);
  }

  // Pendants
  float pr=clamp((p-.65)*6.,0.,1.);
  for(int pi=0;pi<3;pi++){
    float px=.38+float(pi)*.12;float py=.61+sin(uTime*1.5+float(pi))*.003;
    float pd=length(vUv-vec2(px,py));float pg=exp(-pd*pd/.000049)*pr;
    col+=go*pg*5.;alpha=max(alpha,pg*pr*.95);
  }

  // Strand lines from arch to pendants
  float sl=clamp((p-.6)*6.,0.,1.);
  for(int pi=0;pi<3;pi++){
    float px=.38+float(pi)*.12;
    float sg=gline(vUv,vec2(px,.52),vec2(px,.61),.0008)*sl;
    col+=go*sg*2.;alpha=max(alpha,sg*sl*.5);
  }

  // Final pulse
  float pulse=clamp((p-.88)*12.,0.,1.)*clamp((1.-p)*12.,0.,1.);
  col+=vi*pulse*2.;alpha=max(alpha,pulse*.5);

  alpha=clamp(alpha,0.,1.);
  if(alpha<0.005)discard;
  gl_FragColor=vec4(col,alpha);
}
`

interface ReconstructionLayerProps {
  phase: number
  reconstructionProgress: number
}

export function ReconstructionLayer({ phase, reconstructionProgress }: ReconstructionLayerProps) {
  const matRef  = useRef<THREE.ShaderMaterial>(null)
  const timeRef = useRef(0)

  const uniforms = useMemo(() => ({
    uTime:     { value: 0 },
    uProgress: { value: 0 },
  }), [])

  useFrame((_, delta) => {
    if (!matRef.current) return
    timeRef.current += delta
    matRef.current.uniforms.uTime.value     = timeRef.current
    matRef.current.uniforms.uProgress.value = reconstructionProgress
  })

  if (phase < 6) return null

  return (
    <mesh position={[0, 0, -1.5]}>
      <planeGeometry args={[22, 22]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={RECON_VERT}
        fragmentShader={RECON_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.NormalBlending}
      />
    </mesh>
  )
}
