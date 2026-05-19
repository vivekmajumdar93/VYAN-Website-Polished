import * as THREE from 'three';
import { PathCurve, SHUNYA_ORBS } from '../scenes/PathCurve';
import { SpringV3, randomArrivalOffset } from './Spring';

type Deps = {
  scroll: { progress: number; speed: number; loopProgress: number };
  interaction: { pointer: { x: number; y: number } };
  realms: { activeApproach: number; mode?: string; shunya?: any };
};

export type CameraMode = 'gateway' | 'shunya';

export class CameraRig {
  private deps!: Deps;
  private offset = new THREE.Vector3();
  private targetOffset = new THREE.Vector3();
  private mode: CameraMode = 'gateway';
  private shunyaPath = new PathCurve(SHUNYA_ORBS);
  private currentLookAt = new THREE.Vector3();
  private currentCamPos = new THREE.Vector3();
  private posSpring = new SpringV3();
  private lookSpring = new SpringV3();
  private arrivalOffset = new THREE.Vector3();
  private arrivalSpring = new SpringV3();
  private arrivalActive = false;

  constructor(private camera: THREE.PerspectiveCamera) {}

  bind(deps: Deps) {
    this.deps = deps;
    this.camera.position.set(0, 0, 280);
    this.offset.set(0, 0, 0);
  }

  setMode(mode: CameraMode) {
    this.mode = mode;
    this.locked = false;
    this.posSpring.reset();
    this.lookSpring.reset();
    if (mode === 'shunya') {
      const p = this.shunyaPath.cameraAt(0);
      this.camera.position.copy(p);
      this.currentCamPos.copy(p);
      this.camera.fov = 38;     // matches Vyōma at-orb FOV (38 + 5.5 = ~38)
      this.camera.updateProjectionMatrix();
      this.currentLookAt.copy(SHUNYA_ORBS[0].position);
    } else {
      this.camera.position.set(0, 0, 280);
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
    }
  }

  getMode() { return this.mode; }

  /**
   * Cinematic arrival — camera springs in from an off-axis offset.
   * Called by ShunyaRealm.onEnter to give the camera an "arrogant" entrance.
   */
  triggerArrival() {
    // Magnitude 5 — enough to feel like a non-linear drift-in but small
    // enough that the focused orb stays well within the frame the whole time.
    this.arrivalOffset.copy(randomArrivalOffset(5));
    this.arrivalSpring.reset();
    this.arrivalSpring.velocity.copy(this.arrivalOffset.clone().multiplyScalar(-0.4));
    this.arrivalActive = true;
  }

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

    // Vy\u014dma sits at the SAME distance as Shunya orbs (z=26) from arrival \u2014
    // no fly-in. This matches the click-zone size users see in the void.
    const z = 26;

    this.targetOffset.set(
      px * 1.8 + Math.sin(t * 0.4) * 0.8,
      py * 1.1 + Math.cos(t * 0.3) * 0.8,
      0
    );
    this.offset.lerp(this.targetOffset, 1 - Math.pow(0.005, dt * 60));
    this.camera.position.set(this.offset.x, this.offset.y, z);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
  }

  private updateShunya(dt: number) {
    const progress = this.deps.scroll.loopProgress;
    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;

    // Camera position springs toward the path target — arrogant feel
    // (stiffness 6, damping 3.5 gives a confident, slight-overshoot arrival).
    const targetPos = this.shunyaPath.cameraAt(progress);
    this.posSpring.step(this.currentCamPos, targetPos, dt, 6.0, 3.5);

    // Look-at follows the focused orb's CURRENT world position (drift included).
    const shunyaRealm = (this.deps.realms as any).shunya;
    let lookTarget: THREE.Vector3;
    if (shunyaRealm && shunyaRealm.getFocusedWorldPosition) {
      const focusedHome = SHUNYA_ORBS[shunyaRealm.activeIndex].position;
      const focusedLive = shunyaRealm.getFocusedWorldPosition();
      const focus = shunyaRealm.activeFocus ?? 0;
      lookTarget = new THREE.Vector3().lerpVectors(focusedHome, focusedLive, focus);
    } else {
      lookTarget = this.shunyaPath.lookAt(progress);
    }
    // Tighter spring on look-at so the orb stays crisp on screen.
    this.lookSpring.step(this.currentLookAt, lookTarget, dt, 9.0, 4.5);

    // Decay the arrival offset (if active) — stiffer than the path spring so
    // it settles in ~1.2s (instead of dragging the camera off-axis for 8s).
    if (this.arrivalActive) {
      const ZERO = new THREE.Vector3(0, 0, 0);
      this.arrivalSpring.step(this.arrivalOffset, ZERO, dt, 16.0, 7.8);
      if (this.arrivalOffset.lengthSq() < 0.001 && this.arrivalSpring.velocity.lengthSq() < 0.001) {
        this.arrivalOffset.set(0, 0, 0);
        this.arrivalSpring.reset();
        this.arrivalActive = false;
      }
    }

    // Tiny pointer parallax sway, matching the gateway's subtle camera drift.
    const sway = new THREE.Vector3(px * 0.8, py * 0.5, 0);
    this.camera.position.copy(this.currentCamPos).add(sway).add(this.arrivalOffset);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = 38;    // identical to Vyōma
    this.camera.updateProjectionMatrix();
  }
}
