'use client'

/** Procedural Web Audio synthesis for the Neural Bloom transition. No audio files. */

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
const activeNodes: AudioNode[] = []

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.7
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function getMaster(): GainNode {
  if (!masterGain) getCtx()
  return masterGain!
}

function track(node: AudioNode) {
  activeNodes.push(node)
}

// Hall reverb via convolver
function createReverb(ctx: AudioContext, duration = 2.5, decay = 2.0): ConvolverNode {
  const rate   = ctx.sampleRate
  const length = rate * duration
  const impulse = ctx.createBuffer(2, length, rate)
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  const node = ctx.createConvolver()
  node.buffer = impulse
  return node
}

// Phase 1: orb hum — 110 Hz sine, +12 dB over 180ms
export function playPhase1Hum(): void {
  try {
    const c = getCtx()
    const osc  = c.createOscillator()
    const gain = c.createGain()
    const verb = createReverb(c, 2.0, 1.8)

    osc.type = 'sine'
    osc.frequency.value = 110
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.18)
    gain.gain.setValueAtTime(0.15, c.currentTime + 1.6)
    gain.gain.linearRampToValueAtTime(0, c.currentTime + 2.2)

    osc.connect(gain)
    gain.connect(verb)
    verb.connect(getMaster())
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 2.4)
    track(osc); track(gain); track(verb)
  } catch { /* audio not available */ }
}

// Phase 2: particle whispers — bandpass white noise
export function playPhase2Whispers(): void {
  try {
    const c = getCtx()
    const bufLen = c.sampleRate * 0.5
    const buf  = c.createBuffer(1, bufLen, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

    const src   = c.createBufferSource()
    const bp    = c.createBiquadFilter()
    const gain  = c.createGain()

    src.buffer = buf
    src.loop = true
    bp.type = 'bandpass'
    bp.frequency.value = 1600
    bp.Q.value = 1.5

    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.42)
    gain.gain.setValueAtTime(0.08, c.currentTime + 0.9)
    gain.gain.linearRampToValueAtTime(0, c.currentTime + 1.2)

    src.connect(bp)
    bp.connect(gain)
    gain.connect(getMaster())
    src.start(c.currentTime)
    src.stop(c.currentTime + 1.5)
    track(src); track(bp); track(gain)
  } catch { /* */ }
}

// Phase 3: neural resonance — three-note harmonic with vibrato
export function playPhase3Resonance(): void {
  try {
    const c = getCtx()
    const freqs   = [220, 330, 440]
    const gains   = [0.3, 0.2, 0.1]
    const lfo     = c.createOscillator()
    const lfoGain = c.createGain()
    lfo.frequency.value = 6
    lfoGain.gain.value  = 4
    lfo.connect(lfoGain)
    lfo.start()
    track(lfo); track(lfoGain)

    freqs.forEach((freq, i) => {
      const osc  = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      lfoGain.connect(osc.frequency)
      gain.gain.setValueAtTime(0, c.currentTime)
      gain.gain.linearRampToValueAtTime(gains[i], c.currentTime + 0.15)
      gain.gain.setValueAtTime(gains[i], c.currentTime + 0.35)
      gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.55)
      osc.connect(gain)
      gain.connect(getMaster())
      osc.start(c.currentTime)
      osc.stop(c.currentTime + 0.7)
      track(osc); track(gain)
    })
  } catch { /* */ }
}

// Phase 4: reality crack — sharp impulse noise burst
export function playPhase4Crack(): void {
  try {
    const c    = getCtx()
    const bufLen = Math.floor(c.sampleRate * 0.08)
    const buf  = c.createBuffer(1, bufLen, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      const env = Math.exp(-i / (bufLen * 0.15))
      data[i] = (Math.random() * 2 - 1) * env
    }
    const src  = c.createBufferSource()
    const hp   = c.createBiquadFilter()
    const gain = c.createGain()

    src.buffer = buf
    hp.type = 'highpass'
    hp.frequency.value = 2000
    gain.gain.value = 0.4

    src.connect(hp)
    hp.connect(gain)
    gain.connect(getMaster())
    src.start(c.currentTime)
    track(src); track(hp); track(gain)
  } catch { /* */ }
}

// Phase 5: harmonic bloom chord — slow attack, sustain
export function playPhase5Bloom(): void {
  try {
    const c = getCtx()
    const freqs = [110, 165, 220, 293]
    const master = c.createGain()
    master.gain.setValueAtTime(0, c.currentTime)
    master.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.6)
    master.gain.setValueAtTime(0.12, c.currentTime + 0.8)
    master.gain.linearRampToValueAtTime(0, c.currentTime + 1.0)
    master.connect(getMaster())
    track(master)

    freqs.forEach(freq => {
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(master)
      osc.start(c.currentTime)
      osc.stop(c.currentTime + 1.2)
      track(osc)
    })
  } catch { /* */ }
}

// Phase 6-7: arrival ambience — low drone + high shimmer
export function playPhase6Arrival(): void {
  try {
    const c = getCtx()
    const drone   = c.createOscillator()
    const shimmer = c.createOscillator()
    const gDrone  = c.createGain()
    const gShim   = c.createGain()

    drone.type = 'sine'
    drone.frequency.value = 55
    gDrone.gain.setValueAtTime(0, c.currentTime)
    gDrone.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.3)
    gDrone.gain.setValueAtTime(0.06, c.currentTime + 0.7)
    gDrone.gain.linearRampToValueAtTime(0, c.currentTime + 1.0)

    shimmer.type = 'sine'
    shimmer.frequency.value = 2200
    gShim.gain.setValueAtTime(0, c.currentTime)
    gShim.gain.linearRampToValueAtTime(0.03, c.currentTime + 0.3)
    gShim.gain.setValueAtTime(0.03, c.currentTime + 0.7)
    gShim.gain.linearRampToValueAtTime(0, c.currentTime + 1.0)

    drone.connect(gDrone);   gDrone.connect(getMaster())
    shimmer.connect(gShim);  gShim.connect(getMaster())
    drone.start(c.currentTime);   drone.stop(c.currentTime + 1.2)
    shimmer.start(c.currentTime); shimmer.stop(c.currentTime + 1.2)
    track(drone); track(shimmer); track(gDrone); track(gShim)
  } catch { /* */ }
}

export function disposeAudio(): void {
  try {
    activeNodes.forEach(n => { try { (n as OscillatorNode).disconnect?.() } catch {} })
    activeNodes.length = 0
    ctx?.close().catch(() => {})
    ctx = null
    masterGain = null
  } catch { /* */ }
}
