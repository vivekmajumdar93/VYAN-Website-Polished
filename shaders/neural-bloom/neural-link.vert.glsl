// Neural link vertex shader — tube with tapered thickness along length

attribute vec3 aStart;
attribute vec3 aEnd;
attribute float aAge;      // 0–1
attribute float aLifetime;
attribute float aPhaseOffset;
attribute float aNormalSeed; // random for tube orientation

varying float vUx;        // position along link (0 = start, 1 = end)
varying float vAge;
varying float vPulsePhase;
varying float vAlpha;

void main() {
  vUx = position.x; // geometry UV x: 0..1 along tube
  vAge = aAge;
  vPulsePhase = aPhaseOffset;

  // Interpolate between start and end along link axis
  vec3 linkPos = mix(aStart, aEnd, vUx);
  vec3 linkDir = normalize(aEnd - aStart);

  // Build tube cross-section perpendicular to link direction
  vec3 up = abs(linkDir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right  = normalize(cross(linkDir, up));
  vec3 perpUp = cross(right, linkDir);

  // Tube radius: taper at ends, thicker in middle
  float taper = sin(vUx * 3.14159);
  float thickness = mix(0.003, 0.014, taper) * (1.0 + aNormalSeed * 0.3);

  // Cross-section offset using position.y (ring angle encoded) and position.z
  float angle = position.y * 6.2832;
  vec3 offset = (cos(angle) * right + sin(angle) * perpUp) * thickness;

  // Fade in/fade out alpha
  float lifetime = max(aLifetime, 0.001);
  float fadeIn   = clamp(aAge / 0.04, 0.0, 1.0);
  float fadeOut  = clamp((lifetime - aAge) / 0.06, 0.0, 1.0);
  vAlpha = min(fadeIn, fadeOut);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(linkPos + offset, 1.0);
}
