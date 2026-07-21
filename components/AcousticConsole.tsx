'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { usePathname } from "next/navigation"

// ─── VYAN ACOUSTIC CONSCIOUSNESS ──────────────────────────────────────────────
// A living sound interface. Not a traditional console.
// The audio IS the realm. The realm IS the audio.
// ──────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window { webkitAudioContext: typeof AudioContext }
}

type RealmId = keyof typeof REALM_THEMES

// ─── Realm color themes ────────────────────────────────────────────────────────
const REALM_THEMES = {
  shunya: {
    name: "Śūnya Maṇḍala",
    primary: "#7b2fff",
    secondary: "#2d6fff",
    accent: "#ff2d6f",
    glow: "rgba(123,47,255,0.4)",
    bg: "rgba(10,4,28,0.92)",
    border: "rgba(123,47,255,0.2)",
    particle: "#9955ff",
  },
  medha: {
    name: "Medhā",
    primary: "#a855f7",
    secondary: "#6633cc",
    accent: "#ff2d6f",
    glow: "rgba(168,85,247,0.4)",
    bg: "rgba(12,4,32,0.92)",
    border: "rgba(168,85,247,0.2)",
    particle: "#c084fc",
  },
  vistara: {
    name: "Vistāra",
    primary: "#2d6fff",
    secondary: "#0a1a8d",
    accent: "#4499ff",
    glow: "rgba(45,111,255,0.4)",
    bg: "rgba(4,8,28,0.92)",
    border: "rgba(45,111,255,0.2)",
    particle: "#60a5fa",
  },
  mani_guha: {
    name: "Maṇi Guhā",
    primary: "#6600cc",
    secondary: "#0044aa",
    accent: "#aa44ff",
    glow: "rgba(102,0,204,0.4)",
    bg: "rgba(6,2,20,0.95)",
    border: "rgba(102,0,204,0.25)",
    particle: "#8855ee",
  },
  kathedral: {
    name: "Kathedral Śūnya",
    primary: "#1133aa",
    secondary: "#002288",
    accent: "#3355cc",
    glow: "rgba(17,51,170,0.4)",
    bg: "rgba(2,4,18,0.95)",
    border: "rgba(17,51,170,0.25)",
    particle: "#4466dd",
  },
  udbhava: {
    name: "Udbhava Śikhara",
    primary: "#cc6600",
    secondary: "#884400",
    accent: "#ffaa33",
    glow: "rgba(204,102,0,0.4)",
    bg: "rgba(18,8,2,0.95)",
    border: "rgba(204,102,0,0.25)",
    particle: "#dd8833",
  },
}

// ─── Soundscapes ───────────────────────────────────────────────────────────────
const SOUNDSCAPES = [
  { id: "void_silence",       name: "Void Silence",       realm: "shunya",   desc: "The space between thoughts",         bpm: null, energy: 0.05 },
  { id: "neural_drift",       name: "Neural Drift",       realm: "medha",    desc: "Consciousness at rest",              bpm: 60,   energy: 0.25 },
  { id: "crystal_resonance",  name: "Crystal Resonance",  realm: "mani_guha",desc: "Maṇi Guhā cave harmonics",          bpm: null, energy: 0.15 },
  { id: "vortex_descent",     name: "Vortex Descent",     realm: "vistara",  desc: "Falling through the gateway",        bpm: 72,   energy: 0.45 },
  { id: "cathedral_bloom",    name: "Cathedral Bloom",    realm: "kathedral",desc: "Kathedral Śūnya reverb hall",        bpm: null, energy: 0.20 },
  { id: "solar_ignition",     name: "Solar Ignition",     realm: "udbhava",  desc: "Udbhava Śikhara fire rising",        bpm: 120,  energy: 0.85 },
  { id: "deep_current",       name: "Deep Current",       realm: "vistara",  desc: "Pātāla Taraṅga undertow",           bpm: 80,   energy: 0.55 },
  { id: "pranic_pulse",       name: "Prāṇic Pulse",       realm: "medha",    desc: "Ojas vital rhythm tracking",         bpm: 72,   energy: 0.40 },
] as const

type SoundscapeId = typeof SOUNDSCAPES[number]['id']

