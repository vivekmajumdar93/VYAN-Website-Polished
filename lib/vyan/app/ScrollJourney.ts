export class ScrollJourney {
public progress = 0;
public target = 0;
public speed = 0;
public loopProgress = 0;
public enabled = false;
public snapSlots = 0;        // when > 0, snap target to nearest 1/snapSlots after idle
private velocity = 0;
private lastProgress = 0;
private touchY = 0;
private lastInputAt = 0;
private snapped = true;
// NON-PASSIVE listeners so we can preventDefault and stop the browser from
// hijacking the gesture as page-scroll on tablets/phones inside iframes.
constructor() {
window.addEventListener('wheel', this.onWheel, { passive: false });
window.addEventListener('touchstart', this.onTouchStart, { passive: false });
window.addEventListener('touchmove', this.onTouchMove, { passive: false });
}
setEnabled(v: boolean) {
this.enabled = v;
}
freeze() {
this.enabled = false;
}
reset(value = 0) {
this.target = value;
this.progress = value;
this.lastProgress = value;
this.velocity = 0;
this.speed = 0;
this.loopProgress = this.wrap(value);
}
dispose() {
window.removeEventListener('wheel', this.onWheel);
window.removeEventListener('touchstart', this.onTouchStart);
window.removeEventListener('touchmove', this.onTouchMove);
}
jumpToIndex(index: number, total = 7) {
const cycle = Math.floor(this.target);
this.target = cycle + index / total;
}
private onWheel = (e: WheelEvent) => {
if (!this.enabled) return;
e.preventDefault();
this.target += e.deltaY * 0.00045;
this.lastInputAt = performance.now();
this.snapped = false;
};
private onTouchStart = (e: TouchEvent) => {
this.touchY = e.touches[0]?.clientY ?? 0;
this.lastInputAt = performance.now();
this.snapped = false;
};
private onTouchMove = (e: TouchEvent) => {
if (!this.enabled) return;
e.preventDefault();
const y = e.touches[0]?.clientY ?? 0;
const dy = this.touchY - y;
this.touchY = y;
this.target += dy * 0.006;
this.lastInputAt = performance.now();
this.snapped = false;
};
update(dt: number) {
if (!this.enabled) {
this.speed = 0;
this.lastProgress = this.progress;
this.loopProgress = this.wrap(this.progress);
return;
}
// Auto-snap target to nearest slot 700ms after last input \u2014 makes every orb
// settle to focus=1.0 (NEURAL LOCK: 0 LY).
if (this.snapSlots > 0 && !this.snapped && performance.now() - this.lastInputAt > 700) {
const slotted = Math.round(this.target * this.snapSlots) / this.snapSlots;
this.target = slotted;
this.snapped = true;
}
const diff = this.target - this.progress;
// Hard-lock the last few percent so focus reaches a true 1.0 (NEURAL LOCK: 0 LY)
if (this.snapSlots > 0 && this.snapped) {
  // After idle-snap, use pure exponential approach for fast convergence to slot.
  this.progress += diff * (1 - Math.pow(0.0006, dt));
  if (Math.abs(this.target - this.progress) < 0.001) this.progress = this.target;
  this.velocity = 0;
} else {
  this.velocity += diff * 14.0 * dt;
  this.velocity *= Math.pow(0.00001, dt);
  this.progress += this.velocity;
}
this.speed = (this.progress - this.lastProgress) / Math.max(dt, 0.0001);
this.lastProgress = this.progress;
this.loopProgress = this.wrap(this.progress);
}
private wrap(v: number) {
return ((v % 1) + 1) % 1;
}
}
