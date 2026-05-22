'use client';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import './NebulaFooter.css';

// ============================================================
// NEBULA FOOTER
// Thin (10% screen) diamond-dust band along the bottom of every
// non-Medhā page. 7 dormant glass slabs awaken on hover and open
// a 65–70% glass panel. Below the slabs: a liquid-glass copyright
// pill with fluid radial motion.
// ============================================================

type Slab = { key: string; label: string };
const SLABS: Slab[] = [
  { key: 'privacy',  label: 'Privacy' },
  { key: 'terms',    label: 'Terms' },
  { key: 'refund',   label: 'Refund' },
  { key: 'contact',  label: 'Contact' },
  { key: 'press',    label: 'Press' },
  { key: 'careers',  label: 'Careers' },
  { key: 'imprint',  label: 'Imprint' },
];

export default function NebulaFooter() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [openSlab, setOpenSlab] = useState<string | null>(null);

  // Reveal nebula on touch (mobile) too — once user is within the bottom 18%.
  useEffect(() => {
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const y = t.clientY;
      const h = window.innerHeight;
      if (y > h * 0.82) setHovered(true);
      else if (y < h * 0.65) setHovered(false);
    };
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  // Hide entirely on /medha — she needs the screen.
  if (pathname?.startsWith('/medha')) return null;

  const slabContent = openSlab ? SLABS.find(s => s.key === openSlab) : null;

  return (
    <>
      <div
        className={`nf-root ${hovered ? 'is-hovered' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="nf-nebula" aria-hidden="true" />
        <div className="nf-slabs">
          {SLABS.map((s) => (
            <button
              key={s.key}
              type="button"
              className="nf-slab"
              onClick={(e) => { e.stopPropagation(); setOpenSlab(s.key); }}
            >
              <span className="nf-slab__lbl">{s.label}</span>
            </button>
          ))}
        </div>
        <div className="nf-copyright">
          <div className="nf-pill">
            <span className="nf-pill__liquid" aria-hidden="true" />
            <span className="nf-pill__text">© VYAN 2026</span>
          </div>
          <div className="nf-rights">All rights reserved</div>
        </div>
      </div>

      {slabContent && (
        <div className="nf-panel-veil" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setOpenSlab(null); }}>
          <div className="nf-panel">
            <header className="nf-panel__head">
              <span className="nf-panel__kicker">VYAN · Legal &amp; Communications</span>
              <h2>{slabContent.label}</h2>
              <button type="button" className="nf-panel__x" onClick={() => setOpenSlab(null)} aria-label="close">✕</button>
            </header>
            <div className="nf-panel__body">
              <p className="nf-panel__placeholder">
                Content for <em>{slabContent.label}</em> awaits manifestation. VYAN will inscribe it here shortly.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
