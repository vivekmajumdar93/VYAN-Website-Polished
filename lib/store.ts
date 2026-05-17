import { create } from 'zustand'
import * as THREE from 'three'

export type GalaxyNode = {
  id: string
  label: string
  position: [number, number, number]
  color: string
  description: string
}

export type Settings = {
  branches: number
  spin: number
  count: number
  bloom: number
  coreGlow: number
  dustDensity: number
  nebulaStrength: number
  warpSpeed: number
  orbitSpeed: number
  gradientIntensity: number
  turbulence: number
}

export const DEFAULT_SETTINGS: Settings = {
  branches: 4,
  spin: 1.1,
  count: 160000,
  bloom: 1.1,
  coreGlow: 0.75,
  dustDensity: 0.65,
  nebulaStrength: 0.55,
  warpSpeed: 1.0,
  orbitSpeed: 0.6,
  gradientIntensity: 1.0,
  turbulence: 1.0,
}

type State = {
  selectedNode: GalaxyNode | null
  hoveredNode: string | null
  warpTarget: THREE.Vector3 | null
  panelOpen: boolean
  settings: Settings
  setSelected: (n: GalaxyNode | null) => void
  setHovered: (id: string | null) => void
  setWarpTarget: (v: THREE.Vector3 | null) => void
  togglePanel: () => void
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  resetSettings: () => void
}

export const useGalaxyStore = create<State>((set) => ({
  selectedNode: null,
  hoveredNode: null,
  warpTarget: null,
  panelOpen: false,
  settings: { ...DEFAULT_SETTINGS },
  setSelected: (n) => set({ selectedNode: n, warpTarget: n ? new THREE.Vector3(...n.position) : null }),
  setHovered: (id) => set({ hoveredNode: id }),
  setWarpTarget: (v) => set({ warpTarget: v }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  updateSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),
}))

export const NODES: GalaxyNode[] = [
  { id: 'sirius',   label: 'Sirius Cluster',    position: [3.2, 0.05, -1.8], color: '#9ec5ff', description: 'A dense, hot cluster of young blue giants near the galactic arm.' },
  { id: 'nova',     label: 'Nova Prime',        position: [-2.8, 0.1, 2.4],  color: '#d4a4ff', description: 'A pulsating violet nova at the edge of the spiral arm.' },
  { id: 'aether',   label: 'Aether Nebula',     position: [1.4, -0.08, 3.6], color: '#7ce8ff', description: 'A diffuse, glowing nebula of ionized gas and dust.' },
  { id: 'orion',    label: 'Orion Gate',        position: [-3.6, 0.0, -2.6], color: '#ffd4f0', description: 'An ancient gateway formed at the intersection of two arms.' },
  { id: 'helios',   label: 'Helios Beacon',     position: [4.2, -0.05, 1.2], color: '#ffb47a', description: 'A solitary amber beacon star, used for galactic navigation.' },
  { id: 'verge',    label: 'The Verge',         position: [-1.6, 0.12, -4.2], color: '#b69eff', description: 'A faint, far cluster at the very rim of the galaxy.' },
]
