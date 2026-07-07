// GPU Computation: particle position update
// Reads velocity texture, integrates position

uniform sampler2D textureVelocity;
uniform float uDelta;
uniform float uPhase;
uniform float uElapsed;
uniform vec3 uOrbPosition;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);

  float life = pos.w;

  // Integrate position
  vec3 newPos = pos.xyz + vel.xyz * uDelta;

  // During phase 4+ (fracture/passage), warp space
  float phaseF = uPhase;
  if (phaseF >= 4.0) {
    float warp = (phaseF - 4.0) / 2.0;
    float dist = length(newPos - uOrbPosition);
    float sphereInv = warp * 0.15 / max(dist * dist, 0.01);
    newPos += normalize(uOrbPosition - newPos) * sphereInv;
  }

  // Update life: particles age based on phase
  float agingRate = mix(0.1, 0.4, clamp((uPhase - 1.0) / 6.0, 0.0, 1.0));
  life = clamp(life + uDelta * agingRate, 0.0, 1.0);

  // Respawn dead particles from a sphere around the scene
  if (life >= 1.0) {
    // Respawn at random position in a large sphere
    float seed = uv.x * 1723.0 + uv.y * 3491.0 + uElapsed * 137.0;
    float theta = mod(seed * 0.1731, 6.2832);
    float phi   = mod(seed * 0.0973, 3.1416);
    float r     = 4.0 + mod(seed * 0.0412, 3.0);
    newPos = vec3(
      r * sin(phi) * cos(theta),
      r * sin(phi) * sin(theta),
      r * cos(phi)
    );
    life = 0.0;
  }

  gl_FragColor = vec4(newPos, life);
}
