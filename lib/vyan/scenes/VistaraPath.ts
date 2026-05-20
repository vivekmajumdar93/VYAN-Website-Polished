import * as THREE from 'three';

// Vist\u0101ra \u2014 the unfurling. 7 product orbs in a flat ring at IDENTICAL
// camera distance. Branding: official VYAN product names with diacritics.

export type VistaraProductKey =
  | 'ritam' | 'ojas' | 'mudra' | 'netra' | 'akriti' | 'sutra' | 'placeholder';

export type VistaraProductDef = {
  key: VistaraProductKey;
  name: string;
  tagline: string;
  colorA: string;
  colorB: string;
  position: THREE.Vector3;
};

const SILVER_A = '#b8b8c8';
const SILVER_B = '#6a6a8a';
const RING_RADIUS = 140;
const RING_Y_TILT = 28;

function ringPos(i: number, total: number): THREE.Vector3 {
  const angle = (i / total) * Math.PI * 2;
  const y = Math.sin(i * 1.13) * RING_Y_TILT;
  return new THREE.Vector3(Math.cos(angle) * RING_RADIUS, y, Math.sin(angle) * RING_RADIUS);
}

// Official VYAN product trademark names \u2014 use UTF-8 diacritics exactly as the
// user provided. Do NOT romanize/strip. Live brand surface.
export const VISTARA_PRODUCTS: VistaraProductDef[] = [
  { key: 'ritam',       name: 'VYAN \u1e5atam',   tagline: 'Conscious Living Through Prav\u0101ha',
    colorA: SILVER_A, colorB: SILVER_B, position: ringPos(0, 7) },
  { key: 'ojas',        name: 'VYAN Ojas',         tagline: 'Tracking Your Pr\u0101\u1e47ic Rhythm',
    colorA: SILVER_A, colorB: SILVER_B, position: ringPos(1, 7) },
  { key: 'mudra',       name: 'VYAN Mudr\u0101',   tagline: 'The Ko\u015ba of Global Entities',
    colorA: SILVER_A, colorB: SILVER_B, position: ringPos(2, 7) },
  { key: 'netra',       name: 'VYAN Netra',        tagline: 'The Conscious Eye Across Tantras',
    colorA: SILVER_A, colorB: SILVER_B, position: ringPos(3, 7) },
  { key: 'akriti',      name: 'VYAN \u0100k\u1e5bti', tagline: 'Creating Digital Anubhava Through Your D\u1e5b\u1e63\u1e6di',
    colorA: SILVER_A, colorB: SILVER_B, position: ringPos(4, 7) },
  { key: 'sutra',       name: 'VYAN S\u016btra',   tagline: 'Weaving Sa\u1e45gama Through Viveka',
    colorA: SILVER_A, colorB: SILVER_B, position: ringPos(5, 7) },
  { key: 'placeholder', name: 'VYAN \u00b7\u00b7\u00b7', tagline: 'Awaiting Initiation',
    colorA: SILVER_A, colorB: SILVER_B, position: ringPos(6, 7) },
];

export class VistaraPath {
  public curve: THREE.CatmullRomCurve3;
  public orbCount = VISTARA_PRODUCTS.length;

  constructor(products: VistaraProductDef[] = VISTARA_PRODUCTS) {
    const cameraPts: THREE.Vector3[] = products.map((p) => {
      const radial = p.position.clone().setY(0).normalize();
      return p.position.clone()
        .add(radial.multiplyScalar(26))
        .add(new THREE.Vector3(0, 3, 0));
    });
    this.curve = new THREE.CatmullRomCurve3(cameraPts, true, 'catmullrom', 0.5);
  }

  static wrap(v: number): number {
    return ((v % 1) + 1) % 1;
  }

  cameraAt(progress: number): THREE.Vector3 {
    return this.curve.getPointAt(VistaraPath.wrap(progress));
  }

  lookAt(progress: number): THREE.Vector3 {
    const p = VistaraPath.wrap(progress);
    const total = VISTARA_PRODUCTS.length;
    const f = p * total;
    const idx = Math.floor(f) % total;
    const frac = f - Math.floor(f);
    const ease = frac * frac * (3 - 2 * frac);
    const a = VISTARA_PRODUCTS[idx].position;
    const b = VISTARA_PRODUCTS[(idx + 1) % total].position;
    return new THREE.Vector3().lerpVectors(a, b, ease);
  }

  nearestOrb(progress: number, orbCount: number): { index: number; focus: number } {
    const p = VistaraPath.wrap(progress);
    const f = p * orbCount;
    const index = Math.round(f) % orbCount;
    const dist = Math.min(Math.abs(f - index), Math.abs(f - index - orbCount), Math.abs(f - index + orbCount));
    const focus = THREE.MathUtils.clamp(1 - dist / 0.45, 0, 1);
    return { index, focus };
  }
}
