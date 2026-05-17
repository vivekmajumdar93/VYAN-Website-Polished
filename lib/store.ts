import { create } from 'zustand'
import * as THREE from 'three'

export type GalaxyId = 'primary' | 'void'

export type GalaxyNode = {
  id: string
  label: string
  position: [number, number, number]  // LOCAL position (within its galaxy's group)
  color: string
  description: string
  galaxyId: GalaxyId
  isPortal?: boolean
  portalTo?: GalaxyId
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
  spiralTightness: number
  starBrightness: number
}

export const DEFAULT_SETTINGS: Settings = {
  branches: 8,
  spin: 1.2,
  count: 220000,
  bloom: 0.42,
  coreGlow: 0.18,
  dustDensity: 0.5,
  nebulaStrength: 0.10,
  warpSpeed: 1.0,
  orbitSpeed: 0.55,
  gradientIntensity: 1.0,
  turbulence: 0.55,
  spiralTightness: 3.2,
  starBrightness: 0.85,
}

// ---------- Galaxy world transforms (used for both rendering and warp targeting) ----------
export const PRIMARY_GALAXY = {
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Euler(Math.PI * 0.22, 0, Math.PI * 0.07),
} as const

export const VOID_GALAXY = {
  position: new THREE.Vector3(72, 6, -110),
  rotation: new THREE.Euler(Math.PI * 0.18, Math.PI * 0.42, -Math.PI * 0.05),
} as const

export function getGalaxyTransform(id: GalaxyId) {
  return id === 'void' ? VOID_GALAXY : PRIMARY_GALAXY
}

export function getWorldPos(node: GalaxyNode): THREE.Vector3 {
  const g = getGalaxyTransform(node.galaxyId)
  const v = new THREE.Vector3(...node.position)
  v.applyEuler(g.rotation)
  v.add(g.position)
  return v
}

type State = {
  selectedNode: GalaxyNode | null
  hoveredNode: string | null
  panelOpen: boolean
  settings: Settings
  setSelected: (n: GalaxyNode | null) => void
  setHovered: (id: string | null) => void
  togglePanel: () => void
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  resetSettings: () => void
}

export const useGalaxyStore = create<State>((set) => ({
  selectedNode: null,
  hoveredNode: null,
  panelOpen: false,
  settings: { ...DEFAULT_SETTINGS },
  setSelected: (n) => set({ selectedNode: n }),
  setHovered: (id) => set({ hoveredNode: id }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  updateSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),
}))

// Expose to window for inspection/testing in dev
if (typeof window !== 'undefined') {
  ;(window as any).__galaxyStore = useGalaxyStore
}

export const NODES: GalaxyNode[] = [
  // ---------- PRIMARY GALAXY ----------
  { id: 'sirius', galaxyId: 'primary',  label: 'Sirius Cluster',  position: [3.2, 0.05, -1.8], color: '#7eaaff', description: 'A dense, hot cluster of young blue giants near the galactic arm.' },
  { id: 'nova',   galaxyId: 'primary',  label: 'Nova Prime',      position: [-2.8, 0.1, 2.4],  color: '#b89dff', description: 'A pulsating violet nova at the edge of the spiral arm.' },
  { id: 'aether', galaxyId: 'primary',  label: 'Aether Nebula',   position: [1.4, -0.08, 3.6], color: '#9bb8ff', description: 'A diffuse, glowing nebula of ionized gas and dust.' },
  { id: 'orion',  galaxyId: 'primary',  label: 'Orion Gate',      position: [-3.6, 0.0, -2.6], color: '#9dd6ff', description: 'An ancient gateway formed at the intersection of two arms.' },
  { id: 'helios', galaxyId: 'primary',  label: 'Helios Beacon',   position: [4.2, -0.05, 1.2], color: '#a896ff', description: 'A solitary violet beacon star, used for galactic navigation.' },

  // ---------- PORTAL NODE (in primary, warps to void) ----------
  {
    id: 'product-void',
    galaxyId: 'primary',
    label: 'Product Void',
    position: [4.8, 0.02, -3.2],
    color: '#ff2a4a',
    description: 'A wormhole at the rim of the disc. Following it pulls the camera across a vast emptiness to an unknown sibling galaxy.',
    isPortal: true,
    portalTo: 'void',
  },

  // ---------- VOID GALAXY ----------
  { id: 'void-echo',    galaxyId: 'void', label: 'Echo Spire',     position: [3.0, 0.05, -1.4], color: '#ff7aa8', description: 'A spire of crystalline ion clouds humming with low-frequency resonance.' },
  { id: 'void-rift',    galaxyId: 'void', label: 'The Rift',       position: [-2.6, 0.1, 1.8],  color: '#ff9ad6', description: 'A tear in spacetime visible only at the edge of this galactic arm.' },
  { id: 'void-pyre',    galaxyId: 'void', label: 'Pyre Cluster',   position: [1.8, -0.05, 3.0], color: '#ff5a78', description: 'Burning red giants packed into a small, ancient cluster.' },
  { id: 'void-warden',  galaxyId: 'void', label: 'Warden Beacon',  position: [-3.2, 0.0, -2.2], color: '#ffd0e8', description: 'A solitary outpost marking the safe passage out of the void.' },
]
