# VYAN Website — Change Progress Log

> **RULE**: Read this file before starting any new prompt. Mark tasks locked (🔒) once verified correct. Never re-break a locked item.

---

## Current Version: v2.9

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

### 1. Panel Scroll Fix — 🔒 LOCKED v2.9
- `onPointerDown/Move stopPropagation` added to panel slab div
- `e.stopPropagation()` + `e.preventDefault()` added to scrollable div's onTouchStart/Move

### 2. Version Badge + Overview Button Z-index — 🔒 LOCKED v2.9
- Version badge: `zIndex: 9000 → 9200` (VersionPanel.tsx)
- Overview button: `zIndex: 40 → 9200` (VistaraVoid.tsx line ~2045)
- Both above NebulaFooter's 9100

### 3. Ring Particles — 🔒 LOCKED v2.9
- 14000 particles/ring, 0.4–1.1px base size
- `gl_PointSize = clamp(aSize * 480/dist, aSize*0.9, aSize*2.2)` proportional
- Fragment: `step(r, 0.92)` hard disc — zero blur, zero halo
- Band edges concentrated (28% inner + 28% outer for banded look)

### 4. Sound Console — 🔒 LOCKED v2.9
- `sc-root` z-index raised `25 → 8500` (SoundConsole.css)
- Panel now opens above canvas, below footer

### 5. Panel Header Styling — 🔒 LOCKED v2.9
- Name h2: `color: '#e80010'` (stark red), text-shadow removed
- Tagline: `linear-gradient(90deg, #0a2fff → #88aaff → #cc99ff → #6600cc)`, `backgroundClip:text`
- Shimmer animates `background-position` L→R or R→L alternating by GATEWAYS index (even/odd)
- Keyframes `@tagShimmerLR` / `@tagShimmerRL` injected via `<style>` in GlassPanel return

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
