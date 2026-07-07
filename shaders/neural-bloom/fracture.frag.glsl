// Fracture fragment — Voronoi cracks with rotating petals, deep indigo void

uniform float uTime;
uniform float uFractureProgress;
uniform float uPhase;
uniform vec2 uResolution;
uniform vec3 uOrbUv; // orb position in UV space (0-1)

varying vec2 vUv;

// Voronoi: returns (dist to nearest, dist to 2nd nearest, cell id)
vec3 voronoi(vec2 p, float time) {
  vec2 n = floor(p);
  vec2 f = fract(p);

  float md1 = 8.0, md2 = 8.0;
  vec2 mr;
  float cellId = 0.0;

  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + 0.5 * sin(time * 0.12 + 6.2832 * fract(
        sin(vec2(dot(n+g, vec2(127.1, 311.7)),
                 dot(n+g, vec2(269.5, 183.3)))) * 43758.5453
      ));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md1) {
        md2 = md1;
        md1 = d;
        mr = r;
        cellId = fract(sin(dot(n+g, vec2(127.1, 311.7))) * 43758.5453);
      } else if (d < md2) {
        md2 = d;
      }
    }
  }
  return vec3(sqrt(md1), sqrt(md2), cellId);
}

void main() {
  float fp = uFractureProgress;
  if (fp < 0.001) discard;

  // Voronoi crack field centered on orb UV
  vec2 orbUv   = uOrbUv.xy;
  vec2 fromOrb = vUv - orbUv;
  float dist   = length(fromOrb);

  // Scale voronoi around orb
  float vScale = 5.0 + uPhase * 0.5;
  vec3 vor = voronoi(vUv * vScale, uTime);

  // Crack edges: where Voronoi cell borders are
  float edge   = vor.y - vor.x;
  float crack  = 1.0 - smoothstep(0.0, 0.08, edge);

  // Cracks grow from orb outward over time
  float growDist = fp * 1.8; // max fracture reach
  float inRange  = smoothstep(growDist - 0.1, growDist + 0.3, dist);
  crack *= 1.0 - inRange;

  // Per-petal rotation (each Voronoi cell rotates independently)
  float cellAngle  = vor.z * 6.2832;
  float angularVel = 0.3 + vor.z * 0.9; // 0.3–1.2 rad/s
  float rotation   = uTime * angularVel * fp;
  vec2 rotatedUv   = vUv - orbUv;
  float c = cos(rotation), s = sin(rotation);
  // Apply per-cell rotation offset to add visual motion
  float petalDisplace = sin(cellAngle + rotation) * 0.04 * fp;

  // Void color: deep indigo #1a0a3d
  vec3 voidColor = vec3(0.102, 0.039, 0.239);

  // Crack edge glow: white-violet
  vec3 edgeColor = vec3(0.863, 0.784, 1.000);

  // Fracture reveal: show void behind cracks
  float reveal = crack * fp;
  vec3 col = voidColor * reveal;

  // Edge glow
  float edgeGlow = crack * smoothstep(0.0, 0.04, edge) * (1.0 - smoothstep(0.04, 0.12, edge));
  col += edgeColor * edgeGlow * 3.5 * fp;

  // HDR
  float alpha = reveal + edgeGlow * 2.0;
  alpha = clamp(alpha, 0.0, 1.0);
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(col, alpha * fp);
}
