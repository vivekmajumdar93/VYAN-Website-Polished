import * as THREE from 'three';
import { NanoOrb } from '../../objects/NanoOrb';
import { VistaraPath, VISTARA_PRODUCTS, VistaraProductDef, VistaraProductKey } from '../VistaraPath';
import { randomArrivalOffset } from '../../app/Spring';

type BindDeps = {
  interaction: any;
  camera: THREE.PerspectiveCamera;
  cameraRig?: any;
  overlay: any;
  scroll: any;
  audio?: any;
  onProductActivate?: (key: VistaraProductKey) => void;
};

/**
 * Vistāra — the Product sub-void. 7 orbs in a golden-angle spiral.
 * Mirror of ShunyaRealm with sub-void-specific arrivals and cinematics.
 */
export class VistaraRealm {
  public group = new THREE.Group();
  public id = 'vistara';

  public orbs: NanoOrb[] = [];
  public defs: VistaraProductDef[] = VISTARA_PRODUCTS;
  public path = new VistaraPath(VISTARA_PRODUCTS);

  public activeIndex = 0;
  public activeFocus = 0;
  public magnifiedIdx: number | null = null;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private deps!: BindDeps;
  private starfield!: THREE.Points;
  private spiralDust!: THREE.Points;

  constructor() {
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
        1.9,
        3000,
      );
      orb.setHomePosition(def.position);
      this.group.add(orb.group);
      this.group.add(orb.trailGroup);
      this.orbs.push(orb);
    }

    this.starfield = this.buildStarfield(8000, 720);
    this.group.add(this.starfield);
    this.spiralDust = this.buildTravelNebula(4200);
    this.group.add(this.spiralDust);

    this.group.visible = false;
  }

  bind(deps: BindDeps) {
    this.deps = deps;
  }

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
      // Force any previously-magnified orb to collapse back to default size
      // so re-entering the realm doesn't show a frozen expanded orb.
      try { (o as any).magnify?.(1.0, 0.4); } catch {}
    }
    // CINEMATIC RANDOM ARRIVAL — each orb arrives from a truly random off-axis
    // direction (mirroring Shunya). No biased X/Z weighting.
    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      const base = randomArrivalOffset(14 + Math.random() * 6);
      orb.setArrivalOffset(base, 1.4 + Math.random() * 0.6);
    }
    if (this.deps?.cameraRig) {
      this.deps.cameraRig.locked = false;
      if (typeof this.deps.cameraRig.triggerArrival === 'function') {
        this.deps.cameraRig.triggerArrival();
      }
    }
    this.deps?.overlay?.setVoidMode?.(true);
    this.deps?.overlay?.fadeFromBlack?.(1.6);
    this.deps?.audio?.swell?.(0.95, 1.6);
    if (this.deps?.scroll?.reset) this.deps.scroll.reset(0);
    if (this.deps?.scroll) this.deps.scroll.snapSlots = this.defs.length;
    // Re-enable scroll right at entry (was frozen during portal transit).
    this.deps?.scroll?.setEnabled?.(true);
    this.magnifiedIdx = null;
  }

  onExit() {
    this.group.visible = false;
    for (const o of this.orbs) o.setVisible(false);
  }

  focusProduct(key: VistaraProductKey, immediate = false) {
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
    // Deep-link snap (mirrors ShunyaRealm.focusOrb for consistent sizing).
    if (immediate && this.deps?.cameraRig?.snapToVistaraProduct) {
      this.deps.cameraRig.snapToVistaraProduct(idx);
      this.activeIndex = idx;
      this.activeFocus = 1;
      const focused = this.orbs[idx];
      if (focused) {
        try {
          // VistaraRealm uses a different arrival API; reset to zero.
          (focused as any).setArrivalOffset?.(new THREE.Vector3(0, 0, 0), 0);
        } catch {}
      }
    }
  }

  activateFocused() {
    if (this.magnifiedIdx !== null) return;
    const idx = this.activeIndex;
    const orb = this.orbs[idx];
    const def = this.defs[idx];
    this.magnifiedIdx = idx;
    if (this.deps?.scroll?.freeze) this.deps.scroll.freeze();
    orb.magnify(2.6, 0.55);
    this.deps?.audio?.swell?.(1.05, 0.35);
    setTimeout(() => {
      const html = this.getSlabHTML(def);
      this.deps?.overlay?.openPanel?.({
        title: def.name,
        subtitle: def.tagline,
        description: '',
        html,
      } as any, undefined);
      this.deps?.audio?.duck?.(0.55, 0.6);
      this.deps?.onProductActivate?.(def.key);
    }, 480);
  }

  closePanel() {
    if (this.magnifiedIdx === null) return;
    const orb = this.orbs[this.magnifiedIdx];
    this.deps?.overlay?.closePanel?.();
    orb.contract(0.55);
    this.deps?.audio?.swell?.(0.9, 0.6);
    setTimeout(() => {
      this.magnifiedIdx = null;
      if (this.deps?.scroll?.setEnabled) this.deps.scroll.setEnabled(true);
    }, 580);
  }

  /** Cinematic exit — swirls the void inward, then routes back to Shunya. */
  triggerExit(onComplete: () => void) {
    this.deps?.scroll?.freeze?.();
    if (this.deps?.cameraRig) this.deps.cameraRig.locked = true;
    // Audio dim
    this.deps?.audio?.duck?.(0.05, 1.8);
    // Shrink all orbs simultaneously
    for (const orb of this.orbs) {
      orb.contract(1.6);
    }
    this.deps?.overlay?.closePanel?.();
    this.deps?.overlay?.fadeToBlack?.(2.0);
    setTimeout(() => {
      try { onComplete(); } catch {}
    }, 2050);
  }

  private getSlabHTML(def: VistaraProductDef): string {
    const isPlaceholder = def.key === 'placeholder';
    const status = isPlaceholder
      ? '<span class="vy-card__pill vy-card__pill--bottom"><span class="vy-card__dot"></span><span class="vy-card__pill-label">Awaiting Manifestation</span></span>'
      : '<span class="vy-card__pill vy-card__pill--bottom"><span class="vy-card__dot"></span><span class="vy-card__pill-label">In Cognition</span></span>';
    // NOTE: the name + tagline are already shown in dramatic red BEHIND the
    // slab by the in-canvas caption. We deliberately omit the white hero
    // header here to avoid duplicating it. (User feedback #10.)
    return `
      <div class="vy-slab vy-slab--product">
        <p class="vy-p">
          ${isPlaceholder
            ? 'A future cognition orbits in dark wait. This branch of the <em>Vist\u0101ra Mandala</em> has not yet crystallised into the manifest layer of VYAN. <strong>Your application could live here.</strong> Tell us what you are building \u2014 the next orb in this constellation may very well be yours. <a href="/shunya/sankalpa" class="vy-cta-link">\u279d Manifest your intention at Sa\u1e45kalpa</a>'
            : 'A bespoke cognitive product engineered by VYAN, born from the unfurling of the <em>Vist\u0101ra Mandala</em>. The full manifestation arrives in the next phase \u2014 specifications, live demos and access tiers will fold in as this branch matures. <a href="/shunya/sankalpa" class="vy-cta-link">\u279d Place a Sa\u1e45kalpa request</a>'
          }
        </p>
        <div style="text-align:center; margin-top: 24px;">${status}</div>
      </div>
    `;
  }

  update(_dt: number, t: number, progress: number, audio: any) {
    if (!this.deps) return;

    const total = this.defs.length;

    if (this.magnifiedIdx === null) {
      // ScrollJourney now handles tick/swipe advancement directly.
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

    this.starfield.rotation.y += 0.00018 + Math.abs(this.deps.scroll.speed) * 0.0011;
    this.starfield.rotation.x = Math.sin(t * 0.05) * 0.02;
    this.spiralDust.rotation.z += 0.0003 + this.deps.scroll.speed * 0.0006;

    if (this.magnifiedIdx === null && this.deps.interaction.down && this.activeFocus > 0.55) {
      const drag = this.deps.interaction.dragDelta;
      const focused = this.orbs[this.activeIndex];
      if (Math.abs(drag.x) + Math.abs(drag.y) > 0.4) {
        focused.group.rotation.y += drag.x * 0.005;
        focused.group.rotation.x += drag.y * 0.005;
      }
    }

    const def = this.defs[this.activeIndex];
    this.deps.overlay?.setShunyaCaption?.(def.name, def.tagline, this.magnifiedIdx !== null ? 1 : this.activeFocus);
    this.deps.overlay?.setShunyaRail?.(this.activeIndex, this.magnifiedIdx !== null ? 1 : this.activeFocus, total, this.defs.map(d => d.name));

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
    const tints = ['#ffd7b3', '#7fbfff', '#ffffff', '#9b8aff', '#a0e8ff'];
    for (let i = 0; i < count; i++) {
      const r = radius * (0.55 + Math.random() * 0.45);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pos.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.6,
        r * Math.cos(phi) - 180
      );
      const c = new THREE.Color(tints[(Math.random() * tints.length) | 0]);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  /** Travel nebula — soft volumetric clouds inside the ring that drift past
   *  the camera as scroll progresses. Gives a "flying through space" feel.
   */
  private buildTravelNebula(count: number) {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    const col: number[] = [];
    const tints = ['#b8b8ff', '#9a9ad2', '#dcdcff', '#7a7aa8', '#c8c8e8'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radial = Math.random() < 0.7
        ? 30 + Math.random() * 110
        : 150 + Math.random() * 80;
      const yJitter = (Math.random() - 0.5) * 90;
      pos.push(Math.cos(angle) * radial, yJitter, Math.sin(angle) * radial);
      const c = new THREE.Color(tints[(Math.random() * tints.length) | 0]);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.18,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }


  /** Spiral dust matching the orb path — evokes the unfurling product constellation. */
  private buildSpiralDust(count: number) {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    const col: number[] = [];
    const amber = new THREE.Color('#ffb84d');
    const cyan = new THREE.Color('#3ad4ff');
    const indigo = new THREE.Color('#9a55ff');
    for (let i = 0; i < count; i++) {
      const turn = i / count;
      const angle = turn * Math.PI * 14 + Math.random() * 0.4;
      const r = 60 + turn * 180 + (Math.random() - 0.5) * 30;
      const z = -turn * 380 + (Math.random() - 0.5) * 40;
      pos.push(
        Math.cos(angle) * r,
        (Math.random() - 0.5) * 50,
        Math.sin(angle) * r + z
      );
      const mix = Math.random();
      const c = mix < 0.4 ? amber.clone().lerp(cyan, Math.random() * 0.5)
              : mix < 0.75 ? cyan.clone().lerp(indigo, Math.random() * 0.5)
              : indigo.clone().lerp(amber, Math.random() * 0.4);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55,
      transparent: true,
      opacity: 0.26,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }
}
