export const galaxyVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;

  attribute float aScale;
  attribute vec3 aRandomness;

  varying vec3 vColor;
  varying float vDistance;

  void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    // Rotate each particle around Y axis based on its distance to center
    float angle = atan(modelPosition.x, modelPosition.z);
    float distanceToCenter = length(modelPosition.xz);
    float angleOffset = (1.0 / (distanceToCenter + 0.1)) * uTime * 0.12;
    angle += angleOffset;
    modelPosition.x = cos(angle) * distanceToCenter;
    modelPosition.z = sin(angle) * distanceToCenter;

    // Add randomness
    modelPosition.xyz += aRandomness;

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;

    gl_PointSize = uSize * aScale;
    gl_PointSize *= (1.0 / -viewPosition.z);

    vColor = color;
    vDistance = distanceToCenter;
  }
`

export const galaxyFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vDistance;

  void main() {
    // Disc-shape point with soft edge
    float dist = distance(gl_PointCoord, vec2(0.5));
    float strength = 1.0 - smoothstep(0.0, 0.5, dist);
    strength = pow(strength, 2.2);

    // Slight brightness boost for inner particles
    float coreBoost = smoothstep(4.0, 0.0, vDistance);
    vec3 color = mix(vColor, vec3(1.0), coreBoost * 0.35);
    color *= strength;

    gl_FragColor = vec4(color, strength);
    #include <colorspace_fragment>
  }
`
