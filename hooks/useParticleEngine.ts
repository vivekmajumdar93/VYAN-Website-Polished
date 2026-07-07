'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { QualityTier } from '@/types/neuralBloom'
import { PARTICLE_QUALITY } from '@/constants/neuralBloom'

// GPUComputationRenderer type declaration
interface GPUVariable {
  name: string
  initialValueTexture: THREE.DataTexture
  material: THREE.ShaderMaterial
  dependencies: GPUVariable[] | null
  wrapS: number | null
  wrapT: number | null
  minFilter: number
  magFilter: number
}

interface GPUComputationRendererType {
  setDataType(type: number): void
  addVariable(name: string, shader: string, initTex: THREE.DataTexture): GPUVariable
  setVariableDependencies(v: GPUVariable, deps: GPUVariable[]): void
  init(): string | null
  compute(): void
  getCurrentRenderTarget(v: GPUVariable): THREE.WebGLRenderTarget
  dispose(): void
  createTexture(): THREE.DataTexture
}

export interface ParticleRefs {
  positionVar: GPUVariable | null
  velocityVar: GPUVariable | null
  gpu: GPUComputationRendererType | null
  positionTex: () => THREE.Texture | null
  velocityTex: () => THREE.Texture | null
  particleUvs: Float32Array
  count: number
}

export function useParticleEngine(
  quality: QualityTier,
  positionShader: string,
  velocityShader: string,
): ParticleRefs {
  const { gl } = useThree()
  const refs = useRef<ParticleRefs>({
    positionVar: null,
    velocityVar: null,
    gpu: null,
    positionTex: () => null,
    velocityTex: () => null,
    particleUvs: new Float32Array(0),
    count: 0,
  })

  useEffect(() => {
    const config = PARTICLE_QUALITY[quality]
    const size   = config.gpuSize

    // Dynamic import of GPUComputationRenderer (lives in three/examples)
    import('three/examples/jsm/misc/GPUComputationRenderer.js')
      .then(({ GPUComputationRenderer }) => {
        // Dispose previous
        refs.current.gpu?.dispose?.()

        const gpu = new GPUComputationRenderer(size, size, gl) as unknown as GPUComputationRendererType

        // Check WebGL2 for float textures
        if (!gl.capabilities.isWebGL2) {
          const ext = gl.getContext().getExtension('OES_texture_float')
          if (!ext) {
            console.warn('[NeuralBloom] Float textures not supported — GPU particles unavailable')
            return
          }
        }
        gpu.setDataType(THREE.FloatType)

        // Initialize position texture — random sphere distribution
        const posTex = gpu.createTexture()
        const posData = posTex.image.data as unknown as Float32Array
        for (let i = 0; i < size * size; i++) {
          const i4 = i * 4
          const theta = Math.random() * Math.PI * 2
          const phi   = Math.acos(2 * Math.random() - 1)
          const r     = 3 + Math.random() * 4
          posData[i4 + 0] = r * Math.sin(phi) * Math.cos(theta)
          posData[i4 + 1] = r * Math.sin(phi) * Math.sin(theta)
          posData[i4 + 2] = r * Math.cos(phi)
          posData[i4 + 3] = Math.random() // life
        }

        // Initialize velocity texture — near zero
        const velTex = gpu.createTexture()
        const velData = velTex.image.data as unknown as Float32Array
        for (let i = 0; i < size * size; i++) {
          const i4 = i * 4
          velData[i4 + 0] = (Math.random() - 0.5) * 0.1
          velData[i4 + 1] = (Math.random() - 0.5) * 0.1
          velData[i4 + 2] = (Math.random() - 0.5) * 0.1
          velData[i4 + 3] = Math.random() // noise seed
        }

        const posVar = gpu.addVariable('texturePosition', positionShader, posTex)
        const velVar = gpu.addVariable('textureVelocity', velocityShader, velTex)

        gpu.setVariableDependencies(posVar, [posVar, velVar])
        gpu.setVariableDependencies(velVar, [posVar, velVar])

        const err = gpu.init()
        if (err) {
          console.error('[NeuralBloom] GPUComputationRenderer init error:', err)
          return
        }

        // Particle UV attributes for reading back from GPU textures
        const count = Math.min(config.count, size * size)
        const uvs   = new Float32Array(count * 2)
        for (let i = 0; i < count; i++) {
          const x  = (i % size) / size
          const y  = Math.floor(i / size) / size
          uvs[i * 2 + 0] = x + 0.5 / size
          uvs[i * 2 + 1] = y + 0.5 / size
        }

        refs.current = {
          positionVar: posVar,
          velocityVar: velVar,
          gpu,
          positionTex: () => gpu.getCurrentRenderTarget(posVar).texture,
          velocityTex: () => gpu.getCurrentRenderTarget(velVar).texture,
          particleUvs: uvs,
          count,
        }
      })
      .catch(err => {
        console.error('[NeuralBloom] Failed to load GPUComputationRenderer:', err)
      })

    return () => {
      refs.current.gpu?.dispose?.()
      refs.current = {
        positionVar: null, velocityVar: null, gpu: null,
        positionTex: () => null, velocityTex: () => null,
        particleUvs: new Float32Array(0), count: 0,
      }
    }
  }, [gl, quality, positionShader, velocityShader])

  return refs.current
}
