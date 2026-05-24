type ProductInfo = {
title: string;
subtitle: string;
description: string;
color?: string;
};
type PanelOrigin = {
x: number;
y: number;
};
type OverlayCallbacks = {
  onJumpToOrb: (index: number) => void;
  onToggleSound: () => void;
  onSetVolume: (value: number) => void;
  onClosePanel: () => void;
};
export class Overlay {
  public element = document.createElement('div');
  private callbacks?: OverlayCallbacks;
  private soundConsole = document.createElement('button');
  private soundOverlay = document.createElement('div');
  private soundCard = document.createElement('div');
  private volumeSlider!: HTMLInputElement;
  private muteBtn!: HTMLButtonElement;
  private visualizerBars: HTMLDivElement[] = [];

  private rail = document.createElement('div');
private railFill = document.createElement('div');
private railNodes: HTMLButtonElement[] = [];
private panel = document.createElement('div');
private panelTitle = document.createElement('div');
private panelSubtitle = document.createElement('div');
private panelBody = document.createElement('div');
private panelClose = document.createElement('button');
private gatewayHint = document.createElement('div');
private cursorHint = document.createElement('div');
private distanceLabel = document.createElement('div');
private shunyaCaption = document.createElement('div');
private shunyaName = document.createElement('div');
private shunyaTag = document.createElement('div');
private depthLy!: HTMLDivElement;
private gatewayInfo!: HTMLButtonElement;
private gatewayInfoPanel!: HTMLDivElement;
  private introComplete = false;
  private voidMode = false;
  private currentApproach = 0;
  private cursorHovered = false;
  private fadeOverlay: HTMLDivElement | null = null;
  constructor(private root: HTMLElement) {
this.element.className = 'vyan-ui';
this.soundConsole.className = 'sound-console';
this.soundConsole.type = 'button';
this.soundConsole.textContent = 'SOUND OFF';
// Hide the legacy in-canvas SOUND OFF button — the unified Acoustic
// Console (React component) on the top-left now owns this UI. We keep
// the element to preserve the muted-state hooks below but make it invisible.
this.soundConsole.style.display = 'none';
this.rail.className = 'neural-depth';
this.railFill.className = 'neural-depth-fill';
this.rail.appendChild(this.railFill);
for (let i = 0; i < 7; i++) {
const node = document.createElement('button');
node.type = 'button';
node.className = 'depth-node';
const tip = document.createElement('span');
tip.className = 'depth-tooltip';
node.appendChild(tip);
node.addEventListener('pointerenter', () => tip.classList.add('show'));
node.addEventListener('pointerleave', () => tip.classList.remove('show'));
node.addEventListener('pointerdown', (e) => {
e.stopPropagation();
this.callbacks?.onJumpToOrb(i);
});
this.rail.appendChild(node);
this.railNodes.push(node);
}
// LY counter — top-LEFT corner, NOT in the rail, so it's always visible
// and never conflicts with the concierge in the top-right.
this.depthLy = document.createElement('div');
this.depthLy.className = 'depth-ly-rail';
this.rail.addEventListener('pointerdown', (e) => {
const rect = this.rail.getBoundingClientRect();
const y = (e.clientY - rect.top) / rect.height;
const idx = Math.max(0, Math.min(6, Math.floor(y * 7)));
this.callbacks?.onJumpToOrb(idx);
});
this.gatewayHint.className = 'gateway-hint';
    this.gatewayHint.innerHTML = `
      <div class="gateway-line-1">VYŌMA</div>
      <div class="gateway-line-2">The Primordial Core of VYAN</div>
      <div class="gateway-line-3">Engage to enter the Void of VYAN</div>
    `;
    this.gatewayHint.style.opacity = '0';
    this.cursorHint.className = 'cursor-hint';
    this.cursorHint.innerHTML = `
      <span>initiate displacement</span>
      <div class="scroll-indicator"></div>
      <span class="cursor-hint__sub">scroll · swipe · drag</span>
    `;
    this.cursorHint.style.opacity = '0';
    // ---- Gateway-only instructions icon (cinematic guide, replaces dormant rail) ----
    const gatewayInfo = document.createElement('button');
    gatewayInfo.className = 'gateway-info';
    gatewayInfo.type = 'button';
    gatewayInfo.setAttribute('aria-label', 'Guide to the cosmos');
    gatewayInfo.innerHTML = `
      <span class="gateway-info__halo"></span>
      <span class="gateway-info__glyph">i</span>
      <span class="gateway-info__orbit"></span>
    `;
    this.gatewayInfo = gatewayInfo;
    const gatewayPanel = document.createElement('div');
    gatewayPanel.className = 'gateway-info-panel';
    gatewayPanel.innerHTML = `
      <div class="gateway-info-panel__inner">
        <div class="gateway-info-panel__kicker">Codex of the Traveler</div>
        <h3 class="gateway-info-panel__title">A Field Guide to Wandering</h3>
        <div class="gateway-info-panel__step"><span class="gp-n">i.</span><div>
          This is not a website — it is a <strong>cosmos rendered into glass</strong>. You are the traveler, the breath, the witness. The screen is your sky.</div></div>
        <div class="gateway-info-panel__step"><span class="gp-n">ii.</span><div>
          <strong>Scroll, swipe, or drag</strong> to set yourself adrift. The gateway will draw closer the more attention you offer it. When the core finds its centre, <em>engage</em> — and you cross.</div></div>
        <div class="gateway-info-panel__step"><span class="gp-n">iii.</span><div>
          Inside the void, every orb is a chamber of meaning. Continue scrolling to traverse, or <strong>click</strong> any orb to step into the slab it conceals. Each slab is a window into one face of VYAN.</div></div>
        <div class="gateway-info-panel__step"><span class="gp-n">iv.</span><div>
          To the right of your screen, a faint rail keeps the depth you have travelled. To the left, the <em>Sound Console</em> tunes the music of the spheres. They are quiet — until you summon them.</div></div>
        <div class="gateway-info-panel__step"><span class="gp-n">v.</span><div>
          Wherever you wander, the <strong>Concierge</strong> walks beside you — a small luminous companion, ready to speak, to nudge, to ferry you elsewhere. And the deeper void hides a presence that does not need a name.</div></div>
        <div class="gateway-info-panel__foot">
          <span>esc to close</span><span>press <em>i</em> to summon again</span>
        </div>
        <button type="button" class="gateway-info-panel__x" aria-label="close">✕</button>
      </div>
    `;
    this.gatewayInfoPanel = gatewayPanel;
    gatewayInfo.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      gatewayPanel.classList.toggle('open');
    });
    (gatewayPanel.querySelector('.gateway-info-panel__x') as HTMLElement)?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      gatewayPanel.classList.remove('open');
    });
    gatewayPanel.addEventListener('pointerdown', (e) => {
      // click outside the inner card closes
      if (e.target === gatewayPanel) gatewayPanel.classList.remove('open');
    });
    // Keyboard shortcut "i" to summon the codex (only on gateway).
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (this.voidMode) return;
      if (e.key === 'i' || e.key === 'I') {
        gatewayPanel.classList.toggle('open');
      }
      if (e.key === 'Escape') gatewayPanel.classList.remove('open');
    });
    this.distanceLabel.className = 'distance-label';
    this.distanceLabel.style.opacity = '0';
    this.shunyaCaption.className = 'shunya-caption';
    this.shunyaName.className = 'shunya-name';
    this.shunyaTag.className = 'shunya-tag';
    this.shunyaCaption.appendChild(this.shunyaName);
    this.shunyaCaption.appendChild(this.shunyaTag);
    this.shunyaCaption.style.opacity = '0';
    this.panel.className = 'glass-panel';
    this.panel.innerHTML = `
      <div class="glass-panel-inner">
        <div class="glass-panel-kicker">SHUNYA MANDALA</div>
      </div>
    `;
