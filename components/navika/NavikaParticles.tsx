'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavikaStore } from '../../store/navikaStore';
import { NAVIKA_MOUNT_TIME, NavikaRefs, clamp01 } from './types';

const COUNT = 60;
const MIN_RADIUS = 0.75;
const MAX_RADIUS = 1.35;
const ESCAPE_CHANCE_PER_SEC = 0.03;

const COLORS = [
  new THREE.Color('#b98cff'),
  new THREE.Color('#7c5cff'),
  new THREE.Color('#5c8bff'),
  new THREE.Color('#ffffff'),
];

type ParticlePhase = 'orbit' | 'escaping' | 'respawning';

interface ParticleData {
  angle: number;
  radius: number;
  baseRadius: number;
  speed: number;
  vertPhase: number;
  vertAmp: number;
  phase: ParticlePhase;
  phaseTimer: number;
  respawnDelay: number;
  color: THREE.Color;
  baseSize: number;
  spawnDelay: number;
  spawnDuration: number;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  attribute vec3 aColor;
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / max(-mvPosition.z, 0.0001));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAG = /* glsl */ `
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, glow * vOpacity);
  }
`;

interface Props {
  refs: React.MutableRefObject<NavikaRefs>;
}

export default function NavikaParticles({ refs }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const rippleRef = useRef<THREE.Mesh>(null);
  const rippleActive = useRef(false);
  const rippleTimer = useRef(0);

  const particles = useMemo<ParticleData[]>(() => {
    const arr: ParticleData[] = [];
    for (let i = 0; i < COUNT; i++) {
      const baseRadius = THREE.MathUtils.lerp(MIN_RADIUS, MAX_RADIUS, Math.random());
      arr.push({
        angle: Math.random() * Math.PI * 2,
        radius: baseRadius,
        baseRadius,
        speed: (0.15 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1),
        vertPhase: Math.random() * Math.PI * 2,
        vertAmp: 0.08 + Math.random() * 0.18,
        phase: 'orbit',
        phaseTimer: 0,
        respawnDelay: 0,
        color: COLORS[Math.floor(Math.random() * COLORS.length)].clone(),
        baseSize: 4 + Math.random() * 7,
        spawnDelay: Math.random() * 1.1,
        spawnDuration: 0.7 + Math.random() * 0.8,
      });
    }
    return arr;
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(COUNT), 1));
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(new Float32Array(COUNT), 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  // ripple pulse idle
  useEffect(
    () =>
      useNavikaStore.subscribe((state, prev) => {
        if (state.ripplePulseNonce === prev.ripplePulseNonce) return;
        rippleActive.current = true;
        rippleTimer.current = 0;
      }),
    []
  );

  // inspect-a-particle idle: pick one, publish its world position
  useEffect(
    () =>
      useNavikaStore.subscribe((state, prev) => {
        if (state.idleNonce === prev.idleNonce || state.idleType !== 'inspectParticle') return;
        const pick = particles[Math.floor(Math.random() * particles.length)];
        const x = Math.cos(pick.angle) * pick.radius;
        const y = Math.sin(pick.vertPhase) * pick.vertAmp;
        const z = Math.sin(pick.angle) * pick.radius * 0.42;
        const world = new THREE.Vector3(x, y, z);
        if (refs.current.root) world.add(refs.current.root.position);
        useNavikaStore.getState().setInspectTarget(world);
      }),
    [particles, refs]
  );

  useFrame((_, delta) => {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const size = geometry.attributes.aSize as THREE.BufferAttribute;
    const opacity = geometry.attributes.aOpacity as THREE.BufferAttribute;
    const color = geometry.attributes.aColor as THREE.BufferAttribute;

    const age = (performance.now() - NAVIKA_MOUNT_TIME) / 1000;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.angle += p.speed * delta;
      p.phaseTimer += delta;

      if (p.phase === 'orbit') {
        if (Math.random() < ESCAPE_CHANCE_PER_SEC * delta) {
          p.phase = 'escaping';
          p.phaseTimer = 0;
        }
      } else if (p.phase === 'escaping') {
        const dur = 1.6;
        const pr = clamp01(p.phaseTimer / dur);
        p.radius = THREE.MathUtils.lerp(p.baseRadius, p.baseRadius * 2.6, pr);
        if (pr >= 1) {
          p.phase = 'respawning';
          p.phaseTimer = 0;
          p.respawnDelay = 0.4 + Math.random() * 1.2;
        }
      } else if (p.phase === 'respawning') {
        if (p.phaseTimer >= p.respawnDelay) {
          p.phase = 'orbit';
          p.phaseTimer = 0;
          p.radius = p.baseRadius;
          p.angle = Math.random() * Math.PI * 2;
        }
      }

      // spawn-in convergence: particles coalesce inward from scattered positions
      const spawnLocalT = clamp01((age - p.spawnDelay) / p.spawnDuration);
      const spawnActive = age < p.spawnDelay + p.spawnDuration;
      const effectiveRadius = spawnActive
        ? THREE.MathUtils.lerp(p.radius * 3.2, p.radius, spawnLocalT)
        : p.radius;

      const x = Math.cos(p.angle) * effectiveRadius;
      const z = Math.sin(p.angle) * effectiveRadius * 0.42;
      const y = Math.sin(performance.now() * 0.0006 + p.vertPhase) * p.vertAmp;
      pos.setXYZ(i, x, y, z);

      let o = 1;
      let s = p.baseSize;
      if (age < p.spawnDelay) {
        o = 0;
      } else if (spawnActive) {
        o = spawnLocalT;
        s = p.baseSize * (0.3 + 0.7 * spawnLocalT);
      } else if (p.phase === 'escaping') {
        const pr = clamp01(p.phaseTimer / 1.6);
        o = 1 - pr;
        s = p.baseSize * (1 - pr * 0.6);
      } else if (p.phase === 'respawning') {
        o = 0;
      }
      opacity.setX(i, o);
      size.setX(i, s);
      color.setXYZ(i, p.color.r, p.color.g, p.color.b);
    }

    pos.needsUpdate = true;
    opacity.needsUpdate = true;
    size.needsUpdate = true;
    color.needsUpdate = true;

    if (pointsRef.current && refs.current.root) {
      pointsRef.current.position.copy(refs.current.root.position);
    }

    // ripple pulse
    if (rippleActive.current && rippleRef.current) {
      rippleTimer.current += delta;
      const dur = 1.2;
      const rt = clamp01(rippleTimer.current / dur);
      const scale = THREE.MathUtils.lerp(0.3, 2.4, rt);
      rippleRef.current.scale.set(scale, scale, scale);
      (rippleRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - rt) * 0.55;
      rippleRef.current.visible = true;
      if (refs.current.root) rippleRef.current.position.copy(refs.current.root.position);
      if (rt >= 1) rippleActive.current = false;
    } else if (rippleRef.current) {
      rippleRef.current.visible = false;
    }
  });

  return (
    <>
      <points ref={pointsRef} geometry={geometry} material={material} />
      <mesh ref={rippleRef} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.0, 64]} />
        <meshBasicMaterial color="#a97cff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  );
}
