// Simplex 3D noise (Ashima) and galaxy shaders
export const snoise3 = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
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
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`

export const galaxyVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uSpin;
  uniform float uTurbulence;
  uniform float uSpiralTightness;
  uniform float uStarBrightness;

  attribute float aScale;
  attribute float aAngle;
  attribute float aRadius;
  attribute float aHeight;
  attribute float aStar;     // 0 = gas particle, 1 = bright accent star
  attribute vec3  aRandomness;

  varying float vDistance;
  varying float vAngle;
  varying float vRandomSeed;
  varying float vStar;

  ${snoise3}

  void main() {
    float r = aRadius;

    // Differential rotation: MUCH faster near the core (inverse-square-ish falloff)
    // At r=0.2 -> omega ~ 8x faster than at r=5
    float omega = (1.0 / pow(r + 0.15, 1.6)) * uTime * uSpin * 0.22;
    float angle = aAngle + omega + r * uSpiralTightness;

    vec3 pos;
    pos.x = cos(angle) * r;
    pos.z = sin(angle) * r;
    pos.y = aHeight;

    pos += aRandomness;

    // Subtle living distortion
    float n = snoise(vec3(pos.x * 0.22, pos.z * 0.22, uTime * 0.04));
    pos.y += n * 0.05 * uTurbulence;

    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    // Bright accent stars get bigger
    float starScale = mix(1.0, 3.4 * uStarBrightness, aStar);
    gl_PointSize = uSize * aScale * starScale;
    gl_PointSize *= (1.0 / max(-viewPosition.z, 0.1));

    vDistance = r;
    vAngle = angle;
    vRandomSeed = n;
    vStar = aStar;
  }
`

export const galaxyFragment = /* glsl */ `
  uniform float uTime;
  uniform float uCoreGlow;
  uniform float uDustDensity;
  uniform float uGradientIntensity;
  uniform vec3  uColorCore;
  uniform vec3  uColorMid;
  uniform vec3  uColorOuter;
  uniform vec3  uStarColor;
  uniform float uMaxRadius;

  varying float vDistance;
  varying float vAngle;
  varying float vRandomSeed;
  varying float vStar;

  void main() {
    // Soft round point
    float d = distance(gl_PointCoord, vec2(0.5));
    float strength = 1.0 - smoothstep(0.0, 0.5, d);
    strength = pow(strength, 2.0);

    // ---------- Radial gradient: violet-white core -> blue mid -> deep cobalt outer ----------
    float rN = clamp(vDistance / uMaxRadius, 0.0, 1.0);
    float t1 = smoothstep(0.0, 0.18, rN);   // core -> mid
    float t2 = smoothstep(0.18, 0.85, rN);  // mid -> deep blue
    vec3 col = mix(uColorCore, uColorMid, t1);
    col = mix(col, uColorOuter, t2);

    // Subtle inner sheen at the core - keep tight so it doesn't bloom out
    float coreSheen = exp(-vDistance * 3.8) * uCoreGlow * 0.22;
    col += coreSheen * uColorCore;

    // ---------- Dust lanes (dark concentric / angular streaks) ----------
    float lane = 0.5 + 0.5 * sin(vAngle * 3.5 + vRandomSeed * 4.0 + vDistance * 1.2);
    lane = smoothstep(0.30, 0.95, lane);
    float dustMask = smoothstep(0.4, 3.0, vDistance) * smoothstep(uMaxRadius + 0.5, 2.5, vDistance);
    float dustAttenuation = 1.0 - uDustDensity * 0.7 * lane * dustMask;
    dustAttenuation = clamp(dustAttenuation, 0.18, 1.0);
    col *= dustAttenuation;

    // ---------- Subtle chromatic variation ----------
    col.b += vRandomSeed * 0.06;
    col.g += vRandomSeed * 0.02;

    // Atmospheric density falloff at rim
    float atm = smoothstep(uMaxRadius + 1.0, uMaxRadius * 0.5, vDistance);

    // ---------- Bright cyan accent star override ----------
    if (vStar > 0.5) {
      // Hot cyan-white star with crisp center
      float hot = pow(strength, 1.6);
      vec3 starCol = mix(uStarColor, vec3(1.0), pow(hot, 4.0));
      gl_FragColor = vec4(starCol, hot);
      #include <colorspace_fragment>
      return;
    }

    col *= uGradientIntensity;
    float alpha = strength * mix(0.55, 1.0, atm);

    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`

// ---------- Faint blue nebula haze ----------
export const nebulaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`

export const nebulaFragment = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform vec3  uColorInner;
  uniform vec3  uColorOuter;
  varying vec2 vUv;

  ${snoise3}

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * snoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c);
    float radial = smoothstep(0.45, 0.05, r);
    radial = pow(radial, 1.8);

    vec3 q = vec3(vUv * 2.4, uTime * 0.02);
    float n = fbm(q);

    vec3 col = mix(uColorInner, uColorOuter, smoothstep(0.0, 0.4, r));
    float density = smoothstep(0.1, 0.95, n * 0.7);
    float alpha = density * radial * uStrength * 0.25;

    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`