this.panelTitle.className = 'glass-title';
this.panelSubtitle.className = 'glass-subtitle';
this.panelBody.className = 'glass-body';
this.panelClose.className = 'glass-close';
this.panelClose.type = 'button';
this.panelClose.textContent = 'CLOSE';
this.panelClose.addEventListener('pointerdown', (e) => {
e.stopPropagation();
this.callbacks?.onClosePanel();
});
// Click-outside-to-close — pointer on the panel veil (outside the card)
// must close the slab. Works on touch and mouse.
this.panel.addEventListener('pointerdown', (e) => {
  const target = e.target as HTMLElement;
  if (!target) return;
  // Only close when clicking the panel root itself (not bubbling from card)
  if (target === this.panel) {
    e.stopPropagation();
    this.callbacks?.onClosePanel();
  }
});
// ESC key — close any open glass panel.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && this.panel.classList.contains('is-open')) {
    e.stopPropagation();
    this.callbacks?.onClosePanel();
  }
});
const inner = this.panel.querySelector('.glass-panel-inner') as HTMLElement;
inner.appendChild(this.panelTitle);
inner.appendChild(this.panelSubtitle);
inner.appendChild(this.panelBody);
// Close lives OUTSIDE the scrollable inner so it stays anchored top-right
// even when the user scrolls long-form content.
this.panel.appendChild(this.panelClose);
    this.soundConsole.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.toggleSoundPanel(true);
    });

    this.createSoundPanel();

    this.element.appendChild(this.soundConsole);
    this.element.appendChild(this.soundOverlay);
