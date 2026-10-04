// "Battle of Ohio": the epic cat theme for Mega Matt vs Mega Godzilla. Original, sequenced live
// with WebAudio like Glorp Groove: brass power chords, a string ostinato, taiko drums,
// orchestra hits, and a choir of cats (meow chants on the chord tones).
// The fight in kaiju.js runs on this song's clock: BAR seconds per bar, hits on downbeats.
import { getAudioContext, isMuted } from '../../audio.js';
import { meow, mrrp, purr, noiseBuffer } from '../../catvoice.js';

export const BPM = 150;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
const STEP = BEAT / 4; // 16th
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const _ = null;

// song form, in bars (kaiju.js uses the same numbers)
export const SECTIONS = { intro: 0, rise: 4, drop: 8, march: 10, fight: 12, finale: 38, victory: 42, outro: 47, end: 50 };

const CH = {
  Dm: [50, 57, 62, 65], // root, fifth, octave, third (for the choir)
  Bb: [46, 53, 58, 62],
  F: [41, 48, 53, 57],
  C: [48, 55, 60, 64],
  Gm: [43, 50, 55, 58],
  A: [45, 52, 57, 61],
  D: [50, 57, 62, 66],
  G: [43, 50, 55, 59],
};
// fight theme: chord + brass melody in eighths
const THEME = [
  ['Dm', [74, _, 74, 77, 81, _, 79, 77]],
  ['Bb', [74, _, _, 72, 74, _, 70, _]],
  ['F', [72, _, 72, 74, 77, _, 76, 74]],
  ['C', [72, _, _, 69, 72, 74, 76, _]],
  ['Dm', [81, _, 81, 79, 77, _, 79, 81]],
  ['Bb', [82, _, 81, 79, 77, _, 74, _]],
  ['Gm', [79, _, 77, 74, 72, _, 74, 77]],
  ['A', [76, _, _, _, 73, _, 76, _]],
];
const BRIDGE = [
  ['Gm', [70, 74, 79, 74, 70, 74, 79, 82]],
  ['Dm', [69, 74, 77, 74, 69, 74, 77, 81]],
  ['Bb', [70, 74, 77, 74, 70, 74, 77, 82]],
  ['A', [81, _, 79, _, 76, _, 73, _]],
];
const FANFARE_WIN = [
  ['D', [74, _, 78, 81, 86, _, _, _]],
  ['G', [83, _, 81, 79, 83, _, 86, _]],
  ['D', [86, _, 85, 83, 81, _, 78, 81]],
  ['A', [85, _, 86, 88, 90, _, _, _]],
  ['D', [86, _, _, _, _, _, _, _]],
];
const FANFARE_LOSE = [
  ['Dm', [62, _, 65, 69, 74, _, _, _]],
  ['Bb', [70, _, 69, 65, 62, _, _, _]],
  ['Gm', [67, _, 65, 62, 58, _, _, _]],
  ['A', [61, _, 64, 67, 69, _, _, _]],
  ['Dm', [62, _, _, _, _, _, _, _]],
];

function barInfo(bar, winner) {
  const S = SECTIONS;
  if (bar < S.rise) return { sec: 'intro', chord: ['Dm', 'Dm', 'Bb', 'A'][bar], lead: null };
  if (bar < S.drop) return { sec: 'rise', chord: ['Dm', 'Bb', 'Gm', 'A'][bar - S.rise], lead: null };
  if (bar < S.march) return { sec: 'drop', chord: bar === S.drop ? 'Bb' : 'A', lead: null };
  if (bar < S.fight) return { sec: 'march', chord: 'Dm', lead: null };
  if (bar < S.finale) {
    const i = bar - S.fight;
    const loop = Math.floor(i / 12);
    const k = i % 12;
    const [chord, lead] = k < 8 ? THEME[k] : BRIDGE[k - 8];
    return { sec: 'fight', chord, lead, loop, bridge: k >= 8 };
  }
  if (bar < S.victory) return { sec: 'finale', chord: ['Gm', 'Bb', 'A', 'A'][bar - S.finale], lead: null };
  if (bar < S.outro) {
    const [chord, lead] = (winner === 'g' ? FANFARE_LOSE : FANFARE_WIN)[bar - S.victory];
    return { sec: 'victory', chord, lead };
  }
  return { sec: 'outro', chord: winner === 'g' ? 'Dm' : 'D', lead: null };
}

