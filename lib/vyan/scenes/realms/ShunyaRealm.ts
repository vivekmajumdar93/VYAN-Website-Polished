import * as THREE from 'three';
import { NanoOrb } from '../../objects/NanoOrb';
import { PathCurve, SHUNYA_ORBS, ShunyaOrbDef, ShunyaOrbKey } from '../PathCurve';

type BindDeps = {
  interaction: any;
  camera: THREE.PerspectiveCamera;
  cameraRig?: any;
  overlay: any;
  scroll: any;
  onOrbActivate?: (key: ShunyaOrbKey) => void;
};

export class ShunyaRealm {
  public group = new THREE.Group();
  public id = 'shunya';

  public orbs: NanoOrb[] = [];
  public defs: ShunyaOrbDef[] = SHUNYA_ORBS;
  public path = new PathCurve(SHUNYA_ORBS);

  public activeIndex = 0;
  public activeFocus = 0;
  public magnifiedIdx: number | null = null;       // current orb showing slab (locks camera)

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private deps!: BindDeps;
  private starfield!: THREE.Points;
  private nebula!: THREE.Points;

  constructor() {
    // 5 orbs at native NanoOrb scale (radius 1.9 — EXACTLY like the Vyōma gateway orb).
    // No wrapper magnification — we just place them at their world positions.
    for (const def of this.defs) {
      const orb = new NanoOrb(
        {
          id: def.key,
          title: def.name,
          subtitle: def.tagline,
          description: def.tagline,
          colorA: def.colorA,
          colorB: def.colorB,
        },
        1.9,    // matches Vyōma gateway core
        3000,   // matches Vyōma gateway core
      );
      orb.setHomePosition(def.position);
      this.group.add(orb.group);
      this.group.add(orb.trailGroup);
      this.orbs.push(orb);
    }

    this.starfield = this.buildStarfield(7000, 600);
    this.group.add(this.starfield);
    this.nebula = this.buildNebula(2200);
    this.group.add(this.nebula);

    this.group.visible = false;
  }

  bind(deps: BindDeps) {
    this.deps = deps;
  }

  // Expose focused orb live world position so CameraRig can lock onto it.
  getFocusedWorldPosition(): THREE.Vector3 {
    const idx = this.activeIndex;
    return this.orbs[idx]?.group.position.clone() ?? new THREE.Vector3();
  }

  onEnter() {
    this.group.visible = true;
    for (const o of this.orbs) {
      o.setVisible(true);
      o.reset();
      (o as any).magnifyFactor = 1.0;
    }
    if (this.deps?.cameraRig) this.deps.cameraRig.locked = false;
    this.deps?.overlay?.setVoidMode?.(true);
    this.deps?.overlay?.fadeFromBlack?.(1.6);
    if (this.deps?.scroll?.reset) this.deps.scroll.reset(0);
    this.magnifiedIdx = null;
  }

  onExit() {
    this.group.visible = false;
    for (const o of this.orbs) o.setVisible(false);
  }

  focusOrb(key: ShunyaOrbKey, immediate = false) {
    const idx = this.defs.findIndex(d => d.key === key);
    if (idx < 0) return;
    const total = this.defs.length;
    if (this.deps?.scroll) {
      if (immediate && this.deps.scroll.reset) {
        this.deps.scroll.reset(idx / total);
      } else {
        const cycle = Math.floor(this.deps.scroll.target);
        this.deps.scroll.target = cycle + idx / total;
      }
    }
  }

  // Triggered when user clicks a focused orb. Magnifies orb, then opens slab.
  activateFocused() {
    if (this.magnifiedIdx !== null) return;
    const idx = this.activeIndex;
    const orb = this.orbs[idx];
    const def = this.defs[idx];
    this.magnifiedIdx = idx;
    if (this.deps?.scroll?.freeze) this.deps.scroll.freeze();
    orb.magnify(2.6, 0.55);
    setTimeout(() => {
      this.deps?.overlay?.openPanel?.({
        title: def.name,
        subtitle: def.tagline,
        description: this.getSlabBody(def.key),
      }, undefined);
      this.deps?.onOrbActivate?.(def.key);
    }, 480);
  }

  // Triggered when slab close button fires.
  closePanel() {
    if (this.magnifiedIdx === null) return;
    const orb = this.orbs[this.magnifiedIdx];
    this.deps?.overlay?.closePanel?.();
    orb.contract(0.55);
    setTimeout(() => {
      this.magnifiedIdx = null;
      if (this.deps?.scroll?.setEnabled) this.deps.scroll.setEnabled(true);
    }, 580);
  }

