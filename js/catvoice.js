// Synthesized cat noises. Each takes an AudioContext, a destination node and
// a start time, so the music sequencer can place them on the beat.

// "mi-aow": a buzzy voice gliding up then down, through a moving vowel filter.
export function meow(ac, dest, when, { pitch = 520, len = 0.5, vol = 0.35 } = {}) {
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  const f = o.frequency;
  f.setValueAtTime(pitch * 0.85, when);
  f.exponentialRampToValueAtTime(pitch * 1.45, when + len * 0.35);
  f.exponentialRampToValueAtTime(pitch * 0.9, when + len);
  // a little vibrato
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = 7;
  lfoGain.gain.value = pitch * 0.03;
  lfo.connect(lfoGain).connect(f);

  const formant = ac.createBiquadFilter();
  formant.type = 'bandpass';
  formant.Q.value = 3;
  formant.frequency.setValueAtTime(700, when);
  formant.frequency.exponentialRampToValueAtTime(1900, when + len * 0.35);
  formant.frequency.exponentialRampToValueAtTime(800, when + len);
  const body = ac.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = 3200;

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.04);
  g.gain.setValueAtTime(vol, when + len * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, when + len);
  o.connect(formant).connect(body).connect(g).connect(dest);
  o.start(when);
  lfo.start(when);
  o.stop(when + len + 0.05);
  lfo.stop(when + len + 0.05);
}

// "mrrp": short rolled trill.
export function mrrp(ac, dest, when, { pitch = 340, len = 0.28, vol = 0.3 } = {}) {
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(pitch, when);
  o.frequency.exponentialRampToValueAtTime(pitch * 1.5, when + len);
  const trem = ac.createOscillator();
  const tremGain = ac.createGain();
  trem.frequency.value = 32;
  tremGain.gain.value = vol * 0.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol * 0.5, when + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, when + len);
  trem.connect(tremGain).connect(g.gain);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  o.connect(lp).connect(g).connect(dest);
  o.start(when);
  trem.start(when);
  o.stop(when + len + 0.05);
  trem.stop(when + len + 0.05);
}

let noiseBuf = null;
function noise(ac) {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// Purr: low rumbling noise pulsing ~25 times a second.
export function purr(ac, dest, when, { len = 1.6, vol = 0.25 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.2);
  g.gain.setValueAtTime(vol, when + len - 0.3);
  g.gain.linearRampToValueAtTime(0.0001, when + len);
  const am = ac.createGain();
  am.gain.value = 0.5;
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = 25;
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain).connect(am.gain);
  src.connect(lp).connect(am).connect(g).connect(dest);
  src.start(when);
  lfo.start(when);
  src.stop(when + len + 0.05);
  lfo.stop(when + len + 0.05);
}

export function noiseBuffer(ac) {
  return noise(ac);
}
