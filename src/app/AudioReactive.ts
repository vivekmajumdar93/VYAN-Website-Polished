export class AudioReactive {
public bass = 0;
public mid = 0;
public treble = 0;
public energy = 0;
public pan = 0;
public muted = true;
public volume = 0.8;
private ctx?: AudioContext;
private analyser?: AnalyserNode;
private data?: Uint8Array;
private audio?: HTMLAudioElement;
private panner?: StereoPannerNode;
private gain?: GainNode;
private started = false;
async init() {
if (this.started) return;
try {
this.ctx = new AudioContext();
this.audio = new Audio('/audio/ambient.mp3');
this.audio.loop = true;
this.audio.crossOrigin = 'anonymous';
const src = this.ctx.createMediaElementSource(this.audio);
this.analyser = this.ctx.createAnalyser();
this.analyser.fftSize = 512;
this.data = new Uint8Array(this.analyser.frequencyBinCount);
this.panner = this.ctx.createStereoPanner();
this.gain = this.ctx.createGain();
this.gain.gain.value = 0.0;
src.connect(this.analyser);
this.analyser.connect(this.panner);
this.panner.connect(this.gain);
this.gain.connect(this.ctx.destination);
await this.audio.play();
this.started = true;
this.setMuted(this.muted);
this.loop();
} catch {
this.started = false;
}
}
setMuted(v: boolean) {
this.muted = v;
}
setVolume(v: number) {
this.volume = Math.max(0, Math.min(1, v));
}
toggleMute() {
this.setMuted(!this.muted);
}
setPan(v: number) {
this.pan = Math.max(-1, Math.min(1, v));
if (this.panner && this.ctx) {
this.panner.pan.setTargetAtTime(this.pan, this.ctx.currentTime, 0.03);
}
}
setGain(v: number) {
if (this.gain && this.ctx) {
this.gain.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05);
}
}
private loop = () => {
if (this.analyser && this.data) {
this.analyser.getByteFrequencyData(this.data);
const len = this.data.length;
const bassEnd = Math.floor(len * 0.12);
const midEnd = Math.floor(len * 0.45);
this.bass = this.avg(0, bassEnd);
this.mid = this.avg(bassEnd, midEnd);
this.treble = this.avg(midEnd, len);
this.energy = (this.bass * 0.55 + this.mid * 0.3 + this.treble * 0.15) / 255;
this.setGain((0.78 + this.energy * 0.24) * this.volume);
}
requestAnimationFrame(this.loop);
};
private avg(a: number, b: number) {
if (!this.data) return 0;
let sum = 0;
for (let i = a; i < b; i++) sum += this.data[i];
return sum / Math.max(1, b - a);
}
}
