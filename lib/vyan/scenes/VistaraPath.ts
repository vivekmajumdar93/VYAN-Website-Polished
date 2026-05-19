import * as THREE from 'three';

// Vistāra — the unfurling. 7 product orbs arranged in a golden-angle
// logarithmic spiral, descending into the void. The path is closed so
// scroll loops endlessly through the product constellation.

export type VistaraProductKey =
  | 'rtam' | 'ojas' | 'mudra' | 'netra' | 'akrti' | 'sutra' | 'placeholder';

export type VistaraProductDef = {
  key: VistaraProductKey;
  name: string;
  tagline: string;
  colorA: string;
  colorB: string;
  position: THREE.Vector3;
};

// Golden angle in radians (~137.508°) — the canonical spiral phyllotaxis.
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function spiralPos(i: number, total: number): THREE.Vector3 {
  const t = i / Math.max(1, total - 1);
  const angle = i * GOLDEN;
  // radius grows from 70 → 220; depth descends from 0 → -380
  const r = 70 + t * 150;
  const z = -t * 380;
  const y = Math.sin(i * 0.7) * 22; // gentle vertical undulation
  return new THREE.Vector3(
    Math.cos(angle) * r,
    y,
    Math.sin(angle) * r + z
  );
}

export const VISTARA_PRODUCTS: VistaraProductDef[] = [
  {
    key: 'rtam',
    name: 'VYAN ṚTAM',
    tagline: 'Conscious Living Through Pravāha',
    colorA: '#ffb84d',     // amber
    colorB: '#ff2a4a',
    position: spiralPos(0, 7),
  },
  {
    key: 'ojas',
    name: 'VYAN OJAS',
    tagline: 'Tracking Your Prāṇic Rhythm',
    colorA: '#22e0a4',     // emerald-teal
    colorB: '#ff2a4a',
    position: spiralPos(1, 7),
  },
  {
    key: 'mudra',
    name: 'VYAN MUDRĀ',
    tagline: 'The Kośa of Global Entities',
    colorA: '#e066ff',     // magenta-violet
    colorB: '#ff2a4a',
    position: spiralPos(2, 7),
  },
  {
    key: 'netra',
    name: 'VYAN NETRA',
    tagline: 'The Conscious Eye Across Tantras',
    colorA: '#3ad4ff',     // cyan
    colorB: '#ff2a4a',
    position: spiralPos(3, 7),
  },
  {
    key: 'akrti',
    name: 'VYAN ĀKṚTI',
    tagline: 'Creating Digital Anubhava Through Your Dṛṣṭi',
    colorA: '#ff6688',     // rose
    colorB: '#ff2a4a',
    position: spiralPos(4, 7),
  },
  {
    key: 'sutra',
    name: 'VYAN SŪTRA',
    tagline: 'Weaving Saṅgama Through Viveka',
    colorA: '#9a55ff',     // indigo-violet
    colorB: '#ff2a4a',
    position: spiralPos(5, 7),
  },
  {
    key: 'placeholder',
    name: 'VYAN ···',
    tagline: 'Awaiting Initiation',
    colorA: '#b8b8c8',     // silver-grey
    colorB: '#6a6a8a',
    position: spiralPos(6, 7),
  },
];

export class VistaraPath {
  public curve: THREE.CatmullRomCurve3;
  public orbCount = VISTARA_PRODUCTS.length;
  private static CAM_DIST = 26;

  constructor(products: VistaraProductDef[] = VISTARA_PRODUCTS) {
    // Every orb is approached at the SAME distance (z=26) and slight
    // elevation (y=3) — identical click-zone size to Shunya orbs.
    const cameraPts: THREE.Vector3[] = products.map((p) => {
      return p.position.clone().add(new THREE.Vector3(0, 3, 26));
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
