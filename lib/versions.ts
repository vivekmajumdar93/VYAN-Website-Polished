// ─── VYAN Website Version Registry ───────────────────────────────────────────
// Add a new entry at the TOP of SITE_VERSIONS for every meaningful release.
// Update CURRENT_VERSION to match.
// Tag the git commit: git tag v<version> <hash> && git push origin v<version>

export interface VersionEntry {
  version: string      // e.g. '1.2'
  date: string         // YYYY-MM-DD
  title: string        // short release name
  summary: string      // one or two sentences
  changes: string[]    // bullet list of what changed
  gitHash: string      // first 7 chars of commit hash
  pages: string[]      // which pages / systems were touched
}

export const SITE_VERSIONS: VersionEntry[] = [
  {
    version: '1.2',
    date: '2026-07-18',
    title: 'Site-wide Version History Panel',
    summary: 'Introduced the version badge and history panel visible across the entire website, so every release is documented and restorable.',
    changes: [
      'Version badge (bottom-left, site-wide) — click to open history panel',
      'Full version history panel with per-release change log and git hash',
      'Version registry in lib/versions.ts — updated with every release going forward',
    ],
    gitHash: 'pending',
    pages: ['All pages'],
  },
  {
    version: '1.1',
    date: '2026-07-18',
    title: 'Vistara — Phi Label Layout & Font Overhaul',
    summary: 'Label system redesigned: names stack vertically through the orb centre (φ), taglines anchor in CSS below the column in normal case.',
    changes: [
      'Phi (φ) layout — each name letter stacked as its own line, column bisects orb',
      'VYAN Shunyalekh bold italic (weight 700) for orb name labels',
      'Taglines in normal mixed case, horizontal, CSS-anchored below name column',
      'Font size auto-reduces only for names longer than 7 characters (min 18 px)',
      'Tagline fades to invisible on non-focused orbs (opacity transition 0.4s)',
      'Non-focused labels at opacity 0.28 to eliminate visual crowding',
      'Removed distanceFactor from Html labels — consistent font size across all orbit depths',
    ],
    gitHash: '8063059',
    pages: ['Vistara'],
  },
  {
    version: '1.0',
    date: '2026-07-17',
    title: 'Vistara Visual Foundation — Saturn Rings & Red Labels',
    summary: 'The visual milestone the client approved: Saturn-ring stardust gyroscopic rings, stark red labels, and the VYAN blue icon palette.',
    changes: [
      'Saturn-ring stardust particle systems replacing torus geometries',
      'Particle density waves tied to gyroscopic tilt via uTilt GLSL uniform',
      'Color-cycling particles: red → deep blue → dark purple loop via uTime',
      'Gyroscopic precession — diagonal secondary drift on all three rings',
      'Stark red labels (#ff4040) with triple-layer glow below each orb',
      'VYAN icons (Back, Send, Close) recoloured to deep royal blue / electric azure',
      'BackIcon in Vistara nav, Close + Send in GlassPanel and ComingSoon panels',
      'Live app iframe slot (appUrl?) added to GlassPanel for future embedding',
      'Medha consent form: sandhi@vyanlabs.com → admin@vyanlabs.com',
    ],
    gitHash: 'b14b812',
    pages: ['Vistara', 'Medhā'],
  },
  {
    version: '0.9',
    date: '2026-07-15',
    title: 'Vistara — Node Web, Star Trails & Glass Panel',
    summary: 'Full interactive experience: node web unfolds on panel open, phantom orbs, ShaderMaterial star trails, and camera throw.',
    changes: [
      'Node web unfolds outward when glass panel opens (sin-bell burst)',
      'Phantom NanoOrbs for secondary star-like presence between orbs',
      'ShaderMaterial star trails connecting orbs (TRAIL_VERT / TRAIL_FRAG GLSL)',
      'Camera throw toward focused orb on click, with lerp return',
      'Glass panel with CSS gradient shards replacing heavy clip-path animation',
      'Deep-blue orb colour palette, larger phantom orbs',
      'Nebula atmosphere and background starfield texture',
      'Coming Soon panel for unreleased gateway slots',
    ],
    gitHash: 'bacba59',
    pages: ['Vistara'],
  },
]

export const CURRENT_VERSION = SITE_VERSIONS[0].version
