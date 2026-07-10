'use client';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import './NebulaFooter.css';

// Nebula footer — DORMANT by default; visible only on /vyoma + /shunya routes,
// and only when hovered/touched. Hides whenever any other glass panel is open
// so it never overlaps the active dialog.

const ALLOWED_PREFIXES = ['/vyoma', '/shunya'];
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
const PANEL_SELECTORS = [
  '.vpd-veil',
  '.netra-root',
  '.mcc-veil',
  '.mlv-modal',
  '.glass-panel.open',
  '[data-vyan-panel="open"]',
].join(',');

export default function NebulaFooter() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [openSlab, setOpenSlab] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const check = () => setPanelOpen(!!document.querySelector(PANEL_SELECTORS));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-vyan-panel'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0]; if (!t) return;
      const y = t.clientY; const h = window.innerHeight;
      if (y > h * 0.82) setHovered(true);
      else if (y < h * 0.65) setHovered(false);
    };
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  // ESC closes the footer's own slab.
  useEffect(() => {
    if (!openSlab) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenSlab(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [openSlab]);

  const allowedRoute = !!pathname && ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  const footerSlabOpen = !!openSlab;
  const inert = !allowedRoute || (panelOpen && !footerSlabOpen);
  const slabContent = openSlab ? SLABS.find(s => s.key === openSlab) : null;

  return (
    <>
      {!inert && (
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
      )}

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
