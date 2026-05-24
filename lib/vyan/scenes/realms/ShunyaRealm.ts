import * as THREE from 'three';
import { NanoOrb } from '../../objects/NanoOrb';
import { PathCurve, SHUNYA_ORBS, ShunyaOrbDef, ShunyaOrbKey } from '../PathCurve';
import { SLAB_UDBHAVA_HTML, SLAB_SANDHI_HTML, SLAB_SANKALPA_HTML } from '../../ui/slabContent';
import { randomArrivalOffset } from '../../app/Spring';
import { getInteractionStore, SPECTRUM_HEX } from '../../state/InteractionState';

type BindDeps = {
  interaction: any;
  camera: THREE.PerspectiveCamera;
  cameraRig?: any;
  overlay: any;
  scroll: any;
  audio?: any;
  onOrbActivate?: (key: ShunyaOrbKey) => void;
  onEnterVistara?: () => void;
  onEnterMedha?: () => void;
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

      // PHASE 3 v2 — ONLY Vistāra gets clickable product sockets (tiny dots
      // at scattered intersection points, electric signal pulses converging
      // on them). Medhā and other orbs have NO sockets.
      if (def.key === 'vistara') {
        orb.enableProductSockets([
          'ritam', 'ojas', 'mudra', 'netra', 'akriti', 'sutra',
        ]);
      }
    }

    this.starfield = this.buildStarfield(7000, 600);
    this.group.add(this.starfield);
    this.nebula = this.buildNebula(2200);
    this.group.add(this.nebula);

    this.group.visible = false;
  }

  bind(deps: BindDeps) {
    this.deps = deps;
    // PHASE 1-4: subscribe to InteractionState and forward expansion progress
    // + signal + spectrum to the matching orb. Also dim all sibling orbs to
    // 0.18 when ANY orb is unfolded (in-place focus pull).
    try {
      const store = getInteractionStore();
      store.subscribe((s) => {
        const targetKey = s.target; // 'medha' | 'vistara' | null
        for (const orb of this.orbs) {
          const isTarget = !!targetKey && orb.data.id === targetKey;
          orb.setExpansionProgress(isTarget ? s.progress : 0);
          orb.setSignal(isTarget ? s.signal : 'idle');
          if (isTarget) {
            const sp = SPECTRUM_HEX[s.spectrum];
            if (sp) orb.setSpectrumHex(sp.lo, sp.hi);
          }
          // Sibling fade — others fade down as the expansion unfolds.
          if (targetKey) {
            const dim = isTarget ? 1.0 : (1.0 - s.progress * 0.82);
            orb.setVisualDim(dim);
          } else {
            orb.setVisualDim(1.0);
          }
        }
        // Expose current expansion to consumers (CameraRig FOV pull).
        (window as any).__vyanExpansion = {
          target: targetKey,
          progress: s.progress,
          phase: s.phase,
        };
      });
    } catch {}
  }

  // Expose focused orb live world position so CameraRig can lock onto it.
  getFocusedWorldPosition(): THREE.Vector3 {
    const idx = this.activeIndex;
    return this.orbs[idx]?.group.position.clone() ?? new THREE.Vector3();
  }

  // PHASE 3: external React overlays need the orb's screen-projected centre
  // so they can anchor themselves over it.
  getOrbByKey(key: string): NanoOrb | null {
    for (const o of this.orbs) if (o.data.id === key) return o;
    return null;
  }
  getOrbScreenNDC(key: string, camera: THREE.Camera): { x: number; y: number } | null {
    const o = this.getOrbByKey(key);
    if (!o) return null;
    const p = o.group.position.clone().project(camera);
    return { x: p.x, y: p.y };
  }
  getOrbSocketNDC(key: string, socketIdx: number, totalSockets: number, camera: THREE.Camera): { x: number; y: number } | null {
    const o = this.getOrbByKey(key);
    if (!o) return null;
    const world = o.getSocketWorld(socketIdx, totalSockets);
    const p = world.project(camera);
    return { x: p.x, y: p.y };
  }

  onEnter() {
    this.group.visible = true;
    for (const o of this.orbs) {
      o.setVisible(true);
      o.reset();
      // CRITICAL FIX: when re-entering Shunya (e.g. user exits Medhā back to
      // /shunya/medha) we must force-reset every orb's magnification so the
      // previously-magnified orb (Medhā / Vistāra) shrinks back to its click
      // zone. Otherwise the camera stays locked on a giant frozen orb and
      // the user can't navigate.
      (o as any).magnifyFactor = 1.0;
      try { (o as any).magnify?.(1.0, 0.4); } catch {}
    }
    // Force-clear any lingering magnify state from the previous session.
    this.magnifiedIdx = null;
    // EQUALIZATION (item 2): arrival offset reduced from 10 → 3 units so
    // the focused orb stays visually centered + consistently sized during
    // the entry settle. Larger drifts caused Sandhi / Medhā to look smaller
    // and off-center during the first ~1.5s after deep-link entry.
    for (const orb of this.orbs) {
      orb.setArrivalOffset(randomArrivalOffset(3), 0.9);
    }
    if (this.deps?.cameraRig) {
      this.deps.cameraRig.locked = false;
      // Tell the camera to spring-arrive too (slight off-axis nudge).
      if (typeof this.deps.cameraRig.triggerArrival === 'function') {
        this.deps.cameraRig.triggerArrival();
      }
    }
    this.deps?.overlay?.setVoidMode?.(true);
    this.deps?.overlay?.fadeFromBlack?.(1.6);
    // Audio swell on void emergence — matches the 1.6s fade-from-black.
    this.deps?.audio?.swell?.(0.9, 1.6);
    if (this.deps?.scroll?.reset) this.deps.scroll.reset(0);
    if (this.deps?.scroll) this.deps.scroll.snapSlots = this.defs.length;
    // Critical: scroll is frozen during the burst/portal transition. Re-enable
    // it immediately on void entry so users can navigate without first clicking.
    this.deps?.scroll?.setEnabled?.(true);
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
    // On deep-link entry, also snap the camera dead-on to this orb so the user
    // doesn't watch a 200+ unit spring traversal across the void. Also pin the
    // focused orb to its home (no arrival drift) so its on-screen size is
    // identical to every other focused orb.
    if (immediate && this.deps?.cameraRig?.snapToShunyaOrb) {
      this.deps.cameraRig.snapToShunyaOrb(idx);
      this.activeIndex = idx;
      this.activeFocus = 1;
      const focused = this.orbs[idx];
      if (focused) {
        focused.setArrivalOffset(new THREE.Vector3(0, 0, 0), 0);
      }
    }
  }

  // Triggered when user clicks a focused orb. Magnifies orb, then opens slab.
  activateFocused() {
    if (this.magnifiedIdx !== null) return;
    const idx = this.activeIndex;
    const orb = this.orbs[idx];
    const def = this.defs[idx];

    // PHASE 2 in-place architecture: Vist\u0101ra and Medh\u0101 no longer fade to
    // black or burst-teleport. They route to their URL (which sets
    // InteractionState.expand) and the orb unfolds in-place. The camera
    // stays in the Shunya field throughout — no scene teleport.
    if (def.key === 'vistara') {
      this.magnifiedIdx = idx;
      this.deps?.audio?.swell?.(1.05, 0.4);
      // Tiny pre-anchor magnify so the click feels tactile but no warp.
      orb.magnify(1.25, 0.35);
      setTimeout(() => { try { this.deps?.onEnterVistara?.(); } catch {} }, 60);
      return;
    }

    if (def.key === 'medha') {
      this.magnifiedIdx = idx;
      this.deps?.audio?.swell?.(1.05, 0.4);
      orb.magnify(1.25, 0.35);
      setTimeout(() => { try { this.deps?.onEnterMedha?.(); } catch {} }, 60);
      return;
    }

    this.magnifiedIdx = idx;
    if (this.deps?.scroll?.freeze) this.deps.scroll.freeze();
    orb.magnify(2.6, 0.55);
    // Audio: punchy swell as the orb expands \u2192 settle when slab is open.
    this.deps?.audio?.swell?.(1.05, 0.35);
    setTimeout(() => {
      const html = this.getSlabHTML(def.key);
      this.deps?.overlay?.openPanel?.({
        title: def.name,
        subtitle: def.tagline,
        description: '',
        html,
      } as any, undefined);
      this.deps?.audio?.duck?.(0.55, 0.6); // calm the music while reading
      this.deps?.onOrbActivate?.(def.key);
    }, 480);
  }

  // Triggered when slab close button fires.
  closePanel() {
    if (this.magnifiedIdx === null) return;
    const orb = this.orbs[this.magnifiedIdx];
    this.deps?.overlay?.closePanel?.();
    orb.contract(0.55);
    // Audio: swell back to the void baseline as the orb returns.
    this.deps?.audio?.swell?.(0.9, 0.6);
    setTimeout(() => {
      this.magnifiedIdx = null;
      if (this.deps?.scroll?.setEnabled) this.deps.scroll.setEnabled(true);
    }, 580);
  }

  private getSlabHTML(key: ShunyaOrbKey): string {
    if (key === 'udbhava') return SLAB_UDBHAVA_HTML;
    if (key === 'sandhi') return SLAB_SANDHI_HTML;
    const placeholders: Partial<Record<ShunyaOrbKey, string>> = {
      vistara: '<p class="vy-p">Vist\u0101ra is the unfurling \u2014 the lattice of products that radiate outward from the core. <em>Sub-void content arrives in Phase 4.</em></p>',
      vyuha:   '<p class="vy-p">Vy\u016bha is the design discipline \u2014 the lattice of intent, the geometry of decision. Every product passes through this seam.</p>',
      medha:   '<p class="vy-p">Medh\u0101 is the cognition that understands. Multiple minds, one resonance. <em>Sub-void content arrives in Phase 5.</em></p>',
      sankalpa: SLAB_SANKALPA_HTML,
    };
    return placeholders[key] ?? '';
  }

  update(_dt: number, t: number, progress: number, audio: any) {
    if (!this.deps) return;

    const total = this.defs.length;

    // While magnified, freeze active index; do NOT consume scroll.
    if (this.magnifiedIdx === null) {
      // Touch swipes & wheel ticks are now handled directly in ScrollJourney
      // (3 wheel ticks or 2 swipes = one orb). We just observe the progress
      // and snap-detect the focused orb here.
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

    // Click-and-drag orbits the focused orb in any direction.
    // (Vertical-dominant swipes are still consumed by the swipeDir handler above,
    // so this only kicks in for in-place / horizontal / diagonal drags.)
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

      // PHASE 3 v2 — product-socket click (only on Vistāra). If the user
      // taps one of the tiny dots, route directly to /vistara/<productKey>.
      const isVistaraOrb = this.defs[this.activeIndex]?.key === 'vistara';
      if (isVistaraOrb && (focused as any).socketGroup) {
        const socketHits = this.raycaster.intersectObjects(
          (focused as any).socketGroup.children, true
        );
        const productHit = socketHits.find((h: any) =>
          h.object?.userData?.isProductSocket && h.object?.userData?.productKey,
        );
        if (productHit) {
          const productKey = productHit.object.userData.productKey as string;
          // Light click feedback then route — the in-place expansion stays.
          this.deps?.audio?.swell?.(1.06, 0.25);
          // Use the same route as the in-place architecture: /vistara/<key>
          // which sets InteractionState.expand('vistara', key) automatically.
          try {
            const router = (window as any).__vyanRouter;
            if (router?.push) router.push(`/vistara/${productKey}`);
            else window.location.assign(`/vistara/${productKey}`);
          } catch {
            window.location.assign(`/vistara/${productKey}`);
          }
          return;
        }
      }

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
