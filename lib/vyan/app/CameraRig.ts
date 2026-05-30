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

  // PHASE 6 — cinematic Vistāra node-change "fly-over".
  // When the active socket key changes while target = 'vistara', we kick a
  // transient FOV "punch" (38 → 30 → 38) over ~0.9s and momentarily boost the
  // look-at lerp toward the new socket, so the camera *swings* to face it.
  private lastNodeKey: string | null = null;
  private nodeChangeAt: number = 0;
  private nodeChangeDur: number = 900; // ms

  /** Public: called when route changes to a new Vistāra product to trigger the cinematic. */
  public pulseNodeChange() {
    this.nodeChangeAt = performance.now();
  }

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
    // (Vistāra product OR Medhā model), shift the look-target subtly toward
    // that socket's world position. Combined with the FOV pull below, this
    // gives a "camera cinematically turns to face the node" feel without
    // teleporting away from the orb.
    //
    // PHASE 6 — Vistāra node-change "fly-over". When the active socket key
    // changes (e.g. /vistara/ritam → /vistara/sutra) we briefly amplify the
    // look-at commitment (40% → 70%) and trigger an FOV punch via
    // `pulseNodeChange()`. The transient eases out over `nodeChangeDur` ms.
    let focusBoost = 0;
    try {
      const ix = (window as any).__vyanIX?.get?.();
      const tgtKey = ix?.target;
      const nodeKey = ix?.node;
      if (tgtKey && nodeKey && realm?.getOrbByKey) {
        // Detect a node-key change → kick the cinematic.
        if (nodeKey !== this.lastNodeKey && this.lastNodeKey !== null && tgtKey === 'vistara') {
          this.pulseNodeChange();
        }
        this.lastNodeKey = nodeKey;

        const orb = realm.getOrbByKey(tgtKey);
        if (orb?.socketGroup?.children?.length) {
          // Find the hit-sphere with matching productKey.
          const sock = orb.socketGroup.children.find((c: any) =>
            c.userData?.isProductSocket && c.userData?.productKey === nodeKey && c.geometry,
          );
          if (sock) {
            const sockWorld = new THREE.Vector3();
            sock.getWorldPosition(sockWorld);
            // Base: 40% lerp during steady state. Burst: ramps up to +30% during
            // the node-change pulse so the camera visibly swings to the new socket.
            const t = (performance.now() - this.nodeChangeAt) / this.nodeChangeDur;
            const pulseEnv = t < 0 || t > 1 ? 0 : Math.sin(t * Math.PI); // 0 → 1 → 0 over the duration
            focusBoost = pulseEnv * 0.3;
            const baseFocus = Math.max(0, Math.min(0.4, (ix.progress ?? 0) * 0.4));
            const focusAmount = Math.min(0.85, baseFocus + focusBoost);
            lookTarget.lerp(sockWorld, focusAmount);
          }
        }
      } else {
        this.lastNodeKey = null;
      }
    } catch {}

    this.lookSpring.step(this.currentLookAt, lookTarget, dt, 9.0, 4.5);

    // EQUALIZATION FIX (item 2): camera is ALWAYS look-target + (0,3,26).
    // No catmullrom blend — guarantees identical on-screen size for every
    // orb regardless of where it sits in world space (Medhā at z=-360,
    // Udbhava at z=0, Sandhi at z=-220, etc.). The look-target itself is
    // spring-lerped between adjacent orbs, so motion stays cinematic; the
    // camera just rides 26 units behind it dead-on every frame.
    //
    // PHASE 8 (#6 stronger Vistāra cinematic) — during the node-change
    // punch envelope, the camera also DOLLIES toward the orb (Z -5) and
    // sweeps a small arc around the focal axis (X ±3, Y +2) so the
    // transition between products feels like a fly-over rather than a
    // subtle look-tilt. The envelope is the same sin(t·π) so all cinematic
    // components (FOV, look-lerp, position) peak together.
    const tPunchPos = (performance.now() - this.nodeChangeAt) / this.nodeChangeDur;
    const punchPosEnv = tPunchPos < 0 || tPunchPos > 1 ? 0 : Math.sin(tPunchPos * Math.PI);
    // Sign the arc direction with the node-key hash so different products
    // arc to different sides — feels less repetitive.
    const arcSign = this.lastNodeKey
      ? (this.lastNodeKey.charCodeAt(0) % 2 === 0 ? 1 : -1)
      : 1;
    const dollyZ = -5 * punchPosEnv;             // dolly 5 units closer at peak
    const arcX   = 3 * punchPosEnv * arcSign;    // sweep ±3 units sideways
    const liftY  = 2 * punchPosEnv;              // tilt up 2 units at peak
    const targetPos = this.currentLookAt.clone().add(
      new THREE.Vector3(arcX, 3 + liftY, 26 + dollyZ)
    );
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
    // tightens from 38 → 32 as expansion progresses, giving a cinematic
    // dolly-in without losing the orb out of frame.
    //
    // PHASE 6: ADD a transient FOV PUNCH (extra –4) on Vistāra node change
    // so the cinematic feels like a "dolly-zoom" toward the new socket.
    let exp = 0;
    try {
      const ex = (window as any).__vyanExpansion;
      if (ex && ex.target) exp = Math.max(0, Math.min(1, ex.progress ?? 0));
    } catch {}
    const tPunch = (performance.now() - this.nodeChangeAt) / this.nodeChangeDur;
    const punchEnv = tPunch < 0 || tPunch > 1 ? 0 : Math.sin(tPunch * Math.PI); // ease in-out
    this.camera.fov = 38 - exp * 6 - punchEnv * 4;
    this.camera.updateProjectionMatrix();
  }

  private updateShunya(dt: number) {
    this.updateVoid(dt, this.shunyaPath, (this.deps.realms as any).shunya, SHUNYA_ORBS);
  }
}
