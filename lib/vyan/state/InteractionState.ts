// ============================================================
// VYAN · InteractionState
// Single source of truth for the in-place orb-expansion architecture.
// Replaces the old realm-switching (vistara / medha modes) — the camera
// stays in Shunya throughout. URL routes /medha and /vistara/<product>
// are now deep links that set this state and trigger orb expansion.
// ============================================================

export type InteractionTarget = 'medha' | 'vistara' | null;

export type InteractionPhase =
  | 'dormant'     // no orb expanded
  | 'unfolding'   // 0..1 expansion in progress
  | 'expanded'    // fully open, persistent
  | 'folding';    // 1..0 retraction

export type SignalState =
  | 'idle'         // weak dormant pulses
  | 'hover'        // localised brighten near pointer
  | 'interaction'  // user typed / clicked something inside
  | 'listening'    // STT / awaiting input
  | 'processing'   // backend call in flight
  | 'response'     // streaming a reply
  | 'decay';       // calming back to idle

export type Spectrum =
  | 'crimson'    // ember-red (Prājña / Ṛtam)
  | 'gold'       // sunshine (Dhyāna / Ojas)
  | 'deepBlue'   // sapphire (Akṣaya / Mudrā)
  | 'cyan'       // teal (Javā / Netra)
  | 'darkViolet' // amethyst (Sañcāra / Ākṛti)
  | 'hybrid';    // multi-stop (Sūtra)

export type InteractionSnapshot = {
  target: InteractionTarget;
  phase: InteractionPhase;
  progress: number;        // 0..1 — drives shaders + react UI
  node: string | null;     // Vistāra branch-intersection id (e.g. 'ritam', 'netra')
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

// Mode / product → spectrum mapping (from blueprint).
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

  /** Expand a target orb. If another is open, fold it first via setTimeout chain. */
  expand(target: NonNullable<InteractionTarget>, node: string | null = null, spectrum?: Spectrum) {
    if (this.state.target && this.state.target !== target) {
      // collapse current then expand new
      this.fold();
      window.setTimeout(() => this.expand(target, node, spectrum), this.animDuration + 80);
      return;
    }
    this.state.target = target;
    this.state.node = node;
    this.state.signal = 'interaction';
    if (spectrum) this.state.spectrum = spectrum;
    this.startTween(this.state.progress, 1, 1200, 'unfolding', 'expanded');
  }

  /** Collapse the currently expanded orb back to dormant. */
  fold() {
    if (!this.state.target) return;
    this.state.signal = 'decay';
    this.startTween(this.state.progress, 0, 900, 'folding', 'dormant', () => {
      this.state.target = null;
      this.state.node = null;
      this.state.signal = 'idle';
      this.emit();
    });
  }

  /** Set a child node within the currently-expanded orb (Vistāra product selection). */
  setNode(node: string | null, spectrum?: Spectrum) {
    this.state.node = node;
    if (spectrum) this.state.spectrum = spectrum;
    this.emit();
  }

  /** Set the live signal state (driven by hover / typing / processing / streaming). */
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

  private startTween(from: number, to: number, ms: number, midPhase: InteractionPhase, endPhase: InteractionPhase, onEnd?: () => void) {
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
      if (t < 1) { this.animFrame = requestAnimationFrame(step); }
      else {
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

// Browser-only helper to mirror state on window for debugging.
if (typeof window !== 'undefined') {
  (window as any).__vyanIX = getInteractionStore();
}
