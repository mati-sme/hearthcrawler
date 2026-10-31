(function () {
  'use strict';
  const HC = window.HC;
  let ac = null, master = null, last = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
  }

  function tone(f, t0, dur, type, vol, f2) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function noise(t0, dur, vol, freq) {
    const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq || 900;
    g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0);
  }
  function arp(notes, step, type, vol) {
    const t = ac.currentTime;
    notes.forEach((f, i) => tone(f, t + i * step, step * 2.2, type || 'triangle', vol || 0.18));
  }

  const SFX = {
    chop() { const t = ac.currentTime; noise(t, 0.08, 0.35, 700); tone(180, t, 0.09, 'square', 0.12, 90); },
    mine() { const t = ac.currentTime; noise(t, 0.06, 0.3, 2400); tone(520, t, 0.06, 'square', 0.08, 300); },
    pickup() { const t = ac.currentTime; tone(740, t, 0.07, 'sine', 0.14); tone(1110, t + 0.05, 0.09, 'sine', 0.12); },
    hit() { const t = ac.currentTime; noise(t, 0.09, 0.3, 500); tone(240, t, 0.1, 'sawtooth', 0.1, 110); },
    swing() { const t = ac.currentTime; noise(t, 0.07, 0.12, 1800); },
    shoot() { const t = ac.currentTime; tone(620, t, 0.12, 'square', 0.07, 200); },
    zap() { const t = ac.currentTime; tone(1200, t, 0.14, 'sawtooth', 0.06, 300); },
    poof() { const t = ac.currentTime; noise(t, 0.22, 0.25, 600); tone(420, t, 0.2, 'sine', 0.12, 700); },
    hurt() { const t = ac.currentTime; tone(300, t, 0.2, 'sawtooth', 0.14, 120); },
    boom() { const t = ac.currentTime; noise(t, 0.45, 0.6, 180); tone(110, t, 0.4, 'sine', 0.3, 40); },
    click() { const t = ac.currentTime; tone(660, t, 0.05, 'triangle', 0.1); },
    build() { const t = ac.currentTime; noise(t, 0.08, 0.3, 400); tone(300, t, 0.1, 'square', 0.1); tone(450, t + 0.09, 0.1, 'square', 0.1); tone(600, t + 0.18, 0.16, 'square', 0.1); },
    craft() { const t = ac.currentTime; tone(520, t, 0.08, 'triangle', 0.14); tone(780, t + 0.07, 0.14, 'triangle', 0.14); },
    eat() { const t = ac.currentTime; tone(300, t, 0.06, 'sine', 0.14, 500); tone(300, t + 0.09, 0.06, 'sine', 0.14, 500); },
    levelup() { arp([523, 659, 784, 1047, 1319], 0.085, 'triangle', 0.2); },
    fanfare() { const t = ac.currentTime; arp([523, 659, 784, 659, 784, 1047], 0.1, 'square', 0.1); tone(1047, t + 0.62, 0.5, 'triangle', 0.18); tone(1319, t + 0.62, 0.5, 'triangle', 0.12); },
    chest() { arp([392, 523, 659, 784], 0.07, 'triangle', 0.18); },
    horn() { const t = ac.currentTime; tone(140, t, 0.6, 'sawtooth', 0.12); tone(210, t, 0.6, 'sawtooth', 0.08); },
    roar() { const t = ac.currentTime; noise(t, 0.7, 0.35, 220); tone(90, t, 0.7, 'sawtooth', 0.2, 60); },
    travel() { const t = ac.currentTime; tone(80, t, 1.2, 'sawtooth', 0.06, 160); noise(t, 1.0, 0.1, 300); },
    nope() { const t = ac.currentTime; tone(200, t, 0.14, 'square', 0.1, 140); },
    star() { const t = ac.currentTime; tone(988, t, 0.1, 'triangle', 0.14); tone(1319, t + 0.08, 0.2, 'triangle', 0.14); },
  };

  HC.audio = {
    init,
    play(name) {
      if (!ac || !HC.S.set.sound) return;
      const now = performance.now();
      if (last[name] && now - last[name] < 45) return; // throttle spam
      last[name] = now;
      try { SFX[name] && SFX[name](); } catch (e) { /* audio is best-effort */ }
    },
  };
})();
