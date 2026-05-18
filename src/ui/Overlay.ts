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
  private introComplete = false;
  private voidMode = false;
  private currentApproach = 0;
  private cursorHovered = false;
  constructor(private root: HTMLElement) {
this.element.className = 'vyan-ui';
this.soundConsole.className = 'sound-console';
this.soundConsole.type = 'button';
this.soundConsole.textContent = 'SOUND OFF';
this.rail.className = 'neural-depth';
this.railFill.className = 'neural-depth-fill';
this.rail.appendChild(this.railFill);
for (let i = 0; i < 7; i++) {
const node = document.createElement('button');
node.type = 'button';
node.className = 'depth-node';
node.addEventListener('pointerdown', (e) => {
e.stopPropagation();
this.callbacks?.onJumpToOrb(i);
});
this.rail.appendChild(node);
this.railNodes.push(node);
}
this.rail.addEventListener('pointerdown', (e) => {
const rect = this.rail.getBoundingClientRect();
const y = (e.clientY - rect.top) / rect.height;
const idx = Math.max(0, Math.min(6, Math.floor(y * 7)));
this.callbacks?.onJumpToOrb(idx);
});
this.gatewayHint.className = 'gateway-hint';
    this.gatewayHint.innerHTML = `
      <div class="gateway-title" style="margin-bottom: 16px;">Vyōma- The Primordial Core</div>
      <div class="gateway-cta">Engage to Transcend Realities.</div>
    `;
    this.gatewayHint.style.opacity = '0';
    this.cursorHint.className = 'cursor-hint';
    this.cursorHint.innerHTML = `
      <span>initiate displacement</span>
      <div class="scroll-indicator"></div>
    `;
    this.cursorHint.style.opacity = '0';
    this.distanceLabel.className = 'distance-label';
    this.distanceLabel.style.opacity = '0';
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
const inner = this.panel.querySelector('.glass-panel-inner') as HTMLElement;
inner.appendChild(this.panelTitle);
inner.appendChild(this.panelSubtitle);
inner.appendChild(this.panelBody);
inner.appendChild(this.panelClose);
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
this.element.appendChild(this.panel);
}
bind(callbacks: OverlayCallbacks) {
this.callbacks = callbacks;
}
mount() {
this.root.appendChild(this.element);
}
endIntro() {
this.introComplete = true;
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
    // Gateway Hint (Cinematic Fade & Scale)
    let gatewayOpacity = 0;
    let gatewayBlur = 12;
    
    if (this.currentApproach > 0.01) {
      gatewayOpacity = Math.min((this.currentApproach - 0.01) / 0.15, 1);
      gatewayBlur = 12 * (1 - gatewayOpacity);
    }
    
    // Smoothstep easing for cinematic feel
    gatewayOpacity = gatewayOpacity * gatewayOpacity * (3 - 2 * gatewayOpacity);
    
    this.gatewayHint.style.opacity = String(gatewayOpacity);
    this.gatewayHint.style.filter = `blur(${gatewayBlur}px)`;
    
    // Subtle cinematic scale & lift
    const scaleVal = 1 + (this.currentApproach * 0.1);
    const yOffset = this.currentApproach * 25;
    this.gatewayHint.style.transform = `translateX(-50%) translateY(${-yOffset}px) scale(${scaleVal})`;
    
    // Cursor Hint (Initiate displacement)
    let cursorOpacity = 0;
    if (this.cursorHovered) {
      // Crossfade: as gateway text fades in, cursor text fades out
      cursorOpacity = Math.max(1 - (gatewayOpacity * 2.5), 0);
    }
    
    this.cursorHint.style.opacity = String(cursorOpacity);
    this.cursorHint.style.pointerEvents = cursorOpacity > 0.5 ? 'auto' : 'none';
  }
setVoidMode(on: boolean) {
this.voidMode = on;
this.rail.classList.toggle('visible', on);
this.rail.style.pointerEvents = on ?
'auto' : 'none';
this.distanceLabel.style.opacity = on ? '1' : '0';
if (on) {
this.gatewayHint.style.opacity = '0';
this.cursorHint.style.opacity = '0';
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
const darkness = document.createElement('div');
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
darkness.getBoundingClientRect();
darkness.style.opacity = '1';
this.element.style.transition = `opacity ${durationSeconds}s ease-in-out`;
this.element.style.opacity = '0';
this.element.style.pointerEvents = 'none';
}
openPanel(info: ProductInfo, origin?: PanelOrigin) {
if (origin) {
this.panel.style.setProperty('--origin-x', `${origin.x}px`);
this.panel.style.setProperty('--origin-y', `${origin.y}px`);
}
this.panelTitle.textContent = info.title;
this.panelSubtitle.textContent = info.subtitle;
this.panelBody.textContent = info.description;
this.panel.classList.add('open');
}
closePanel() {
this.panel.classList.remove('open');
}
}
