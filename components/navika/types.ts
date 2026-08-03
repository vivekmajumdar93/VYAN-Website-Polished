import * as THREE from 'three'

export const NAVIKA_MOUNT_TIME = typeof performance !== 'undefined' ? performance.now() : 0

export interface NavikaRefs {
  root: THREE.Group | null
  body: THREE.Object3D | null
  chainFront: THREE.Object3D | null
  petalLeft: THREE.Mesh | null
  petalCenter: THREE.Mesh | null
  petalRight: THREE.Mesh | null
  eyeLeft: THREE.Mesh | null
  eyeRight: THREE.Mesh | null
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
