import * as THREE from 'three'

export interface VistaraProduct {
  id: string
  name: string
  tagline: string
  description: string
  status: 'active' | 'coming-soon'
  position: THREE.Vector3
}

// ─── 7 Products — scattered in 3D space ───────────────────────────────────────
// Nodes are small — max 8 units radius. Camera travels PAST them from edges.
// Z depth varies widely — creates genuine 3D cave feel.
// X/Y placement ensures nodes enter frame from all edges as camera moves.
export const VISTARA_PRODUCTS: VistaraProduct[] = [
  {
    id: 'rtam',
    name: 'Ṛtam',
    tagline: 'Cosmic Order Intelligence',
    description: 'Ṛtam governs the natural order of information — pattern recognition, temporal intelligence, and the deep structures beneath surface data.',
    status: 'active',
    position: new THREE.Vector3(-140, 60, -280),   // enters from top-left
  },
  {
    id: 'ojas',
    name: 'Ojas',
    tagline: 'Vital Force Engine',
    description: 'Ojas is the life force of cognitive systems — performance optimization, energy-efficient inference, and vitality at computational scale.',
    status: 'active',
    position: new THREE.Vector3(160, -50, -220),   // enters from right
  },
  {
    id: 'mudra',
    name: 'Mudrā',
    tagline: 'Gesture & Interface Intelligence',
    description: 'Mudrā translates intention into form — multimodal interaction, gesture understanding, and the bridge between human expression and machine response.',
    status: 'active',
    position: new THREE.Vector3(-80, -90, -160),   // enters from bottom-left
  },
  {
    id: 'netra',
    name: 'Netra',
    tagline: 'Vision Intelligence System',
    description: 'Netra is the eye that sees what others miss — computer vision, scene understanding, and visual cognition at depth.',
    status: 'active',
    position: new THREE.Vector3(110, 90, -360),    // enters from top-right, deep
  },
  {
    id: 'akriti',
    name: 'Ākṛti',
    tagline: 'Form & Generation Engine',
    description: 'Ākṛti gives form to the formless — generative intelligence, synthesis, and the creation of new structure from pure possibility.',
    status: 'active',
    position: new THREE.Vector3(80, -70, -140),    // enters from bottom-right, close
  },
  {
    id: 'sutra',
    name: 'Sūtra',
    tagline: 'Thread & Connection Intelligence',
    description: 'Sūtra weaves the threads — knowledge graphs, relational intelligence, and the connections that reveal what isolated data cannot.',
    status: 'active',
    position: new THREE.Vector3(-160, 30, -300),   // enters from left, deep
  },
  {
    id: 'chitra-prana',
    name: 'Chitra-Prāṇa',
    tagline: 'Painted Life Force',
    description: 'Chitra-Prāṇa animates the visual — creative intelligence, aesthetic cognition, and the breath that makes images alive.',
    status: 'active',
    position: new THREE.Vector3(20, 110, -190),    // enters from top, mid-depth
  },
]

// ─── Camera journey ────────────────────────────────────────────────────────────
// Camera starts far back — all nodes visible as tiny points.
// Scrolls forward, entering the web cave.
// At each node's Z depth, camera briefly halts (dwell system).
export const CAMERA_ENTRY = new THREE.Vector3(0, 20, 180)
export const CAMERA_ENTRY_LOOK = new THREE.Vector3(0, 0, -200)
export const CAMERA_CAVE = new THREE.Vector3(0, 0, -80)
export const CAMERA_CAVE_LOOK = new THREE.Vector3(0, 0, -300)
export const SCROLL_DEPTH_PX = 600

// ─── Node dwell ────────────────────────────────────────────────────────────────
// Camera halts near each node for 1–2s before continuing
export const NODE_DWELL_MS = 1200
export const NODE_APPROACH_DIST = 60  // units — how close camera gets before dwelling

// ─── Visual config ─────────────────────────────────────────────────────────────
export const NODE_RADIUS = 5           // small — not screen-filling
export const NODE_GLOW_RADIUS = 12     // glow sphere
export const CURRENT_SPEED = 160       // units/sec
export const CURRENT_WAVE_WIDTH = 1.2

// ─── Current colors ────────────────────────────────────────────────────────────
export const CURRENT_COLORS = [
  '#1a1aff', '#7b2fff', '#c026d3',
  '#00c4cc', '#e8b94f', '#a855f7',
  '#dc2626', '#2d9e7f',
]

// ─── Inactivity ────────────────────────────────────────────────────────────────
export const INACTIVITY_MIN_MS = 40000
export const INACTIVITY_MAX_MS = 60000
export const FADE_OUT_MS = 2000
export const BLACK_PAUSE_MS = 1500
export const FADE_IN_MS = 1500
