// Emotes and dances: an emote wheel (G, or the 😀 button on touch), procedural moves on the Claw
// (claw.js), a speech bubble, a little dance beat, and online sync so everyone sees your moves.
// Three or more Claws dancing together starts a DANCE PARTY.
import * as THREE from 'three';
import { createBubble } from './speech.js';

export const EMOTES = [
  { id: 'chipi', name: 'Chipi Chipi', icon: '💃', dance: true, say: '🎶 chipi chipi chapa chapa' },
  { id: 'spin', name: 'OIIA Spin', icon: '🌀', dance: true, say: 'OIIA OIIA' },
  { id: 'caramell', name: 'Caramell Hop', icon: '🐰', dance: true, say: '🎵 dansen!' },
  { id: 'loaf', name: 'Loaf', icon: '🍞', dance: true, say: '(is loaf)' },
  { id: 'pog', name: 'Pog', icon: '😮', dur: 1.6, say: 'POG' },
  { id: 'wave', name: 'Wave', icon: '👋', dur: 2.2, say: 'hiii' },
  { id: 'cry', name: 'Cry', icon: '😭', dur: 3, say: '😭😭😭' },
  { id: 'scream', name: 'Scream', icon: '😱', dur: 1.6, say: 'AAAAAAA' },
];
export const EMOTE_IDS = EMOTES.map((e) => e.id);
const byId = (id) => EMOTES.find((e) => e.id === id);
const PARTY_R = 8;
const BEAT = 60 / 140 / 2; // 8th notes at 140 bpm

export function createEmotes({ wrap, scene, claw, hud, sfx, net, players, touch, isPlaying, isPaused, onEmote, onParty, hampter }) {
  const bubble = createBubble(scene);
  const st = { cur: null, beatT: 0, beatI: 0, partyCd: 0, hamCd: 0 };
  const dancing = new Set(); // remote ids currently dancing

  // ---------- the wheel ----------
  const wheel = document.createElement('div');
  wheel.className = 'emote-wheel';
  wheel.hidden = true;
  const center = document.createElement('div');
  center.className = 'emote-center';
  center.textContent = touch ? 'EMOTES' : 'EMOTES\n1-8 · G';
  wheel.appendChild(center);
  EMOTES.forEach((e, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'emote-slot' + (e.dance ? ' dance' : '');
    const a = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
    b.style.setProperty('--x', `${Math.cos(a) * 118}px`);
    b.style.setProperty('--y', `${Math.sin(a) * 118}px`);
    b.innerHTML = '';
    const ic = document.createElement('b');
    ic.textContent = e.icon;
    const nm = document.createElement('span');
    nm.textContent = touch ? e.name : `${i + 1} ${e.name}`;
    b.append(ic, nm);
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      play(e.id);
      close();
    });
    wheel.appendChild(b);
  });
  wrap.appendChild(wheel);
  let touchBtn = null;
  if (touch) {
    touchBtn = document.createElement('button');
    touchBtn.type = 'button';
    touchBtn.className = 'sim-chip emote-btn';
    touchBtn.textContent = '😀';
    touchBtn.setAttribute('aria-label', 'Emotes');
    wrap.querySelector('.sim-top-right')?.prepend(touchBtn);
    touchBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggle();
    });
  }
  const open = () => isPlaying() && !isPaused() && (wheel.hidden = false);
  const close = () => (wheel.hidden = true);
  const toggle = () => (wheel.hidden ? open() : close());

  function onKey(e) {
    if (!isPlaying() || isPaused() || e.repeat || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return;
    if (e.code === 'KeyG') {
      e.preventDefault();
      toggle();
      return;
    }
    if (!wheel.hidden) {
      const n = Number(e.key);
      if (n >= 1 && n <= EMOTES.length) {
        e.preventDefault();
        e.stopPropagation();
        play(EMOTES[n - 1].id);
        close();
      } else if (e.code === 'Escape') close();
    }
  }
  window.addEventListener('keydown', onKey, true);

  // ---------- playing ----------
  function play(id) {
    const e = byId(id);
    if (!e) return;
    claw.setFlop?.(false);
    claw.emote(id, e.dance ? 0 : e.dur);
    st.cur = id;
    st.beatT = 0;
    bubble.say(e.say, e.dance ? 3 : e.dur);
    if (id === 'scream') sfx.hamsterScream();
    else if (id === 'pog') sfx.boing();
    else if (id === 'wave') sfx.mrrp();
    else if (id === 'cry') sfx.meow(380);
    else if (id === 'spin') sfx.oiia();
    net?.connected && net.send({ t: 'emote', e: id });
    onEmote?.(id);
  }

  if (net) {
    net.on('emote', (m) => {
      const r = players?.remotes.get(m.id);
      if (!r?.puppet) return;
      if (m.e === 'stop') {
        r.puppet.stopEmote();
        dancing.delete(m.id);
        return;
      }
      const e = byId(m.e);
      if (!e) return;
      r.puppet.emote(e.id, e.dance ? 0 : e.dur);
      r.bubble.say(e.say, e.dance ? 3 : e.dur);
      if (e.dance) dancing.add(m.id);
      else dancing.delete(m.id);
    });
    net.on('leave', (m) => dancing.delete(m.id));
  }

  const tmp = new THREE.Vector3();
  return {
    get open() {
      return !wheel.hidden;
    },
    get dancing() {
      return !!(st.cur && byId(st.cur)?.dance && claw.st.emote);
    },
    play,
    close,
    update(dt) {
      const p = claw.position();
      const k = claw.st.scaleK;
      bubble.update(dt, tmp.set(p.x, p.y + 0.95 * k + 0.5, p.z));
      // the dance ended (you moved): tell the others
      if (st.cur && !claw.st.emote) {
        if (byId(st.cur)?.dance) net?.connected && net.send({ t: 'emote', e: 'stop' });
        st.cur = null;
        bubble.clear();
      }
      if (!this.dancing) return;
      // the beat
      st.beatT -= dt;
      if (st.beatT <= 0) {
        st.beatT += BEAT;
        if (st.cur !== 'loaf') sfx.beat(st.beatI++);
      }
      // dance party: 3+ Claws dancing close together
      st.partyCd -= dt;
      if (st.partyCd <= 0 && players) {
        let n = 0;
        for (const id of dancing) {
          const r = players.remotes.get(id);
          if (r?.puppet) {
            const q = r.puppet.position();
            if (Math.hypot(q.x - p.x, q.z - p.z) < PARTY_R) n++;
          }
        }
        if (n >= 2) {
          st.partyCd = 20;
          hud.banner('🪩 DANCE PARTY 🪩', `${n + 1} Claws are dancing together`, { pog: true });
          sfx.win();
          onParty?.(n + 1);
        }
      }
      // Hampter dances along
      st.hamCd -= dt;
      if (hampter && st.hamCd <= 0 && Math.hypot(p.x - hampter.pos.x, p.z - hampter.pos.z) < 5) {
        st.hamCd = 6;
        hampter.squeak();
      }
    },
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      wheel.remove();
      touchBtn?.remove();
      bubble.clear();
    },
  };
}
