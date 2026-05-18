import * as THREE from 'three';
import { PathCurve, SHUNYA_ORBS } from '../scenes/PathCurve';

type Deps = {
  scroll: { progress: number; speed: number; loopProgress: number };
  interaction: { pointer: { x: number; y: number } };
  realms: { activeApproach: number; mode?: string };
};

export type CameraMode = 'gateway' | 'shunya';

export class CameraRig {
  private deps!: Deps;
  private offset = new THREE.Vector3();
  private targetOffset = new THREE.Vector3();
  private mode: CameraMode = 'gateway';
  private shunyaPath = new PathCurve(SHUNYA_ORBS);
  private currentLookAt = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {}

  bind(deps: Deps) {
    this.deps = deps;
    this.camera.position.set(0, 0, 280);
    this.offset.set(0, 0, 0);
  }

  setMode(mode: CameraMode) {
    this.mode = mode;
    this.locked = false;
    if (mode === 'shunya') {
      // Drop the camera onto the path at progress=0 so the transition feels grounded.
      const p = this.shunyaPath.cameraAt(0);
      this.camera.position.copy(p);
      this.camera.fov = 52;
      this.camera.updateProjectionMatrix();
      this.currentLookAt.copy(this.shunyaPath.lookAt(0));
    } else {
      this.camera.position.set(0, 0, 280);
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
    }
  }

  getMode() { return this.mode; }

  public locked = false;

  update(dt: number) {
    if (this.locked) return;

    if (this.mode === 'shunya') {
      this.updateShunya(dt);
      return;
    }
    this.updateGateway(dt);
  }

  private updateGateway(dt: number) {
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

  private updateShunya(dt: number) {
    const progress = this.deps.scroll.loopProgress;
    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;

    const camPos = this.shunyaPath.cameraAt(progress);
    const lookTarget = this.shunyaPath.lookAt(progress);

    // Smoothly approach target lookAt (gives slight "steering" feel)
    this.currentLookAt.lerp(lookTarget, 1 - Math.pow(0.001, dt * 60));

    // Add a tiny parallax sway from pointer
    const sway = new THREE.Vector3(px * 0.8, py * 0.5, 0);
    this.camera.position.copy(camPos).add(sway);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
  }
}
