'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import '../../lib/vyan/ui/styles.css';

// Singleton VYAN app reference, persists across child-route navigations.
let appInstance: any = null;
let rootEl: HTMLDivElement | null = null;
let appReadyResolvers: Array<() => void> = [];
let appReady = false;
function whenAppReady(): Promise<void> {
  if (appReady) return Promise.resolve();
  return new Promise<void>(res => { appReadyResolvers.push(res); });
}

function modeFromPath(pathname: string | null): 'gateway' | 'shunya' {
  if (!pathname) return 'gateway';
  // PHASE 1 in-place architecture: every route except /vyoma renders the
  // Shunya field. /vistara/* and /medha are now URL aliases that focus a
  // Shunya orb + expand it in-place (driven via InteractionState).
  if (pathname === '/vyoma' || pathname === '/') return 'gateway';
  return 'shunya';
}

// Apply the in-place focus + expand for a given pathname. Idempotent.
async function applyRouteState(pathname: string | null, isInitial = false) {
  if (!appInstance) return;
  const app = appInstance;
  const seg = pathname?.split('/')[2];
  const m = await import('../../lib/vyan/state/InteractionState');
  const ix = m.getInteractionStore();

  const isMedha   = pathname === '/medha' || pathname?.startsWith('/medha/');
  const isVistara = pathname === '/vistara' || pathname?.startsWith('/vistara/');
  const targetOrb: 'medha' | 'vistara' | null = isMedha ? 'medha' : isVistara ? 'vistara' : null;

  const targetMode = (pathname === '/vyoma' || pathname === '/' || !pathname) ? 'gateway' : 'shunya';
  if (app.getMode?.() !== targetMode) app.setMode(targetMode);

  if (targetMode === 'shunya') {
    if (targetOrb === 'medha') app.focusShunyaOrb?.('medha', true);
    else if (targetOrb === 'vistara') app.focusShunyaOrb?.('vistara', true);
    else if (seg) app.focusShunyaOrb?.(seg, true);
  }

  if (targetOrb) {
    const spectrum = targetOrb === 'vistara' && seg && seg !== 'placeholder'
      ? (m.VISTARA_SPECTRUM[seg] ?? 'crimson')
      : 'crimson';

    // PHASE 6 — same-orb node-change cinematic. When the user navigates from
    // /vistara/A → /vistara/B (same orb, different product socket), use
    // setNode (instant) instead of expand (full tween) and fire an audio
    // swell so the camera's FOV-punch + look-at swing feels synchronized.
    const cur = ix.get();
    const nextNodeKey = targetOrb === 'vistara' ? (seg ?? null) : null;
    if (cur.target === targetOrb && cur.phase !== 'dormant') {
      if (cur.node !== nextNodeKey) {
        ix.setNode(nextNodeKey, spectrum);
        try { app.audioEngine?.swell?.(1.05, 0.45); } catch {}
        try { app.worldRef?.cameraRig?.pulseNodeChange?.(); } catch {}
      } else if (spectrum && cur.spectrum !== spectrum) {
        ix.setSpectrum(spectrum);
      }
    } else {
      ix.expand(targetOrb, nextNodeKey, spectrum);
      // PHASE 8 — also fire the cinematic pulse on first expand so the
      // initial transition into a product (deep-link OR first click into
      // Vistāra) feels like an arrival rather than a passive load.
      try { app.audioEngine?.swell?.(1.05, 0.45); } catch {}
      try { app.worldRef?.cameraRig?.pulseNodeChange?.(); } catch {}
    }
  } else {
    ix.fold();
  }
}