this.element.appendChild(this.rail);
this.element.appendChild(this.gatewayHint);
this.element.appendChild(this.cursorHint);
this.element.appendChild(this.distanceLabel);
this.element.appendChild(this.shunyaCaption);
this.element.appendChild(this.gatewayInfo);
this.element.appendChild(this.gatewayInfoPanel);
// LY counter is a CHILD of the rail so it's positioned relative to the rail
// (riding alongside the active node), not the viewport.
this.rail.appendChild(this.depthLy);
this.element.appendChild(this.panel);
}
bind(callbacks: OverlayCallbacks) {
this.callbacks = callbacks;
}
mount() {
this.root.appendChild(this.element);
}
unmount() {
try { this.element.remove(); } catch {}
try { this.soundOverlay.remove(); } catch {}
}
endIntro() {
this.introComplete = true;
// Immediately show the INITIATE hint so the user knows what to do.
this.updateHintVisibility();
}
  private createSoundPanel() {
    this.soundOverlay.className = 'sound-panel-overlay';
    this.soundCard.className = 'sound-card';
    
    this.soundCard.innerHTML = `
      <div class="sound-card-header">
        <div class="sound-card-title">Acoustic Logic</div>
        <button class="sound-card-close" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="sound-control-row">
        <div class="sound-label">
          <span>Master Amplitude</span>
          <span class="val-txt">80%</span>
        </div>
        <input type="range" class="volume-slider" min="0" max="100" value="80">
      </div>
      <div class="sound-control-row">
        <div class="sound-label">Atmospheric Resonance</div>
        <div class="visualizer-container"></div>
      </div>
      <button class="mute-toggle-btn" type="button">TRANSMISSION ACTIVE</button>
    `;

    const closeBtn = this.soundCard.querySelector('.sound-card-close') as HTMLElement;
    closeBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.toggleSoundPanel(false);
    });

    this.soundOverlay.addEventListener('pointerdown', (e) => {
      if (e.target === this.soundOverlay) {
        this.toggleSoundPanel(false);
      }
    });

    this.volumeSlider = this.soundCard.querySelector('.volume-slider') as HTMLInputElement;
    const valTxt = this.soundCard.querySelector('.val-txt') as HTMLElement;
    this.volumeSlider.addEventListener('input', () => {
      const val = parseInt(this.volumeSlider.value);
      valTxt.textContent = `${val}%`;
      this.callbacks?.onSetVolume(val / 100);
    });

    this.muteBtn = this.soundCard.querySelector('.mute-toggle-btn') as HTMLButtonElement;
    this.muteBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.callbacks?.onToggleSound();
    });

    const viz = this.soundCard.querySelector('.visualizer-container') as HTMLElement;
    for (let i = 0; i < 24; i++) {
      const bar = document.createElement('div');
      bar.className = 'visualizer-bar';
      bar.style.height = '4px';
      viz.appendChild(bar);
      this.visualizerBars.push(bar);
    }

    this.soundOverlay.appendChild(this.soundCard);
  }

  private toggleSoundPanel(on: boolean) {
    this.soundOverlay.classList.toggle('open', on);
  }

  setSoundMuted(muted: boolean) {
    this.soundConsole.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    this.soundConsole.classList.toggle('muted', muted);
    
    if (this.muteBtn) {
      this.muteBtn.textContent = muted ? 'TRANSMISSION MUTED' : 'TRANSMISSION ACTIVE';
      this.muteBtn.classList.toggle('active', !muted);
    }
  }

  updateVisualizer(energy: number) {
    if (!this.soundOverlay.classList.contains('open')) return;
    this.visualizerBars.forEach((bar, i) => {
      const var1 = Math.sin(Date.now() * 0.01 + i * 0.5) * 0.2 + 0.8;
      const h = (energy * 100 * var1) + (Math.random() * 5);
      bar.style.height = `${Math.max(2, Math.min(100, h))}%`;
    });
  }
  setCursorHint(on: boolean) {
    if (!this.introComplete || this.voidMode) return;
    this.cursorHovered = on;
    this.updateHintVisibility();
  }

  setGatewayCaption(approach: number) {
    if (!this.introComplete || this.voidMode) return;
    this.currentApproach = approach;
    this.updateHintVisibility();
  }

  private updateHintVisibility() {
    // ---- VYŌMA caption (appears only AFTER user starts displacing) ----
    // Threshold pushed to 0.18 so it never overlaps the INITIATE hint.
    const fadeIn = 0.18;
    const fadeFull = 0.55;
    let gatewayOpacity = 0;
    if (this.currentApproach > fadeIn) {
      gatewayOpacity = Math.min((this.currentApproach - fadeIn) / (fadeFull - fadeIn), 1);
      gatewayOpacity = gatewayOpacity * gatewayOpacity * (3 - 2 * gatewayOpacity);
    }
    const blurPx = 12 * (1 - gatewayOpacity);
    this.gatewayHint.style.opacity = String(gatewayOpacity);
    this.gatewayHint.style.filter = `blur(${blurPx}px)`;
    // Caption stays anchored at the bottom of the viewport. Subtle scale-up
    // and slight lift as the orb arrives — but NO traversal to the centre.
    const scaleVal = 1 + this.currentApproach * 0.08;
    const liftPx = this.currentApproach * 30;
    this.gatewayHint.style.transform = `translateX(-50%) translateY(${-liftPx}px) scale(${scaleVal})`;

    // ---- INITIATE hint (shown first, pulses, fades as user starts scrolling) ----
    // Visible immediately after intro completes (no mouse-move gating).
    let cursorOpacity = 0;
    if (this.introComplete && !this.voidMode) {
      // Full visibility from approach 0 → 0.10, then fade out by 0.30.
      if (this.currentApproach < 0.1) cursorOpacity = 1;
      else if (this.currentApproach < 0.3) cursorOpacity = 1 - (this.currentApproach - 0.1) / 0.2;
      else cursorOpacity = 0;
    }
    this.cursorHint.style.opacity = String(cursorOpacity);
    this.cursorHint.style.pointerEvents = cursorOpacity > 0.5 ? 'auto' : 'none';
  }