// ─── Consciousness modes ───────────────────────────────────────────────────────
const CONSCIOUSNESS_MODES = [
  { id: "prajna",   name: "Prājña",  desc: "Deep focus",    color: "#2d9e7f", eqCurve: [ 0,-2,-4,-6,-4,-2, 0, 2, 4, 6, 4, 2] },
  { id: "dhyana",   name: "Dhyāna",  desc: "Meditation",    color: "#c4622d", eqCurve: [-6,-4,-2, 0, 2, 4, 6, 4, 2, 0,-2,-4] },
  { id: "akshaya",  name: "Akṣaya",  desc: "Knowledge",     color: "#00c4cc", eqCurve: [ 4, 6, 4, 2, 0,-2,-4,-2, 0, 2, 4, 6] },
  { id: "java",     name: "Javā",    desc: "High energy",   color: "#a855f7", eqCurve: [ 6, 4, 2, 0,-2,-4,-6,-4,-2, 0, 2, 4] },
  { id: "sanchara", name: "Sañcāra", desc: "Transmission",  color: "#e8b94f", eqCurve: [ 2, 0,-2,-4,-2, 0, 2, 4, 6, 4, 2, 0] },
]

// ─── Reverb environments ───────────────────────────────────────────────────────
const REVERB_ENVIRONMENTS = [
  { id: "void",    name: "Void",          decay: 0.1,  wet: 0.05 },
  { id: "cave",    name: "Maṇi Guhā",     decay: 4.2,  wet: 0.65 },
  { id: "hall",    name: "Kathedral",     decay: 6.8,  wet: 0.75 },
  { id: "chamber", name: "Svarna Dvāra",  decay: 2.4,  wet: 0.45 },
  { id: "cosmic",  name: "Śūnya Vedī",    decay: 12.0, wet: 0.90 },
]

