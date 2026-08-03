'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavikaStore } from '../../store/navikaStore';
import { NAVIKA_MOUNT_TIME, NavikaRefs, clamp01 } from './types';

interface Props {
  refs: React.MutableRefObject<NavikaRefs>;
}

type BlinkPhase = 'open' | 'closing' | 'closed' | 'opening';

const CLOSE_T = 0.07;
const HOLD_T = 0.03;
const OPEN_T = 0.09;
const FORCED_CLOSE_MS = 750;
const MATERIAL_FADE_DURATION = 1.4;

function nextBlinkDelay() {
  return 3 + Math.random() * 5; // 3-8s
}

function nextSaccadeDelay() {
  return 0.5 + Math.random() * 1.2;
}

export default function NavikaAnimator({ refs }: Props) {
  const nextBlinkAt = useRef(nextBlinkDelay());
  const blinkPhase = useRef<BlinkPhase>('open');
  const blinkTimer = useRef(0);
  const forcedCloseUntil = useRef<number | null>(null);

  const nextSaccadeAt = useRef(nextSaccadeDelay());
  const saccadeTimer = useRef(0);
  const saccadeTarget = useRef(new THREE.Vector3());
  const saccadeCurrent = useRef(new THREE.Vector3());

  const petalPhase = useRef({
    left: Math.random() * Math.PI * 2,
    center: Math.random() * Math.PI * 2,
    right: Math.random() * Math.PI * 2,
  });

  useEffect(
    () =>
      useNavikaStore.subscribe((state, prev) => {
        if (state.idleNonce === prev.idleNonce) return;
        if (state.idleType === 'closeEyes') {
          forcedCloseUntil.current = performance.now() + FORCED_CLOSE_MS;
        }
      }),
    []
  );

  useFrame((_, delta) => {
    const t = (performance.now() - NAVIKA_MOUNT_TIME) / 1000;

    // ---- spawn-in material fade (paired with NavikaMovement's scale pop) ----
    const spawnOpacity = clamp01(t / MATERIAL_FADE_DURATION);
    setMaterialProp(refs.current.body, 'opacity', spawnOpacity);
    setMaterialProp(refs.current.chainFront, 'opacity', spawnOpacity);
    setMaterialProp(refs.current.petalLeft, 'opacity', spawnOpacity);
    setMaterialProp(refs.current.petalCenter, 'opacity', spawnOpacity);
    setMaterialProp(refs.current.petalRight, 'opacity', spawnOpacity);

    // ---- blinking ----
    blinkTimer.current += delta;
    const now = performance.now();
    const forced = forcedCloseUntil.current !== null && now < forcedCloseUntil.current;

    if (forced) {
      applyEyeScale(refs, 0.06);
    } else {
      if (forcedCloseUntil.current !== null && now >= forcedCloseUntil.current) {
        forcedCloseUntil.current = null;
        blinkTimer.current = 0;
        blinkPhase.current = 'opening';
      }

      if (blinkPhase.current === 'open' && blinkTimer.current >= nextBlinkAt.current) {
        blinkPhase.current = 'closing';
        blinkTimer.current = 0;
      }

      let scaleY = 1;
      if (blinkPhase.current === 'closing') {
        const p = clamp01(blinkTimer.current / CLOSE_T);
        scaleY = 1 - p * 0.94;
        if (p >= 1) {
          blinkPhase.current = 'closed';
          blinkTimer.current = 0;
        }
      } else if (blinkPhase.current === 'closed') {
        scaleY = 0.06;
        if (blinkTimer.current >= HOLD_T) {
          blinkPhase.current = 'opening';
          blinkTimer.current = 0;
        }
      } else if (blinkPhase.current === 'opening') {
        const p = clamp01(blinkTimer.current / OPEN_T);
        scaleY = 0.06 + p * 0.94;
        if (p >= 1) {
          blinkPhase.current = 'open';
          blinkTimer.current = 0;
          nextBlinkAt.current = nextBlinkDelay();
        }
      }
      applyEyeScale(refs, scaleY);
    }

    // ---- eye micro-movements (saccades), always running ----
    saccadeTimer.current += delta;
    if (saccadeTimer.current >= nextSaccadeAt.current) {
      saccadeTarget.current.set((Math.random() - 0.5) * 0.018, (Math.random() - 0.5) * 0.012, 0);
      saccadeTimer.current = 0;
      nextSaccadeAt.current = nextSaccadeDelay();
    }
    saccadeCurrent.current.lerp(saccadeTarget.current, clamp01(delta * 8));
    if (refs.current.eyeLeft) refs.current.eyeLeft.position.set(saccadeCurrent.current.x, saccadeCurrent.current.y, 0);
    if (refs.current.eyeRight) refs.current.eyeRight.position.set(saccadeCurrent.current.x, saccadeCurrent.current.y, 0);

    // ---- soft emissive "breathing" ----
    const breathe = 0.75 + Math.sin(t * 1.1) * 0.25 + Math.sin(t * 0.31) * 0.08;
    setMaterialProp(refs.current.body, 'emissiveIntensity', breathe);
    setMaterialProp(refs.current.chainFront, 'emissiveIntensity', breathe * 1.1);
    const eyeBreathe = 0.9 + Math.sin(t * 1.1 + 0.4) * 0.2;
    setMaterialProp(refs.current.eyeLeft, 'emissiveIntensity', eyeBreathe);
    setMaterialProp(refs.current.eyeRight, 'emissiveIntensity', eyeBreathe);

    // ---- independent petal sway, each with its own phase ----
    swayPetal(refs.current.petalLeft, t, petalPhase.current.left, 0.22);
    swayPetal(refs.current.petalCenter, t, petalPhase.current.center, 0.14);
    swayPetal(refs.current.petalRight, t, petalPhase.current.right, 0.22);
  });

  return null;
}

function applyEyeScale(refs: React.MutableRefObject<NavikaRefs>, scaleY: number) {
  if (refs.current.eyeLeft) refs.current.eyeLeft.scale.y = scaleY;
  if (refs.current.eyeRight) refs.current.eyeRight.scale.y = scaleY;
}

function setMaterialProp(
  obj: THREE.Object3D | THREE.Group | null | undefined,
  prop: 'opacity' | 'emissiveIntensity',
  value: number
) {
  if (!obj) return;
  const target = (obj as THREE.Group).children?.length ? (obj as THREE.Group).children[0] : obj;
  const mat = (target as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
  if (mat && prop in mat) (mat as any)[prop] = value;
}

function swayPetal(mesh: THREE.Mesh | null | undefined, t: number, phase: number, amp: number) {
  if (!mesh) return;
  mesh.rotation.z = Math.sin(t * 0.6 + phase) * amp * 0.5;
  mesh.rotation.x = Math.cos(t * 0.45 + phase) * amp * 0.3;
}
