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
