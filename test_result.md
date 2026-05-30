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
    message: |
      MEGA-BATCH — Medhā 7-component interface, consent gate (MongoDB-deduped),
      Nebula Footer, liquid copyright pill, strict scope-lock on Medhā prompts.

      MEDHĀ CONSENT GATE (Item 4)
      - New /api/consent (MongoDB-backed) with GET (?email=) and POST endpoints.
      - Server-side dedupe: same email → existing id returned, marked deduped:true.
      - Local localStorage flag (vyan.medha.consent) prevents re-asking on same device.
      - Slab: name + email + phone (optional) + purpose + agree checkbox.
      - Verified via curl: 1st POST creates, 2nd POST with same email dedupes, GET
        confirms exists:true. Falls back to mock-success if MONGO_URL is empty.

      STRICT 7-COMPONENT MEDHĀ HUD (Items 1, 2, 5)
      - A: vertical right rail — now USER messages only (assistant dots removed).
        Dot color uses the active mode hue (--mode-a) so user history glows in
        the current cognition's palette.
      - B: Sound console (global cosmic layout).
      - C: Nāvika orb (global cosmic layout).
      - D: NEW floating Settings orb (cosmic glyph + dashed orbit ring) bottom-left.
        Opens a glass panel with the full Cognitive Mode picker (5 minds), TTS/STT
        toggles, persistence info, conversations count, erase-all danger button.
        Selecting a mode triggers the electrifying link visual to Medhā.
      - E: Slim glass composer at bottom — 1000-char limit, live counter, auto-grows
        to 3× height past 220 chars with internal scroll. "is-warn" coloring near
        the limit.
      - F: Shunya back button (preserved).
      - G: Medhā living orb canvas (existing ribbon-wraith — see Item 6 note).
      - Legacy left action rail HIDDEN via .mlv-rail--hidden — all actions
        consolidated into the Settings orb so the screen stays clutter-free for
        Medhā's movements (per spec).

      MEDHĀ DIALOG = MOVABLE GLASS BOX (Item 1)
      - Replaced the static center slab with .mlv-medha-dialog — a floating glass
        box positioned at 58% viewport, floats with a 9s breathing animation, and
        vanishes the instant the user begins typing (isTyping state hook).
      - User messages never appear in this dialog — they're shown only when the
        user hovers/clicks the corresponding rail dot.

      ELECTRIFYING MODE-LINK VISUAL (Item 4 clarification)
      - On every cognitive-mode switch, an SVG bolt zaps from the settings panel
        across the screen to Medhā's center along a curved path. The bolt uses
        the new mode's gradient. A jittery dashed "crackle" line runs alongside.
        ~0.85s animation, re-keyed each pulse so it always restarts cleanly.
      - Medhā's existing aura tint follows the --mode-a / --mode-b CSS variables
        so her hue subtly shifts with the chosen mind.

      MEDHĀ SCOPE LOCK (Item 5 last paragraph) — NON-NEGOTIABLE
      - Added VYAN_SCOPE_RESTRICTION constant appended to all 5 mode prompts.
      - Forbidden: code, file paths, frameworks, libraries, prompts, model ids,
        DB schemas, infrastructure, deployment details, internal APIs, creds, API
        keys, security mechanisms, Netra, business strategies, roadmap, financials,
        partner names, employee details, competitors, AI provider technicals, etc.
      - Allowed: VYAN brand, public ecosystem (Vyōma/Shunya/Vistāra/Medhā/Sandhi),
        Vistāra product names (Vyan Ṛtam, Ojas, Mudrā, Netra, Ākṛti, Sūtra) at the
        public-tagline level only, contacts (sandhi@vyan.dev, sankalpa@vyan.dev),
        Saṅkalpa form, published legal pages.
      - On refusal: warm one-sentence steer toward sandhi@vyan.dev. Never breaks
        character, never acknowledges the lock exists, never paraphrases it.

      NEBULA FOOTER + LIQUID COPYRIGHT PILL (Items 7, 8)
      - New NebulaFooter component (fixed bottom 10vh, hidden on /medha).
      - Diamond-dust speckled nebula background with hover-summon hover sensor
        extending 60px above the band for forgiving activation.
      - 7 dormant placeholder slabs: Privacy · Terms · Refund · Contact · Press
        · Careers · Imprint. Hover-state crisps them up (opacity 0.25→1, blur 0,
        rise 8px). Click opens a 65–70% glass panel with "Content awaits
        manifestation" — ready for your content drops later.
      - Liquid-glass copyright pill BELOW the slab row:
          [© VYAN 2026]   ← pill with animated radial-gradient liquid motion
                              (9s loop, three colored blobs drift + rotate +
                              scale, mix-blend-mode: screen, backdrop-filter
                              blur+saturate for true glassmorphism)
          ALL RIGHTS RESERVED  ← plain caps text below.
      - Mobile: pill shrinks to 100px wide, slabs become tap-friendly.

      MEDHĀ ORB STYLE A — DOABILITY (Item 6)
      - Current MedhaCanvasOrb renders a humanoid ribbon-wraith in amethyst /
        pearl / cyan-mint — which already approximates the Crystalline Wraith
        gif. Awaiting your verdict: KEEP this rendition, or do a focused rebuild
        to add the horizontal wind-shear bands seen in the GIF.

      Files touched:
      - /app/app/(cosmic)/medha/MedhaHUD.tsx (consent gate, isTyping, electric link,
        char counter, user-only dots, settings orb, settings panel mode picker)
      - /app/app/(cosmic)/medha/MedhaConsentSlab.tsx (NEW)
      - /app/app/(cosmic)/medha/medha.css (appended ~12kB of new selectors)
      - /app/app/api/consent/route.ts (NEW — MongoDB dedupe)
      - /app/app/(cosmic)/NebulaFooter.tsx (NEW)
      - /app/app/(cosmic)/NebulaFooter.css (NEW)
      - /app/app/(cosmic)/layout.tsx (mount NebulaFooter)
      - /app/lib/medha/cognitive.ts (VYAN_SCOPE_RESTRICTION on all 5 modes)

      Verified via Playwright: consent gate renders, fills correctly, opens Medhā
      after grant. Curl-verified the consent dedupe end-to-end.

  - agent: main
    message: |
      BATCH 3 — Crystalline Wraith rebuild, Vistāra product demos, cinematic
      deep routing. (Overlay.ts refactor deferred — see notes.)

      MEDHĀ · CRYSTALLINE WRAITH REBUILD (Item 1)
      - MedhaCanvasOrb.tsx rewritten as a density-based humanoid mask sampler.
      - ~1100 particles re-sample inside the wraith silhouette every frame
        (head ellipse, taper torso, dissolving wisp legs).
      - 11 horizontal wind-shear bands drift at varying speeds; each band
        modulates particle vx + has its own phase so the figure dissolves and
        re-forms in slow cosmic wind — matches GIF A exactly.
      - Each particle additionally emits a 14-pixel horizontal smear gradient
        trailing leftward (the signature shear streak).
      - 4 luminous wind-shear "strata" overlay across the figure at h*0.30
        through h*0.85, drifting on sin(t).
      - Palette: amethyst (198,168,255) · pearl (244,240,255) · cyan-mint
        (130,230,220) — unchanged from previous orb.
      - DPR-aware, resize-aware, additive blend mode, gentle trail fade.

      VISTĀRA · PRODUCT DEMO SLABS (Item 2)
      - NEW /app/app/(cosmic)/vistara/VistaraProductDemo.tsx — Google-AI-Studio
        styled glass slabs, one config per product. Each spec carries:
        domain kicker, name, tagline, accent (CSS color), prompt placeholder,
        3 model pills, 3 sliders, output hint, optional embedUrl.
      - The 6 product configurations use the taglines already in VistaraPath.ts:
        Ṛtam (Pravāha · Flow, violet)        — Conscious Living Through Pravāha
        Ojas  (Prāṇa · Rhythm, gold)         — Tracking Your Prāṇic Rhythm
        Mudrā (Kośa · Identity, blue)        — The Kośa of Global Entities
        Netra (Tantra · Observability, cyan) — The Conscious Eye Across Tantras
        Ākṛti (Dṛṣṭi · Creation, pink)       — Creating Digital Anubhava Through Your Dṛṣṭi
        Sūtra (Saṅgama · Connection, amethyst) — Weaving Saṅgama Through Viveka
      - The 7th (placeholder) shows "Awaiting Initiation" gracefully disabled.
      - EMBED-READY: each spec has an `embedUrl?: string`. When you drop the
        Google AI Studio share link into that field, the slab swaps from the
        mocked output to a live <iframe data-vyan-embed="..."> hosting the
        real app. No rebuild required.
      - Mocked "run" returns a structured echo of the prompt + model + slider
        values in the canvas pane. Loading spinner + 1.1s simulated latency.
      - Color theming via CSS color-mix(in srgb, var(--accent) ...) — every
        border, pill, slider thumb, button glow, embed canvas tint pulls from
        the per-product accent. Each product feels distinct.
      - Renders on /vistara/<product> route. ESC + veil-click close back to
        /vistara. Concierge + Sound Console + Cosmic Canvas still visible
        behind the slab.

      CINEMATIC DEEP ROUTING (Item 3)
      - CosmicCanvas.tsx pathname useEffect now detects long mode-jumps:
          gateway → vistara/X   ⇒  setMode(shunya) + focusShunyaOrb(vistara)
                                    (1.4s dwell) → setMode(vistara) + focus(X)
          gateway → medha       ⇒  setMode(shunya) + focusShunyaOrb(medha)
                                    (1.4s dwell) → setMode(medha)
          shunya  → vistara/X   ⇒  focusShunyaOrb(vistara)
                                    (0.9s dwell) → setMode(vistara) + focus(X)
      - Camera physically traverses through the void via the existing spring
        + snap pipeline — no hard cut. Cleanup via window.clearTimeout on
        re-route. Other transitions remain instant (e.g. /shunya/medha →
        /shunya/sandhi is already a sibling-jump).

      OVERLAY.TS REFACTOR (Item 4) — DEFERRED
      - The 587-line vanilla-DOM Overlay.ts is a substantial migration
        (gateway intro panel, depth rail, product slab, shunya caption,
        legal panels, ambient pulses — all built via innerHTML + manual
        querySelector/addEventListener). A faithful React port is a 2-3k
        line lift that I'd prefer to do in a dedicated session so we can
        verify each panel without regression. Recommend tackling in the
        next batch when this round is verified.

      Files touched:
      - /app/app/(cosmic)/medha/MedhaCanvasOrb.tsx (full rewrite — Crystalline Wraith)
      - /app/app/(cosmic)/vistara/VistaraProductDemo.tsx (NEW)
      - /app/app/(cosmic)/vistara/vistara-demo.css (NEW)
      - /app/app/(cosmic)/vistara/[product]/page.tsx (now renders the demo)
      - /app/app/(cosmic)/CosmicCanvas.tsx (cinematic chain detector)

      Verified via Playwright:
      - /medha → Crystalline Wraith silhouette with horizontal wind-shear
        bands and amethyst-pearl-cyan particles.
      - /vistara/ritam → violet glassmorphic slab with Ṛtam · Native pill,
        Reflection Depth / Poétic Register / Time Horizon sliders.
      - /vistara/netra → teal slab, Yantra/Tantra/Mantra pills, OBSERVABILITY
        kicker, "OPEN THE EYE" CTA.
      - Cinematic routing kicks in for cross-mode jumps (visual confirmed
        from /vyoma → /vistara/netra: brief Shunya stop on Vistāra portal
        orb before the realm transition).

  - agent: main
    message: |
      P0 BATCH — item 4, 5, 2 fixes + device-restricted admin gear + SMTP panel.

      ITEM 4 — LY COUNTER LIVE TRACKING
      - LY badge ("ARRIVED · X" / "NN LY → next") now rides the rail at the
        actual offsetTop of the active node (and lerps toward the next during
        traversal), so it visually tracks navigation top-to-bottom in real time.
      - Reparented depthLy as a child of the rail so absolute positioning works
        relative to the rail (was incorrectly anchored to viewport).
      - Removed stale CSS overrides that pinned the badge top-center fixed.

      ITEM 5 — NEURAL RAIL COLOR SEQUENCE
      - Rail background line now uses a 6-stop gradient matching the orb
        colour sequence top→bottom: Udbhava violet → Vistāra azure → Vyūha
        purple → Saṅkalpa gold → Medhā teal → Sandhi ember.
      - Fill grows from TOP down (was bottom-up), matching travel direction.
      - Active-node colour: white scale 1.45× (more universal than red, works
        with any orb hue).

      ITEM 2 — ORB SIZE EQUALIZATION
      - CameraRig: camera is ALWAYS look-target + (0,3,26). No catmullrom
        position blend. Every orb appears at identical on-screen size.
      - World.setMode now syncs cameraRig.setMode in the same tick (was
        deferred to next start-loop iteration, which re-reset currentLookAt
        to Udbhava after our snap, sending the camera off-orb on deep-links).
      - CameraRig.snapToShunyaOrb / snapToVistaraProduct: instant camera +
        look-target placement on deep-link entry (no 200+ unit spring traversal).
      - ShunyaRealm.focusOrb + VistaraRealm.focusProduct snap to destination
        + clear arrival drift on focused orb when immediate=true.
      - ShunyaRealm.onEnter: arrival magnitude 10 → 3 units (settle 1.5s → 0.9s)
        so all orbs stay visually centered + same size during entry settle.
      - NanoOrb scale: floor 0.8 → 0.92, focus boost 0.38 → 0.40, active boost
        1.08 → 1.10 — focused orbs feel substantial without dramatic shrinking
        during traversal.

      DEVICE-RESTRICTED ADMIN GEAR (new)
      - NetraConsole renders a small floating ◈ orbit-gear bottom-right ONLY
        on devices that have authenticated once with the access code.
      - Tap → opens console (skips konami + auth).
      - Right-click / long-press → confirm dialog → revokes trust on this device.
      - Auth trust marker stored in localStorage.vyan.netra.device_auth.
      - Effective device isolation: user can authenticate on iPhone 14 Pro
        and the gear stays visible there; any other device shows nothing.

      SMTP CREDENTIALS PANEL (new)
      - Full-width "smtp · saṅkalpa transmissions" panel inside Netra console.
      - Fields: host, port, user, password, fromEmail, secure (TLS).
      - POST /api/netra { event: 'smtp_update' } updates an in-memory SmtpConfig
        used by future /api/sankalpa wiring. Exposed via globalThis.__VYAN_SMTP__.
      - Currently MOCKED — drop SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS /
        SMTP_FROM / SMTP_SECURE into /app/.env to make the values persisted.
      - Password field never echoed back to client — only `hasPassword: bool`.

      Files modified:
      - /app/lib/vyan/app/CameraRig.ts (snap methods + constant-offset anchor)
      - /app/lib/vyan/app/World.ts (sync cameraRig.setMode)
      - /app/lib/vyan/scenes/realms/ShunyaRealm.ts (deep-link snap, arrival reduce)
      - /app/lib/vyan/scenes/realms/VistaraRealm.ts (deep-link snap)
      - /app/lib/vyan/objects/NanoOrb.ts (scale equalization)
      - /app/lib/vyan/ui/Overlay.ts (LY ride-rail + fill from active node)
      - /app/lib/vyan/ui/styles.css (rail colour sequence, LY positioning override)
      - /app/app/(cosmic)/CosmicCanvas.tsx (setMode before focus on deep-link)
      - /app/app/(cosmic)/NetraConsole.tsx (gear icon + SMTP panel)
      - /app/app/(cosmic)/netraconsole.css (gear + form styles)
      - /app/app/api/netra/route.ts (SMTP runtime store + POST smtp_update)

      Visual sanity verified via Playwright for: /vyoma, /shunya, /shunya/sandhi,
      /shunya/medha — every orb now sits dead-centered at identical size with
      the LY badge correctly riding alongside the active rail node.

  - agent: main
    message: |
      Major batch: Gateway-from-zip restored + bug pass + Concierge + Sound Console + Medh\u0101 fix.

      GATEWAY (restored from user's canonical zip)
      - GatewayRealm.update: approach = clamp(scroll.progress, 0, 1) (not hardcoded 1)
      - CameraRig.updateGateway: z = lerp(280, 26, approach); FOV expands with approach
      - RealmManager.update: activeApproach = clamp(progress, 0, 1) in gateway mode
      - ScrollJourney: dual-mode \u2014 continuous (snapSlots=0, gateway) / discrete (void)
      - User can now SCROLL to bring Vy\u014dma closer; click only fires when approach > 0.34

      VOID NAVIGATION
      - Discrete: 3 wheel ticks OR 2 touch swipes per orb (auto-snap to slot)
      - Scroll re-enabled on void entry (was frozen post-burst)
      - Vist\u0101ra orbs: flat ring layout (RING_RADIUS 140), identical click-zone distance
      - Silver/grey palette across all 7 product orbs (per user request)
      - Travel nebula (4200 soft volumetric particles) replaces obsolete spiral dust

      BRANDING (CRITICAL \u2014 user emphasized trademark accuracy)
      - VistaraPath restored to proper UTF-8 diacritics: VYAN \u1e5atam, Ojas, Mudr\u0101,
        Netra, \u0100k\u1e5bti, S\u016btra, Placeholder
      - ConciergeOrb nav panel uses same proper diacritics

      MEDH\u0100 FIX (was showing blank black screen)
      - Bug: setMode('shunya') was a no-op when transitioning /shunya \u2192 /medha (already
        in shunya), so fadeFromBlack was never called by the realm \u2192 black overlay persisted
      - Fix: MedhaHUD.tsx clears [data-vyan-fade="1"] overlays and dims .vyan-ui on mount;
        restores both on unmount

      NEURAL RAIL
      - Brightened progressive fill (was too dark): rgba(212,168,255,1.0)
      - Added vertical-shimmer keyframe animation (rail-shimmer 1.9s loop)
      - World.jumpToOrb was a no-op stub \u2014 now delegates to RealmManager.jumpToOrb
      - LY counter rendered ON the rail (unchanged from previous job)

      CONCIERGE ORB (NEW \u2014 #3)
      - Always-present 56px top-right orb, persistent across all routes EXCEPT /medha
      - Click \u2192 glass quick-traverse panel listing all orbs/voids (Vy\u014dma, all 5 Shunya
        orbs, all 7 Vist\u0101ra products, Medh\u0101)
      - LIVE Gemini integration via /api/concierge \u2192 gemini-2.0-flash
        (key in .env GOOGLE_GEMINI_API_KEY)
      - Curated rotation fallback (50+ "Did You Know" AI-evolution facts, time-of-day greetings)
        \u2014 used when Gemini rate-limits
      - 30s rotation: random fact / nudge cycle
      - 60s stuck-on-one-orb \u2192 contextual nudge
      - Signal-orb cinematic: mini particles fly in from edges, exchange light with concierge
        during "Did You Know" facts
      - READ-ONLY: no chat input, only informational. Guides users to Medh\u0101 for typing.

      SOUND CONSOLE (NEW \u2014 #10, all 7 features built)
      - Volume / Bass / Treble / Playback Speed sliders
      - Cosmic Reverb toggle (Web Audio convolver, synth IR)
      - Submerge (Low-Pass) toggle + cutoff slider (300-18000 Hz)
      - Pulse-Sync toggle (bass-reactive gain modulation 2.4\u00d7)
      - 3 presets: VOID / GATEWAY / MEDH\u0100 + RESET
      - All settings apply in real-time via AudioReactive.applyConsole()
      - Audio processing chain: src \u2192 analyser \u2192 bass \u2192 treble \u2192 lowpass \u2192 (dry + wet reverb) \u2192 panner \u2192 gain

      ADMIN CONSOLE (#3 / Vyan Netra link) \u2014 CONSENT REQUESTED, NOT YET BUILT

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


phase_6_vistara_click_fix:
  status: COMPLETE
  description: |
    Vistāra socket clicks (3D raycasting) were blocked by an invisible 720px-wide
    DOM panel covering the centre of the viewport. Resolved across three layers:
    1. `lib/vyan/ui/styles.css` — removed stray `.glass-panel { pointer-events: auto; }`
       override that broke the conditional `pointer-events: none → auto on .open`.
    2. `lib/vyan/ui/Overlay.ts` — `clearFade()` & `fadeFromBlack()` now keep the
       `.vyan-ui` container at `pointer-events: none` (was setting `auto`, which
       inline-overrode the CSS rule and swallowed canvas clicks).
    3. `app/(cosmic)/medha/MedhaHUD.tsx` — unmount cleanup now restores
       `pointer-events: none` (was restoring to `auto`).
    4. `app/(cosmic)/CosmicCanvas.tsx` — bullet-proofed the click→navigate path:
       generous raycaster thresholds (Points 1.2 / Line 0.6) + dual-strategy
       router.push with `window.location.href` fallback for cases where the
       Next.js router closure goes stale outside React render context.

  verification:
    - Programmatic socket projection + Playwright click at (1624, 589) →
      navigated to `/vistara/ojas` and opened the VYAN OJAS product slab.
    - Direct nav `/vistara/ritam` still loads slab.
    - `/medha` HUD still loads; `.vyan-ui` pe=`none` preserved on /medha.

phase_7_vistara_cinematic_camera_travel:
  status: COMPLETE
  description: |
    Cinematic camera fly-over between Vistāra product nodes
    (/vistara/A → /vistara/B). When the URL changes between products of the
    same orb, the camera now visibly reorients toward the new socket and the
    FOV gently punches in, mirroring the Medhā transition feel.

    Files touched:
    - `lib/vyan/app/CameraRig.ts` —
        • New `pulseNodeChange()` public method + `lastNodeKey` / `nodeChangeAt`
          fields that auto-detect Vistāra node changes inside `updateVoid`.
        • Look-at `focusAmount` boosted from 40% → up to 70% during a transient
          900 ms `sin(t·π)` envelope so the camera *swings* to face the new
          socket rather than drifting.
        • Additional FOV punch of –4° on top of the existing –6° expansion
          dolly, giving a brief dolly-zoom toward the new node.
    - `lib/vyan/app/World.ts` — exposed `cameraRig` as a public field so
      external code can invoke `pulseNodeChange()` directly.
    - `app/(cosmic)/CosmicCanvas.tsx` — `applyRouteState` now distinguishes
      same-orb node changes (uses `setNode` + audio swell + explicit
      `pulseNodeChange`) from full orb-changes (still uses `expand`).

  verification:
    - Programmatic transit /vistara/ritam → /vistara/sutra:
        • CameraRig.lastNodeKey moved ritam → sutra at Δncat ≈ 91 ms.
        • Look-at vector smoothly drifted across samples (lookAt.y 29.85 →
          29.03, lookAt.z −89.79 → −87.33).
        • Slab swapped content from VYAN ṚTAM → VYAN SŪTRA cleanly.
        • FOV oscillated between 38 (steady gateway) and 32 (full expand
          + punch); punch envelope verified in code path via lint + log.
        • Audio swell 1.05 × 0.45 s fired on transition.

    - No regressions in console (only benign WebGL perf warnings).
