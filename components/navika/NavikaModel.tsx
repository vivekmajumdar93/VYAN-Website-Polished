'use client';

import { MutableRefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { NavikaRefs } from './types';

const MODEL_PATH = '/models/navika.glb';

interface Props {
  refs: MutableRefObject<NavikaRefs>;
}

export default function NavikaModel({ refs }: Props) {
  const { scene } = useGLTF(MODEL_PATH);

  // Clone once on first render so multiple mounts don't share the same Object3D
  const cloned = useRef<THREE.Group | null>(null);
  if (!cloned.current) cloned.current = scene.clone(true) as THREE.Group;

  useFrame(() => {
    const s = cloned.current;
    if (!s) return;
    refs.current.root       = s;
    refs.current.body       = (s.getObjectByName('navika_body')         ?? null) as THREE.Mesh | null;
    refs.current.chainFront = (s.getObjectByName('navika_chain')        ?? null) as THREE.Object3D | null;
    refs.current.petalLeft  = (s.getObjectByName('navika_petal_left')   ?? null) as THREE.Mesh | null;
    refs.current.petalCenter= (s.getObjectByName('navika_petal_center') ?? null) as THREE.Mesh | null;
    refs.current.petalRight = (s.getObjectByName('navika_petal_right')  ?? null) as THREE.Mesh | null;
    refs.current.eyeLeft    = (s.getObjectByName('navika_eye_left')     ?? null) as THREE.Mesh | null;
    refs.current.eyeRight   = (s.getObjectByName('navika_eye_right')    ?? null) as THREE.Mesh | null;
  });

  if (!cloned.current) return null;
  return <primitive object={cloned.current} />;
}

useGLTF.preload(MODEL_PATH);