// ─── Web Audio engine ──────────────────────────────────────────────────────────
function useAudioEngine() {
  const ctxRef        = useRef<AudioContext | null>(null)
  const analyserRef   = useRef<AnalyserNode | null>(null)
  const gainRef       = useRef<GainNode | null>(null)
  const eqRef         = useRef<BiquadFilterNode[]>([])
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const sourceRef     = useRef<AudioBufferSourceNode | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isPlaying,     setIsPlaying]     = useState(false)
  const [volume,        setVolume]        = useState(0.7)
  const [currentSoundscape, setCurrentSoundscape] = useState<SoundscapeId | null>(null)
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(128))

  const init = useCallback(async () => {
    if (ctxRef.current) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    ctxRef.current = ctx

    const gain = ctx.createGain()
    gain.gain.value = 0.7
    gainRef.current = gain

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    analyserRef.current = analyser

    const eqBands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 12000, 16000, 20000]
    const eqNodes: BiquadFilterNode[] = eqBands.map(freq => {
      const f = ctx.createBiquadFilter()
      f.type = "peaking"
      f.frequency.value = freq
      f.Q.value = 1.4
      f.gain.value = 0
      return f
    })
    eqRef.current = eqNodes

    eqNodes.reduce((prev, curr) => { prev.connect(curr); return curr })
    eqNodes[eqNodes.length - 1].connect(gain)
    gain.connect(analyser)
    analyser.connect(ctx.destination)

    setIsInitialized(true)
  }, [])

  const synthesizeSoundscape = useCallback(async (soundscapeId: SoundscapeId) => {
    if (!ctxRef.current) await init()
    const ctx = ctxRef.current
    if (!ctx) return

    oscillatorsRef.current.forEach(o => { try { o.stop() } catch(_) {} })
    oscillatorsRef.current = []
    if (sourceRef.current) { try { sourceRef.current.stop() } catch(_) {} }

    const sc = SOUNDSCAPES.find(s => s.id === soundscapeId)
    if (!sc) return

    const firstEq = eqRef.current[0]
    const oscs: OscillatorNode[] = []

    if (sc.id === "void_silence") {
      const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = 40
      const g = ctx.createGain(); g.gain.value = 0.04
      osc.connect(g); g.connect(firstEq); osc.start(); oscs.push(osc)
    }
    else if (sc.id === "crystal_resonance") {
      ;[110, 220, 330, 440, 550, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator(); osc.type = "sine"
        osc.frequency.value = freq + Math.random() * 2
        const g = ctx.createGain(); g.gain.value = 0.08 / (i + 1)
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1 + Math.random() * 0.3
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02
        lfo.connect(lfoGain); lfoGain.connect(g.gain); lfo.start()
        osc.connect(g); g.connect(firstEq); osc.start()
        oscs.push(osc, lfo)
      })
    }
    else if (sc.id === "neural_drift") {
      const left = ctx.createOscillator(); left.frequency.value = 200; left.type = "sine"
      const right = ctx.createOscillator(); right.frequency.value = 204; right.type = "sine"
      const merger = ctx.createChannelMerger(2)
      const gL = ctx.createGain(); gL.gain.value = 0.12
      const gR = ctx.createGain(); gR.gain.value = 0.12
      left.connect(gL); gL.connect(merger, 0, 0)
      right.connect(gR); gR.connect(merger, 0, 1)
      merger.connect(firstEq); left.start(); right.start(); oscs.push(left, right)
      const pad = ctx.createOscillator(); pad.type = "triangle"; pad.frequency.value = 110
      const padG = ctx.createGain(); padG.gain.value = 0.06
      pad.connect(padG); padG.connect(firstEq); pad.start(); oscs.push(pad)
    }
    else if (sc.id === "vortex_descent") {
      const sweep = ctx.createOscillator(); sweep.type = "sawtooth"; sweep.frequency.value = 80
      sweep.frequency.setTargetAtTime(40, ctx.currentTime, 8)
      const sweepG = ctx.createGain(); sweepG.gain.value = 0.08
      sweep.connect(sweepG); sweepG.connect(firstEq); sweep.start(); oscs.push(sweep)
      const interval = 60 / 72
      const pulseOsc = ctx.createOscillator(); pulseOsc.type = "sine"; pulseOsc.frequency.value = 60
      const pulseEnv = ctx.createGain(); pulseEnv.gain.value = 0
      pulseOsc.connect(pulseEnv); pulseEnv.connect(firstEq); pulseOsc.start(); oscs.push(pulseOsc)
      let t = ctx.currentTime
      for (let i = 0; i < 32; i++) {
        pulseEnv.gain.setValueAtTime(0.15, t)
        pulseEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
        t += interval
      }
    }
    else if (sc.id === "cathedral_bloom") {
      ;[146.83, 174.61, 220, 293.66, 349.23].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = i === 0 ? "sawtooth" : "triangle"; osc.frequency.value = freq
        const g = ctx.createGain(); g.gain.value = 0.06 / (i * 0.3 + 1)
        osc.connect(g); g.connect(firstEq); osc.start(); oscs.push(osc)
      })
    }
    else if (sc.id === "solar_ignition") {
      const bass = ctx.createOscillator(); bass.type = "sawtooth"; bass.frequency.value = 55
      const bassG = ctx.createGain(); bassG.gain.value = 0.18
      const bassFilter = ctx.createBiquadFilter(); bassFilter.type = "lowpass"; bassFilter.frequency.value = 200
      bass.connect(bassG); bassG.connect(bassFilter); bassFilter.connect(firstEq); bass.start(); oscs.push(bass)
      const shimmer = ctx.createOscillator(); shimmer.type = "sine"; shimmer.frequency.value = 3520
      const shimG = ctx.createGain(); shimG.gain.value = 0.03
      shimmer.connect(shimG); shimG.connect(firstEq); shimmer.start(); oscs.push(shimmer)
    }
    else if (sc.id === "deep_current") {
      ;[55, 82.5, 110, 137.5].forEach(freq => {
        const osc = ctx.createOscillator(); osc.type = "sine"
        osc.frequency.value = freq + (Math.random() - 0.5) * 3
        const g = ctx.createGain(); g.gain.value = 0.1
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.03
        lfo.connect(lfoG); lfoG.connect(osc.frequency); lfo.start()
        osc.connect(g); g.connect(firstEq); osc.start(); oscs.push(osc, lfo)
      })
    }
    else if (sc.id === "pranic_pulse") {
      const interval = 60 / 72
      const kickOsc = ctx.createOscillator(); kickOsc.type = "sine"; kickOsc.frequency.value = 80
      const kickEnv = ctx.createGain(); kickEnv.gain.value = 0
      kickOsc.connect(kickEnv); kickEnv.connect(firstEq); kickOsc.start(); oscs.push(kickOsc)
      let t = ctx.currentTime
      for (let i = 0; i < 48; i++) {
        kickOsc.frequency.setValueAtTime(120, t)
        kickOsc.frequency.exponentialRampToValueAtTime(40, t + 0.15)
        kickEnv.gain.setValueAtTime(0.2, t)
        kickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
        kickEnv.gain.setValueAtTime(0.12, t + 0.18)
        kickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
        t += interval
      }
      const breath = ctx.createOscillator(); breath.type = "triangle"; breath.frequency.value = 220
      const bG = ctx.createGain(); bG.gain.value = 0.04
      breath.connect(bG); bG.connect(firstEq); breath.start(); oscs.push(breath)
    }

    oscillatorsRef.current = oscs
    setCurrentSoundscape(soundscapeId)
    setIsPlaying(true)
  }, [init])

  const stop = useCallback(() => {
    oscillatorsRef.current.forEach(o => { try { o.stop() } catch(_) {} })
    oscillatorsRef.current = []
    setIsPlaying(false)
    setCurrentSoundscape(null)
  }, [])

  const setEQBand = useCallback((bandIdx: number, gainValue: number) => {
    const band = eqRef.current[bandIdx]
    if (band && ctxRef.current) {
      band.gain.setTargetAtTime(gainValue, ctxRef.current.currentTime, 0.01)
    }
  }, [])

  const applyConsciousnessMode = useCallback((modeId: string) => {
    const mode = CONSCIOUSNESS_MODES.find(m => m.id === modeId)
    if (!mode) return
    mode.eqCurve.forEach((gain, i) => setEQBand(i, gain))
  }, [setEQBand])

  useEffect(() => {
    if (!analyserRef.current) return
    let frame: number
    const poll = () => {
      const data = new Uint8Array(analyserRef.current!.frequencyBinCount)
      analyserRef.current!.getByteFrequencyData(data)
      setFrequencyData(data)
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frame)
  }, [isInitialized])

  const setMasterVolume = useCallback((v: number) => {
    setVolume(v)
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.01)
    }
  }, [])

  return {
    init, isInitialized, isPlaying,
    synthesizeSoundscape, stop,
    frequencyData, volume, setMasterVolume,
    setEQBand, applyConsciousnessMode,
    currentSoundscape,
  }
}

