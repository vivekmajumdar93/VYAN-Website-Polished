'use client';

import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';

type GatewayDef = {
  id: string;
  name: string;
  color: string;
  radius: number;
  position: [number, number, number];
  route: string;
};

// Colors match the existing gateway palette in lib/vistara/gateways.ts
const VYAN_GATEWAYS: GatewayDef[] = [
  { id: 'orb_1', name: 'Ṛtam',  color: '#d4a853', radius: 1.2, position: [ 0,    1.5,  0], route: '/vistara/ritam'  },
  { id: 'orb_2', name: 'Ojas',  color: '#e8c87a', radius: 0.8, position: [ 2,    0,    1], route: '/vistara/ojas'   },
  { id: 'orb_3', name: 'Mudrā', color: '#3a90ff', radius: 0.9, position: [-2,    0.5, -1], route: '/vistara/mudra'  },
];

function InteractiveOrb({ data, onSelect }: { data: GatewayDef; onSelect: (route: string) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.position.y = data.position[1] + Math.sin(state.clock.elapsedTime + data.position[0]) * 0.1;
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <mesh
      ref={meshRef}
      position={data.position}
      onClick={() => onSelect(data.route)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      scale={hovered ? 1.2 : 1}
    >
      <sphereGeometry args={[data.radius, 32, 32]} />
      <meshPhysicalMaterial
        color={data.color}
        transmission={0.9}
        opacity={1}
        metalness={0.8}
        roughness={0.1}
        ior={1.5}
        thickness={0.5}
      />
      {hovered && (
        <Html center distanceFactor={10}>
          <div style={{
            color: '#fff',
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.85)',
            border: `1px solid ${data.color}80`,
            borderRadius: 6,
            backdropFilter: 'blur(12px)',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {data.name}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function OrbGalaxy({ onSelect }: { onSelect: (route: string) => void }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.002;
  });

  return (
    <group ref={groupRef}>
      {VYAN_GATEWAYS.map((orb) => (
        <InteractiveOrb data={orb} key={orb.id} onSelect={onSelect} />
      ))}
    </group>
  );
}

export default function VyanInterface() {
  const router = useRouter();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000005' }}>
      <Canvas camera={{ position: [0, -2, 10], fov: 45 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#d4a853" />
        <OrbGalaxy onSelect={(route) => router.push(route)} />
      </Canvas>
    </div>
  );
}