setVoidMode(on: boolean) {
this.voidMode = on;
this.rail.classList.toggle('visible', on);
// FULLY remove the rail from the gateway (not even a dormant background).
this.rail.style.display = on ? '' : 'none';
this.rail.style.pointerEvents = on ? 'auto' : 'none';
this.distanceLabel.style.opacity = on ? '1' : '0';
// Gateway-only Codex icon — visible only when NOT inside a void.
if (this.gatewayInfo) this.gatewayInfo.style.display = on ? 'none' : '';
if (on && this.gatewayInfoPanel) this.gatewayInfoPanel.classList.remove('open');
if (on) {
this.gatewayHint.style.opacity = '0';
this.cursorHint.style.opacity = '0';
} else {
this.shunyaCaption.style.opacity = '0';
}
}
setDistance(approach: number) {
if (!this.voidMode) {
this.distanceLabel.style.opacity = '0';
return;
}
const ly = Math.max(0, Math.floor((1 - Math.min(approach / 0.82, 1)) * 420));
this.distanceLabel.textContent = ly === 0 ? 'NEURAL LOCK: 0 LY' : `${ly.toLocaleString()} LIGHT YEARS REMAINING`;
this.distanceLabel.style.letterSpacing = `${(1-approach) * 4}px`;
this.distanceLabel.style.opacity = '1';
}
setDepthProgress(_loopProgress: number, _activeIndex: number, _panelOpen: boolean, _mode: 'gateway') {
const enabled = false;
this.rail.classList.toggle('visible', enabled);
this.rail.style.pointerEvents = 'none';
}
fadeToBlack(durationSeconds: number) {
this.clearFade();
const darkness = document.createElement('div');
darkness.dataset.vyanFade = '1';
darkness.style.position = 'fixed';
darkness.style.top = '0';
darkness.style.left = '0';
darkness.style.width = '100vw';
darkness.style.height = '100vh';
darkness.style.background = '#000000';
darkness.style.opacity = '0';
darkness.style.pointerEvents = 'none';
darkness.style.zIndex = '10000';
darkness.style.transition = `opacity ${durationSeconds}s ease-in-out`;
document.body.appendChild(darkness);
this.fadeOverlay = darkness;
darkness.getBoundingClientRect();
darkness.style.opacity = '1';
this.element.style.transition = `opacity ${durationSeconds}s ease-in-out`;
this.element.style.opacity = '0';
this.element.style.pointerEvents = 'none';
}
clearFade() {
  document.querySelectorAll('[data-vyan-fade="1"]').forEach(el => el.remove());
  this.fadeOverlay = null;
  // Restore overlay visibility
  this.element.style.transition = 'opacity 0.6s ease-out';
  this.element.style.opacity = '1';
  this.element.style.pointerEvents = 'auto';
}
fadeFromBlack(durationSeconds = 1.4) {
  // Ensures a black overlay exists, then fades it out (used when emerging into a void).
  let darkness = this.fadeOverlay;
  if (!darkness) {
    darkness = document.createElement('div');
    darkness.dataset.vyanFade = '1';
    darkness.style.position = 'fixed';
    darkness.style.top = '0';
    darkness.style.left = '0';
    darkness.style.width = '100vw';
    darkness.style.height = '100vh';
    darkness.style.background = '#000000';
    darkness.style.opacity = '1';
    darkness.style.pointerEvents = 'none';
    darkness.style.zIndex = '10000';
    document.body.appendChild(darkness);
    this.fadeOverlay = darkness;
    darkness.getBoundingClientRect();
  }
  // Restore overlay UI visibility in parallel
  this.element.style.transition = `opacity ${durationSeconds}s ease-out`;
  this.element.style.opacity = '1';
  this.element.style.pointerEvents = 'auto';
  // Then fade the darkness out
  darkness.style.transition = `opacity ${durationSeconds}s ease-out`;
  darkness.style.opacity = '0';
  const el = darkness;
  setTimeout(() => { try { el.remove(); } catch {} if (this.fadeOverlay === el) this.fadeOverlay = null; }, (durationSeconds + 0.1) * 1000);
}
openPanel(info: ProductInfo & { html?: string }, origin?: PanelOrigin) {
if (origin) {
this.panel.style.setProperty('--origin-x', `${origin.x}px`);
this.panel.style.setProperty('--origin-y', `${origin.y}px`);
}
this.panelTitle.textContent = info.title;
this.panelSubtitle.textContent = info.subtitle;
if (info.html) {
  this.panelBody.innerHTML = info.html;
  // Wire any forms inside the slab to /api endpoints. Idempotent — runs on every panel open.
  this.wireSlabForms();
} else {
  this.panelBody.textContent = info.description;
}
this.panel.classList.add('open');
}

