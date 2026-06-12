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

// ─────────────────────────────────────────────────────────────────────────────
// Orb-expansion state machine
// When a Vistāra or Medhā orb expands, the camera dollies toward the orb
// centre and the FOV tightens so the orb fills ~85% of the viewport.
// When a subnode is clicked, the camera flies to that node position and hovers
// for HOVER_DWELL_MS before the panel emerges. On panel close the camera
// springs back to the pre-expansion orbital position.
// ─────────────────────────────────────────────────────────────────────────────
type FlyPhase =
  | 'orbital'       // normal path-following
  | 'expanding'     // orb growing to fill screen
  | 'orb-full'      // orb fills screen, nodes visible
  | 'flying-node'   // camera flying to selected node
  | 'hover-node'    // camera hovering at node (panel about to open)
  | 'returning'     // camera returning to orbital after panel close
  | 'medha-node';   // camera flown to Medhā's node perspective

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

  // ── Expansion / fly-to-node state ──────────────────────────────────────────
  private flyPhase: FlyPhase = 'orbital';
  private flyTarget = new THREE.Vector3();        // world pos of the selected node
  private flyOrbCenter = new THREE.Vector3();     // world pos of the expanded orb
  private preExpansionPos = new THREE.Vector3();  // camera pos before expansion began
  private preExpansionLook = new THREE.Vector3(); // look-at before expansion
  private hoverStartAt = 0;                       // performance.now() when hover began
  private onHoverComplete: (() => void) | null = null;
  private flySpring = new SpringV3();
  private flyLookSpring = new SpringV3();
  private currentFlyPos = new THREE.Vector3();
  private currentFlyLook = new THREE.Vector3();

  // ── Vistāra node-change cinematic (preserved from Phase 8) ─────────────────
  private lastNodeKey: string | null = null;
  private nodeChangeAt: number = 0;
  private readonly nodeChangeDur: number = 900;

  /** Called by CosmicCanvas when route changes to a new Vistāra product. */
  public pulseNodeChange() {
    this.nodeChangeAt = performance.now();
  }

  // ── Constants ───────────────────────────────────────────────────────────────
  // How long the camera hovers at the node before signalling panel-open (ms).
  // 600ms — enough to feel cinematic without blank-screen lag.
  private static readonly HOVER_DWELL_MS = 600;
  // How close the camera gets to the orb centre when fully expanded (units from orb).
  private static readonly EXPAND_DIST = 14;
  // How far the camera sits from a node when flying to it.
  private static readonly NODE_FLY_DIST = 8;
  // Spring params for expansion fly-in (confident, arrogant feel).
  private static readonly EXP_STIFFNESS = 5.0;
  private static readonly EXP_DAMPING   = 3.2;
  // Spring params for node fly-to (decisive).
  private static readonly NODE_STIFFNESS = 7.0;
  private static readonly NODE_DAMPING   = 3.8;
  // Spring params for return-to-orbital (smooth, unhurried).
  private static readonly RET_STIFFNESS  = 4.5;
  private static readonly RET_DAMPING    = 3.0;

  public locked = false;

  constructor(private camera: THREE.PerspectiveCamera) {}

  bind(deps: Deps) {
    this.deps = deps;
    this.camera.position.set(0, 0, 280);
    this.offset.set(0, 0, 0);
  }

  setMode(mode: CameraMode) {
    this.mode = mode;
    this.locked = false;
    this.flyPhase = 'orbital';
    this.posSpring.reset();
    this.lookSpring.reset();
    this.flySpring.reset();
    this.flyLookSpring.reset();
    if (mode === 'shunya') {
      const p = this.shunyaPath.cameraAt(0);
      this.camera.position.copy(p);
      this.currentCamPos.copy(p);
      this.currentFlyPos.copy(p);
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
      this.currentLookAt.copy(SHUNYA_ORBS[0].position);
      this.currentFlyLook.copy(SHUNYA_ORBS[0].position);
    } else if (mode === 'vistara') {
      const p = this.vistaraPath.cameraAt(0);
      this.camera.position.copy(p);
      this.currentCamPos.copy(p);
      this.currentFlyPos.copy(p);
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
      this.currentLookAt.copy(VISTARA_PRODUCTS[0].position);
      this.currentFlyLook.copy(VISTARA_PRODUCTS[0].position);
    } else {
      this.camera.position.set(0, 0, 280);
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
    }
  }

  getMode() { return this.mode; }

  // ── Snap methods (deep-link entry) ──────────────────────────────────────────
  snapToShunyaOrb(idx: number) {
    const total = SHUNYA_ORBS.length;
    const safe = ((idx % total) + total) % total;
    const orb = SHUNYA_ORBS[safe];
    if (!orb) return;
    const target = orb.position.clone();
    this.currentLookAt.copy(target);
    this.currentFlyLook.copy(target);
    const pos = target.clone().add(new THREE.Vector3(0, 3, 26));
    this.currentCamPos.copy(pos);
    this.currentFlyPos.copy(pos);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.currentLookAt);
    this.posSpring.reset();
    this.lookSpring.reset();
    this.flySpring.reset();
    this.flyLookSpring.reset();
    this.flyPhase = 'orbital';
  }

  snapToVistaraProduct(idx: number) {
    const total = VISTARA_PRODUCTS.length;
    const safe = ((idx % total) + total) % total;
    const p = VISTARA_PRODUCTS[safe];
    if (!p) return;
    const target = p.position.clone();
    this.currentLookAt.copy(target);
    this.currentFlyLook.copy(target);
    const pos = target.clone().add(new THREE.Vector3(0, 3, 26));
    this.currentCamPos.copy(pos);
    this.currentFlyPos.copy(pos);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.currentLookAt);
    this.posSpring.reset();
    this.lookSpring.reset();
    this.flyPhase = 'orbital';
  }

  // ── Cinematic arrival (ShunyaRealm.onEnter) ─────────────────────────────────
  triggerArrival() {
    this.arrivalOffset.copy(randomArrivalOffset(5));
    this.arrivalSpring.reset();
    this.arrivalSpring.velocity.copy(this.arrivalOffset.clone().multiplyScalar(-0.4));
    this.arrivalActive = true;
  }

  // ── Orb expansion: camera dollies toward orb until it fills screen ──────────
  /**
   * Call this when Vistāra or Medhā orb is clicked.
   * orbWorldPos: the live world position of the orb.
   */
  beginOrbExpansion(orbWorldPos: THREE.Vector3) {
    if (this.flyPhase !== 'orbital') return;
    this.preExpansionPos.copy(this.camera.position);
    this.preExpansionLook.copy(this.currentLookAt);
    this.flyOrbCenter.copy(orbWorldPos);
    this.flyPhase = 'expanding';
    this.currentFlyPos.copy(this.camera.position);
    this.currentFlyLook.copy(this.currentLookAt);
    this.flySpring.reset();
    this.flyLookSpring.reset();
  }

  // ── Node fly-to: camera flies from orb-fill view toward selected node ───────
  /**
   * Call this when a subnode is clicked.
   * nodeWorldPos: world position of the clicked node.
   * onHoverComplete: called after HOVER_DWELL_MS hover — panel should open then.
   */
  flyToNode(nodeWorldPos: THREE.Vector3, onHoverComplete: () => void) {
    if (this.flyPhase !== 'orb-full' && this.flyPhase !== 'hover-node') return;
    this.flyTarget.copy(nodeWorldPos);
    this.onHoverComplete = onHoverComplete;
    this.flyPhase = 'flying-node';
    this.flySpring.reset();
    this.flyLookSpring.reset();
  }

  // ── Return to orbital view (panel close) ─────────────────────────────────────
  returnToOrbital() {
    if (this.flyPhase === 'orbital') return;
    this.flyPhase = 'returning';
    this.flySpring.reset();
    this.flyLookSpring.reset();
    this.onHoverComplete = null;
  }

  // ── Medhā node perspective: camera flies to a view FROM the node looking
  //    through the orb. All other nodes remain visible at depth. No panel opens.
  //    The 5 nodes form a constellation — depth is created by the ~10-unit
  //    spread of their surface positions relative to the camera.
  //
  //    nodeWorldPos: world position of the selected model node on the orb surface
  //    orbCenter:    world position of the Medhā orb centre
  //
  //    Camera ends up: OUTSIDE the orb on the node's radial axis, looking inward
  //    so the selected node is close (~8 units) and the other 4 are visible at
  //    depth through the orb lattice.
  flyToMedhaNodePerspective(nodeWorldPos: THREE.Vector3, orbCenter: THREE.Vector3) {
    if (this.flyPhase === 'orb-full' ||
        this.flyPhase === 'hover-node' ||
        this.flyPhase === 'medha-node') {
      // Already in orb context — just re-fly to new node
    } else if (this.flyPhase !== 'orbital') {
      return;
    }

    // Direction from orb centre to the node (outward radial)
    const radial = nodeWorldPos.clone().sub(orbCenter).normalize();

    // Camera sits just OUTSIDE the node on the radial axis, looking back at
    // the orb. Distance: EXPAND_DIST keeps the full orb in frame with all nodes.
    // 18 units gives a field where the near node is ~8u away and the far
    // nodes on the opposite side are ~28u away — good depth range.
    this.flyTarget.copy(nodeWorldPos.clone().add(radial.multiplyScalar(18)));
    this.flyOrbCenter.copy(orbCenter);

    this.flyPhase = 'medha-node';
    this.flySpring.reset();
    this.flyLookSpring.reset();
    this.currentFlyPos.copy(this.camera.position);
    this.currentFlyLook.copy(this.currentLookAt);
    this.preExpansionPos.copy(this.camera.position);
    this.preExpansionLook.copy(this.currentLookAt);
  }

  // ── Return to orb-full from Medhā node perspective ───────────────────────
  returnToMedhaOrbFull() {
    this.flyPhase = 'orb-full';
    this.flySpring.reset();
    this.flyLookSpring.reset();
  }

  // ── Main update ─────────────────────────────────────────────────────────────
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

  // ── Gateway mode ─────────────────────────────────────────────────────────────
  private updateGateway(dt: number) {
    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;
    const t = performance.now() * 0.001;
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

  // ── Void mode (Shunya / Vistāra) ─────────────────────────────────────────────
  private updateVoid(
    dt: number,
    path: { cameraAt: (p: number) => THREE.Vector3; lookAt: (p: number, oi?: any) => THREE.Vector3 },
    realm: any,
    defs: Array<{ position: THREE.Vector3 }>,
  ) {
    // ── Check InteractionState for orb expansion ──────────────────────────────
    try {
      const ix = (window as any).__vyanIX?.get?.();
      if (ix && ix.target && realm?.getOrbByKey) {
        const orb = realm.getOrbByKey(ix.target);
        if (orb) {
          const orbPos = orb.group.position.clone();

          // Transition from orbital → expanding when expansion starts
          if (ix.phase === 'unfolding' && ix.progress > 0.05 && this.flyPhase === 'orbital') {
            this.beginOrbExpansion(orbPos);
          }
          // Transition expanding → orb-full when fully expanded
          if ((ix.phase === 'expanded') && this.flyPhase === 'expanding') {
            this.flyPhase = 'orb-full';
          }
          // Fold back: return to orbital when folding
          if ((ix.phase === 'folding' || ix.phase === 'dormant') &&
              (this.flyPhase === 'orb-full' || this.flyPhase === 'hover-node')) {
            this.returnToOrbital();
          }
        }
      } else if (this.flyPhase !== 'orbital' && this.flyPhase !== 'returning') {
        // No active expansion target — ensure we return
        this.returnToOrbital();
      }
    } catch {}

    // ── Delegate to the appropriate sub-updater ───────────────────────────────
    switch (this.flyPhase) {
      case 'expanding':
        this.updateExpanding(dt);
        return;
      case 'orb-full':
        this.updateOrbFull(dt);
        return;
      case 'flying-node':
        this.updateFlyingNode(dt);
        return;
      case 'hover-node':
        this.updateHoverNode(dt);
        return;
      case 'returning':
        this.updateReturning(dt);
        return;
      case 'medha-node':
        this.updateMedhaNode(dt);
        return;
      default:
        this.updateOrbital(dt, path, realm, defs);
    }
  }

  // ── Orbital: normal path following ────────────────────────────────────────
  private updateOrbital(
    dt: number,
    path: { cameraAt: (p: number) => THREE.Vector3; lookAt: (p: number, oi?: any) => THREE.Vector3 },
    realm: any,
    defs: Array<{ position: THREE.Vector3 }>,
  ) {
    const progress = this.deps.scroll.loopProgress;
    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;

    let lookTarget: THREE.Vector3;
    if (realm?.getFocusedWorldPosition) {
      const focusedHome = defs[realm.activeIndex ?? 0].position;
      const focusedLive = realm.getFocusedWorldPosition();
      const focus = realm.activeFocus ?? 0;
      lookTarget = new THREE.Vector3().lerpVectors(focusedHome, focusedLive, focus);
    } else {
      lookTarget = path.lookAt(progress);
    }

    // Node-key focus boost (Phase 6 cinematic preserved)
    let focusBoost = 0;
    try {
      const ix = (window as any).__vyanIX?.get?.();
      const tgtKey = ix?.target;
      const nodeKey = ix?.node;
      if (tgtKey && nodeKey && realm?.getOrbByKey) {
        if (nodeKey !== this.lastNodeKey && this.lastNodeKey !== null && tgtKey === 'vistara') {
          this.pulseNodeChange();
        }
        this.lastNodeKey = nodeKey;
        const orb = realm.getOrbByKey(tgtKey);
        if (orb?.socketGroup?.children?.length) {
          const sock = orb.socketGroup.children.find((c: any) =>
            c.userData?.isProductSocket && c.userData?.productKey === nodeKey && c.geometry,
          );
          if (sock) {
            const sockWorld = new THREE.Vector3();
            sock.getWorldPosition(sockWorld);
            const t = (performance.now() - this.nodeChangeAt) / this.nodeChangeDur;
            const pulseEnv = t < 0 || t > 1 ? 0 : Math.sin(t * Math.PI);
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

    // Camera position: always look-target + constant offset
    const tPunchPos = (performance.now() - this.nodeChangeAt) / this.nodeChangeDur;
    const punchPosEnv = tPunchPos < 0 || tPunchPos > 1 ? 0 : Math.sin(tPunchPos * Math.PI);
    const arcSign = this.lastNodeKey
      ? (this.lastNodeKey.charCodeAt(0) % 2 === 0 ? 1 : -1) : 1;
    const dollyZ = -5 * punchPosEnv;
    const arcX   =  3 * punchPosEnv * arcSign;
    const liftY  =  2 * punchPosEnv;
    const targetPos = this.currentLookAt.clone().add(
      new THREE.Vector3(arcX, 3 + liftY, 26 + dollyZ),
    );
    this.posSpring.step(this.currentCamPos, targetPos, dt, 6.0, 3.5);

    // Arrival offset decay
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

    // FOV: tighten during expansion progress + node-change punch
    let exp = 0;
    try {
      const ex = (window as any).__vyanExpansion;
      if (ex?.target) exp = Math.max(0, Math.min(1, ex.progress ?? 0));
    } catch {}
    const tPunch = (performance.now() - this.nodeChangeAt) / this.nodeChangeDur;
    const punchEnv = tPunch < 0 || tPunch > 1 ? 0 : Math.sin(tPunch * Math.PI);
    this.camera.fov = 38 - exp * 6 - punchEnv * 4;
    this.camera.updateProjectionMatrix();
  }

  // ── Expanding: camera dollies toward orb centre ───────────────────────────
  private updateExpanding(dt: number) {
    // Target: sit EXPAND_DIST units in front of the orb, looking straight at it
    const dir = this.camera.position.clone().sub(this.flyOrbCenter).normalize();
    const targetPos = this.flyOrbCenter.clone().add(dir.multiplyScalar(CameraRig.EXPAND_DIST));

    this.flySpring.step(this.currentFlyPos, targetPos, dt,
      CameraRig.EXP_STIFFNESS, CameraRig.EXP_DAMPING);
    this.flyLookSpring.step(this.currentFlyLook, this.flyOrbCenter, dt, 8.0, 4.0);

    this.camera.position.copy(this.currentFlyPos);
    this.camera.lookAt(this.currentFlyLook);

    // FOV narrows as we approach — orb fills ~85% of viewport at full
    const dist = this.currentFlyPos.distanceTo(this.flyOrbCenter);
    const fillT = THREE.MathUtils.clamp(1 - (dist - CameraRig.EXPAND_DIST) / 20, 0, 1);
    this.camera.fov = THREE.MathUtils.lerp(38, 22, fillT * fillT);
    this.camera.updateProjectionMatrix();

    // Sync currentCamPos / currentLookAt for seamless transition back
    this.currentCamPos.copy(this.currentFlyPos);
    this.currentLookAt.copy(this.currentFlyLook);
  }

  // ── Orb full: orbiting gently, nodes visible and clickable ────────────────
  private updateOrbFull(dt: number) {
    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;
    // Gentle sway so the orb feels alive
    const sway = new THREE.Vector3(px * 1.2, py * 0.8, 0);
    const targetPos = this.flyOrbCenter.clone().add(
      new THREE.Vector3(0, 0, CameraRig.EXPAND_DIST),
    ).add(sway);
    this.flySpring.step(this.currentFlyPos, targetPos, dt,
      CameraRig.EXP_STIFFNESS, CameraRig.EXP_DAMPING);
    this.flyLookSpring.step(this.currentFlyLook, this.flyOrbCenter, dt, 8.0, 4.0);

    this.camera.position.copy(this.currentFlyPos);
    this.camera.lookAt(this.currentFlyLook);
    this.camera.fov = 22;
    this.camera.updateProjectionMatrix();
    this.currentCamPos.copy(this.currentFlyPos);
    this.currentLookAt.copy(this.currentFlyLook);
  }

  // ── Flying to node: cinematic approach ────────────────────────────────────
  private updateFlyingNode(dt: number) {
    // Target: NODE_FLY_DIST units behind the node, looking at node from orb-side
    const toNode = this.flyTarget.clone().sub(this.flyOrbCenter).normalize();
    const targetPos = this.flyTarget.clone().add(toNode.multiplyScalar(CameraRig.NODE_FLY_DIST));

    this.flySpring.step(this.currentFlyPos, targetPos, dt,
      CameraRig.NODE_STIFFNESS, CameraRig.NODE_DAMPING);
    this.flyLookSpring.step(this.currentFlyLook, this.flyTarget, dt, 10.0, 4.5);

    this.camera.position.copy(this.currentFlyPos);
    this.camera.lookAt(this.currentFlyLook);
    this.camera.fov = 28;
    this.camera.updateProjectionMatrix();

    // Check if we've arrived (spring mostly settled)
    const dist = this.currentFlyPos.distanceTo(targetPos);
    if (dist < 0.6) {
      this.flyPhase = 'hover-node';
      this.hoverStartAt = performance.now();
    }
  }

  // ── Hover at node: subtle drift, waiting for dwell timer ──────────────────
  private updateHoverNode(dt: number) {
    const toNode = this.flyTarget.clone().sub(this.flyOrbCenter).normalize();
    const targetPos = this.flyTarget.clone().add(toNode.multiplyScalar(CameraRig.NODE_FLY_DIST));
    const t = performance.now() * 0.001;
    // Very subtle breathing sway so camera feels alive
    const breathe = new THREE.Vector3(
      Math.sin(t * 0.9) * 0.15,
      Math.cos(t * 0.7) * 0.1,
      0,
    );
    this.flySpring.step(this.currentFlyPos, targetPos.clone().add(breathe), dt, 4.0, 2.8);
    this.flyLookSpring.step(this.currentFlyLook, this.flyTarget, dt, 9.0, 4.0);

    this.camera.position.copy(this.currentFlyPos);
    this.camera.lookAt(this.currentFlyLook);
    this.camera.fov = 28;
    this.camera.updateProjectionMatrix();

    // Fire panel-open callback after dwell
    const elapsed = performance.now() - this.hoverStartAt;
    if (elapsed >= CameraRig.HOVER_DWELL_MS && this.onHoverComplete) {
      const cb = this.onHoverComplete;
      this.onHoverComplete = null;
      try { cb(); } catch {}
    }
  }

  // ── Medhā node perspective: settle into the radial viewpoint ─────────────
  private updateMedhaNode(dt: number) {
    const px = this.deps.interaction.pointer.x;
    const py = this.deps.interaction.pointer.y;
    // Very subtle pointer sway so the view feels alive without drifting
    const sway = new THREE.Vector3(px * 0.6, py * 0.4, 0);
    const target = this.flyTarget.clone().add(sway);

    this.flySpring.step(this.currentFlyPos, target, dt,
      CameraRig.NODE_STIFFNESS, CameraRig.NODE_DAMPING);
    // Look-at: the orb centre so all nodes are framed in the shot
    this.flyLookSpring.step(this.currentFlyLook, this.flyOrbCenter, dt, 8.0, 4.0);

    this.camera.position.copy(this.currentFlyPos);
    this.camera.lookAt(this.currentFlyLook);
    // FOV: slightly wider than node-fly (32) so more of the orb is visible
    // and all 5 nodes fit in frame with depth
    this.camera.fov = 32;
    this.camera.updateProjectionMatrix();
    this.currentCamPos.copy(this.currentFlyPos);
    this.currentLookAt.copy(this.currentFlyLook);
  }

  // ── Returning: spring back to pre-expansion orbital position ─────────────
  private updateReturning(dt: number) {
    this.flySpring.step(this.currentFlyPos, this.preExpansionPos, dt,
      CameraRig.RET_STIFFNESS, CameraRig.RET_DAMPING);
    this.flyLookSpring.step(this.currentFlyLook, this.preExpansionLook, dt, 6.0, 3.2);

    this.camera.position.copy(this.currentFlyPos);
    this.camera.lookAt(this.currentFlyLook);

    // FOV relaxes back to standard
    const dist = this.currentFlyPos.distanceTo(this.preExpansionPos);
    const returnT = THREE.MathUtils.clamp(1 - dist / 20, 0, 1);
    this.camera.fov = THREE.MathUtils.lerp(28, 38, returnT * returnT);
    this.camera.updateProjectionMatrix();

    // Sync orbital tracking so transition is seamless
    this.currentCamPos.copy(this.currentFlyPos);
    this.currentLookAt.copy(this.currentFlyLook);

    // When settled, restore orbital phase
    if (dist < 0.8 && this.flySpring.velocity.lengthSq() < 0.01) {
      this.flyPhase = 'orbital';
      this.currentCamPos.copy(this.preExpansionPos);
      this.currentLookAt.copy(this.preExpansionLook);
      this.posSpring.reset();
      this.lookSpring.reset();
    }
  }
}
