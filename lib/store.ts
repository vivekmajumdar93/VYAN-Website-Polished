import { create } from 'zustand'
import * as THREE from 'three'

export type GalaxyId = 'primary' | 'void'

export type GalaxyNode = {
  id: string
  label: string
  position: [number, number, number]
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
  count: 340000,
  bloom: 0.55,
  coreGlow: 0.15,
  dustDensity: 0.55,
  nebulaStrength: 0.10,
  warpSpeed: 1.0,
  orbitSpeed: 0.55,
  gradientIntensity: 1.0,
  turbulence: 0.55,
  spiralTightness: 3.2,
  starBrightness: 0.85,
}

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

export const NODES: GalaxyNode[] = [
  // Primary galaxy
  { id: 'sirius',        galaxyId: 'primary', label: 'Sirius Cluster', position: [3.2, 0.05, -1.8], color: '#7eaaff', description: 'A dense, hot cluster of young blue giants near the galactic arm.' },
  { id: 'nova',          galaxyId: 'primary', label: 'Nova Prime',     position: [-2.8, 0.1, 2.4], color: '#b89dff', description: 'A pulsating violet nova at the edge of the spiral arm.' },
  { id: 'aether',        galaxyId: 'primary', label: 'Aether Nebula',  position: [1.4, -0.08, 3.6], color: '#9bb8ff', description: 'A diffuse, glowing nebula of ionized gas and dust.' },
  { id: 'orion',         galaxyId: 'primary', label: 'Orion Gate',     position: [-3.6, 0.0, -2.6], color: '#9dd6ff', description: 'An ancient gateway formed at the intersection of two arms.' },
  { id: 'helios',        galaxyId: 'primary', label: 'Helios Beacon',  position: [4.2, -0.05, 1.2], color: '#a896ff', description: 'A solitary violet beacon star.' },
  { id: 'product-void',  galaxyId: 'primary', label: 'Product Void',   position: [4.8, 0.02, -3.2], color: '#ff2a4a', description: 'A wormhole at the rim. Following it pulls the camera across vast emptiness.', isPortal: true, portalTo: 'void' },

  // Void galaxy
  { id: 'void-echo',     galaxyId: 'void',    label: 'Echo Spire',     position: [3.0, 0.05, -1.4], color: '#ff7aa8', description: 'A spire of crystalline ion clouds humming with low-frequency resonance.' },
  { id: 'void-rift',     galaxyId: 'void',    label: 'The Rift',       position: [-2.6, 0.1, 1.8],  color: '#ff9ad6', description: 'A tear in spacetime visible only at the edge of this galactic arm.' },
  { id: 'void-pyre',     galaxyId: 'void',    label: 'Pyre Cluster',   position: [1.8, -0.05, 3.0], color: '#ff5a78', description: 'Burning red giants packed into a small, ancient cluster.' },
  { id: 'void-warden',   galaxyId: 'void',    label: 'Warden Beacon',  position: [-3.2, 0.0, -2.2], color: '#ffd0e8', description: 'A solitary outpost marking the safe passage out of the void.' },
  { id: 'return-home',   galaxyId: 'void',    label: 'Return Beacon',  position: [4.4, 0.02, 2.6], color: '#7eff9a', description: 'A stable return wormhole. Following it sends the camera back to the home galaxy.', isPortal: true, portalTo: 'primary' },
]

// Fixed tour sequence (random-feeling but deterministic). Includes portals so
// scrolling naturally takes the viewer between galaxies.
export const TOUR_SEQUENCE: string[] = [
  'sirius', 'nova', 'helios', 'aether', 'orion',
  'product-void',                       // jump to void
  'void-echo', 'void-rift', 'void-pyre', 'void-warden',
  'return-home',                        // jump back home
]

export function getTourNode(index: number): GalaxyNode | null {
  const id = TOUR_SEQUENCE[index]
  if (!id) return null
  return NODES.find((n) => n.id === id) || null
}

type State = {
  selectedNode: GalaxyNode | null
  hoveredNode: string | null
  panelOpen: boolean
  settings: Settings
  tourIndex: number
  isWarping: boolean
  currentGalaxy: GalaxyId
  setSelected: (n: GalaxyNode | null) => void
  setHovered: (id: string | null) => void
  togglePanel: () => void
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  resetSettings: () => void
  setTourIndex: (i: number) => void
  advanceTour: (dir: 1 | -1) => void
  setIsWarping: (b: boolean) => void
  setCurrentGalaxy: (id: GalaxyId) => void
}

export const useGalaxyStore = create<State>((set, get) => ({
  selectedNode: null,
  hoveredNode: null,
  panelOpen: false,
  settings: { ...DEFAULT_SETTINGS },
  tourIndex: -1,
  isWarping: false,
  currentGalaxy: 'primary',
  setSelected: (n) => {
    // Sync tour index if user clicked a node directly
    if (n) {
      const idx = TOUR_SEQUENCE.indexOf(n.id)
      if (idx >= 0) set({ tourIndex: idx })
    }
    set({ selectedNode: n })
  },
  setHovered: (id) => set({ hoveredNode: id }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  updateSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),
  setTourIndex: (i) => {
    const clamped = THREE.MathUtils.clamp(i, 0, TOUR_SEQUENCE.length - 1)
    const node = getTourNode(clamped)
    set({ tourIndex: clamped, selectedNode: node })
  },
  advanceTour: (dir) => {
    const cur = get().tourIndex
    const next = THREE.MathUtils.clamp(cur + dir, 0, TOUR_SEQUENCE.length - 1)
    if (next === cur) return
    const node = getTourNode(next)
    set({ tourIndex: next, selectedNode: node })
  },
  setIsWarping: (b) => set({ isWarping: b }),
  setCurrentGalaxy: (id) => set({ currentGalaxy: id }),
}))

if (typeof window !== 'undefined') {
  ;(window as any).__galaxyStore = useGalaxyStore
}
