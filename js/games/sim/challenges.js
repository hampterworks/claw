// Claw-lenges, mutators, score and combos. Challenge progress persists.
import { read, write, submit } from '../../scores.js';
import { sfx } from '../../audio.js';

export const CHALLENGES = [
  { id: 'knock', name: 'Knock 25 things off tables', goal: 25 },
  { id: 'boil', name: 'Boil yourself in the giant pot' },
  { id: 'babies', name: 'Find all 5 Baby Glorps', goal: 5 },
  { id: 'tower', name: 'Phone home from the radio tower' },
  { id: 'news', name: 'Go live on Glorp Cat News' },
  { id: 'flop', name: 'Flop for 5 seconds straight' },
  { id: 'box', name: 'If I fits, I sits (cardboard box)' },
  { id: 'maxwell', name: 'Bonk the Maxwell statue' },
  { id: 'sky', name: 'Trampoline higher than the tower' },
  { id: 'huh', name: 'Find Huh Cat in the Ohio corn' },
  { id: 'mugs', name: 'Café chaos: knock 10 mugs off at the Glorp Café', goal: 10 },
  { id: 'fish', name: 'Fish heist: carry a dock fish to the Glorp Café' },
  { id: 'headphones', name: "Bring Matt's headphones home (they're on the Cat Tree)" },
  { id: 'roof', name: 'Climb to the Glorp Towers rooftop' },
  { id: 'cannonball', name: 'Cannonball into the pool from the roof' },
  { id: 'lap', name: 'Zoomies lap: all 6 arches in 40 seconds' },
  { id: 'ufo', name: 'Get abducted by the UFO' },
  { id: 'swim', name: 'Cats hate water: fall in Lake Meowchigan' },
  { id: 'king', name: 'King of the Cat Tree (reach the crown)' },
  { id: 'gold', name: 'Collect all 8 golden yarn balls', goal: 8 },
];

export const MUTATORS = [
  { id: 'gravity', name: 'Glorp Gravity', desc: 'moon jumps', need: 2 },
  { id: 'cursed', name: 'Cursed Face', desc: "Claw's real face", need: 4 },
  { id: 'big', name: 'Big Claw', desc: '3x size', need: 6 },
  { id: 'oiia', name: 'OIIA Mode', desc: 'spin forever', need: 9 },
  { id: 'popcat', name: 'Popcat Mode', desc: 'every bonk pops', need: 12 },
  { id: 'tiny', name: 'Tiny Claw', desc: 'smol', need: 15 },
  { id: 'matt', name: 'Matt Mode', desc: 'Claw becomes Matt', need: 18 },
];

export function createChallenges(hud) {
  const saved = read('sim', {});
  const st = {
    done: saved.done || {},
    progress: saved.progress || {},
    babies: saved.babies || [],
    gold: saved.gold || [],
    mutators: {},
  };
  let score = 0;
  let comboN = 0;
  let comboT = 0;
  const listeners = new Set();

  const save = () => write('sim', { done: st.done, progress: st.progress, babies: st.babies, gold: st.gold });
  const count = () => CHALLENGES.filter((c) => st.done[c.id]).length;

  function refresh() {
    hud.setTrophies(count(), CHALLENGES.length);
  }
  refresh();

  function complete(id) {
    if (st.done[id]) return false;
    st.done[id] = true;
    save();
    const c = CHALLENGES.find((x) => x.id === id);
    const n = count();
    const unlocked = MUTATORS.find((m) => m.need === n);
    hud.banner(`CLAW-LENGE COMPLETE`, c.name + (unlocked ? `  ·  UNLOCKED: ${unlocked.name.toUpperCase()}` : ''));
    sfx.win();
    addPoints(500, null);
    if (n === CHALLENGES.length) setTimeout(() => hud.banner('ALL CLAW-LENGES DONE', 'Claw has ascended. Glorp forever.'), 3500);
    refresh();
    listeners.forEach((f) => f(id));
    return true;
  }

  function progress(id, n = 1) {
    const c = CHALLENGES.find((x) => x.id === id);
    if (st.done[id]) return;
    st.progress[id] = (st.progress[id] || 0) + n;
    save();
    if (c.goal && st.progress[id] >= c.goal) complete(id);
  }

  // Chaos points chain into a combo multiplier when they come fast.
  function addPoints(n, label, color) {
    const mult = Math.min(5, 1 + Math.floor(comboN / 3));
    const pts = Math.round(n * mult);
    score += pts;
    if (label) hud.popup(`+${pts} ${label}`, color);
    hud.setScore(score);
    return pts;
  }

  function chaos(n, label, color) {
    comboN += 1;
    comboT = 2.5;
    const pts = addPoints(n, label, color);
    hud.setCombo(Math.min(5, 1 + Math.floor(comboN / 3)));
    return pts;
  }

  return {
    CHALLENGES,
    MUTATORS,
    state: st,
    get score() {
      return score;
    },
    complete,
    progress,
    isDone: (id) => !!st.done[id],
    count,
    points: addPoints,
    chaos,
    unlocked: (m) => count() >= MUTATORS.find((x) => x.id === m).need,
    babyFound(i) {
      if (st.babies.includes(i)) return false;
      st.babies.push(i);
      save();
      progress('babies');
      return true;
    },
    // Generic collectible list (e.g. 'gold'); the quest with the same id tracks it.
    collect(list, i) {
      if (st[list].includes(i)) return false;
      st[list].push(i);
      save();
      progress(list);
      return true;
    },
    onComplete: (f) => listeners.add(f),
    update(dt) {
      if (comboT > 0) {
        comboT -= dt;
        if (comboT <= 0) {
          comboN = 0;
          hud.setCombo(1);
        }
      }
    },
    saveBest: () => submit('sim', score),
    resetProgress() {
      st.done = {};
      st.progress = {};
      st.babies = [];
      st.gold = [];
      st.mutators = {};
      save();
      refresh();
    },
  };
}