// Wires any [data-vyan-form] forms inside the slab body to the matching API.
private wireSlabForms() {
  const form = this.panelBody.querySelector('form[data-vyan-form="sankalpa"]') as HTMLFormElement | null;
  if (!form) return;
  if ((form as any).__wired) return;
  (form as any).__wired = true;

  // Dynamic field visibility (Individual vs Enterprise, product intent)
  const reflect = () => {
    const type = (form.elements.namedItem('type') as RadioNodeList).value;
    const intent = (form.elements.namedItem('productIntent') as RadioNodeList).value;
    form.classList.toggle('is-enterprise', type === 'enterprise');
    const products = form.querySelector('.sk-products[data-show-on]') as HTMLElement | null;
    if (products) products.style.display = intent === 'modify_combination' ? '' : 'none';
    const companyField = form.querySelector('.sk-field--enterprise') as HTMLElement | null;
    if (companyField) companyField.style.display = type === 'enterprise' ? '' : 'none';
  };
  form.addEventListener('change', reflect);
  reflect();

  const result = form.querySelector('.sk-result') as HTMLElement | null;
  const submitBtn = form.querySelector('.sk-submit') as HTMLButtonElement | null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn) return;
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    if (result) { result.className = 'sk-result'; result.textContent = ''; }
    const fd = new FormData(form);
    const products: string[] = [];
    fd.getAll('productsOfInterest').forEach(v => products.push(String(v)));
    const payload = {
      type: String(fd.get('type') || 'individual'),
      name: String(fd.get('name') || ''),
      email: String(fd.get('email') || ''),
      company: String(fd.get('company') || ''),
      role: String(fd.get('role') || ''),
      phone: String(fd.get('phone') || ''),
      productIntent: String(fd.get('productIntent') || ''),
      productsOfInterest: products,
      usageRequirements: String(fd.get('usageRequirements') || ''),
      desiredTimeline: String(fd.get('desiredTimeline') || ''),
      hearAboutUs: String(fd.get('hearAboutUs') || ''),
    };
    try {
      const res = await fetch('/api/sankalpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (result) {
          result.className = 'sk-result is-error';
          result.textContent = data?.error || 'Transmission failed. Try again.';
        }
        return;
      }
      if (result) {
        result.className = 'sk-result is-success';
        result.innerHTML = `<strong>Sa\u1e45kalpa received.</strong> ${data.message || ''}<br/><span class="sk-result__id">reference: ${data.id || '\u2014'}</span>`;
      }
      form.reset();
      reflect();
    } catch {
      if (result) {
        result.className = 'sk-result is-error';
        result.textContent = 'Network unavailable. Try again in a moment.';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
    }
  });
}
closePanel() {
this.panel.classList.remove('open');
}

