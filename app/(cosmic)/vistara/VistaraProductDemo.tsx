'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloseIcon } from '@/components/icons/VyanIcons';
import { ProductViz, DRAW_FNS } from '@/components/vistara/ProductViz';
import './vistara-demo.css';

// ============================================================
// VISTĀRA · Product Demo Slabs
// Panel emerges FROM the node's screen position and returns
// into it on close. Camera is driven by CameraRig.flyToNode
// before the panel appears.
// ============================================================

export type ProductKey = 'ritam' | 'ojas' | 'vanijya' | 'mudra' | 'netra' | 'akriti' | 'sutra' | 'chitra-prana' | 'maya' | 'sangraha' | 'placeholder';

type DemoSpec = {
  key: ProductKey;
  name: string;
  tagline: string;
  domain: string;
  accent: string;
  ctaLabel: string;
  promptPlaceholder: string;
  chips: string[];
  models: string[];
  sliders: { key: string; label: string; min: number; max: number; def: number; unit?: string }[];
  outputHint: string;
  embedUrl?: string;
};

const DEMOS: Record<ProductKey, DemoSpec> = {
  ritam: {
    key: 'ritam', name: 'VYAN Ṛtam', tagline: 'Conscious Living Through Pravāha',
    domain: 'PRAVĀHA · FLOW', accent: '#9a55ff', ctaLabel: 'Surface the flow',
    promptPlaceholder: 'Describe a moment from your day. Ṛtam will surface its pravāha.',
    chips: [
      'Map today\'s moments of flow and friction',
      'I woke at 6am, meditated, felt scattered by noon',
      'Show how my creative peak shifts through the week',
    ],
    models: ['Ṛtam · Native', 'Ṛtam · Reflective', 'Ṛtam · Vast'],
    sliders: [
      { key: 'depth', label: 'Reflection depth', min: 1, max: 5, def: 3 },
      { key: 'poetic', label: 'Poétic register', min: 0, max: 100, def: 55, unit: '%' },
      { key: 'window', label: 'Time horizon (days)', min: 1, max: 30, def: 7 },
    ],
    outputHint: 'The flow-lines of this moment will manifest here.',
    embedUrl: 'https://rtam.vyanlabs.com',
  },
  ojas: {
    key: 'ojas', name: 'VYAN Ojas', tagline: 'Tracking Your Prāṇic Rhythm',
    domain: 'PRĀṆA · RHYTHM', accent: '#ffb84d', ctaLabel: 'Read the pulse',
    promptPlaceholder: 'Describe how you slept, ate, moved — Ojas will surface the prāṇic rhythm.',
    chips: [
      'I slept 6 hrs, skipped breakfast, trained at noon',
      'My HRV is 42ms — what does Ojas read?',
      'Chart my energy arc across the last 14 days',
    ],
    models: ['Ojas · Solar', 'Ojas · Lunar', 'Ojas · Circadian'],
    sliders: [
      { key: 'hr', label: 'HRV sensitivity', min: 0, max: 100, def: 60, unit: '%' },
      { key: 'sleep', label: 'Sleep weight', min: 0, max: 100, def: 75, unit: '%' },
      { key: 'window', label: 'Lookback (days)', min: 1, max: 90, def: 14 },
    ],
    outputHint: 'Your prāṇic rhythm chart will render here.',
  },
  mudra: {
    key: 'mudra', name: 'VYAN Mudrā', tagline: 'The Kośa of Global Entities',
    domain: 'KOŚA · IDENTITY', accent: '#3a90ff', ctaLabel: 'Cast the seal',
    promptPlaceholder: 'Name an entity — Mudrā will surface its kośa.',
    chips: [
      'Surface the kośa of Apple Inc',
      'Map the lineage of the Tata Group',
      'Who forms the saṅgha behind Anthropic?',
    ],
    models: ['Mudrā · Aperture', 'Mudrā · Lineage', 'Mudrā · Saṅgha'],
    sliders: [
      { key: 'depth', label: 'Kośa depth', min: 1, max: 5, def: 3 },
      { key: 'lineage', label: 'Lineage weight', min: 0, max: 100, def: 50, unit: '%' },
      { key: 'verify', label: 'Verification threshold', min: 0, max: 100, def: 80, unit: '%' },
    ],
    outputHint: 'The kośa of this entity will manifest here.',
  },
  netra: {
    key: 'netra', name: 'VYAN Netra', tagline: 'The Conscious Eye Across Tantras',
    domain: 'TANTRA · OBSERVABILITY', accent: '#22e0d4', ctaLabel: 'Open the eye',
    promptPlaceholder: 'Name a domain to observe — Netra opens its eye.',
    chips: [
      'Open the eye on the generative AI space',
      'What signals are moving in quantum computing?',
      'Observe the climate tech tantra this quarter',
    ],
    models: ['Netra · Yantra', 'Netra · Tantra', 'Netra · Mantra'],
    sliders: [
      { key: 'breadth', label: 'Breadth of gaze', min: 1, max: 10, def: 5 },
      { key: 'signal', label: 'Signal-to-noise threshold', min: 0, max: 100, def: 70, unit: '%' },
      { key: 'cadence', label: 'Observation cadence (hrs)', min: 1, max: 168, def: 24 },
    ],
    outputHint: 'The conscious eye opens here.',
  },
  akriti: {
    key: 'akriti', name: 'VYAN Ākṛti', tagline: 'Creating Digital Anubhava Through Your Dṛṣṭi',
    domain: 'DṚṢṬI · CREATION', accent: '#ff8aa2', ctaLabel: 'Manifest',
    promptPlaceholder: 'Describe the dṛṣṭi in your mind — Ākṛti will manifest it.',
    chips: [
      'A sacred geometry identity for a wellness studio',
      'Brutalist typography meets Vedic illustration',
      'A cosmic UI for a silent meditation app',
    ],
    models: ['Ākṛti · Pearl', 'Ākṛti · Vermilion', 'Ākṛti · Indigo'],
    sliders: [
      { key: 'fidelity', label: 'Fidelity to vision', min: 0, max: 100, def: 85, unit: '%' },
      { key: 'departure', label: 'Creative departure', min: 0, max: 100, def: 25, unit: '%' },
      { key: 'iter', label: 'Iterations', min: 1, max: 12, def: 4 },
    ],
    outputHint: 'Your anubhava will emerge here.',
  },
  sutra: {
    key: 'sutra', name: 'VYAN Sūtra', tagline: 'Weaving Saṅgama Through Viveka',
    domain: 'SAṄGAMA · CONNECTION', accent: '#d4a8ff', ctaLabel: 'Weave',
    promptPlaceholder: 'Name two threads — Sūtra will weave the saṅgama.',
    chips: [
      'Weave climate tech and indigenous land stewardship',
      'Connect yoga philosophy with modern neuroscience',
      'The thread between Vedic mathematics and machine learning',
    ],
    models: ['Sūtra · Single', 'Sūtra · Bridge', 'Sūtra · Lattice'],
    sliders: [
      { key: 'viveka', label: 'Viveka strictness', min: 0, max: 100, def: 65, unit: '%' },
      { key: 'breadth', label: 'Path breadth', min: 1, max: 6, def: 3 },
      { key: 'symm', label: 'Bilateral symmetry', min: 0, max: 100, def: 50, unit: '%' },
    ],
    outputHint: 'The saṅgama will weave itself here.',
  },
  vanijya: {
    key: 'vanijya', name: 'VYAN Vaṇijya', tagline: 'A Medhā-Driven System for Market Intelligence',
    domain: 'MEDHĀ · INTELLIGENCE', accent: '#8ab0e0', ctaLabel: 'Read the market',
    promptPlaceholder: 'Name a market, sector, or asset — Vaṇijya will trace its invisible flows.',
    chips: [
      'Trace the invisible flows in AI infrastructure',
      'What macro signals are shifting in Southeast Asia?',
      'Surface momentum in global semiconductor supply chains',
    ],
    models: ['Vaṇijya · Signal', 'Vaṇijya · Macro', 'Vaṇijya · Micro'],
    sliders: [
      { key: 'horizon', label: 'Temporal horizon (days)', min: 1, max: 365, def: 30 },
      { key: 'sensitivity', label: 'Signal sensitivity', min: 0, max: 100, def: 65, unit: '%' },
      { key: 'depth', label: 'Analysis depth', min: 1, max: 5, def: 3 },
    ],
    outputHint: 'The invisible flows of the market will surface here.',
    embedUrl: 'https://vanijya.vyanlabs.com',
  },
  'chitra-prana': {
    key: 'chitra-prana', name: 'VYAN Chitra-Prāṇa', tagline: 'Breathing Life Into Imagery',
    domain: 'PRĀṆA · IMAGERY', accent: '#a0c8e8', ctaLabel: 'Breathe life',
    promptPlaceholder: 'Describe an image or scene — Chitra-Prāṇa will breathe prāṇa into it.',
    chips: [
      'A still ocean at dawn breathing into motion',
      'Sacred geometry dissolving into river light',
      'An ancient forest breathing in slow time',
    ],
    models: ['Chitra-Prāṇa · Still', 'Chitra-Prāṇa · Motion', 'Chitra-Prāṇa · Living'],
    sliders: [
      { key: 'vitality', label: 'Prāṇic vitality', min: 0, max: 100, def: 70, unit: '%' },
      { key: 'motion', label: 'Motion amplitude', min: 0, max: 100, def: 45, unit: '%' },
      { key: 'frames', label: 'Animation frames', min: 12, max: 120, def: 48 },
    ],
    outputHint: 'The living image will breathe here.',
  },
  maya: {
    key: 'maya', name: 'VYAN Māyā', tagline: 'Manifesting Digital Realities',
    domain: 'MĀYĀ · MANIFESTATION', accent: '#ffd080', ctaLabel: 'Manifest',
    promptPlaceholder: 'Describe the reality you wish to manifest — Māyā will construct it.',
    chips: [
      'A living city built from sacred geometry and light',
      'Simulate the emergence of consciousness in a digital void',
      'Manifest a world where language becomes architecture',
    ],
    models: ['Māyā · Illusion', 'Māyā · Simulation', 'Māyā · Emergence'],
    sliders: [
      { key: 'complexity', label: 'Reality complexity', min: 1, max: 10, def: 5 },
      { key: 'fidelity', label: 'Perceptual fidelity', min: 0, max: 100, def: 80, unit: '%' },
      { key: 'entropy', label: 'Entropic drift', min: 0, max: 100, def: 20, unit: '%' },
    ],
    outputHint: 'Your digital reality will manifest here.',
  },
  sangraha: {
    key: 'sangraha', name: 'VYAN Saṅgraha', tagline: 'The Living Archive of All Knowing',
    domain: 'GRĀHA · ARCHIVE', accent: '#c8a0e8', ctaLabel: 'Gather',
    promptPlaceholder: 'Name a domain or topic — Saṅgraha will assemble its knowing.',
    chips: [
      'Assemble the living canon of Vedic science',
      'Gather everything known about the gut-brain axis',
      'Archive the philosophy and practice of deep listening',
    ],
    models: ['Saṅgraha · Sparse', 'Saṅgraha · Dense', 'Saṅgraha · Vast'],
    sliders: [
      { key: 'breadth', label: 'Collection breadth', min: 1, max: 10, def: 5 },
      { key: 'depth', label: 'Archive depth', min: 1, max: 5, def: 3 },
      { key: 'recency', label: 'Recency weight', min: 0, max: 100, def: 50, unit: '%' },
    ],
    outputHint: 'The gathered knowing will be assembled here.',
  },
  placeholder: {
    key: 'placeholder', name: 'VYAN ···', tagline: 'Awaiting Initiation',
    domain: 'BIJA · SEED', accent: '#888899', ctaLabel: 'Awaiting',
    promptPlaceholder: 'A gateway awaits the next emergence.',
    chips: [],
    models: ['(unmanifest)'], sliders: [],
    outputHint: 'The form is still unseen.',
  },
};

