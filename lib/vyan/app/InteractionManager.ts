export class InteractionManager {
  public pointer = { x: 0, y: 0 };
  public pointerRaw = { x: 0, y: 0 };
  public down = false;
  public clicked = false;          // ONLY true for a proper tap (small move, short time)
  public dragDelta = { x: 0, y: 0 };
  public swipeDir: -1 | 0 | 1 = 0; // -1 = swipe-down (prev), 1 = swipe-up (next), 0 = none

  private target = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };

  // Per-gesture state — used to decide tap vs swipe at touchend/pointerup
  private downStartX = 0;
  private downStartY = 0;
  private downStartTime = 0;
  private movedSinceDown = 0;
  private lastX = 0;
  private lastY = 0;

  // Tap thresholds — exceed either and the gesture becomes a swipe (NO click).
  private static TAP_MOVE_PX = 12;
  private static TAP_MAX_MS = 350;
  private static SWIPE_MIN_PX = 30;

  constructor(private root: HTMLElement) {
    root.addEventListener('pointermove', this.onMove, { passive: true });
    root.addEventListener('pointerdown', this.onDown, { passive: true });
    root.addEventListener('pointerup', this.onUp, { passive: true });
    root.addEventListener('pointercancel', this.onUp, { passive: true });
    // Note: NOT binding pointerleave — it fires unpredictably mid-drag in some
    // browsers and was causing the gesture-end detection to bail early.
    root.addEventListener('click', this.onClick, { passive: true });
    root.addEventListener('touchstart', this.onTouchStart, { passive: true });
    root.addEventListener('touchmove', this.onTouchMove, { passive: true });
    root.addEventListener('touchend', this.onTouchEnd, { passive: true });
    root.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  private onClick = (_e: MouseEvent) => {
    // Only honour click if the gesture wasn't a drag/swipe. The browser fires
    // `click` even after small drags on some platforms — we need to gate it.
    if (this.movedSinceDown < InteractionManager.TAP_MOVE_PX) {
      this.clicked = true;
    }
  };

  private onMove = (e: PointerEvent) => {
    this.pointerRaw.x = e.clientX;
    this.pointerRaw.y = e.clientY;
    this.target.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.target.y = -((e.clientY / window.innerHeight) * 2 - 1);
    if (this.down) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.dragDelta.x = dx;
      this.dragDelta.y = dy;
      this.movedSinceDown += Math.hypot(dx, dy);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };

  private onDown = (e: PointerEvent) => {
    this.down = true;
    this.downStartX = e.clientX;
    this.downStartY = e.clientY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.downStartTime = performance.now();
    this.movedSinceDown = 0;
    // NOTE: we do NOT set clicked=true here. We wait for pointerup and
    // only register a click if the gesture qualifies as a tap.
  };

  private onUp = (e: PointerEvent) => {
    if (!this.down) return;
    this.down = false;
    const dt = performance.now() - this.downStartTime;
    const dx = (e?.clientX ?? this.lastX) - this.downStartX;
    const dy = (e?.clientY ?? this.lastY) - this.downStartY;
    const totalMove = Math.hypot(dx, dy);

    if (totalMove < InteractionManager.TAP_MOVE_PX && dt < InteractionManager.TAP_MAX_MS) {
      this.clicked = true;
    } else if (Math.abs(dy) > InteractionManager.SWIPE_MIN_PX && dt < InteractionManager.SWIPE_MAX_MS) {
      // Vertical swipe → snap to next/prev orb (negative dy = swipe up = forward)
      this.swipeDir = dy < 0 ? 1 : -1;
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    this.down = true;
    this.downStartX = t.clientX;
    this.downStartY = t.clientY;
    this.lastX = t.clientX;
    this.lastY = t.clientY;
    this.downStartTime = performance.now();
    this.movedSinceDown = 0;
  };

  private onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - this.lastX;
    const dy = t.clientY - this.lastY;
    this.dragDelta.x = dx;
    this.dragDelta.y = dy;
    this.movedSinceDown += Math.hypot(dx, dy);
    this.lastX = t.clientX;
    this.lastY = t.clientY;
    this.pointerRaw.x = t.clientX;
    this.pointerRaw.y = t.clientY;
    this.target.x = (t.clientX / window.innerWidth) * 2 - 1;
    this.target.y = -((t.clientY / window.innerHeight) * 2 - 1);
  };

  private onTouchEnd = () => {
    if (!this.down) return;
    this.down = false;
    const dt = performance.now() - this.downStartTime;
    const dx = this.lastX - this.downStartX;
    const dy = this.lastY - this.downStartY;
    const totalMove = Math.hypot(dx, dy);

    if (totalMove < InteractionManager.TAP_MOVE_PX && dt < InteractionManager.TAP_MAX_MS) {
      this.clicked = true;
    } else if (Math.abs(dy) > InteractionManager.SWIPE_MIN_PX) {
      this.swipeDir = dy < 0 ? 1 : -1;
    }
  };

  private wasDown = false;
  private detectGestureEnd() {
    const dt = performance.now() - this.downStartTime;
    const dx = this.lastX - this.downStartX;
    const dy = this.lastY - this.downStartY;
    const totalMove = Math.hypot(dx, dy);
    if (totalMove < InteractionManager.TAP_MOVE_PX && dt < InteractionManager.TAP_MAX_MS) {
      this.clicked = true;
    } else if (Math.abs(dy) > InteractionManager.SWIPE_MIN_PX) {
      this.swipeDir = dy < 0 ? 1 : -1;
    }
  }

  update(dt: number) {
    // Safety net: detect tap/swipe on the frame `down` flips true→false even if
    // pointerup never reached our listener (Playwright / iframe quirks).
    if (this.wasDown && !this.down) {
      this.detectGestureEnd();
    }
    this.wasDown = this.down;
    const mobile = window.innerWidth < 768;
    const ease = mobile ? 0.045 : 0.065;
    this.current.x += (this.target.x - this.current.x) * (1 - Math.pow(1 - ease, dt * 60));
    this.current.y += (this.target.y - this.current.y) * (1 - Math.pow(1 - ease, dt * 60));
    this.pointer.x = this.current.x;
    this.pointer.y = this.current.y;
    this.dragDelta.x *= 0.85;
    this.dragDelta.y *= 0.85;
  }
}
