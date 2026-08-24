// ─── Gateway definitions — source of truth for all VYAN products ──────────────
// Used by QuantumGrid (components/vistara/QuantumGrid.tsx)

export interface Gateway {
  id: string
  name: string          // Sanskrit name
  tantra: string        // Full VYAN product name
  tagline: string
  description: string
  color: string         // Accent color
  // ── Quantum grid 3D layout ────────────────────────────────────────────────
  pos: [number, number, number]   // World-space position
  w: number                       // Frame width
  h: number                       // Frame height
  rotX: number                    // X rotation (radians)
  rotY: number                    // Y rotation (radians)
  // ── Live app ─────────────────────────────────────────────────────────────
  // Set appUrl once the app is ready for iframe embedding.
  appUrl?: string
}

export const GATEWAYS: Gateway[] = [
  {
    id: 'rtam',
    name: 'Ṛtam',
    tantra: 'VYAN ṚTAM',
    tagline: 'Conscious Living Through Pravāha',
    description: 'Harmony, flow, progression. The cosmic order underlying all conscious systems.',
    color: '#d4a853',
    pos: [  0,   0,   0], w: 14, h:  9.5, rotX:  0.00, rotY:  0.00,
    appUrl: 'https://rtam.vyanlabs.com',
  },
  {
    id: 'ojas',
    name: 'Ojas',
    tantra: 'VYAN OJAS',
    tagline: 'Tracking Your Pranic Rhythm',
    description: 'Rhythm, vitality, circulation. Concentric energy rings measuring the pulse of existence.',
    color: '#e8c87a',
    pos: [ 22,   5, -14], w: 11, h:  7.5, rotX:  0.06, rotY: -0.28,
  },
  {
    id: 'vanijya',
    name: 'Vaṇijya',
    tantra: 'VYAN VAṆIJYA',
    tagline: 'A Medhā-Driven System for Market Intelligence',
    description: 'Commerce, intelligence, market clarity. Medhā-powered insight tracing the invisible flows of global trade.',
    color: '#8ab0e0',
    pos: [ 18,   8, -20], w: 11, h:  7.5, rotX:  0.05, rotY: -0.22,
    appUrl: 'https://vanijya.vyanlabs.com',
  },
  {
    id: 'mudra',
    name: 'Mudrā',
    tantra: 'VYAN MUDRĀ',
    tagline: 'The Kośa of Global Entities',
    description: 'Knowledge, preservation, permanence. The obsidian archive of all that exists.',
    color: '#c4924a',
    pos: [-20,  -4, -10], w: 12, h:  8.0, rotX: -0.05, rotY:  0.22,
  },
  {
    id: 'netra',
    name: 'Netra',
    tantra: 'VYAN NETRA',
    tagline: 'The Conscious Eye Across Tantras',
    description: 'Observation, awareness, perception. The astronomical eye that sees all.',
    color: '#f0d080',
    pos: [  9, -11, -22], w: 10, h:  7.0, rotX:  0.08, rotY: -0.18,
  },
  {
    id: 'akriti',
    name: 'Ākṛti',
    tantra: 'VYAN ĀKṚTI',
    tagline: 'Creating Digital Anubhava Through Your Drishti',
    description: 'Design, creation, transformation. Prismatic crystal formations refracting possibility.',
    color: '#e8f0ff',
    pos: [-14,   9, -28], w: 11, h:  7.5, rotX: -0.04, rotY:  0.30,
  },
  {
    id: 'sutra',
    name: 'Sūtra',
    tantra: 'VYAN SŪTRA',
    tagline: 'Weaving Sangama Through Vivek',
    description: 'Connection, relationships, intentional networks. Luminous threads weaving consciousness.',
    color: '#d4c070',
    pos: [ 28,  -7, -32], w: 12, h:  8.0, rotX:  0.06, rotY: -0.25,
  },
  {
    id: 'chitra-prana',
    name: 'Chitra-Prāṇa',
    tantra: 'VYAN CHITRA-PRĀṆA',
    tagline: 'Breathing Life Into Imagery',
    description: 'Creation, motion, imagination. The cosmic aperture where imagery comes alive.',
    color: '#a0c8e8',
    pos: [-10,  14, -42], w: 11, h:  8.0, rotX: -0.08, rotY:  0.15,
  },
  {
    id: 'maya',
    name: 'Māyā',
    tantra: 'VYAN MĀYĀ',
    tagline: 'Manifesting Digital Realities',
    description: 'Manifestation, possibility, digital worlds. The most dynamic gateway — where realities are made.',
    color: '#ffd080',
    pos: [ 18,  -8, -52], w: 13, h:  9.0, rotX:  0.05, rotY: -0.20,
  },
  {
    id: 'sangraha',
    name: 'Saṅgraha',
    tantra: 'VYAN SAṄGRAHA',
    tagline: '',
    description: '',
    color: '#c8a0e8',
    pos: [-24,   6, -62], w: 12, h:  8.5, rotX: -0.06, rotY:  0.24,
  },
]
