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
    tagline: 'The Emergence of VYAN',
    colorA: '#7a5cff',
    colorB: '#ff2a4a',
    position: new THREE.Vector3(0, 0, 0),
  },
  {
    key: 'vistara',
    name: 'VISTĀRA',
    tagline: 'The Manifestations of VYAN',
    colorA: '#3a90ff',
    colorB: '#ff2a4a',
    position: new THREE.Vector3(120, 30, -90),
  },
  {
    key: 'vyuha',
    name: 'VYŬHA',
    tagline: 'The Continuum of VYAN',
    colorA: '#9a55ff',
    colorB: '#ff3a3a',
    position: new THREE.Vector3(160, -30, -240),
  },
  {
    key: 'medha',
    name: 'MEDHĀ',
    tagline: 'The Consciousness of VYAN',
    colorA: '#22e0d4',
    colorB: '#ff2a4a',
    position: new THREE.Vector3(30, 50, -360),
  },
  {
    key: 'sandhi',
    name: 'SANDHI',
    tagline: 'The Communiqué of VYAN',
    colorA: '#ff8a3a',
    colorB: '#ff2a4a',
    position: new THREE.Vector3(-120, 10, -220),
  },
];

// Camera path — each waypoint sits ~26 units OUT from its corresponding orb, exactly
// matching the Vyōma gateway's closest-approach distance (z=26). This makes Shunya
// orbs appear at the same on-screen size and behave the same as the gateway orb.
export class PathCurve {
  public curve: THREE.CatmullRomCurve3;
  public orbCount = SHUNYA_ORBS.length;
  private static CAM_DIST = 26;

  constructor(orbs: ShunyaOrbDef[] = SHUNYA_ORBS) {
    // UNIFORM camera offset: every orb is approached front-on at the SAME
    // distance (z=26) and SAME slight elevation (y=3). This makes the click
    // zone identical for every orb — Udbhava, Vistāra, Vyūha, Medhā, Sandhi
    // all sit dead-centre at the same on-screen size.
    const cameraPts: THREE.Vector3[] = orbs.map((orb) => {
      return orb.position.clone().add(new THREE.Vector3(0, 3, 26));
    });
    this.curve = new THREE.CatmullRomCurve3(cameraPts, true, 'catmullrom', 0.5);
  }

  static wrap(v: number): number {
    return ((v % 1) + 1) % 1;
  }

  cameraAt(progress: number): THREE.Vector3 {
    return this.curve.getPointAt(PathCurve.wrap(progress));
  }

  // The look-at target follows the actual focused orb's HOME position, smoothly
  // lerped between adjacent orbs as we travel — keeps the orb dead-centre in view.
  lookAt(progress: number, orbInstances?: Array<{ position: THREE.Vector3 }>): THREE.Vector3 {
    const p = PathCurve.wrap(progress);
    const total = SHUNYA_ORBS.length;
    const f = p * total;
    const idx = Math.floor(f) % total;
    const frac = f - Math.floor(f);
    const ease = frac * frac * (3 - 2 * frac);
    const a = orbInstances ? orbInstances[idx].position : SHUNYA_ORBS[idx].position;
    const b = orbInstances ? orbInstances[(idx + 1) % total].position : SHUNYA_ORBS[(idx + 1) % total].position;
    return new THREE.Vector3().lerpVectors(a, b, ease);
  }

  // Returns { index, focus }. focus is 0..1 where 1 = camera centred on that orb.
  nearestOrb(progress: number, orbCount: number): { index: number; focus: number } {
    const p = PathCurve.wrap(progress);
    const f = p * orbCount;
    const index = Math.round(f) % orbCount;
    const dist = Math.min(Math.abs(f - index), Math.abs(f - index - orbCount), Math.abs(f - index + orbCount));
    const focus = THREE.MathUtils.clamp(1 - dist / 0.45, 0, 1);
    return { index, focus };
  }
}
