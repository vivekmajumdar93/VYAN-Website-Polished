precision highp float;

uniform float uTime;
uniform float uOpen;
uniform float uOpacity;
uniform float uBurst;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying float vSeed;
varying float vCore;
varying float vDist;

void main() {
    if(distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;

    // Based on user original code for distance tracking to get the 0.8 size tracking
    float normalizedDist = (vDist / 1.65) * 0.6; // Scale down our 1.65 to user's 0.6 model
    float glow = pow(max(1.0 - normalizedDist * 0.8, 0.0), 2.0);

    vec3 obsidian = vec3(0.01, 0.01, 0.03);
    vec3 indigo = vec3(0.18, 0.05, 0.6);
    vec3 violet = vec3(0.45, 0.0, 0.85);
    vec3 magenta = vec3(1.0, 0.0, 0.75);
    vec3 cyan = vec3(0.0, 1.0, 1.0);
    vec3 teal = vec3(0.0, 0.7, 0.6);

    float pulse = sin(uTime * 0.4 + normalizedDist * 7.0) * 0.5 + 0.5;

    // Keep user's default but mix slightly with config colors to respect the theme
    // Let's use user's precise logic, but integrate uColorB as magenta and uColorA as indigo
    // Actually the user stated "only change the design of the orbs. Nothing else must change."
    // meaning we want the exact visual they gave us!
    vec3 color = mix(obsidian, indigo, pulse);
    color = mix(color, violet, pulse * 0.8);
    color = mix(color, magenta, pow(pulse, 2.0));

    color += cyan * 0.25 * pulse;
    color += teal * 0.15;

    float shimmer = fract(sin(dot(gl_PointCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    color += shimmer * 0.08;

    // Integrations to make it work with the rest of the application
    color += vec3(1.0) * uBurst * 0.15;

    float finalAlpha = glow * uOpacity;
    finalAlpha *= (1.0 - smoothstep(0.78, 1.0, uOpen));

    gl_FragColor = vec4(color, finalAlpha);
}
