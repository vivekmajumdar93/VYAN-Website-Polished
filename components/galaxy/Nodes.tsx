'use client'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { NODES, useGalaxyStore, type GalaxyNode } from '@/lib/store'

function Node({ node }: { node: GalaxyNode }) {
  const ref = useRef<THREE.Mesh>(null!)
  const haloRef = useRef<THREE.Mesh>(null!)
  const [hover, setHover] = useState(false)
  const setSelected = useGalaxyStore((s) => s.setSelected)
  const setHovered = useGalaxyStore((s) => s.setHovered)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pulse = 1 + Math.sin(t * 2 + node.position[0]) * 0.18
    if (ref.current) ref.current.scale.setScalar((hover ? 1.7 : 1) * pulse)
    if (haloRef.current) haloRef.current.scale.setScalar((hover ? 2.9 : 2.0) * pulse)
  })

  return (
    <Billboard position={node.position}>
      <mesh ref={haloRef}>
        <circleGeometry args={[0.24, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{ uColor: { value: new THREE.Color(node.color) } }}
          vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
          fragmentShader={`
            varying vec2 vUv; uniform vec3 uColor;
            void main(){
              float d = distance(vUv, vec2(0.5));
              float a = smoothstep(0.5, 0.0, d);
              a = pow(a, 2.0);
              gl_FragColor = vec4(uColor, a * 0.9);
            }
          `}
        />
      </mesh>
      <mesh
        ref={ref}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); setHovered(node.id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); setHovered(null); document.body.style.cursor = 'default' }}
        onClick={(e) => { e.stopPropagation(); setSelected(node) }}
      >
        <circleGeometry args={[0.06, 24]} />
        <meshBasicMaterial color={'white'} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </Billboard>
  )
}

export default function Nodes() {
  return (
    <group>
      {NODES.map((n) => (
        <Node key={n.id} node={n} />
      ))}
    </group>
  )
}
