import * as THREE from 'three';

// 5 orbs of the Shunya Mandala (Layer 2). Order matters — it defines the path.
export type ShunyaOrbKey = 'udbhava' | 'vistara' | 'vyuha' | 'medha' | 'sandhi';

export type ShunyaOrbDef = {
  key: ShunyaOrbKey;
  name: string;          // shown in red
  tagline: string;       // shown in cosmic silver
  colorA: string;        // primary tint
  colorB: string;        // secondary tint
  position: THREE.Vector3;
};

export const SHUNYA_ORBS: ShunyaOrbDef[] = [
  {
    key: 'udbhava',
    name: 'UDBHAVA',
    tagline: 'Emergence · the first breath of being',
    colorA: '#7a5cff',
    colorB: '#ff2a4a',
    position: new THREE.Vector3(0, 0, 0),
  },
  {
    key: 'vistara',
    name: 'VISTĀRA',
    tagline: 'Expansion · the unfurling of products',
    colorA: '#3a90ff',
    colorB: '#ff2a4a',
    position: new THREE.Vector3(70, 24, -70),
  },
  {
    key: 'vyuha',
    name: 'VYŬHA',
    tagline: 'Architecture · the lattice of intent',
    colorA: '#9a55ff',
    colorB: '#ff3a3a',
    position: new THREE.Vector3(95, -22, -190),
  },
  {
    key: 'medha',
    name: 'MEDHĀ',
    tagline: 'Cognition · the mind that understands',
    colorA: '#22e0d4',
    colorB: '#ff2a4a',
    position: new THREE.Vector3(15, 40, -290),
  },
  {
    key: 'sandhi',
    name: 'SANDHI',
    tagline: 'Convergence · the seam between worlds',
    colorA: '#ff8a3a',
    colorB: '#ff2a4a',
    position: new THREE.Vector3(-90, 6, -170),
  },
];

// Camera follows a closed CatmullRom curve through 3D space, with each
// waypoint OFFSET from the corresponding orb so the orb is visible to one side
// of the camera as it flies past. Offset angle rotates per orb for variety.
export class PathCurve {
  public curve: THREE.CatmullRomCurve3;
  public lookAtCurve: THREE.CatmullRomCurve3;

  constructor(orbs: ShunyaOrbDef[] = SHUNYA_ORBS) {
    const cameraPts: THREE.Vector3[] = orbs.map((orb, i) => {
      const angle = (i / orbs.length) * Math.PI * 2;
      const offset = new THREE.Vector3(
        Math.cos(angle) * 22,
        Math.sin(angle * 0.7) * 8 + 4,
        Math.sin(angle) * 22
      );
      return orb.position.clone().add(offset);
    });

    // The lookAt path is simply the orb positions — we always look at orbs.
    const lookPts: THREE.Vector3[] = orbs.map(o => o.position.clone());

    this.curve = new THREE.CatmullRomCurve3(cameraPts, true, 'catmullrom', 0.5);
    this.lookAtCurve = new THREE.CatmullRomCurve3(lookPts, true, 'catmullrom', 0.5);
  }

  static wrap(v: number): number {
    return ((v % 1) + 1) % 1;
  }

  cameraAt(progress: number): THREE.Vector3 {
    return this.curve.getPointAt(PathCurve.wrap(progress));
  }

  lookAt(progress: number): THREE.Vector3 {
    // Look slightly AHEAD of the camera along the orb curve for cinematic feel.
    return this.lookAtCurve.getPointAt(PathCurve.wrap(progress + 0.02));
  }

  // Returns { index, focus }. focus is 0..1 where 1 = camera centered on that orb.
  nearestOrb(progress: number, orbCount: number): { index: number; focus: number } {
    const p = PathCurve.wrap(progress);
    const f = p * orbCount;
    const index = Math.round(f) % orbCount;
    // Distance to nearest integer slot (0 → exactly on, 0.5 → mid-way between)
    const dist = Math.min(Math.abs(f - index), Math.abs(f - index - orbCount), Math.abs(f - index + orbCount));
    // focus 0..1 across +- 0.45 around the slot
    const focus = THREE.MathUtils.clamp(1 - dist / 0.45, 0, 1);
    return { index, focus };
  }
}
