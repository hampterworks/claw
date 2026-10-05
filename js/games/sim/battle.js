// Pet Battles at the Pet Battle Arena. Turn based: both sides pick a move at the same time.
//   👊 BONK beats 💥 SPECIAL (interrupts it)   🛡️ GUARD beats 👊 BONK (blocks + counters)
//   💥 SPECIAL beats 🛡️ GUARD (smashes through), and costs 2 charge
// Offline: a ladder of five trainers. Online: challenge another player, optionally for coins.
// Every random roll comes from a shared seed, so both players' screens agree on what happened.
import { PETS, petById, petIcon } from './pets.js';
import { read, write } from '../../scores.js';
import { trackDaily } from './daily.js';

const RARITY_STATS = {
  common: { hp: 60, atk: 10 },
  rare: { hp: 67, atk: 11.2 },
  epic: { hp: 75, atk: 12.4 },
  legendary: { hp: 84, atk: 13.6 },
};
const SPECIALS = {
  chick: 'NUGGET NOVA', pig: 'BACON BARRAGE', cow: 'MOO-CLEAR BLAST', bunny: 'CHUNGUS SLAM', beaver: 'DAM BREAKER',
  hog: 'HOG RIDAAA', caterpillar: 'VERY HUNGRY CHOMP', deer: 'OH DEER STRIKE', dog: 'MUCH WOW BEAM', crab: 'CRAB RAVE',
  fish: 'FLOP OF DOOM', bee: 'YA LIKE JAZZ', penguin: 'NOOT NOOT', koala: 'NAP ATTACK', parrot: 'PARTY TIME',
  fox: 'RING-DING-DING', monkey: 'RETURN TO MONKE', panda: 'SKADOOSH', elephant: 'STAMPEDE', giraffe: 'NECK SLAP',
  polar: 'POLAR PLUNGE', lion: 'ROAR OF OHIO', tiger: 'CAROLE BASKIN', cat: 'GLORP BEAM',
};
export const MOVES = {
  bonk: { icon: '👊', name: 'BONK', key: '1', tip: 'beats Special' },
  guard: { icon: '🛡️', name: 'GUARD', key: '2', tip: 'beats Bonk, +1 charge' },
  special: { icon: '💥', name: 'SPECIAL', key: '3', tip: 'beats Guard, costs 2 charge' },
};
const MAX_ROUNDS = 15;
const MAX_CHARGE = 3;
const PVP_TURN = 12; // seconds to pick a move online
export const BETS = [0, 25, 100, 250];

// the offline ladder
export const TRAINERS = [
  { id: 'hampter', name: 'Hampter', pet: 'bunny', hp: 0.85, iq: 0.15, prize: 40, color: '#ffb347', line: '*squeak* (he believes in his bunny)' },
  { id: 'vash', name: 'Vash', pet: 'fox', hp: 0.95, iq: 0.35, prize: 75, color: '#b48cff', line: 'My fox is bigger than me. That is allowed.' },
  { id: 'romni', name: 'Romni', pet: 'dog', hp: 1.05, iq: 0.5, prize: 120, color: '#f5cd30', line: 'If I win, you owe me 20% interest.' },
  { id: 'matt', name: 'Matt', pet: 'monkey', hp: 1.15, iq: 0.65, prize: 200, color: '#ffe14d', line: 'POG. Monke is undefeated.' },
  { id: 'winty', name: 'Winty', pet: 'tiger', hp: 1.3, iq: 0.8, prize: 400, color: '#ff6a8a', line: 'My tiger is a licensed pharmacist too.' },
];

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function petStats(id, hpMul = 1) {
  const pet = petById(id) || PETS[0];
  const base = RARITY_STATS[pet.rarity];
  const h = hash(pet.id);
  const hp = Math.round((base.hp + (h % 7)) * hpMul);
  return { pet, hp, maxHp: hp, atk: base.atk + ((h >> 3) % 3) * 0.4, charge: 0, special: SPECIALS[pet.id] || 'SUPER BONK' };
}

