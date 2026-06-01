'use client';
// /vistara — the Product sub-void.
// Triggers InteractionState.expand('vistara') so the canvas orb
// unfolds immediately on direct navigation to this route.
import { useEffect } from 'react';

export default function VistaraPage() {
  useEffect(() => {
    try {
      const ix = (window as any).__vyanIX;
      if (!ix) return;
      const s = ix.get();
      if (s.target !== 'vistara' || s.phase === 'dormant') {
        ix.expand('vistara', null, 'crimson');
      }
    } catch {}
  }, []);
  return null;
}
