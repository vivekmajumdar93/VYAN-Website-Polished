'use client'

/**
 * CameraRig — breathing + micro-drift + parallax + forward drift camera.
 * Uses quaternion interpolation, no gimbal lock.
 */

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Quaternion, Euler } from 'three'
import { CAMERA_CONFIG } from '@/constants/neuralBloom'
import { smoothstep, lerp } from '@/lib/timeline'

interface CameraRigProps {
  phase: number
  elapsed: number
  orbPosition: Vector3
  onComplete?: () => void
}

const _vec = new Vector3()
const _q0  = new Quaternion()
const _q1  = new Quaternion()
const _euler = new Euler()

export function CameraRig({ phase, elapsed, orbPosition }: CameraRigProps) {
  const { camera } = useThree()
  const mouseRef  = useRef({ x: 0, y: 0 })
  const timeRef   = useRef(0)

  // Track mouse for parallax
  if (typeof window !== 'undefined') {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth  - 0.5) * 2
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    if (!(window as unknown as Record<string, unknown>).__nb_rig) {
      window.addEventListener('mousemove', onMove, { passive: true })
      ;(window as unknown as Record<string, unknown>).__nb_rig = onMove
    }
  }

  useFrame((_, delta) => {
    timeRef.current += delta

    const t       = timeRef.current
    const mouse   = mouseRef.current
    const cfg     = CAMERA_CONFIG
    const phaseF  = phase

    // Breathing
    const breathY = Math.sin(t * Math.PI * 2 * cfg.breathingFrequency) * cfg.breathingAmplitude
    const breathX = Math.cos(t * Math.PI * 2 * cfg.breathingFrequency * 0.6) * cfg.breathingAmplitude * 0.4

    // Micro drift (perlin-like using sum of sines)
    const driftX = Math.sin(t * cfg.microDriftSpeed * 1.3) * cfg.microDriftAmplitude
    const driftY = Math.cos(t * cfg.microDriftSpeed * 0.8) * cfg.microDriftAmplitude * 0.7

    // Parallax from mouse
    const px = mouse.x * cfg.parallaxMax
    const py = -mouse.y * cfg.parallaxMax

    // Forward drift
    let forwardZ = 0
    if (phaseF >= 1 && phaseF <= 3) {
      forwardZ = elapsed * 0.003 // 0.3% drift
    } else if (phaseF === 4) {
      const fp = Math.min((elapsed - 1.0) / 0.4, 1)
      forwardZ = lerp(elapsed * 0.003, 2.5, smoothstep(0, 1, fp))
    } else if (phaseF >= 5) {
      forwardZ = lerp(2.5, 5.5, smoothstep(0, 1, (elapsed - 1.4) / 0.4))
    }

    // FOV transition: 50mm → 28mm during passage
    let targetFov: number = cfg.fovNormal
    if (phaseF >= 4 && phaseF <= 5) {
      const t5 = smoothstep(0, 1, (elapsed - 1.0) / 0.8)
      targetFov = lerp(cfg.fovNormal, cfg.fovPassage, t5)
    } else if (phaseF >= 6) {
      targetFov = lerp(cfg.fovPassage, cfg.fovNormal, smoothstep(0, 1, (elapsed - 1.8) / 0.3))
    }

    // Smoothly animate FOV (perspective camera)
    const cam = camera as THREE.PerspectiveCamera
    if ('fov' in cam) {
      cam.fov = lerp(cam.fov, targetFov, 1 - Math.pow(1 - cfg.smoothingFactor, delta * 60))
      cam.updateProjectionMatrix()
    }

    // Target position
    _vec.set(
      breathX + driftX + px,
      breathY + driftY + py,
      cfg.initialZ - forwardZ,
    )

    // Exponential decay smoothing
    const smooth = 1 - Math.pow(1 - cfg.smoothingFactor, delta * 60)
    camera.position.lerp(_vec, smooth)

    // Look at orb during phases 1-4
    if (phaseF >= 1 && phaseF <= 4) {
      _q0.copy(camera.quaternion)
      camera.lookAt(orbPosition)
      _q1.copy(camera.quaternion)
      camera.quaternion.copy(_q0).slerp(_q1, smooth)
    }
  })

  return null
}

// Needed for TypeScript
import type * as THREE from 'three'
