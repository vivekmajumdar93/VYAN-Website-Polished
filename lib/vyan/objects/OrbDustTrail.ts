import * as THREE from 'three';

export class OrbDustTrail {
  public group = new THREE.Group();

  private points: THREE.Points;
  private history: THREE.Vector3[];
  private positions: Float32Array;
  private ages: Float32Array;
  private seeds: Float32Array;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;

  constructor(color = '#a066ff', length = 44) {
    this.history = Array.from({ length }, () => new THREE.Vector3());
    this.positions = new Float32Array(length * 3);
    this.ages = new Float32Array(length);
    this.seeds = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      this.ages[i] = i / Math.max(1, length - 1);
      this.seeds[i] = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aAge', new THREE.BufferAttribute(this.ages, 1));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0.12 },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float aAge;
        attribute float aSeed;
        uniform float uTime;
        varying float vAge;
        varying float vSeed;
        void main() {
          vAge = aAge;
          vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float size = (2.3 - vAge * 1.85) + sin(uTime * 2.0 + aSeed * 11.0) * 0.18;
          gl_PointSize = size * (190.0 / max(-mv.z, 0.001));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAge;
        varying float vSeed;

        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);

          float core = smoothstep(0.48, 0.0, d);
          float rays = pow(max(0.0, 1.0 - abs(uv.x) * 7.0), 7.5)
                     + pow(max(0.0, 1.0 - abs(uv.y) * 7.0), 7.5);
          float sparkle = core * 0.78 + rays * 0.12;

          float fade = pow(1.0 - vAge, 2.15);
          float twinkle = 0.72 + 0.28 * sin(vSeed * 37.0 + vAge * 9.0);

          vec3 col = mix(uColor, vec3(0.98, 0.94, 1.0), core * 0.22 + rays * 0.05);
          float alpha = sparkle * fade * uOpacity * twinkle;

          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  reset(position: THREE.Vector3) {
    for (let i = 0; i < this.history.length; i++) {
      this.history[i].copy(position);
    }
    this.syncPositions(position, 0, 0);
  }

  update(position: THREE.Vector3, intensity = 1, opacityBoost = 1, t = 0) {
    this.history.pop();
    this.history.unshift(position.clone());

    for (let i = 0; i < this.history.length; i++) {
      const i3 = i * 3;
      const p = this.history[i];
      const age = this.ages[i];
      const fall = 1.0 - age;

      const swirlX = Math.sin(t * 1.7 + i * 0.61) * 0.03 * fall;
      const swirlY = Math.cos(t * 1.3 + i * 0.43) * 0.025 * fall;
      const swirlZ = Math.sin(t * 1.1 + i * 0.29) * 0.02 * fall;

      this.positions[i3 + 0] = p.x + swirlX;
      this.positions[i3 + 1] = p.y + swirlY;
      this.positions[i3 + 2] = p.z + swirlZ;
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    const matUniforms = this.material.uniforms as any;
    matUniforms.uOpacity.value = 0.018 + intensity * 0.16 * opacityBoost;
    matUniforms.uTime.value = t;
  }

  private syncPositions(position: THREE.Vector3, intensity: number, opacityBoost: number) {
    for (let i = 0; i < this.history.length; i++) {
      const i3 = i * 3;
      this.positions[i3 + 0] = position.x;
      this.positions[i3 + 1] = position.y;
      this.positions[i3 + 2] = position.z;
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.material.uniforms as any).uOpacity.value = 0.018 + intensity * 0.16 * opacityBoost;
  }
}
