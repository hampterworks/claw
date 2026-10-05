// "Glorp Groove": an original chiptune (so it's ours, royalty free), sequenced
// live with WebAudio. Pulse lead, pulse arpeggio, triangle bass, noise drums,
// and a cat section: meows, mrrps and purrs land on the beat.
import { getAudioContext, isMuted, onMuteChange, audioBus } from '../../audio.js';
import { meow, mrrp, purr, noiseBuffer } from '../../catvoice.js';

const BPM = 140;
const STEP = 60 / BPM / 4; // 16th note
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const _ = null;

const CHORDS = {
  C: { root: 48, arp: [60, 64, 67, 72] },
  G: { root: 43, arp: [59, 62, 67, 71] },
  Am: { root: 45, arp: [57, 60, 64, 69] },
  F: { root: 41, arp: [57, 60, 65, 69] },
  Em: { root: 40, arp: [55, 59, 64, 67] },
};

// Each bar: chord + lead melody in eighth notes + optional cat events (step, kind, midi).
const A = [
  ['C', [72, _, 76, 79, 76, _, 74, 72]],
  ['G', [74, _, 71, 74, 79, _, 77, 76]],
  ['Am', [76, _, 72, 76, 81, _, 79, 76]],
  ['F', [77, 76, 74, 72, 74, _, _, _], [[12, 'meow', 77]]],
  ['C', [72, _, 76, 79, 84, _, 83, 81]],
  ['G', [79, _, 74, 79, 83, _, 81, 79]],
  ['F', [77, _, 81, 77, 76, _, 74, 72]],
  ['G', [74, 76, 74, 71, 67, _, _, _], [[11, 'mrrp', 67], [14, 'mrrp', 71]]],
];
const B = [
  ['Am', [69, 72, 76, 72, 69, 72, 76, 81], [[0, 'purr']]],
  ['F', [69, 72, 77, 72, 69, 72, 77, 81]],
  ['C', [72, 76, 79, 76, 72, 76, 79, 84]],
  ['G', [83, _, 79, _, 74, _, 71, _], [[2, 'meow', 74], [10, 'meow', 79]]],
  ['Am', [81, _, 79, 76, 79, _, 76, 72]],
  ['F', [77, _, 76, 72, 74, _, 72, 69]],
  ['Em', [71, 74, 79, 74, 71, 74, 79, 83]],
  ['G', [86, _, _, _, _, _, _, _], [[2, 'meow', 79], [6, 'meow', 83], [10, 'meow', 86], [13, 'mrrp', 74]]],
];
const SONG = [...A, ...A, ...B];

function pulseWave(ac, duty) {
  const n = 40;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ac.createPeriodicWave(real, imag);
}

