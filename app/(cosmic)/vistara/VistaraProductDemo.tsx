'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import './vistara-demo.css';

// ============================================================
// VISTĀRA · Product Demo Slabs
// Google-AI-Studio inspired — each product opens an interactive
// glass panel with controls + a live preview canvas. The preview
// area is an EMBED SLOT: drop a Google AI Studio share URL into
// `embedUrl` later and it instantly hosts the real app inside.
// ============================================================

type ProductKey = 'ritam' | 'ojas' | 'mudra' | 'netra' | 'akriti' | 'sutra' | 'placeholder';

type DemoSpec = {
  key: ProductKey;
  name: string;
  tagline: string;
  domain: string;            // sub-discipline label (e.g., "PRAVAHA")
  accent: string;            // CSS color
  ctaLabel: string;          // "Begin observation", "Compose", etc.
  promptPlaceholder: string;
  models: string[];          // model picker options
  sliders: { key: string; label: string; min: number; max: number; def: number; unit?: string }[];
  outputHint: string;        // muted line shown in the output area before generation
  embedUrl?: string;         // drop AI Studio share link here later → instantly embeds
};

const DEMOS: Record<ProductKey, DemoSpec> = {
  ritam: {
    key: 'ritam',
    name: 'VYAN Ṭlūtam' /* fallback */,
    tagline: 'Conscious Living Through Pravāha',
    domain: 'PRAVĀHA · FLOW',
    accent: '#9a55ff',
    ctaLabel: 'Surface the flow',
    promptPlaceholder: 'Describe a moment from your day — a meeting, a meal, a walk. Ṭatam will surface its pravāha (the conscious flow lines beneath it).',
    models: ['Ṭatam · Native', 'Ṭatam · Reflective', 'Ṭatam · Vast'],
    sliders: [
      { key: 'depth', label: 'Reflection depth', min: 1, max: 5, def: 3 },
      { key: 'poetic', label: 'Poétic register', min: 0, max: 100, def: 55, unit: '%' },
      { key: 'window', label: 'Time horizon (days)', min: 1, max: 30, def: 7 },
    ],
    outputHint: 'The flow-lines of this moment will manifest here — the currents you missed, the pravāha beneath your motion.',
  },
  ojas: {
    key: 'ojas',
    name: 'VYAN Ojas',
    tagline: 'Tracking Your Prāṇic Rhythm',
    domain: 'PRĀṄA · RHYTHM',
    accent: '#ffb84d',
    ctaLabel: 'Read the pulse',
    promptPlaceholder: 'Describe how you slept, what you ate, how you moved — Ojas will surface the prāṇic rhythm of your day and where vitality concentrates.',
    models: ['Ojas · Solar', 'Ojas · Lunar', 'Ojas · Circadian'],
    sliders: [
      { key: 'hr', label: 'HRV sensitivity', min: 0, max: 100, def: 60, unit: '%' },
      { key: 'sleep', label: 'Sleep weight', min: 0, max: 100, def: 75, unit: '%' },
      { key: 'window', label: 'Lookback (days)', min: 1, max: 90, def: 14 },
    ],
    outputHint: 'Your prāṇic rhythm chart will render here — the gold curve of vitality, with each notch a moment of conscious recovery.',
  },
  mudra: {
    key: 'mudra',
    name: 'VYAN Mudrā',
    tagline: 'The Kośa of Global Entities',
    domain: 'KOŚA · IDENTITY',
    accent: '#3a90ff',
    ctaLabel: 'Cast the seal',
    promptPlaceholder: 'Name an entity — a person, a brand, a school of thought — and Mudrā will surface the kośa (the layered sheath) by which they touch the world.',
    models: ['Mudrā · Aperture', 'Mudrā · Lineage', 'Mudrā · Saṅgha'],
    sliders: [
      { key: 'depth', label: 'Kośa depth', min: 1, max: 5, def: 3 },
      { key: 'lineage', label: 'Lineage weight', min: 0, max: 100, def: 50, unit: '%' },
      { key: 'verify', label: 'Verification threshold', min: 0, max: 100, def: 80, unit: '%' },
    ],
    outputHint: 'The kośa of this entity will manifest here — five sheaths, six relations, the seal that opens recognition.',
  },
  netra: {
    key: 'netra',
    name: 'VYAN Netra',
    tagline: 'The Conscious Eye Across Tantras',
    domain: 'TANTRA · OBSERVABILITY',
    accent: '#22e0d4',
    ctaLabel: 'Open the eye',
    promptPlaceholder: 'Name a domain to observe — a system, a market, a movement. Netra opens its conscious eye across the tantras that govern it.',
    models: ['Netra · Yantra', 'Netra · Tantra', 'Netra · Mantra'],
    sliders: [
      { key: 'breadth', label: 'Breadth of gaze', min: 1, max: 10, def: 5 },
      { key: 'signal', label: 'Signal-to-noise threshold', min: 0, max: 100, def: 70, unit: '%' },
      { key: 'cadence', label: 'Observation cadence (hrs)', min: 1, max: 168, def: 24 },
    ],
    outputHint: 'The conscious eye opens here — patterns surface, anomalies pulse, the tantra of this domain becomes visible.',
  },
  akriti: {
    key: 'akriti',
    name: 'VYAN Ākṛti',
    tagline: 'Creating Digital Anubhava Through Your Dṛṣṭi',
    domain: 'DṚṢṬI · CREATION',
    accent: '#ff8aa2',
    ctaLabel: 'Manifest',
    promptPlaceholder: 'Describe what you see — the dṛṣṭi in your mind. Ākṛti will manifest the digital anubhava (the experienced form) of it.',
    models: ['Ākṛti · Pearl', 'Ākṛti · Vermilion', 'Ākṛti · Indigo'],
    sliders: [
      { key: 'fidelity', label: 'Fidelity to vision', min: 0, max: 100, def: 85, unit: '%' },
      { key: 'departure', label: 'Creative departure', min: 0, max: 100, def: 25, unit: '%' },
      { key: 'iter', label: 'Iterations', min: 1, max: 12, def: 4 },
    ],
    outputHint: 'Your anubhava will emerge here — the form your dṛṣṭi intended, made digital.',
  },
  sutra: {
    key: 'sutra',
    name: 'VYAN Sūtra',
    tagline: 'Weaving Saṅgama Through Viveka',
    domain: 'SAṄGAMA · CONNECTION',
    accent: '#d4a8ff',
    ctaLabel: 'Weave',
    promptPlaceholder: 'Name two threads — people, ideas, products. Sūtra will weave the saṅgama (the meeting-place) between them with viveka (discernment).',
    models: ['Sūtra · Single', 'Sūtra · Bridge', 'Sūtra · Lattice'],
    sliders: [
      { key: 'viveka', label: 'Viveka strictness', min: 0, max: 100, def: 65, unit: '%' },
      { key: 'breadth', label: 'Path breadth', min: 1, max: 6, def: 3 },
      { key: 'symm', label: 'Bilateral symmetry', min: 0, max: 100, def: 50, unit: '%' },
    ],
    outputHint: 'The saṅgama will weave itself here — a luminous path between the threads, with viveka filtering the noise.',
  },
  placeholder: {
    key: 'placeholder',
    name: 'VYAN ···',
    tagline: 'Awaiting Initiation',
    domain: 'BIJA · SEED',
    accent: '#888899',
    ctaLabel: 'Awaiting',
    promptPlaceholder: 'A seventh Vistāra awaits the next emergence. Its function has not yet been spoken.',
    models: ['(unmanifest)'],
    sliders: [],
    outputHint: 'The form is still unseen. Wait.',
  },
};