  private getSlabBody(key: ShunyaOrbKey): string {
    const bodies: Record<ShunyaOrbKey, string> = {
      udbhava: 'Emergence is the first breath of being — the moment cognition condenses from the void into form. VYAN begins here, where intention becomes architecture.',
      vistara: 'Vistāra is the unfurling — the lattice of products that radiate outward from the core. Tap to dive into the product void.',
      vyuha:   'Vyūha is the design discipline — the lattice of intent, the geometry of decision. Every product passes through this seam.',
      medha:   'Medhā is the cognition that understands. Multiple minds, one resonance. Tap to enter Medhā.',
      sandhi:  'Sandhi is the convergence — where voids meet, where transitions resolve into one continuous breath.',
    };
    return bodies[key];
  }

  update(_dt: number, t: number, progress: number, audio: any) {
    if (!this.deps) return;

    const total = this.defs.length;

    // While magnified, freeze active index; do NOT consume scroll.
    if (this.magnifiedIdx === null) {
      const swipe = this.deps.interaction.swipeDir;
      if (swipe !== 0) {
        const cycle = Math.floor(this.deps.scroll.target);
        const baseFrac = this.deps.scroll.target - cycle;
        const baseIdx = Math.round(baseFrac * total);
        const nextIdx = baseIdx + swipe;
        this.deps.scroll.target = cycle + (nextIdx / total);
        this.deps.interaction.swipeDir = 0;
      }

      const { index, focus } = this.path.nearestOrb(progress, total);
      this.activeIndex = index;
      this.activeFocus = focus;
    }

    const energy = audio?.energy ?? 0;
    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      const isMag = this.magnifiedIdx === i;
      const focusForOrb = isMag ? 1 : (i === this.activeIndex ? this.activeFocus : 0);
      const motion = isMag ? 0.9 : 0.45 + focusForOrb * 1.4;
      orb.update(t, energy, focusForOrb > 0.5, false, focusForOrb, motion);
    }

    this.starfield.rotation.y += 0.00015 + Math.abs(this.deps.scroll.speed) * 0.0009;
    this.nebula.rotation.y -= 0.0001;

    const def = this.defs[this.activeIndex];
    this.deps.overlay?.setShunyaCaption?.(def.name, def.tagline, this.magnifiedIdx !== null ? 1 : this.activeFocus);
    this.deps.overlay?.setShunyaRail?.(this.activeIndex, this.magnifiedIdx !== null ? 1 : this.activeFocus, total);

    if (this.magnifiedIdx === null && this.deps.interaction.clicked && this.activeFocus > 0.55) {
      this.ndc.set(this.deps.interaction.pointer.x, this.deps.interaction.pointer.y);
      this.raycaster.setFromCamera(this.ndc, this.deps.camera);
      const focused = this.orbs[this.activeIndex];
      const hit = this.raycaster.intersectObject(focused.hitMesh, true);
      const centered = Math.abs(this.ndc.x) < 0.34 && Math.abs(this.ndc.y) < 0.24;
      if (hit.length > 0 || centered) {
        this.activateFocused();
      }
    }
  }

  private buildStarfield(count: number, radius: number) {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    const col: number[] = [];
    const tints = ['#9b8aff', '#ffffff', '#ffd7b3', '#7fbfff'];
    for (let i = 0; i < count; i++) {
      const r = radius * (0.55 + Math.random() * 0.45);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pos.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.6,
        r * Math.cos(phi) - 150
      );
      const c = new THREE.Color(tints[(Math.random() * tints.length) | 0]);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  private buildNebula(count: number) {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    const col: number[] = [];
    const violet = new THREE.Color('#5d2dff');
    const ember = new THREE.Color('#ff2a4a');
    const teal = new THREE.Color('#22d4e0');
    for (let i = 0; i < count; i++) {
      const r = 80 + Math.random() * 380;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pos.push(
        r * Math.sin(phi) * Math.cos(theta) * 0.9,
        r * Math.sin(phi) * Math.sin(theta) * 0.35,
        r * Math.cos(phi) - 130
      );
      const mix = Math.random();
      const c = mix < 0.45 ? violet.clone().lerp(ember, Math.random() * 0.45)
             : mix < 0.75 ? violet.clone().lerp(teal, Math.random() * 0.55)
                          : ember.clone().lerp(teal, Math.random() * 0.35);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.6,
      transparent: true,
      opacity: 0.22,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }
}
