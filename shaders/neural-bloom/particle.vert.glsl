// Particle vertex shader — reads GPU-computed positions via texture

uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform float uTime;
uniform float uPhase;
uniform float uResolution; // GPU texture size
uniform vec3 uOrbPosition;

attribute vec2 aParticleUv;  // each instance's UV into the GPU texture

varying vec3 vColor;
varying float vAlpha;
varying float vGlow;

void main() {
  // Sample GPU position and velocity
  vec4 posData = texture2D(uPositionTexture, aParticleUv);
  vec4 velData = texture2D(uVelocityTexture, aParticleUv);
  vec3 pos = posData.xyz;
  float life = posData.w;
  vec3 vel  = velData.xyz;

  // Color: violet to blue by speed
  float speed = length(vel);
  float t = clamp(speed / 4.0, 0.0, 1.0);
  vec3 violet = vec3(0.482, 0.184, 1.000);
  vec3 blue   = vec3(0.176, 0.435, 1.000);
  vec3 gold   = vec3(0.831, 0.659, 0.325);

  // Phase 6: particles turn gold as they arrive
  float goldness = clamp((uPhase - 5.5) * 2.0, 0.0, 1.0);
  vColor = mix(mix(violet, blue, t), gold, goldness);

  // Stretch along velocity direction
  float stretch = clamp(speed * 0.15, 0.0, 1.8);
  vec3 stretchDir = speed > 0.01 ? normalize(vel) : vec3(0.0, 1.0, 0.0);
  vec3 stretchedPos = pos + stretchDir * stretch * position.y;

  // Life-based alpha with spawn fade-in
  float lifeFade = life < 0.05
    ? life / 0.05
    : life > 0.9
      ? 1.0 - (life - 0.9) / 0.1
      : 1.0;
  float phaseFade = clamp(uPhase - 0.5, 0.0, 1.0);
  vAlpha = lifeFade * phaseFade;

  // Glow intensity
  vGlow = mix(0.4, 1.0, clamp(speed / 3.0, 0.0, 1.0));

  // Point size: larger near orb
  float distToOrb = length(pos - uOrbPosition);
  float nearOrb   = clamp(1.0 - distToOrb / 2.5, 0.0, 1.0);
  gl_PointSize = mix(1.5, 5.0, nearOrb * vGlow);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(stretchedPos, 1.0);
}
