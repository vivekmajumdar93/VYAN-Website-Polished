'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import '../../lib/vyan/ui/styles.css';

// Singleton VYAN app reference, persists across child-route navigations.
let appInstance: any = null;
let rootEl: HTMLDivElement | null = null;

function modeFromPath(pathname: string | null): 'gateway' | 'shunya' {
  if (!pathname) return 'gateway';
  // PHASE 1 in-place architecture: every route except /vyoma renders the
  // Shunya field. /vistara/* and /medha are now URL aliases that focus a
  // Shunya orb + expand it in-place (driven via InteractionState).
  if (pathname === '/vyoma' || pathname === '/') return 'gateway';
  return 'shunya';
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
          // PHASE 1: Medhā + Vistāra orbs get their own distinct URLs and
          // open in-place via InteractionState. Other Shunya orbs (Sandhi,
          // Saṅkalpa, Udbhava, Vyūha) route to their /shunya/<key> page.
          if (key === 'medha') router.push('/medha');
          else if (key === 'vistara') router.push('/vistara');
          else router.push(`/shunya/${key}`);
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

      // PHASE 1: every non-gateway URL stays in Shunya mode and focuses a
      // Shunya orb. /vistara/<product> and /medha become aliases that focus
      // their respective Shunya orb (the in-place expansion is wired via
      // InteractionState in the pathname effect below).
      if (initialMode === 'shunya') {
        if (appInstance.getMode?.() !== 'shunya') appInstance.setMode('shunya');
        const pn = pathname ?? '';
        const isVistara = pn.startsWith('/vistara');
        const isMedha   = pn.startsWith('/medha');
        const focusKey = isMedha ? 'medha'
                       : isVistara ? 'vistara'
                       : pathname?.split('/')[2];
        if (focusKey) appInstance.focusShunyaOrb?.(focusKey, true);
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

  // PHASE 1 routing — in-place orb expansion:
  //   /medha              → stay in Shunya, focus Medhā orb, EXPAND it
  //   /vistara/<product>  → stay in Shunya, focus Vistāra orb, EXPAND + select node
  //   anything else       → fold any currently-expanded orb back to dormant
  useEffect(() => {
    if (!appInstance) return;
    const app = appInstance;
    const seg = pathname?.split('/')[2];
    const ix = (window as any).__vyanIX as undefined | { expand: (t: 'medha'|'vistara', node?: string|null, spectrum?: any) => void; fold: () => void };

    const isMedha   = pathname === '/medha' || pathname?.startsWith('/medha/');
    const isVistara = pathname === '/vistara' || pathname?.startsWith('/vistara/');
    const targetOrb: 'medha' | 'vistara' | null = isMedha ? 'medha' : isVistara ? 'vistara' : null;

    // In-place model: every legacy mode collapses to 'shunya'. Gateway stays
    // only at /vyoma.
    const targetMode = (pathname === '/vyoma' || pathname === '/' || !pathname) ? 'gateway' : 'shunya';
    if (app.getMode?.() !== targetMode) app.setMode(targetMode);

    if (targetMode === 'shunya') {
      // Focus the right Shunya orb so the camera lands on it.
      if (targetOrb === 'medha') app.focusShunyaOrb?.('medha');
      else if (targetOrb === 'vistara') app.focusShunyaOrb?.('vistara');
      else if (seg) app.focusShunyaOrb?.(seg);
    }

    // Drive the InteractionState (in-place expansion).
    if (targetOrb && ix) {
      // Lazy import the spectrum mapping to avoid circular import.
      import('../../lib/vyan/state/InteractionState').then(m => {
        const spectrum = targetOrb === 'vistara' && seg && seg !== 'placeholder'
          ? m.VISTARA_SPECTRUM[seg]
          : 'crimson';
        ix.expand(targetOrb, targetOrb === 'vistara' ? (seg ?? null) : null, spectrum as any);
      });
    } else if (!targetOrb && ix) {
      ix.fold();
    }
  }, [pathname, appInstance]);

  return <div id="vyan-root" ref={ref} />;
}