setShunyaCaption(name: string, tagline: string, focus: number) {
  if (!this.voidMode) {
    this.shunyaCaption.style.opacity = '0';
    return;
  }
  if (this.shunyaName.textContent !== name) this.shunyaName.textContent = name;
  if (this.shunyaTag.textContent !== tagline) this.shunyaTag.textContent = tagline;
  // smoothstep
  const f = focus * focus * (3 - 2 * focus);
  this.shunyaCaption.style.opacity = String(f);
  this.shunyaCaption.style.transform = `translate(-50%, ${(1 - f) * 14}px)`;
  this.shunyaCaption.style.filter = `blur(${(1 - f) * 6}px)`;
}

  setShunyaRail(activeIndex: number, focus: number, total: number, names: string[] = []) {
  if (!this.voidMode) return;
  this.railNodes.forEach((node, i) => {
    const inRange = i < total;
    node.style.display = inRange ? '' : 'none';
    node.classList.toggle('active', i === activeIndex);
    node.classList.toggle('near', i === activeIndex && focus > 0.4);
    if (inRange) {
      const tip = node.querySelector('.depth-tooltip') as HTMLElement | null;
      if (tip && names[i] && tip.textContent !== names[i]) tip.textContent = names[i];
    }
  });
  // Progress fill grows from TOP downward — anchor to active node's actual
  // offsetTop so it lines up with the visible dot positions (which are
  // flex-centered, not evenly distributed across 0-100%).
  const railH = this.rail.clientHeight || 1;
  const activeNode = this.railNodes[activeIndex];
  const nextNodeForFill = this.railNodes[Math.min(activeIndex + 1, total - 1)];
  let fillPct = 6; // baseline so the rail never looks empty
  if (activeNode) {
    const ay = activeNode.offsetTop + activeNode.offsetHeight / 2;
    const by = (nextNodeForFill && nextNodeForFill !== activeNode)
      ? nextNodeForFill.offsetTop + nextNodeForFill.offsetHeight / 2
      : ay;
    const slide = 1 - focus;
    const y = ay + (by - ay) * slide;
    fillPct = (y / railH) * 100;
  }
  const clampedPct = Math.max(2, Math.min(100, fillPct));
  this.railFill.style.height = `${clampedPct}%`;
  // LY counter — RIDES the rail at the active node's actual position
  // (computed from the live DOM offsetTop of the active node, since the
  // nodes are flex-centered with gaps, not evenly distributed 0-100%).
  if (this.depthLy) {
    const ly = Math.max(0, Math.round((1 - focus) * 420));
    const name = names[activeIndex] ?? '';
    const nextName = names[(activeIndex + 1) % total] ?? '';
    this.depthLy.textContent = ly === 0
      ? `ARRIVED · ${name}`
      : `${ly.toLocaleString()} LY → ${nextName}`;
    const railH = this.rail.clientHeight || 1;
    const activeNode = this.railNodes[activeIndex];
    const nextNode = this.railNodes[Math.min(activeIndex + 1, total - 1)];
    if (activeNode) {
      // Lerp between current active node and the next one by `focus`.
      // (focus=1 means we're parked on this orb; focus<1 means we're drifting
      // toward the next one, so the badge slides ahead.)
      const ay = activeNode.offsetTop + activeNode.offsetHeight / 2;
      const by = (nextNode && nextNode !== activeNode)
        ? nextNode.offsetTop + nextNode.offsetHeight / 2
        : ay;
      const slide = 1 - focus; // 0 at lock, growing as we drift toward next
      const y = ay + (by - ay) * slide;
      this.depthLy.style.top = `${(y / railH) * 100}%`;
    }
    this.depthLy.style.opacity = this.voidMode ? '1' : '0';
  }
}
}
