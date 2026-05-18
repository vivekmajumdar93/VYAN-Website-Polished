export class ScrollJourney {
public progress = 0;
public target = 0;
public speed = 0;
public loopProgress = 0;
public enabled = false;
private velocity = 0;
private lastProgress = 0;
private touchY = 0;
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
};
private onTouchStart = (e: TouchEvent) => {
this.touchY = e.touches[0]?.clientY ?? 0;
};
private onTouchMove = (e: TouchEvent) => {
if (!this.enabled) return;
e.preventDefault();
const y = e.touches[0]?.clientY ?? 0;
const dy = this.touchY - y;
this.touchY = y;
// High sensitivity so a normal thumb drag (~150px) traverses 1-2 orb slots.
this.target += dy * 0.006;
};
update(dt: number) {
if (!this.enabled) {
this.speed = 0;
this.lastProgress = this.progress;
this.loopProgress = this.wrap(this.progress);
return;
}
const diff = this.target - this.progress;
this.velocity += diff * 14.0 * dt;
this.velocity *= Math.pow(0.00001, dt);
this.progress += this.velocity;
this.speed = (this.progress - this.lastProgress) / Math.max(dt, 0.0001);
this.lastProgress = this.progress;
this.loopProgress = this.wrap(this.progress);
}
private wrap(v: number) {
return ((v % 1) + 1) % 1;
}
}
