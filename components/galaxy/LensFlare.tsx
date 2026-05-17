'use client'
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const streakFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorHot;
  uniform vec3 uColorCold;
  void main() {
    float x = abs(vUv.x - 0.5) * 2.0;
    float y = abs(vUv.y - 0.5) * 2.0;
    // Tight horizontal falloff = razor thin beam
    float horiz = 1.0 - smoothstep(0.0, 1.0, x);
    float vert  = 1.0 - smoothstep(0.0, 1.0, y);
    horiz = pow(horiz, 14.0);
    vert  = pow(vert, 1.4);
    float shimmer = 0.9 + 0.1 * sin(uTime * 2.0 + vUv.y * 40.0);
    float breathe = 0.9 + 0.1 * sin(uTime * 0.7);
    float a = horiz * vert * shimmer * breathe * uIntensity;
    vec3 col = mix(uColorCold, uColorHot, horiz);
    gl_FragColor = vec4(col, a);
  }
`

export default function LensFlare() {
  const ref = useRef<THREE.Group>(null!)
  const streakMat = useRef<THREE.ShaderMaterial>(null!)

  useFrame(({ camera }, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    if (ref.current) ref.current.quaternion.copy(camera.quaternion)

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const upDot = Math.abs(dir.y)
    const angleFactor = THREE.MathUtils.clamp(1.0 - upDot, 0.25, 1.0)

    if (streakMat.current) {
      streakMat.current.uniforms.uTime.value += delta
      streakMat.current.uniforms.uIntensity.value = 0.85 * angleFactor
    }
  })

  return (
    <group ref={ref} renderOrder={5}>
      {/* Very thin, short vertical beam through the core */}
      <mesh>
        <planeGeometry args={[0.35, 5.5]} />
        <shaderMaterial
          ref={streakMat}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          vertexShader={vert}
          fragmentShader={streakFrag}
          uniforms={{
            uTime: { value: 0 },
            uIntensity: { value: 0.85 },
            uColorHot:  { value: new THREE.Color('#ffffff') },
            uColorCold: { value: new THREE.Color('#7a6cff') },
          }}
        />
      </mesh>
    </group>
  )
}
