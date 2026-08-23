'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloseIcon } from '@/components/icons/VyanIcons';
import './vistara-demo.css';

// ─── Per-product canvas visualizations ────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
type RGB = [number, number, number];
type DrawFn = (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, rgb: RGB) => void;

const drawRitam: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const cy = H/2;
  const waves = [[0.018,0.18,0,0.9,0.65,1.5],[0.011,0.24,2.1,0.5,0.35,1.0],[0.027,0.11,3.8,1.3,0.5,0.8],[0.014,0.16,1.0,0.7,0.22,2.0]];
  for (const [fx,amp,ph,spd,al,lw] of waves) {
    ctx.beginPath();
    for (let x=0;x<=W;x+=2) { const y=cy+Math.sin(x*fx+t*spd+ph)*H*amp; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.strokeStyle=`rgba(${r},${g},${b},${al})`; ctx.lineWidth=lw; ctx.stroke();
  }
  const grd=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,H*0.35);
  grd.addColorStop(0,`rgba(${r},${g},${b},0.1)`); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
};

const drawOjas: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const cx=W/2,cy=H/2,maxR=Math.min(W,H)*0.38;
  for (let i=0;i<5;i++) {
    const p=((t*0.5+i/5)%1);
    ctx.beginPath(); ctx.arc(cx,cy,p*maxR,0,Math.PI*2);
    ctx.strokeStyle=`rgba(${r},${g},${b},${(1-p)*0.7})`; ctx.lineWidth=1.2-p*0.8; ctx.stroke();
  }
  const pulse=(Math.sin(t*1.6)+1)/2;
  const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR*0.4);
  glow.addColorStop(0,`rgba(${r},${g},${b},${0.22+pulse*0.38})`); glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
  const lY=cy+maxR*0.65;
  ctx.beginPath(); ctx.moveTo(0,lY);
  for (let x=0;x<=W;x+=2) {
    const xf=x/W; let dy=0;
    for (const bt of [0.2,0.5,0.8]) { const d=Math.abs(xf-((bt+t*0.35)%1)); if(d<0.06) dy+=Math.sin(d/0.06*Math.PI)*28; }
    ctx.lineTo(x,lY-dy);
  }
  ctx.strokeStyle=`rgba(${r},${g},${b},0.55)`; ctx.lineWidth=1.2; ctx.stroke();
};

const drawVanijya: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const px=28,py=22,gW=W-px*2,gH=H-py*2;
  for (let i=1;i<4;i++) {
    ctx.beginPath(); ctx.moveTo(px,py+(i/4)*gH); ctx.lineTo(px+gW,py+(i/4)*gH);
    ctx.strokeStyle=`rgba(${r},${g},${b},0.12)`; ctx.lineWidth=0.5; ctx.stroke();
  }
  const yAt=(xf: number)=>py+gH*(0.5-Math.sin(xf*7+t*0.5)*0.15-Math.sin(xf*3+t*0.22)*0.18-Math.sin(xf*14+t*0.9)*0.05+Math.sin(t*0.4)*0.06);
  ctx.beginPath();
  for (let x=0;x<=gW;x+=1.5) { const y=yAt(x/gW); x===0?ctx.moveTo(px+x,y):ctx.lineTo(px+x,y); }
  ctx.strokeStyle=`rgba(${r},${g},${b},0.85)`; ctx.lineWidth=2; ctx.stroke();
  ctx.lineTo(px+gW,py+gH); ctx.lineTo(px,py+gH); ctx.closePath();
  const fill=ctx.createLinearGradient(0,py,0,py+gH);
  fill.addColorStop(0,`rgba(${r},${g},${b},0.2)`); fill.addColorStop(1,'transparent');
  ctx.fillStyle=fill; ctx.fill();
  for (let i=0;i<9;i++) { const xf=(i+0.5)/9; ctx.beginPath(); ctx.arc(px+xf*gW,yAt(xf),3.5,0,Math.PI*2); ctx.fillStyle=`rgba(${r},${g},${b},0.9)`; ctx.fill(); }
};

