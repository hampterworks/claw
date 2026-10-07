// Claw-lenges, mutators, score and combos. Challenge progress persists.
import { read, write, submit } from '../../scores.js';
import { sfx } from '../../audio.js';
import { isHalloween } from '../../season.js';

const SPOOKY = isHalloween();

export const CHALLENGES = [
  { id: 'knock', name: 'Knock 25 things off tables', spooky: 'Poltergeist mode: knock 25 things off tables', goal: 25 },
  { id: 'boil', name: 'Boil yourself in the giant pot', spooky: "Witch's brew: boil yourself in the giant pot" },
  { id: 'babies', name: 'Find all 5 Baby Glorps', spooky: "Find all 5 Baby Glorps (they're out trick-or-treating)", goal: 5 },
  { id: 'tower', name: 'Phone home from the radio tower', spooky: 'Call the ghost hotline from the radio tower' },
  { id: 'news', name: 'Go live on Glorp Cat News', spooky: 'Go live on Glorp Cat News (Halloween special)' },
  { id: 'flop', name: 'Flop for 5 seconds straight', spooky: 'Play dead: flop for 5 seconds straight' },
  { id: 'box', name: 'If I fits, I sits (try the MEGA BOX by the front door)', spooky: 'If I fits, I haunts (try the MEGA BOX by the front door)' },
  { id: 'maxwell', name: 'Bonk the Maxwell statue', spooky: "Bonk the Maxwell statue (it's cursed now)" },
  { id: 'sky', name: 'Trampoline higher than the tower', spooky: 'Trampoline higher than the tower (wave at the moon)' },
  { id: 'huh', name: 'Find Huh Cat in the Ohio corn', spooky: 'Find Huh Cat lurking in the Ohio corn' },
  { id: 'mugs', name: 'Café chaos: knock 10 mugs off at the Glorp Café', spooky: 'Café fright: knock 10 mugs off at the Glorp Café', goal: 10 },
  { id: 'fish', name: 'Fish heist: carry a dock fish to the Glorp Café', spooky: 'Ghoul snack heist: carry a dock fish to the Glorp Café' },
  { id: 'headphones', name: "Bring Matt's headphones home (they're on the Cat Tree)", spooky: "Rescue Matt's haunted headphones (they're on the Cat Tree)" },
  { id: 'roof', name: 'Climb to the Glorp Towers rooftop', spooky: 'Climb to the Glorp Towers rooftop and howl at the moon' },
  { id: 'cannonball', name: 'Cannonball into the pool from the roof', spooky: 'Bat dive: cannonball into the pool from the roof' },
  { id: 'lap', name: 'Zoomies lap: all 6 arches in 40 seconds', spooky: 'Haunted zoomies: all 6 arches in 40 seconds' },
  { id: 'ufo', name: 'Get abducted by the UFO', spooky: 'Get abducted by the UFO. Trick or treat?' },
  { id: 'swim', name: 'Cats hate water: fall in Lake Meowchigan', spooky: 'Cats hate water: fall in Lake Meowchigan (something lives there)' },
  { id: 'king', name: 'King of the Cat Tree (reach the crown)', spooky: 'Creature of the Cat Tree (reach the crown)' },
  { id: 'gold', name: 'Collect all 8 golden yarn balls', spooky: 'Trick or yarn: collect all 8 golden yarn balls', goal: 8 },
  { id: 'market', name: 'Meowtown market mayhem: knock 8 goods off the stalls', spooky: 'Meowtown monster mash: knock 8 goods off the stalls', goal: 8 },
  { id: 'windmill', name: 'Bonk the Meowtown windmill', spooky: 'Bonk the haunted Meowtown windmill' },
  { id: 'wish', name: 'Make a wish in the Meowtown fountain', spooky: 'Make a spooky wish in the Meowtown fountain' },
  { id: 'golf', name: 'Glorp Mini Golf: bonk the ball into the hole', spooky: 'Glorp Mini Golf: bonk the ball into its grave (the hole)' },
  { id: 'winty', name: 'Just say no: outrun Winty in the park', spooky: 'Just say boo: outrun Winty in the park' },
  { id: 'fishing', name: "Gone fishin': catch 5 things off the dock", spooky: "Gone ghoul fishin': catch 5 things off the dock", goal: 5 },
  { id: 'golden', name: 'Reel in the legendary Golden Glorpfish', spooky: 'Reel in the legendary Golden Glorpfish. It glows. Spooky.' },
  { id: 'pet', name: 'Adopt a pet at the Glorp Casino', spooky: 'Adopt a pet at the Glorp Casino (a familiar, if you will)' },
  { id: 'derby', name: 'Win a bet at the Pet Derby', spooky: 'Win a bet at the Pet Derby. Spooky luck.' },
  { id: 'plinko', name: 'Hit a 9x edge on Plinko Paws', spooky: 'Hit a 9x edge on Plinko Paws, if you dare' },
  { id: 'vashshelf', name: "Get Vash's sword off Matt's top shelf (he can't reach)", spooky: "Get Vash's sword off Matt's top shelf (it's his costume)" },
  { id: 'shrine', name: 'Find the secret Vash Shrine and pay respects', spooky: 'Find the secret Vash Shrine and pay spooky respects' },
  { id: 'arena', name: 'Pet Arena champion: beat all 5 trainers (Winty is last)', spooky: 'Pet Arena fright night: beat all 5 trainers (Winty is last)' },
  { id: 'hunt', name: 'Hampter Hunt: find all 6 hampters hiding in Glorp Park', spooky: 'Hampter Hunt: find all 6 hampters hiding in spooky Glorp Park' },
  { id: 'clicky1', name: "Clicky's break: bring a Glorp Café mug to Clicky the wizard (Winter's Castle)", spooky: "Clicky's witching hour: bring a Glorp Café mug to Clicky the wizard (Winter's Castle)" },
  { id: 'clicky2', name: "Find Clicky's 4 lost spell pages", spooky: "Find Clicky's 4 lost spell pages before the bats do", goal: 4 },
  { id: 'clicky3', name: 'Wake the 3 summoning stones for Clicky', spooky: 'Raise the 3 summoning stones from the dead for Clicky', goal: 3 },
  { id: 'kaiju', name: 'Survive the Battle of Ohio', spooky: 'Survive the Battle of Ohio (monster mash edition)' },
  { id: 'ducky1', name: "Ducky's prank: bonk the WINTER'S CASTLE sign crooked", spooky: "Ducky's trick: bonk the WINTER'S CASTLE sign crooked" },
  { id: 'ducky2', name: "Egg Winter's throne for Ducky", spooky: "Trick-or-egg Winter's throne for Ducky", goal: 3 },
  { id: 'ducky3', name: "Steal Winter's crown and bring it to Ducky", spooky: "Steal Winter's crown and bring it to Ducky (it's his costume)" },
];

