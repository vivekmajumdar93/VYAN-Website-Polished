// Discrete-tick scroll/swipe — user feedback: each individual scroll/swipe
// should feel deliberate. 3 wheel ticks advance one orb; 2 touch-swipes
// advance one orb. No more "death by sensitivity".

export class ScrollJourney {
  public progress = 0;
  public target = 0;
  public speed = 0;
  public loopProgress = 0;
  public enabled = false;
  public snapSlots = 0;

  private velocity = 0;
  private lastProgress = 0;

  // --- Discrete-tick accumulators ---
  private wheelDirCount = 0;          // signed: -3..+3
  private wheelLastDir = 0;
  private wheelLastAt = 0;
  private static WHEEL_TICKS_PER_ORB = 3;
  private static WHEEL_MIN_DELTA = 4;   // ignore micro deltas (trackpad jitter)
  private static WHEEL_DIR_RESET_MS = 900;

  private touchSwipeCount = 0;        // signed: -2..+2
  private touchLastDir = 0;
  private touchSwipeLastAt = 0;
  private static TOUCH_SWIPES_PER_ORB = 2;
  private static TOUCH_MIN_DELTA = 36;   // px between touchmove samples
  private static TOUCH_DIR_RESET_MS = 1200;

  // Touch sample state
  private touchStartY = 0;
  private touchPrevY = 0;
  private touchAccum = 0;

  private lastInputAt = 0;
  private snapped = true;

  constructor() {
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  setEnabled(v: boolean) {
    this.enabled = v;
  }

  freeze() {
    this.enabled = false;
    this.wheelDirCount = 0;
    this.touchSwipeCount = 0;
  }

  reset(value = 0) {
    this.target = value;
    this.progress = value;
    this.lastProgress = value;
    this.velocity = 0;
    this.speed = 0;
    this.loopProgress = this.wrap(value);
    this.wheelDirCount = 0;
    this.touchSwipeCount = 0;
  }

  dispose() {
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
  }

  jumpToIndex(index: number, total = 7) {
    const cycle = Math.floor(this.target);
    this.target = cycle + index / total;
  }

  /** Advance target by exactly one orb (signed direction). */
  private advanceOneOrb(dir: number) {
    if (this.snapSlots <= 0) {
      // Fallback to continuous accumulation if snap slots are unset.
      this.target += dir * 0.12;
      return;
    }
    const step = 1 / this.snapSlots;
    // Snap to nearest slot first, then add one step in the gesture's direction.
    const slotted = Math.round(this.target * this.snapSlots) / this.snapSlots;
    this.target = slotted + dir * step;
    this.snapped = false;
  }

  private isPaused(): boolean {
    return typeof document !== 'undefined' && document.body.classList.contains('vyan-paused');
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled || this.isPaused()) return;
    e.preventDefault();
    const now = performance.now();

    // CONTINUOUS mode (snapSlots = 0) \u2014 gateway fly-in. Each wheel tick adds
    // proportional progress so the user can scroll Vy\u014dma closer organically.
    // Direction inverted per UX feedback: scrolling UP (negative deltaY) draws
    // the orb closer; scrolling DOWN pushes it away.
    if (this.snapSlots === 0) {
      this.target += -e.deltaY * 0.00045;
      this.lastInputAt = now;
      this.snapped = false;
      return;
    }

    // DISCRETE mode (void) \u2014 3 ticks per orb advance.
    if (Math.abs(e.deltaY) < ScrollJourney.WHEEL_MIN_DELTA) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (dir !== this.wheelLastDir || now - this.wheelLastAt > ScrollJourney.WHEEL_DIR_RESET_MS) {
      this.wheelDirCount = 0;
    }
    this.wheelDirCount += dir;
    this.wheelLastDir = dir;
    this.wheelLastAt = now;
    this.lastInputAt = now;
    if (Math.abs(this.wheelDirCount) >= ScrollJourney.WHEEL_TICKS_PER_ORB) {
      this.advanceOneOrb(dir);
      this.wheelDirCount = 0;
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    if (!this.enabled || this.isPaused()) return;
    this.touchStartY = e.touches[0]?.clientY ?? 0;
    this.touchPrevY = this.touchStartY;
    this.touchAccum = 0;
    this.lastInputAt = performance.now();
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.enabled || this.isPaused()) return;
    e.preventDefault();
    const y = e.touches[0]?.clientY ?? 0;
    const dy = this.touchPrevY - y;
    this.touchPrevY = y;
    this.lastInputAt = performance.now();

    // CONTINUOUS gateway mode \u2014 directly accumulate (inverted per UX feedback).
    if (this.snapSlots === 0) {
      this.target += -dy * 0.006;
      this.snapped = false;
      return;
    }

    // DISCRETE void mode \u2014 2 swipes per orb.
    this.touchAccum += dy;
    if (Math.abs(this.touchAccum) >= ScrollJourney.TOUCH_MIN_DELTA) {
      const dir = this.touchAccum > 0 ? 1 : -1;
      this.recordTouchSwipe(dir);
      this.touchAccum = 0;
      this.touchPrevY = y;
    }
  };

  private onTouchEnd = () => {
    this.touchAccum = 0;
  };

  private recordTouchSwipe(dir: number) {
    const now = performance.now();
    if (dir !== this.touchLastDir || now - this.touchSwipeLastAt > ScrollJourney.TOUCH_DIR_RESET_MS) {
      this.touchSwipeCount = 0;
    }
    this.touchSwipeCount += dir;
    this.touchLastDir = dir;
    this.touchSwipeLastAt = now;
    if (Math.abs(this.touchSwipeCount) >= ScrollJourney.TOUCH_SWIPES_PER_ORB) {
      this.advanceOneOrb(dir);
      this.touchSwipeCount = 0;
    }
  }

  update(dt: number) {
    if (!this.enabled) {
      this.speed = 0;
      this.lastProgress = this.progress;
      this.loopProgress = this.wrap(this.progress);
      return;
    }

    // GATEWAY (continuous): exponential decay toward target with auto-snap
    // disabled. CLAMP target to [0,1] so we never overshoot Vy\u014dma.
    if (this.snapSlots === 0) {
      this.target = Math.max(0, Math.min(1, this.target));
      const diff = this.target - this.progress;
      this.velocity += diff * 14.0 * dt;
      this.velocity *= Math.pow(0.00001, dt);
      this.progress += this.velocity;
      this.speed = (this.progress - this.lastProgress) / Math.max(dt, 0.0001);
      this.lastProgress = this.progress;
      this.loopProgress = this.wrap(this.progress);
      return;
    }

    // VOID (discrete): slower critically-damped approach so the user can
    // SEE the neural rail travel between orbs (was 0.0008 → too snappy).
    const diff = this.target - this.progress;
    this.progress += diff * (1 - Math.pow(0.04, dt));
    if (Math.abs(this.target - this.progress) < 0.0008) {
      this.progress = this.target;
      this.snapped = true;
    }
    this.velocity = 0;
    this.speed = (this.progress - this.lastProgress) / Math.max(dt, 0.0001);
    this.lastProgress = this.progress;
    this.loopProgress = this.wrap(this.progress);
  }

  private wrap(v: number) {
    return ((v % 1) + 1) % 1;
  }
}
