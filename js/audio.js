// All sounds are synthesized with WebAudio, so there are no audio files to host.
import { read, write } from './scores.js';
import { meow, mrrp, purr } from './catvoice.js';

let ac = null;
let muted = read('muted', false);
const muteListeners = new Set();

// The shared AudioContext, created on demand (even while muted, for the music).
export function getAudioContext() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    // iPhones silence web audio when the ring switch is on silent, unless the page asks for "playback".
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function audio() {
  if (muted) return null;
  return getAudioContext();
}

export const isMuted = () => muted;

export function toggleMuted() {
  muted = !muted;
  write('muted', muted);
  muteListeners.forEach((f) => f(muted));
  return muted;
}

export function onMuteChange(fn) {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

// Browsers only allow audio after a user gesture.
export function unlockAudio() {
  audio();
}

function tone({ type = 'sine', f = 440, f2, dur = 0.15, vol = 0.18, delay = 0 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise({ dur = 0.2, vol = 0.2, type = 'lowpass', f = 1000, f2, q = 1, delay = 0 }) {
  const a = audio();
  if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const filt = a.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f, t);
  if (f2) filt.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone({ type: 'square', f: 520, f2: 760, dur: 0.06, vol: 0.06 }),
  stoke: () => noise({ dur: 0.22, f: 400, f2: 2400, vol: 0.22 }),
  splash: () => {
    noise({ dur: 0.35, type: 'bandpass', f: 2200, f2: 300, q: 0.8, vol: 0.45 });
    tone({ f: 260, f2: 90, dur: 0.18, vol: 0.12 });
  },
  bubble: () => tone({ f: 300 + Math.random() * 500, f2: 900 + Math.random() * 400, dur: 0.05, vol: 0.05 }),
  glorp: () => {
    tone({ type: 'sine', f: 380, f2: 70, dur: 0.35, vol: 0.25 });
    tone({ type: 'triangle', f: 190, f2: 40, dur: 0.35, vol: 0.12 });
  },
  pop: () => tone({ type: 'square', f: 900, f2: 300, dur: 0.07, vol: 0.12 }),
  ding: () => {
    tone({ type: 'triangle', f: 880, dur: 0.18, vol: 0.15 });
    tone({ type: 'triangle', f: 1320, dur: 0.25, vol: 0.12, delay: 0.08 });
  },
  oiia: () => {
    tone({ type: 'sawtooth', f: 420, f2: 900, dur: 0.12, vol: 0.07 });
    tone({ type: 'sawtooth', f: 900, f2: 350, dur: 0.16, vol: 0.07, delay: 0.12 });
  },
  flap: () => tone({ f: 380, f2: 720, dur: 0.08, vol: 0.1 }),
  fail: () => {
    tone({ type: 'sawtooth', f: 330, f2: 60, dur: 0.6, vol: 0.14 });
    tone({ type: 'square', f: 165, f2: 40, dur: 0.6, vol: 0.06 });
  },
  boing: () => {
    tone({ type: 'sine', f: 140, f2: 620, dur: 0.35, vol: 0.2 });
    tone({ type: 'triangle', f: 280, f2: 900, dur: 0.25, vol: 0.06, delay: 0.05 });
  },
  meow: (pitch) => {
    const a = audio();
    if (a) meow(a, a.destination, a.currentTime, { pitch: pitch || 480 + Math.random() * 200, vol: 0.28 });
  },
  mrrp: () => {
    const a = audio();
    if (a) mrrp(a, a.destination, a.currentTime, { pitch: 300 + Math.random() * 80 });
  },
  purr: () => {
    const a = audio();
    if (a) purr(a, a.destination, a.currentTime, { len: 1.2, vol: 0.3 });
  },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.22, vol: 0.14, delay: i * 0.11 })),
  boom: () => {
    noise({ dur: 0.6, f: 900, f2: 60, vol: 0.5 });
    tone({ f: 120, f2: 30, dur: 0.5, vol: 0.25 });
  },
  // hamster: a burst of tiny high chirps that sweep up then down
  squeak: () => {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = 2600 + Math.random() * 900;
      tone({ type: 'triangle', f, f2: f * 1.35, dur: 0.035, vol: 0.09, delay: i * 0.09 });
      tone({ type: 'sine', f: f * 1.35, f2: f * 0.9, dur: 0.04, vol: 0.07, delay: i * 0.09 + 0.035 });
    }
  },
  // the screaming hamster: a long wobbly shriek with a breathy edge
  hamsterScream: () => {
    for (let i = 0; i < 16; i++) {
      const base = 1900 + Math.sin(i * 0.9) * 160 + i * 18;
      tone({ type: 'sawtooth', f: base, f2: base * (i % 2 ? 0.94 : 1.06), dur: 0.08, vol: 0.05, delay: i * 0.07 });
      tone({ type: 'sine', f: base * 2, f2: base * 2.05, dur: 0.08, vol: 0.04, delay: i * 0.07 });
    }
    noise({ dur: 1.1, type: 'bandpass', f: 3200, f2: 2400, q: 2, vol: 0.12 });
  },
  // ---------- the Battle of Ohio ----------
  // kaiju roar: a growling saw sweep over rumbling noise
  roar: () => {
    for (let i = 0; i < 6; i++) tone({ type: 'sawtooth', f: 210 - i * 8 + Math.random() * 20, f2: 70, dur: 1.4, vol: 0.07, delay: i * 0.03 });
    tone({ type: 'square', f: 95, f2: 45, dur: 1.5, vol: 0.08 });
    noise({ dur: 1.6, type: 'bandpass', f: 700, f2: 220, q: 0.7, vol: 0.4 });
  },
  // air-raid siren: two slow wails
  siren: () => {
    for (let i = 0; i < 2; i++) {
      tone({ type: 'sawtooth', f: 330, f2: 660, dur: 1.2, vol: 0.05, delay: i * 2 });
      tone({ type: 'sawtooth', f: 660, f2: 320, dur: 0.8, vol: 0.05, delay: i * 2 + 1.2 });
    }
  },
  // atomic breath: rising charge, then a long hissing blast
  beam: () => {
    tone({ type: 'sine', f: 200, f2: 1400, dur: 0.6, vol: 0.12 });
    noise({ dur: 1.8, type: 'highpass', f: 1200, f2: 3000, q: 0.5, vol: 0.25, delay: 0.5 });
    tone({ type: 'sawtooth', f: 160, f2: 120, dur: 1.8, vol: 0.06, delay: 0.5 });
  },
  // ground-shaking thud (titan footsteps, landings, punches)
  quake: () => {
    noise({ dur: 0.9, f: 260, f2: 40, vol: 0.6 });
    tone({ f: 70, f2: 24, dur: 0.8, vol: 0.35 });
  },
  // one step of the dance beat (emotes): kick, hat, and a little cat-pop melody every bar
  beat: (i) => {
    if (i % 2 === 0) tone({ f: 130, f2: 45, dur: 0.14, vol: 0.22 });
    else noise({ dur: 0.05, type: 'highpass', f: 6500, vol: 0.06 });
    if (i % 4 === 2) noise({ dur: 0.12, type: 'bandpass', f: 1800, vol: 0.12 });
    const mel = [72, 76, 79, 76, 74, 77, 81, 77];
    if (i % 2 === 0) tone({ type: 'square', f: 440 * 2 ** ((mel[(i / 2) % 8] - 69) / 12), dur: 0.12, vol: 0.035 });
  },
  // the crowd goes wild
  cheer: () => noise({ dur: 0.5, type: 'bandpass', f: 1500 + Math.random() * 800, f2: 900, q: 0.6, vol: 0.12 }),
};
