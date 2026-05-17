'use client'
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export default function LensFlare() {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ camera }) => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion)
  })
  return (
    <mesh ref={ref} renderOrder={5}>
      <planeGeometry args={[1.2, 18]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={false}
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
            float x = abs(vUv.x - 0.5) * 2.0;
            float y = abs(vUv.y - 0.5) * 2.0;
            float horiz = 1.0 - smoothstep(0.0, 1.0, x);
            float vert  = 1.0 - smoothstep(0.0, 1.0, y);
            horiz = pow(horiz, 5.0);
            vert = pow(vert, 1.4);
            float a = horiz * vert;
            vec3 col = mix(vec3(0.6, 0.4, 1.0), vec3(1.0, 0.9, 1.0), horiz);
            gl_FragColor = vec4(col, a * 0.9);
          }
        `}
      />
    </mesh>
  )
}