// One round. a/b: fighter states (mutated). Returns log lines + per-side damage taken.
export function resolveRound(a, b, mvA, mvB, seed, round) {
  if (mvA === 'special' && a.charge < 2) mvA = 'bonk';
  if (mvB === 'special' && b.charge < 2) mvB = 'bonk';
  const rnd = mulberry(seed ^ Math.imul(round + 1, 2654435761));
  const log = [];
  const dmg = [0, 0]; // damage dealt TO a, TO b
  const crit = [false, false];
  const hitFor = (atk, mult, side) => {
    let d = atk * mult * (0.9 + rnd() * 0.2);
    if (rnd() < 0.12) {
      d *= 1.5;
      crit[side] = true;
    }
    return d;
  };
  const sides = [
    [a, mvA, b, mvB, 1],
    [b, mvB, a, mvA, 0],
  ];
  for (const [me, mv, foe, foeMv, target] of sides) {
    const name = me.pet.name;
    if (mv === 'guard') continue;
    if (mv === 'bonk') {
      let d = hitFor(me.atk, 1, target);
      if (foeMv === 'guard') {
        d *= 0.25;
        dmg[1 - target] += me.atk * 0.3; // counter
        log.push(`${foe.pet.name} blocked the bonk and bonked back!`);
      } else if (foeMv === 'special') log.push(`${name} BONKED ${foe.pet.name} mid-wind-up!`);
      else log.push(`${name} used BONK.`);
      dmg[target] += d;
    } else {
      let d = hitFor(me.atk, 2.3, target);
      me.charge -= 2;
      if (foeMv === 'bonk') {
        d *= 0.5;
        log.push(`${name} used ${me.special}... but got interrupted (half damage).`);
      } else if (foeMv === 'guard') log.push(`${name} used ${me.special}! GUARD SMASHED!`);
      else log.push(`${name} used ${me.special}!`);
      dmg[target] += d;
    }
  }
  if (mvA === 'guard' && mvB === 'guard') log.push('Both pets guarded. They stare at each other. Tension.');
  for (const [i, f, mv] of [[0, a, mvA], [1, b, mvB]]) {
    const d = Math.round(dmg[i]);
    dmg[i] = d;
    f.hp = Math.max(0, f.hp - d);
    if (mv === 'guard') f.charge = Math.min(MAX_CHARGE, f.charge + 1);
    if (d > 0) f.charge = Math.min(MAX_CHARGE, f.charge + 1);
  }
  if (crit[1] && dmg[1]) log.push('CRITICAL GLORP!');
  if (crit[0] && dmg[0]) log.push('CRITICAL GLORP!');
  return { log, dmg, moves: [mvA, mvB] };
}

// trainer AI: smarter trainers read your charge
function aiMove(me, foe, iq) {
  const r = Math.random();
  if (me.charge >= 2 && r < 0.35 + iq * 0.3) return foe.charge >= 2 && Math.random() < iq ? 'bonk' : 'special';
  if (foe.charge >= 2 && Math.random() < iq) return 'bonk'; // you're about to special: interrupt it
  return Math.random() < 0.62 - iq * 0.12 ? 'bonk' : 'guard';
}

