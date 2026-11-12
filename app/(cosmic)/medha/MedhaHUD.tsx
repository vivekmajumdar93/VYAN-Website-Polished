'use client';

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { COGNITIVE_MODES, CognitiveModeKey, getMode } from '@/lib/medha/cognitive';
import { chatStream, type ChatMessage } from '@/lib/medha/MedhaClient';
import { renderMarkdown, isForbiddenQuery, SANDHI_REDIRECT_MARKDOWN } from '@/lib/medha/markdown';
import {
  getChat, upsertChat, getCurrentChatId, setCurrentChatId, newChatId,
  type StoredMsg,
} from '@/lib/medha/storage';
import { incrementQuota, quotaRemaining } from '@/lib/quota/quota';
import MedhaConsentSlab, {
  hasLocalConsent, hasLocalDenial, clearLocalConsent,
  type ConsentSnapshot,
} from './MedhaConsentSlab';
import './medha.css';

// ── Phase state machine ────────────────────────────────────────────────────────
type Phase = 'idle' | 'absorbing' | 'processing' | 'emerging' | 'responding' | 'error';

// ── Mode colors (rgb components for canvas) ───────────────────────────────────
const MC: Record<CognitiveModeKey, [number, number, number, number, number, number]> = {
  prajna:   [255, 74,  74,  255, 138, 90 ],
  dhyana:   [34,  224, 212, 154, 85,  255],
  akshaya:  [58,  144, 255, 34,  224, 164],
  java:     [255, 184, 77,  255, 42,  74 ],
  sanchara: [255, 102, 136, 58,  212, 255],
};
function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// ── VoidBackground: full-viewport nebula + star field ─────────────────────────
function VoidBackground({ modeKey }: { modeKey: CognitiveModeKey }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(modeKey);
  modeRef.current = modeKey;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;

    type Star = { x: number; y: number; r: number; ph: number; spd: number; layer: number };
    type Blob = { x: number; y: number; br: number; dx: number; dy: number; ch: number; ph: number };

    const stars: Star[] = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.4,
      ph: Math.random() * Math.PI * 2,
      spd: 0.0008 + Math.random() * 0.0028,
      layer: Math.floor(Math.random() * 3),
    }));

    // 4 nebula blobs — positions as fractions of viewport
    const blobs: Blob[] = [
      { x: 0.28, y: 0.22, br: 0.32, dx:  0.000055, dy:  0.000040, ch: 0, ph: 0.0 },
      { x: 0.72, y: 0.58, br: 0.28, dx: -0.000048, dy:  0.000060, ch: 1, ph: 1.8 },
      { x: 0.50, y: 0.78, br: 0.24, dx:  0.000038, dy: -0.000070, ch: 0, ph: 3.5 },
      { x: 0.18, y: 0.65, br: 0.26, dx:  0.000068, dy:  0.000030, ch: 1, ph: 5.0 },
    ];

    let W = 0, H = 0;
    const resize = () => {
      W = c.width  = window.innerWidth;
      H = c.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let raf: number, t = 0;
    const draw = () => {
      t++;
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H);

      const [r1, g1, b1, r2, g2, b2] = MC[modeRef.current];

      // Nebula blobs
      for (const bl of blobs) {
        bl.x += bl.dx; bl.y += bl.dy;
        if (bl.x < -0.1) bl.x = 1.1; if (bl.x > 1.1) bl.x = -0.1;
        if (bl.y < -0.1) bl.y = 1.1; if (bl.y > 1.1) bl.y = -0.1;
        const bx = bl.x * W, by = bl.y * H;
        const bR = bl.br * Math.min(W, H);
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.004 + bl.ph);
        const [br, bg, bb] = bl.ch === 0 ? [r1, g1, b1] : [r2, g2, b2];
        const bg2 = ctx.createRadialGradient(bx, by, 0, bx, by, bR);
        bg2.addColorStop(0, rgba(br, bg, bb, 0.045 * pulse));
        bg2.addColorStop(0.5, rgba(br, bg, bb, 0.018 * pulse));
        bg2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(bx, by, bR, 0, Math.PI * 2);
        ctx.fillStyle = bg2; ctx.fill();
      }

      // Stars
      for (const s of stars) {
        const twinkle = 0.4 + 0.6 * Math.sin(t * s.spd * 60 + s.ph);
        const baseOp = s.layer === 0 ? 0.06 : s.layer === 1 ? 0.10 : 0.16;
        const op = baseOp * twinkle;
        const sx = s.x * W, sy = s.y * H;
        if (s.layer === 2) {
          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 2.5);
          sg.addColorStop(0, `rgba(255,255,255,${(op * 0.3).toFixed(3)})`);
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.beginPath(); ctx.arc(sx, sy, s.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = sg; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${op.toFixed(3)})`; ctx.fill();
      }

      // Centre vignette (draws depth toward portal)
      const vg = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, Math.min(W, H) * 0.55);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
    />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PORTAL SHADER — vertex (NDC pass-through, full-screen quad)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PORTAL_VERT = /* glsl */`
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PORTAL SHADER — fragment  (fBM + ring + orb + lotus + ripples)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PORTAL_FRAG = /* glsl */`
precision highp float;
uniform float u_time;
uniform vec2  u_viewport;
uniform float u_intensity;
uniform float u_speed;
uniform float u_phase;
uniform float u_mr;
uniform float u_mg;
uniform float u_mb;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),
             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * vnoise(p);
    p = p * 2.07 + vec2(31.41, 92.65);
    a *= 0.5;
  }
  return v;
}

void main() {
  float W = u_viewport.x;
  float H = u_viewport.y;
  float t = u_time * u_speed;

  // CSS-convention coords (y=0 at top)
  float px = gl_FragCoord.x;
  float py = H - gl_FragCoord.y;

  bool isLand = W > H * 1.1;

  // Ring geometry
  float cx  = W * 0.5;
  float cy  = isLand ? H * 0.50 : H * 0.44;
  float rxi = isLand ? W * 0.40 : min(W * 0.42, H * 0.32);
  float ryi = isLand ? H * 0.37 : rxi * 0.98;
  float ringW   = min(rxi, ryi) * 0.36;
  float rx_out  = rxi + ringW;
  float ry_out  = ryi + ringW;
  float rx_mid  = rxi + ringW * 0.5;
  float ry_mid  = ryi + ringW * 0.5;

  // Breathing
  float breath  = 2.6 * sin(t * 0.016);
  float rxi_b   = max(rxi + breath * 0.7, 1.0);
  float ryi_b   = max(ryi + breath * 0.7 * (ryi / max(rxi, 1.0)), 1.0);
  float rx_out_b = rxi_b + ringW;
  float ry_out_b = ryi_b + ringW;

  float dx = px - cx;
  float dy = py - cy;

  float d_inner = length(vec2(dx / rxi_b, dy / ryi_b));
  float d_outer = length(vec2(dx / max(rx_out_b,1.0), dy / max(ry_out_b,1.0)));
  float d_mid   = length(vec2(dx / max(rx_mid,1.0),   dy / max(ry_mid,1.0)));

  float glow         = u_intensity;
  float breath_pulse = 0.75 + 0.25 * sin(t * 1.68);

  // 0. Dark base
  vec3 color = vec3(0.008, 0.0, 0.055);

  // 1. Blue nebula wisps
  {
    float dL = length(vec2(px-(cx-rx_out*0.95), py-cy)) / max(rx_out*1.3, 1.0);
    float dR = length(vec2(px-(cx+rx_out*0.95), py-cy)) / max(rx_out*1.3, 1.0);
    color += vec3(0.0,0.08,0.42) * max(0.0, 1.0-dL) * 0.14 * glow;
    color += vec3(0.0,0.08,0.42) * max(0.0, 1.0-dR) * 0.14 * glow;
    float mist = max(0.0, (py/max(H,1.0) - 0.65) / 0.35);
    color += vec3(0.0,0.03,0.14) * mist * 0.16 * glow;
  }

  // 2. Corona + 4 rotating wisps
  {
    float cFade = max(0.0, 1.0 - d_outer / 1.80);
    color += vec3(0.35,0.0,0.70) * pow(cFade, 1.5) * 0.72 * glow;
    for (int k = 0; k < 4; k++) {
      float wa = t*0.006 + float(k)*1.5708;
      float wx = cx + rxi*0.52*cos(wa);
      float wy = cy + ryi*0.52*sin(wa);
      float wr = min(rx_out,ry_out)*0.78;
      float wd = length(vec2(px-wx, py-wy)) / max(wr, 1.0);
      color += vec3(0.90,0.0,0.82) * max(0.0, 1.0-wd) * 0.11 * glow;
    }
  }

  // 3. Rocky ring body
  float ringMask = smoothstep(0.97, 1.0, d_inner) * (1.0 - smoothstep(0.97, 1.0, d_outer));
  if (ringMask > 0.001) {
    float rf = clamp((d_inner-1.0)/max(d_outer-d_inner,0.001), 0.0, 1.0);
    vec2  rp = vec2(dx,dy)*0.008 + t*0.04*vec2(1.0,0.0);
    float n  = fbm(rp);
    vec3 inner = mix(vec3(0.37,0.14,0.03), vec3(0.06,0.02,0.01), n);
    vec3 outer = mix(vec3(0.06,0.02,0.15), vec3(0.14,0.03,0.26), n*0.8);
    color = mix(color, mix(inner,outer,rf)*(0.8+0.2*n), ringMask);
    float dots = fbm(vec2(dx,dy)*0.022 + t*0.02);
    color += ringMask*(dots-0.4)*vec3(0.08,0.04,0.0)*0.4;
    float ang = atan(dy,dx);
    for (int s = 0; s < 3; s++) {
      float sa = float(s)*2.094 + t*0.004;
      float str = sin(ang*4.0+sa)*0.5+0.5;
      color += ringMask*str*vec3(1.0,0.72,0.31)*0.14*glow;
    }
  }

  // 4. Inner fire gradient
  if (d_inner < 1.2) {
    float fs  = pow(clamp(d_inner,0.0,1.0),1.5)*breath_pulse*0.85*glow;
    vec3  fc2 = mix(vec3(1.0,0.75,0.0),vec3(1.0,0.25,0.0),d_inner);
    color += fc2*fs*smoothstep(1.1,0.9,d_inner);
  }

  // 5. Inner fire edge line
  {
    float innerEdge = smoothstep(0.04,0.0,abs(d_inner-1.0))*step(d_inner,1.1);
    color += vec3(1.0,0.74,0.0)*innerEdge*0.9*glow;
  }

  // 6. Inner void
  if (d_inner < 1.0) {
    float va = smoothstep(1.0,0.82,d_inner);
    color = mix(color, vec3(0.004,0.0,0.015), va*0.95);
    float shim = 0.025+0.025*sin(t*1.08);
    vec3  mc2 = vec3(u_mr,u_mg,u_mb)/255.0;
    color += mc2*shim*0.28*(1.0-d_inner*d_inner);
    for (int i = 0; i < 7; i++) {
      float tr = (float(i)+1.0)/8.0*0.95;
      float td = abs(d_inner - tr*tr);
      color += mc2*max(0.0, 0.015-td*20.0)*glow;
    }
    if (u_phase > 0.1) {
      float pulse = 0.5+0.5*sin(t*4.2);
      color += vec3(1.0,0.92,0.72)*u_phase*pulse*0.65*pow(1.0-d_inner,2.0);
    }
  }

  // 7. fBM filaments around ring band
  {
    vec2  fUV = vec2(dx,dy)*0.004;
    float fil = fbm(fUV + t*0.3);
    float rp2 = max(0.0, 1.0-abs(d_mid-1.0)*3.5);
    color += vec3(0.5,0.0,1.0)*fil*rp2*0.18*glow;
  }

  // 8. Purple outer edge
  {
    float oe = smoothstep(0.04,0.0,abs(d_outer-1.0))*step(1.0,d_inner);
    color += vec3(0.82,0.24,1.0)*oe*0.9*glow;
  }

  // 9. Crystal orb  (above ring in CSS = smaller y)
  {
    float orbR = min(rxi_b,ryi_b)*0.092;
    float ox   = cx;
    float oy   = cy - ry_out_b;
    float odx  = px-ox, ody = py-oy;
    float orbD = length(vec2(odx,ody));

    color += vec3(0.60,0.30,1.00)*max(0.0,1.0-orbD/(max(orbR,0.001)*2.6))*0.55*glow;
    color += vec3(1.0,0.72,0.31)*max(0.0,1.0-orbD/(max(orbR,0.001)*3.5))*0.28*glow;

    for (int i = 0; i < 5; i++) {
      float arcR = orbR*(1.9+float(i)*0.95);
      float arcD = abs(orbD-arcR);
      float arcA = max(0.0, 0.55-float(i)*0.09)*glow;
      float upper = step(ody, 0.0);  // 1.0 when above orb center (ody<=0 in CSS)
      color += vec3(1.0,0.72,0.31)*max(0.0,1.0-arcD/(max(orbR,0.001)*0.5))*arcA*upper;
    }

    // Top dot above arcs
    float topDotY = oy - orbR*(1.9+4.0*0.95) - 5.0;
    float topDot  = length(vec2(px-ox, py-topDotY));
    color += vec3(1.0,0.80,0.39)*max(0.0,1.0-topDot/(max(orbR,0.001)*0.3))*0.92*glow;

    if (orbD < orbR) {
      float g2 = 1.0-orbD/orbR;
      color = mix(color, mix(vec3(0.08,0.0,0.32),vec3(0.70,0.55,1.00),pow(g2,0.4)), g2*0.9);
      float spec = max(0.0,1.0-length(vec2(odx+orbR*0.28,ody+orbR*0.28))/(max(orbR,0.001)*0.44));
      color += pow(spec,2.0)*0.75;
    }
    color += vec3(0.78,0.63,1.0)*max(0.0,1.0-abs(orbD-orbR)/(max(orbR,0.001)*0.3))*0.70*glow;

    // Stem connecting orb to ring
    float stemT = smoothstep(0.0,1.0,clamp((py-oy-orbR)/(max(orbR,0.001)*1.5),0.0,1.0));
    float stem  = max(0.0,1.0-abs(px-ox)/(1.5+orbR*0.05))*stemT;
    color += vec3(1.0,0.72,0.31)*stem*0.42*glow;
  }

  // 10. Golden lotus + drop bead chain (below ring in CSS = larger y)
  {
    float ls  = min(rxi_b,ryi_b)*0.082;
    float lx  = cx;
    float ly  = cy + ry_out_b + ls*0.8;
    float ldx = px-lx, ldy = py-ly;
    float ld  = length(vec2(ldx,ldy));

    color += vec3(1.0,0.76,0.24)*max(0.0,1.0-ld/(max(ls,0.001)*3.8))*0.68*glow;

    for (int i = 0; i < 7; i++) {
      float pAng  = -1.5708 + (float(i)-3.0)*0.17;
      vec2  pOff  = vec2(cos(pAng),sin(pAng))*ls*0.5;
      float pDist = length(vec2(ldx-pOff.x, ldy-pOff.y));
      float pA    = max(0.0, 0.68-abs(float(i)-3.0)*0.07)*glow;
      color += vec3(1.0,0.72,0.0)*max(0.0,1.0-pDist/(max(ls,0.001)*0.9))*pA;
    }
    color += vec3(1.0,0.92,0.63)*max(0.0,1.0-ld/(max(ls,0.001)*0.22))*0.96*glow;

    // Bead 1
    { float bs=ls*0.17; float by=ly+ls*1.4+ls*0.26;
      float bd=length(vec2(px-lx,py-by));
      color+=vec3(0.55,0.0,0.85)*max(0.0,1.0-bd/(max(bs,0.001)*2.5))*0.5*glow;
      if(bd<bs) color=mix(color,vec3(0.70,0.40,1.0),(1.0-bd/bs)*0.85);
      else color+=vec3(0.78,0.59,1.0)*max(0.0,1.0-abs(bd-bs)/(max(bs,0.001)*0.3))*0.60*glow; }
    // Bead 2
    { float bs=ls*0.12; float by=ly+ls*1.4+ls*0.26+ls*0.60;
      float bd=length(vec2(px-lx,py-by));
      color+=vec3(0.55,0.0,0.85)*max(0.0,1.0-bd/(max(bs,0.001)*2.5))*0.5*glow;
      if(bd<bs) color=mix(color,vec3(0.70,0.40,1.0),(1.0-bd/bs)*0.85); }
    // Bead 3
    { float bs=ls*0.085; float by=ly+ls*1.4+ls*0.26+ls*0.60+ls*0.46;
      float bd=length(vec2(px-lx,py-by));
      color+=vec3(0.55,0.0,0.85)*max(0.0,1.0-bd/(max(bs,0.001)*2.5))*0.5*glow;
      if(bd<bs) color=mix(color,vec3(0.70,0.40,1.0),(1.0-bd/bs)*0.85); }
    // Bead 4
    { float bs=ls*0.060; float by=ly+ls*1.4+ls*0.26+ls*0.60+ls*0.46+ls*0.36;
      float bd=length(vec2(px-lx,py-by));
      color+=vec3(0.55,0.0,0.85)*max(0.0,1.0-bd/(max(bs,0.001)*2.5))*0.5*glow;
      if(bd<bs) color=mix(color,vec3(0.70,0.40,1.0),(1.0-bd/bs)*0.85); }
  }

  // 11. Water ripples at base
  {
    float ripY = H*0.91;
    float lx2  = cx;
    vec2  rRef = vec2(px-lx2, py-ripY);
    float rx_base = min(rx_out*0.52, W*0.28);
    for (int r = 0; r < 5; r++) {
      float rph    = fract(t*0.016 + float(r)*0.38);
      float rMaxRX = max(rx_base*(0.28+float(r)*0.17), 1.0);
      float rAl    = (0.55-rph*0.55)*0.65*glow;
      if (rAl > 0.01) {
        float rEll = length(vec2(rRef.x/rMaxRX, rRef.y/max(rMaxRX*0.20,1.0)));
        color += vec3(1.0,0.72,0.31)*max(0.0,1.0-abs(rEll-1.0)*12.0)*rAl;
      }
    }
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

// ── MedhaPortalShader: drives uniforms each frame ─────────────────────────────
function MedhaPortalShader({ phase, modeKey }: { phase: Phase; modeKey: CognitiveModeKey }) {
  const { size } = useThree();

  const uniforms = useMemo(() => ({
    u_time:      { value: 0 },
    u_viewport:  { value: new THREE.Vector2(size.width, size.height) },
    u_intensity: { value: 1.0 },
    u_speed:     { value: 1.0 },
    u_phase:     { value: 0.0 },
    u_mr:        { value: MC[modeKey][0] },
    u_mg:        { value: MC[modeKey][1] },
    u_mb:        { value: MC[modeKey][2] },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const vpTarget = useRef(new THREE.Vector2(size.width, size.height));

  useEffect(() => {
    vpTarget.current.set(size.width, size.height);
  }, [size]);

  useEffect(() => {
    uniforms.u_mr.value = MC[modeKey][0];
    uniforms.u_mg.value = MC[modeKey][1];
    uniforms.u_mb.value = MC[modeKey][2];
  }, [modeKey, uniforms]);

  const phaseRef2 = useRef(phase);
  phaseRef2.current = phase;

  useFrame((_, dt) => {
    uniforms.u_time.value += dt;
    // Smooth viewport lerp (~820ms transition on orientation change)
    uniforms.u_viewport.value.lerp(vpTarget.current, Math.min(dt * 5.5, 1));
    // Phase-driven intensity / speed
    const p = phaseRef2.current;
    const tgtI = p === 'processing' ? 2.5 : p === 'absorbing' ? 1.9 : 1.05;
    const tgtS = p === 'processing' ? 2.0 : 1.0;
    const tgtP = p === 'processing' ? 1.0 : (p === 'emerging' || p === 'responding') ? 0.5 : 0.0;
    const lf   = Math.min(dt * 2.0, 1);
    uniforms.u_intensity.value += (tgtI - uniforms.u_intensity.value) * lf;
    uniforms.u_speed.value     += (tgtS - uniforms.u_speed.value)     * lf;
    uniforms.u_phase.value     += (tgtP - uniforms.u_phase.value)     * Math.min(dt * 3, 1);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={PORTAL_VERT}
        fragmentShader={PORTAL_FRAG}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ── CosmicPortal: R3F canvas (full-screen, z:2, behind all UI) ────────────────
function CosmicPortal({ phase, modeKey }: { phase: Phase; modeKey: CognitiveModeKey }) {
  return (
    <Canvas
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
      gl={{ antialias: false, alpha: false, depth: false }}
    >
      <MedhaPortalShader phase={phase} modeKey={modeKey} />
    </Canvas>
  );
}


// ── PortalOrb: pulsing orb with orbiting satellites ───────────────────────────
function PortalOrb({ modeKey }: { modeKey: CognitiveModeKey }) {
  const [r1, g1, b1] = MC[modeKey];

  return (
    <div style={{ position: 'relative', width: 44, height: 44, margin: '0 auto' }}>
      {/* Breathing glow ring */}
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.25, 0.55, 0.25] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          border: `1px solid ${rgba(r1, g1, b1, 0.5)}`,
          pointerEvents: 'none',
        }}
      />
      {/* Satellite A */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: -10, borderRadius: '50%' }}
      >
        <div style={{
          position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
          width: 4, height: 4, borderRadius: '50%',
          background: rgba(r1, g1, b1, 0.95),
          boxShadow: `0 0 7px ${rgba(r1, g1, b1, 0.9)}`,
        }} />
      </motion.div>
      {/* Satellite B */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: -10, borderRadius: '50%' }}
      >
        <div style={{
          position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
          width: 3, height: 3, borderRadius: '50%',
          background: rgba(r1, g1, b1, 0.7),
          boxShadow: `0 0 5px ${rgba(r1, g1, b1, 0.7)}`,
        }} />
      </motion.div>
      {/* Core orb */}
      <motion.div
        animate={{
          y: [0, -6, 0],
          boxShadow: [
            `0 0 10px ${rgba(r1,g1,b1,0.65)}, 0 0 22px ${rgba(r1,g1,b1,0.28)}`,
            `0 0 20px ${rgba(r1,g1,b1,1.0)}, 0 0 40px ${rgba(r1,g1,b1,0.55)}`,
            `0 0 10px ${rgba(r1,g1,b1,0.65)}, 0 0 22px ${rgba(r1,g1,b1,0.28)}`,
          ],
        }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: 12, left: 12,
          width: 20, height: 20, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), ${rgba(r1,g1,b1,0.9)})`,
        }}
      />
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({
  msg, modeKey, fresh = false,
}: { msg: StoredMsg; modeKey: CognitiveModeKey; fresh?: boolean }) {
  const isU = msg.role === 'user';
  const [r1, g1, b1] = MC[modeKey];

  return (
    <motion.div
      initial={fresh ? { opacity: 0, scale: isU ? 1 : 0.06, y: isU ? 10 : 0 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={fresh
        ? isU
          ? { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
          : { duration: 1.1, ease: [0.08, 0.95, 0.3, 1.0] }
        : { duration: 0 }
      }
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: isU ? 'flex-end' : 'flex-start',
        marginBottom: 10,
        transformOrigin: isU ? 'bottom right' : 'top center',
      }}
    >
      {!isU && (
        <span style={{
          fontSize: 9, letterSpacing: '0.22em', color: rgba(r1, g1, b1, 0.5),
          marginBottom: 4, textTransform: 'uppercase', fontFamily: 'var(--font-vyan)',
        }}>
          MEDHĀ
        </span>
      )}
      <motion.div
        animate={!isU ? {
          boxShadow: [
            `0 0 6px ${rgba(r1,g1,b1,0.07)}`,
            `0 0 16px ${rgba(r1,g1,b1,0.20)}`,
            `0 0 6px ${rgba(r1,g1,b1,0.07)}`,
          ],
        } : {}}
        transition={!isU ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 } : {}}
        style={{
          maxWidth: 'min(72vw, 320px)',
          padding: isU ? '9px 13px' : '11px 14px',
          background: isU ? 'rgba(255,255,255,0.05)' : rgba(r1, g1, b1, 0.07),
          border: isU ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${rgba(r1, g1, b1, 0.18)}`,
          borderRadius: isU ? '14px 14px 3px 14px' : '3px 14px 14px 14px',
          fontSize: 12.5, lineHeight: '1.68', letterSpacing: '0.018em',
          color: isU ? 'rgba(255,255,255,0.78)' : 'rgba(255,230,210,0.90)',
          fontFamily: 'var(--font-vyan)',
          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          textShadow: isU ? 'none' : `0 0 12px ${rgba(r1,g1,b1,0.35)}, 0 0 28px ${rgba(r1,g1,b1,0.15)}`,
        }}
      >
        {msg.role === 'assistant'
          ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} className="medha-md" />
          : msg.content
        }
      </motion.div>
    </motion.div>
  );
}

// ── StreamBubble ──────────────────────────────────────────────────────────────
function StreamBubble({ text, modeKey }: { text: string; modeKey: CognitiveModeKey }) {
  const [r1, g1, b1] = MC[modeKey];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.06 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.95, ease: [0.08, 0.95, 0.3, 1.0] }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        marginBottom: 10, transformOrigin: 'top center',
      }}
    >
      <span style={{
        fontSize: 9, letterSpacing: '0.22em', color: rgba(r1, g1, b1, 0.5),
        marginBottom: 4, textTransform: 'uppercase', fontFamily: 'var(--font-vyan)',
      }}>
        MEDHĀ
      </span>
      <motion.div
        animate={{
          boxShadow: [
            `0 0 8px ${rgba(r1,g1,b1,0.1)}`,
            `0 0 20px ${rgba(r1,g1,b1,0.28)}`,
            `0 0 8px ${rgba(r1,g1,b1,0.1)}`,
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          maxWidth: 'min(72vw, 320px)',
          padding: '11px 14px',
          background: rgba(r1, g1, b1, 0.07),
          border: `1px solid ${rgba(r1, g1, b1, 0.18)}`,
          borderRadius: '3px 14px 14px 14px',
          fontSize: 12.5, lineHeight: '1.68', letterSpacing: '0.018em',
          color: 'rgba(255,230,210,0.90)',
          fontFamily: 'var(--font-vyan)',
          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          textShadow: `0 0 12px ${rgba(r1,g1,b1,0.35)}, 0 0 28px ${rgba(r1,g1,b1,0.15)}`,
          minHeight: 40,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text || '…') }} className="medha-md" />
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          style={{
            display: 'inline-block', width: 1, height: '1em',
            background: rgba(r1, g1, b1, 0.8), marginLeft: 2, verticalAlign: 'text-bottom',
          }}
        />
      </motion.div>
    </motion.div>
  );
}

// ── InputBar ──────────────────────────────────────────────────────────────────
interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  modeKey: CognitiveModeKey;
  onModeChange: (k: CognitiveModeKey) => void;
  quotaLeft: number;
}

function InputBar({ value, onChange, onSubmit, disabled, modeKey, onModeChange, quotaLeft }: InputBarProps) {
  const [r1, g1, b1] = MC[modeKey];

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      padding: '10px 14px 14px',
      background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 100%)',
    }}>
      {/* Animated mode pills */}
      <div style={{
        display: 'flex', gap: 5, justifyContent: 'center',
        marginBottom: 8, overflowX: 'auto', paddingBottom: 2,
      }}>
        {COGNITIVE_MODES.map(m => {
          const [mr, mg, mb] = MC[m.key];
          const active = m.key === modeKey;
          return (
            <motion.button
              key={m.key}
              onClick={() => onModeChange(m.key)}
              animate={active ? {
                boxShadow: [
                  `0 0 5px ${rgba(mr,mg,mb,0.18)}`,
                  `0 0 14px ${rgba(mr,mg,mb,0.52)}`,
                  `0 0 5px ${rgba(mr,mg,mb,0.18)}`,
                ],
              } : { boxShadow: '0 0 0px transparent' }}
              transition={active ? { duration: 2.0, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
              style={{
                padding: '3px 10px', borderRadius: 20,
                border: active ? `1px solid ${rgba(mr,mg,mb,0.6)}` : '1px solid rgba(255,255,255,0.1)',
                background: active ? rgba(mr,mg,mb,0.15) : 'transparent',
                color: active ? rgba(mr,mg,mb,0.95) : 'rgba(255,255,255,0.3)',
                fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
                fontFamily: 'var(--font-vyan)', cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >
              {m.name}
            </motion.button>
          );
        })}
      </div>

      {/* Input row with scanning line */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes mc-border-pulse {
            0%,100% { box-shadow:0 0 10px rgba(${r1},${g1},${b1},0.08); border-color:rgba(${r1},${g1},${b1},0.20); }
            50%      { box-shadow:0 0 26px rgba(${r1},${g1},${b1},0.26); border-color:rgba(${r1},${g1},${b1},0.46); }
          }
          @keyframes mc-scan {
            0%        { left:-80%; opacity:0; }
            10%       { opacity:1; }
            70%,100%  { left:120%; opacity:0; }
          }
          .mc-input-pill { animation: mc-border-pulse 2.6s ease-in-out infinite; }
          .mc-scan-line  { animation: mc-scan 5s ease-in-out infinite; animation-delay:1.5s; }
        `}</style>
        <div
          className="mc-input-pill"
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            background: 'rgba(10,6,20,0.72)',
            border: `1px solid ${rgba(r1,g1,b1,0.20)}`,
            borderRadius: 20,
            padding: '8px 10px 8px 14px',
            backdropFilter: 'blur(14px)',
          }}
        >
          {/* Scanning glint */}
          <div
            className="mc-scan-line"
            style={{
              position: 'absolute', top: 0, bottom: 0, width: '30%',
              background: `linear-gradient(to right, transparent 0%, ${rgba(r1,g1,b1,0.08)} 50%, transparent 100%)`,
              pointerEvents: 'none', zIndex: 1,
            }}
          />
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKey}
            disabled={disabled}
            placeholder={disabled ? 'MEDHĀ is weaving…' : 'Enter the void…'}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'rgba(255,230,200,0.88)', fontSize: 13.5,
              fontFamily: 'var(--font-vyan)', resize: 'none', lineHeight: '1.5',
              letterSpacing: '0.02em', maxHeight: 100, overflowY: 'auto',
              position: 'relative', zIndex: 2,
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = '0';
              el.style.height = Math.min(el.scrollHeight, 100) + 'px';
            }}
          />
          <button
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              border: `1px solid ${rgba(r1,g1,b1, disabled || !value.trim() ? 0.18 : 0.55)}`,
              background: disabled || !value.trim() ? 'transparent' : rgba(r1,g1,b1,0.18),
              color: disabled || !value.trim() ? rgba(r1,g1,b1,0.25) : rgba(r1,g1,b1,0.95),
              cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', position: 'relative', zIndex: 2,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {quotaLeft <= 3 && quotaLeft > 0 && (
        <p style={{
          textAlign: 'center', fontSize: 9.5, color: rgba(r1,g1,b1,0.4),
          letterSpacing: '0.14em', margin: '6px 0 0', fontFamily: 'var(--font-vyan)',
        }}>
          {quotaLeft} query{quotaLeft === 1 ? '' : 's'} remaining
        </p>
      )}
    </div>
  );
}

