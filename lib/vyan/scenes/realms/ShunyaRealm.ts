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
  public magnifiedIdx: number | null = null;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private deps!: BindDeps;
  private starfield!: THREE.Points;
  private nebula!: THREE.Points;

  // Track which orb is currently in "orb-full" expansion mode so we can
  // route subnode clicks to CameraRig.flyToNode correctly.
  private expandedOrbKey: string | null = null;

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

      // Vistāra: 6 product sockets, signals travel inward.
      if (def.key === 'vistara') {
        orb.enableProductSockets(
          ['ritam', 'ojas', 'mudra', 'netra', 'akriti', 'sutra'],
          {
            direction: 'inward',
            colors: [
              '#3da9ff', // ritam
              '#46ffae', // ojas
              '#ffb84a', // mudra
              '#7ef0ff', // netra
              '#ff4ba0', // akriti
              '#b465ff', // sutra
            ],
          },
        );
      } else if (def.key === 'medha') {
        // Medhā: 5 model nodes, signals travel outward from core.
        // Colors are updated per model selection from MedhaHUD.
        orb.enableProductSockets(
          ['prajna', 'dhyana', 'akshaya', 'java', 'sanchara'],
          {
            direction: 'outward',
            colors: [
              '#ff4a4a', // prajna  — crimson insight
              '#22e0d4', // dhyana  — teal reflection
              '#3a90ff', // akshaya — azure knowledge
              '#ffb84d', // java    — amber velocity
              '#ff6688', // sanchara — coral connection
            ],
          },
        );
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

    try {
      const store = getInteractionStore();
      store.subscribe((s) => {
        const targetKey = s.target;

        for (const orb of this.orbs) {
          const isTarget = !!targetKey && orb.data.id === targetKey;
          orb.setExpansionProgress(isTarget ? s.progress : 0);
          orb.setSignal(isTarget ? s.signal : 'idle');
          if (isTarget) {
            const sp = SPECTRUM_HEX[s.spectrum];
            if (sp) orb.setSpectrumHex(sp.lo, sp.hi);
          }
          // Sibling fade
          if (targetKey) {
            const dim = isTarget ? 1.0 : (1.0 - s.progress * 0.82);
            orb.setVisualDim(dim);
          } else {
            orb.setVisualDim(1.0);
          }
        }

        // Track which orb is expanded for subnode-click routing
        if (s.phase === 'expanded') {
          this.expandedOrbKey = targetKey;
        } else if (s.phase === 'dormant') {
          this.expandedOrbKey = null;
        }

        (window as any).__vyanExpansion = {
          target: targetKey,
          progress: s.progress,
          phase: s.phase,
        };
      });
    } catch {}
  }

  getFocusedWorldPosition(): THREE.Vector3 {
    const idx = this.activeIndex;
    return this.orbs[idx]?.group.position.clone() ?? new THREE.Vector3();
  }

  // ── Public API: guaranteed to exist ─────────────────────────────────────────
  getOrbByKey(key: string): NanoOrb | null {
    for (const o of this.orbs) {
      if (o.data.id === key) return o;
    }
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
      (o as any).magnifyFactor = 1.0;
      try { (o as any).magnify?.(1.0, 0.4); } catch {}
    }
    this.magnifiedIdx = null;
    this.expandedOrbKey = null;

    for (const orb of this.orbs) {
      orb.setArrivalOffset(randomArrivalOffset(3), 0.9);
    }
    if (this.deps?.cameraRig) {
      this.deps.cameraRig.locked = false;
      if (typeof this.deps.cameraRig.triggerArrival === 'function') {
        this.deps.cameraRig.triggerArrival();
      }
    }
    this.deps?.overlay?.setVoidMode?.(true);
    this.deps?.overlay?.fadeFromBlack?.(1.6);
    this.deps?.audio?.swell?.(0.9, 1.6);
    if (this.deps?.scroll?.reset) this.deps.scroll.reset(0);
    if (this.deps?.scroll) this.deps.scroll.snapSlots = this.defs.length;
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
    if (immediate && this.deps?.cameraRig?.snapToShunyaOrb) {
      this.deps.cameraRig.snapToShunyaOrb(idx);
      this.activeIndex = idx;
      this.activeFocus = 1;
      const focused = this.orbs[idx];
      if (focused) focused.setArrivalOffset(new THREE.Vector3(0, 0, 0), 0);
    }
  }

  activateFocused() {
    if (this.magnifiedIdx !== null) return;
    const idx = this.activeIndex;
    const orb = this.orbs[idx];
    const def = this.defs[idx];

    if (def.key === 'vistara') {
      this.magnifiedIdx = idx;
      this.deps?.audio?.swell?.(1.05, 0.4);
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
    this.deps?.audio?.swell?.(1.05, 0.35);
    setTimeout(() => {
      const html = this.getSlabHTML(def.key);
      this.deps?.overlay?.openPanel?.({
        title: def.name,
        subtitle: def.tagline,
        description: '',
        html,
      } as any, undefined);
      this.deps?.audio?.duck?.(0.55, 0.6);
      this.deps?.onOrbActivate?.(def.key);
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

  private getSlabHTML(key: ShunyaOrbKey): string {
    if (key === 'udbhava') return SLAB_UDBHAVA_HTML;
    if (key === 'sandhi') return SLAB_SANDHI_HTML;
    const placeholders: Partial<Record<ShunyaOrbKey, string>> = {
      vistara:  '<p class="vy-p">Vistāra is the unfurling — the lattice of products that radiate outward from the core.</p>',
      vyuha:    '<p class="vy-p">Vyūha is the design discipline — the lattice of intent, the geometry of decision.</p>',
      medha:    '<p class="vy-p">Medhā is the cognition that understands. Multiple minds, one resonance.</p>',
      sankalpa: SLAB_SANKALPA_HTML,
    };
    return placeholders[key] ?? '';
  }

  update(_dt: number, t: number, progress: number, audio: any) {
    if (!this.deps) return;

    const total = this.defs.length;

    if (this.magnifiedIdx === null) {
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

    if (this.magnifiedIdx === null && this.deps.interaction.clicked) {
      this.ndc.set(this.deps.interaction.pointer.x, this.deps.interaction.pointer.y);
      this.raycaster.setFromCamera(this.ndc, this.deps.camera);
      const focused = this.orbs[this.activeIndex];
      const focusedDef = this.defs[this.activeIndex];

      // ── When orb is in expanded (orb-full) state, clicks on subnodes
      //    trigger camera fly-to-node via CameraRig ────────────────────
      if (this.expandedOrbKey === focusedDef.key) {
        const sg = (focused as any).socketGroup;
        if (sg?.children?.length) {
          (this.raycaster.params as any).Points = { threshold: 1.2 };
          (this.raycaster.params as any).Line   = { threshold: 0.6 };
          const hits = this.raycaster.intersectObjects(sg.children, true);
          const nodeHit = hits.find((h: any) =>
            h.object?.userData?.isProductSocket && h.object?.userData?.productKey,
          );
          if (nodeHit) {
            const nodeKey = nodeHit.object.userData.productKey as string;
            const nodeWorldPos = new THREE.Vector3();
            nodeHit.object.getWorldPosition(nodeWorldPos);
            const rig = this.deps.cameraRig;

            if (focusedDef.key === 'medha') {
              // Medhā: fly to perspective FROM the node, no panel — the orb IS the interface
              if (rig?.flyToMedhaNodePerspective) {
                const orbCenter = focused.group.position.clone();
                rig.flyToMedhaNodePerspective(nodeWorldPos, orbCenter);
              }
              // Update model selection in InteractionState + MedhaHUD
              try {
                const ixMod = (window as any).__vyanIX;
                ixMod?.setNode?.(nodeKey);
                // Fire model-color update on the orb
                const MODEL_COLOR: Record<string, string> = {
                  prajna:   '#ff4a4a',
                  dhyana:   '#22e0d4',
                  akshaya:  '#3a90ff',
                  java:     '#ffb84d',
                  sanchara: '#ff6688',
                };
                focused.setSocketColors?.(MODEL_COLOR[nodeKey] ?? '#ff4a4a');
              } catch {}
              // Navigate to model route so MedhaHUD picks it up
              this.deps?.audio?.swell?.(1.05, 0.28);
              try {
                const router = (window as any).__vyanRouter;
                const target = `/medha?model=${nodeKey}`;
                if (router?.push) router.push(target);
                else window.location.assign(target);
              } catch { window.location.assign(`/medha?model=${nodeKey}`); }
              return;
            }

            // Vistāra: fly camera to node, hover, then open panel
            if (rig?.flyToNode) {
              rig.flyToNode(nodeWorldPos, () => {
                const router = (window as any).__vyanRouter;
                const target = `/vistara/${nodeKey}`;
                try {
                  if (router?.push) router.push(target);
                  else window.location.assign(target);
                } catch { window.location.assign(target); }
              });
            } else {
              const router = (window as any).__vyanRouter;
              const target = `/vistara/${nodeKey}`;
              try {
                if (router?.push) router.push(target);
                else window.location.assign(target);
              } catch { window.location.assign(target); }
            }
            this.deps?.audio?.swell?.(1.06, 0.25);
            return;
          }
        }
        // Click on canvas but NOT on a node while in orb-full — ignore
        return;
      }

      // ── Normal socket clicks (before expansion) ───────────────────
      if ((focused as any).socketGroup?.children?.length) {
        const socketHits = this.raycaster.intersectObjects(
          (focused as any).socketGroup.children, true,
        );
        const productHit = socketHits.find((h: any) =>
          h.object?.userData?.isProductSocket && h.object?.userData?.productKey,
        );
        if (productHit) {
          const productKey = productHit.object.userData.productKey as string;
          const orbKey = focusedDef.key;
          this.deps?.audio?.swell?.(1.06, 0.25);
          try {
            const router = (window as any).__vyanRouter;
            const target = orbKey === 'medha' ? `/medha?model=${productKey}` : `/vistara/${productKey}`;
            if (router?.push) router.push(target);
            else window.location.assign(target);
          } catch { window.location.assign(`/vistara/${productKey}`); }
          return;
        }
      }

      // ── Orb-body click ────────────────────────────────────────────
      if (this.activeFocus > 0.55) {
        const hit = this.raycaster.intersectObject(focused.hitMesh, true);
        const centered = Math.abs(this.ndc.x) < 0.34 && Math.abs(this.ndc.y) < 0.24;
        if (hit.length > 0 || centered) {
          this.activateFocused();
        }
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
        r * Math.cos(phi) - 150,
      );
      const c = new THREE.Color(tints[(Math.random() * tints.length) | 0]);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18, sizeAttenuation: true, transparent: true,
      opacity: 0.85, vertexColors: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  private buildNebula(count: number) {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    const col: number[] = [];
    const violet = new THREE.Color('#5d2dff');
    const ember  = new THREE.Color('#ff2a4a');
    const teal   = new THREE.Color('#22d4e0');
    for (let i = 0; i < count; i++) {
      const r = 80 + Math.random() * 380;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pos.push(
        r * Math.sin(phi) * Math.cos(theta) * 0.9,
        r * Math.sin(phi) * Math.sin(theta) * 0.35,
        r * Math.cos(phi) - 130,
      );
      const mix = Math.random();
      const c = mix < 0.45 ? violet.clone().lerp(ember, Math.random() * 0.45)
             : mix < 0.75  ? violet.clone().lerp(teal,  Math.random() * 0.55)
                           : ember.clone().lerp(teal,   Math.random() * 0.35);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.6, transparent: true, opacity: 0.22, vertexColors: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }
}
