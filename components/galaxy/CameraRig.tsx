'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useGalaxyStore } from '@/lib/store'

const IDLE_TIMEOUT_MS = 2400

type Props = { controls: React.MutableRefObject<OrbitControlsImpl | null> }

export default function CameraRig({ controls }: Props) {
  const { camera } = useThree()
  const lastInteractionRef = useRef<number>(performance.now())
  const warpProgress = useRef(0)
  const warpStartPos = useRef(new THREE.Vector3())
  const warpStartTarget = useRef(new THREE.Vector3())
  const warpEndPos = useRef(new THREE.Vector3())
  const warpEndTarget = useRef(new THREE.Vector3())
  const warping = useRef(false)
  const microDriftPhase = useRef({ x: Math.random() * 1000, y: Math.random() * 1000, z: Math.random() * 1000 })

  const selected = useGalaxyStore((s) => s.selectedNode)
  const setWarpTarget = useGalaxyStore((s) => s.setWarpTarget)
  const orbitSpeed = useGalaxyStore((s) => s.settings.orbitSpeed)
  const warpSpeedSetting = useGalaxyStore((s) => s.settings.warpSpeed)

  // Hook into OrbitControls events to track user interaction
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const onStart = () => { lastInteractionRef.current = performance.now() }
    const onChange = () => { if (!warping.current) lastInteractionRef.current = performance.now() }
    c.addEventListener('start', onStart)
    // Don't bind 'change' because programmatic auto-orbit also fires it -> infinite refresh.
    return () => {
      c.removeEventListener('start', onStart)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _x = onChange
    }
  }, [controls])

  // Trigger warp animation when selectedNode changes
  useEffect(() => {
    if (!selected || !controls.current) return
    const c = controls.current
    warpStartPos.current.copy(camera.position)
    warpStartTarget.current.copy(c.target)

    const nodePos = new THREE.Vector3(...selected.position)
    // End target = the node itself; End position = slightly offset from node toward current view dir
    const viewDir = new THREE.Vector3().subVectors(camera.position, c.target).normalize()
    const dist = 3.2
    warpEndTarget.current.copy(nodePos)
    warpEndPos.current.copy(nodePos).add(viewDir.multiplyScalar(dist)).add(new THREE.Vector3(0, 0.6, 0))

    warpProgress.current = 0
    warping.current = true
    c.enabled = false
    // Mark interaction time so auto-orbit doesn't kick in immediately
    lastInteractionRef.current = performance.now() + 4000
  }, [selected, camera, controls])

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    const c = controls.current
    if (!c) return

    // -------------------- WARP TO NODE --------------------
    if (warping.current) {
      // Hyperspace-style ease: slow-in, fast middle, smooth out  (in-out cubic, biased)
      const speed = THREE.MathUtils.clamp(warpSpeedSetting, 0.2, 3.0)
      warpProgress.current = Math.min(1, warpProgress.current + delta * 0.7 * speed)
      const p = warpProgress.current
      // smooth cinematic ease: easeInOutCubic
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2

      // Curved travel path: add a slight arc above the disc for cinematic flair
      const arc = Math.sin(eased * Math.PI) * 0.9
      const lerpedPos = new THREE.Vector3().lerpVectors(warpStartPos.current, warpEndPos.current, eased)
      lerpedPos.y += arc
      camera.position.copy(lerpedPos)
      c.target.lerpVectors(warpStartTarget.current, warpEndTarget.current, eased)
      c.update()

      if (warpProgress.current >= 1) {
        warping.current = false
        c.enabled = true
        lastInteractionRef.current = performance.now() // counts as interaction
      }
      return
    }

    // -------------------- AUTO ORBIT (when idle) --------------------
    const idleFor = performance.now() - lastInteractionRef.current
    if (idleFor > IDLE_TIMEOUT_MS) {
      const speed = THREE.MathUtils.clamp(orbitSpeed, 0, 3)
      // Rotate the orbit controls azimuth gently
      const azimuthDelta = delta * 0.04 * speed
      // micro-drift via low-frequency sin for organic motion
      const t = performance.now() / 1000
      const driftX = Math.sin(t * 0.18 + microDriftPhase.current.x) * 0.0012 * speed
      const driftY = Math.cos(t * 0.13 + microDriftPhase.current.y) * 0.0009 * speed

      // Use OrbitControls' internal spherical via .setAzimuthalAngle / .setPolarAngle
      // (Falls back to manual position rotation if those APIs aren't available)
      const anyC = c as any
      if (typeof anyC.getAzimuthalAngle === 'function' && typeof anyC.setAzimuthalAngle !== 'undefined') {
        try {
          const az = anyC.getAzimuthalAngle()
          anyC.setAzimuthalAngle?.(az + azimuthDelta)
        } catch {
          // fallback below
        }
      }
      // Fallback: rotate camera position around target
      const offset = new THREE.Vector3().subVectors(camera.position, c.target)
      const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), azimuthDelta)
      offset.applyQuaternion(rotY)
      // micro drift on Y for breathing
      offset.y += driftY
      camera.position.copy(c.target).add(offset)
      // micro drift on target for parallax life
      c.target.x += driftX
      c.update()
    }
  })

  return null
}
