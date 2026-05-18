'use client';

import { useEffect, useRef } from 'react';
import '../../lib/vyan/ui/styles.css';

// Mounts the ported vanilla Three.js/GSAP `App` (from /app/lib/vyan)
// into a #vyan-root div. The intro logo animation is SKIPPED here because
// it already played on the /loader page (/).
export default function VyomaClient() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    let app: any;
    let cancelled = false;

    (async () => {
      // Dynamic import keeps Three.js out of the SSR/server bundle.
      const mod = await import('@/lib/vyan/app/App');
      if (cancelled || !rootRef.current) return;
      app = new mod.App(rootRef.current, { skipIntro: true });
      app.start();
      // Expose for debugging in dev
      (window as any).__vyan = app;
    })();

    return () => {
      cancelled = true;
      try { app?.destroy?.(); } catch {}
      // Hard-clear any residual DOM the imperative app appended
      if (rootRef.current) rootRef.current.innerHTML = '';
      try { delete (window as any).__vyan; } catch {}
    };
  }, []);

  return <div id="vyan-root" ref={rootRef} />;
}
