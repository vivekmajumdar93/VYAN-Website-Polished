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
    ix.expand(targetOrb, targetOrb === 'vistara' ? (seg ?? null) : null, spectrum);
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
          // PHASE 2 in-place: Medhā + Vistāra get their own URLs and unfold
          // in-place via InteractionState. Other Shunya orbs route to /shunya/<key>.
          if (key === 'medha') router.push('/medha');
          else if (key === 'vistara') router.push('/vistara');
          else router.push(`/shunya/${key}`);
        },
        onEnterVistara: () => { router.push('/vistara'); },
        onProductActivate: (key: string) => { router.push(`/vistara/${key}`); },
        onExitVistara: () => { router.push('/shunya/vistara'); },
        onEnterMedha: () => { router.push('/medha'); },
      });
      appInstance.start();
      (window as any).__vyan = appInstance;
      (window as any).__vyan.audio = appInstance.audioEngine;

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
