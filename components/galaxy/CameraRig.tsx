'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useGalaxyStore, getWorldPos, getGalaxyTransform } from '@/lib/store'

const IDLE_TIMEOUT_MS = 2800

type Props = { controls: React.MutableRefObject<OrbitControlsImpl | null> }

export default function CameraRig({ controls }: Props) {
  const { camera } = useThree()
  if (typeof window !== 'undefined') {
    ;(window as any).__cam = camera
    ;(window as any).__controls = controls
  }
  const lastInteractionRef = useRef<number>(performance.now())
  const warpProgress = useRef(0)
  const warpStartPos = useRef(new THREE.Vector3())
  const warpStartTarget = useRef(new THREE.Vector3())
  const warpEndPos = useRef(new THREE.Vector3())
  const warpEndTarget = useRef(new THREE.Vector3())
  const warpDuration = useRef(1.4)
  const warpArcAmp = useRef(0.9)
  const warping = useRef(false)
  const microDriftPhase = useRef({ x: Math.random() * 1000, y: Math.random() * 1000, z: Math.random() * 1000 })

  const selected = useGalaxyStore((s) => s.selectedNode)
  const orbitSpeed = useGalaxyStore((s) => s.settings.orbitSpeed)
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

    const viewDir = new THREE.Vector3().subVectors(camera.position, c.target)
    viewDir.normalize()

    if (selected.isPortal && selected.portalTo) {
      const targetGalaxy = getGalaxyTransform(selected.portalTo)
      const dest = targetGalaxy.position.clone()
      const totalLeap = dest.distanceTo(camera.position)
      const approachOffset = new THREE.Vector3(0, 4, 14)
      warpEndTarget.current.copy(dest)
      warpEndPos.current.copy(dest).add(approachOffset)
      warpDuration.current = THREE.MathUtils.clamp(2.5 + totalLeap * 0.012, 3.0, 4.5)
      warpArcAmp.current = 6.0
    } else {
      warpEndTarget.current.copy(nodeWorld)
      warpEndPos.current.copy(nodeWorld).add(viewDir.multiplyScalar(5.2))
      warpDuration.current = 1.4
      warpArcAmp.current = 0.9
    }

    warpProgress.current = 0
    warping.current = true
    c.enabled = false
    lastInteractionRef.current = performance.now() + warpDuration.current * 1000 + 800

    if (typeof window !== 'undefined') {
      ;(window as any).__warpInfo = {
        node: selected.id,
        portal: !!selected.isPortal,
        startPos: warpStartPos.current.toArray().map((n) => +n.toFixed(2)),
        endPos: warpEndPos.current.toArray().map((n) => +n.toFixed(2)),
        endTarget: warpEndTarget.current.toArray().map((n) => +n.toFixed(2)),
        duration: warpDuration.current,
      }
    }
  }, [selected, camera, controls])

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    const c = controls.current
    if (!c) return

    if (typeof window !== 'undefined') {
      ;(window as any).__warpDebug = {
        warping: warping.current,
        progress: warpProgress.current,
        camPos: [camera.position.x, camera.position.y, camera.position.z].map((n) => +n.toFixed(1)),
        tgt: [c.target.x, c.target.y, c.target.z].map((n) => +n.toFixed(1)),
      }
    }

    // -------------------- WARP --------------------
    if (warping.current) {
      const speed = THREE.MathUtils.clamp(warpSpeedSetting, 0.2, 3.0)
      warpProgress.current = Math.min(1, warpProgress.current + (delta / warpDuration.current) * speed)
      const p = warpProgress.current
      // easeInOutCubic
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2

      const arc = Math.sin(eased * Math.PI) * warpArcAmp.current
      const lerpedPos = new THREE.Vector3().lerpVectors(warpStartPos.current, warpEndPos.current, eased)
      lerpedPos.y += arc
      camera.position.copy(lerpedPos)
      c.target.lerpVectors(warpStartTarget.current, warpEndTarget.current, eased)
      c.update()

      if (warpProgress.current >= 1) {
        warping.current = false
        c.enabled = true
        lastInteractionRef.current = performance.now()
      }
      return
    }

    // -------------------- AUTO ORBIT --------------------
    const idleFor = performance.now() - lastInteractionRef.current
    if (idleFor > IDLE_TIMEOUT_MS) {
      const speed = THREE.MathUtils.clamp(orbitSpeed, 0, 3)
      const azimuthDelta = delta * 0.04 * speed
      const t = performance.now() / 1000
      const driftX = Math.sin(t * 0.18 + microDriftPhase.current.x) * 0.0012 * speed
      const driftY = Math.cos(t * 0.13 + microDriftPhase.current.y) * 0.0009 * speed

      const anyC = c as any
      if (typeof anyC.getAzimuthalAngle === 'function' && typeof anyC.setAzimuthalAngle !== 'undefined') {
        try {
          const az = anyC.getAzimuthalAngle()
          anyC.setAzimuthalAngle?.(az + azimuthDelta)
        } catch { /* fallback below */ }
      }
      const offset = new THREE.Vector3().subVectors(camera.position, c.target)
      const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), azimuthDelta)
      offset.applyQuaternion(rotY)
      offset.y += driftY
      camera.position.copy(c.target).add(offset)
      c.target.x += driftX
      c.update()
    }
  })

  return null
}
