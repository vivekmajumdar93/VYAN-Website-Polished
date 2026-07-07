// Fracture mask vertex shader — fullscreen quad with sphere inversion

uniform float uTime;
uniform float uFractureProgress;
uniform float uPhase;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;

  vec3 pos = position;

  // Sphere inversion: space folds around camera — NOT camera moving
  // Applied when fracture is in progress (phase 4+)
  if (uFractureProgress > 0.0) {
    float invRadius = 2.5;
    float distSq = dot(pos, pos);
    if (distSq > 0.001) {
      // Sphere inversion: p' = r² * p / |p|²
      float f = uFractureProgress;
      vec3 inverted = invRadius * invRadius * pos / distSq;
      pos = mix(pos, inverted, f * 0.35);
    }
  }

  vWorldPos = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
