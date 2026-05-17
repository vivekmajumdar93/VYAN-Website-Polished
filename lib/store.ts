import { create } from 'zustand'

export type GalaxyNode = {
  id: string
  label: string
  position: [number, number, number]
  color: string
  description: string
}

type State = {
  selectedNode: GalaxyNode | null
  hoveredNode: string | null
  setSelected: (n: GalaxyNode | null) => void
  setHovered: (id: string | null) => void
}

export const useGalaxyStore = create<State>((set) => ({
  selectedNode: null,
  hoveredNode: null,
  setSelected: (n) => set({ selectedNode: n }),
  setHovered: (id) => set({ hoveredNode: id }),
}))

export const NODES: GalaxyNode[] = [
  { id: 'sirius',   label: 'Sirius Cluster',    position: [3.2, 0.05, -1.8], color: '#9ec5ff', description: 'A dense, hot cluster of young blue giants near the galactic arm.' },
  { id: 'nova',     label: 'Nova Prime',        position: [-2.8, 0.1, 2.4],  color: '#d4a4ff', description: 'A pulsating purple nova at the edge of the spiral arm.' },
  { id: 'aether',   label: 'Aether Nebula',     position: [1.4, -0.08, 3.6], color: '#7ce8ff', description: 'A diffuse, glowing nebula of ionized gas and dust.' },
  { id: 'orion',    label: 'Orion Gate',        position: [-3.6, 0.0, -2.6], color: '#ffd4f0', description: 'An ancient gateway formed at the intersection of two arms.' },
  { id: 'helios',   label: 'Helios Beacon',     position: [4.2, -0.05, 1.2], color: '#ffe89c', description: 'A solitary yellow beacon star, used for galactic navigation.' },
  { id: 'verge',    label: 'The Verge',         position: [-1.6, 0.12, -4.2], color: '#b69eff', description: 'A faint, far cluster at the very rim of the galaxy.' },
]
