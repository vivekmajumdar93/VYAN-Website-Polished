/**
 * Ambient audio engine for VYAN.
 *
 * Adds cinematic gain envelopes (duck / swell / fadeIn / fadeOut) so the
 * soundtrack is tightly synchronised with gateway burst, void transitions,
 * orb magnify and slab close — all driven from a single target-gain tween.
 */
export class AudioReactive {
  public bass = 0;
  public mid = 0;
  public treble = 0;
  public energy = 0;
  public pan = 0;
  public muted = true;
  public volume = 0.8;
  public hasStarted = false;
  public unlocked = false;

  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private data?: Uint8Array;
  private audio?: HTMLAudioElement;
  private panner?: StereoPannerNode;
  private gain?: GainNode;

  // Envelope state — target-gain tween that smoothly slides between values.
  private currentGain = 0;
  private tweenFrom = 0;
  private tweenTo = 0;
  private tweenStart = 0;
  private tweenDur = 0;
  // Baseline gain when no event is ducking/swelling.
  private baseline = 0.85;

  async init(): Promise<void> {
    if (this.hasStarted) return;
    try {
      this.ctx = new AudioContext();
      this.audio = new Audio('/audio/ambient.mp3');
      this.audio.loop = true;
      this.audio.crossOrigin = 'anonymous';

      const src = this.ctx.createMediaElementSource(this.audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);

      this.panner = this.ctx.createStereoPanner();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.0;

      // Sound-console processing chain:
      //   src \u2192 analyser \u2192 bass \u2192 treble \u2192 lowpass \u2192 (dry + wet via reverb) \u2192 panner \u2192 gain \u2192 out
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 250;
      this.bassFilter.gain.value = 0;

      this.trebleFilter = this.ctx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 4000;
      this.trebleFilter.gain.value = 0;

      this.lowpass = this.ctx.createBiquadFilter();
      this.lowpass.type = 'lowpass';
      this.lowpass.frequency.value = 18000; // bypassed
      this.lowpass.Q.value = 0.8;

      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.synthImpulseResponse(this.ctx, 2.4, 2.0);

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 1.0;
      this.wetGain = this.ctx.createGain();
      this.wetGain.gain.value = 0.0;

      src.connect(this.analyser);
      this.analyser.connect(this.bassFilter);
      this.bassFilter.connect(this.trebleFilter);
      this.trebleFilter.connect(this.lowpass);
      this.lowpass.connect(this.dryGain);
      this.lowpass.connect(this.reverb);
      this.reverb.connect(this.wetGain);
      this.dryGain.connect(this.panner);
      this.wetGain.connect(this.panner);
      this.panner.connect(this.gain);
      this.gain.connect(this.ctx.destination);

      await this.audio.play();
      this.hasStarted = true;
      this.applyGain();
      this.loop();
    } catch {
      this.hasStarted = false;
    }
  }

