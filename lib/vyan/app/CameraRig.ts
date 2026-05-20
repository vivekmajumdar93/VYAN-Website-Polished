import * as THREE from 'three';
import { PathCurve, SHUNYA_ORBS } from '../scenes/PathCurve';
import { VistaraPath, VISTARA_PRODUCTS } from '../scenes/VistaraPath';
import { SpringV3, randomArrivalOffset } from './Spring';

type Deps = {
  scroll: { progress: number; speed: number; loopProgress: number };
  interaction: { pointer: { x: number; y: number } };
  realms: { activeApproach: number; mode?: string; shunya?: any; vistara?: any };
};

export type CameraMode = 'gateway' | 'shunya' | 'vistara';

export class CameraRig {
  private deps!: Deps;
  private offset = new THREE.Vector3();
  private targetOffset = new THREE.Vector3();
  private mode: CameraMode = 'gateway';
  private shunyaPath = new PathCurve(SHUNYA_ORBS);
  private vistaraPath = new VistaraPath(VISTARA_PRODUCTS);
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
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
      this.currentLookAt.copy(SHUNYA_ORBS[0].position);
    } else if (mode === 'vistara') {
      const p = this.vistaraPath.cameraAt(0);
      this.camera.position.copy(p);
      this.currentCamPos.copy(p);
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
      this.currentLookAt.copy(VISTARA_PRODUCTS[0].position);
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
      this.updateVoid(dt, this.shunyaPath, (this.deps.realms as any).shunya, SHUNYA_ORBS);
      return;
    }
    if (this.mode === 'vistara') {
      this.updateVoid(dt, this.vistaraPath, (this.deps.realms as any).vistara, VISTARA_PRODUCTS);
      return;
    }
    this.updateGateway(dt);
  }

  private updateGateway(dt: number) {
    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;
    const t = performance.now() * 0.001;

    // Vy\u014dma is DISTANT from arrival \u2014 so "Initiate Displacement" actually
    // means something: the user is far away and the click warps them in.
    // Camera sits at z=88 (instead of z=26 in the void) so the orb appears
    // small but central, hover-pulsing in the dark like a beckoning star.
    const z = 88;

    this.targetOffset.set(
      px * 3.2 + Math.sin(t * 0.4) * 1.6,
      py * 2.0 + Math.cos(t * 0.3) * 1.2,
      0,
    );
    this.offset.lerp(this.targetOffset, 1 - Math.pow(0.005, dt * 60));
    this.camera.position.set(this.offset.x, this.offset.y, z);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
  }

  private updateVoid(
    dt: number,
    path: { cameraAt: (p: number) => THREE.Vector3; lookAt: (p: number, oi?: any) => THREE.Vector3 },
    realm: any,
    defs: Array<{ position: THREE.Vector3 }>
  ) {
    const progress = this.deps.scroll.loopProgress;
    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;

    // Camera position springs toward the path target \u2014 user-specified
    // arrogant feel (stiffness 6 / damping 3.5 = confident slight overshoot).
    const targetPos = path.cameraAt(progress);
    this.posSpring.step(this.currentCamPos, targetPos, dt, 6.0, 3.5);

    // Look-at follows focused orb's live world position (drift included).
    let lookTarget: THREE.Vector3;
    if (realm && realm.getFocusedWorldPosition) {
      const focusedHome = defs[realm.activeIndex].position;
      const focusedLive = realm.getFocusedWorldPosition();
      const focus = realm.activeFocus ?? 0;
      lookTarget = new THREE.Vector3().lerpVectors(focusedHome, focusedLive, focus);
    } else {
      lookTarget = path.lookAt(progress);
    }
    this.lookSpring.step(this.currentLookAt, lookTarget, dt, 9.0, 4.5);

    // Decay the arrival offset (if active).
    if (this.arrivalActive) {
      const ZERO = new THREE.Vector3(0, 0, 0);
      this.arrivalSpring.step(this.arrivalOffset, ZERO, dt, 16.0, 7.8);
      if (this.arrivalOffset.lengthSq() < 0.001 && this.arrivalSpring.velocity.lengthSq() < 0.001) {
        this.arrivalOffset.set(0, 0, 0);
        this.arrivalSpring.reset();
        this.arrivalActive = false;
      }
    }

    const sway = new THREE.Vector3(px * 0.8, py * 0.5, 0);
    this.camera.position.copy(this.currentCamPos).add(sway).add(this.arrivalOffset);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
  }

  private updateShunya(dt: number) {
    this.updateVoid(dt, this.shunyaPath, (this.deps.realms as any).shunya, SHUNYA_ORBS);
  }
}
