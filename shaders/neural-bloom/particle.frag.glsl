// Particle fragment shader — glowing soft dot

varying vec3 vColor;
varying float vAlpha;
varying float vGlow;

void main() {
  // Radial soft disc
  vec2 coord = gl_PointCoord - 0.5;
  float r = length(coord);
  if (r > 0.5) discard;

  // Soft falloff
  float core  = exp(-r * r * 28.0);
  float halo  = exp(-r * r * 8.0) * 0.55;
  float glow  = exp(-r * r * 2.5) * 0.25;
  float alpha = (core + halo + glow) * vAlpha;

  // Bright core + colored halo
  vec3 white = vec3(1.0);
  vec3 col   = mix(vColor, white, core * 0.7);
  col *= 1.0 + vGlow * 1.4; // HDR brightness for bloom

  gl_FragColor = vec4(col, alpha);
}