  /**
   * Unlocks audio in response to a user gesture (browser autoplay policy).
   * Idempotent — safe to call from every pointerdown.
   */
  async unlock(autoUnmute = true): Promise<void> {
    if (!this.hasStarted) await this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch {}
    }
    if (autoUnmute && !this.unlocked) {
      this.unlocked = true;
      this.setMuted(false);
      // Cinematic fade-in matching the loader → gateway emergence.
      this.fadeIn(2.4);
    }
  }

  setMuted(v: boolean): void {
    this.muted = v;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
    if (!this.muted) this.fadeIn(0.8);
  }

  setPan(v: number): void {
    this.pan = Math.max(-1, Math.min(1, v));
    if (this.panner && this.ctx) {
      this.panner.pan.setTargetAtTime(this.pan, this.ctx.currentTime, 0.03);
    }
  }

  /**
   * Apply settings from the Sound Console UI \u2014 batched, fast, smoothed.
   * Settings: volume, bass(dB), treble(dB), reverb, lowpass + lowpassHz, speed, pulseSync.
   */
  applyConsole(settings: {
    volume?: number; bass?: number; treble?: number;
    reverb?: boolean; lowpass?: boolean; lowpassHz?: number;
    speed?: number; pulseSync?: boolean;
  }): void {
    if (typeof settings.volume === 'number') this.setVolume(settings.volume);
    const ctx = this.ctx;
    if (!ctx) return;
    const tau = 0.05;
    if (typeof settings.bass === 'number' && this.bassFilter) {
      this.bassFilter.gain.setTargetAtTime(settings.bass, ctx.currentTime, tau);
    }
    if (typeof settings.treble === 'number' && this.trebleFilter) {
      this.trebleFilter.gain.setTargetAtTime(settings.treble, ctx.currentTime, tau);
    }
    if (typeof settings.lowpass === 'boolean' && this.lowpass) {
      const hz = settings.lowpass ? (settings.lowpassHz ?? 1800) : 18000;
      this.lowpass.frequency.setTargetAtTime(hz, ctx.currentTime, tau);
    } else if (typeof settings.lowpassHz === 'number' && this.lowpass && settings.lowpass !== false) {
      this.lowpass.frequency.setTargetAtTime(settings.lowpassHz, ctx.currentTime, tau);
    }
    if (typeof settings.reverb === 'boolean' && this.wetGain && this.dryGain) {
      this.wetGain.gain.setTargetAtTime(settings.reverb ? 0.45 : 0, ctx.currentTime, tau);
      this.dryGain.gain.setTargetAtTime(settings.reverb ? 0.7 : 1.0, ctx.currentTime, tau);
    }
    if (typeof settings.speed === 'number' && this.audio) {
      try { this.audio.playbackRate = Math.max(0.5, Math.min(1.6, settings.speed)); } catch {}
    }
    if (typeof settings.pulseSync === 'boolean') this.pulseSync = settings.pulseSync;
  }

  /** Synthesize a soft cosmic-cathedral impulse response for the convolver. */
  private synthImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // ---------- Envelope API ----------

  /** Schedule a smooth tween to `level` over `duration` seconds. */
  private tweenTo_(level: number, duration: number): void {
    this.tweenFrom = this.currentGain;
    this.tweenTo = Math.max(0, level);
    this.tweenStart = performance.now();
    this.tweenDur = Math.max(1, duration * 1000);
  }

  /** Duck audio down to `level` (0..1) over `duration` seconds. */
  duck(level: number, duration = 0.4): void {
    this.tweenTo_(level, duration);
  }

  /** Swell audio up to `level` (0..1) over `duration` seconds. */
  swell(level: number, duration = 0.4): void {
    this.tweenTo_(level, duration);
  }

  /** Fade to baseline over `duration` seconds. Used on void emergence. */
  fadeIn(duration = 1.4): void {
    this.tweenTo_(this.baseline, duration);
  }

  /** Fade out completely over `duration` seconds. */
  fadeOut(duration = 1.4): void {
    this.tweenTo_(0, duration);
  }

  /** Adjust the resting baseline gain (e.g. when entering a calmer realm). */
  setBaseline(level: number): void {
    this.baseline = Math.max(0, Math.min(1, level));
  }

  private tickTween(): void {
    if (this.tweenDur <= 0) return;
    const elapsed = performance.now() - this.tweenStart;
    const k = Math.max(0, Math.min(1, elapsed / this.tweenDur));
    const eased = k * k * (3 - 2 * k);
    this.currentGain = this.tweenFrom + (this.tweenTo - this.tweenFrom) * eased;
    if (k >= 1) this.tweenDur = 0;
  }

  private applyGain(): void {
    if (!this.gain || !this.ctx) return;
    // Pulse-sync option amplifies the bass-driven gain modulation by ~2.4\u00d7
    // \u2014 makes the track "react" hard to bass spikes.
    const reactiveMul = this.pulseSync ? 0.42 : 0.18;
    const target = this.muted ? 0 : (this.currentGain + this.energy * reactiveMul) * this.volume;
    this.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  private loop = (): void => {
    if (this.analyser && this.data) {
      this.analyser.getByteFrequencyData(this.data as any);
      const len = this.data.length;
      const bassEnd = Math.floor(len * 0.12);
      const midEnd = Math.floor(len * 0.45);
      this.bass = this.avg(0, bassEnd);
      this.mid = this.avg(bassEnd, midEnd);
      this.treble = this.avg(midEnd, len);
      this.energy = (this.bass * 0.55 + this.mid * 0.3 + this.treble * 0.15) / 255;

      this.tickTween();
      this.applyGain();
    }
    requestAnimationFrame(this.loop);
  };

  private avg(a: number, b: number): number {
    if (!this.data) return 0;
    let sum = 0;
    for (let i = a; i < b; i++) sum += this.data[i];
    return sum / Math.max(1, b - a);
  }
}
