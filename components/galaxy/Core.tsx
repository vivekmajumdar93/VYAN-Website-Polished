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

const coreFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uGlow;
  uniform vec3 uColorCore;
  uniform vec3 uColorMid;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float ember = smoothstep(0.5, 0.0, d);
    ember = pow(ember, 3.6);
    float halo  = smoothstep(0.5, 0.05, d);
    halo = pow(halo, 1.8);
    vec3 col = mix(uColorMid, uColorCore, ember);
    col += vec3(1.0, 0.55, 0.30) * pow(ember, 4.0);
    float pulse = 0.85 + 0.15 * sin(uTime * 0.9);
    gl_FragColor = vec4(col * uGlow * pulse, (ember * 0.95 + halo * 0.35));
  }
`

const haloFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float a = smoothstep(0.5, 0.0, d);
    a = pow(a, 2.3);
    float pulse = 0.9 + 0.1 * sin(uTime * 0.6);
    gl_FragColor = vec4(uColor * pulse, a * 0.8);
  }
`

export default function Core() {
  const innerRef = useRef<THREE.Mesh>(null!)
  const haloRef = useRef<THREE.Mesh>(null!)
  const innerMat = useRef<THREE.ShaderMaterial>(null!)
  const haloMat = useRef<THREE.ShaderMaterial>(null!)
  const glowSetting = useGalaxyStore((s) => s.settings.coreGlow)

  useFrame(({ clock, camera }, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    const t = clock.elapsedTime
    const pulse = 1.0 + Math.sin(t * 1.1) * 0.035
    if (innerRef.current) {
      innerRef.current.scale.setScalar(pulse)
      innerRef.current.quaternion.copy(camera.quaternion)
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(pulse * 1.04)
      haloRef.current.quaternion.copy(camera.quaternion)
    }
    if (innerMat.current) {
      innerMat.current.uniforms.uTime.value += delta
      innerMat.current.uniforms.uGlow.value = glowSetting
    }
    if (haloMat.current) haloMat.current.uniforms.uTime.value += delta
  })

  return (
    <group>
      {/* Outer violet halo */}
      <mesh ref={haloRef}>
        <planeGeometry args={[7.2, 7.2]} />
        <shaderMaterial
          ref={haloMat}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={vert}
          fragmentShader={haloFrag}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color('#4a1370') },
          }}
        />
      </mesh>
      {/* Inner blood-red ember core */}
      <mesh ref={innerRef}>
        <planeGeometry args={[2.6, 2.6]} />
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
            uColorCore: { value: new THREE.Color('#ff1a2e') },
            uColorMid: { value: new THREE.Color('#5a0e3a') },
          }}
        />
      </mesh>
    </group>
  )
}
