'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import '../../lib/vyan/ui/styles.css';

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
  if (pathname === '/vyoma' || pathname === '/') return 'gateway';
  return 'shunya';
}

async function applyRouteState(pathname: string | null, _isInitial = false) {
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
    if (targetOrb === 'medha')   app.focusShunyaOrb?.('medha', true);
    else if (targetOrb === 'vistara') app.focusShunyaOrb?.('vistara', true);
    else if (seg) app.focusShunyaOrb?.(seg, true);
  }

  if (targetOrb) {
    const spectrum = targetOrb === 'vistara' && seg && seg !== 'placeholder'
      ? (m.VISTARA_SPECTRUM[seg] ?? 'crimson')
      : 'crimson';

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
          if (key === 'medha') router.push('/medha');
          else if (key === 'vistara') router.push('/vistara');
          else router.push(`/shunya/${key}`);
        },
        onEnterVistara: () => { router.push('/vistara'); },
        onEnterMedha:   () => { router.push('/medha'); },
      });
      appInstance.start();
      (window as any).__vyan = appInstance;
      (window as any).__vyan.audio = appInstance.audioEngine;
      (window as any).__vyanRouter = router;

      const THREE = await import('three');
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();

      const onDomClick = async (ev: MouseEvent) => {
        try {
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
          (raycaster.params as any).Points = { threshold: 1.2 };
          (raycaster.params as any).Line   = { threshold: 0.6 };
          const hits = raycaster.intersectObjects(focused.socketGroup.children, true);
          const productHit = hits.find((h: any) =>
            h.object?.userData?.isProductSocket && h.object?.userData?.productKey,
          );

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
            const navTarget = orbKey === 'medha' ? `/medha?model=${productKey}` : `/vistara/${productKey}`;
            try { app.audioEngine?.swell?.(1.06, 0.25); } catch {}
            try {
              const freshRouter = (window as any).__vyanRouter ?? router;
              freshRouter.push(navTarget);
              setTimeout(() => {
                if (window.location.pathname + window.location.search !== navTarget) {
                  window.location.href = navTarget;
                }
              }, 250);
            } catch { window.location.href = navTarget; }
            return;
          }

          // ── Outside-click panel close ───────────────────────────────────────
          // CRITICAL BUG FIX: closing a Vistāra product panel via outside-click
          // previously called router.push('/vistara') which triggered
          // applyRouteState → focusShunyaOrb('vistara') → camera traversed
          // through Udbhava (index 0) before landing on Vistāra.
          //
          // The fix: use ix.closeWithoutNavigation() which resets the node state
          // WITHOUT triggering any camera movement or navigation — the camera is
          // already looking at Vistāra orb, we just need to collapse the panel.
          try {
            const path = window.location.pathname;
            const onVistaraProduct = /^\/vistara\/[^/]+$/.test(path);
            const clickedSlab = !!target?.closest(
              '.vpd-slab, .vpd-veil > *:not(canvas), .mlv-modal, .mlv-composer, .mlv-orb-pane, ' +
              '.mlv-thread, .glass-panel.open, .mcc-veil, .medha-quota-lock, ' +
              '.gateway-info-panel.open, .sound-panel-overlay.open, .sound-card, ' +
              '.vac-root.is-open, .sc-root, .concierge-root, .concierge-nav, ' +
              '.neural-depth, [data-vyan-keepopen="1"]',
            );
            if (!clickedSlab && onVistaraProduct) {
              // Close panel without navigating — no Udbhava traversal
              const ixMod = await import('../../lib/vyan/state/InteractionState');
              ixMod.getInteractionStore().closeWithoutNavigation();
              // Then navigate to /vistara without triggering focusShunyaOrb
              const freshRouter = (window as any).__vyanRouter ?? router;
              try { freshRouter.push('/vistara'); } catch { window.location.href = '/vistara'; }
            }
          } catch {}
        } catch (err) {
          (window as any).__vyanLastClickError = String(err);
        }
      };
      rootEl?.addEventListener('click', onDomClick);
      (window as any).__vyanDomClick = onDomClick;

      // ── Document-level outside-click closer (belt-and-braces) ──────────────
      // Same fix applied here: use closeWithoutNavigation to avoid the
      // Udbhava navigation bug.
      const onDocClickOutside = async (ev: MouseEvent) => {
        try {
          const t = ev.target as HTMLElement | null;
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
            // FIX: close without camera navigation instead of router.push('/vistara')
            import('../../lib/vyan/state/InteractionState').then(ixMod => {
              ixMod.getInteractionStore().closeWithoutNavigation();
            }).catch(() => {});
            const freshRouter = (window as any).__vyanRouter ?? router;
            try { freshRouter.push('/vistara'); } catch {}
            setTimeout(() => {
              if (window.location.pathname !== '/vistara') {
                window.location.href = '/vistara';
              }
            }, 250);
          }
        } catch {}
      };
      document.addEventListener('click', onDocClickOutside, true);
      (window as any).__vyanDocClickOutside = onDocClickOutside;

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
