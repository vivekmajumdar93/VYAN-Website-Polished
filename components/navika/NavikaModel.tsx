'use client';

import { MutableRefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NavikaRefs } from './types';

interface Props {
  refs: MutableRefObject<NavikaRefs>;
}

export default function NavikaModel({ refs }: Props) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const chainRef = useRef<THREE.Mesh>(null);
  const petalLRef = useRef<THREE.Mesh>(null);
  const petalCRef = useRef<THREE.Mesh>(null);
  const petalRRef = useRef<THREE.Mesh>(null);
  const eyeLRef = useRef<THREE.Mesh>(null);
  const eyeRRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    refs.current.root = rootRef.current;
    refs.current.body = bodyRef.current;
    refs.current.chainFront = chainRef.current;
    refs.current.petalLeft = petalLRef.current;
    refs.current.petalCenter = petalCRef.current;
    refs.current.petalRight = petalRRef.current;
    refs.current.eyeLeft = eyeLRef.current;
    refs.current.eyeRight = eyeRRef.current;
  });

  return (
    <group ref={rootRef}>
      {/* Core orb */}
      <mesh ref={bodyRef}>
        <sphereGeometry args={[0.68, 32, 32]} />
        <meshStandardMaterial
          color="#5520e8"
          emissive="#2a0880"
          emissiveIntensity={0.9}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Equatorial ring — chain front */}
      <mesh ref={chainRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.78, 0.034, 8, 52]} />
        <meshStandardMaterial
          color="#9060ff"
          emissive="#5030aa"
          emissiveIntensity={1.1}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Left petal */}
      <mesh ref={petalLRef} position={[-0.52, 0.43, 0.06]} rotation={[0.2, 0.14, 0.74]}>
        <planeGeometry args={[0.26, 0.50]} />
        <meshStandardMaterial
          color="#b890ff"
          emissive="#7040cc"
          emissiveIntensity={0.7}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center petal */}
      <mesh ref={petalCRef} position={[0, 0.73, 0.04]}>
        <planeGeometry args={[0.22, 0.46]} />
        <meshStandardMaterial
          color="#cdb0ff"
          emissive="#8050dd"
          emissiveIntensity={0.7}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Right petal */}
      <mesh ref={petalRRef} position={[0.52, 0.43, 0.06]} rotation={[0.2, -0.14, -0.74]}>
        <planeGeometry args={[0.26, 0.50]} />
        <meshStandardMaterial
          color="#b890ff"
          emissive="#7040cc"
          emissiveIntensity={0.7}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Eyes — each mesh ref starts at origin within its socket group;
          NavikaAnimator sets position to tiny saccade offsets and scale.y for blinks */}
      <group position={[0, 0.13, 0.65]}>
        <group position={[-0.19, 0, 0]}>
          <mesh ref={eyeLRef}>
            <sphereGeometry args={[0.079, 12, 8]} />
            <meshStandardMaterial
              color="#ede8ff"
              emissive="#c0a0ff"
              emissiveIntensity={1.2}
              transparent
              opacity={1}
            />
          </mesh>
        </group>
        <group position={[0.19, 0, 0]}>
          <mesh ref={eyeRRef}>
            <sphereGeometry args={[0.079, 12, 8]} />
            <meshStandardMaterial
              color="#ede8ff"
              emissive="#c0a0ff"
              emissiveIntensity={1.2}
              transparent
              opacity={1}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
