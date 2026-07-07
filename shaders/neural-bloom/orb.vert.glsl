// Orb vertex shader — breathing displacement + simplex surface noise

uniform float uTime;
uniform float uPhase;
uniform float uBrightness;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying vec3 vLocalPos;
varying float vFresnel;

// Inlined simplex 3D (avoids GLSL include limitations)
vec3 _omod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 _omod289_4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 _operm(vec4 x){return _omod289_4(((x*34.)+1.)*x);}
vec4 _otis(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float onoise3(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=_omod289(i);
  vec4 p=_operm(_operm(_operm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=_otis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main() {
  vUv = uv;
  vLocalPos = position;

  // Breathing: slow sine at 0.8 Hz
  float breathe = sin(uTime * 6.2832 * 0.8) * 0.018;

  // Surface texture displacement
  float surfNoise = onoise3(position * 2.4 + vec3(0.0, 0.0, uTime * 0.22));
  float displacement = surfNoise * 0.045 + breathe;

  // Energy vein displacement along UV seams
  float veinPulse = sin(uTime * 3.5 + position.x * 7.0) * 0.012;
  float vein = onoise3(position * 5.0 + vec3(uTime * 0.6, 0.0, 0.0)) * 0.02;
  displacement += veinPulse * vein;

  // Apply displacement along normal
  vec3 displacedPos = position + normal * displacement;

  // Fresnel for varying
  vec3 worldNormal = normalize(normalMatrix * normal);
  vec3 worldPos = (modelMatrix * vec4(displacedPos, 1.0)).xyz;
  vec3 camPos   = cameraPosition;
  vec3 viewDir  = normalize(camPos - worldPos);
  float cosTheta = max(0.0, dot(worldNormal, viewDir));
  vFresnel = 0.05 + 0.95 * pow(1.0 - cosTheta, 5.0);

  vNormal   = normalize(normalMatrix * normal);
  vViewDir  = viewDir;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPos, 1.0);
}
