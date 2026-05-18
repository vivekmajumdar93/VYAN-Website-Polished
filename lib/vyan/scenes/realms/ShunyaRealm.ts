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

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private deps!: BindDeps;
  private starfield!: THREE.Points;
  private nebula!: THREE.Points;

  constructor() {
    // Create the 5 orbs
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
        1.65,
        4200
      );
      orb.setHomePosition(def.position);
      this.group.add(orb.group);
      this.group.add(orb.trailGroup);
      this.orbs.push(orb);
    }

    // Ambient star field that drifts past the camera as it travels.
    this.starfield = this.buildStarfield(7000, 600);
    this.group.add(this.starfield);

    // Faint colored nebula dust to give the void texture.
    this.nebula = this.buildNebula(2200);
    this.group.add(this.nebula);

    this.group.visible = false;
  }

  bind(deps: BindDeps) {
    this.deps = deps;
  }

  onEnter() {
    this.group.visible = true;
    for (const o of this.orbs) {
      o.setVisible(true);
      o.reset();
    }
    if (this.deps?.cameraRig) {
      this.deps.cameraRig.locked = false;
    }
    this.deps?.overlay?.setVoidMode?.(true);
    // Cinematic emerge: if a fadeToBlack overlay is up (from gateway burst), fade it out.
    this.deps?.overlay?.fadeFromBlack?.(1.6);
  }

  onExit() {
    this.group.visible = false;
    for (const o of this.orbs) o.setVisible(false);
  }

  // Public: focus a specific orb by key (driven by URL /shunya/<key>)
  focusOrb(key: ShunyaOrbKey, immediate = false) {
    const idx = this.defs.findIndex(d => d.key === key);
    if (idx < 0) return;
    const total = this.defs.length;
    if (this.deps?.scroll) {
      const cycle = Math.floor(this.deps.scroll.target);
      this.deps.scroll.target = cycle + idx / total;
      if (immediate) {
        this.deps.scroll.progress = this.deps.scroll.target;
      }
    }
  }

  update(_dt: number, t: number, progress: number, audio: any) {
    if (!this.deps) return;

    const total = this.defs.length;
    const { index, focus } = this.path.nearestOrb(progress, total);
    this.activeIndex = index;
    this.activeFocus = focus;

    const energy = audio?.energy ?? 0;

    // Update every orb with its focus level (so distant orbs are dim, near orb glows)
    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      const focusForOrb = i === index ? focus : 0;
      const motion = 0.45 + focusForOrb * 1.4;
      orb.update(t, energy, focusForOrb > 0.5, false, focusForOrb, motion);
    }

    // Drag-rotate the focused orb (only while drag is active and focus is strong)
    const drag = this.deps.interaction.dragDelta;
    if (this.deps.interaction.down && focus > 0.6 && Math.abs(drag.x) + Math.abs(drag.y) > 0.5) {
      const focused = this.orbs[index];
      focused.group.rotation.y += drag.x * 0.004;
      focused.group.rotation.x += drag.y * 0.004;
    }

    // Star/nebula slow rotation — gives the parallax-fly-through feel.
    this.starfield.rotation.y += 0.00015 + Math.abs(this.deps.scroll.speed) * 0.0009;
    this.nebula.rotation.y -= 0.0001;

    // Captions + neural rail
    const def = this.defs[index];
    this.deps.overlay?.setShunyaCaption?.(def.name, def.tagline, focus);
    this.deps.overlay?.setShunyaRail?.(index, focus, total);

    // Click activation
    if (this.deps.interaction.clicked && focus > 0.55) {
      this.ndc.set(this.deps.interaction.pointer.x, this.deps.interaction.pointer.y);
      this.raycaster.setFromCamera(this.ndc, this.deps.camera);
      const focused = this.orbs[index];
      const hit = this.raycaster.intersectObject(focused.hitMesh, true);
      const centered = Math.abs(this.ndc.x) < 0.28 && Math.abs(this.ndc.y) < 0.22;
      if (hit.length > 0 || centered) {
        this.deps.onOrbActivate?.(def.key);
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