// ── Processing label ──────────────────────────────────────────────────────────
const PROCESS_LABELS = [
  'MEDHĀ is weaving consciousness…',
  'traversing the void…',
  'cognition in motion…',
  'distilling infinite signal…',
];

function ProcessingLabel({ modeKey }: { modeKey: CognitiveModeKey }) {
  const [r1, g1, b1] = MC[modeKey];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % PROCESS_LABELS.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.p
      key={idx}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.5 }}
      style={{
        fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: rgba(r1, g1, b1, 0.55), fontFamily: 'var(--font-vyan)',
        textAlign: 'center', margin: '6px 0 0',
      }}
    >
      {PROCESS_LABELS[idx]}
    </motion.p>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () =>
  typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);

function buildGreeting(isGuest: boolean): string {
  if (isGuest) return 'Hello — I am Medhā. You have entered in guest mode. Our conversation is temporary and will not be saved after you leave. What would you like to explore?';
  return 'Hello — I am Medhā, the Cognitive Intelligence of VYAN. Your conversations here are remembered and await your return. What would you like to explore?';
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MedhaHUD() {
  const router = useRouter();

  const [phase, setPhase]         = useState<Phase>('idle');
  const [mode, setMode]           = useState<CognitiveModeKey>('dhyana');
  const [chatId, setChatId]       = useState('');
  const [messages, setMessages]   = useState<StoredMsg[]>([]);
  const [input, setInput]         = useState('');
  const [streamText, setStream]   = useState('');
  const [errorMsg, setError]      = useState('');
  const [freshIdx, setFreshIdx]   = useState(-1);
  const [flyingText, setFlying]   = useState<string | null>(null);
  const [flyDeltaY, setFlyDeltaY] = useState(0);
  const [gsapQueryText, setGsapQueryText]       = useState('');
  const [gsapResponseText, setGsapResponseText] = useState('');
  const [gatePhase, setGatePhase] = useState<'checking' | 'consent' | 'active'>('checking');
  const [guestMode, setGuestMode] = useState(false);
  const [quotaLeft, setQuota]     = useState(99);

  const abortRef        = useRef<AbortController | null>(null);
  const chatBotRef      = useRef<HTMLDivElement>(null);
  const portalRef       = useRef<HTMLDivElement>(null);
  const queryGSAPRef    = useRef<HTMLDivElement>(null);
  const responseGSAPRef = useRef<HTMLDivElement>(null);
  const phaseRef     = useRef(phase);
  const chatIdRef    = useRef(chatId);
  const messagesRef  = useRef(messages);
  const guestModeRef = useRef(guestMode);
  phaseRef.current     = phase;
  chatIdRef.current    = chatId;
  messagesRef.current  = messages;
  guestModeRef.current = guestMode;

  // ── GSAP: initialize centering on mount ───────────────────────────────────
  useEffect(() => {
    if (queryGSAPRef.current)
      gsap.set(queryGSAPRef.current,    { xPercent: -50, yPercent: -50, opacity: 0 });
    if (responseGSAPRef.current)
      gsap.set(responseGSAPRef.current, { xPercent: -50, yPercent: -50, opacity: 0 });
  }, []);

  // ── GSAP: 6-step animation timeline driven by phase ────────────────────────
  useEffect(() => {
    const q = queryGSAPRef.current;
    const r = responseGSAPRef.current;
    if (!q || !r) return;

    if (phase === 'absorbing') {
      const userMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
      setGsapQueryText(renderMarkdown(userMsg));
      gsap.killTweensOf([q, r]);
      gsap.set(r, { opacity: 0 });
      // Step 2: query flies from bottom to center
      gsap.fromTo(q,
        { y: 80, scale: 0.85, opacity: 0, z: 0, filter: 'blur(0px)' },
        { y: 0,  scale: 1,    opacity: 1, duration: 0.45, ease: 'power2.out',
          onComplete: () => {
            // Step 3: suck into void
            gsap.to(q, { z: -1200, scale: 0.08, opacity: 0, filter: 'blur(12px)',
              duration: 0.85, ease: 'power2.in' });
          }
        }
      );
    }

    if (phase === 'emerging') {
      const content = streamText || [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
      setGsapResponseText(renderMarkdown(content));
      gsap.killTweensOf(r);
      // Step 5: response emerges from void
      gsap.fromTo(r,
        { z: -1200, scale: 0.3, opacity: 0, filter: 'blur(16px)', y: 0 },
        { z: 0,     scale: 1,   opacity: 1, filter: 'blur(0px)',
          duration: 1.5, ease: 'power2.out' }
      );
    }

    if (phase === 'responding') {
      gsap.to(r, { opacity: 1, z: 0, scale: 1, filter: 'blur(0px)', duration: 0.3 });
    }

    if (phase === 'idle') {
      // Show initial greeting / last response faded
      gsap.killTweensOf([q, r]);
      gsap.to(q, { opacity: 0, duration: 0.4 });
      const lastAsst = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
      if (lastAsst) {
        setGsapResponseText(renderMarkdown(lastAsst));
        gsap.to(r, { opacity: 0.82, z: 0, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power1.out' });
      } else {
        gsap.to(r, { opacity: 0, duration: 0.4 });
      }
    }

    if (phase === 'error') {
      gsap.to([q, r], { opacity: 0, duration: 0.4 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── GSAP: keep response text live during streaming ─────────────────────────
  useEffect(() => {
    if ((phase === 'emerging' || phase === 'responding') && streamText) {
      setGsapResponseText(renderMarkdown(streamText));
    }
  }, [streamText, phase]);

  // Gate init
  useEffect(() => {
    setQuota(quotaRemaining('medha'));
    if (hasLocalConsent()) {
      setGuestMode(false);
      setGatePhase('active');
    } else if (hasLocalDenial()) {
      setGuestMode(true);
      setGatePhase('active');
    } else {
      setGatePhase('consent');
    }
  }, []); // eslint-disable-line

  // Chat init when active
  useEffect(() => {
    if (gatePhase !== 'active') return;
    setQuota(quotaRemaining('medha'));
    if (guestMode) {
      const id = newChatId();
      setChatId(id);
      const greeting: StoredMsg = {
        id: uid(), role: 'assistant',
        content: buildGreeting(true),
        mode, ts: Date.now(),
      };
      setMessages([greeting]);
    } else {
      const id = getCurrentChatId() || newChatId();
      setCurrentChatId(id);
      setChatId(id);
      const stored = getChat(id);
      if (stored?.messages?.length) {
        setMessages(stored.messages);
      } else {
        const greeting: StoredMsg = {
          id: uid(), role: 'assistant',
          content: buildGreeting(false),
          mode, ts: Date.now(),
        };
        setMessages([greeting]);
        upsertChat({ id, title: 'New conversation', messages: [greeting], lastInteractionAt: Date.now(), createdAt: Date.now() });
      }
    }
  }, [gatePhase, guestMode]); // eslint-disable-line

  // Auto-scroll
  useEffect(() => {
    if (chatBotRef.current) chatBotRef.current.scrollTop = chatBotRef.current.scrollHeight;
  }, [messages, streamText]);

  const onConsented = useCallback((_snap: ConsentSnapshot) => {
    setGuestMode(false);
    setGatePhase('active');
  }, []);

  const onDenied = useCallback(() => {
    setGuestMode(true);
    setGatePhase('active');
  }, []);

  const switchMode = useCallback((k: CognitiveModeKey) => setMode(k), []);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || phaseRef.current !== 'idle') return;
    if (quotaLeft <= 0) return;

    if (isForbiddenQuery(text)) {
      const sandhi: StoredMsg = { id: uid(), role: 'assistant', content: SANDHI_REDIRECT_MARKDOWN, mode, ts: Date.now() };
      setMessages(prev => { const n = [...prev, sandhi]; setFreshIdx(n.length - 1); return n; });
      setInput('');
      return;
    }

    let deltaY = -300;
    if (portalRef.current) {
      const pr = portalRef.current.getBoundingClientRect();
      deltaY = (pr.top + pr.height / 2) - (window.innerHeight - 90);
    }
    setFlyDeltaY(deltaY);
    setFlying(text);
    setInput('');
    setPhase('absorbing');
    incrementQuota('medha');
    setQuota(quotaRemaining('medha'));

    const userMsg: StoredMsg = { id: uid(), role: 'user', content: text, mode, ts: Date.now() };

    setTimeout(async () => {
      setFlying(null);
      setPhase('processing');
      setMessages(prev => { const next = [...prev, userMsg]; setFreshIdx(next.length - 1); return next; });

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const history: ChatMessage[] = [
        ...messagesRef.current.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: text },
      ];

      let isFirst = true;
      await chatStream(getMode(mode), history, {
        onChunk: (chunk) => {
          if (isFirst) { isFirst = false; setPhase('emerging'); setStream(chunk); }
          else setStream(prev => prev + chunk);
        },
        onDone: (finalText) => {
          const assistantMsg: StoredMsg = { id: uid(), role: 'assistant', content: finalText, mode, ts: Date.now() };
          setMessages(prev => {
            const next = [...prev, assistantMsg];
            setFreshIdx(next.length - 1);
            if (!guestModeRef.current) {
              upsertChat({ id: chatIdRef.current, title: text.slice(0, 55), messages: next, lastInteractionAt: Date.now(), createdAt: Date.now() });
            }
            return next;
          });
          setStream('');
          setPhase('responding');
          setTimeout(() => setPhase('idle'), 600);
        },
        onError: (err) => {
          setError(err.message);
          setStream('');
          setPhase('error');
          setTimeout(() => { setError(''); setPhase('idle'); }, 4000);
        },
      }, ctrl.signal);
    }, 650);
  }, [input, mode, messages, chatId, quotaLeft]);

  const goBack = () => router.push('/vistara');

  const [r1, g1, b1] = MC[mode];
  // innerR no longer needed — CosmicPortal self-sizes responsively

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9200, background: '#000', overflow: 'hidden' }}>

      {/* Background — after checking */}
      {gatePhase !== 'checking' && <VoidBackground modeKey={mode} />}

      {/* Consent gate */}
      {gatePhase === 'consent' && <MedhaConsentSlab onGranted={onConsented} onDenied={onDenied} />}

      {/* Active chat interface */}
      {gatePhase === 'active' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>

          {/* ── Header ──────────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0) 100%)',
          }}>
            {/* Grid / back icon */}
            <button onClick={goBack} title="Back to Vistāra" style={{
              background: 'transparent', border: 'none', padding: 8, cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="4" height="4" rx="0.5"/><rect x="10" y="3" width="4" height="4" rx="0.5"/>
                <rect x="17" y="3" width="4" height="4" rx="0.5"/><rect x="3" y="10" width="4" height="4" rx="0.5"/>
                <rect x="10" y="10" width="4" height="4" rx="0.5"/><rect x="17" y="10" width="4" height="4" rx="0.5"/>
                <rect x="3" y="17" width="4" height="4" rx="0.5"/><rect x="10" y="17" width="4" height="4" rx="0.5"/>
                <rect x="17" y="17" width="4" height="4" rx="0.5"/>
              </svg>
            </button>
            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <motion.span
                animate={{ opacity: [0.55, 0.85, 0.55] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ fontSize: 11, letterSpacing: '0.42em', color: 'rgba(255,210,160,0.90)', fontFamily: 'var(--font-vyan)', textTransform: 'uppercase' }}
              >
                MEDHĀ
              </motion.span>
              <span style={{ fontSize: 7.5, letterSpacing: '0.20em', color: 'rgba(200,180,255,0.42)', fontFamily: 'var(--font-vyan)', textTransform: 'uppercase' }}>
                The Consciousness of VYAN
              </span>
            </div>
            {/* Sound toggle */}
            <button
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('vyan:sound-toggle')); }}
              title="Toggle Sound"
              style={{
                background: 'transparent', border: 'none', padding: 8, cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>
          </div>

          {/* ── Guest mode banner ────────────────────────────────────── */}
          {guestMode && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute', top: 46, left: 0, right: 0, zIndex: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '5px 16px',
                background: 'rgba(255,160,80,0.07)',
                borderBottom: '1px solid rgba(255,160,80,0.10)',
              }}
            >
              <span style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,180,100,0.60)', fontFamily: 'var(--font-vyan)', textTransform: 'uppercase' }}>
                GUEST SESSION · TEMPORARY
              </span>
              <button
                onClick={() => { clearLocalConsent(); setGuestMode(false); setGatePhase('consent'); setMessages([]); }}
                style={{
                  background: 'none', border: '1px solid rgba(255,180,100,0.28)', borderRadius: 20,
                  padding: '2px 8px', color: 'rgba(255,180,100,0.60)', fontSize: 8.5,
                  letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer',
                }}
              >
                Consent &amp; Unlock
              </button>
            </motion.div>
          )}

          {/* ── CosmicPortal: position:fixed background canvas (z:1) ── */}
          <CosmicPortal phase={phase} modeKey={mode} />

          {/* ── GSAP text animation layer (perspective parent for z-axis) ── */}
          <div style={{ position: 'fixed', inset: 0, perspective: '1200px', pointerEvents: 'none', zIndex: 15 }}>
            {/* Query text — flies to center then sucks into void */}
            <div
              ref={queryGSAPRef}
              className="medha-md"
              style={{
                position: 'absolute',
                top: '42svh', left: '50%',
                width: 'min(44vw, 300px)',
                textAlign: 'center',
                mixBlendMode: 'screen',
                color: 'rgba(255,235,195,0.95)',
                fontSize: 13,
                lineHeight: 1.65,
                letterSpacing: '0.018em',
                fontFamily: 'var(--font-vyan)',
                textShadow: '0 0 20px rgba(255,160,0,0.75)',
                wordBreak: 'break-word',
                pointerEvents: 'none',
              }}
              dangerouslySetInnerHTML={{ __html: gsapQueryText }}
            />
            {/* Response text — emerges from void */}
            <div
              ref={responseGSAPRef}
              className="medha-md"
              style={{
                position: 'absolute',
                top: '42svh', left: '50%',
                width: 'min(44vw, 300px)',
                maxHeight: '30svh',
                overflow: 'hidden',
                textAlign: 'center',
                mixBlendMode: 'screen',
                color: 'rgba(255,235,195,0.95)',
                fontSize: 11,
                lineHeight: 1.65,
                letterSpacing: '0.018em',
                fontFamily: 'var(--font-vyan)',
                textShadow: '0 0 18px rgba(255,160,0,0.55)',
                wordBreak: 'break-word',
                WebkitLineClamp: 7,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                pointerEvents: 'none',
              }}
              dangerouslySetInnerHTML={{ __html: gsapResponseText }}
            />
          </div>

          {/* ── Error label — position:fixed ──────────────────────────── */}
          <div style={{ position: 'fixed', top: '53svh', left: '50%', transform: 'translateX(-50%)', zIndex: 15 }}>
            <AnimatePresence mode="wait">
              {phase === 'processing' && <ProcessingLabel key="proc" modeKey={mode} />}
              {phase === 'error' && (
                <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'rgba(255,100,100,0.65)', fontFamily: 'var(--font-vyan)', textAlign: 'center' }}>
                  {errorMsg || 'Signal lost — try again'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* ── Layout spacer: reserves height for the ring in portrait ── */}
          <div ref={portalRef} style={{ flex: '0 0 68svh', minHeight: 0, width: '100%' }} />

          {/* ── Chat history (scrollable, below portal) ──────────────── */}
          <div
            ref={chatBotRef}
            style={{ flex: 1, width: '100%', maxWidth: 520, overflowY: 'auto', overflowX: 'hidden', padding: '8px 16px 120px', scrollbarWidth: 'none', position: 'relative', zIndex: 5 }}
            onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
            onTouchMove={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              const dy = (el as any)._touchY - e.touches[0].clientY;
              (el as any)._touchY = e.touches[0].clientY;
              el.scrollTop += dy;
            }}
          >
            <div style={{ position: 'sticky', top: 0, height: 24, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', marginBottom: -24, zIndex: 1 }} />
            {messages.map((m, i) => {
              // suppress the first auto-greeting — it shows in the void instead
              if (i === 0 && m.role === 'assistant' && messages.length === 1) return null;
              return <ChatBubble key={m.id} msg={m} modeKey={mode} fresh={i === freshIdx} />;
            })}
            <AnimatePresence>
              {streamText && phase !== 'emerging' && phase !== 'responding' && <StreamBubble key="stream" text={streamText} modeKey={mode} />}
            </AnimatePresence>
          </div>

          {/* ── Input bar ────────────────────────────────────────────── */}
          <InputBar value={input} onChange={setInput} onSubmit={submit} disabled={phase !== 'idle'} modeKey={mode} onModeChange={switchMode} quotaLeft={quotaLeft} />

        </div>
      )}

      {/* ── Flying text overlay (absorption) ─────────────────────── */}
      <AnimatePresence>
        {flyingText && (
          <motion.div
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: 0, scale: 0.04, y: flyDeltaY }}
            transition={{ duration: 0.65, ease: [0.4, 0, 0.8, 1] }}
            style={{
              position: 'fixed', bottom: 86, left: '50%', transform: 'translateX(-50%)',
              zIndex: 200, maxWidth: 280, padding: '9px 13px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '14px 14px 3px 14px',
              fontSize: 12.5, lineHeight: '1.6', color: 'rgba(255,255,255,0.78)',
              fontFamily: 'var(--font-vyan)', pointerEvents: 'none',
              textAlign: 'center', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              transformOrigin: 'center bottom',
            }}
          >
            {flyingText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