export default function VistaraProductDemo({
  productKey,
  embedded = false,
  onClose,
}: {
  productKey: ProductKey;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const spec = DEMOS[productKey] ?? DEMOS.placeholder;
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(spec.models[0]);
  const [sliders, setSliders] = useState<Record<string, number>>(
    () => Object.fromEntries(spec.sliders.map(s => [s.key, s.def])),
  );
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeHov, setCloseHov] = useState(false);

  const slabRef = useRef<HTMLDivElement | null>(null);

  // ESC triggers animated close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    // PHASE 10 — pause cosmic ScrollJourney while a product slab is open
    // so wheel-scroll doesn't fly the camera past other Shunya orbs.
    document.body.classList.add('vyan-paused');
    // Move Nāvika out of the way while this panel is open
    window.dispatchEvent(new CustomEvent('vyan:panel-state', { detail: { open: true } }));
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('vyan-paused');
      window.dispatchEvent(new CustomEvent('vyan:panel-state', { detail: { open: false } }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animated close — panel shrinks back into node ──────────────────────────
  const handleClose = () => {
    if (closing) return;
    if (embedded && onClose) { onClose(); return; }
    setClosing(true);

    // Tell CameraRig to return to orbital view
    try {
      const vyan: any = (window as any).__vyan;
      vyan?.worldRef?.cameraRig?.returnToOrbital?.();
    } catch {}

    // Wait for panel animation, then navigate
    setTimeout(() => {
      router.push('/vistara');
    }, 420);
  };

  // ── Anchor slab to the clicked node's screen position ────────────────────
  useEffect(() => {
    let raf = 0;
    let tmpV: any = null;
    try {
      const THREE = require('three');
      tmpV = new THREE.Vector3();
    } catch {}

    // Store the node's screen position for the origin animation
    let nodeScreenX = window.innerWidth * 0.5;
    let nodeScreenY = window.innerHeight * 0.5;
    let anchorKnown = false;

    const tick = () => {
      const el = slabRef.current;
      if (!el) { raf = requestAnimationFrame(tick); return; }
      const SLAB_WIDTH  = el.offsetWidth  || 1100;
      const SLAB_HEIGHT = el.offsetHeight || 700;

      let anchorScreen: { x: number; y: number } | null = null;
      try {
        const vyan: any = (window as any).__vyan;
        const w = vyan?.worldRef;
        if (w?.realms?.shunya?.getOrbByKey && w?.camera && tmpV) {
          const orb = w.realms.shunya.getOrbByKey('vistara');
          if (orb?.socketGroup?.children?.length) {
            const child = orb.socketGroup.children.find((c: any) =>
              c.userData?.isProductSocket && c.userData?.productKey === productKey && c.geometry,
            );
            if (child) {
              child.getWorldPosition(tmpV);
              tmpV.project(w.camera);
              anchorScreen = {
                x: (tmpV.x * 0.5 + 0.5) * window.innerWidth,
                y: (-tmpV.y * 0.5 + 0.5) * window.innerHeight,
              };
            }
          }
        }
      } catch {}

      if (anchorScreen) {
        // Save node screen position for CSS origin animation
        if (!anchorKnown) {
          nodeScreenX = anchorScreen.x;
          nodeScreenY = anchorScreen.y;
          anchorKnown = true;
        }

        const cx = anchorScreen.x;
        const cy = anchorScreen.y;
        const W = window.innerWidth, H = window.innerHeight;
        const onRight = cx >= W * 0.5;
        const offsetX = onRight ? 50 : -(SLAB_WIDTH + 50);
        let left = cx + offsetX;
        let top  = cy - SLAB_HEIGHT * 0.5;
        const MIN = 20;
        left = Math.max(MIN, Math.min(W - SLAB_WIDTH - MIN, left));
        top  = Math.max(MIN, Math.min(H - SLAB_HEIGHT - MIN, top));

        const cur = el.getBoundingClientRect();
        const curLeft = cur.left || left;
        const curTop  = cur.top  || top;
        const lerp = 0.20;
        const nextLeft = curLeft + (left - curLeft) * lerp;
        const nextTop  = curTop  + (top  - curTop)  * lerp;

        el.style.left = nextLeft + 'px';
        el.style.top  = nextTop + 'px';
        el.style.right = 'auto';
        el.style.margin = '0';
        el.style.transform = 'none';
        el.style.position = 'fixed';
        el.style.opacity = '1';

        // Set CSS vars for panel-from-node animation origin
        // --node-x/--node-y are relative percentages within the slab
        const relX = ((nodeScreenX - nextLeft) / SLAB_WIDTH) * 100;
        const relY = ((nodeScreenY - nextTop)  / SLAB_HEIGHT) * 100;
        el.style.setProperty('--node-x', `${relX}%`);
        el.style.setProperty('--node-y', `${relY}%`);
        // --node-dx/--node-dy for the closing animation target
        el.style.setProperty('--node-dx', `${nodeScreenX - nextLeft - SLAB_WIDTH * 0.5}px`);
        el.style.setProperty('--node-dy', `${nodeScreenY - nextTop  - SLAB_HEIGHT * 0.5}px`);

        // Filament
        const filament = el.querySelector('.vpd-anchor-filament') as SVGElement | null;
        if (filament) {
          const sx = onRight ? 0 : SLAB_WIDTH;
          const sy = SLAB_HEIGHT * 0.5;
          const dx = cx - nextLeft;
          const dy = cy - nextTop;
          filament.setAttribute('viewBox', `0 0 ${SLAB_WIDTH} ${SLAB_HEIGHT}`);
          const path = filament.querySelector('path') as SVGPathElement | null;
          if (path) {
            const midX = (sx + dx) * 0.5;
            path.setAttribute('d', `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${dy}, ${dx} ${dy}`);
          }
        }
      } else {
        // Fallback dock
        el.style.right = '4vw';
        el.style.left = 'auto';
        el.style.top = '50%';
        el.style.transform = 'translateY(-50%)';
        el.style.position = 'fixed';
        el.style.opacity = '1';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [productKey]);

  const onRun = () => {
    if (!prompt.trim()) return;
    setRunning(true); setOutput(null);
    window.setTimeout(() => {
      setOutput(
        `— ${spec.name} · ${model} —\n\n` +
        `INPUT: "${prompt.slice(0, 180)}${prompt.length > 180 ? '…' : ''}"\n\n` +
        spec.sliders.map(s => `${s.label}: ${sliders[s.key]}${s.unit || ''}`).join(' · ') +
        `\n\n${spec.outputHint}`,
      );
      setRunning(false);
    }, 1100);
  };

  const slab = (
    <div
      ref={slabRef}
      className={`vpd-slab ${closing ? 'is-closing' : ''} ${spec.embedUrl ? 'has-embed' : ''} ${embedded ? 'vpd-slab--embedded' : ''}`}
      style={{ ['--accent' as any]: spec.accent }}
    >
      {/* Filament — hidden when embedded */}
      {!embedded && (
        <svg className="vpd-anchor-filament" aria-hidden="true">
          <defs>
            <linearGradient id={`vpd-fil-${productKey}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={spec.accent} stopOpacity="0" />
              <stop offset="50%"  stopColor={spec.accent} stopOpacity="0.5" />
              <stop offset="100%" stopColor={spec.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="" stroke={`url(#vpd-fil-${productKey})`} strokeWidth="1.4" fill="none" />
        </svg>
      )}

      <header className="vpd-head">
          <div className="vpd-domain">{spec.domain}</div>
          <h2 className="vpd-title">{spec.name}</h2>
          <p className="vpd-tagline">{spec.tagline}</p>
          <button
            type="button"
            className="vpd-close"
            onMouseEnter={() => setCloseHov(true)}
            onMouseLeave={() => setCloseHov(false)}
            onClick={handleClose}
            aria-label="close"
          >
            <CloseIcon size={24} isHovered={closeHov} />
          </button>
        </header>

        <div className="vpd-body">
          {/* LEFT · Controls */}
          <div className="vpd-controls">
            <label className="vpd-field">
              <span>Prompt</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
                placeholder={spec.promptPlaceholder}
                rows={6}
              />
              <span className="vpd-count">{prompt.length}/2000</span>
            </label>
            {spec.chips.length > 0 && (
              <div className="vpd-chips">
                {spec.chips.map(chip => (
                  <button key={chip} type="button" className="vpd-chip"
                          onClick={() => setPrompt(chip)}>{chip}</button>
                ))}
              </div>
            )}
            <label className="vpd-field">
              <span>Model</span>
              <div className="vpd-pills">
                {spec.models.map(m => (
                  <button key={m} type="button"
                          className={`vpd-pill ${model === m ? 'is-active' : ''}`}
                          onClick={() => setModel(m)}>{m}</button>
                ))}
              </div>
            </label>
            {spec.sliders.map(s => (
              <label key={s.key} className="vpd-field vpd-field--slider">
                <span>{s.label}<em>{sliders[s.key]}{s.unit || ''}</em></span>
                <input type="range" min={s.min} max={s.max} value={sliders[s.key]}
                       onChange={(e) => setSliders({ ...sliders, [s.key]: parseFloat(e.target.value) })} />
              </label>
            ))}
            <button
              type="button" className="vpd-run" onClick={onRun}
              disabled={running || !prompt.trim() || productKey === 'placeholder'}
            >
              {running ? <span className="vpd-spin" /> : (productKey === 'placeholder' ? 'Awaiting Initiation' : spec.ctaLabel)}
            </button>
          </div>

          {/* RIGHT · Output */}
          <div className="vpd-canvas">
            {spec.embedUrl ? (
              <iframe title={spec.name} src={spec.embedUrl} data-vyan-embed={spec.key} className="vpd-iframe" />
            ) : output ? (
              <pre className="vpd-output">{output}</pre>
            ) : DRAW_FNS[productKey] ? (
              <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <ProductViz id={productKey} accent={spec.accent} />
                </div>
                <p style={{ margin: '12px 0 0', textAlign: 'center', font: '400 13px/1.6 var(--font-vyan)', fontStyle: 'italic', color: 'rgba(244,235,255,0.5)' }}>{spec.outputHint}</p>
              </div>
            ) : (
              <div className="vpd-empty">
                <div className="vpd-empty__glyph" />
                <p>{spec.outputHint}</p>
              </div>
            )}
          </div>
        </div>

        <footer className="vpd-foot">
          <span>esc to close</span>
          <span>VYAN · Vistāra · {spec.domain}</span>
        </footer>
      </div>
  );

  if (embedded) return slab;

  return (
    <div
      className="vpd-veil"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {slab}
    </div>
  );
}
