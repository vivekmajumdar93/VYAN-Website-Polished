import * as THREE from 'three';
import { GatewayRealm } from './realms/GatewayRealm';

export type RealmMode = 'gateway';

export class SceneManager {
  private gateway!:   GatewayRealm;
  private deps: any   = {};

  public mode:           RealmMode = 'gateway';
  public activeIndex     = 0;
  public panelOpen       = false;
  public activeApproach  = 0;

  constructor(private scene: THREE.Scene) {}

  createScenes() {
    this.gateway   = new GatewayRealm();
    this.scene.add(this.gateway.group);
    this.gateway.group.visible   = true;
  }

  bind(deps: any) {
    this.deps = deps;
    this.gateway.bind(deps);
    this.gateway.onEnter();
  }

  update(dt: number, t: number, progress: number, audio: any) {
    this.gateway.update(dt, t, progress, audio);
    this.activeIndex     = 0;
    this.panelOpen       = false;
    this.activeApproach  = THREE.MathUtils.clamp(progress, 0, 1);
  }

  jumpToOrb(_index: number) {}

  closePanel() {}
}
