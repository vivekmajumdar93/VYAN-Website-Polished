'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useGalaxyStore, getWorldPos, getGalaxyTransform } from '@/lib/store'

const IDLE_TIMEOUT_MS = 99999999 // effectively disable auto-orbit while tour is active

type Props = { controls: React.MutableRefObject<OrbitControlsImpl | null> }

export default function CameraRig({ controls }: Props) {
  const { camera } = useThree()
  const lastInteractionRef = useRef<number>(performance.now())
  const warpProgress = useRef(0)
  const warpStartPos = useRef(new THREE.Vector3())
  const warpStartTarget = useRef(new THREE.Vector3())
  const warpEndPos = useRef(new THREE.Vector3())
  const warpEndTarget = useRef(new THREE.Vector3())
  const warpDuration = useRef(1.4)
  const warpArcAmp = useRef(0.9)
  const warpIsPortal = useRef(false)
  const fovBase = useRef(52)
  const warping = useRef(false)

  if (typeof window !== 'undefined') {
    ;(window as any).__cam = camera
    ;(window as any).__controls = controls
  }

  const selected = useGalaxyStore((s) => s.selectedNode)
  const setIsWarping = useGalaxyStore((s) => s.setIsWarping)
  const setCurrentGalaxy = useGalaxyStore((s) => s.setCurrentGalaxy)
  const warpSpeedSetting = useGalaxyStore((s) => s.settings.warpSpeed)

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const onStart = () => { lastInteractionRef.current = performance.now() }
    c.addEventListener('start', onStart)
    return () => { c.removeEventListener('start', onStart) }
  }, [controls])

  useEffect(() => {
    if (!selected || !controls.current) return
    const c = controls.current
    warpStartPos.current.copy(camera.position)
    warpStartTarget.current.copy(c.target)

    const nodeWorld = getWorldPos(selected)
    const viewDir = new THREE.Vector3().subVectors(camera.position, c.target).normalize()

    if (selected.isPortal && selected.portalTo) {
      const targetGalaxy = getGalaxyTransform(selected.portalTo)
      const dest = targetGalaxy.position.clone()
      const totalLeap = dest.distanceTo(camera.position)
      const approachOffset = new THREE.Vector3(0, 4, 14)
      warpEndTarget.current.copy(dest)
      warpEndPos.current.copy(dest).add(approachOffset)
      warpDuration.current = THREE.MathUtils.clamp(2.5 + totalLeap * 0.012, 3.0, 4.5)
      warpArcAmp.current = 6.0
      warpIsPortal.current = true
      setCurrentGalaxy(selected.portalTo)
    } else {
      warpEndTarget.current.copy(nodeWorld)
      warpEndPos.current.copy(nodeWorld).add(viewDir.multiplyScalar(5.2))
      warpDuration.current = 1.4
      warpArcAmp.current = 0.9
      warpIsPortal.current = false
    }

    warpProgress.current = 0
    warping.current = true
    setIsWarping(true)
    c.enabled = false
    lastInteractionRef.current = performance.now() + warpDuration.current * 1000 + 800
  }, [selected, camera, controls, setIsWarping, setCurrentGalaxy])

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    const c = controls.current
    if (!c) return
    const cam = camera as THREE.PerspectiveCamera

    if (warping.current) {
      const speed = THREE.MathUtils.clamp(warpSpeedSetting, 0.2, 3.0)
      warpProgress.current = Math.min(1, warpProgress.current + (delta / warpDuration.current) * speed)
      const p = warpProgress.current
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2

      const arc = Math.sin(eased * Math.PI) * warpArcAmp.current
      const lerpedPos = new THREE.Vector3().lerpVectors(warpStartPos.current, warpEndPos.current, eased)
      lerpedPos.y += arc
      cam.position.copy(lerpedPos)
      c.target.lerpVectors(warpStartTarget.current, warpEndTarget.current, eased)

      // FOV pulse (hyperspace) - much bigger for portal jumps
      const fovPulseAmp = warpIsPortal.current ? 32 : 8
      const fovPulse = Math.sin(eased * Math.PI) * fovPulseAmp
      cam.fov = fovBase.current + fovPulse
      cam.updateProjectionMatrix()

      c.update()

      if (warpProgress.current >= 1) {
        warping.current = false
        setIsWarping(false)
        cam.fov = fovBase.current
        cam.updateProjectionMatrix()
        c.enabled = true
        lastInteractionRef.current = performance.now()
      }
      return
    }

    // Idle (no auto-orbit - tour mode controls camera)
    const idleFor = performance.now() - lastInteractionRef.current
    if (idleFor > IDLE_TIMEOUT_MS) {
      // disabled
    }
  })

  return null
}
