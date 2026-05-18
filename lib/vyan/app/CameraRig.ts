import * as THREE from 'three';

type Deps = {
  scroll: { progress: number; speed: number };
  interaction: { pointer: { x: number; y: number } };
  realms: { activeApproach: number };
};

export class CameraRig {
  private deps!: Deps;
  private offset = new THREE.Vector3();
  private targetOffset = new THREE.Vector3();
  private mode: 'gateway' = 'gateway';

  constructor(private camera: THREE.PerspectiveCamera) {}

  bind(deps: Deps) {
    this.deps = deps;
    this.camera.position.set(0, 0, 280);
    this.offset.set(0, 0, 0);
  }

  setMode(mode: 'gateway') {
    this.mode = mode;
    this.locked = false;
  }

  getMode() {
    return this.mode;
  }

  public locked = false;

  update(dt: number) {
    if (this.locked) return;

    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;
    const t = performance.now() * 0.001;

    const p = this.deps.realms.activeApproach;
    const z = THREE.MathUtils.lerp(280, 26, p);
    
    this.targetOffset.set(
      px * 1.8 + Math.sin(t * 0.4) * 0.8,
      py * 1.1 + Math.cos(t * 0.3) * 0.8,
      0
    );
    this.offset.lerp(this.targetOffset, 1 - Math.pow(0.005, dt * 60));
    
    this.camera.position.set(this.offset.x, this.offset.y, z);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov = 38 + Math.min(p * 5.5, 5.5);
    this.camera.updateProjectionMatrix();
  }
}
