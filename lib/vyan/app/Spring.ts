import * as THREE from 'three';

/**
 * Critically-damped spring physics — the "arrogant spring".
 * stiffness ~6, damping ~3.5 → slight overshoot, confident snap-into-place.
 *
 * Used for non-linear orb arrivals & camera approaches throughout VYAN.
 */
export class SpringV3 {
  public velocity = new THREE.Vector3();

  step(
    current: THREE.Vector3,
    target: THREE.Vector3,
    dt: number,
    stiffness = 6,
    damping = 3.5
  ): void {
    if (dt <= 0) return;
    // Clamp dt to avoid spring explosions on slow frames.
    const h = Math.min(dt, 0.033);
    const dx = current.x - target.x;
    const dy = current.y - target.y;
    const dz = current.z - target.z;
    this.velocity.x += (-stiffness * dx - damping * this.velocity.x) * h;
    this.velocity.y += (-stiffness * dy - damping * this.velocity.y) * h;
    this.velocity.z += (-stiffness * dz - damping * this.velocity.z) * h;
    current.x += this.velocity.x * h;
    current.y += this.velocity.y * h;
    current.z += this.velocity.z * h;
  }

  reset(): void {
    this.velocity.set(0, 0, 0);
  }
}

/**
 * Scalar spring for fov, magnify factor, audio gain etc.
 * Returns the new current value; mutates `vel.v`.
 */
export function springScalar(
  current: number,
  target: number,
  vel: { v: number },
  dt: number,
  stiffness = 6,
  damping = 3.5
): number {
  if (dt <= 0) return current;
  const h = Math.min(dt, 0.033);
  const d = current - target;
  vel.v += (-stiffness * d - damping * vel.v) * h;
  return current + vel.v * h;
}

/**
 * Generate a cinematic arrival offset — random direction, biased to be
 * mostly tangential (off-axis) and a touch above the orb home position.
 * Magnitude scales with `dist` (units). Returns a Three.Vector3 offset.
 */
export function randomArrivalOffset(dist = 24): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const phi = (Math.random() * 0.7 + 0.15) * Math.PI; // bias above orb (no straight-from-camera)
  const r = dist * (0.65 + Math.random() * 0.55);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi) * 0.6,
    r * Math.sin(phi) * Math.sin(theta)
  );
}
