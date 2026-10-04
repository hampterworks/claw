// Glorp Casino UI: slot machine, Cat Crates (loot boxes) and the skin wardrobe.
// Play money only (Glorp Coins). Matt owns the casino; the house always wins.
import { memeIcon } from '../../cats.js';
import { SKINS, RARITY, skinById, rollSkin } from './skins.js';

export const CRATE_PRICE = 300;
const DUPE_REFUND = 100;

// Slot symbols: weights tuned for a ~12% house edge (pairs pay 1.5x, triples 10x, Mattpog x3 = 50x).
const SYMBOLS = [
  { id: 'popcat', w: 20 },
  { id: 'maxwell', w: 18 },
  { id: 'oiia', w: 18 },
  { id: 'nyan', w: 16 },
  { id: 'banana', w: 14 },
  { id: 'happy', w: 10 },
  { id: 'matt', w: 4 },
];
const symTotal = SYMBOLS.reduce((a, s) => a + s.w, 0);
function rollSymbol() {
  let x = Math.random() * symTotal;
  for (const s of SYMBOLS) if ((x -= s.w) < 0) return s.id;
  return SYMBOLS[0].id;
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export function skinSwatch(skin, owned = true) {
  const s = el('div', 'skin-swatch' + (skin.anim ? ` anim-${skin.anim}` : ''));
  if (!owned) {
    s.classList.add('locked');
    s.textContent = '?';
    return s;
  }
  s.style.background = `radial-gradient(circle at 50% 70%, ${skin.belly} 0 28%, transparent 29%), radial-gradient(circle at 25% 18%, ${skin.ears} 0 14%, transparent 15%), radial-gradient(circle at 75% 18%, ${skin.ears} 0 14%, transparent 15%), ${skin.body}`;
  if (skin.metal) s.classList.add('metal');
  if (skin.opacity != null) s.style.opacity = '0.6';
  if (skin.mattFace) {
    const img = el('img');
    img.src = 'assets/sim-matt.png';
    img.alt = '';
    s.appendChild(img);
  }
  return s;
}

function skinCard(skin, owned = true) {
  const c = el('div', 'skin-card');
  c.style.setProperty('--rarity', RARITY[skin.rarity].color);
  c.appendChild(skinSwatch(skin, owned));
  c.appendChild(el('span', 'skin-name', owned ? skin.name : '???'));
  c.appendChild(el('span', 'skin-rarity', RARITY[skin.rarity].name));
  return c;
}

export function createCasino({ wallet, sfx, hud, onEquip }) {
  const symbolSrc = {};
  for (const s of SYMBOLS) symbolSrc[s.id] = s.id === 'matt' ? 'assets/sim-matt.png' : memeIcon(s.id, 72).toDataURL();

  function coinsLine() {
    const c = el('div', 'casino-coins');
    const b = el('b', null, String(wallet.coins));
    c.append('🪙 ', b, ' Glorp Coins');
    return { node: c, update: () => (b.textContent = String(wallet.coins)) };
  }

  // ---------- slots ----------
  function slots() {
    const root = el('div', 'casino slots');
    const coins = coinsLine();
    root.appendChild(coins.node);
    const reels = el('div', 'reels');
    const strips = [];
    for (let i = 0; i < 3; i++) {
      const r = el('div', 'reel');
      const strip = el('div', 'strip');
      const img = el('img');
      img.src = symbolSrc.matt;
      img.alt = '';
      strip.appendChild(img);
      r.appendChild(strip);
      reels.appendChild(r);
      strips.push(strip);
    }
    root.appendChild(reels);
    const result = el('div', 'slot-result', 'PULL THE PAW');
    root.appendChild(result);
    const bets = el('div', 'bets');
    let bet = 50;
    const spin = el('button', 'btn primary spin', `SPIN (${bet} 🪙)`);
    spin.type = 'button';
    for (const b of [10, 50, 100, 250]) {
      const btn = el('button', 'btn small' + (b === bet ? ' primary' : ''), `${b}`);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        bet = b;
        bets.querySelectorAll('button').forEach((x) => x.classList.toggle('primary', x === btn));
        spin.textContent = `SPIN (${bet} 🪙)`;
        sfx.click();
      });
      bets.appendChild(btn);
    }
    root.appendChild(bets);
    root.appendChild(spin);
    root.appendChild(el('p', 'fine', 'Pair = 1.5x · Three of a kind = 10x · Three Mattpogs = 50x JACKPOT. Matt owns this casino. The house always wins.'));

    let spinning = false;
    const H = 84;
    spin.addEventListener('click', () => {
      if (spinning) return;
      if (!wallet.spend(bet)) {
        result.textContent = 'BROKE. GO KNOCK STUFF OVER FOR COINS';
        sfx.fail();
        return;
      }
      coins.update();
      spinning = true;
      spin.disabled = true;
      result.textContent = '...';
      const outcome = [rollSymbol(), rollSymbol(), rollSymbol()];
      const N = 22;
      strips.forEach((strip, i) => {
        strip.innerHTML = '';
        for (let k = 0; k < N; k++) {
          const img = el('img');
          img.src = symbolSrc[k === N - 1 ? outcome[i] : rollSymbol()];
          img.alt = '';
          strip.appendChild(img);
        }
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        void strip.offsetHeight;
        strip.style.transition = `transform ${1.1 + i * 0.45}s cubic-bezier(0.15, 0.85, 0.25, 1)`;
        strip.style.transform = `translateY(${-(N - 1) * H}px)`;
      });
      let ticks = 0;
      const tick = setInterval(() => {
        sfx.click();
        if (++ticks > 18) clearInterval(tick);
      }, 110);
      setTimeout(() => {
        clearInterval(tick);
        spinning = false;
        spin.disabled = false;
        const [a, b, c] = outcome;
        let mult = 0;
        let label = 'NOTHING. THE HOUSE THANKS YOU';
        if (a === b && b === c) {
          mult = a === 'matt' ? 50 : 10;
          label = a === 'matt' ? 'MATTPOG JACKPOT!!!' : 'THREE OF A KIND!';
        } else if (a === b || b === c || a === c) {
          mult = 1.5;
          label = 'PAIR. SMALL W';
        }
        const win = Math.floor(bet * mult);
        if (win > 0) {
          wallet.add(win);
          result.textContent = `${label} +${win} 🪙`;
          if (mult >= 10) {
            sfx.win();
            sfx.meow(900);
            hud.banner(label, `+${win} Glorp Coins`, { pog: true });
          } else sfx.ding();
        } else {
          result.textContent = label;
          sfx.fail();
        }
        coins.update();
      }, 1100 + 2 * 450 + 250);
    });
    return root;
  }

  // ---------- Cat Crates ----------
  function crate() {
    const root = el('div', 'casino crate');
    const coins = coinsLine();
    root.appendChild(coins.node);
    const odds = el('div', 'odds');
    const total = Object.values(RARITY).reduce((a, r) => a + r.weight, 0);
    for (const r of Object.values(RARITY)) {
      const o = el('span', null, `${r.name} ${Math.round((r.weight / total) * 100)}%`);
      o.style.color = r.color;
      odds.appendChild(o);
    }
    root.appendChild(odds);
    const win = el('div', 'case-window');
    const strip = el('div', 'case-strip');
    win.append(strip, el('div', 'case-marker'));
    root.appendChild(win);
    const result = el('div', 'case-result', `${CRATE_PRICE} 🪙 per Cat Crate. Duplicates refund ${DUPE_REFUND} 🪙.`);
    root.appendChild(result);
    const row = el('div', 'bets');
    const open = el('button', 'btn primary spin', `OPEN CRATE (${CRATE_PRICE} 🪙)`);
    open.type = 'button';
    row.appendChild(open);
    root.appendChild(row);
    root.appendChild(el('p', 'fine', 'Loot boxes, but the only thing you can lose is fake money and your dignity.'));

    // idle strip
    for (let k = 0; k < 8; k++) strip.appendChild(skinCard(SKINS[k % SKINS.length], false));
    const CARD = 118;
    let busy = false;
    open.addEventListener('click', () => {
      if (busy) return;
      if (!wallet.spend(CRATE_PRICE)) {
        result.textContent = 'NOT ENOUGH COINS. THE CAT CRATE IS DISAPPOINTED.';
        sfx.fail();
        return;
      }
      coins.update();
      busy = true;
      open.disabled = true;
      const prize = rollSkin();
      const N = 40;
      const winAt = 34;
      strip.innerHTML = '';
      for (let k = 0; k < N; k++) strip.appendChild(skinCard(k === winAt ? prize : rollSkin()));
      strip.style.transition = 'none';
      strip.style.transform = 'translateX(0)';
      void strip.offsetHeight;
      const jitter = (Math.random() - 0.5) * (CARD * 0.6);
      const target = winAt * CARD + CARD / 2 - win.clientWidth / 2 + jitter;
      strip.style.transition = 'transform 4.2s cubic-bezier(0.08, 0.82, 0.17, 1)';
      strip.style.transform = `translateX(${-target}px)`;
      // ticks that slow down with the strip
      let delay = 45;
      let elapsed = 0;
      const tick = () => {
        if (elapsed > 3900) return;
        sfx.click();
        elapsed += delay;
        delay *= 1.12;
        setTimeout(tick, delay);
      };
      tick();
      setTimeout(() => {
        busy = false;
        open.disabled = false;
        const isNew = wallet.own(prize.id);
        result.innerHTML = '';
        const t = el('b', 'case-title', `${RARITY[prize.rarity].name.toUpperCase()}: ${prize.name}`);
        t.style.color = RARITY[prize.rarity].color;
        result.appendChild(t);
        if (isNew) {
          result.appendChild(el('span', null, ' NEW! '));
          const eq = el('button', 'btn small primary', 'Equip');
          eq.type = 'button';
          eq.addEventListener('click', () => {
            onEquip(prize.id);
            eq.textContent = 'Equipped ✔';
            eq.disabled = true;
          });
          result.appendChild(eq);
        } else {
          wallet.add(DUPE_REFUND);
          result.appendChild(el('span', null, ` duplicate, +${DUPE_REFUND} 🪙 back`));
        }
        coins.update();
        if (prize.rarity === 'legendary') {
          sfx.win();
          sfx.meow(1000);
          hud.banner('LEGENDARY PULL', prize.name, { pog: true });
        } else if (prize.rarity === 'epic') sfx.win();
        else sfx.ding();
      }, 4300);
    });
    return root;
  }

  // ---------- wardrobe ----------
  function wardrobe() {
    const root = el('div', 'casino wardrobe');
    const owned = wallet.owned;
    root.appendChild(el('p', 'fine', `${owned.length}/${SKINS.length} skins owned · win more from Cat Crates at the Glorp Casino downtown.`));
    const grid = el('div', 'skin-grid');
    for (const skin of SKINS) {
      const has = owned.includes(skin.id);
      const card = skinCard(skin, has);
      if (skin.id === wallet.equipped) card.classList.add('equipped');
      if (has) {
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        const pick = () => {
          onEquip(skin.id);
          grid.querySelectorAll('.skin-card').forEach((c) => c.classList.remove('equipped'));
          card.classList.add('equipped');
          sfx.click();
        };
        card.addEventListener('click', pick);
        card.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && pick());
      }
      grid.appendChild(card);
    }
    root.appendChild(grid);
    return root;
  }

  return { slots, crate, wardrobe, skinById };
}
