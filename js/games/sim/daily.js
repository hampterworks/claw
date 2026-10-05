// Daily quests: three a day, picked from a pool by the local date (so everyone gets the same three
// on the same day), coins for each, a bonus for all three that grows with your streak.
// Anything in the game reports progress with trackDaily(kind, amount).
import { read, write } from '../../scores.js';

// kind: what counts. goal: [min, max]. sec: measured in seconds (shown rounded).
const POOL = [
  { id: 'knock', kind: 'knock', goal: [8, 15], reward: 120, text: (n) => `Knock ${n} things off tables` },
  { id: 'mugs', kind: 'mug', goal: [4, 6], reward: 140, text: (n) => `Knock ${n} mugs off at the Glorp Café` },
  { id: 'boil', kind: 'boil', goal: [1, 2], reward: 100, text: (n) => (n > 1 ? `Boil yourself ${n} times` : 'Boil yourself in the giant pot') },
  { id: 'fish', kind: 'fish', goal: [2, 4], reward: 150, text: (n) => `Catch ${n} fish off the dock` },
  { id: 'petwin', kind: 'petwin', goal: [1, 2], reward: 180, text: (n) => `Win ${n} pet battle${n > 1 ? 's' : ''} at the arena` },
  { id: 'casino', kind: 'casino', goal: [3, 6], reward: 110, text: (n) => `Play ${n} games at the Glorp Casino` },
  { id: 'hampter', kind: 'hampter', goal: [3, 5], reward: 100, text: (n) => `Pet Hampter ${n} times` },
  { id: 'emote', kind: 'emote', goal: [4, 8], reward: 100, text: (n) => `Do ${n} emotes or dances (G)` },
  { id: 'dance', kind: 'danceSec', goal: [25, 40], sec: true, reward: 120, text: (n) => `Dance for ${n} seconds` },
  { id: 'tramp', kind: 'tramp', goal: [3, 5], reward: 110, text: (n) => `Bounce on the trampoline ${n} times` },
  { id: 'hunt', kind: 'huntfind', goal: [3, 6], reward: 160, text: (n) => `Find ${n} hiding hampters (Hampter Hunt)` },
  { id: 'night', kind: 'nightcastle', goal: [1, 1], reward: 150, text: () => "Visit Winter's Castle at night" },
  { id: 'snow', kind: 'snowSec', goal: [20, 30], sec: true, reward: 100, text: (n) => `Catch snowflakes at Winter's Castle for ${n} seconds` },
  { id: 'zoom', kind: 'zoomSec', goal: [15, 25], sec: true, reward: 100, text: (n) => `Do zoomies for ${n} seconds` },
  { id: 'flop', kind: 'flopSec', goal: [10, 20], sec: true, reward: 100, text: (n) => `Flop around for ${n} seconds` },
  { id: 'points', kind: 'points', goal: [1500, 3000], reward: 130, text: (n) => `Score ${n.toLocaleString()} Glorp Points` },
  { id: 'lick', kind: 'lick', goal: [5, 10], reward: 100, text: (n) => `Lick ${n} things` },
];
const STREAK_MAX = 7;

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function yesterday(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
// the same three quests for everyone on a given date
export function questsFor(key) {
  const r = rng(hash('glorp-daily-' + key));
  const pool = [...POOL];
  const out = [];
  while (out.length < 3) {
    const q = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const [lo, hi] = q.goal;
    let goal = lo + Math.floor(r() * (hi - lo + 1));
    if (goal >= 100) goal = Math.round(goal / 50) * 50;
    else if (goal >= 20) goal = Math.round(goal / 5) * 5;
    out.push({ id: q.id, goal, n: 0, done: false });
  }
  return out;
}

let active = null;
export function trackDaily(kind, n = 1) {
  active?.track(kind, n);
}

export function createDaily({ wrap, hud, sfx, wallet, onOpen, today = dayKey }) {
  let st = read('simdaily', null);
  function roll() {
    const key = today();
    if (st && st.day === key) return;
    const prev = st || { streak: 0, lastFull: null };
    st = { day: key, list: questsFor(key), streak: prev.lastFull === yesterday(key) ? prev.streak : 0, lastFull: prev.lastFull, bonus: false };
    save();
  }
  const save = () => write('simdaily', st);
  roll();

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'sim-chip daily';
  chip.title = 'Daily quests';
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    onOpen?.();
  });
  wrap.querySelector('.sim-top-right')?.prepend(chip);
  const paint = () => {
    const d = st.list.filter((q) => q.done).length;
    chip.textContent = `📅 ${d}/3`;
    chip.classList.toggle('all', d === 3);
  };
  paint();

  const def = (q) => POOL.find((p) => p.id === q.id);
  let saveT = 0;
  const api = {
    get state() {
      return st;
    },
    track(kind, amount = 1) {
      roll();
      for (const q of st.list) {
        const d = def(q);
        if (!d || q.done || d.kind !== kind) continue;
        const before = Math.floor(q.n);
        q.n = Math.min(q.goal, q.n + amount);
        if (q.n >= q.goal) {
          q.done = true;
          wallet.add(d.reward);
          sfx.win();
          hud.banner('📅 DAILY QUEST DONE', `${d.text(q.goal)} · +${d.reward} 🪙`);
          if (st.list.every((x) => x.done) && !st.bonus) {
            st.bonus = true;
            st.streak = Math.min(STREAK_MAX * 52, st.streak + 1);
            st.lastFull = st.day;
            const bonus = 150 + 50 * Math.min(st.streak, STREAK_MAX) + (st.streak % STREAK_MAX === 0 ? 500 : 0);
            wallet.add(bonus);
            setTimeout(() => hud.banner('ALL DAILY QUESTS DONE', `🔥 ${st.streak}-day streak · +${bonus} bonus 🪙${st.streak % STREAK_MAX === 0 ? ' (WEEK STREAK!)' : ''}`, { pog: true }), 3300);
          }
          save();
          paint();
        } else if (!d.sec && Math.floor(q.n) > before) {
          hud.popup(`📅 ${Math.floor(q.n)}/${q.goal}`, '#5ff2ff');
          saveT = 0.5;
        } else if (saveT <= 0) saveT = 2; // timed quests: save every couple of seconds
      }
    },
    update(dt) {
      if (saveT > 0) {
        saveT -= dt;
        if (saveT <= 0) save();
      }
    },
    // for the quest log
    section() {
      roll();
      const box = document.createElement('div');
      box.className = 'daily-box';
      const now = new Date();
      const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const mins = Math.max(0, Math.round((mid - now) / 60000));
      const head = document.createElement('p');
      head.className = 'daily-head';
      head.textContent = `🔥 streak ${st.streak} day${st.streak === 1 ? '' : 's'} · new quests in ${Math.floor(mins / 60)}h ${mins % 60}m`;
      box.appendChild(head);
      for (const q of st.list) {
        const d = def(q);
        const row = document.createElement('div');
        row.className = 'daily-q' + (q.done ? ' done' : '');
        const t = document.createElement('span');
        t.textContent = `${q.done ? '✅' : '⬜'} ${d.text(q.goal)}`;
        const r = document.createElement('b');
        r.textContent = `${d.reward} 🪙`;
        const bar = document.createElement('i');
        const fill = document.createElement('em');
        fill.style.width = `${(Math.min(q.n, q.goal) / q.goal) * 100}%`;
        bar.appendChild(fill);
        const n = document.createElement('small');
        n.textContent = `${Math.floor(q.n)}/${q.goal}${d.sec ? 's' : ''}`;
        row.append(t, r, bar, n);
        box.appendChild(row);
      }
      const foot = document.createElement('p');
      foot.className = 'fine';
      foot.textContent = `Finish all three for a bonus (bigger every day of your streak, extra on day ${STREAK_MAX}). Everyone gets the same quests today.`;
      box.appendChild(foot);
      return box;
    },
    dispose() {
      save();
      chip.remove();
      if (active === api) active = null;
    },
  };
  active = api;
  return api;
}