const drawMudra: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const cx=W/2,cy=H/2,R=Math.min(W,H)*0.18;
  const sph=ctx.createRadialGradient(cx-R*0.3,cy-R*0.3,0,cx,cy,R*1.1);
  sph.addColorStop(0,`rgba(${r},${g},${b},0.95)`); sph.addColorStop(0.5,`rgba(${r},${g},${b},0.5)`); sph.addColorStop(1,`rgba(${r},${g},${b},0.05)`);
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fillStyle=sph; ctx.fill();
  const orbits=[{rx:R*2.1,ry:R*0.55,rot:t*0.35},{rx:R*2.6,ry:R*0.75,rot:-t*0.22+1.2},{rx:R*1.6,ry:R*0.4,rot:t*0.55+2.4}];
  for (const o of orbits) {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(o.rot);
    ctx.beginPath(); ctx.ellipse(0,0,o.rx,o.ry,0,0,Math.PI*2); ctx.setLineDash([4,6]);
    ctx.strokeStyle=`rgba(${r},${g},${b},0.35)`; ctx.lineWidth=0.9; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(o.rx,0,2.5,0,Math.PI*2); ctx.fillStyle=`rgba(${r},${g},${b},0.9)`; ctx.fill();
    ctx.restore();
  }
  const glow=ctx.createRadialGradient(cx,cy,R,cx,cy,R*3);
  glow.addColorStop(0,`rgba(${r},${g},${b},0.15)`); glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
};

const drawNetra: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const cx=W/2,cy=H/2,R=Math.min(W,H)*0.28;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(t*0.15);
  for (let i=0;i<12;i++) {
    const a=(i/12)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*R*0.78,Math.sin(a)*R*0.78); ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R);
    ctx.strokeStyle=`rgba(${r},${g},${b},0.5)`; ctx.lineWidth=1; ctx.stroke();
  }
  ctx.restore();
  for (let i=0;i<4;i++) { ctx.beginPath(); ctx.arc(cx,cy,R*(0.22+i*0.2),0,Math.PI*2); ctx.strokeStyle=`rgba(${r},${g},${b},${0.55-i*0.1})`; ctx.lineWidth=i===0?1.5:0.7; ctx.stroke(); }
  const pR=R*0.18*(0.85+Math.sin(t*0.7)*0.15);
  const pup=ctx.createRadialGradient(cx,cy,0,cx,cy,pR);
  pup.addColorStop(0,`rgba(${r},${g},${b},0.95)`); pup.addColorStop(1,`rgba(${r},${g},${b},0.35)`);
  ctx.beginPath(); ctx.arc(cx,cy,pR,0,Math.PI*2); ctx.fillStyle=pup; ctx.fill();
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(t*0.6);
  ctx.beginPath(); ctx.arc(0,0,R*0.58,-0.35,0.35); ctx.strokeStyle=`rgba(${r},${g},${b},0.8)`; ctx.lineWidth=1.8; ctx.stroke();
  ctx.restore();
};

const drawAkriti: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const cx=W/2,cy=H/2,R=Math.min(W,H)*0.28;
  for (let n=3;n<=7;n++) {
    const rad=R*(1.05-(n-3)*0.17);
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(t*0.06*(n%2===0?1:-1)+n*0.55);
    ctx.beginPath();
    for (let i=0;i<n;i++) { const a=(i/n)*Math.PI*2-Math.PI/2; i===0?ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad); }
    ctx.closePath(); ctx.strokeStyle=`rgba(${r},${g},${b},${0.5-(n-3)*0.07})`; ctx.lineWidth=0.9; ctx.stroke();
    ctx.restore();
  }
  for (let i=0;i<6;i++) {
    const a=(i/6)*Math.PI*2+t*0.1,len=R*(1.2+Math.sin(t*1.1+i*1.3)*0.28);
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len);
    ctx.strokeStyle=`rgba(${r},${g},${b},${0.18+Math.sin(t*0.9+i)*0.08})`; ctx.lineWidth=0.7; ctx.stroke();
  }
  const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,R*0.5);
  glow.addColorStop(0,`rgba(${r},${g},${b},0.35)`); glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,R*0.5,0,Math.PI*2); ctx.fill();
};

