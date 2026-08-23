'use client';
// Shared per-product animated canvas visualizations
// Used by both QuantumGrid inline panel and VistaraProductDemo pages.
import React, { useEffect, useMemo, useRef } from 'react';

export function hexToRgb(hex: string): [number, number, number] {
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

// Map covers both gateway IDs (rtam, akriti…) and product-page keys (ritam, akriti…)
export const DRAW_FNS: Record<string, DrawFn> = {
  rtam: drawRitam, ritam: drawRitam,
  ojas: drawOjas,
  vanijya: drawVanijya,
  mudra: drawMudra,
  netra: drawNetra,
  akriti: drawAkriti,
  sutra: drawSutra,
  'chitra-prana': drawChitraPrana,
  maya: drawMaya,
  sangraha: drawSangraha,
};

export const ProductViz = React.memo(function ProductViz({
  id, accent,
}: { id: string; accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgb = useMemo(() => hexToRgb(accent), [accent]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, t = 0;
    const drawFn = DRAW_FNS[id];
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
  }, [id, rgb]);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
});
