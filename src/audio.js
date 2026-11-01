// Tiny WebAudio synth: every sound is generated, no files.
let ac = null, master = null, muted = false;
export function unlock() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination); } catch (e) { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
}
export const setMuted = (m) => { muted = m; if (master) master.gain.value = m ? 0 : 0.32; };
function tone(f, d, type = 'square', v = 0.16, slide = 0, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, v = 0.2, fc = 1200, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, n = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = fc; g.gain.value = v;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
export const sfx = {
  chop: () => { noise(0.12, 0.35, 900); tone(140, 0.1, 'triangle', 0.2, -60); },
  mine: () => { noise(0.08, 0.3, 3000); tone(520, 0.07, 'square', 0.1, -200); },
  swing: () => noise(0.12, 0.08, 2400),
  hit: () => { noise(0.1, 0.3, 1800); tone(200, 0.12, 'sawtooth', 0.14, -120); },
  pickup: () => { tone(660, 0.07, 'square', 0.08); tone(880, 0.09, 'square', 0.08, 0, 0.06); },
  craft: () => { tone(440, 0.1, 'triangle', 0.18); tone(660, 0.1, 'triangle', 0.18, 0, 0.09); tone(880, 0.18, 'triangle', 0.18, 0, 0.18); },
  build: () => { noise(0.18, 0.3, 700); tone(180, 0.2, 'triangle', 0.22, 60); tone(360, 0.2, 'triangle', 0.15, 0, 0.12); },
  level: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.12, 0, i * 0.08)),
  goal: () => { tone(740, 0.12, 'triangle', 0.16); tone(988, 0.2, 'triangle', 0.16, 0, 0.1); },
  hurt: () => { tone(160, 0.25, 'sawtooth', 0.2, -90); noise(0.15, 0.2, 600); },
  poof: () => { noise(0.3, 0.25, 1500); tone(900, 0.25, 'sine', 0.1, 600); },
  turret: () => { tone(300, 0.1, 'sawtooth', 0.1, -200); noise(0.06, 0.12, 4000); },
  bow: () => { tone(420, 0.12, 'sawtooth', 0.12, -250); noise(0.08, 0.15, 3000); },
  horn: () => { tone(110, 0.9, 'sawtooth', 0.16, -10); tone(165, 0.9, 'triangle', 0.12, 0, 0.05); },
  night: () => [392, 330, 262].forEach((f, i) => tone(f, 0.5, 'triangle', 0.14, 0, i * 0.25)),
  dawn: () => [262, 330, 392, 523].forEach((f, i) => tone(f, 0.4, 'triangle', 0.14, 0, i * 0.2)),
  click: () => tone(600, 0.04, 'square', 0.07),
  error: () => tone(130, 0.15, 'square', 0.12, -30),
  jump: () => tone(300, 0.12, 'sine', 0.08, 200),
};
