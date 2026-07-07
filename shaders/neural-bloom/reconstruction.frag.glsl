// Reconstruction fragment — particle dissolve into Medhā realm elements
// Draws glowing outlines of UI elements assembling from converging particles

uniform float uTime;
uniform float uProgress;  // 0–1 within Phase 6
uniform vec2 uResolution;

varying vec2 vUv;

// Inlined simplex 2D for dissolve noise
vec2 _rmod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 _rmod289_3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec3 _rperm(vec3 x){return _rmod289_3(((x*34.)+1.)*x);}
float rsnoise2(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;
  i=_rmod289(i);
  vec3 p=_rperm(_rperm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
  m=m*m;m=m*m;
  vec3 x2=2.*fract(p*C.www)-1.;vec3 h=abs(x2)-0.5;
  vec3 ox=floor(x2+0.5);vec3 a0=x2-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}

// Soft glowing line SDF
float lineSDF(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Glowing element drawn as lines
float glowLine(vec2 uv, vec2 a, vec2 b, float thickness) {
  float d = lineSDF(uv, a, b);
  return exp(-d * d / (thickness * thickness));
}

// Draw one glass panel rectangle outline
float glassPanel(vec2 uv, vec2 center, vec2 size, float reveal, float glow) {
  vec2 hs = size * 0.5;
  vec2 p  = uv - center;
  // SDF box outline
  vec2 d  = abs(p) - hs;
  float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  float edge = 1.0 - smoothstep(0.0, glow, dist + glow * 0.5);
  float fill = (1.0 - smoothstep(-0.001, 0.002, dist)) * 0.07;
  return (edge + fill) * reveal;
}

void main() {
  float p = uProgress;
  vec2 uv = vUv; // 0–1 UV

  // Dissolve noise for particle materialization
  float noise = rsnoise2(uv * 6.0 + vec2(uTime * 0.3, 0.0)) * 0.5 + 0.5;
  float dissolve = smoothstep(p - 0.12, p + 0.12, noise);

  vec3 violet = vec3(0.482, 0.184, 1.0);
  vec3 blue   = vec3(0.176, 0.435, 1.0);
  vec3 gold   = vec3(0.831, 0.659, 0.325);
  vec3 white  = vec3(0.90, 0.82, 1.00);
  vec3 col    = vec3(0.0);
  float alpha = 0.0;

  // 1. Background void crystallizes to deep indigo
  float bgReveal = clamp(p * 3.5, 0.0, 1.0);
  vec3 voidCol = vec3(0.102, 0.039, 0.239);
  col += voidCol * bgReveal * dissolve;
  alpha = bgReveal * dissolve * 0.85;

  // 2. Composer input bar (bottom center, assembles first at p=0.1)
  float composerReveal = clamp((p - 0.1) * 5.0, 0.0, 1.0);
  float composerGlow = glassPanel(uv, vec2(0.5, 0.88), vec2(0.55, 0.06), composerReveal, 0.006);
  col += mix(blue, white, composerGlow) * composerGlow * 3.0;
  alpha = max(alpha, composerGlow * composerReveal);

  // 3. MEDHA wordmark — five letter outlines at center (p=0.25)
  float textReveal = clamp((p - 0.25) * 4.0, 0.0, 1.0);
  // Letter positions — simplified as glowing horizontal strokes
  for (int li = 0; li < 5; li++) {
    float lx = 0.32 + float(li) * 0.09;
    float ly = 0.42;
    float stroke = glowLine(uv, vec2(lx, ly - 0.025), vec2(lx + 0.06, ly - 0.025), 0.003);
    stroke += glowLine(uv, vec2(lx, ly),              vec2(lx + 0.06, ly),           0.003);
    stroke += glowLine(uv, vec2(lx, ly - 0.025),      vec2(lx, ly + 0.025),          0.003);
    stroke += glowLine(uv, vec2(lx + 0.06, ly-0.025), vec2(lx + 0.06, ly + 0.025),  0.003);
    col += white * stroke * textReveal * 2.5;
    alpha = max(alpha, stroke * textReveal);
  }

  // 4. Neural strip dots — 7 dots appearing one by one (p=0.55)
  float dotsReveal = clamp((p - 0.55) * 5.0, 0.0, 1.0);
  for (int di = 0; di < 7; di++) {
    float dx    = 0.33 + float(di) * 0.06;
    float dotT  = clamp((dotsReveal - float(di) * 0.08) * 5.0, 0.0, 1.0);
    float dotD  = length(uv - vec2(dx, 0.72));
    float dotG  = exp(-dotD * dotD / (0.004 * 0.004)) * dotT;
    col  += blue * dotG * 4.0;
    alpha = max(alpha, dotG * 0.8);
  }

  // 5. Golden arch outline (p=0.4)
  float archReveal = clamp((p - 0.4) * 4.0, 0.0, 1.0);
  for (int ai = -10; ai <= 10; ai++) {
    float at = float(ai) / 10.0;
    float ax = 0.5 + sin(at * 3.14159) * 0.25;
    float ay = 0.55 - (1.0 - abs(at)) * 0.28;
    float ad = length(uv - vec2(ax, ay));
    float ag = exp(-ad * ad / (0.003 * 0.003));
    col  += gold * ag * 3.0 * archReveal;
    alpha = max(alpha, ag * archReveal);
  }

  // 6. Hanging pendant orbs (p=0.65)
  float pendReveal = clamp((p - 0.65) * 6.0, 0.0, 1.0);
  for (int pi = 0; pi < 3; pi++) {
    float px  = 0.38 + float(pi) * 0.12;
    float py  = 0.60 + sin(uTime * 1.5 + float(pi)) * 0.004;
    float pd  = length(uv - vec2(px, py));
    float pg  = exp(-pd * pd / (0.007 * 0.007));
    col  += gold * pg * 5.0 * pendReveal;
    alpha = max(alpha, pg * pendReveal);
  }

  // 7. Final pulse: synchronized violet flash at p=0.9
  float pulse = clamp((p - 0.88) * 12.0, 0.0, 1.0) * clamp((1.0 - p) * 12.0, 0.0, 1.0);
  col  += violet * pulse * 2.0;
  alpha = max(alpha, pulse * 0.5);

  alpha = clamp(alpha, 0.0, 1.0);
  if (alpha < 0.005) discard;

  gl_FragColor = vec4(col, alpha);
}
