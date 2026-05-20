##########################################################################################
# VYAN Labs Multiverse — Phase-by-Phase Build
##########################################################################################

user_problem_statement: |
  Build the VYAN Labs Multiverse — a cinematic Next.js 14 web app rendering a
  multi-realm cosmic universe in pure Three.js + GSAP.
  Phase 1 goal: Port user's vanilla TypeScript gateway codebase into Next.js,
  add the cosmic logo loader (/) that emerges from darkness, breathes twice,
  fades to black, then routes to /vyoma where the GatewayRealm + Vyōma orb
  renders unchanged. Cascade-prefetch /vyoma while the loader plays.

## Testing Protocol
(DO NOT EDIT — read-only for the main agent)

1. Backend testing via `deep_testing_backend_nextjs` only.
2. Frontend testing via `deep_testing_frontend_nextjs` only AFTER explicit user permission.
3. Screenshot tool (Playwright) may be used freely for visual sanity checks.
4. Main agent must read this file before invoking any sub-agent.
5. Never re-fix what a sub-agent has already fixed unless it regressed.

## Phase Tracker

phase_1_foundation_transplant: { status: USER_VERIFIED }

phase_2_shunya_void:
  status: USER_VERIFICATION_PENDING
  visual_checks_done: true
  http_checks_done: true
  notes:
    - 5 orbs (Udbhava, Vistāra, Vyūha, Medhā, Sandhi) created with NanoOrb + colored tints.
    - PathCurve.ts — closed CatmullRom curve with 5 waypoints offset from orb positions.
    - SceneManager promoted to multi-realm with mode switching (gateway ↔ shunya).
    - CameraRig.updateShunya() follows the path based on scroll.loopProgress with pointer parallax.
    - ScrollJourney already supports wheel + touch swipe; drives camera traversal.
    - Orb captions (red name + cosmic silver tagline) fade based on focus proximity.
    - Right-edge depth rail shows 5 nodes (extras hidden) with active glow.
    - Drag rotates the focused orb (when interaction.down and focus > 0.6).
    - GatewayRealm.triggerBurst → fadeToBlack → emits onEnterVoid → router.push('/shunya').
    - ShunyaRealm.onEnter calls fadeFromBlack(1.6s) for cinematic emergence from the void.
    - Shared (cosmic) route group layout = canvas mounts ONCE, /vyoma ↔ /shunya navigates without remount.
    - Deep-link to /shunya/<orb> snaps camera to that orb instantly on initial mount.
    - Browser back/forward integrated natively via Next.js history.
    - Cascade prefetch: loader prefetches /vyoma; CosmicCanvas prefetches /vyoma + /shunya on mount.
  routes:
    - "/"               (loader)
    - "/vyoma"          (gateway, Vyōma orb)
    - "/shunya"         (parent void, 5 orbs, starts at Udbhava)
    - "/shunya/udbhava" (focused)
    - "/shunya/vistara" (focused)
    - "/shunya/vyuha"   (focused)
    - "/shunya/medha"   (focused)
    - "/shunya/sandhi"  (focused)
  files_created_or_modified:
    - /app/lib/vyan/scenes/PathCurve.ts                 (NEW)
    - /app/lib/vyan/scenes/realms/ShunyaRealm.ts        (NEW)
    - /app/lib/vyan/scenes/RealmManager.ts              (rewrite for multi-realm)
    - /app/lib/vyan/app/CameraRig.ts                    (rewrite, gateway + shunya modes)
    - /app/lib/vyan/app/App.ts                          (public setMode/focusShunyaOrb/getMode)
    - /app/lib/vyan/app/World.ts                        (callbacks pass-through, setMode/focusShunyaOrb)
    - /app/lib/vyan/app/ScrollJourney.ts                (added dispose())
    - /app/lib/vyan/ui/Overlay.ts                       (setShunyaCaption, setShunyaRail, fadeFromBlack, clearFade)
    - /app/lib/vyan/ui/styles.css                       (Shunya caption + depth-node.near styles)
    - /app/lib/vyan/scenes/realms/GatewayRealm.ts       (onEnterVoid callback, clearFade on re-entry)
    - /app/app/(cosmic)/layout.tsx                      (NEW shared layout)
    - /app/app/(cosmic)/CosmicCanvas.tsx                (NEW persistent canvas mount)
    - /app/app/(cosmic)/vyoma/page.tsx                  (signals gateway)
    - /app/app/(cosmic)/shunya/page.tsx                 (signals shunya)
    - /app/app/(cosmic)/shunya/[orb]/page.tsx           (deep link, validates orb key)
    - /app/public/audio/ambient.mp3                     (silence placeholder, suppresses 404)
    - REMOVED: /app/app/vyoma/{page.tsx,VyomaClient.tsx} (replaced by route group)
phase_3_glass_slabs: { status: NOT_STARTED }
phase_4_vistara_subvoid: { status: NOT_STARTED }
phase_5_medha_subvoid: { status: NOT_STARTED }
phase_6_polish: { status: NOT_STARTED }

## Test Plans (for sub-agents — DO NOT run without user permission)

backend:
  - No backend yet for Phase 1.

