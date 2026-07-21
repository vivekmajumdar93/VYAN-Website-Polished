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
    version: '1.7',
    date: '2026-07-21',
    title: 'Vistara — 3D Starfield, Central Vortex & Fresnel Rim Glow',
    summary: 'Three depth upgrades: a 1500-star Three.js starfield replaces flat CSS dots for true camera parallax; a billboard vortex disc marks the gyroscope origin; each orb gains a Fresnel azure corona that brightens on focus.',
    changes: [
      '3D starfield: 1500 stars in sphere r=900–3600, blue-white/warm-yellow/lavender, sizeAttenuation shader',
      'Camera parallax: stars shift with zoom between overview and close-up',
      'Central vortex: billboard PlaneGeometry at (0,0,0) with swirl + concentric-pulse shader',
      'Vortex: violet→deep-blue gradient, bright white-violet core, always faces camera',
      'Fresnel rim: transparent sphere shell on every orb, electric azure glow at grazing angles',
      'Fresnel intensity: 0.18 idle → 0.52 hovered → 0.88 focused, lerped over 8 frames',
      'Fresnel radius tracks scaleRef×5.8 so the corona wraps the NanoOrb particle cloud',
    ],
    gitHash: '9342bff',
    pages: ['Vistara'],
  },
  {
    version: '1.6',
    date: '2026-07-21',
    title: 'Vistara — HDR Bloom on Ring Particle Cores',
    summary: 'Each Saturn ring particle now emits a tight star-point glow from its sparkle core. The void and orbs remain completely dark — bloom fires only on the HDR-boosted ring centres.',
    changes: [
      'SATURN_FRAG outputs HDR values at sparkle centres (col += sprk * vAlpha * 2.5)',
      'EffectComposer + Bloom with luminanceThreshold=0.85 — only ring cores qualify',
      'Disc area (sprk < 0.3) and NanoOrb particles stay below threshold — no halos',
      'radius=0.35, intensity=0.55, mipmapBlur — tight star-point, not screen-wide glow',
    ],
    gitHash: '32b3d66',
    pages: ['Vistara'],
  },
  {
    version: '1.5',
    date: '2026-07-21',
    title: 'Vistara — Stardust Meteors, Sound Icon & Universal Footer',
    summary: 'Shooting stars rebuilt as discrete stardust particle trails matching the Saturn ring language. Legal footer and copyright pill now hover-accessible on every page above all panels.',
    changes: [
      'Shooting stars: 2 max, 45-second cycle, staggered 22.5 s apart',
      'Trail rebuilt as 280 discrete motes with perpendicular scatter — stardust not a beam',
      'Per-particle size jitter and signed lateral scatter for organic ring-like density',
      'Hard 14px particle cap prevents any screen-filling blob at any camera distance',
      'ACOUSTIC shortcut button (top-left, below back) dispatches vyan:sound-toggle to SoundConsole',
      'SoundConsole gains external event listener for vyan:sound-toggle',
      'NebulaFooter enabled on all cosmic pages — removed /vyoma+/shunya route gate',
      'Footer z-index 8→9100, slab dialog 80→9200 — visible and clickable above all panels',
      'Version history: JS touch-scroll handlers replace broken CSS pan-y override',
      'Orbital rings: alpha 0.35→0.48, particles 2200→3000, size 1.5-5px→2.2-7px for low-brightness screens',
      'Ring width narrowed from 44% to 30% of radius — tighter, more defined band',
    ],
    gitHash: '156d53e',
    pages: ['Vistara', 'All pages'],
  },
  {
    version: '1.4',
    date: '2026-07-19',
    title: 'Vistara — Side-Sliding Panels & Live App Placeholders',
    summary: 'Orb panels now slide in from alternating left/right edges on desktop and sheet up from the bottom on mobile; a decorated live-app placeholder fills the interface slot until an app is ready.',
    changes: [
      'Even-indexed orbs open panel from the left edge; odd-indexed from the right',
      'Desktop panel: full-height sidebar (min(500px, 46vw)), slides in with spring ease',
      'Mobile panel: 88 vh bottom sheet with drag handle, slides up from bottom',
      'Backdrop blur (3px) replaces hard black overlay',
      'Inner-edge accent border glows in the gateway colour',
      'Top accent line (gradient) at panel crown, gateway tantra badge in header',
      'Scrollable content area with sticky footer buttons (Back + Enter)',
      'LiveAppPlaceholder: animated dot-grid, sweeping scan line, corner brackets, pulsing glow',
      'Placeholder shows when gateway.appUrl is unset; iframe mounts when set',
      'Closing animation accelerates back to the originating edge (not a generic fade)',
    ],
    gitHash: '0000000',
    pages: ['Vistara'],
  },
  {
    version: '1.3',
    date: '2026-07-19',
    title: 'Vistara — Overview Mode & OrbitControls',
    summary: 'Page now loads in a zoomable overview showing all 8 orbs; click any orb to fly into close-up, or tap Overview to return.',
    changes: [
      'Overview mode on load — camera at z=1300, full gyroscopic system visible',
      'OrbitControls in overview: scroll/pinch to zoom, drag to rotate the entire scene',
      'Click any orb from overview → smooth 0.9 s camera fly-in to close-up',
      'Overview button (bottom-right) in close-up → 1.4 s fly-out back to overview',
      'Orb labels hidden in overview for a clean birds-eye view; revealed on close-up',
      'Wheel/swipe traversal gated — only active in close-up mode',
      'Hint text updates: "Scroll · Pinch · Drag to explore · Tap an orb to enter" in overview',
      'Dot navigation bar hidden in overview; restored in close-up',
    ],
    gitHash: '4d32b1b',
    pages: ['Vistara'],
  },
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
    gitHash: 'fecf058',
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

export const CURRENT_VERSION = '1.7'