export function createMusic({ context } = {}) {
  let ac = null;
  let master = null;
  let waves = null;
  let timer = 0;
  let nextTime = 0;
  let step = 0;
  let playing = false;
  let enabled = true;
  let ducked = false;

  function level() {
    if (!enabled || (!context && isMuted())) return 0;
    return ducked ? 0.08 : 0.24;
  }

  function setup() {
    ac = context || getAudioContext();
    if (!ac) return false;
    if (!master) {
      master = ac.createGain();
      master.gain.value = 0;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(context ? ac.destination : audioBus('music')); // (offline renders go straight out)
      waves = { lead: pulseWave(ac, 0.25), arp: pulseWave(ac, 0.125) };
    }
    return true;
  }

  function applyLevel() {
    if (!master) return;
    master.gain.setTargetAtTime(level(), ac.currentTime, 0.15);
  }

  function voice(wave, freq, when, len, vol, type) {
    const o = ac.createOscillator();
    if (type) o.type = type;
    else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(freq, when);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.55, when + len * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    o.connect(g).connect(master);
    o.start(when);
    o.stop(when + len + 0.02);
  }

  function drum(kind, when) {
    if (kind === 'kick') {
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.9, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
      o.connect(g).connect(master);
      o.start(when);
      o.stop(when + 0.18);
      return;
    }
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    const len = kind === 'snare' ? 0.14 : kind === 'open' ? 0.16 : 0.04;
    f.type = kind === 'snare' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 'snare' ? 1800 : 7000;
    g.gain.setValueAtTime(kind === 'snare' ? 0.5 : 0.18, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + len);
    src.connect(f).connect(g).connect(master);
    src.start(when, Math.random());
    src.stop(when + len + 0.02);
  }

  function schedule(s, when) {
    const barIdx = Math.floor(s / 16) % SONG.length;
    const inBar = s % 16;
    const [chordName, lead, cats] = SONG[barIdx];
    const chord = CHORDS[chordName];
    const inB = barIdx >= A.length * 2;

    // lead: eighth notes, held through the following rests
    if (inBar % 2 === 0) {
      const note = lead[inBar / 2];
      if (note != null) {
        let held = 1;
        while (inBar / 2 + held < 8 && lead[inBar / 2 + held] == null) held++;
        voice(waves.lead, midi(note), when, Math.min(held, 3) * STEP * 2 * 0.92, 0.16);
        // second time through A gets an echo an octave down
        if (barIdx >= A.length && !inB) voice(waves.arp, midi(note - 12), when + STEP, STEP * 1.6, 0.05);
      }
    }
    // arpeggio: 16ths over the chord
    voice(waves.arp, midi(chord.arp[inBar % 4] + (inB ? 12 : 0)), when, STEP * 0.9, 0.045);
    // bass: root / octave on eighths
    if (inBar % 2 === 0) voice(null, midi(chord.root + (inBar % 4 === 2 ? 12 : 0)), when, STEP * 1.8, 0.32, 'triangle');
    // drums
    if (inBar === 0 || inBar === 8 || (inB && inBar === 10)) drum('kick', when);
    if (inBar === 4 || inBar === 12) drum('snare', when);
    if (inBar % 2 === 0 && inBar !== 14) drum('hat', when);
    if (inBar === 14) drum('open', when);
    // cats
    if (cats) {
      for (const [at, kind, note] of cats) {
        if (at !== inBar) continue;
        if (kind === 'meow') meow(ac, master, when, { pitch: midi(note) / 2, len: 0.45, vol: 0.5 });
        else if (kind === 'mrrp') mrrp(ac, master, when, { pitch: midi(note) / 2, vol: 0.55 });
        else if (kind === 'purr') purr(ac, master, when, { len: STEP * 32, vol: 0.4 });
      }
    }
  }

  function tick() {
    if (nextTime < ac.currentTime - 0.1) nextTime = ac.currentTime + 0.05; // skip what we missed while throttled
    while (nextTime < ac.currentTime + 0.15) {
      schedule(step, nextTime);
      nextTime += STEP;
      step++;
    }
  }

  const offMute = context ? () => {} : onMuteChange(applyLevel);

  return {
    start() {
      if (playing || !setup()) return;
      playing = true;
      nextTime = ac.currentTime + 0.08;
      applyLevel();
      tick();
      timer = setInterval(tick, 25);
    },
    stop() {
      playing = false;
      clearInterval(timer);
      if (master) master.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    },
    // Schedule the whole song at once (used to render it with an OfflineAudioContext).
    scheduleAll(loops = 1) {
      setup();
      master.gain.value = level();
      for (let i = 0; i < SONG.length * 16 * loops; i++) schedule(i, 0.05 + i * STEP);
      return 0.05 + SONG.length * 16 * loops * STEP + 0.6;
    },
    setEnabled(v) {
      enabled = v;
      applyLevel();
    },
    get enabled() {
      return enabled;
    },
    get playing() {
      return playing;
    },
    get output() {
      return master;
    },
    duck(v) {
      ducked = v;
      applyLevel();
    },
    dispose() {
      this.stop();
      offMute();
      if (master) {
        const m = master;
        setTimeout(() => m.disconnect(), 300);
      }
    },
  };
}