// Override product names with the exact glyphs from VistaraPath.ts
DEMOS.ritam.name = 'VYAN Ṛtam';

export default function VistaraProductDemo({ productKey }: { productKey: ProductKey }) {
  const router = useRouter();
  const spec = DEMOS[productKey] ?? DEMOS.placeholder;
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(spec.models[0]);
  const [sliders, setSliders] = useState<Record<string, number>>(
    () => Object.fromEntries(spec.sliders.map(s => [s.key, s.def]))
  );
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  // ESC closes the slab and routes back to /vistara.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/vistara'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const onRun = () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setOutput(null);
    // MOCKED — mocked because each product currently has no backend.
    // When you drop the AI Studio share URL into spec.embedUrl, this branch
    // is replaced by the real iframe (rendered conditionally below).
    window.setTimeout(() => {
      setOutput(
        `— ${spec.name} · ${model} —\n\n` +
        `INPUT: "${prompt.slice(0, 180)}${prompt.length > 180 ? '…' : ''}"\n\n` +
        spec.sliders.map(s => `${s.label}: ${sliders[s.key]}${s.unit || ''}`).join(' · ') +
        `\n\n${spec.outputHint}`
      );
      setRunning(false);
    }, 1100);
  };

  const hasEmbed = !!spec.embedUrl;

  return (
    <div className="vpd-veil" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) router.push('/vistara'); }}>
      <div className="vpd-slab" style={{ ['--accent' as any]: spec.accent }}>
        <header className="vpd-head">
          <div className="vpd-domain">{spec.domain}</div>
          <h2 className="vpd-title">{spec.name}</h2>
          <p className="vpd-tagline">{spec.tagline}</p>
          <button type="button" className="vpd-close" onClick={() => router.push('/vistara')} aria-label="close">✕</button>
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

            <label className="vpd-field">
              <span>Model</span>
              <div className="vpd-pills">
                {spec.models.map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`vpd-pill ${model === m ? 'is-active' : ''}`}
                    onClick={() => setModel(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </label>

            {spec.sliders.map(s => (
              <label key={s.key} className="vpd-field vpd-field--slider">
                <span>
                  {s.label}
                  <em>{sliders[s.key]}{s.unit || ''}</em>
                </span>
                <input
                  type="range"
                  min={s.min} max={s.max} value={sliders[s.key]}
                  onChange={(e) => setSliders({ ...sliders, [s.key]: parseFloat(e.target.value) })}
                />
              </label>
            ))}

            <button
              type="button"
              className="vpd-run"
              onClick={onRun}
              disabled={running || !prompt.trim() || productKey === 'placeholder'}
            >
              {running ? <span className="vpd-spin" /> : (productKey === 'placeholder' ? 'Awaiting Initiation' : spec.ctaLabel)}
            </button>
          </div>

          {/* RIGHT · Output + Embed Slot */}
          <div className="vpd-canvas">
            {hasEmbed ? (
              // When the user drops a Google AI Studio share URL into spec.embedUrl,
              // the live app embeds here — no rebuild required.
              <iframe
                title={spec.name}
                src={spec.embedUrl}
                data-vyan-embed={spec.key}
                className="vpd-iframe"
              />
            ) : output ? (
              <pre className="vpd-output">{output}</pre>
            ) : (
              <div className="vpd-empty">
                <div className="vpd-empty__glyph" />
                <p>{spec.outputHint}</p>
                <small>This canvas will host the live VYAN · {spec.name.replace('VYAN ', '')} app once the share link is wired. Until then, run the prompt for a preview.</small>
              </div>
            )}
          </div>
        </div>

        <footer className="vpd-foot">
          <span>esc to close</span>
          <span>VYAN · Vistāra · {spec.domain}</span>
        </footer>
      </div>
    </div>
  );
}
