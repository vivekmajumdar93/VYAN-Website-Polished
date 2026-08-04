'use client';

import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { NavikaRefs } from './types';
import NavikaModel from './NavikaModel';
import NavikaAnimator from './NavikaAnimator';
import NavikaMovement from './NavikaMovement';
import NavikaParticles from './NavikaParticles';
import NavikaIdleController from './NavikaIdleController';

interface Props {
  standalone?: boolean;
  containerRef?: React.RefObject<HTMLElement>;
  homePosition?: [number, number, number];
}

const INITIAL_REFS: NavikaRefs = {
  root: null,
  body: null,
  chainFront: null,
  petalLeft: null,
  petalCenter: null,
  petalRight: null,
  eyeLeft: null,
  eyeRight: null,
};

export default function Navika({ containerRef, homePosition }: Props) {
  const refs = useRef<NavikaRefs>(INITIAL_REFS);

  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 50 }}
      style={{ position: 'absolute', inset: 0, background: 'transparent' }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[2, 2, 2]} intensity={1.4} color="#9c6eff" />
      <pointLight position={[-2, -1, 1]} intensity={0.55} color="#4466ff" />
      <NavikaModel refs={refs} />
      <NavikaParticles refs={refs} />
      <NavikaAnimator refs={refs} />
      <NavikaMovement refs={refs} homePosition={homePosition} containerRef={containerRef} />
      <NavikaIdleController />
    </Canvas>
  );
}