// ─── Plasma ring visualizer ────────────────────────────────────────────────────
type Theme = typeof REALM_THEMES[keyof typeof REALM_THEMES]

function PlasmaRing({ frequencyData, theme, size = 120 }: { frequencyData: Uint8Array; theme: Theme; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const tRef      = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const S = size * 2
    canvas.width = S; canvas.height = S

    const draw = () => {
      tRef.current += 0.012
      const t = tRef.current
      ctx.clearRect(0, 0, S, S)
      const cx = S / 2, cy = S / 2, baseR = S * 0.32
      const bars = frequencyData.length

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2
        const amplitude = (frequencyData[i] / 255) * S * 0.18
        const r1 = baseR - S * 0.04, r2 = baseR + amplitude
        const x1 = cx + Math.cos(angle) * r1, y1 = cy + Math.sin(angle) * r1
        const x2 = cx + Math.cos(angle) * r2, y2 = cy + Math.sin(angle) * r2
        const intensity = frequencyData[i] / 255
        const alpha = 0.2 + intensity * 0.75
        ctx.save()
        ctx.filter = `blur(${1.5 + intensity * 2}px)`
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
        ctx.strokeStyle = theme.primary + Math.floor(alpha * 0.4 * 255).toString(16).padStart(2, "0")
        ctx.lineWidth = 2 + intensity * 3; ctx.stroke(); ctx.filter = "none"
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
        ctx.strokeStyle = theme.primary + Math.floor(alpha * 255).toString(16).padStart(2, "0")
        ctx.lineWidth = 0.8 + intensity * 1.2; ctx.stroke(); ctx.restore()
      }

      const avgAmp = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length / 255
      const orbR = S * 0.10 + avgAmp * S * 0.06
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.5)
      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR)
      orbGrad.addColorStop(0, `rgba(255,255,255,${0.85 * pulse})`)
      orbGrad.addColorStop(0.3, theme.primary + "cc")
      orbGrad.addColorStop(0.7, theme.secondary + "66")
      orbGrad.addColorStop(1, "rgba(0,0,0,0)")
      ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2)
      ctx.fillStyle = orbGrad; ctx.fill()

      const nodeCount = 8
      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2 + t * 0.4
        const nx = cx + Math.cos(angle) * baseR
        const ny = cy + Math.sin(angle) * baseR
        const nAmp = frequencyData[Math.floor((i / nodeCount) * bars)] / 255
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 4 + nAmp * 6)
        ng.addColorStop(0, `rgba(255,255,255,${0.9 * (0.4 + nAmp * 0.6)})`)
        ng.addColorStop(0.4, theme.accent + "88"); ng.addColorStop(1, "rgba(0,0,0,0)")
        ctx.beginPath(); ctx.arc(nx, ny, 4 + nAmp * 6, 0, Math.PI * 2)
        ctx.fillStyle = ng; ctx.fill()
      }
      for (let i = 0; i < nodeCount; i++) {
        const a1 = (i / nodeCount) * Math.PI * 2 + t * 0.4
        const a2 = ((i + 1) / nodeCount) * Math.PI * 2 + t * 0.4
        const x1 = cx + Math.cos(a1) * baseR, y1 = cy + Math.sin(a1) * baseR
        const x2 = cx + Math.cos(a2) * baseR, y2 = cy + Math.sin(a2) * baseR
        const amp = frequencyData[Math.floor((i / nodeCount) * bars)] / 255
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
        ctx.strokeStyle = theme.secondary + Math.floor((0.15 + amp * 0.35) * 255).toString(16).padStart(2, "0")
        ctx.lineWidth = 0.5 + amp; ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [frequencyData, theme, size])

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} />
}

