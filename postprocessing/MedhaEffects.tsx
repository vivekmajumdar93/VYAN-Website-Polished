'use client'

import { useMemo } from 'react'
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

export function MedhaEffects({
  phase,
  bloomIntensity,
  chromaticAberration,
  fractureProgress: _fractureProgress,
  usePostprocessing,
}: MedhaEffectsProps) {
  const chromaOffset = useMemo(
    () => new Vector2(chromaticAberration, chromaticAberration * 0.6),
    [chromaticAberration],
  )

  if (!usePostprocessing) return null

  const focusDistance = phase <= 3 ? 0.0 : 0.5
  const bokehScale    = phase >= 4 && phase <= 5 ? 4.5 : 2.4
  const luminanceThreshold = phase >= 3 ? 0.12 : 0.2
  const vignetteDarkness = phase >= 4 ? 0.72 : 0.55

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloomIntensity}
        kernelSize={KernelSize.VERY_LARGE}
        luminanceThreshold={luminanceThreshold}
        luminanceSmoothing={0.025}
        mipmapBlur
      />
      <DepthOfField
        focusDistance={focusDistance}
        focalLength={0.02}
        bokehScale={bokehScale}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={chromaOffset}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette
        darkness={vignetteDarkness}
        offset={0.3}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
