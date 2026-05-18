import * as THREE from 'three';
import { GatewayRealm } from './realms/GatewayRealm';
import { ShunyaRealm } from './realms/ShunyaRealm';
import { ShunyaOrbKey } from './PathCurve';

export type RealmMode = 'gateway' | 'shunya';

type Callbacks = {
  onEnterVoid?: () => void;
  onOrbActivate?: (key: ShunyaOrbKey) => void;
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
    });
    this.gateway.onEnter();
  }

  setMode(next: RealmMode) {
    if (next === this.mode) return;
    if (this.mode === 'gateway') this.gateway.onExit();
    if (this.mode === 'shunya') this.shunya.onExit();
    this.mode = next;
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
      this.activeApproach = THREE.MathUtils.clamp(progress, 0, 1);
    } else {
      this.shunya.update(dt, t, progress, audio);
      this.activeIndex = this.shunya.activeIndex;
      this.panelOpen = this.shunya.magnifiedIdx !== null;
      this.activeApproach = this.shunya.activeFocus;
    }
  }

  jumpToOrb(index: number) {
    if (this.mode === 'shunya' && this.deps?.scroll) {
      const total = this.shunya.defs.length;
      const cycle = Math.floor(this.deps.scroll.target);
      this.deps.scroll.target = cycle + ((index % total) / total);
    }
  }

  closePanel() {
    if (this.mode === 'shunya') this.shunya.closePanel();
  }
}
