import * as THREE from 'three';
import { GatewayRealm } from './realms/GatewayRealm';
import { ShunyaRealm } from './realms/ShunyaRealm';
import { VistaraRealm } from './realms/VistaraRealm';
import { ShunyaOrbKey } from './PathCurve';
import { VistaraProductKey } from './VistaraPath';

export type RealmMode = 'gateway' | 'shunya' | 'vistara';

type Callbacks = {
  onEnterVoid?: () => void;
  onOrbActivate?: (key: ShunyaOrbKey) => void;
  onEnterVistara?: () => void;
  onProductActivate?: (key: VistaraProductKey) => void;
  onExitVistara?: () => void;
  onEnterMedha?: () => void;
};

export class SceneManager {
  private gateway!: GatewayRealm;
  public shunya!: ShunyaRealm;
  public vistara!: VistaraRealm;
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
    this.vistara = new VistaraRealm();
    this.scene.add(this.gateway.group);
    this.scene.add(this.shunya.group);
    this.scene.add(this.vistara.group);
    this.gateway.group.visible = true;
    this.shunya.group.visible = false;
    this.vistara.group.visible = false;
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
    this.vistara.bind({
      ...deps,
      onProductActivate: (k) => this.callbacks.onProductActivate?.(k),
    });
    this.gateway.onEnter();
  }

  setMode(next: RealmMode) {
    if (next === this.mode) return;
    if (this.mode === 'gateway') this.gateway.onExit();
    if (this.mode === 'shunya') this.shunya.onExit();
    if (this.mode === 'vistara') this.vistara.onExit();
    this.mode = next;
    // Configure scroll mode for each realm:
    //   gateway: snapSlots = 0 \u2192 continuous fly-in
    //   shunya:  snapSlots = 5 \u2192 discrete tick navigation
    //   vistara: snapSlots = 7 \u2192 discrete tick navigation
    if (this.deps?.scroll) {
      if (next === 'gateway') this.deps.scroll.snapSlots = 0;
      // shunya & vistara each set their own snapSlots inside onEnter
    }
    if (next === 'gateway') this.gateway.onEnter();
    if (next === 'shunya') this.shunya.onEnter();
    if (next === 'vistara') this.vistara.onEnter();
  }

  focusShunyaOrb(key: ShunyaOrbKey, immediate = false) {
    this.shunya.focusOrb(key, immediate);
  }

  focusVistaraProduct(key: VistaraProductKey, immediate = false) {
    this.vistara.focusProduct(key, immediate);
  }

  /** Cinematic exit from Vist\u0101ra \u2014 routes back to /shunya/vistara focus. */
  triggerVistaraExit(onRouterPush: () => void) {
    if (this.mode !== 'vistara') { onRouterPush(); return; }
    this.vistara.triggerExit(() => {
      this.callbacks.onExitVistara?.();
      onRouterPush();
    });
  }

  update(dt: number, t: number, progress: number, audio: any) {
    if (this.mode === 'gateway') {
      this.gateway.update(dt, t, progress, audio);
      this.activeIndex = 0;
      this.panelOpen = false;
      // Restored from canonical zip: activeApproach is the user's scroll
      // progress, clamped 0..1. Drives the gateway camera fly-in.
      this.activeApproach = Math.max(0, Math.min(1, progress));
    } else if (this.mode === 'shunya') {
      this.shunya.update(dt, t, progress, audio);
      this.activeIndex = this.shunya.activeIndex;
      this.panelOpen = this.shunya.magnifiedIdx !== null;
      this.activeApproach = this.shunya.activeFocus;
    } else if (this.mode === 'vistara') {
      this.vistara.update(dt, t, progress, audio);
      this.activeIndex = this.vistara.activeIndex;
      this.panelOpen = this.vistara.magnifiedIdx !== null;
      this.activeApproach = this.vistara.activeFocus;
    }
  }

  jumpToOrb(index: number) {
    if (this.deps?.scroll) {
      let total = 0;
      if (this.mode === 'shunya') total = this.shunya.defs.length;
      else if (this.mode === 'vistara') total = this.vistara.defs.length;
      if (total > 0) {
        const cycle = Math.floor(this.deps.scroll.target);
        this.deps.scroll.target = cycle + ((index % total) / total);
      }
    }
  }

  closePanel() {
    if (this.mode === 'shunya') this.shunya.closePanel();
    else if (this.mode === 'vistara') this.vistara.closePanel();
  }
}
