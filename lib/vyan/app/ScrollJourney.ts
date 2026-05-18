export class ScrollJourney {
public progress = 0;
public target = 0;
public speed = 0;
public loopProgress = 0;
private velocity = 0;
private lastProgress = 0;
private touchY = 0;
private enabled = false;
constructor() {
window.addEventListener('wheel', this.onWheel, { passive: true });
window.addEventListener('touchstart', this.onTouchStart, { passive: true });
window.addEventListener('touchmove', this.onTouchMove, { passive: true });
}
setEnabled(v: boolean) {
this.enabled = v;
}
dispose() {
window.removeEventListener('wheel', this.onWheel);
window.removeEventListener('touchstart', this.onTouchStart);
window.removeEventListener('touchmove', this.onTouchMove);
}
freeze() {
this.enabled = false;
}
jumpToIndex(index: number, total = 7) {
const cycle = Math.floor(this.target);
this.target = cycle + index / total;
}
private onWheel = (e: WheelEvent) => {
if (!this.enabled) return;
this.target += e.deltaY * 0.00042;
};
private onTouchStart = (e: TouchEvent) => {
this.touchY = e.touches[0]?.clientY ?? 0;
};
private onTouchMove = (e: TouchEvent) => {
if (!this.enabled) return;
const y = e.touches[0]?.clientY ?? 0;
const dy = this.touchY - y;
this.touchY = y;
this.target += dy * 0.00095;
};
update(dt: number) {
if (!this.enabled) {
this.speed = 0;
this.lastProgress = this.progress;
this.loopProgress = this.wrap(this.progress);
return;
}
const diff = this.target - this.progress;

// --- UPDATED ZERO-BOUNCE PHYSICS ---
// Increased pull force (from 4.0 to 14.0) for immediate reaction
this.velocity += diff * 14.0 * dt; 
// Massive friction increase (from 0.1 to 0.00001) kills all oscillation
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
