import * as THREE from 'three';

// Vist\u0101ra \u2014 the unfurling. 7 product orbs arranged in a flat ring so every
// orb sits at IDENTICAL camera distance (no near/far variance). The "unfurling"
// expression comes from the arrival physics, not the resting layout.
//
// Branding: plain romanized titles (per user spec). No diacritic codepoints.

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

// All orbs share the silver/grey palette of the original placeholder \u2014 per user.
const SILVER_A = '#b8b8c8';
const SILVER_B = '#6a6a8a';

const RING_RADIUS = 140;
const RING_Y_TILT = 28; // small vertical wave so the ring doesn't look totally flat

function ringPos(i: number, total: number): THREE.Vector3 {
  const angle = (i / total) * Math.PI * 2;
  const y = Math.sin(i * 1.13) * RING_Y_TILT;
  return new THREE.Vector3(
    Math.cos(angle) * RING_RADIUS,
    y,
    Math.sin(angle) * RING_RADIUS,
  );
}

export const VISTARA_PRODUCTS: VistaraProductDef[] = [
  {
    key: 'ritam',
    name: 'VYAN RITAM',
    tagline: 'Conscious Living Through Prav\u0101ha',
    colorA: SILVER_A,
    colorB: SILVER_B,
    position: ringPos(0, 7),
  },
  {
    key: 'ojas',
    name: 'VYAN OJAS',
    tagline: 'Tracking Your Pr\u0101\u1e47ic Rhythm',
    colorA: SILVER_A,
    colorB: SILVER_B,
    position: ringPos(1, 7),
  },
  {
    key: 'mudra',
    name: 'VYAN MUDRA',
    tagline: 'The Ko\u015ba of Global Entities',
    colorA: SILVER_A,
    colorB: SILVER_B,
    position: ringPos(2, 7),
  },
  {
    key: 'netra',
    name: 'VYAN NETRA',
    tagline: 'The Conscious Eye Across Tantras',
    colorA: SILVER_A,
    colorB: SILVER_B,
    position: ringPos(3, 7),
  },
  {
    key: 'akriti',
    name: 'VYAN AKRITI',
    tagline: 'Creating Digital Anubhava Through Your D\u1e5b\u1e63\u1e6di',
    colorA: SILVER_A,
    colorB: SILVER_B,
    position: ringPos(4, 7),
  },
  {
    key: 'sutra',
    name: 'VYAN SUTRA',
    tagline: 'Weaving Sa\u1e45gama Through Viveka',
    colorA: SILVER_A,
    colorB: SILVER_B,
    position: ringPos(5, 7),
  },
  {
    key: 'placeholder',
    name: 'VYAN \u00b7\u00b7\u00b7',
    tagline: 'Awaiting Initiation',
    colorA: SILVER_A,
    colorB: SILVER_B,
    position: ringPos(6, 7),
  },
];

export class VistaraPath {
  public curve: THREE.CatmullRomCurve3;
  public orbCount = VISTARA_PRODUCTS.length;

  constructor(products: VistaraProductDef[] = VISTARA_PRODUCTS) {
    // Camera waypoint = orb home + (0, 3, 26). Identical distance to Shunya.
    const cameraPts: THREE.Vector3[] = products.map((p) => {
      // Offset OUTWARD from ring centre (not just +z) so camera is always
      // on the OUTSIDE of the ring looking inward. This guarantees equal
      // visual distance from camera to its target orb.
      const radial = p.position.clone().setY(0).normalize();
      return p.position.clone()
        .add(radial.multiplyScalar(26))   // outward from ring centre
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
    const dist = Math.min(
      Math.abs(f - index),
      Math.abs(f - index - orbCount),
      Math.abs(f - index + orbCount)
    );
    const focus = THREE.MathUtils.clamp(1 - dist / 0.45, 0, 1);
    return { index, focus };
  }
}
