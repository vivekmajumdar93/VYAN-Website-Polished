// ─── Gateway definitions ───────────────────────────────────────────────────────
// Images uploaded to public/ root — filenames as provided by Vivek
// Code determines path at runtime by scanning available assets

export interface Gateway {
  id: string
  name: string           // Sanskrit name
  tantra: string         // Full product name
  tagline: string
  description: string
  filename: string       // filename in public/
  // Position within vortex — % of canvas
  // Distributed naturally through the swirl
  x: number             // 0–100% of canvas width
  y: number             // 0–100% of canvas height
  depth: number         // 0 (far/small) → 1 (near/large)
  scale: number         // base display scale
  orbitRadius: number   // how much it drifts in ambient animation
  orbitSpeed: number    // orbit speed multiplier
  orbitPhase: number    // initial phase offset
  color: string         // accent color for hover/active glow
  // ── LIVE APP PROVISION ── set this to mount a live app inside the panel ──
  // Leave undefined (default) until the app is ready to embed.
  // Supported: any URL that allows iframe embedding (same-origin or permissive CORS).
  appUrl?: string
}

export const GATEWAYS: Gateway[] = [
  {
    id: 'rtam',
    name: 'Ṛtam',
    tantra: 'VYAN ṚTAM',
    tagline: 'Conscious Living Through Pravāha',
    description: 'Harmony, flow, progression. The cosmic order underlying all conscious systems.',
    filename: '1000038767.png',
    // Upper left — emerging from vortex arm
    x: 18, y: 22, depth: 0.55, scale: 0.13,
    orbitRadius: 8, orbitSpeed: 0.0004, orbitPhase: 0,
    color: '#d4a853',
  },
  {
    id: 'ojas',
    name: 'Ojas',
    tantra: 'VYAN OJAS',
    tagline: 'Tracking Your Pranic Rhythm',
    description: 'Rhythm, vitality, circulation. Concentric energy rings measuring the pulse of existence.',
    filename: '1000038768.png',
    // Right side mid — within energy stream
    x: 78, y: 35, depth: 0.70, scale: 0.15,
    orbitRadius: 6, orbitSpeed: 0.0003, orbitPhase: 1.2,
    color: '#e8c87a',
  },
  {
    id: 'mudra',
    name: 'Mudrā',
    tantra: 'VYAN MUDRA',
    tagline: 'The Kośa of Global Entities',
    description: 'Knowledge, preservation, permanence. The obsidian archive of all that exists.',
    filename: '1000038769.png',
    // Left mid — deep in vortex
    x: 22, y: 55, depth: 0.35, scale: 0.10,
    orbitRadius: 5, orbitSpeed: 0.0002, orbitPhase: 2.4,
    color: '#c4924a',
  },
  {
    id: 'netra',
    name: 'Netra',
    tantra: 'VYAN NETRA',
    tagline: 'The Conscious Eye Across Tantras',
    description: 'Observation, awareness, perception. The astronomical eye that sees all.',
    filename: '1000038770.png',
    // Upper center-right — near vortex core
    x: 58, y: 18, depth: 0.80, scale: 0.16,
    orbitRadius: 7, orbitSpeed: 0.0005, orbitPhase: 3.6,
    color: '#f0d080',
  },
  {
    id: 'akriti',
    name: 'Ākṛti',
    tantra: 'VYAN AAKRITI',
    tagline: 'Creating Digital Anubhava Through Your Drishti',
    description: 'Design, creation, transformation. Prismatic crystal formations refracting possibility.',
    filename: '1000038771.png',
    // Center — closest to viewer
    x: 45, y: 62, depth: 0.90, scale: 0.18,
    orbitRadius: 9, orbitSpeed: 0.0006, orbitPhase: 0.8,
    color: '#e8f0ff',
  },
  {
    id: 'sutra',
    name: 'Sūtra',
    tantra: 'VYAN SUTRA',
    tagline: 'Weaving Sangama Through Vivek',
    description: 'Connection, relationships, intentional networks. Luminous threads weaving consciousness.',
    filename: '1000038783.png',
    // Far right — partially in vortex stream
    x: 82, y: 65, depth: 0.45, scale: 0.11,
    orbitRadius: 6, orbitSpeed: 0.0003, orbitPhase: 4.8,
    color: '#d4c070',
  },
  {
    id: 'chitra-prana',
    name: 'Chitra-Prāṇa',
    tantra: 'VYAN CHITRA-PRĀṆA',
    tagline: 'Breathing Life Into Imagery',
    description: 'Creation, motion, imagination. The cosmic aperture where imagery comes alive.',
    filename: '1000038784.png',
    // Lower center-left
    x: 32, y: 78, depth: 0.60, scale: 0.14,
    orbitRadius: 7, orbitSpeed: 0.0004, orbitPhase: 2.0,
    color: '#a0c8e8',
  },
  {
    id: 'maya',
    name: 'Māyā',
    tantra: 'VYAN MĀYĀ',
    tagline: 'Manifesting Digital Realities',
    description: 'Manifestation, possibility, digital worlds. The most dynamic gateway — where realities are made.',
    filename: '1000038785.png',
    // Lower right — foreground, most prominent
    x: 68, y: 75, depth: 0.85, scale: 0.17,
    orbitRadius: 10, orbitSpeed: 0.0005, orbitPhase: 5.5,
    color: '#ffd080',
  },
]

// Resolve asset path — checks public/ root
export function assetPath(filename: string): string {
  return `/${filename}`
}
