'use client'

/**
 * MedhaEffects — postprocessing stack for the Neural Bloom transition.
 * Stack order: Bloom → DepthOfField → ChromaticAberration → Vignette
 * → FilmGrain → adaptive exposure via tone mapping.
 */

import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import { Vector2 } from 'three'

interface MedhaEffectsProps {
  phase: number
  bloomIntensity: number
  chromaticAberration: number
  fractureProgress: number
  usePostprocessing: boolean
}

/** @returns The postprocessing pipeline tuned to the current transition phase */
export function MedhaEffects({
  phase,
  bloomIntensity,
  chromaticAberration,
  fractureProgress,
  usePostprocessing,
}: MedhaEffectsProps) {
  const { gl } = useThree()

  const chromaOffset = useMemo(
    () => new Vector2(chromaticAberration, chromaticAberration * 0.6),
    [chromaticAberration],
  )

  if (!usePostprocessing) return null

  // DOF: track orb through phases 1-3, relax in 4+
  const focusDistance = phase <= 3 ? 0.0 : 0.5
  const bokehScale    = phase >= 4 && phase <= 5 ? 4.5 : 2.4

  // Bloom luminance threshold drops in intense phases
  const luminanceThreshold = phase >= 3 ? 0.12 : 0.2

  const vignetteDarkness = phase >= 4 ? 0.72 : 0.55

  return (
    <EffectComposer multisampling={0}>
      {/* 1. Bloom */}
      <Bloom
        intensity={bloomIntensity}
        kernelSize={KernelSize.VERY_LARGE}
        luminanceThreshold={luminanceThreshold}
        luminanceSmoothing={0.025}
        mipmapBlur
      />

      {/* 2. Depth of Field */}
      <DepthOfField
        focusDistance={focusDistance}
        focalLength={0.02}
        bokehScale={bokehScale}
      />

      {/* 3. Chromatic Aberration — peaks at fracture */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={chromaOffset}
        radialModulation={false}
        modulationOffset={0}
      />

      {/* 4. Vignette */}
      <Vignette
        darkness={vignetteDarkness}
        offset={0.3}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
