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

phase_1_foundation_transplant:
  status: USER_VERIFICATION_PENDING
  visual_checks_done: true
  http_checks_done: true
  notes:
    - Wiped prior Vite scaffold, set up Next.js 14 App Router.
    - Ported /lib/vyan/{app,objects,post,scenes,shaders,ui} (Firebase already stripped).
    - Added skipIntro option to App + destroy method on App/World/Overlay for clean unmount.
    - Loader page (/) uses GSAP timeline: emerge → breath 1 → breath 2 → fade.
    - Loader prefetches /vyoma via router.prefetch for instant transition.
    - /vyoma renders GatewayRealm canvas + Overlay UI unmodified.
  files_created:
    - /app/package.json (Next 14.2.5, three 0.163, gsap 3.13)
    - /app/tsconfig.json
    - /app/next.config.js
    - /app/tailwind.config.ts
    - /app/postcss.config.js
    - /app/app/layout.tsx
    - /app/app/page.tsx + /app/app/LoaderClient.tsx
    - /app/app/vyoma/page.tsx + /app/app/vyoma/VyomaClient.tsx
    - /app/app/globals.css
    - /app/lib/vyan/** (ported from user zip)
    - /app/public/logo.png (downloaded from user's GitHub)

phase_2_shunya_void: { status: NOT_STARTED }
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
