// Speech recognition (STT) + synthesis (TTS) wrappers — native browser APIs only.
// Falls back gracefully when unsupported (no error, just no-op).

type STTCallbacks = {
  onText: (text: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (e: string) => void;
};

export class STT {
  private rec: any = null;
  private supported = false;
  constructor() {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      this.rec = new SR();
      this.rec.continuous = false;
      this.rec.interimResults = true;
      this.rec.lang = 'en-US';
      this.supported = true;
    }
  }
  isSupported() { return this.supported; }
  start(cb: STTCallbacks) {
    if (!this.supported) { cb.onError?.('STT not supported on this browser'); return; }
    this.rec.onresult = (e: any) => {
      let txt = '';
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      cb.onText(txt, final);
    };
    this.rec.onerror = (e: any) => cb.onError?.(e?.error ?? 'error');
    this.rec.onend = () => cb.onEnd?.();
    try { this.rec.start(); } catch (e: any) { cb.onError?.(String(e?.message ?? e)); }
  }
  stop() { try { this.rec?.stop(); } catch {} }
}

export class TTS {
  private supported = false;
  private currentUtter: SpeechSynthesisUtterance | null = null;
  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) this.supported = true;
  }
  isSupported() { return this.supported; }
  speak(text: string, opts: { rate?: number; pitch?: number; onStart?: () => void; onEnd?: () => void } = {}) {
    if (!this.supported || !text) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1.05;
    // Prefer a feminine voice if available
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    const pref = voices.find(v => /female|samantha|google\s+uk\s+english\s+female|microsoft\s+aria/i.test(v.name)) ||
      voices.find(v => v.lang?.startsWith('en'));
    if (pref) u.voice = pref;
    u.onstart = () => opts.onStart?.();
    u.onend = () => opts.onEnd?.();
    this.currentUtter = u;
    window.speechSynthesis.speak(u);
  }
  cancel() { try { window.speechSynthesis.cancel(); } catch {}; this.currentUtter = null; }
}
