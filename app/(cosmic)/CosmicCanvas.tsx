'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import '../../lib/vyan/ui/styles.css';

// Singleton VYAN app reference, persists across child-route navigations.
let appInstance: any = null;
let rootEl: HTMLDivElement | null = null;

export default function CosmicCanvas() {
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mount once. If a previous instance lingers (HMR), tear it down first.
    if (!ref.current) return;
    rootEl = ref.current;

    let cancelled = false;
    (async () => {
      const { App } = await import('@/lib/vyan/app/App');
      if (cancelled || !rootEl) return;

      // Decide initial mode from current path
      const startsShunya = pathname?.startsWith('/shunya');
      const initialMode = startsShunya ? 'shunya' : 'gateway';

      // Prefetch the other cosmic routes — cascading background preload chain.
      try {
        router.prefetch('/vyoma');
        router.prefetch('/shunya');
      } catch {}

      appInstance = new App(rootEl, {
        skipIntro: true,
        initialMode,
        onEnterVoid: () => {
          // Triggered when the Vyōma core burst + fadeToBlack completes.
          router.push('/shunya');
        },
        onOrbActivate: (key: string) => {
          // Deep-link to focused orb (Phase 3 will open glass slabs here).
          router.push(`/shunya/${key}`);
        },
      });
      appInstance.start();
      (window as any).__vyan = appInstance;

      // Apply initial orb focus immediately (snap) if route is /shunya/<orb>
      if (startsShunya) {
        const seg = pathname?.split('/')[2];
        if (seg) appInstance.focusShunyaOrb?.(seg, true);
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
    // Intentionally NOT depending on pathname — we want a single mount per layout lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mode + orb focus whenever pathname changes (without remounting).
  useEffect(() => {
    if (!appInstance) return;
    const isShunya = pathname?.startsWith('/shunya');
    const targetMode = isShunya ? 'shunya' : 'gateway';
    if (appInstance.getMode?.() !== targetMode) {
      appInstance.setMode(targetMode);
    }
    if (isShunya) {
      const seg = pathname?.split('/')[2];
      if (seg) appInstance.focusShunyaOrb?.(seg);
    }
  }, [pathname]);

  return <div id="vyan-root" ref={ref} />;
}