export const MUTATORS = [
  { id: 'gravity', name: 'Glorp Gravity', desc: 'moon jumps', need: 2, spooky: { name: 'Ghost Gravity', desc: 'moon jumps, ghost style' } },
  { id: 'cursed', name: 'Cursed Face', desc: "Claw's real face", need: 4, spooky: { desc: 'scariest costume in Ohio' } },
  { id: 'big', name: 'Big Claw', desc: '3x size', need: 6, spooky: { desc: '3x size, 3x monster' } },
  { id: 'oiia', name: 'OIIA Mode', desc: 'spin forever', need: 9, spooky: { desc: 'spin forever (possessed)' } },
  { id: 'popcat', name: 'Popcat Mode', desc: 'every bonk pops', need: 12, spooky: { desc: 'every bonk pops like a pumpkin' } },
  { id: 'tiny', name: 'Tiny Claw', desc: 'smol', need: 16, spooky: { desc: 'smol (bat size)' } },
  { id: 'matt', name: 'Matt Mode', desc: 'Claw becomes Matt', need: 20, spooky: { desc: 'Claw dresses up as Matt' } },
];

// October: the spooky names and descriptions replace the normal ones for this page load
if (SPOOKY) {
  for (const c of CHALLENGES) if (typeof c.spooky === 'string') c.name = c.spooky;
  for (const m of MUTATORS) Object.assign(m, m.spooky);
}

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
  const pointListeners = new Set();

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
    hud.banner(SPOOKY ? 'BOO! CLAW-LENGE COMPLETE' : `CLAW-LENGE COMPLETE`, c.name + (unlocked ? `  ·  UNLOCKED: ${unlocked.name.toUpperCase()}` : ''), { pog: true });
    sfx.win();
    addPoints(500, null);
    if (n === CHALLENGES.length) setTimeout(() => hud.banner(SPOOKY ? 'ALL CLAW-LENGES DONE (SPOOKILY)' : 'ALL CLAW-LENGES DONE', SPOOKY ? 'Claw has ascended to the spirit realm. Glorp forever.' : 'Claw has ascended. Glorp forever.'), 3500);
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
    pointListeners.forEach((f) => f(pts));
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
    onPoints: (f) => pointListeners.add(f),
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
