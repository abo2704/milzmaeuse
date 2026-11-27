// Kleine Geräusche ohne Audiodateien (Web Audio).
let ac = null, master = null, engine = null, muted = false;
try { muted = localStorage.getItem('bs-loewe-mute') === '1'; } catch { /* egal */ }

export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
  } catch { ac = null; }
}
export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('bs-loewe-mute', muted ? '1' : '0'); } catch { /* egal */ }
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2) {
  if (!ac) return;
  const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; g.gain.value = vol;
  s.connect(g); g.connect(master); s.start();
}

export const sfx = {
  bump: () => noise(0.12, 0.25),
  ram: () => { noise(0.25, 0.4); tone(90, 0.2, 'sawtooth', 0.2, -40); },
  pickup: () => { tone(660, 0.08, 'square', 0.1); tone(990, 0.1, 'square', 0.1, 0, 0.08); },
  deliver: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.1, 0, i * 0.08)); },
  memory: () => { [440, 554, 659].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, 0, i * 0.1)); },
  flash: () => { tone(1800, 1.2, 'sine', 0.25, -1700); noise(0.8, 0.3); },
  fail: () => { tone(300, 0.2, 'square', 0.12, -150); },
  ok: () => { tone(880, 0.08, 'square', 0.1); },
  honk: () => { tone(420, 0.18, 'square', 0.08); tone(530, 0.18, 'square', 0.06); },
  siren: () => { tone(700, 0.25, 'triangle', 0.07, 300); tone(1000, 0.25, 'triangle', 0.07, -300, 0.25); },
  win: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.15, 0, i * 0.12)); },
  tick: () => tone(1200, 0.03, 'square', 0.04),
  door: () => tone(200, 0.08, 'square', 0.08),
};

// Motorgeräusch: Tonhöhe folgt der Geschwindigkeit
export function engineSound(on, speed) {
  if (!ac) return;
  if (!engine) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 50; g.gain.value = 0;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    o.connect(f); f.connect(g); g.connect(master); o.start();
    engine = { o, g };
  }
  const t = ac.currentTime;
  engine.g.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.1);
  engine.o.frequency.setTargetAtTime(45 + Math.abs(speed) * 0.35, t, 0.1);
}
