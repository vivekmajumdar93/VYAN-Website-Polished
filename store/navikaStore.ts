import { create } from 'zustand'
import * as THREE from 'three'

export type IdleAnimationType =
  | 'headTilt'
  | 'lookLeft'
  | 'lookRight'
  | 'rotate20'
  | 'inspectParticle'
  | 'spinSlow'
  | 'floatHigher'
  | 'stretch'
  | 'closeEyes'
  | 'ripplePulse'

interface NavikaState {
  ripplePulseNonce: number
  idleNonce: number
  idleType: IdleAnimationType | null
  inspectTargetPos: THREE.Vector3 | null
  pointerActive: boolean
  pointerNDC: THREE.Vector2
  pointerWorld: THREE.Vector3
  isFollowing: boolean

  triggerIdle: (type: IdleAnimationType) => void
  triggerRipplePulse: () => void
  setInspectTarget: (pos: THREE.Vector3 | null) => void
  setPointerActive: (active: boolean) => void
  setPointer: (ndc: THREE.Vector2, world: THREE.Vector3) => void
  setIsFollowing: (v: boolean) => void
}

export const useNavikaStore = create<NavikaState>((set) => ({
  ripplePulseNonce: 0,
  idleNonce: 0,
  idleType: null,
  inspectTargetPos: null,
  pointerActive: false,
  pointerNDC: new THREE.Vector2(),
  pointerWorld: new THREE.Vector3(),
  isFollowing: false,

  triggerIdle: (type) => set((s) => ({ idleNonce: s.idleNonce + 1, idleType: type })),
  triggerRipplePulse: () => set((s) => ({ ripplePulseNonce: s.ripplePulseNonce + 1 })),
  setInspectTarget: (pos) => set({ inspectTargetPos: pos }),
  setPointerActive: (active) => set({ pointerActive: active }),
  setPointer: (ndc, world) => set({ pointerNDC: ndc, pointerWorld: world }),
  setIsFollowing: (v) => set({ isFollowing: v }),
}))
