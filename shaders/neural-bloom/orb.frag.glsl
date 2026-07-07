// Orb fragment shader — violet plasma with energy veins, Fresnel, subsurface

uniform float uTime;
uniform float uPhase;
uniform float uBrightness;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying vec3 vLocalPos;
varying float vFresnel;

// Inlined simplex (same as vert, needed in frag independently)
vec3 _fmod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 _fmod289_4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 _fperm(vec4 x){return _fmod289_4(((x*34.)+1.)*x);}
vec4 _ftis(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float fnoise3(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=_fmod289(i);
  vec4 p=_fperm(_fperm(_fperm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=_ftis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main() {
  // Base colors
  vec3 baseViolet  = vec3(0.482, 0.184, 1.000); // #7b2fff
  vec3 plasmaRed   = vec3(0.545, 0.000, 0.200); // #8b0033
  vec3 veinBlue    = vec3(0.176, 0.435, 1.000); // #2d6fff
  vec3 fresnelWhite = vec3(0.90, 0.82, 1.00);

  // Inner plasma — radial from center
  float distFromCenter = length(vLocalPos);
  float plasma = clamp(1.0 - distFromCenter * 1.05, 0.0, 1.0);
  plasma = pow(plasma, 2.2);
  float plasmaBreath = 0.5 + 0.5 * sin(uTime * 6.2832 * 0.8 + 0.7);
  vec3 col = mix(baseViolet, plasmaRed, plasma * plasmaBreath * 0.65);

  // Procedural energy veins — branching noise
  float t = uTime;
  float vein1 = fnoise3(vLocalPos * 6.0  + vec3(t * 0.8, 0.0, 0.0));
  float vein2 = fnoise3(vLocalPos * 12.0 + vec3(0.0, t * 1.2, 0.0));
  float veinPattern = pow(abs(vein1 * 0.6 + vein2 * 0.4), 3.5);

  // Vein traveling pulse
  float pulseSeed = vLocalPos.x * 3.7 + vLocalPos.y * 2.1 + vLocalPos.z * 1.8;
  float pulseWave = sin(pulseSeed * 4.0 - t * 6.0) * 0.5 + 0.5;
  float veinBright = veinPattern * pulseWave * (1.0 + uPhase * 0.4);

  col += veinBlue * veinBright * 2.5;

  // Subsurface glow layers
  float sss1 = exp(-distFromCenter * 3.5) * 0.8;
  float sss2 = exp(-distFromCenter * 1.8) * 0.4;
  col += baseViolet * (sss1 + sss2) * 0.6;

  // Fresnel edge — bright violet-white at glancing angles
  vec3 fresnelCol = mix(fresnelWhite, vec3(0.6, 0.4, 1.0), 0.4);
  col = mix(col, fresnelCol, vFresnel * 0.85);

  // Phase 2: brightness ramps to 4.4x
  float brightness = uBrightness;
  col *= brightness;

  // Chromatic aberration at extreme Fresnel
  float caStrength = vFresnel * 0.12;
  col.r *= 1.0 + caStrength;
  col.b *= 1.0 - caStrength * 0.5;

  // Output HDR — bloom picks this up
  gl_FragColor = vec4(col, 1.0);
}
