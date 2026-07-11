'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface VistaraSceneProps {
  onOrbHover: (id: string | null) => void
  onOrbClick: (id: string) => void
  hoveredId:  string | null
  activeId:   string | null
}

// ── Shaders ────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0., 1.); }
`

const FRAG = /* glsl */`
precision highp float;
uniform vec2  u_res;
uniform float u_t;   /* seconds */

/* ── Hash / noise ─────────────────────────────────────────────────────── */
float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 114.51);
  return fract(p.x * p.y);
}
float n2d(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  return mix(
    mix(hash(i), hash(i+vec2(1,0)), f.x),
    mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x),
    f.y
  );
}
/* 7-octave FBM — rich nebula detail */
float fbm(vec2 p) {
  float v=0., a=.5;
  for(int i=0;i<7;i++){ v+=a*n2d(p); p=p*2.1+vec2(3.7,1.3); a*=.46; }
  return v;
}

/* ── Stars ────────────────────────────────────────────────────────────── */
float star(vec2 uv, float scale, float thresh, float sz) {
  vec2 g = floor(uv*scale);
  vec2 l = fract(uv*scale)-.5;
  float h = hash(g);
  float vis = step(thresh, h);
  float tw = .6+.4*sin(u_t*(1.2+2.1*hash(g+.5))+h*6.28);
  return (1.-smoothstep(0.,sz,length(l))) * vis * tw;
}

/* ── Main ─────────────────────────────────────────────────────────────── */
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 st = (uv-.5);
  st.x   *= u_res.x / u_res.y;

  float T = u_t * .014;  /* glacial drift — full visual cycle ~90 s */

  /* Spiral domain warp — barely-perceptible vortex */
  float rad = length(st);
  float ang = atan(st.y, st.x) + rad*.5 + T*.25;
  vec2  wp  = uv + vec2(cos(ang), sin(ang)) * rad * .06;

  /* Two-level domain warp for organic nebula */
  vec2 q = vec2(
    fbm(wp               + T*.13),
    fbm(wp + vec2(5.2,1.3) + T*.11)
  );
  vec2 r = vec2(
    fbm(wp + 3.1*q + vec2(1.7, 9.2) + T*.08),
    fbm(wp + 3.1*q + vec2(8.3, 2.8) + T*.06)
  );
  float cl = fbm(wp + 3.*r + T*.04);

  /* ── Colour palette ──────────────────────────────────────────────────── */
  vec3 c = vec3(.006,.002,.015);                                    /* deep void */
  c = mix(c, vec3(.11,.03,.27),  smoothstep(.20,.62,cl)  * .95);   /* violet     */
  c = mix(c, vec3(.03,.05,.22),  smoothstep(.32,.72,q.x) * .75);   /* indigo     */
  c = mix(c, vec3(.26,.05,.17),  smoothstep(.42,.82,r.y) * .50);   /* dark rose  */
  c = mix(c, vec3(.03,.11,.30),  smoothstep(.12,.52,q.y) * .60);   /* deep teal  */
  c = mix(c, vec3(.20,.08,.32),  smoothstep(.50,.90,r.x) * .35);   /* mauve      */

  /* Outer vignette → absolute black at edges */
  float vign = 1. - smoothstep(.55, 1.45, rad);
  c *= vign;

  /* Central glow — the heart of the void */
  c += vec3(.07,.02,.17) * (1.-smoothstep(0.,.65,rad));
  c += vec3(.03,.01,.08) * (1.-smoothstep(0.,.25,rad));

  /* ── Stars: three populations ────────────────────────────────────────── */
  vec3 sw = vec3(.92,.88,1.);
  c += sw       * star(uv + T*.025,  90., .90, .020);        /* medium, sparse   */
  c += sw*.75   * star(uv + T*.018, 150., .92, .013);        /* small, dense     */
  c += sw*1.35  * star(uv*.75+T*.012, 55., .87, .032);       /* large, very rare */

  /* Soft tone-map — prevents over-blow while preserving perceived depth */
  c = c / (c + .45);

  gl_FragColor = vec4(c, 1.);
}
`

// ── WebGL helpers ──────────────────────────────────────────────────────────

function makeShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

// ── Component ──────────────────────────────────────────────────────────────

export function VistaraScene(_props: VistaraSceneProps) {
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false })
    if (!gl) return

    const prog = gl.createProgram()!
    gl.attachShader(prog, makeShader(gl, gl.VERTEX_SHADER,   VERT))
    gl.attachShader(prog, makeShader(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    // Full-screen quad
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uT   = gl.getUniformLocation(prog, 'u_t')

    let raf = 0
    let destroyed = false
    let t0 = -1

    function fit() {
      if (!canvas) return
      const vv = window.visualViewport
      canvas.width  = vv ? Math.round(vv.width)  : (document.documentElement.clientWidth  || window.innerWidth)
      canvas.height = vv ? Math.round(vv.height) : (document.documentElement.clientHeight || window.innerHeight)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    function render(now: number) {
      if (destroyed) return
      if (t0 < 0) t0 = now
      const t = (now - t0) * 0.001

      gl.uniform2f(uRes, canvas!.width, canvas!.height)
      gl.uniform1f(uT, t)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(render)
    }

    const onResize = () => fit()
    const onOrient = () => { fit(); setTimeout(fit, 150); setTimeout(fit, 400) }

    fit()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrient)
    window.visualViewport?.addEventListener('resize', onResize)
    screen.orientation?.addEventListener?.('change', onOrient)

    raf = requestAnimationFrame(render)

    return () => {
      destroyed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrient)
      window.visualViewport?.removeEventListener('resize', onResize)
      screen.orientation?.removeEventListener?.('change', onOrient)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#06000f', width: '100dvw', height: '100dvh', pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </div>,
    document.body,
  )
}
