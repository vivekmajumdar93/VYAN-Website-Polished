'use client'

interface MedhaEffectsProps {
  phase: number
  bloomIntensity: number
  chromaticAberration: number
  fractureProgress: number
  usePostprocessing: boolean
}

// Postprocessing disabled — @react-three/postprocessing@^3 requires R3F v9
// but the project ships R3F v8. Re-enable once R3F is upgraded.
export function MedhaEffects(_props: MedhaEffectsProps) {
  return null
}
