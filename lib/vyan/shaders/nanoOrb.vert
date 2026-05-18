attribute float aSeed;
attribute float aCore;

uniform float uTime;
uniform float uOpen;
uniform float uActive;
uniform float uEnergy;
uniform float uBurst;
uniform float uPointScale;

varying float vSeed;
varying float vCore;
varying float vDist;

void main() {
  vec3 p = position;
  float noise = sin(p.y * 2.0 + uTime + aSeed) * 0.15;
  
  // Use exact radius scale user intended but normalized for our size
  p += normalize(p + vec3(0.0001)) * noise;
  p *= 1.0 + sin(uTime * 0.5 + aSeed) * 0.1;

  // Plus our application's animation features
  p += normalize(p + vec3(0.0001)) * (uBurst * (0.025 + clamp(aCore, 0.0, 1.0) * 0.03));
  p += normalize(p + vec3(0.0001)) * (uOpen * 0.05);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.001);

  // User logic: gl_PointSize = (8.0 * aRandom) * (1.0 / -mv.z);
  // Adjusted for our larger Z depth and bigger sphere:
  gl_PointSize = (80.0 * aSeed) * (1.0 / dist) * uPointScale * (1.0 + uOpen * 0.5 + uEnergy * 0.2);

  gl_Position = projectionMatrix * mv;

  vSeed = aSeed;
  vCore = clamp(aCore, 0.0, 1.0);
  vDist = length(p);
}
