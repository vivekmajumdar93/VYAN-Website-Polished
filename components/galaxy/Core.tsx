'use client'
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGalaxyStore } from '@/lib/store'

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Small, tight, violet-white center glow. No big halo.
const coreFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uGlow;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float ember = smoothstep(0.5, 0.0, d);
    ember = pow(ember, 3.2);
    vec3 col = mix(vec3(0.55, 0.45, 1.0), vec3(1.0, 0.95, 1.0), pow(ember, 4.0));
    float pulse = 0.92 + 0.08 * sin(uTime * 1.1);
    gl_FragColor = vec4(col * uGlow * pulse, ember);
  }
`

export default function Core() {
  const innerRef = useRef<THREE.Mesh>(null!)
  const innerMat = useRef<THREE.ShaderMaterial>(null!)
  const glowSetting = useGalaxyStore((s) => s.settings.coreGlow)

  useFrame(({ clock, camera }, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    const t = clock.elapsedTime
    const pulse = 1.0 + Math.sin(t * 1.0) * 0.03
    if (innerRef.current) {
      innerRef.current.scale.setScalar(pulse)
      innerRef.current.quaternion.copy(camera.quaternion)
    }
    if (innerMat.current) {
      innerMat.current.uniforms.uTime.value += delta
      innerMat.current.uniforms.uGlow.value = glowSetting
    }
  })

  return (
    <mesh ref={innerRef}>
      <planeGeometry args={[0.7, 0.7]} />
      <shaderMaterial
        ref={innerMat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={vert}
        fragmentShader={coreFrag}
        uniforms={{
          uTime: { value: 0 },
          uGlow: { value: glowSetting },
        }}
      />
    </mesh>
  )
}
