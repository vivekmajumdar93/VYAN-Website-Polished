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
    float horiz = 1.0 - smoothstep(0.0, 1.0, x);
    float vert  = 1.0 - smoothstep(0.0, 1.0, y);
    horiz = pow(horiz, 7.0);
    vert = pow(vert, 1.2);
    float shimmer = 0.88 + 0.12 * sin(uTime * 2.3 + vUv.y * 60.0);
    float breathe = 0.9 + 0.1 * sin(uTime * 0.7);
    float a = horiz * vert * shimmer * breathe * uIntensity;
    vec3 col = mix(uColorCold, uColorHot, horiz);
    gl_FragColor = vec4(col, a);
  }
`

const ghostFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float a = smoothstep(0.5, 0.0, d);
    a = pow(a, 2.4);
    float breathe = 0.85 + 0.15 * sin(uTime * 1.3);
    gl_FragColor = vec4(uColor * breathe, a * uIntensity);
  }
`

export default function LensFlare() {
  const ref = useRef<THREE.Group>(null!)
  const streakMat = useRef<THREE.ShaderMaterial>(null!)
  const ghostMatA = useRef<THREE.ShaderMaterial>(null!)
  const ghostMatB = useRef<THREE.ShaderMaterial>(null!)

  useFrame(({ camera }, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    if (ref.current) ref.current.quaternion.copy(camera.quaternion)

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const upDot = Math.abs(dir.y)
    const angleFactor = THREE.MathUtils.clamp(1.0 - upDot, 0.25, 1.0)

    if (streakMat.current) {
      streakMat.current.uniforms.uTime.value += delta
      streakMat.current.uniforms.uIntensity.value = 0.95 * angleFactor
    }
    if (ghostMatA.current) {
      ghostMatA.current.uniforms.uTime.value += delta
      ghostMatA.current.uniforms.uIntensity.value = 0.45 * angleFactor
    }
    if (ghostMatB.current) {
      ghostMatB.current.uniforms.uTime.value += delta + 1.2
      ghostMatB.current.uniforms.uIntensity.value = 0.35 * angleFactor
    }
  })

  return (
    <group ref={ref} renderOrder={5}>
      {/* Main vertical white-violet streak */}
      <mesh>
        <planeGeometry args={[1.1, 20]} />
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
            uIntensity: { value: 0.9 },
            uColorHot:  { value: new THREE.Color('#ffffff') },
            uColorCold: { value: new THREE.Color('#6a5cff') },
          }}
        />
      </mesh>
      {/* Soft violet ghost above center */}
      <mesh position={[0.5, 1.1, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <shaderMaterial
          ref={ghostMatA}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          vertexShader={vert}
          fragmentShader={ghostFrag}
          uniforms={{
            uTime: { value: 0 },
            uIntensity: { value: 0.45 },
            uColor: { value: new THREE.Color('#9b7dff') },
          }}
        />
      </mesh>
      {/* Cyan ghost below */}
      <mesh position={[-0.6, -1.4, 0]}>
        <planeGeometry args={[0.65, 0.65]} />
        <shaderMaterial
          ref={ghostMatB}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          vertexShader={vert}
          fragmentShader={ghostFrag}
          uniforms={{
            uTime: { value: 0 },
            uIntensity: { value: 0.35 },
            uColor: { value: new THREE.Color('#5ec8ff') },
          }}
        />
      </mesh>
    </group>
  )
}