const drawSutra: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const N=12;
  const nodes=Array.from({length:N},(_,i)=>({
    x:W*(0.12+0.76*((i*7+3)%11)/10)+Math.sin(t*0.38+i*2.3)*22,
    y:H*(0.12+0.76*((i*3+7)%11)/10)+Math.cos(t*0.31+i*1.7)*18,
  }));
  const dmax=Math.min(W,H)*0.44;
  for (let i=0;i<N;i++) for (let j=i+1;j<N;j++) {
    const dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y,d=Math.hypot(dx,dy);
    if (d<dmax) { ctx.beginPath(); ctx.moveTo(nodes[i].x,nodes[i].y); ctx.lineTo(nodes[j].x,nodes[j].y); ctx.strokeStyle=`rgba(${r},${g},${b},${(1-d/dmax)*0.42})`; ctx.lineWidth=(1-d/dmax)*1.4; ctx.stroke(); }
  }
  for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x,n.y,3,0,Math.PI*2); ctx.fillStyle=`rgba(${r},${g},${b},0.85)`; ctx.fill(); }
};

const drawChitraPrana: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const cx=W/2,cy=H/2,R=Math.min(W,H)*0.3,blades=8;
  const half=((Math.sin(t*0.45)+1)/2*0.8+0.05)*Math.PI/blades;
  for (let i=0;i<blades;i++) {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate((i/blades)*Math.PI*2+t*0.08);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,R,-half,half); ctx.closePath();
    ctx.fillStyle=`rgba(${r},${g},${b},0.1)`; ctx.fill(); ctx.strokeStyle=`rgba(${r},${g},${b},0.4)`; ctx.lineWidth=0.9; ctx.stroke();
    ctx.restore();
  }
  const burst=ctx.createRadialGradient(cx,cy,0,cx,cy,R*0.55);
  burst.addColorStop(0,`rgba(${r},${g},${b},0.65)`); burst.addColorStop(0.4,`rgba(${r},${g},${b},0.18)`); burst.addColorStop(1,'transparent');
  ctx.beginPath(); ctx.arc(cx,cy,R*0.55,0,Math.PI*2); ctx.fillStyle=burst; ctx.fill();
  for (let i=0;i<6;i++) {
    const a=(i/6)*Math.PI*2+t*0.08;
    ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*R*0.58,cy+Math.sin(a)*R*0.58); ctx.lineTo(cx+Math.cos(a)*R*1.35,cy+Math.sin(a)*R*1.35);
    ctx.strokeStyle=`rgba(${r},${g},${b},0.14)`; ctx.lineWidth=1.2; ctx.stroke();
  }
};

const drawMaya: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const cx=W/2,cy=H/2,PR=Math.min(W,H)*0.33,N=70;
  for (let i=0;i<N;i++) {
    const fi=i/N,angle=fi*Math.PI*2+t*0.2,morph=(Math.sin(t*0.3+fi*Math.PI*3)+1)/2;
    const sx=cx+Math.cos(angle)*PR,sy=cy+Math.sin(angle)*PR;
    const cx2=cx+Math.cos(fi*137.508*Math.PI/180)*PR*1.1+Math.sin(t*0.8+fi*11)*25;
    const cy2=cy+Math.sin(fi*137.508*Math.PI/180)*PR*1.1+Math.cos(t*0.7+fi*7)*20;
    const px=sx*morph+cx2*(1-morph),py=sy*morph+cy2*(1-morph);
    ctx.beginPath(); ctx.arc(px,py,1.3+Math.sin(fi*11+t)*0.7,0,Math.PI*2);
    ctx.fillStyle=`rgba(${r},${g},${b},${0.35+morph*0.45})`; ctx.fill();
  }
  const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,PR*0.4);
  glow.addColorStop(0,`rgba(${r},${g},${b},0.12)`); glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
};

const drawSangraha: DrawFn = (ctx, W, H, t, [r,g,b]) => {
  const cx=W/2,cy=H/2,layers=8,maxRX=Math.min(W,H)*0.38;
  for (let i=0;i<layers;i++) {
    const fi=i/layers,rx=maxRX*(0.22+fi*0.78)*(1+Math.sin(t*0.5-i*0.4)*0.03);
    const ry=Math.max(6,rx*0.15*(1-fi*0.3)),yoff=(i-layers/2)*22,alpha=(1-fi*0.6)*0.55+0.08;
    ctx.save(); ctx.translate(cx,cy+yoff);
    ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
    ctx.strokeStyle=`rgba(${r},${g},${b},${alpha})`; ctx.lineWidth=0.8+fi*0.6; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,Math.PI,Math.PI*2);
    ctx.fillStyle=`rgba(${r},${g},${b},${alpha*0.35})`; ctx.fill();
    ctx.restore();
  }
  const scanY=cy-layers*11+(t*0.3%1)*layers*22;
  ctx.beginPath(); ctx.moveTo(cx-maxRX,scanY); ctx.lineTo(cx+maxRX,scanY);
  ctx.strokeStyle=`rgba(${r},${g},${b},0.35)`; ctx.lineWidth=0.8; ctx.stroke();
};

