'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Linear cosmos order — left-swipe goes forward, right-swipe goes back.
const LINEAR_ORDER = ['/vyoma', '/shunya', '/vistara', '/medha'];

function resolveBase(pathname: string | null): number {
  if (!pathname) return -1;
  for (let i = LINEAR_ORDER.length - 1; i >= 0; i--) {
    if (pathname === LINEAR_ORDER[i] || pathname.startsWith(LINEAR_ORDER[i] + '/')) return i;
  }
  return -1;
}

export default function EdgeSwipeNav() {
  const pathname = usePathname();
  const router = useRouter();
  const start = useRef<{ x: number; y: number; t: number; edge: 'l' | 'r' | null } | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (pathname === '/' || pathname?.startsWith('/medha')) return; // skip on landing/medha

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const edge: 'l' | 'r' | null = t.clientX < 32 ? 'l' : (t.clientX > window.innerWidth - 32 ? 'r' : null);
      if (!edge) return;
      start.current = { x: t.clientX, y: t.clientY, t: performance.now(), edge };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!start.current) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) { start.current = null; return; }
      if (Math.abs(dx) > 40) {
        // create overlay if not present
        if (!overlay.current) {
          const el = document.createElement('div');
          el.className = 'edge-swipe-overlay';
          document.body.appendChild(el);
          overlay.current = el;
        }
        const opacity = Math.min(1, Math.abs(dx) / 220);
        overlay.current.style.opacity = String(opacity * 0.6);
        overlay.current.style.background = dx < 0
          ? `linear-gradient(270deg, rgba(120, 80, 200, 0.55), rgba(0,0,0,0))`
          : `linear-gradient(90deg, rgba(120, 80, 200, 0.55), rgba(0,0,0,0))`;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!start.current) { clearOverlay(); return; }
      const t = e.changedTouches[0];
      if (!t) { start.current = null; clearOverlay(); return; }
      const dx = t.clientX - start.current.x;
      const dur = performance.now() - start.current.t;
      const ok = Math.abs(dx) > 110 && dur < 700;
      if (ok) {
        const idx = resolveBase(pathname);
        if (idx >= 0) {
          if (dx < 0 && idx < LINEAR_ORDER.length - 1) router.push(LINEAR_ORDER[idx + 1]);
          else if (dx > 0 && idx > 0) router.push(LINEAR_ORDER[idx - 1]);
        }
      }
      start.current = null;
      clearOverlay();
    };
    function clearOverlay() {
      if (overlay.current) {
        const el = overlay.current;
        el.style.transition = 'opacity 0.32s ease';
        el.style.opacity = '0';
        setTimeout(() => { try { el.remove(); } catch {} }, 400);
        overlay.current = null;
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      clearOverlay();
    };
  }, [pathname, router]);

  return null;
}
