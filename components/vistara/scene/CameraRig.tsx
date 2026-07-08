'use client'

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const BASE_POS  = new THREE.Vector3(0, 0, 8)
const MOUSE_STR = 0.35   // how much mouse moves camera
const GYRO_STR  = 0.6    // device orientation strength
const BREATH    = 0.12   // breathing amplitude (units)
const BREATH_HZ = 0.18   // breathing frequency (Hz)
const DRIFT_HZ  = 0.04   // slow drift frequency
const DRIFT_AMP = 0.5    // drift amplitude

export function CameraRig() {
  const { camera } = useThree()
  const mouseRef = useRef({ x: 0, y: 0, sx: 0, sy: 0 })
  const gyroRef  = useRef({ alpha: 0, beta: 0, gamma: 0 })
  const tRef     = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth  - 0.5) * 2
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const onOrient = (e: DeviceOrientationEvent) => {
      gyroRef.current.alpha  = (e.alpha  ?? 0) * Math.PI / 180
      gyroRef.current.beta   = ((e.beta  ?? 0) - 30) * Math.PI / 180
      gyroRef.current.gamma  = (e.gamma  ?? 0) * Math.PI / 180
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('deviceorientation', onOrient, true)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('deviceorientation', onOrient, true)
    }
  }, [])

  useFrame((_, delta) => {
    tRef.current += delta
    const t = tRef.current

    const m = mouseRef.current
    m.sx += (m.x - m.sx) * 0.025
    m.sy += (m.y - m.sy) * 0.025

    // Slow Lissajous drift
    const drift = new THREE.Vector3(
      Math.sin(t * DRIFT_HZ * Math.PI * 2) * DRIFT_AMP,
      Math.cos(t * DRIFT_HZ * Math.PI * 2 * 0.61803) * DRIFT_AMP * 0.6,
      0,
    )

    // Breathing — subtle Z push/pull
    const breathe = Math.sin(t * BREATH_HZ * Math.PI * 2) * BREATH

    // Mouse parallax
    const mx = m.sx * MOUSE_STR
    const my = -m.sy * MOUSE_STR

    // Gyroscope (mobile)
    const gx = gyroRef.current.gamma * GYRO_STR * 0.2
    const gy = -gyroRef.current.beta  * GYRO_STR * 0.15

    camera.position.set(
      BASE_POS.x + drift.x + mx + gx,
      BASE_POS.y + drift.y + my + gy,
      BASE_POS.z + breathe,
    )
    // Always look slightly toward the scene center
    camera.lookAt(
      drift.x * 0.15 + mx * 0.05,
      drift.y * 0.15 + my * 0.05,
      0,
    )
  })

  return null
}
