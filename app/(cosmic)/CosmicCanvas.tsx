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

      // Apply initial focus immediately (snap) if route is deep-linked.
      if (initialMode === 'shunya') {
        const seg = pathname?.split('/')[2];
        if (seg) appInstance.focusShunyaOrb?.(seg, true);
      } else if (initialMode === 'vistara') {
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
  useEffect(() => {
    if (!appInstance) return;
    const targetMode = modeFromPath(pathname);
    if (appInstance.getMode?.() !== targetMode) {
      appInstance.setMode(targetMode);
    }
    if (targetMode === 'shunya') {
      const seg = pathname?.split('/')[2];
      if (seg) appInstance.focusShunyaOrb?.(seg);
    } else if (targetMode === 'vistara') {
      const seg = pathname?.split('/')[2];
      if (seg) appInstance.focusVistaraProduct?.(seg);
    }
  }, [pathname]);

  return <div id="vyan-root" ref={ref} />;
}
