'use client'
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export default function Core() {
  const innerRef = useRef<THREE.Mesh>(null!)
  const outerRef = useRef<THREE.Mesh>(null!)

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    const pulse = 1.0 + Math.sin(t * 1.2) * 0.04
    if (innerRef.current) {
      innerRef.current.scale.setScalar(pulse)
      innerRef.current.quaternion.copy(camera.quaternion)
    }
    if (outerRef.current) {
      outerRef.current.scale.setScalar(pulse * 1.05)
      outerRef.current.quaternion.copy(camera.quaternion)
    }
  })

  return (
    <group>
      {/* Outer purple halo */}
      <mesh ref={outerRef}>
        <planeGeometry args={[6, 6]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{ uColor: { value: new THREE.Color('#7a4cff') } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            uniform vec3 uColor;
            void main() {
              float d = distance(vUv, vec2(0.5));
              float a = smoothstep(0.5, 0.0, d);
              a = pow(a, 2.5);
              gl_FragColor = vec4(uColor, a * 0.9);
            }
          `}
        />
      </mesh>
      {/* Bright white inner core */}
      <mesh ref={innerRef}>
        <planeGeometry args={[2.2, 2.2]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            void main() {
              float d = distance(vUv, vec2(0.5));
              float a = smoothstep(0.5, 0.0, d);
              a = pow(a, 3.5);
              vec3 col = mix(vec3(0.85, 0.7, 1.0), vec3(1.0), a);
              gl_FragColor = vec4(col, a);
            }
          `}
        />
      </mesh>
    </group>
  )
}
