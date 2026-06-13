import * as THREE from 'three'
import { VISTARA_PRODUCTS, CURRENT_COLORS } from './config'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WebNode {
  productIndex: number
  position: THREE.Vector3
  connections: number[]
  glowIntensity: number   // 0–1
  isActive: boolean       // locked on
  isDormant: boolean      // sleeping
}

export interface ActiveCurrent {
  id: string
  fromIdx: number
  toIdx: number
  progress: number        // 0–1 along this segment
  color: string
  speed: number
  pathRemaining: number[] // remaining node indices to visit
}

export interface SignalWave {
  sourceIdx: number
  reachedSet: Set<number>
  frontier: number[]
  color: string
  type: 'sleep' | 'wake'
  lastPulseAt: number
}

export interface LineState {
  points: THREE.Vector3[]
  color: string
  drawProgress: number    // 0–1
  opacity: number
  fadeAt: number          // timestamp to start fading
}

// ─── Web builder ───────────────────────────────────────────────────────────────

export function buildWebNodes(): WebNode[] {
  const nodes: WebNode[] = VISTARA_PRODUCTS.map((p, i) => ({
    productIndex: i,
    position: p.position.clone(),
    connections: [],
    glowIntensity: 0,
    isActive: false,
    isDormant: false,
  }))

  // Extra web-only intersection nodes (invisible, enrich the web)
  const extras = [
    new THREE.Vector3(0, -40, -200),
    new THREE.Vector3(-180, -20, -330),
    new THREE.Vector3(120, 130, -260),
    new THREE.Vector3(-40, -110, -170),
    new THREE.Vector3(200, 50, -240),
    new THREE.Vector3(-120, 100, -290),
    new THREE.Vector3(60, -100, -380),
    new THREE.Vector3(-60, 80, -130),
  ]
  extras.forEach(pos => {
    nodes.push({ productIndex: -1, position: pos, connections: [], glowIntensity: 0, isActive: false, isDormant: false })
  })

  // Connect each node to ~5–8 nearest
  nodes.forEach((node, i) => {
    const sorted = nodes
      .map((n, j) => ({ j, d: node.position.distanceTo(n.position) }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)
    const count = 5 + Math.floor(Math.random() * 3)
    sorted.slice(0, count).forEach(({ j }) => {
      if (!node.connections.includes(j)) node.connections.push(j)
      if (!nodes[j].connections.includes(i)) nodes[j].connections.push(i)
    })
  })

  return nodes
}

// ─── Organic curved line (snaky, like Lucy neural current) ────────────────────

export function buildOrganicLine(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const segs = 32
  const dist = from.distanceTo(to)
  const snakiness = 0.28 + Math.random() * 0.18

  // Two random control points for cubic bezier
  const mid = from.clone().lerp(to, 0.5)
  const perp = (v: number) => (Math.random() - 0.5) * dist * snakiness * v
  const cp1 = new THREE.Vector3(mid.x + perp(1), mid.y + perp(1), mid.z + perp(0.3))
  const cp2 = new THREE.Vector3(mid.x + perp(0.7), mid.y + perp(0.7), mid.z + perp(0.2))

  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const mt = 1 - t
    pts.push(new THREE.Vector3(
      mt**3 * from.x + 3*mt**2*t * cp1.x + 3*mt*t**2 * cp2.x + t**3 * to.x,
      mt**3 * from.y + 3*mt**2*t * cp1.y + 3*mt*t**2 * cp2.y + t**3 * to.y,
      mt**3 * from.z + 3*mt**2*t * cp1.z + 3*mt*t**2 * cp2.z + t**3 * to.z,
    ))
  }
  return pts
}

// ─── Screen edge entry point ───────────────────────────────────────────────────
// Current enters from random screen edge — top, bottom, left, right, diagonal

export function edgeEntryPoint(targetZ: number): THREE.Vector3 {
  const edge = Math.floor(Math.random() * 8)  // 8 directions including diagonals
  const r = 320
  const positions = [
    new THREE.Vector3(0, r, targetZ * 0.2),           // top
    new THREE.Vector3(0, -r, targetZ * 0.2),          // bottom
    new THREE.Vector3(-r, 0, targetZ * 0.2),          // left
    new THREE.Vector3(r, 0, targetZ * 0.2),           // right
    new THREE.Vector3(-r * 0.7, r * 0.7, targetZ * 0.2),   // top-left diagonal
    new THREE.Vector3(r * 0.7, r * 0.7, targetZ * 0.2),    // top-right diagonal
    new THREE.Vector3(-r * 0.7, -r * 0.7, targetZ * 0.2),  // bottom-left diagonal
    new THREE.Vector3(r * 0.7, -r * 0.7, targetZ * 0.2),   // bottom-right diagonal
  ]
  return positions[edge]
}

// ─── BFS path through web ──────────────────────────────────────────────────────

export function bfsPath(nodes: WebNode[], from: number, to: number): number[] {
  if (from === to) return [from]
  const visited = new Set([from])
  const queue: number[][] = [[from]]
  while (queue.length) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    for (const nb of nodes[cur].connections) {
      if (nb === to) return [...path, nb]
      if (!visited.has(nb)) { visited.add(nb); queue.push([...path, nb]) }
    }
  }
  return [from, to]
}

// ─── Ambient current generator ────────────────────────────────────────────────

export function spawnAmbientCurrent(nodes: WebNode[]): ActiveCurrent[] {
  // Pick random group of 1–4 product nodes
  const productIdxs = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.productIndex >= 0 && !n.isDormant)
    .map(({ i }) => i)

  if (productIdxs.length === 0) return []

  const groupSize = 1 + Math.floor(Math.random() * Math.min(4, productIdxs.length))
  const shuffled = [...productIdxs].sort(() => Math.random() - 0.5)
  const group = shuffled.slice(0, groupSize)

  // Build full path through group via BFS
  const fullPath: number[] = [group[0]]
  for (let g = 1; g < group.length; g++) {
    const seg = bfsPath(nodes, fullPath[fullPath.length - 1], group[g])
    fullPath.push(...seg.slice(1))
  }

  if (fullPath.length < 2) return []

  const color = CURRENT_COLORS[Math.floor(Math.random() * CURRENT_COLORS.length)]
  const speed = 130 + Math.random() * 80

  return [{
    id: `curr-${Date.now()}-${Math.random()}`,
    fromIdx: fullPath[0],
    toIdx: fullPath[1],
    progress: 0,
    color,
    speed,
    pathRemaining: fullPath.slice(2),
  }]
}

// ─── Signal wave ───────────────────────────────────────────────────────────────

export function createSignalWave(
  sourceIdx: number,
  type: 'sleep' | 'wake',
): SignalWave {
  return {
    sourceIdx,
    reachedSet: new Set([sourceIdx]),
    frontier: [sourceIdx],
    color: type === 'sleep'
      ? CURRENT_COLORS[Math.floor(Math.random() * CURRENT_COLORS.length)]
      : 'rgba(255,255,255,0.5)',
    type,
    lastPulseAt: performance.now(),
  }
}
