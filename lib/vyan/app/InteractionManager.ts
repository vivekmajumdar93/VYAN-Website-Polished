export class InteractionManager {
public pointer = { x: 0, y: 0 };
public pointerRaw = { x: 0, y: 0 };
public down = false;
public clicked = false;
public dragDelta = { x: 0, y: 0 };
private target = { x: 0, y: 0 };
private current = { x: 0, y: 0 };
private touchX = 0;
private touchY = 0;
constructor(private root: HTMLElement) {
root.addEventListener('pointermove', this.onMove, { passive: true });
root.addEventListener('pointerdown', this.onDown, { passive: true });
root.addEventListener('pointerup', this.onUp, { passive: true });
root.addEventListener('pointerleave', this.onUp, { passive: true });
root.addEventListener('touchstart', this.onTouchStart, { passive: true });
root.addEventListener('touchmove', this.onTouchMove, { passive: true });
root.addEventListener('touchend', this.onUp, { passive: true });
}
private onMove = (e: PointerEvent) => {
this.pointerRaw.x = e.clientX;
this.pointerRaw.y = e.clientY;
this.target.x = (e.clientX / window.innerWidth) * 2 - 1;
this.target.y = -((e.clientY / window.innerHeight) * 2 - 1);
};
private onDown = (e: PointerEvent) => {
this.down = true;
this.clicked = true;
this.touchX = e.clientX;
this.touchY = e.clientY;
};
private onUp = () => {
this.down = false;
};
private onTouchStart = (e: TouchEvent) => {
const t = e.touches[0];
if (!t) return;
this.touchX = t.clientX;
this.touchY = t.clientY;
this.down = true;
this.clicked = true;
};
private onTouchMove = (e: TouchEvent) => {
const t = e.touches[0];
if (!t) return;
const dx = t.clientX - this.touchX;
const dy = t.clientY - this.touchY;
this.dragDelta.x = dx;
this.dragDelta.y = dy;
this.touchX = t.clientX;
this.touchY = t.clientY;
this.pointerRaw.x = t.clientX;
this.pointerRaw.y = t.clientY;
this.target.x = (t.clientX / window.innerWidth) * 2 - 1;
this.target.y = -((t.clientY / window.innerHeight) * 2 - 1);
};
update(dt: number) {
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
