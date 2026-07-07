// Neural link fragment — electric blue with traveling synaptic pulse

uniform float uTime;

varying float vUx;
varying float vAge;
varying float vPulsePhase;
varying float vAlpha;

void main() {
  // Base electric blue at 40% opacity
  vec3 linkColor = vec3(0.176, 0.435, 1.000); // #2d6fff

  // Traveling synaptic pulse: bright violet-white wave moving along link
  float pulseSpeed = 0.8;
  float pulsePos   = mod(uTime * pulseSpeed + vPulsePhase, 1.0);
  float pulseBright = exp(-pow(vUx - pulsePos, 2.0) * 80.0);

  // Node glow: radial brightness at link endpoints
  float nodeStart = exp(-vUx * vUx * 180.0);
  float nodeEnd   = exp(-(1.0 - vUx) * (1.0 - vUx) * 180.0);
  float nodeGlow  = (nodeStart + nodeEnd) * 0.65;

  // Compose
  vec3 pulseColor = vec3(0.86, 0.78, 1.00); // white-violet pulse
  vec3 col = linkColor + pulseColor * pulseBright * 2.8 + linkColor * nodeGlow;

  // HDR intensity for bloom pickup
  col *= 1.6;

  float alpha = vAlpha * 0.4; // base 40% for link body
  alpha = mix(alpha, alpha + pulseBright * 0.55, pulseBright);

  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}