const DRAW_FNS: Partial<Record<ProductKey, DrawFn>> = {
  ritam: drawRitam, ojas: drawOjas, vanijya: drawVanijya, mudra: drawMudra,
  netra: drawNetra, akriti: drawAkriti, sutra: drawSutra,
  'chitra-prana': drawChitraPrana, maya: drawMaya, sangraha: drawSangraha,
};

const ProductViz = React.memo(function ProductViz({ productKey, accent }: { productKey: ProductKey; accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgb = useMemo(() => hexToRgb(accent), [accent]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, t = 0;
    const drawFn = DRAW_FNS[productKey];
    const loop = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      if (canvas.width !== Math.round(W*dpr) || canvas.height !== Math.round(H*dpr)) {
        canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      t += 0.016;
      if (drawFn) drawFn(ctx, W, H, t, rgb);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [productKey, rgb]);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />;
});

// ============================================================
// VISTĀRA · Product Demo Slabs
// Panel emerges FROM the node's screen position and returns
// into it on close. Camera is driven by CameraRig.flyToNode
// before the panel appears.
// ============================================================

type ProductKey = 'ritam' | 'ojas' | 'vanijya' | 'mudra' | 'netra' | 'akriti' | 'sutra' | 'chitra-prana' | 'maya' | 'sangraha' | 'placeholder';

type DemoSpec = {
  key: ProductKey;
  name: string;
  tagline: string;
  domain: string;
  accent: string;
  ctaLabel: string;
  promptPlaceholder: string;
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
    models: ['Ṛtam · Native', 'Ṛtam · Reflective', 'Ṛtam · Vast'],
    sliders: [
      { key: 'depth', label: 'Reflection depth', min: 1, max: 5, def: 3 },
      { key: 'poetic', label: 'Poétic register', min: 0, max: 100, def: 55, unit: '%' },
      { key: 'window', label: 'Time horizon (days)', min: 1, max: 30, def: 7 },
    ],
    outputHint: 'The flow-lines of this moment will manifest here.',
  },
  ojas: {
    key: 'ojas', name: 'VYAN Ojas', tagline: 'Tracking Your Prāṇic Rhythm',
    domain: 'PRĀṆA · RHYTHM', accent: '#ffb84d', ctaLabel: 'Read the pulse',
    promptPlaceholder: 'Describe how you slept, ate, moved — Ojas will surface the prāṇic rhythm.',
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
    models: ['Vaṇijya · Signal', 'Vaṇijya · Macro', 'Vaṇijya · Micro'],
    sliders: [
      { key: 'horizon', label: 'Temporal horizon (days)', min: 1, max: 365, def: 30 },
      { key: 'sensitivity', label: 'Signal sensitivity', min: 0, max: 100, def: 65, unit: '%' },
      { key: 'depth', label: 'Analysis depth', min: 1, max: 5, def: 3 },
    ],
    outputHint: 'The invisible flows of the market will surface here.',
  },
  'chitra-prana': {
    key: 'chitra-prana', name: 'VYAN Chitra-Prāṇa', tagline: 'Breathing Life Into Imagery',
    domain: 'PRĀṆA · IMAGERY', accent: '#a0c8e8', ctaLabel: 'Breathe life',
    promptPlaceholder: 'Describe an image or scene — Chitra-Prāṇa will breathe prāṇa into it.',
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
    models: ['(unmanifest)'], sliders: [],
    outputHint: 'The form is still unseen.',
  },
};

export default function VistaraProductDemo({ productKey }: { productKey: ProductKey }) {
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

  return (
    <div
      className="vpd-veil"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        ref={slabRef}
        className={`vpd-slab ${closing ? 'is-closing' : ''} ${spec.embedUrl ? 'has-embed' : ''}`}
        style={{ ['--accent' as any]: spec.accent }}
      >
        {/* Filament */}
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
                  <ProductViz productKey={productKey} accent={spec.accent} />
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
    </div>
  );
}