export function createBattleMusic({ isEnabled = () => true } = {}) {
  let ac = null;
  let master = null;
  let timer = 0;
  let nextTime = 0;
  let step = 0;
  let playing = false;
  let winner = null;
  let hits = new Set(); // 16th-steps that get an orchestra hit (impacts in the fight)

  function setup() {
    ac = getAudioContext();
    if (!ac) return false;
    if (!master) {
      master = ac.createGain();
      master.gain.value = 0;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 5;
      master.connect(comp).connect(ac.destination);
    }
    return true;
  }
  const level = () => (isEnabled() && !isMuted() ? 0.3 : 0);

  // a sawtooth "section" through a lowpass, slightly detuned pair
  function brass(freq, when, len, vol, bright = 2400) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(bright * 0.4, when);
    f.frequency.exponentialRampToValueAtTime(bright, when + 0.06);
    f.frequency.exponentialRampToValueAtTime(bright * 0.5, when + len);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.03);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, when + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    f.connect(g).connect(master);
    for (const det of [-6, 6]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, when);
      o.detune.value = det;
      o.connect(f);
      o.start(when);
      o.stop(when + len + 0.02);
    }
  }
  function strings(freq, when, len, vol) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, when);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    o.connect(f).connect(g).connect(master);
    o.start(when);
    o.stop(when + len + 0.02);
  }
  function pad(notes, when, len, vol) {
    for (const n of notes) {
      const o = ac.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(midi(n), when);
      const lfo = ac.createOscillator();
      const lg = ac.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = midi(n) * 0.008;
      lfo.connect(lg).connect(o.frequency);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol, when + len * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, when + len);
      o.connect(g).connect(master);
      o.start(when);
      lfo.start(when);
      o.stop(when + len + 0.02);
      lfo.stop(when + len + 0.02);
    }
  }
  function noiseHit(when, { len, type, f, vol, f2 }) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const filt = ac.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f, when);
    if (f2) filt.frequency.exponentialRampToValueAtTime(f2, when + len);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + len);
    src.connect(filt).connect(g).connect(master);
    src.start(when, Math.random());
    src.stop(when + len + 0.02);
  }
  function drum(kind, when, vol = 1) {
    if (kind === 'kick' || kind === 'taiko' || kind === 'tomhi') {
      const [a, b, len, v] = kind === 'kick' ? [140, 40, 0.18, 0.9] : kind === 'taiko' ? [95, 48, 0.45, 1.0] : [180, 110, 0.22, 0.55];
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(a, when);
      o.frequency.exponentialRampToValueAtTime(b, when + len * 0.7);
      const g = ac.createGain();
      g.gain.setValueAtTime(v * vol, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + len);
      o.connect(g).connect(master);
      o.start(when);
      o.stop(when + len + 0.02);
      if (kind === 'taiko') noiseHit(when, { len: 0.12, type: 'lowpass', f: 600, vol: 0.4 * vol });
      return;
    }
    if (kind === 'snare') return noiseHit(when, { len: 0.16, type: 'bandpass', f: 1900, vol: 0.5 * vol });
    if (kind === 'hat') return noiseHit(when, { len: 0.04, type: 'highpass', f: 7500, vol: 0.14 * vol });
    if (kind === 'crash') return noiseHit(when, { len: 1.6, type: 'highpass', f: 4500, f2: 2500, vol: 0.3 * vol });
  }
  // the big orchestra stab (every titan impact)
  function orchHit(chord, when) {
    const c = CH[chord];
    for (const n of [c[0] - 12, c[0], c[1], c[2]]) brass(midi(n), when, 0.5, 0.11, 3200);
    drum('taiko', when, 1.2);
    drum('crash', when);
    meow(ac, master, when, { pitch: midi(c[2]) / 2, len: 0.5, vol: 0.4 });
  }

  function schedule(s, when) {
    const bar = Math.floor(s / 16);
    const k = s % 16;
    if (bar >= SECTIONS.end) return;
    const info = barInfo(bar, winner);
    const c = CH[info.chord];
    const sec = info.sec;
    const fightish = sec === 'fight' || sec === 'finale';
    // string ostinato: driving 8ths on the root (16ths in the fight)
    if (sec !== 'intro' || bar >= 2) {
      const every = fightish ? 1 : 2;
      if (k % every === 0) strings(midi(c[0] - (k % 4 === 2 ? 0 : 12)), when, STEP * every * 0.9, fightish ? 0.07 : 0.05);
    }
    // choir of cats: long "aah" pads on the chord, meow chants on 1 and 3
    if (k === 0) pad([c[1] + 12, c[2] + 12, c[3] + 12], when, BAR * 0.98, sec === 'intro' ? 0.025 : 0.035);
    if ((sec === 'rise' || sec === 'fight' || sec === 'victory') && (k === 0 || k === 8)) meow(ac, master, when, { pitch: midi(c[k === 0 ? 2 : 3]) / 2, len: BEAT * 1.6, vol: 0.32 });
    if (sec === 'intro' && k === 0) purr(ac, master, when, { len: BAR, vol: 0.3 });
    if (sec === 'drop' && k % 4 === 0) mrrp(ac, master, when, { pitch: 180 + k * 12, vol: 0.4 });
    // brass: power chords on the downbeat, melody in the fight and the fanfare
    if (k === 0 && sec !== 'intro') for (const n of [c[0] - 12, c[0], c[1]]) brass(midi(n), when, BAR * (fightish ? 0.45 : 0.9), 0.06);
    if (info.lead && k % 2 === 0) {
      const i = k / 2;
      const note = info.lead[i];
      if (note != null) {
        let held = 1;
        while (i + held < 8 && info.lead[i + held] == null) held++;
        brass(midi(note), when, Math.min(held, 4) * STEP * 2 * 0.95, sec === 'victory' ? 0.1 : 0.08, 3600);
        if (info.loop) brass(midi(note - 12), when, Math.min(held, 4) * STEP * 2 * 0.9, 0.04, 2000);
      }
    }
    // drums
    if (sec === 'intro') {
      if (k === 0) drum('taiko', when, 0.8);
      if (bar >= 2 && k === 8) drum('taiko', when, 0.6);
    } else if (sec === 'rise') {
      // a taiko build that gets busier every bar
      const density = [8, 4, 4, 2][bar - SECTIONS.rise];
      if (k % density === 0) drum('taiko', when, 0.6 + (bar - SECTIONS.rise) * 0.15);
      if (bar === SECTIONS.rise + 2 && k === 0) drum('crash', when);
    } else if (sec === 'drop') {
      if (bar === SECTIONS.drop) {
        if (k % 2 === 0) drum('snare', when, 0.4 + k / 20); // snare roll as Matt falls
      } else if (k === 0) orchHit('A', when);
    } else {
      if (k === 0 || k === 8 || (fightish && (k === 6 || k === 10))) drum('kick', when);
      if (k === 4 || k === 12) drum('snare', when);
      if (k % 2 === 0) drum('hat', when);
      if (fightish && (k === 14 || k === 15)) drum('tomhi', when, 0.6);
      if (k === 0 && (info.bridge || sec === 'finale' || (sec === 'fight' && (bar - SECTIONS.fight) % 4 === 0))) drum('crash', when, 0.7);
    }
    if (hits.has(s)) orchHit(info.chord, when);
  }

  function tick() {
    if (nextTime < ac.currentTime - 0.1) {
      // throttled tab: skip ahead to where the song should be
      const missed = Math.ceil((ac.currentTime + 0.05 - nextTime) / STEP);
      nextTime += missed * STEP;
      step += missed;
    }
    while (nextTime < ac.currentTime + 0.15) {
      schedule(step, nextTime);
      nextTime += STEP;
      step++;
    }
  }

  return {
    // start at `at` seconds into the song (late joiners land on the right beat)
    play(at = 0, hitSteps = []) {
      if (!setup()) return;
      hits = new Set(hitSteps);
      step = Math.max(0, Math.ceil(at / STEP));
      nextTime = ac.currentTime + (step * STEP - at) + 0.02;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(level(), ac.currentTime, 0.1);
      if (!playing) timer = setInterval(tick, 25);
      playing = true;
      tick();
    },
    setWinner(w) {
      winner = w;
    },
    refreshLevel() {
      if (master) master.gain.setTargetAtTime(playing ? level() : 0, ac.currentTime, 0.1);
    },
    stop(fade = 1.2) {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      if (master) master.gain.setTargetAtTime(0, ac.currentTime, fade / 3);
    },
    get playing() {
      return playing;
    },
    dispose() {
      this.stop(0.1);
      if (master) {
        const m = master;
        setTimeout(() => m.disconnect(), 400);
      }
    },
  };
}
