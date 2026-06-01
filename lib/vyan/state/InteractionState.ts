// ============================================================
// VYAN · InteractionState
// Single source of truth for the in-place orb-expansion architecture.
// ============================================================

export type InteractionTarget = 'medha' | 'vistara' | null;

export type InteractionPhase =
  | 'dormant'
  | 'unfolding'
  | 'expanded'
  | 'folding';

export type SignalState =
  | 'idle'
  | 'hover'
  | 'interaction'
  | 'listening'
  | 'processing'
  | 'response'
  | 'decay';

export type Spectrum =
  | 'crimson'
  | 'gold'
  | 'deepBlue'
  | 'cyan'
  | 'darkViolet'
  | 'hybrid';

export type InteractionSnapshot = {
  target: InteractionTarget;
  phase: InteractionPhase;
  progress: number;
  node: string | null;
  signal: SignalState;
  spectrum: Spectrum;
};

export const SPECTRUM_HEX: Record<Spectrum, { lo: string; hi: string }> = {
  crimson:    { lo: '#7a1828', hi: '#ff5a7a' },
  gold:       { lo: '#553a14', hi: '#ffd070' },
  deepBlue:   { lo: '#0e1a4a', hi: '#3a90ff' },
  cyan:       { lo: '#0a3a40', hi: '#22e0d4' },
  darkViolet: { lo: '#220a4a', hi: '#9a55ff' },
  hybrid:     { lo: '#220a4a', hi: '#ffd070' },
};

export const COGNITIVE_SPECTRUM: Record<string, Spectrum> = {
  prajna:   'crimson',
  dhyana:   'gold',
  akshaya:  'deepBlue',
  java:     'cyan',
  sanchara: 'darkViolet',
};

export const VISTARA_SPECTRUM: Record<string, Spectrum> = {
  ritam:    'crimson',
  ojas:     'gold',
  mudra:    'deepBlue',
  netra:    'cyan',
  akriti:   'darkViolet',
  sutra:    'hybrid',
};

type Listener = (s: InteractionSnapshot) => void;

class InteractionStore {
  private state: InteractionSnapshot = {
    target: null,
    phase: 'dormant',
    progress: 0,
    node: null,
    signal: 'idle',
    spectrum: 'crimson',
  };
  private listeners = new Set<Listener>();
  private animFrame: number | null = null;
  private animFrom = 0;
  private animTo = 0;
  private animStart = 0;
  private animDuration = 1200;

  get(): InteractionSnapshot { return { ...this.state }; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.get());
    return () => this.listeners.delete(fn);
  }

  private emit() { for (const fn of this.listeners) fn(this.get()); }

  expand(target: NonNullable<InteractionTarget>, node: string | null = null, spectrum?: Spectrum) {
    if (this.state.target && this.state.target !== target) {
      this.fold();
      window.setTimeout(() => this.expand(target, node, spectrum), this.animDuration + 80);
      return;
    }
    this.state.target = target;
    this.state.node = node;
    this.state.signal = 'interaction';
    if (spectrum) this.state.spectrum = spectrum;
    this.startTween(this.state.progress, 1, 1200, 'unfolding', 'expanded');

    // Bridge: tell CameraRig to begin orb-expansion fly-in
    this.triggerCameraExpansion(target);
  }

  fold() {
    if (!this.state.target) return;
    this.state.signal = 'decay';

    // Bridge: tell CameraRig to return to orbital BEFORE folding
    // so the animation plays while the orb contracts
    this.triggerCameraReturn();

    this.startTween(this.state.progress, 0, 900, 'folding', 'dormant', () => {
      this.state.target = null;
      this.state.node = null;
      this.state.signal = 'idle';
      this.emit();
    });
  }

  /**
   * Close the current expanded state WITHOUT triggering any camera movement
   * or re-navigation. Used when the user closes a Vistāra product panel via
   * outside-click — camera is already in the right place, no movement needed.
   * This fixes the bug where closing a panel caused the camera to travel
   * through Udbhava before landing back on Vistāra.
   */
  closeWithoutNavigation() {
    if (!this.state.target) return;
    this.state.signal = 'decay';
    // Return camera to orb-full view (not all the way to orbital)
    this.triggerCameraToOrbFull();
    this.startTween(this.state.progress, 1, 600, 'expanded', 'expanded');
    this.state.node = null;
    this.emit();
  }

  setNode(node: string | null, spectrum?: Spectrum) {
    this.state.node = node;
    if (spectrum) this.state.spectrum = spectrum;
    this.emit();
  }

  setSignal(s: SignalState) {
    if (this.state.signal === s) return;
    this.state.signal = s;
    this.emit();
  }

  setSpectrum(s: Spectrum) {
    if (this.state.spectrum === s) return;
    this.state.spectrum = s;
    this.emit();
  }

  // ── Camera bridge helpers ──────────────────────────────────────────────────
  private triggerCameraExpansion(target: NonNullable<InteractionTarget>) {
    // Retry up to 10 frames in case the orb isn't positioned yet on deep-link
    let attempts = 0;
    const tryExpand = () => {
      try {
        const vyan: any = (window as any).__vyan;
        const orb = vyan?.worldRef?.realms?.shunya?.getOrbByKey?.(target);
        if (!orb) { if (++attempts < 10) requestAnimationFrame(tryExpand); return; }
        const orbPos = orb.group.position.clone();
        // Only expand if position is not still at default 0,0,0 (not yet placed)
        // Exception: Udbhava legitimately lives at 0,0,0
        if (orbPos.lengthSq() === 0 && target !== 'vistara' && target !== 'medha') {
          if (++attempts < 10) { requestAnimationFrame(tryExpand); return; }
        }
        vyan.worldRef.cameraRig?.beginOrbExpansion?.(orbPos);
      } catch {
        if (++attempts < 10) requestAnimationFrame(tryExpand);
      }
    };
    requestAnimationFrame(tryExpand);
  }

  private triggerCameraReturn() {
    try {
      const vyan: any = (window as any).__vyan;
      vyan?.worldRef?.cameraRig?.returnToOrbital?.();
    } catch {}
  }

  private triggerCameraToOrbFull() {
    try {
      const vyan: any = (window as any).__vyan;
      const rig = vyan?.worldRef?.cameraRig;
      if (rig && typeof rig.returnToOrbFull === 'function') {
        rig.returnToOrbFull();
      }
    } catch {}
  }

  private startTween(
    from: number, to: number, ms: number,
    midPhase: InteractionPhase, endPhase: InteractionPhase,
    onEnd?: () => void,
  ) {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.animFrom = from; this.animTo = to;
    this.animStart = performance.now();
    this.animDuration = ms;
    this.state.phase = midPhase;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = () => {
      const t = Math.min(1, (performance.now() - this.animStart) / this.animDuration);
      this.state.progress = this.animFrom + (this.animTo - this.animFrom) * ease(t);
      this.emit();
      if (t < 1) {
        this.animFrame = requestAnimationFrame(step);
      } else {
        this.animFrame = null;
        this.state.phase = endPhase;
        this.state.progress = this.animTo;
        this.emit();
        onEnd?.();
      }
    };
    this.animFrame = requestAnimationFrame(step);
  }
}

let _store: InteractionStore | null = null;
export function getInteractionStore(): InteractionStore {
  if (!_store) _store = new InteractionStore();
  return _store;
}

if (typeof window !== 'undefined') {
  (window as any).__vyanIX = getInteractionStore();
}
