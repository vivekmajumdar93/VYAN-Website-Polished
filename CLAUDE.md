# VYAN Website — Claude Code Instructions

## Version History — MANDATORY

**Every meaningful commit must update `lib/versions.ts`.**

This is not optional. The version badge and history panel (`components/VersionPanel.tsx`) are user-facing — they must always reflect the actual state of the site.

### Rules

1. **Before pushing any feature, fix, or UX change**, add a new entry at the TOP of `SITE_VERSIONS` in `lib/versions.ts` and bump `CURRENT_VERSION`.
2. Use semantic versioning: increment the minor number (1.5 → 1.6) for features/UX changes, patch (1.5 → 1.5.1) for small fixes.
3. The `gitHash` field must be the real 7-char hash of the commit being tagged — get it with `git rev-parse --short HEAD` after committing.
4. The `date` field must be today's date in `YYYY-MM-DD` format.
5. `pages` must list every page/system touched (e.g. `['Vistara', 'All pages']`).
6. `changes` must be a honest bullet list — what actually changed, not what was intended.

### Template

```ts
{
  version: 'X.Y',
  date: 'YYYY-MM-DD',
  title: 'Short release name',
  summary: 'One or two sentences describing what this release is.',
  changes: [
    'Specific thing that changed',
    'Another specific thing',
  ],
  gitHash: 'abc1234',   // git rev-parse --short HEAD
  pages: ['PageName'],
},
```

### Workflow

```bash
# 1. Make and commit your changes
git commit -m "feat: ..."

# 2. Get the hash
git rev-parse --short HEAD

# 3. Update lib/versions.ts with new entry + bump CURRENT_VERSION
# 4. Commit the version bump separately
git add lib/versions.ts
git commit -m "chore: bump to vX.Y"

# 5. Push
git push
```

---

## Project Structure

- `app/(cosmic)/` — pages and shared cosmic-layout components (SoundConsole, NebulaFooter, etc.)
- `components/vistara/VistaraVoid.tsx` — entire Vistara 3D page (R3F, Saturn rings, orbs, panels)
- `components/VersionPanel.tsx` — version badge + history panel (site-wide)
- `lib/versions.ts` — version registry (source of truth for the panel)
- `lib/vistara/gateways.ts` — gateway/orb definitions (add new orbs here)
- `public/` — orb icon images

## Key Technical Notes

- **touch-action: none** is set globally on `html, body` in `globals.css`. Any scrollable DOM element needs JS touch handlers (`onTouchStart`/`onTouchMove` updating `scrollTop` manually) — CSS `touch-action: pan-y` alone will not work.
- **SoundConsole external toggle**: dispatch `new Event('vyan:sound-toggle')` on `window` to open/close it from anywhere.
- **NebulaFooter z-index: 9100** — sits above all panels. Do not lower it below the GlassPanel z-index (200).
- **Shooting stars**: 2 max, 45-second cycle. Controlled in `VistaraVoid.tsx` constants `SS_N` and `SS_TN`.
- **Saturn rings**: shader in `SATURN_VERT`/`SATURN_FRAG`. Particle count and size in `createSaturnRingGeo`.
- **Adding a new orb**: add to `GATEWAYS` in `lib/vistara/gateways.ts`, add size to `ORB_SIZES`, add config to `ORB_CFG` in `VistaraVoid.tsx`.
