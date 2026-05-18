import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

const FogShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uDensity: { value: 0.009 },
    uVelocity: { value: 0.0 },
    uTint: { value: new THREE.Color(0x8b46ff) },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uProgress;
    uniform float uDensity;
    uniform float uVelocity;
    uniform vec3 uTint;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec2 uv = vUv;
      vec4 base = texture2D(tDiffuse, uv);

      vec2 p = uv - 0.5;
      p.x *= uResolution.x / uResolution.y;

      float r = length(p);

      float n = noise(uv * 3.2 + uTime * 0.03);
      n += noise(uv * 7.1 - uTime * 0.012) * 0.45;

      float fog = smoothstep(1.08, 0.08, r);
      fog *= (0.2 + n * 0.8);
      fog *= uDensity * 4.0;
      fog *= 0.95 + uVelocity * 0.05;
      fog *= 0.74 + (1.0 - uProgress) * 0.2;

      vec3 col = mix(base.rgb, base.rgb + uTint * 0.06, fog);
      col += uTint * fog * 0.018;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class VolumetricFogPass {
  public pass: ShaderPass;

  constructor() {
    this.pass = new ShaderPass(FogShader as any);
  }

  setResolution(w: number, h: number) {
    (this.pass.uniforms as any).uResolution.value.set(w, h);
  }

  setTime(v: number) {
    (this.pass.uniforms as any).uTime.value = v;
  }

  setProgress(v: number) {
    (this.pass.uniforms as any).uProgress.value = v;
  }

  setDensity(v: number) {
    (this.pass.uniforms as any).uDensity.value = v;
  }

  setVelocity(v: number) {
    (this.pass.uniforms as any).uVelocity.value = v;
  }
}