// ─── Neural EQ ────────────────────────────────────────────────────────────────
function NeuralEQ({ bands, onBandChange, theme }: {
  bands: number[]
  onBandChange: (idx: number, val: number) => void
  theme: Theme
}) {
  const EQ_LABELS = ["31","62","125","250","500","1k","2k","4k","8k","12k","16k","20k"]
  const [dragging, setDragging] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 320, H = 80
  const nodeX = (i: number) => (i / (bands.length - 1)) * (W - 24) + 12
  const nodeY = (gain: number) => H / 2 - (gain / 12) * (H / 2 - 8)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging === null) return
    const svg = svgRef.current; if (!svg) return
    const rect = svg.getBoundingClientRect()
    const y = e.clientY - rect.top
    const gain = -((y - H / 2) / (H / 2 - 8)) * 12
    onBandChange(dragging, Math.max(-12, Math.min(12, gain)))
  }, [dragging, onBandChange])

  const handleMouseUp = () => setDragging(null)

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp) }
  }, [handleMouseMove])

  const points = bands.map((gain, i): [number, number] => [nodeX(i), nodeY(gain)])
  const pathD = points.reduce((d, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`
    const [px, py] = points[i - 1]
    const cpx = (px + x) / 2
    return `${d} C ${cpx} ${py} ${cpx} ${y} ${x} ${y}`
  }, "")

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} width={W} height={H}
        style={{ display: "block", cursor: dragging !== null ? "grabbing" : "default", overflow: "visible" }}>
        <line x1={0} y1={H/2} x2={W} y2={H/2} stroke={theme.border} strokeWidth={0.5} strokeDasharray="3,3" />
        <path d={`${pathD} L ${nodeX(bands.length-1)} ${H} L ${nodeX(0)} ${H} Z`} fill={theme.primary + "18"} />
        <path d={pathD} fill="none" stroke={theme.primary} strokeWidth={1.5}
          filter={`drop-shadow(0 0 4px ${theme.glow})`} />
        {bands.map((gain, i) => (
          <g key={i} onMouseDown={e => { e.preventDefault(); setDragging(i) }} style={{ cursor: "grab" }}>
            <circle cx={nodeX(i)} cy={nodeY(gain)} r={8} fill={theme.primary + "22"} />
            <circle cx={nodeX(i)} cy={nodeY(gain)} r={3.5}
              fill={dragging === i ? "#fff" : theme.primary} stroke={theme.accent} strokeWidth={0.8} />
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "4px" }}>
        {EQ_LABELS.map((l, i) => (
          <span key={i} style={{ fontSize: "7px", color: theme.primary + "80", letterSpacing: "0.05em",
            fontFamily: "system-ui", width: `${100/EQ_LABELS.length}%`, textAlign: "center" }}>{l}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Spatial audio visualizer ──────────────────────────────────────────────────
function SpatialVisualizer({ frequencyData, theme, panX = 0, panY = 0 }: {
  frequencyData: Uint8Array; theme: Theme; panX?: number; panY?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const tRef      = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext("2d")!
    canvas.width = 100; canvas.height = 100

    const draw = () => {
      tRef.current += 0.02; const t = tRef.current
      ctx.clearRect(0, 0, 100, 100)
      const cx = 50, cy = 50, avg = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length / 255
      ctx.strokeStyle = theme.border + "40"; ctx.lineWidth = 0.3
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i*25, 0); ctx.lineTo(i*25, 100); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i*25); ctx.lineTo(100, i*25); ctx.stroke()
      }
      ctx.strokeStyle = theme.border + "60"; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, 100); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(100, cy); ctx.stroke()
      const sx = cx + panX * 40, sy = cy + panY * 40
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14 + avg*10)
      g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.3, theme.primary + "cc"); g.addColorStop(1, "rgba(0,0,0,0)")
      ctx.beginPath(); ctx.arc(sx, sy, 14 + avg*10, 0, Math.PI*2); ctx.fillStyle = g; ctx.fill()
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.8 + i * 0.33) % 1, r = phase * 45
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2)
        ctx.strokeStyle = theme.primary + Math.floor((1-phase) * 0.4 * 255).toString(16).padStart(2,"0")
        ctx.lineWidth = 0.8; ctx.stroke()
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [frequencyData, theme, panX, panY])

  return <canvas ref={canvasRef} style={{ width: 100, height: 100, borderRadius: "50%", display: "block" }} />
}

// ─── BPM pulse indicator ───────────────────────────────────────────────────────
function BPMPulse({ bpm, theme }: { bpm: number | null; theme: Theme }) {
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (!bpm) return
    const interval = setInterval(() => {
      setPulse(true); setTimeout(() => setPulse(false), 80)
    }, 60000 / bpm)
    return () => clearInterval(interval)
  }, [bpm])

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: pulse ? theme.accent : theme.primary + "40",
        boxShadow: pulse ? `0 0 12px ${theme.accent}` : "none",
        transition: "all 0.05s", flexShrink: 0,
      }} />
      <span style={{ fontSize: "9px", letterSpacing: "0.2em", color: theme.primary + "90",
        fontFamily: "system-ui", textTransform: "uppercase" }}>
        {bpm ? `${bpm} BPM` : "∞"}
      </span>
    </div>
  )
}

// ─── Spectrogram ──────────────────────────────────────────────────────────────
function Spectrogram({ frequencyData, theme }: { frequencyData: Uint8Array; theme: Theme }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<number[][]>([])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext("2d")!
    canvas.width = 280; canvas.height = 48
    historyRef.current.push([...frequencyData])
    if (historyRef.current.length > 280) historyRef.current.shift()
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, 280, 48)
    historyRef.current.forEach((frame, xi) => {
      frame.forEach((val, yi) => {
        if (yi >= 48) return
        const intensity = val / 255, alpha = intensity * 0.9
        const hue = 240 + intensity * 80
        ctx.fillStyle = `hsla(${hue}, 90%, ${30 + intensity * 50}%, ${alpha})`
        ctx.fillRect(xi, 47 - yi, 1, 1)
      })
    })
  }, [frequencyData, theme])

  return <canvas ref={canvasRef} style={{ width: 280, height: 48, display: "block", borderRadius: 4, opacity: 0.85 }} />
}

// ─── Main console component ────────────────────────────────────────────────────
export default function AcousticConsole({ realmId: realmIdProp }: { realmId?: RealmId }) {
  const pathname = usePathname()
  const realmId: RealmId = realmIdProp ?? (
    pathname.includes('medha')   ? 'medha'   :
    pathname.includes('vistara') ? 'vistara' :
    'shunya'
  )
  const theme = REALM_THEMES[realmId] || REALM_THEMES.shunya
  const audio = useAudioEngine()

  const [isOpen,         setIsOpen]        = useState(false)
  const [activeTab,      setActiveTab]     = useState("play")
  const [eqBands,        setEqBands]       = useState<number[]>(new Array(12).fill(0))
  const [activeMode,     setActiveMode]    = useState<string | null>(null)
  const [activeReverb,   setActiveReverb]  = useState("void")
  const [panX,           setPanX]          = useState(0)
  const [panY,           setPanY]          = useState(0)

  const handleBandChange = useCallback((idx: number, val: number) => {
    setEqBands(prev => { const n = [...prev]; n[idx] = val; return n })
    audio.setEQBand(idx, val)
  }, [audio])

  const handleModeSelect = useCallback((modeId: string) => {
    setActiveMode(modeId)
    audio.applyConsciousnessMode(modeId)
    const mode = CONSCIOUSNESS_MODES.find(m => m.id === modeId)
    if (mode) setEqBands([...mode.eqCurve])
  }, [audio])

  const handleSoundscapeSelect = useCallback(async (id: SoundscapeId) => {
    await audio.init()
    if (audio.currentSoundscape === id) { audio.stop(); return }
    await audio.synthesizeSoundscape(id)
  }, [audio])

  const currentSoundscape = SOUNDSCAPES.find(s => s.id === audio.currentSoundscape)

  const tabs = [
    { id: "play",  label: "Soundscapes" },
    { id: "eq",    label: "Neural EQ"   },
    { id: "space", label: "Spatial"     },
    { id: "mode",  label: "Consciousness" },
  ]

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <div
        onClick={() => setIsOpen(v => !v)}
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 48, height: 48, borderRadius: "50%",
          background: isOpen ? theme.primary + "30" : "rgba(0,0,0,0.6)",
          border: `1px solid ${theme.primary}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 9300,
          boxShadow: isOpen ? `0 0 24px ${theme.glow}` : "none",
          transition: "all 0.3s ease",
          backdropFilter: "blur(12px)",
        }}
      >
        <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
          {([2, 5, 8, 11, 14, 17, 20] as const).map((x, i) => {
            const h = [4, 8, 14, 18, 14, 8, 4][i]
            return (
              <rect key={i} x={x} y={(22-h)/2} width={1.5} height={h}
                rx={0.75} fill={theme.primary} opacity={0.6} />
            )
          })}
        </svg>
      </div>

      {/* ── Console panel ──────────────────────────────────────────────────── */}
      {isOpen && (
        <div style={{
          position: "fixed", bottom: 84, right: 24, width: 340,
          background: theme.bg, border: `1px solid ${theme.border}`,
          borderRadius: 16, backdropFilter: "blur(32px)", zIndex: 9400,
          boxShadow: `0 0 60px ${theme.glow}, 0 24px 48px rgba(0,0,0,0.6)`,
          overflow: "hidden", fontFamily: "system-ui, sans-serif",
        }}>
          {/* Top accent */}
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${theme.primary}80, transparent)` }} />

          {/* Header */}
          <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center",
            justifyContent: "space-between", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <PlasmaRing frequencyData={audio.frequencyData} theme={theme} size={36} />
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.35em", color: theme.primary,
                  textTransform: "uppercase", fontWeight: 500 }}>Acoustic Consciousness</div>
                <div style={{ fontSize: 8, letterSpacing: "0.2em", color: theme.primary + "60",
                  textTransform: "uppercase", marginTop: 2 }}>{theme.name}</div>
              </div>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={audio.volume}
              onChange={e => audio.setMasterVolume(parseFloat(e.target.value))}
              style={{ width: 60, accentColor: theme.primary }} />
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}` }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: "8px 4px",
                background: activeTab === tab.id ? theme.primary + "18" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? `1px solid ${theme.primary}` : "1px solid transparent",
                color: activeTab === tab.id ? theme.primary : theme.primary + "50",
                fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase",
                cursor: "pointer", transition: "all 0.2s", fontFamily: "system-ui",
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: "14px 16px", maxHeight: 380, overflowY: "auto" }}>

            {/* ── SOUNDSCAPES ──────────────────────────────────────────────── */}
            {activeTab === "play" && (
              <div>
                <div style={{ marginBottom: 12 }}><Spectrogram frequencyData={audio.frequencyData} theme={theme} /></div>
                {currentSoundscape && <div style={{ marginBottom: 10 }}><BPMPulse bpm={currentSoundscape.bpm} theme={theme} /></div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {SOUNDSCAPES.map(sc => {
                    const isActive = audio.currentSoundscape === sc.id
                    const scTheme = REALM_THEMES[sc.realm as RealmId] || theme
                    return (
                      <button key={sc.id} onClick={() => handleSoundscapeSelect(sc.id)} style={{
                        padding: "10px", background: isActive ? scTheme.primary + "22" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isActive ? scTheme.primary + "60" : theme.border}`,
                        borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                        boxShadow: isActive ? `0 0 16px ${scTheme.glow}` : "none",
                      }}>
                        <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500,
                          color: isActive ? scTheme.primary : "rgba(255,255,255,0.65)", marginBottom: 3 }}>{sc.name}</div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>{sc.desc}</div>
                        <div style={{ marginTop: 6, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 1, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${sc.energy * 100}%`,
                            background: isActive ? scTheme.primary : scTheme.primary + "50", transition: "width 0.3s" }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 8, letterSpacing: "0.25em", color: theme.primary + "60",
                    textTransform: "uppercase", marginBottom: 8 }}>Reverb Environment</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {REVERB_ENVIRONMENTS.map(env => (
                      <button key={env.id} onClick={() => setActiveReverb(env.id)} style={{
                        padding: "5px 10px",
                        background: activeReverb === env.id ? theme.primary + "25" : "transparent",
                        border: `1px solid ${activeReverb === env.id ? theme.primary + "60" : theme.border}`,
                        borderRadius: 20, cursor: "pointer",
                        color: activeReverb === env.id ? theme.primary : "rgba(255,255,255,0.4)",
                        fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase",
                        fontFamily: "system-ui", transition: "all 0.2s",
                      }}>{env.name}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── NEURAL EQ ────────────────────────────────────────────────── */}
            {activeTab === "eq" && (
              <div>
                <div style={{ fontSize: 8, letterSpacing: "0.25em", color: theme.primary + "60",
                  textTransform: "uppercase", marginBottom: 10 }}>12-Band Neural Equalizer — drag nodes to sculpt</div>
                <NeuralEQ bands={eqBands} onBandChange={handleBandChange} theme={theme} />
                <button onClick={() => { setEqBands(new Array(12).fill(0)); eqBands.forEach((_, i) => audio.setEQBand(i, 0)) }}
                  style={{ marginTop: 12, padding: "6px 14px", background: "transparent",
                    border: `1px solid ${theme.border}`, borderRadius: 20, cursor: "pointer",
                    color: theme.primary + "60", fontSize: 8, letterSpacing: "0.2em",
                    textTransform: "uppercase", fontFamily: "system-ui" }}>Reset</button>
              </div>
            )}

            {/* ── SPATIAL ──────────────────────────────────────────────────── */}
            {activeTab === "space" && (
              <div>
                <div style={{ fontSize: 8, letterSpacing: "0.25em", color: theme.primary + "60",
                  textTransform: "uppercase", marginBottom: 12 }}>Spatial Audio — position your sound source</div>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div
                    style={{ width: 100, height: 100, borderRadius: "50%",
                      border: `1px solid ${theme.border}`, cursor: "crosshair",
                      flexShrink: 0, position: "relative", overflow: "hidden" }}
                    onMouseMove={e => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setPanX(Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 2)))
                      setPanY(Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height - 0.5) * 2)))
                    }}
                  >
                    <SpatialVisualizer frequencyData={audio.frequencyData} theme={theme} panX={panX} panY={panY} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: theme.primary + "60", letterSpacing: "0.1em", marginBottom: 8 }}>
                      X: {panX > 0 ? "R" : "L"} {Math.abs(panX * 100).toFixed(0)}%</div>
                    <div style={{ fontSize: 8, color: theme.primary + "60", letterSpacing: "0.1em", marginBottom: 16 }}>
                      Y: {panY > 0 ? "F" : "B"} {Math.abs(panY * 100).toFixed(0)}%</div>
                    <div style={{ fontSize: 8, letterSpacing: "0.2em", color: theme.primary + "60",
                      textTransform: "uppercase", marginBottom: 8 }}>Binaural Beats</div>
                    {([
                      { name: "Delta", freq: 2,  desc: "Deep sleep" },
                      { name: "Theta", freq: 6,  desc: "Meditation" },
                      { name: "Alpha", freq: 10, desc: "Calm focus" },
                      { name: "Beta",  freq: 20, desc: "Active mind" },
                      { name: "Gamma", freq: 40, desc: "Peak flow"  },
                    ] as const).map(b => (
                      <button key={b.name} style={{
                        display: "block", width: "100%", marginBottom: 4, padding: "5px 8px",
                        textAlign: "left", background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${theme.border}`, borderRadius: 6, cursor: "pointer",
                        color: "rgba(255,255,255,0.5)", fontSize: 8, letterSpacing: "0.1em",
                        fontFamily: "system-ui",
                      }}>
                        <span style={{ color: theme.primary }}>{b.name}</span>{" "}{b.freq}Hz — {b.desc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── CONSCIOUSNESS MODES ───────────────────────────────────────── */}
            {activeTab === "mode" && (
              <div>
                <div style={{ fontSize: 8, letterSpacing: "0.25em", color: theme.primary + "60",
                  textTransform: "uppercase", marginBottom: 12 }}>
                  Medhā&apos;s Consciousness Modes — reshapes EQ and reverb</div>
                {CONSCIOUSNESS_MODES.map(mode => {
                  const isActive = activeMode === mode.id
                  return (
                    <button key={mode.id} onClick={() => handleModeSelect(mode.id)} style={{
                      display: "flex", width: "100%", alignItems: "center", gap: 12,
                      padding: "12px 14px", marginBottom: 6,
                      background: isActive ? mode.color + "18" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isActive ? mode.color + "55" : theme.border}`,
                      borderRadius: 10, cursor: "pointer", transition: "all 0.25s",
                      boxShadow: isActive ? `0 0 20px ${mode.color}25` : "none", textAlign: "left",
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: mode.color,
                        boxShadow: isActive ? `0 0 10px ${mode.color}` : "none", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                          fontWeight: 500, marginBottom: 2,
                          color: isActive ? mode.color : "rgba(255,255,255,0.7)" }}>{mode.name}</div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>{mode.desc}</div>
                      </div>
                      <svg width={40} height={16} viewBox="0 0 40 16">
                        {mode.eqCurve.map((g, i) => {
                          const x = (i / 11) * 38 + 1, h = Math.abs(g) / 12 * 7, y = g > 0 ? 8 - h : 8
                          return <rect key={i} x={x} y={y} width={2} height={h || 0.5}
                            fill={mode.color + (isActive ? "cc" : "55")} rx={0.5} />
                        })}
                        <line x1={0} y1={8} x2={40} y2={8} stroke={mode.color + "33"} strokeWidth={0.5} />
                      </svg>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "8px 16px", borderTop: `1px solid ${theme.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 8, letterSpacing: "0.2em", color: theme.primary + "50", textTransform: "uppercase" }}>
              {audio.isPlaying ? "● Transmitting" : "○ Silent"}
            </div>
            {audio.isPlaying && (
              <button onClick={audio.stop} style={{
                padding: "4px 10px", background: "transparent",
                border: `1px solid ${theme.border}`, borderRadius: 20, cursor: "pointer",
                color: theme.primary + "60", fontSize: 8, letterSpacing: "0.2em",
                textTransform: "uppercase", fontFamily: "system-ui",
              }}>Stop</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
