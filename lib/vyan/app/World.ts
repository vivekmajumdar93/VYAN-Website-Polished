import * as THREE from 'three';
import { createComposer, ComposerBundle } from '../post/createComposer';
import { CameraRig } from './CameraRig';
import { SceneManager } from '../scenes/RealmManager';
import { QualityManager } from './QualityManager';

type Deps = {
  scroll: any;
  audio: any;
  interaction: any;
  overlay: any;
};

export class World {
  public scene = new THREE.Scene();
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private clock = new THREE.Clock();
  private cameraRig: CameraRig;
  public realms: SceneManager;
  private deps!: Deps;
  private composerBundle!: ComposerBundle;
  private raf = 0;
  private stopped = false;

  constructor(private root: HTMLElement, private quality: QualityManager) {
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, this.quality.preset.fogDensity);

    this.camera = new THREE.PerspectiveCamera(
      36,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );
    this.camera.position.set(0, 0, 280);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });

    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.quality.pixelRatio());

    root.appendChild(this.renderer.domElement);

    this.composerBundle = createComposer(this.renderer, this.scene, this.camera, this.quality);
    this.composerBundle.fog.setDensity(this.quality.preset.fogDensity);
    this.composerBundle.bloom.strength = this.quality.preset.bloomStrength;
    this.composerBundle.bloom.radius = this.quality.preset.bloomRadius;

    this.cameraRig = new CameraRig(this.camera);
    this.realms = new SceneManager(this.scene);
    this.realms.createScenes();

    this.bindResize();
  }

  bind(deps: Deps, callbacks: {
    onEnterVoid?: () => void;
    onOrbActivate?: (key: any) => void;
    onEnterVistara?: () => void;
    onProductActivate?: (key: any) => void;
    onExitVistara?: () => void;
    onEnterMedha?: () => void;
  } = {}) {
    this.deps = deps;
    this.cameraRig.bind({
      scroll: this.deps.scroll,
      interaction: this.deps.interaction,
      realms: this.realms,
    });
    this.realms.bind({
      ...deps,
      camera: this.camera,
      cameraRig: this.cameraRig,
    }, callbacks);
  }

  setMode(mode: any) {
    this.realms.setMode(mode);
    // Sync cameraRig in the SAME tick so the start-loop auto-sync
    // doesn't subsequently reset currentLookAt and clobber any
    // snapToShunyaOrb that runs immediately after this call.
    if (this.cameraRig.getMode() !== mode) this.cameraRig.setMode(mode);
  }
  focusShunyaOrb(key: any, immediate = false) { this.realms.focusShunyaOrb(key, immediate); }
  getMode() { return this.realms.mode; }

  start() {
    const tick = () => {
      if (this.stopped) return;
      const dt = Math.min(this.clock.getDelta(), 0.033);
      const t = this.clock.elapsedTime;

      this.deps.scroll.update(dt);
      this.deps.interaction.update(dt);

      if (this.cameraRig.getMode() !== this.realms.mode) {
        this.cameraRig.setMode(this.realms.mode);
      }
      this.cameraRig.update(dt);

      this.realms.update(dt, t, this.deps.scroll.progress, this.deps.audio);

      this.composerBundle.fog.setTime(t);
      this.composerBundle.fog.setResolution(window.innerWidth, window.innerHeight);
      this.composerBundle.fog.setVelocity(Math.min(Math.abs(this.deps.scroll.speed) * 0.08, 1.2));
      this.composerBundle.fog.setProgress(this.deps.scroll.progress);

      this.deps.overlay.setDepthProgress(
        this.deps.scroll.progress,
        this.realms.activeIndex,
        this.realms.panelOpen,
        this.realms.mode
      );

      this.deps.overlay.setDistance(this.realms.activeApproach);
      this.deps.overlay.updateVisualizer(this.deps.audio.energy);

      // PHASE 3: per-frame screen anchors for the in-place HUDs / product slabs.
      try {
        const sh: any = this.realms.shunya;
        if (sh && sh.getOrbScreenNDC) {
          // Read directly from InteractionState (works even if ShunyaRealm
          // subscribe is in a stale-closure due to React HMR re-mounts).
          const ix = (window as any).__vyanIX;
          const snap = ix?.get?.();
          const tgt = snap?.target ?? null;
          if (tgt) {
            // Mirror to __vyanExpansion for camera FOV pull.
            (window as any).__vyanExpansion = {
              target: tgt,
              progress: snap.progress ?? 0,
              phase: snap.phase ?? 'unfolding',
            };
            const centre = sh.getOrbScreenNDC(tgt, this.camera);
            const sockets: Array<{ x: number; y: number }> = [];
            for (let i = 0; i < 6; i++) {
              const s = sh.getOrbSocketNDC(tgt, i, 6, this.camera);
              if (s) sockets.push(s);
            }
            (window as any).__vyanAnchor = { target: tgt, centre, sockets, w: window.innerWidth, h: window.innerHeight };
          } else {
            (window as any).__vyanExpansion = { target: null, progress: 0, phase: 'dormant' };
            (window as any).__vyanAnchor = null;
          }
        }
      } catch {}

      this.updateAudioSpatial();
      this.composerBundle.composer.render();

      this.deps.interaction.clicked = false;
      this.raf = requestAnimationFrame(tick);
    };

    tick();
  }

  jumpToOrb(index: number) { this.realms.jumpToOrb(index); }

  destroy() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    try { this.renderer.dispose(); } catch {}
    try { this.renderer.domElement.remove(); } catch {}
  }

  closePanel() {
    this.realms.closePanel();
  }

  private updateAudioSpatial() {
    const p = this.deps.scroll.progress;
    const x = Math.sin(p * Math.PI * 2) * 0.55;
    this.deps.audio.setPan(x);
  }

  private bindResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.quality.resize(w, h);

      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(this.quality.pixelRatio());

      this.composerBundle.composer.setSize(w, h);
      this.composerBundle.fog.setResolution(w, h);
      this.composerBundle.fog.setDensity(this.quality.preset.fogDensity);
      this.composerBundle.bloom.strength = this.quality.preset.bloomStrength;
      this.composerBundle.bloom.radius = this.quality.preset.bloomRadius;

      this.scene.fog = new THREE.FogExp2(0x000000, this.quality.preset.fogDensity);
    });
  }
}