export default function CosmicCanvas() {
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    rootEl = ref.current;

    let cancelled = false;
    (async () => {
      const { App } = await import('@/lib/vyan/app/App');
      if (cancelled || !rootEl) return;

      const initialMode = modeFromPath(pathname);

      try {
        router.prefetch('/vyoma');
        router.prefetch('/shunya');
        router.prefetch('/vistara');
      } catch {}

      appInstance = new App(rootEl, {
        skipIntro: true,
        initialMode,
        onEnterVoid: () => { router.push('/shunya'); },
        onOrbActivate: (key: string) => {
          // PHASE 2+5 in-place: Medhā + Vistāra get their own URLs and unfold
          // in-place via InteractionState. Other Shunya orbs route to /shunya/<key>.
          // Legacy onEnterVistara/onProductActivate callbacks removed — those
          // code paths are obsolete under the in-place architecture.
          if (key === 'medha') router.push('/medha');
          else if (key === 'vistara') router.push('/vistara');
          else router.push(`/shunya/${key}`);
        },
        onEnterVistara: () => { router.push('/vistara'); },
        onEnterMedha:   () => { router.push('/medha');   },
      });
      appInstance.start();
      (window as any).__vyan = appInstance;
      (window as any).__vyan.audio = appInstance.audioEngine;
      // Expose router for in-canvas socket clicks (Vistāra product nodes).
      (window as any).__vyanRouter = router;

      // PHASE 3 v3 — direct DOM click handler that raycasts against the
      // focused orb's socket dots at the EXACT click moment + coordinates.
      // This is more reliable than the polling `interaction.clicked` flag
      // (which can miss the click if the orb has drifted between frames).
      const THREE = await import('three');
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const onDomClick = (ev: MouseEvent) => {
        try {
          // Ignore clicks on UI overlays (panels, buttons, console).
          const target = ev.target as HTMLElement | null;
          if (target?.closest('.vpd-slab, .mlv-modal, .concierge-nav, .sc-panel, .mlv-composer, .mlv-orb-pane, button')) return;
          const app: any = appInstance;
          const w = app?.worldRef;
          const shunya = w?.realms?.shunya;
          if (!shunya || !w?.camera) return;
          const focused = shunya.orbs?.[shunya.activeIndex];
          if (!focused?.socketGroup?.children?.length) return;
          ndc.x = (ev.clientX / window.innerWidth) * 2 - 1;
          ndc.y = -((ev.clientY / window.innerHeight) * 2 - 1);
          raycaster.setFromCamera(ndc, w.camera);
          // Generous click radius for the tiny dots — increase the Points
          // threshold and ensure hit-spheres at depth match.
          (raycaster.params as any).Points = { threshold: 1.2 };
          (raycaster.params as any).Line = { threshold: 0.6 };
          const hits = raycaster.intersectObjects(focused.socketGroup.children, true);
          const productHit = hits.find((h: any) =>
            h.object?.userData?.isProductSocket && h.object?.userData?.productKey,
          );
          // Diagnostic trace — exposed for testing scripts and removed via
          // window.__vyanClickTrace=false in prod.
          if ((window as any).__vyanClickTrace !== false) {
            (window as any).__vyanLastClick = {
              x: ev.clientX, y: ev.clientY,
              hits: hits.length,
              productHit: !!productHit,
              productKey: productHit ? (productHit as any).object.userData.productKey : null,
              socketCount: focused.socketGroup.children.length,
              ndc: { x: ndc.x, y: ndc.y },
            };
          }
          if (productHit) {
            const productKey = (productHit as any).object.userData.productKey as string;
            const orbKey = shunya.defs?.[shunya.activeIndex]?.key;
            const target = orbKey === 'medha' ? `/medha?model=${productKey}` : `/vistara/${productKey}`;
            try { app.audioEngine?.swell?.(1.06, 0.25); } catch {}
            // PHASE 6: dual-strategy navigation. The cosmic canvas's click
            // handler runs OUTSIDE React's render context (it's attached
            // directly to the DOM in a useEffect with empty deps), so
            // router.push() captures a stale closure and silently no-ops.
            // We use the fresh router on window + a hard-fallback to
            // guarantee navigation.
            try {
              const freshRouter = (window as any).__vyanRouter ?? router;
              freshRouter.push(target);
              // Belt-and-braces: if the route hasn't committed within a beat,
              // fall through to a native nav. This is silent if router.push
              // already worked.
              setTimeout(() => {
                if (window.location.pathname + window.location.search !== target) {
                  window.location.href = target;
                }
              }, 250);
            } catch {
              window.location.href = target;
            }
            return;
          }

          // PHASE 8 (item #2 outside-click close) — if a Vistāra or Medhā
          // slab is currently open AND the click did NOT land on a product
          // socket AND the target wasn't the slab itself, close the slab by
          // routing back to the parent orb.
          try {
            const path = window.location.pathname;
            const onVistaraProduct = /^\/vistara\/[^/]+$/.test(path);
            const onMedha = path === '/medha' || path.startsWith('/medha/');
            const clickedSlab = !!target?.closest('.vpd-slab, .mlv-modal, .mlv-composer, .mlv-orb-pane, .mlv-thread, .glass-panel.open, .mcc-veil, .medha-quota-lock, .gateway-info-panel.open, .sound-panel-overlay.open, .sound-card, .vac-root.is-open, .sc-root, .concierge-nav');
            if (!clickedSlab && onVistaraProduct) {
              const freshRouter = (window as any).__vyanRouter ?? router;
              try { freshRouter.push('/vistara'); }
              catch { window.location.href = '/vistara'; }
            }
            // For /medha we do NOT auto-close because Medhā IS the page
            // (not a slab) — closing it would force the user to redo consent.
          } catch {}
        } catch (err) {
          (window as any).__vyanLastClickError = String(err);
        }
      };
      rootEl?.addEventListener('click', onDomClick);
      (window as any).__vyanDomClick = onDomClick;

      // PHASE 8b (item #2) — independent document-level outside-click
      // closer for Vistāra product slabs. Decoupled from the canvas raycast
      // path because some click targets never reach #vyan-root in capture
      // (e.g. clicks land directly on .vyan-ui UI children that re-enable
      // pointer-events). This handler fires on the document and closes the
      // open product slab when the click is NOT on the slab itself or any
      // interactive overlay.
      const onDocClickOutside = (ev: MouseEvent) => {
        try {
          const t = ev.target as HTMLElement | null;
          // Allow normal interaction with: the slab itself, any open modal,
          // top-level controls (concierge nav/orb, sound console, gateway
          // info, neural rail), and any explicit interactive ancestor that
          // sets data-vyan-keepopen="1".
          const keep = t?.closest(
            '.vpd-slab, .vpd-veil > *:not(canvas), .mlv-modal, .mlv-composer, .mlv-orb-pane, .mlv-thread, ' +
            '.glass-panel.open, .mcc-veil, .medha-quota-lock, .gateway-info-panel.open, ' +
            '.sound-panel-overlay.open, .sound-card, .vac-root.is-open, .sc-root, ' +
            '.concierge-root, .concierge-nav, .neural-depth, [data-vyan-keepopen="1"]',
          );
          if (keep) return;
          const path = window.location.pathname;
          if (/^\/vistara\/[^/]+$/.test(path)) {
            (window as any).__vyanLastOutsideClose = { at: Date.now(), x: ev.clientX, y: ev.clientY };
            const freshRouter = (window as any).__vyanRouter ?? router;
            try { freshRouter.push('/vistara'); } catch {}
            // Belt-and-braces: same dual-strategy as the socket click —
            // router.push from outside React render context can silently
            // no-op, so fall back to a hard nav if the URL hasn't moved.
            setTimeout(() => {
              if (window.location.pathname !== '/vistara') {
                window.location.href = '/vistara';
              }
            }, 250);
          }
          // Medhā page is its own route — outside-click does not close it
          // (closing would force consent to be re-entered).
        } catch {}
      };
      document.addEventListener('click', onDocClickOutside, true); // capture phase so we beat slab-internal handlers
      (window as any).__vyanDocClickOutside = onDocClickOutside;

      // Apply the current route state — fires the in-place expansion if the
      // URL already points at /medha or /vistara/<product>.
      await applyRouteState(pathname);

      appReady = true;
      const rs = appReadyResolvers.slice();
      appReadyResolvers = [];
      for (const r of rs) try { r(); } catch {}
    })();

    return () => {
      cancelled = true;
      try {
        const dc = (window as any).__vyanDomClick;
        if (dc && rootEl) rootEl.removeEventListener('click', dc);
      } catch {}
      try {
        const doc = (window as any).__vyanDocClickOutside;
        if (doc) document.removeEventListener('click', doc, true);
      } catch {}
      try { appInstance?.destroy?.(); } catch {}
      if (rootEl) rootEl.innerHTML = '';
      try { delete (window as any).__vyan; } catch {}
      try { delete (window as any).__vyanExpansion; } catch {}
      try { delete (window as any).__vyanAnchor; } catch {}
      appInstance = null;
      rootEl = null;
      appReady = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PHASE 1+2 routing — in-place orb expansion. Waits for the App to finish
  // booting before applying state so deep-links land in the correct phase.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await whenAppReady();
      if (cancelled) return;
      await applyRouteState(pathname);
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  return <div id="vyan-root" ref={ref} />;
}
