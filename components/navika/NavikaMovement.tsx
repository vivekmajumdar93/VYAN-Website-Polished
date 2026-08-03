'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavikaStore, IdleAnimationType } from '../../store/navikaStore';
import { NAVIKA_MOUNT_TIME, NavikaRefs, clamp01, easeOutBack } from './types';

interface Props {
  refs: React.MutableRefObject<NavikaRefs>;
  homePosition?: [number, number, number];
  /**
   * When set, cursor tracking is scoped to this element's bounding box
   * instead of the full window — use for small fixed-position widgets
   * (e.g. a corner orb) so Navika only reacts to the cursor while it's
   * actually near the widget, not anywhere on the page.
   */
  containerRef?: React.RefObject<HTMLElement>;
}

const APPROACH_DELAY_MS = 1000; // cursor must be still this long before Navika drifts closer
const APPROACH_LERP = 2.2;
const RETREAT_LERP = 3.0;
const MAX_APPROACH_DISTANCE = 1.1;
const POINTER_STILL_THRESHOLD = 0.0018; // ndc delta considered "stopped"
const MAX_YAW = THREE.MathUtils.degToRad(38);
const MAX_PITCH = THREE.MathUtils.degToRad(20);
const SPAWN_DURATION = 1.6;

const MOVEMENT_IDLE_TYPES: IdleAnimationType[] = [
  'headTilt',
  'lookLeft',
  'lookRight',
  'rotate20',
  'inspectParticle',
  'spinSlow',
  'floatHigher',
  'stretch',
];

