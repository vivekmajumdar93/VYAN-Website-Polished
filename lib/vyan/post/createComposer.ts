import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { QualityManager } from '../app/QualityManager';
import { VolumetricFogPass } from './VolumetricFogPass';

const chromatic = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.00028 },
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
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 off = vec2(uAmount, 0.0);
      float r = texture2D(tDiffuse, vUv + off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - off).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export type ComposerBundle = {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  chroma: ShaderPass;
  fog: VolumetricFogPass;
};

export function createComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  quality: QualityManager
): ComposerBundle {
  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    quality.preset.bloomStrength,
    quality.preset.bloomRadius,
    0.82
  );
  composer.addPass(bloom);

  const fog = new VolumetricFogPass();
  fog.setResolution(window.innerWidth, window.innerHeight);
  fog.setDensity(quality.preset.fogDensity);
  composer.addPass(fog.pass);

  const chroma = new ShaderPass(chromatic as any);
  composer.addPass(chroma);

  return { composer, bloom, chroma, fog };
}
