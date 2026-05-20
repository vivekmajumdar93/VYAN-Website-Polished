import { World } from './World';
import { ScrollJourney } from './ScrollJourney';
import { AudioReactive } from './AudioReactive';
import { InteractionManager } from './InteractionManager';
import { QualityManager } from './QualityManager';
import { Overlay } from '../ui/Overlay';
import { IntroDirector } from './IntroDirector';
import type { RealmMode } from '../scenes/RealmManager';
import type { ShunyaOrbKey } from '../scenes/PathCurve';
import type { VistaraProductKey } from '../scenes/VistaraPath';

export type AppOptions = {
  skipIntro?: boolean;
  initialMode?: RealmMode;
  onEnterVoid?: () => void;
  onOrbActivate?: (key: ShunyaOrbKey) => void;
  onEnterVistara?: () => void;
  onProductActivate?: (key: VistaraProductKey) => void;
  onExitVistara?: () => void;
  onEnterMedha?: () => void;
};

export class App {
  private world: World;
  private scroll: ScrollJourney;
  private audio: AudioReactive;
  private interaction: InteractionManager;
  private quality: QualityManager;
  private overlay: Overlay;
  private intro: IntroDirector;
  private skipIntro: boolean;
  private opts: AppOptions;

  constructor(private root: HTMLElement, opts: AppOptions = {}) {
    this.opts = opts;
    this.skipIntro = !!opts.skipIntro;
    this.scroll = new ScrollJourney();
    this.audio = new AudioReactive();
    this.interaction = new InteractionManager(root);
    this.quality = new QualityManager();
    this.overlay = new Overlay(root);
    this.intro = new IntroDirector(root);
    this.world = new World(root, this.quality);
    this.overlay.bind({
      onJumpToOrb: (index) => this.world.jumpToOrb(index),
      onToggleSound: () => {
        void this.audio.init();
        this.audio.toggleMute();
        this.overlay.setSoundMuted(this.audio.muted);
      },
      onSetVolume: (val) => this.audio.setVolume(val),
      onClosePanel: () => this.world.closePanel(),
    });
    this.world.bind({
      scroll: this.scroll,
      audio: this.audio,
      interaction: this.interaction,
      overlay: this.overlay,
    }, {
      onEnterVoid: () => this.opts.onEnterVoid?.(),
      onOrbActivate: (k) => this.opts.onOrbActivate?.(k),
      onEnterVistara: () => this.opts.onEnterVistara?.(),
      onProductActivate: (k) => this.opts.onProductActivate?.(k),
      onExitVistara: () => this.opts.onExitVistara?.(),
      onEnterMedha: () => this.opts.onEnterMedha?.(),
    });
  }

  start() {
    this.overlay.mount();
    const afterIntro = () => {
      this.overlay.endIntro();
      this.scroll.setEnabled(true);
      void this.audio.init();
      this.overlay.setSoundMuted(this.audio.muted);
      this.world.start();

      // Audio: auto-unlock on first user gesture (browser autoplay policy).
      // The soundtrack fades in over 2.4s so it doesn't blast.
      const unlock = () => {
        void this.audio.unlock(true);
        this.overlay.setSoundMuted(this.audio.muted);
        this.root.removeEventListener('pointerdown', unlock);
        this.root.removeEventListener('touchstart', unlock);
      };
      this.root.addEventListener('pointerdown', unlock, { once: true });
      this.root.addEventListener('touchstart', unlock, { once: true } as any);

      // If the page told us to boot directly into a void, switch now.
      if (this.opts.initialMode && this.opts.initialMode !== 'gateway') {
        this.setMode(this.opts.initialMode);
      }
    };
    if (this.skipIntro) afterIntro();
    else this.intro.play(afterIntro);
  }

  // ----- Public API used by Next.js pages via window.__vyan -----
  /** Audio engine reference for SoundConsole / external controls. */
  public get audioEngine() { return this.audio; }

  setMode(mode: RealmMode) {
    this.world.setMode(mode);
  }
  focusShunyaOrb(key: ShunyaOrbKey, immediate = false) {
    this.world.focusShunyaOrb(key, immediate);
  }
  focusVistaraProduct(key: VistaraProductKey, immediate = false) {
    this.world.focusVistaraProduct(key, immediate);
  }
  triggerVistaraExit(cb: () => void) {
    this.world.triggerVistaraExit(cb);
  }
  getMode(): RealmMode {
    return this.world.getMode();
  }

  destroy() {
    try { this.world?.destroy?.(); } catch {}
    try { this.overlay?.unmount?.(); } catch {}
    try { this.scroll?.dispose?.(); } catch {}
  }
}