export default function NavikaMovement({ refs, homePosition = [0, 0, 0], containerRef }: Props) {
  const { camera, size } = useThree();
  const home = useRef(new THREE.Vector3(...homePosition));
  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));

  const lastNDC = useRef(new THREE.Vector2(0, 0));
  const pointerStillSince = useRef<number | null>(null);

  const followOffset = useRef(new THREE.Vector3(0, 0, 0));
  const currentYaw = useRef(0);
  const currentPitch = useRef(0);
  const currentRoll = useRef(0);
  const prevBobY = useRef(0);
  const velocityY = useRef(0);
  const scaleSmoothed = useRef(new THREE.Vector3(1, 1, 1));

  const activeIdle = useRef<IdleAnimationType | null>(null);
  const idleStart = useRef(0);
  const idleHomeYBoost = useRef(0);

  useEffect(() => {
    // Scoped mode: NDC computed against the widget's own bounding box, and
    // "active" only while the cursor is actually within a small margin
    // around it. Unscoped mode (no containerRef): full window, for
    // full-bleed hero/standalone usage.
    const MARGIN_PX = 140; // how far outside the box Navika still notices the cursor

    function toNDC(clientX: number, clientY: number) {
      if (containerRef?.current) {
        const r = containerRef.current.getBoundingClientRect();
        return new THREE.Vector2(
          ((clientX - r.left) / r.width) * 2 - 1,
          -((clientY - r.top) / r.height) * 2 + 1
        );
      }
      return new THREE.Vector2((clientX / size.width) * 2 - 1, -(clientY / size.height) * 2 + 1);
    }

    function withinScope(clientX: number, clientY: number) {
      if (!containerRef?.current) return true;
      const r = containerRef.current.getBoundingClientRect();
      return (
        clientX > r.left - MARGIN_PX &&
        clientX < r.right + MARGIN_PX &&
        clientY > r.top - MARGIN_PX &&
        clientY < r.bottom + MARGIN_PX
      );
    }

    function onPointerMove(e: PointerEvent) {
      if (!withinScope(e.clientX, e.clientY)) {
        useNavikaStore.getState().setPointerActive(false);
        useNavikaStore.getState().setIsFollowing(false);
        pointerStillSince.current = null;
        return;
      }

      const ndc = toNDC(e.clientX, e.clientY);
      const delta = ndc.distanceTo(lastNDC.current);
      lastNDC.current.copy(ndc);

      if (delta > POINTER_STILL_THRESHOLD) {
        pointerStillSince.current = null;
        useNavikaStore.getState().setIsFollowing(false);
      } else if (pointerStillSince.current === null) {
        pointerStillSince.current = performance.now();
      }

      raycaster.current.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      const didHit = raycaster.current.ray.intersectPlane(plane.current, hit);
      if (didHit) useNavikaStore.getState().setPointer(ndc, hit);
      useNavikaStore.getState().setPointerActive(true);
    }

    function onPointerLeave() {
      useNavikaStore.getState().setPointerActive(false);
      useNavikaStore.getState().setIsFollowing(false);
      pointerStillSince.current = null;
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [camera, size, containerRef]);

  useEffect(
    () =>
      useNavikaStore.subscribe((state, prev) => {
        if (state.idleNonce === prev.idleNonce || !state.idleType) return;
        if (MOVEMENT_IDLE_TYPES.includes(state.idleType)) {
          activeIdle.current = state.idleType;
          idleStart.current = performance.now();
        }
      }),
    []
  );

  useFrame((_, delta) => {
    const root = refs.current.root;
    if (!root) return;

    const store = useNavikaStore.getState();
    const now = performance.now();
    const t = (now - NAVIKA_MOUNT_TIME) / 1000;

    // ---- layered ambient hover (never fully still) ----
    const bobY = Math.sin(t * 0.9) * 0.055 + Math.sin(t * 2.3) * 0.012;
    const fig8X = Math.sin(t * 0.55) * 0.09;
    const fig8Z = Math.sin(t * 1.1) * 0.05;
    const driftX = Math.sin(t * 0.17) * 0.03;
    const ambientRoll = Math.sin(t * 0.4) * 0.035;

    velocityY.current = (bobY - prevBobY.current) / Math.max(delta, 1 / 240);
    prevBobY.current = bobY;

    // ---- resolve active idle animation (additive overrides) ----
    let idleYawAdd = 0;
    let idlePitchAdd = 0;
    let idleRollAdd = 0;
    let idleYBoostTarget = 0;
    let idleScaleBoost = 0;
    let idleSpinYaw = 0;
    let suppressCursor = false;

    if (activeIdle.current) {
      const elapsed = (now - idleStart.current) / 1000;
      switch (activeIdle.current) {
        case 'headTilt': {
          const p = clamp01(elapsed / 1.6);
          idleRollAdd = Math.sin(p * Math.PI) * THREE.MathUtils.degToRad(14);
          if (p >= 1) activeIdle.current = null;
          break;
        }
        case 'lookLeft': {
          const p = clamp01(elapsed / 2.2);
          idleYawAdd = Math.sin(p * Math.PI) * THREE.MathUtils.degToRad(32);
          suppressCursor = p < 1;
          if (p >= 1) activeIdle.current = null;
          break;
        }
        case 'lookRight': {
          const p = clamp01(elapsed / 2.2);
          idleYawAdd = -Math.sin(p * Math.PI) * THREE.MathUtils.degToRad(32);
          suppressCursor = p < 1;
          if (p >= 1) activeIdle.current = null;
          break;
        }
        case 'rotate20': {
          const p = clamp01(elapsed / 1.8);
          const eased = 1 - Math.pow(1 - p, 3);
          idleYawAdd = (p < 1 ? eased : 1 - eased) * THREE.MathUtils.degToRad(20);
          if (p >= 1) activeIdle.current = null;
          break;
        }
        case 'spinSlow': {
          const p = clamp01(elapsed / 2.6);
          const eased = 0.5 - 0.5 * Math.cos(p * Math.PI);
          idleSpinYaw = eased * Math.PI * 2;
          suppressCursor = true;
          if (p >= 1) activeIdle.current = null;
          break;
        }
        case 'floatHigher': {
          const p = clamp01(elapsed / 3.2);
          idleYBoostTarget = Math.sin(p * Math.PI) * 0.32;
          if (p >= 1) activeIdle.current = null;
          break;
        }
        case 'stretch': {
          const p = clamp01(elapsed / 1.4);
          idleScaleBoost = Math.sin(p * Math.PI) * 0.14;
          if (p >= 1) activeIdle.current = null;
          break;
        }
        case 'inspectParticle': {
          const p = clamp01(elapsed / 2.4);
          suppressCursor = p < 1;
          const target = store.inspectTargetPos;
          if (target) {
            const local = target.clone().sub(root.position);
            idleYawAdd = THREE.MathUtils.clamp(Math.atan2(local.x, Math.max(local.z, 0.6)), -MAX_YAW, MAX_YAW);
            idlePitchAdd = THREE.MathUtils.clamp(-local.y * 0.4, -MAX_PITCH, MAX_PITCH);
          }
          if (p >= 1) {
            activeIdle.current = null;
            store.setInspectTarget(null);
          }
          break;
        }
        default:
          break;
      }
    }

    // ---- cursor facing + proximity approach ----
    let cursorYaw = 0;
    let cursorPitch = 0;

    if (store.pointerActive && !suppressCursor) {
      const local = store.pointerWorld.clone().sub(home.current);
      cursorYaw = THREE.MathUtils.clamp(Math.atan2(local.x, 2.2), -MAX_YAW, MAX_YAW);
      cursorPitch = THREE.MathUtils.clamp(local.y * 0.15, -MAX_PITCH, MAX_PITCH);

      const stillFor = pointerStillSince.current ? now - pointerStillSince.current : 0;
      if (stillFor > APPROACH_DELAY_MS && !store.isFollowing) {
        store.setIsFollowing(true);
      }
    }

    if (store.isFollowing && store.pointerActive && !suppressCursor) {
      const dir = store.pointerWorld.clone().sub(home.current);
      const dist = dir.length();
      const clamped = dir.normalize().multiplyScalar(Math.min(dist * 0.5, MAX_APPROACH_DISTANCE));
      followOffset.current.lerp(clamped, clamp01(delta * APPROACH_LERP));
    } else {
      followOffset.current.lerp(new THREE.Vector3(0, 0, 0), clamp01(delta * RETREAT_LERP));
    }

    // ---- compose + apply transforms ----
    currentYaw.current = THREE.MathUtils.lerp(currentYaw.current, cursorYaw + idleYawAdd, clamp01(delta * 3.2));
    currentPitch.current = THREE.MathUtils.lerp(currentPitch.current, cursorPitch + idlePitchAdd, clamp01(delta * 3.2));
    currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, ambientRoll + idleRollAdd, clamp01(delta * 4));
    idleHomeYBoost.current = THREE.MathUtils.lerp(idleHomeYBoost.current, idleYBoostTarget, clamp01(delta * 2.5));

    root.position.set(
      home.current.x + fig8X + driftX + followOffset.current.x,
      home.current.y + bobY + idleHomeYBoost.current + followOffset.current.y,
      home.current.z + fig8Z + followOffset.current.z
    );
    root.rotation.set(currentPitch.current, currentYaw.current + idleSpinYaw, currentRoll.current);

    // squash & stretch from vertical velocity + idle stretch pose
    const stretch = THREE.MathUtils.clamp(velocityY.current * 0.09, -0.05, 0.06);
    const targetScale = new THREE.Vector3(
      1 - stretch - idleScaleBoost * 0.5,
      1 + stretch * 1.4 + idleScaleBoost,
      1 - stretch - idleScaleBoost * 0.5
    );
    scaleSmoothed.current.lerp(targetScale, clamp01(delta * 6));

    // spawn-in: particles-to-form pop, eased overshoot for a living "arrival"
    const spawnT = clamp01(t / SPAWN_DURATION);
    const spawnScale = spawnT < 1 ? Math.max(easeOutBack(spawnT), 0) : 1;

    root.scale.set(
      scaleSmoothed.current.x * spawnScale,
      scaleSmoothed.current.y * spawnScale,
      scaleSmoothed.current.z * spawnScale
    );
  });

  return null;
}
