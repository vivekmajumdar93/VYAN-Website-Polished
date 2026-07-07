// GPU Computation: particle velocity update
// Swarm intelligence + curl noise + orb gravity

uniform sampler2D texturePosition;
uniform float uDelta;
uniform float uTime;
uniform float uPhase;
uniform float uAttractorStrength;
uniform vec3 uOrbPosition;
uniform float uCancelled;

// Simplex noise (inlined — same as simplex-noise.glsl)
vec3 _vmod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 _vmod289_4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 _vpermute(vec4 x) { return _vmod289_4(((x*34.0)+1.0)*x); }
vec4 _vtaylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float _vsnoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = _vmod289(i);
  vec4 p = _vpermute(_vpermute(_vpermute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x  = x_ * ns.x + ns.yyyy;
  vec4 y  = y_ * ns.x + ns.yyyy;
  vec4 h  = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = _vtaylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

vec3 _curlNoise(vec3 p) {
  float eps = 0.0015;
  float n1, n2;
  vec3 p1 = p + vec3(31.416, 57.721, 19.283);
  vec3 p2 = p + vec3(-72.345, 15.693, 84.214);

  n1 = _vsnoise(p  + vec3(0,eps,0)); n2 = _vsnoise(p  - vec3(0,eps,0)); float dF1dy = (n1-n2)/(2.0*eps);
  n1 = _vsnoise(p  + vec3(0,0,eps)); n2 = _vsnoise(p  - vec3(0,0,eps)); float dF1dz = (n1-n2)/(2.0*eps);
  n1 = _vsnoise(p1 + vec3(eps,0,0)); n2 = _vsnoise(p1 - vec3(eps,0,0)); float dF2dx = (n1-n2)/(2.0*eps);
  n1 = _vsnoise(p1 + vec3(0,0,eps)); n2 = _vsnoise(p1 - vec3(0,0,eps)); float dF2dz = (n1-n2)/(2.0*eps);
  n1 = _vsnoise(p2 + vec3(eps,0,0)); n2 = _vsnoise(p2 - vec3(eps,0,0)); float dF3dx = (n1-n2)/(2.0*eps);
  n1 = _vsnoise(p2 + vec3(0,eps,0)); n2 = _vsnoise(p2 - vec3(0,eps,0)); float dF3dy = (n1-n2)/(2.0*eps);

  return vec3(dF3dy - dF2dz, dF1dz - dF3dx, dF2dx - dF1dy);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float texStep = 1.0 / resolution.x;

  vec4 posData = texture2D(texturePosition, uv);
  vec4 velData = texture2D(textureVelocity, uv);
  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;

  // ── Swarm intelligence: sample 3×3 neighborhood ──
  vec3 avgPos  = vec3(0.0);
  vec3 avgVel  = vec3(0.0);
  vec3 sepForce = vec3(0.0);
  float count  = 0.0;
  float sepThresh = 0.35;

  for (int di = -1; di <= 1; di++) {
    for (int dj = -1; dj <= 1; dj++) {
      if (di == 0 && dj == 0) continue;
      vec2 sampleUv = uv + vec2(float(di), float(dj)) * texStep;
      vec4 nPos = texture2D(texturePosition, sampleUv);
      vec4 nVel = texture2D(textureVelocity, sampleUv);
      avgPos += nPos.xyz;
      avgVel += nVel.xyz;
      float d = length(nPos.xyz - pos);
      if (d < sepThresh && d > 0.001) {
        sepForce += normalize(pos - nPos.xyz) / d;
      }
      count += 1.0;
    }
  }
  avgPos /= count;
  avgVel /= count;

  // Alignment: steer toward average neighbor velocity
  vec3 alignment = (avgVel - vel) * 0.3;
  // Cohesion: steer toward neighbor center
  vec3 cohesion  = (avgPos - pos) * 0.06;
  // Separation: avoid neighbors
  vec3 separation = sepForce * 0.4;

  // Curl noise field (time-varying)
  float curlScale = 0.25 + uPhase * 0.05;
  vec3 curlField = _curlNoise(pos * curlScale + vec3(0.0, 0.0, uTime * 0.18)) * 0.6;

  // Orb attractor gravity
  vec3 toOrb   = uOrbPosition - pos;
  float orbDist = length(toOrb);
  float gravity = uAttractorStrength * 1.8 / max(orbDist * orbDist, 0.04);
  vec3 attractorForce = normalize(toOrb) * gravity;

  // On cancel: reverse curl direction
  float curlDir = uCancelled > 0.5 ? -1.0 : 1.0;

  // Phase 5 (passage): strong forward current
  float passagePull = 0.0;
  if (uPhase >= 5.0) {
    passagePull = (uPhase - 5.0) * 2.5;
  }

  // Compose forces
  vec3 force = alignment + cohesion + separation
             + curlField * curlDir
             + attractorForce
             + vec3(0.0, 0.0, -passagePull);

  // Integrate velocity with damping
  vel = vel * 0.88 + force * uDelta * 45.0;

  // Speed cap
  float speed = length(vel);
  if (speed > 6.0) vel = vel / speed * 6.0;

  gl_FragColor = vec4(vel, velData.w);
}
