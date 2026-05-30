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
   * Snap the camera + look-target instantly to a specific Shunya orb.
   * Called on deep-link entry so the user doesn't watch the camera
   * spring 200+ units across the void — they arrive parked on the orb.
   */
  snapToShunyaOrb(idx: number) {
    const total = SHUNYA_ORBS.length;
    const safe = ((idx % total) + total) % total;
    const orb = SHUNYA_ORBS[safe];
    if (!orb) return;
    const target = orb.position.clone();
    this.currentLookAt.copy(target);
    this.currentCamPos.copy(target).add(new THREE.Vector3(0, 3, 26));
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
    this.posSpring.reset();
    this.lookSpring.reset();
  }
  snapToVistaraProduct(idx: number) {
    const total = VISTARA_PRODUCTS.length;
    const safe = ((idx % total) + total) % total;
    const p = VISTARA_PRODUCTS[safe];
    if (!p) return;
    const target = p.position.clone();
    this.currentLookAt.copy(target);
    this.currentCamPos.copy(target).add(new THREE.Vector3(0, 3, 26));
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
    this.posSpring.reset();
    this.lookSpring.reset();
  }

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

    // ORIGINAL gateway fly-in (per user request, restored from canonical zip):
    // Camera lerps from z=280 (Vy\u014dma is a distant glint) \u2192 z=26 (full Vy\u014dma
    // mesh fills the frame, ready for "Initiate Displacement").
    // Drive: realms.activeApproach (0..1) derived from scroll progress.
    const p = (this.deps.realms as any).activeApproach ?? 0;
    const z = THREE.MathUtils.lerp(280, 26, p);

    this.targetOffset.set(
      px * 1.8 + Math.sin(t * 0.4) * 0.8,
      py * 1.1 + Math.cos(t * 0.3) * 0.8,
      0,
    );
    this.offset.lerp(this.targetOffset, 1 - Math.pow(0.005, dt * 60));
    this.camera.position.set(this.offset.x, this.offset.y, z);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov = 38 + Math.min(p * 5.5, 5.5);
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

    // PHASE 4 — CINEMATIC NODE FOCUS. When a specific socket is selected
    // (Vist\u0101ra product OR Medh\u0101 model), shift the look-target subtly toward
    // that socket's world position. Combined with the FOV pull below, this
    // gives a "camera cinematically turns to face the node" feel without
    // teleporting away from the orb.
    try {
      const ix = (window as any).__vyanIX?.get?.();
      const tgtKey = ix?.target;
      const nodeKey = ix?.node;
      if (tgtKey && nodeKey && realm?.getOrbByKey) {
        const orb = realm.getOrbByKey(tgtKey);
        if (orb?.socketGroup?.children?.length) {
          // Find the hit-sphere with matching productKey.
          const sock = orb.socketGroup.children.find((c: any) =>
            c.userData?.isProductSocket && c.userData?.productKey === nodeKey && c.geometry,
          );
          if (sock) {
            const sockWorld = new THREE.Vector3();
            sock.getWorldPosition(sockWorld);
            // Move ~40% toward the socket so the orb stays in frame.
            const focusAmount = Math.max(0, Math.min(0.4, (ix.progress ?? 0) * 0.4));
            lookTarget.lerp(sockWorld, focusAmount);
          }
        }
      }
    } catch {}

    this.lookSpring.step(this.currentLookAt, lookTarget, dt, 9.0, 4.5);

    // EQUALIZATION FIX (item 2): camera is ALWAYS look-target + (0,3,26).
    // No catmullrom blend — guarantees identical on-screen size for every
    // orb regardless of where it sits in world space (Medhā at z=-360,
    // Udbhava at z=0, Sandhi at z=-220, etc.). The look-target itself is
    // spring-lerped between adjacent orbs, so motion stays cinematic; the
    // camera just rides 26 units behind it dead-on every frame.
    const targetPos = this.currentLookAt.clone().add(new THREE.Vector3(0, 3, 26));
    this.posSpring.step(this.currentCamPos, targetPos, dt, 6.0, 3.5);

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
    // PHASE 2: subtle FOV focus-pull when an orb unfolds in-place. FOV
    // tightens from 38 \u2192 32 as expansion progresses, giving a cinematic
    // dolly-in without losing the orb out of frame.
    let exp = 0;
    try {
      const ex = (window as any).__vyanExpansion;
      if (ex && ex.target) exp = Math.max(0, Math.min(1, ex.progress ?? 0));
    } catch {}
    this.camera.fov = 38 - exp * 6;
    this.camera.updateProjectionMatrix();
  }

  private updateShunya(dt: number) {
    this.updateVoid(dt, this.shunyaPath, (this.deps.realms as any).shunya, SHUNYA_ORBS);
  }
}