export function createBattles({ wallet, hud, sfx, ch, net, players, openPanel, onFx }) {
  const progress = read('simarena', { beat: 0, wins: 0 });
  const save = () => write('simarena', progress);
  let fight = null; // the battle on screen
  let pending = null; // an outgoing challenge waiting for an answer
  let pickPet = wallet.pet && wallet.pets.includes(wallet.pet) ? wallet.pet : wallet.pets[0] || 'chick';

  const myPets = () => (wallet.pets.length ? wallet.pets : ['chick']);

  // ---------- the battle screen ----------
  function battleView({ me, foe, foeName, foeColor, title, onMove, pvp }) {
    const root = el('div', 'pb');
    const field = el('div', 'pb-field');
    const side = (f, who, color) => {
      const s = el('div', `pb-side ${who}`);
      const icon = petIcon(f.pet, 76);
      icon.classList.add('pb-icon');
      s.appendChild(icon);
      const nm = el('div', 'pb-name', f.pet.name);
      nm.style.color = color || '';
      s.appendChild(nm);
      s.appendChild(el('div', 'pb-owner', who === 'me' ? 'you' : foeName));
      const bar = el('div', 'pb-hp');
      const fill = el('i');
      bar.appendChild(fill);
      const hpText = el('span');
      bar.appendChild(hpText);
      s.appendChild(bar);
      const pips = el('div', 'pb-charge');
      s.appendChild(pips);
      const update = () => {
        fill.style.width = `${(f.hp / f.maxHp) * 100}%`;
        fill.dataset.low = f.hp / f.maxHp < 0.3 ? '1' : '';
        hpText.textContent = `${f.hp} / ${f.maxHp}`;
        pips.textContent = '⚡'.repeat(f.charge) + '·'.repeat(MAX_CHARGE - f.charge);
      };
      update();
      return { s, icon, update };
    };
    const A = side(me, 'me', '#7CFF4F');
    const B = side(foe, 'foe', foeColor);
    field.appendChild(A.s);
    field.appendChild(el('div', 'pb-vs', 'VS'));
    field.appendChild(B.s);
    root.appendChild(el('div', 'pb-title', title));
    root.appendChild(field);
    const log = el('div', 'pb-log');
    root.appendChild(log);
    const status = el('div', 'pb-status');
    root.appendChild(status);
    const row = el('div', 'pb-moves');
    const btns = {};
    for (const [id, m] of Object.entries(MOVES)) {
      const b = el('button', 'btn pb-move');
      b.type = 'button';
      b.innerHTML = '';
      b.appendChild(el('b', null, `${m.icon} ${m.name}`));
      b.appendChild(el('small', null, `${m.key} · ${m.tip}`));
      b.addEventListener('click', () => onMove(id));
      btns[id] = b;
      row.appendChild(b);
    }
    root.appendChild(row);
    // newest round on top, each round reads top to bottom
    const say = (lines, color) => {
      const g = el('div', 'pb-round');
      for (const l of lines) {
        const p = el('p', null, l);
        if (color) p.style.color = color;
        g.appendChild(p);
      }
      log.prepend(g);
      while (log.children.length > 3) log.lastChild.remove();
    };
    const lock = (on) => {
      for (const [id, b] of Object.entries(btns)) b.disabled = on || (id === 'special' && me.charge < 2);
    };
    const anim = (res) => {
      const [mvA, mvB] = res.moves;
      if (mvA !== 'guard') A.icon.classList.add('lunge');
      if (mvB !== 'guard') B.icon.classList.add('lunge');
      setTimeout(() => {
        A.icon.classList.remove('lunge');
        B.icon.classList.remove('lunge');
        for (const [ico, d, card] of [[A.icon, res.dmg[0], A.s], [B.icon, res.dmg[1], B.s]]) {
          if (d > 0) {
            ico.classList.add('hit');
            const n = el('span', 'pb-dmg', `-${d}`);
            card.appendChild(n);
            setTimeout(() => n.remove(), 900);
            setTimeout(() => ico.classList.remove('hit'), 400);
          }
        }
        A.update();
        B.update();
      }, 260);
    };
    const keys = (e) => {
      const m = Object.entries(MOVES).find(([, v]) => v.key === e.key);
      if (m && !btns[m[0]].disabled) {
        e.preventDefault();
        onMove(m[0]);
      }
    };
    document.addEventListener('keydown', keys);
    lock(false);
    return {
      root,
      say,
      lock,
      anim,
      status: (t) => (status.textContent = t),
      refresh: () => (A.update(), B.update()),
      detach: () => document.removeEventListener('keydown', keys),
      pvp,
    };
  }

  function finish(won, draw, text) {
    if (!fight) return;
    const f = fight;
    fight = null;
    clearInterval(f.tick);
    f.view.lock(true);
    f.view.status(text);
    if (draw) sfx.click();
    else if (won) sfx.win();
    else sfx.fail();
    f.onEnd?.(won, draw);
    // what next
    const row = el('div', 'pb-moves');
    const back = el('button', 'btn primary', '⚔️ Back to the arena');
    back.type = 'button';
    back.addEventListener('click', () => openPanel('PET BATTLE ARENA', arenaPanel()));
    row.appendChild(back);
    f.view.root.querySelector('.pb-moves').replaceWith(row);
  }

  // ---------- offline: fight a trainer ----------
  function startTrainer(i) {
    const tr = TRAINERS[i];
    const me = petStats(pickPet);
    const foe = petStats(tr.pet, tr.hp);
    const seed = (Math.random() * 2 ** 31) | 0;
    let round = 0;
    const f = { me, foe };
    f.view = battleView({
      me,
      foe,
      foeName: tr.name,
      foeColor: tr.color,
      title: `${tr.name.toUpperCase()}'S ${foe.pet.name.toUpperCase()}`,
      onMove: (mv) => {
        if (fight !== f || f.busy) return;
        f.busy = true;
        f.view.lock(true);
        const res = resolveRound(me, foe, mv, aiMove(foe, me, tr.iq), seed, round++);
        sfx[res.dmg[1] > res.dmg[0] ? 'stoke' : 'boing']?.();
        f.view.anim(res);
        f.view.say([`You ${MOVES[res.moves[0]].icon} vs ${MOVES[res.moves[1]].icon} ${tr.name}`, ...res.log]);
        setTimeout(() => {
          f.busy = false;
          if (fight !== f) return;
          if (me.hp <= 0 || foe.hp <= 0 || round >= MAX_ROUNDS) {
            const won = foe.hp / foe.maxHp < me.hp / me.maxHp;
            const draw = foe.hp / foe.maxHp === me.hp / me.maxHp;
            finish(won, draw, won ? `YOU WIN! ${tr.name} is in shambles.` : draw ? 'A draw. Nobody is happy.' : `${tr.name} wins. Your pet needs a nap.`);
            return;
          }
          f.view.lock(false);
        }, 700);
      },
    });
    f.onEnd = (won) => {
      if (!won) {
        f.view.say([`${tr.name}: "${['gg', 'skill issue', 'rematch? (no)', 'ez'][Math.floor(Math.random() * 4)]}"`], tr.color);
        return;
      }
      trackDaily('petwin');
      const first = progress.beat <= i;
      const prize = first ? tr.prize : Math.round(tr.prize / 2);
      wallet.add(prize);
      progress.wins++;
      if (first) progress.beat = i + 1;
      save();
      f.view.say([`+${prize} 🪙${first ? '' : ' (rematch prize)'}`], '#ffe14d');
      if (i === TRAINERS.length - 1 && first) {
        hud.banner('PET ARENA CHAMPION', `You beat Winty! +${prize} Glorp Coins`, { pog: true });
        ch.complete('arena');
        onFx?.('became the Pet Arena champion ⚔️🏆');
      } else if (first) hud.popup(`NEXT UP: ${TRAINERS[i + 1].name.toUpperCase()}`, '#ff7bf2');
    };
    fight = f;
    f.view.say([`${tr.name}: "${tr.line}"`], tr.color);
    f.view.status('Pick a move');
    return f.view.root;
  }

  // ---------- online: player vs player ----------
  function startPvp({ foeId, foeName, foePet, seed, side, bet }) {
    const me = petStats(pickPet);
    const foe = petStats(foePet);
    const f = { me, foe, pvp: true, foeId, bet, round: 0, mine: {}, theirs: {} };
    // side A = challenger. Resolve in A,B order on both screens so the rolls match.
    const resolve = () => {
      const r = f.round;
      if (!(r in f.mine) || !(r in f.theirs)) return;
      const [fa, fb, ma, mb] = side === 'A' ? [me, foe, f.mine[r], f.theirs[r]] : [foe, me, f.theirs[r], f.mine[r]];
      const res = resolveRound(fa, fb, ma, mb, seed, r);
      const mineRes = side === 'A' ? res : { ...res, dmg: [res.dmg[1], res.dmg[0]], moves: [res.moves[1], res.moves[0]] };
      f.round++;
      sfx.stoke();
      f.view.anim(mineRes);
      f.view.say([`You ${MOVES[mineRes.moves[0]].icon} vs ${MOVES[mineRes.moves[1]].icon} ${foeName}`, ...res.log]);
      setTimeout(() => {
        if (fight !== f) return;
        if (me.hp <= 0 || foe.hp <= 0 || f.round >= MAX_ROUNDS) {
          const won = foe.hp / foe.maxHp < me.hp / me.maxHp;
          const draw = foe.hp / foe.maxHp === me.hp / me.maxHp;
          finish(won, draw, won ? `YOU BEAT ${foeName.toUpperCase()}!` : draw ? 'A draw. Rematch?' : `${foeName} wins this one.`);
          return;
        }
        f.left = PVP_TURN;
        f.view.lock(false);
        f.view.status(`Round ${f.round + 1}: pick a move (${f.left}s)`);
      }, 700);
    };
    const pick = (mv) => {
      if (fight !== f || f.round in f.mine) return;
      f.mine[f.round] = mv;
      f.view.lock(true);
      f.view.status(`You picked ${MOVES[mv].icon}. Waiting for ${foeName}…`);
      net.send({ t: 'duel', to: foeId, a: 'mv', r: f.round, mv });
      resolve();
    };
    f.view = battleView({ me, foe, foeName, foeColor: '#ff7bf2', title: `VS ${foeName.toUpperCase()}${bet ? ` · ${bet} 🪙 ON THE LINE` : ''}`, onMove: pick, pvp: true });
    f.left = PVP_TURN;
    f.tick = setInterval(() => {
      if (fight !== f) return;
      if (!(f.round in f.mine)) {
        f.left--;
        f.view.status(`Round ${f.round + 1}: pick a move (${Math.max(0, f.left)}s)`);
        if (f.left <= 0) pick(me.charge >= 2 ? 'special' : 'bonk'); // too slow: autopilot
      }
    }, 1000);
    f.theirMove = (r, mv) => {
      if (r !== f.round || r in f.theirs) return;
      f.theirs[r] = mv;
      resolve();
    };
    f.onEnd = (won, draw) => {
      if (won) trackDaily('petwin');
      if (draw || !bet) return;
      if (won) {
        wallet.add(bet);
        f.view.say([`+${bet} 🪙 from ${foeName}`], '#ffe14d');
        onFx?.(`beat ${foeName} in a pet battle ⚔️`);
      } else {
        wallet.spend(Math.min(bet, wallet.coins));
        f.view.say([`-${bet} 🪙 (the arena always collects)`], '#ff4f6d');
      }
    };
    fight = f;
    f.view.say([`${foeName} sent out ${foe.pet.name}!`], '#ff7bf2');
    f.view.status(`Round 1: pick a move (${PVP_TURN}s)`);
    return f.view.root;
  }

  // the fight is closed (panel closed / Escape): online that's a forfeit
  function leaveFight() {
    const f = fight;
    if (!f) return;
    fight = null;
    clearInterval(f.tick);
    f.view.detach();
    if (f.pvp) {
      net?.send({ t: 'duel', to: f.foeId, a: 'quit' });
      if (f.bet) wallet.spend(Math.min(f.bet, wallet.coins));
      hud.popup('YOU FORFEITED', '#ff4f6d');
    }
  }

  function openFight(title, root) {
    const f = fight;
    openPanel(title, root, () => {
      if (fight === f) leaveFight(); // (a newer fight may already be on screen)
      f?.view.detach(); // stop listening for 1/2/3
    });
  }

  // ---------- network ----------
  function onDuel(m) {
    const who = players?.remotes.get(m.from);
    const name = who?.name || 'Someone';
    if (m.a === 'ask') {
      if (fight || pending) return net.send({ t: 'duel', to: m.from, a: 'no', why: 'busy' });
      if (m.bet > wallet.coins) return net.send({ t: 'duel', to: m.from, a: 'no', why: 'broke' });
      hud.invite(`⚔️ ${name} challenges you to a pet battle${m.bet ? ` for ${m.bet} 🪙` : ''}`, {
        yes: 'FIGHT',
        no: 'NOPE',
        onYes: () => {
          if (fight) return;
          const seed = (Math.random() * 2 ** 31) | 0;
          net.send({ t: 'duel', to: m.from, a: 'yes', pet: pickPet, seed, bet: m.bet });
          openFight('PET BATTLE', startPvp({ foeId: m.from, foeName: name, foePet: m.pet, seed, side: 'B', bet: m.bet }));
        },
        onNo: () => net.send({ t: 'duel', to: m.from, a: 'no' }),
      });
      return;
    }
    if (m.a === 'yes' && pending && pending.to === m.from) {
      const p = pending;
      pending = null;
      clearTimeout(p.timer);
      openFight('PET BATTLE', startPvp({ foeId: m.from, foeName: name, foePet: m.pet, seed: m.seed, side: 'A', bet: p.bet }));
      return;
    }
    if (m.a === 'no' && pending && pending.to === m.from) {
      clearTimeout(pending.timer);
      pending.onAnswer?.(m.why === 'broke' ? `${name} can't cover that bet.` : m.why === 'busy' ? `${name} is busy.` : `${name} said nope.`);
      pending = null;
      return;
    }
    if (m.a === 'mv' && fight?.pvp && fight.foeId === m.from) {
      fight.theirMove(m.r, m.mv);
      return;
    }
    if (m.a === 'quit' && fight?.pvp && fight.foeId === m.from) {
      finish(true, false, `${name} ran away. You win by forfeit!`);
    }
  }
  // the opponent left Ohio mid-fight
  function onLeave(id) {
    if (fight?.pvp && fight.foeId === id) finish(false, true, 'Your opponent left Ohio. No contest.');
    if (pending?.to === id) {
      clearTimeout(pending.timer);
      pending = null;
    }
  }

  // ---------- the arena desk ----------
  function arenaPanel() {
    const root = el('div', 'casino arena');
    const coins = el('div', 'casino-coins', `🪙 ${wallet.coins} Glorp Coins`);
    root.appendChild(coins);
    // pet picker
    root.appendChild(el('h3', null, 'Your fighter'));
    const petRow = el('div', 'pb-pets');
    const pets = myPets();
    if (!pets.includes(pickPet)) pickPet = pets[0];
    for (const id of pets) {
      const pet = petById(id);
      const b = el('button', 'pb-pet' + (id === pickPet ? ' on' : ''));
      b.type = 'button';
      b.title = pet.name;
      b.appendChild(petIcon(pet, 44));
      b.addEventListener('click', () => {
        pickPet = id;
        petRow.querySelectorAll('.pb-pet').forEach((x) => x.classList.toggle('on', x === b));
        statLine.textContent = describe();
        sfx.click();
      });
      petRow.appendChild(b);
    }
    root.appendChild(petRow);
    const describe = () => {
      const s = petStats(pickPet);
      return `${s.pet.name} · ❤️ ${s.hp} · 👊 ${s.atk.toFixed(1)} · 💥 ${s.special}${wallet.pets.length ? '' : ' (a loaner, win your own pet at the casino)'}`;
    };
    const statLine = el('p', 'fine', describe());
    root.appendChild(statLine);

    // ladder
    root.appendChild(el('h3', null, 'Arena ladder'));
    const ladder = el('div', 'pb-ladder');
    TRAINERS.forEach((tr, i) => {
      const locked = i > progress.beat;
      const b = el('button', 'btn small pb-trainer' + (i < progress.beat ? ' beaten' : ''));
      b.type = 'button';
      b.disabled = locked;
      const ico = petIcon(locked ? null : petById(tr.pet), 34);
      if (locked) ico.className = 'pet-icon none';
      b.appendChild(ico);
      b.appendChild(el('span', null, locked ? `🔒 ${tr.name}` : `${i < progress.beat ? '✅ ' : ''}${tr.name} · ${i < progress.beat ? Math.round(tr.prize / 2) : tr.prize} 🪙`));
      b.addEventListener('click', () => {
        sfx.click();
        openFight('PET BATTLE', startTrainer(i));
      });
      ladder.appendChild(b);
    });
    root.appendChild(ladder);

    // online challenges
    if (net?.connected) {
      root.appendChild(el('h3', null, 'Challenge a player'));
      const others = [...(players?.remotes.values() || [])];
      if (!others.length) root.appendChild(el('p', 'fine', 'Nobody else is in Ohio right now. Bring a friend!'));
      else {
        let bet = 0;
        const betRow = el('div', 'bets');
        for (const b of BETS) {
          const x = el('button', 'btn small' + (b === bet ? ' primary' : ''), b ? `${b} 🪙` : 'for fun');
          x.type = 'button';
          x.disabled = b > wallet.coins;
          x.addEventListener('click', () => {
            bet = b;
            betRow.querySelectorAll('button').forEach((y) => y.classList.toggle('primary', y === x));
          });
          betRow.appendChild(x);
        }
        root.appendChild(betRow);
        const list = el('div', 'pb-ladder');
        const answer = el('p', 'slot-result');
        for (const r of others) {
          const b = el('button', 'btn small primary', `⚔️ ${r.name}`);
          b.type = 'button';
          b.addEventListener('click', () => {
            if (pending) return;
            sfx.click();
            net.send({ t: 'duel', to: r.id, a: 'ask', pet: pickPet, bet });
            answer.textContent = `Waiting for ${r.name}…`;
            answer.style.color = '#ffe14d';
            pending = {
              to: r.id,
              bet,
              onAnswer: (t) => {
                answer.textContent = t;
                answer.style.color = '#ff4f6d';
              },
              timer: setTimeout(() => {
                if (pending?.to !== r.id) return;
                pending = null;
                answer.textContent = `${r.name} didn't answer.`;
                answer.style.color = '#ff4f6d';
              }, 16000),
            };
          });
          list.appendChild(b);
        }
        root.appendChild(list);
        root.appendChild(answer);
      }
    }
    root.appendChild(el('p', 'fine', '👊 Bonk beats 💥 Special · 🛡️ Guard beats 👊 Bonk · 💥 Special beats 🛡️ Guard. Guarding and getting hit charge ⚡. Rarer pets hit harder.'));
    return root;
  }

  return {
    arenaPanel,
    onDuel,
    onLeave,
    leaveFight,
    get fighting() {
      return !!fight;
    },
    get progress() {
      return progress;
    },
    _startTrainer: startTrainer,
    get _fight() {
      return fight;
    },
  };
}
