'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import '../../lib/vyan/ui/styles.css';

// Singleton VYAN app reference, persists across child-route navigations.
let appInstance: any = null;
let rootEl: HTMLDivElement | null = null;

function modeFromPath(pathname: string | null): 'gateway' | 'shunya' | 'vistara' {
  if (!pathname) return 'gateway';
  if (pathname.startsWith('/vistara')) return 'vistara';
  // /medha keeps the canvas in Shunya mode (background field) while the HUD overlays.
  if (pathname.startsWith('/medha')) return 'shunya';
  if (pathname.startsWith('/shunya')) return 'shunya';
  return 'gateway';
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

      // Prefetch the other cosmic routes — cascading background preload chain.
      try {
        router.prefetch('/vyoma');
        router.prefetch('/shunya');
        router.prefetch('/vistara');
      } catch {}

      appInstance = new App(rootEl, {
        skipIntro: true,
        initialMode,
        onEnterVoid: () => {
          router.push('/shunya');
        },
        onOrbActivate: (key: string) => {
          router.push(`/shunya/${key}`);
        },
        onEnterVistara: () => {
          router.push('/vistara');
        },
        onProductActivate: (key: string) => {
          router.push(`/vistara/${key}`);
        },
        onExitVistara: () => {
          router.push('/shunya/vistara');
        },
        onEnterMedha: () => {
          router.push('/medha');
        },
      });
      appInstance.start();
      (window as any).__vyan = appInstance;
      // Expose audio engine separately so the Sound Console can find it.
      (window as any).__vyan.audio = appInstance.audioEngine;

      // Apply initial focus immediately (snap) if route is deep-linked.
      // CRITICAL: setMode must run FIRST so ShunyaRealm.onEnter() (which
      // resets scroll to 0) doesn't clobber our focus snap. We force the
      // mode transition synchronously, then snap.
      if (initialMode === 'shunya') {
        if (appInstance.getMode?.() !== 'shunya') appInstance.setMode('shunya');
        const seg = pathname?.split('/')[2];
        if (seg) appInstance.focusShunyaOrb?.(seg, true);
      } else if (initialMode === 'vistara') {
        if (appInstance.getMode?.() !== 'vistara') appInstance.setMode('vistara');
        const seg = pathname?.split('/')[2];
        if (seg) appInstance.focusVistaraProduct?.(seg, true);
      }
    })();

    return () => {
      cancelled = true;
      try { appInstance?.destroy?.(); } catch {}
      if (rootEl) rootEl.innerHTML = '';
      try { delete (window as any).__vyan; } catch {}
      appInstance = null;
      rootEl = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mode + focus whenever pathname changes (without remounting).
  // CINEMATIC DEEP ROUTING: when the user makes a long mode-jump (e.g. from
  // /vyoma → /vistara/netra), we don't hard-cut. We chain through the
  // intermediate stages — Shunya focused on the Vistāra portal orb — so the
  // camera physically traverses the void before landing on the destination.
  // For Vyōma → Medhā we similarly stop at Shunya focused on the Medhā orb.
  useEffect(() => {
    if (!appInstance) return;
    const app = appInstance;
    const targetMode = modeFromPath(pathname);
    const currentMode = app.getMode?.();
    const seg = pathname?.split('/')[2];

    // Helpers — pure mode/focus application (no traversal).
    const applyFinal = () => {
      if (app.getMode?.() !== targetMode) app.setMode(targetMode);
      if (targetMode === 'shunya' && seg) app.focusShunyaOrb?.(seg);
      else if (targetMode === 'vistara' && seg) app.focusVistaraProduct?.(seg);
    };

    // Cinematic chain detection:
    //   gateway → vistara/X   ⇒  shunya:vistara  (1.4s)  →  vistara/X
    //   gateway → medha       ⇒  shunya:medha    (1.4s)  →  medha
    //   shunya  → vistara/X   ⇒  shunya:vistara  (0.9s)  →  vistara/X (if not already there)
    const needsChain =
      (currentMode === 'gateway' && (targetMode === 'vistara' || targetMode === 'medha')) ||
      (currentMode === 'shunya'  && targetMode === 'vistara' && seg);
    const chainStop =
      targetMode === 'vistara' ? 'vistara' :
      targetMode === 'medha'   ? 'medha'   :
      null;
    if (needsChain && chainStop) {
      // Step 1: go to Shunya and focus on the portal orb of the destination.
      if (app.getMode?.() !== 'shunya') app.setMode('shunya');
      app.focusShunyaOrb?.(chainStop);
      const dwell = currentMode === 'gateway' ? 1400 : 900;
      const t = window.setTimeout(applyFinal, dwell);
      return () => window.clearTimeout(t);
    }

    applyFinal();
  }, [pathname]);

  return <div id="vyan-root" ref={ref} />;
}
