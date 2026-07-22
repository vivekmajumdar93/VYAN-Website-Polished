# VYAN Website — Change Progress Log

> **RULE**: Read this file before starting any new prompt. Mark tasks locked (🔒) once verified correct. Never re-break a locked item.

---

## Current Version: v2.8

---

## 🔒 LOCKED — Do Not Touch

| Area | Status | Notes |
|------|--------|-------|
| AcousticConsole removed from layout | 🔒 LOCKED | Was duplicate of SoundConsole. Only SoundConsole in layout.tsx now. |
| Custom cursor mobile guard | 🔒 LOCKED | `hasFinePointer` check — cursor ring/dot hidden on touch devices |
| Fresnel rim removal | 🔒 LOCKED | All ORB_FRESNEL_VERT/FRAG/ref/mat/JSX deleted |
| Orb throw-toward-camera animation | 🔒 LOCKED | `throwRef` in VistaraOrb, sin-bell scale + position surge |
| Camera arc traversal between orbs | 🔒 LOCKED | `camTraverseRef` in GyroScene — pull-back + swoop, 1.35s |
| CentralVortex (particle disc) | 🔒 LOCKED | 480-particle disc with differential rotation, CORE_VERT/FRAG |
| EffectComposer/Bloom removed | 🔒 LOCKED | No postprocessing, no HDR, no halo |
| NebulaFooter z-index: 9100 | 🔒 LOCKED | Must stay ≥9100 — do not lower |

---

## 📋 Batch: July 22 2026 — 5 items

### 1. Panel Scroll Fix
- **Issue**: Scrolling inside GlassPanel scrolls the 3D orbs behind instead of the panel content
- **Root cause**: `e.stopPropagation()` on `onTouchMove` doesn't prevent R3F/OrbitControls from receiving pointer events; need `e.preventDefault()` and pointer-event blockers on the panel wrapper
- **Fix**: Add `onPointerDown/Move e.stopPropagation()` + `e.preventDefault()` on scrollable div; block all pointer events on the panel outer wrapper
- **Status**: ⬜ TODO

### 2. Version Badge + Overview Button Z-index
- **Issue**: Both are behind NebulaFooter (z-index 9100), unclickable
- **Version badge**: currently `zIndex: 9000` in VersionPanel.tsx line 40 → raise to `9200`
- **Overview button**: standalone fixed button in VistaraVoid.tsx (NOT the one inside GlassPanel) — find and raise
- **Fix**: Both to `zIndex: 9200`
- **Status**: ⬜ TODO

### 3. Ring Particles — Saturn-like, Crisp, Sub-pixel
- **Issue**: Particles too large/blurry, not like actual Saturn rings
- **Target**: 0.4–1.2px particles, hard-edge (sharp `step` disc not soft smoothstep), 12000/ring
- **Fix**: Update `createSaturnRingGeo` count, sizes; update SATURN_VERT gl_PointSize + SATURN_FRAG to hard disc
- **Status**: ⬜ TODO

### 4. Sound Console — Open & Functional
- **Issue**: Clicking the sound console trigger opens nothing
- **Root cause**: `.sc-root` z-index is 25 — panel expands but is behind canvas (need to check sc-panel z-index in CSS)
- **Fix**: Raise `sc-root` and expanded panel z-index above canvas layer
- **Status**: ⬜ TODO

### 5. Panel Header — Stark Red Name + Shimmer Tagline
- **Issue**: orb name (h2, line 1463 VistaraVoid) is white; tagline (p, line 1469) is orb color
- **Fix**:
  - Name h2: `color: '#ff2020'` (stark red), remove text-shadow
  - Tagline: deep-blue → dark-purple CSS gradient with left↔right shimmer animation alternating per orb
- **Status**: ⬜ TODO

---

## Version History

| Version | Date | Key changes |
|---------|------|-------------|
| v2.8 | 2026-07-22 | v1.9 ring shader restored (proportional sizing) |
| v2.7 | 2026-07-22 | Saturn rings dramatically more visible (too large — reverted in v2.8) |
| v2.6 | 2026-07-22 | Camera arc traversal between orbs |
| v2.5 | 2026-07-22 | Saturn rings restored (min 1px, disc fill) |
| v2.4 | 2026-07-21 | Duplicate AcousticConsole removed, cursor mobile fix, panel touch-scroll |
| v2.3 | 2026-07-21 | Core/ring halos stripped, Bloom removed |
| v2.2 | 2026-07-21 | CentralVortex replaced with particle disc |
| v2.1 | 2026-07-21 | Orb throw animation |
| v2.0 | 2026-07-21 | Fresnel rim removed |
| v1.9 | earlier | AcousticConsole added (later removed as duplicate) |
| v1.8 | earlier | Custom cursor, per-gateway panel content |
| v1.7 | earlier | 3D starfield, vortex, Fresnel rim |
