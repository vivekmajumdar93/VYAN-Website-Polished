import * as THREE from 'three';
import gsap from 'gsap';
import { NanoOrb } from '../../objects/NanoOrb';

type BindDeps = {
  interaction: any;
  camera: THREE.PerspectiveCamera;
  cameraRig?: any;
  overlay: any;
  scroll: any;
  audio?: any;
  onEnterVoid?: () => void;
};

export class GatewayRealm {
  public group = new THREE.Group();
  public id = 'gateway';
  public range: [number, number] = [0.0, 1.01];

  private core = new NanoOrb(
    {
      id: 'gateway-core',
      title: 'VYAN primordial Core',
      subtitle: 'Gateway resonance',
      description: 'A distant doorway into the VYAN Void.',
      colorA: '#1a0033',
      colorB: '#b06bff',
    },
    1.9,
    3000
  );

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private deps!: BindDeps;
  private exploded = false;

  constructor() {
    this.group.position.set(0, 0, 0);
    this.core.setHomePosition(new THREE.Vector3(0, 0, 0));
    this.group.add(this.core.group);
    this.group.add(this.core.trailGroup);
  }

  bind(deps: BindDeps) {
    this.deps = deps;
  }

  onEnter() {
    this.exploded = false;
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.core.setVisible(true);
    this.core.reset();
    if (this.deps?.cameraRig) this.deps.cameraRig.locked = false;
    this.deps?.overlay?.setVoidMode?.(false);
    this.deps?.overlay?.clearFade?.();
    if (this.deps?.scroll) this.deps.scroll.snapSlots = 0;
  }

  onExit() {
    this.group.visible = false;
    this.core.setVisible(false);
  }

  update(_: number, t: number, progress: number, audio: any) {
    if (!this.deps) return;

    // Vyōma always sits at the click zone — caption + click are always live.
    const approach = 1;
    const energy = audio.energy ?? 0;

    this.core.setVisible(true);
    this.core.update(t, energy, approach > 0.01, false, approach);

    const moved =
      this.deps.interaction.pointerRaw.x !== 0 || this.deps.interaction.pointerRaw.y !== 0;
    this.deps.overlay.setCursorHint(moved);
    this.deps.overlay.setGatewayCaption(approach);

    if (this.exploded) return;

    if (this.deps.interaction.clicked && approach > 0.34) {
      this.ndc.set(this.deps.interaction.pointer.x, this.deps.interaction.pointer.y);
      this.raycaster.setFromCamera(this.ndc, this.deps.camera);

      const hit = this.raycaster.intersectObject(this.core.hitMesh, true);
      const centeredClick = Math.abs(this.ndc.x) < 0.34 && Math.abs(this.ndc.y) < 0.24;

      if (hit.length > 0 || centeredClick) {
        this.triggerBurst();
      }
    }
  }

  private triggerBurst() {
    if (this.exploded) return;
    this.exploded = true;

    this.deps.scroll.freeze();
    this.core.burst();
    if (this.deps.cameraRig) this.deps.cameraRig.locked = true;

    // Audio: punch on burst → swell during the warp → duck into the fade.
    this.deps.audio?.swell?.(1.1, 0.35);

    gsap.to(this.deps.camera.position, {
      z: 4.8, duration: 0.9, ease: 'power4.in', overwrite: true,
    });
    gsap.to(this.deps.camera.position, {
      x: '+=0.18', y: '+=0.1', duration: 0.55,
      yoyo: true, repeat: 1, ease: 'sine.inOut', overwrite: true,
    });
    gsap.to(this.deps.camera, {
      fov: 30, duration: 0.75, ease: 'power3.inOut',
      onUpdate: () => this.deps.camera.updateProjectionMatrix(),
    });

    setTimeout(() => {
      gsap.to(this.group.scale, {
        x: 0.001, y: 0.001, z: 0.001,
        duration: 2.0, ease: 'power4.inOut',
        onComplete: () => { this.group.visible = false; },
      });
      this.deps.overlay.fadeToBlack?.(2.5);
      // Duck audio in sync with the fade-to-black (silence at the threshold).
      this.deps.audio?.duck?.(0.05, 2.4);

      // After the fade fully blacks out, hand control to the React page.
      setTimeout(() => {
        try { this.deps.onEnterVoid?.(); } catch {}
      }, 2500);
    }, 900);
  }
}
