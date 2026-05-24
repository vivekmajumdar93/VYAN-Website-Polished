import * as THREE from 'three';
import { GatewayRealm } from './realms/GatewayRealm';
import { ShunyaRealm } from './realms/ShunyaRealm';
import { ShunyaOrbKey } from './PathCurve';

// PHASE 5 cleanup: 'vistara' is no longer a distinct realm/mode. Vistāra is
// one of the Shunya orbs and its 7 products are anchored to its 6 socket
// nodes via in-place expansion (see InteractionState + NanoOrb.socketGroup).
// VistaraRealm.ts has been deleted.
export type RealmMode = 'gateway' | 'shunya';

type Callbacks = {
  onEnterVoid?: () => void;
  onOrbActivate?: (key: ShunyaOrbKey) => void;
  onEnterVistara?: () => void;
  onEnterMedha?: () => void;
};

export class SceneManager {
  private gateway!: GatewayRealm;
  public shunya!: ShunyaRealm;
  private deps: any = {};
  private callbacks: Callbacks = {};

  public mode: RealmMode = 'gateway';
  public activeIndex = 0;
  public panelOpen = false;
  public activeApproach = 0;

  constructor(private scene: THREE.Scene) {}

  createScenes() {
    this.gateway = new GatewayRealm();
    this.shunya = new ShunyaRealm();
    this.scene.add(this.gateway.group);
    this.scene.add(this.shunya.group);
    this.gateway.group.visible = true;
    this.shunya.group.visible = false;
  }

  bind(deps: any, callbacks: Callbacks = {}) {
    this.deps = deps;
    this.callbacks = callbacks;
    this.gateway.bind({
      ...deps,
      onEnterVoid: () => this.callbacks.onEnterVoid?.(),
    });
    this.shunya.bind({
      ...deps,
      onOrbActivate: (k) => this.callbacks.onOrbActivate?.(k),
      onEnterVistara: () => this.callbacks.onEnterVistara?.(),
      onEnterMedha: () => this.callbacks.onEnterMedha?.(),
    });
    this.gateway.onEnter();
  }

  setMode(next: RealmMode) {
    if (next === this.mode) return;
    if (this.mode === 'gateway') this.gateway.onExit();
    if (this.mode === 'shunya') this.shunya.onExit();
    this.mode = next;
    if (this.deps?.scroll) {
      if (next === 'gateway') this.deps.scroll.snapSlots = 0;
    }
    if (next === 'gateway') this.gateway.onEnter();
    if (next === 'shunya') this.shunya.onEnter();
  }

  focusShunyaOrb(key: ShunyaOrbKey, immediate = false) {
    this.shunya.focusOrb(key, immediate);
  }

  update(dt: number, t: number, progress: number, audio: any) {
    if (this.mode === 'gateway') {
      this.gateway.update(dt, t, progress, audio);
      this.activeIndex = 0;
      this.panelOpen = false;
      this.activeApproach = Math.max(0, Math.min(1, progress));
    } else if (this.mode === 'shunya') {
      this.shunya.update(dt, t, progress, audio);
      this.activeIndex = this.shunya.activeIndex;
      this.panelOpen = this.shunya.magnifiedIdx !== null;
      this.activeApproach = this.shunya.activeFocus;
    }
  }

  jumpToOrb(index: number) {
    if (this.deps?.scroll) {
      let total = 0;
      if (this.mode === 'shunya') total = this.shunya.defs.length;
      if (total > 0) {
        const cycle = Math.floor(this.deps.scroll.target);
        this.deps.scroll.target = cycle + ((index % total) / total);
      }
    }
  }

  closePanel() {
    if (this.mode === 'shunya') this.shunya.closePanel();
  }
}