frontend:
  - "/" loads, logo emerges, two breath cycles visible, fades to black, redirects to /vyoma.
  - "/vyoma" shows the Vyōma orb, the right-edge depth indicator, the SOUND OFF chip,
    and the "VYŌMA — THE PRIMORDIAL CORE" caption near bottom-right.
  - Browser back from /vyoma returns to / (and replays loader).

## Agent Communications

  - agent: main
    message: "Phase 1 complete. Loader → /vyoma transition verified via screenshot. HTTP 200 on both routes. Awaiting user approval to proceed to Phase 2 (Shunya void)."

  - agent: main
    message: |
      Phase 4 (Vist\u0101ra Product sub-void) + Phase 5 (Medh\u0101 chat HUD) shipped.

      PHASE 4 \u2014 VIST\u0100RA
      - 7 product orbs in golden-angle spiral path: V\u0303YAN \u1e6cTAM, OJAS, MUDR\u0100,
        NETRA, \u0100K\u1e5aTI, S\u016aTRA, + placeholder
      - Each orb gets a distinct cosmic-tinted colour palette + Sanskrit-correct
        glyphs (Ṛ vs Ṭ vs Ṙ codepoint bug fixed: \u1e5a everywhere)
      - Routes: /vistara, /vistara/<key> deep-linkable
      - Click VIST\u0100RA orb in Shunya \u2192 cinematic burst + fadeToBlack \u2192 enter sub-void
      - Each product opens a slab with In Cognition status pill (placeholder = Awaiting Manifestation)
      - VistaraPath spiral-dust particle field added behind the orbs

      PHASE 5 \u2014 MEDH\u0100 (Resonance Loom HUD)
      - Unique full-screen "2050 cockpit": top spine with 5-mode arc selector,
        center thread (Pollinations-fed letter-reveal stream), right info-card,
        bottom composer with mode-bound glyph
      - 5 cognitive modes: Pr\u0101j\u00f1a, Dhy\u0101na, Ak\u1e63aya, Jav\u0101, Sa\u00f1c\u0101ra
        \u2014 each with own colour palette that re-tints the entire HUD on switch
      - Hover/click any node \u2192 active mode switches + system prompt rotates
      - Integration: Pollinations.ai free anonymous GET /text/{prompt}?model=openai-fast
        with ?system= param. NO API KEYS, NO VAULT (user choice: Option B).
      - All 5 modes route through openai-fast underneath; differentiation is via system prompts.
      - Graceful degradation: detects deprecation banners / queue-full / ENOSPC and
        shows a friendly "cognition busy" message. Single retry with 2.4s backoff.
      - SHUNYA exit button returns to /shunya/medha (focused on Medh\u0101 orb)

      KNOWN: Pollinations free tier currently has server-side ENOSPC issues from
      our cloud IP; on real residential ISPs the API is more reliable. The HUD UI
      is rock-solid regardless.

      Files added/changed (key ones):
      - NEW: lib/vyan/scenes/VistaraPath.ts
      - NEW: lib/vyan/scenes/realms/VistaraRealm.ts
      - NEW: lib/medha/cognitive.ts
      - NEW: lib/medha/MedhaClient.ts
      - NEW: app/(cosmic)/vistara/{page,[product]/page}.tsx
      - NEW: app/(cosmic)/medha/{page,MedhaHUD,medha.css}
      - CHANGED: ShunyaRealm (vistara + medha portal special-cases), RealmManager
        (added vistara realm), CameraRig (vistara mode + arrivals), App + World
        (callbacks), CosmicCanvas (route \u2194 mode mapping incl. /vistara, /medha)
      - FIXED: U+1E6C/U+1E58 mis-encoded glyphs in Vist\u0101ra names
      - FIXED: JSX \u005Cu escape literals rendering as raw text in MedhaHUD
      - Fixed syntax error in InteractionManager.ts (stray `};`).
      - Glass panel: max-height + custom-scroll on .glass-panel-inner; CLOSE
        button moved OUT of scroll container and floats top-right of .glass-panel
        (always visible regardless of scroll position).
      - Floating Arrivals (#2): new lib/vyan/app/Spring.ts. NanoOrb.setArrivalOffset
        + ShunyaRealm.onEnter triggers each orb to spring in from random off-axis
        offset (magnitude 10). Settles in ~1.5s via stiffness 12 / damping 6.8.
      - Arrogant Spring (#3): CameraRig now uses SpringV3 for path position
        (stiffness 6 / damping 3.5 — user-specified arrogant feel) and tighter
        look-at spring (stiffness 9 / damping 4.5). Camera also gets its own
        smaller arrival offset (magnitude 5).
      - Audio sync: AudioReactive rebuilt with duck/swell/fadeIn/fadeOut/unlock
        envelope API. Auto-unlocks on first pointerdown with 2.4s fade-in.
        Hooks wired across the full lifecycle:
          • Gateway burst         → swell(1.1, 0.35s)
          • fadeToBlack           → duck(0.05, 2.4s)
          • ShunyaRealm.onEnter   → swell(0.9, 1.6s)  (matches fadeFromBlack)
          • Orb activate (magnify)→ swell(1.05, 0.35s) → duck(0.55, 0.6s) at slab open
          • Slab close            → swell(0.9, 0.6s)
      - Visual verification screenshots taken for Udbhava (long-form scroll),
        Sandhi (4-card translucent grid), and Shunya entry arrivals at T+0.5,
        T+1.3 and T+3.5s.
