// Fractal Brownian Motion — octave-stacked simplex noise

float fbm3(vec3 p, int octaves, float persistence, float lacunarity) {
  float value     = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxAmp    = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value    += amplitude * snoise(p * frequency);
    maxAmp   += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / maxAmp;
}

float fbm2(vec2 p, int octaves, float persistence, float lacunarity) {
  float value     = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxAmp    = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value    += amplitude * snoise2(p * frequency);
    maxAmp   += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / maxAmp;
}

// Domain-warped fbm for organic patterns
float fbmWarped(vec3 p, float t) {
  vec3 q = vec3(
    fbm3(p + vec3(0.0, 0.0, t * 0.1), 4, 0.5, 2.0),
    fbm3(p + vec3(5.2, 1.3, 2.8),     4, 0.5, 2.0),
    fbm3(p + vec3(-3.1, 8.7, -1.4),   4, 0.5, 2.0)
  );
  return fbm3(p + 1.5 * q + vec3(1.7, 9.2, t * 0.05), 4, 0.5, 2.0);
}
