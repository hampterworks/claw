// Glorp Casino UI: slots, Cat Crates + Pet Crates (loot boxes), Wheel of Glorp,
// Plinko Paws, the Pet Derby and the skin/pet wardrobe.
// Play money only (Glorp Coins). Matt owns the casino; the house always wins.
import { memeIcon } from '../../cats.js';
import { SKINS, RARITY, skinById, rollSkin, rollRarity } from './skins.js';
import { PETS, PET_BONUS, petById, petIcon } from './pets.js';

export const CRATE_PRICE = 300;
const DUPE_REFUND = 100;
export const PET_CRATE_PRICE = 400;
const PET_DUPE_REFUND = 150;
const WHEEL_PRICE = 175;

export function rollPet() {
  const r = rollRarity();
  const pool = PETS.filter((p) => p.rarity === r);
  return pool[Math.floor(Math.random() * pool.length)];
}

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
  if (skin.outfit === 'bikini') s.appendChild(el('span', 'skin-badge', '👙'));
  if (skin.mattFace) {
    const img = el('img');
    img.src = 'assets/sim-matt.webp';
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

export function petCard(pet, owned = true) {
  const c = el('div', 'skin-card pet-card');
  if (!pet) {
    c.style.setProperty('--rarity', '#666');
    c.appendChild(el('div', 'pet-icon none', '🚫'));
    c.appendChild(el('span', 'skin-name', 'No pet'));
    c.appendChild(el('span', 'skin-rarity', 'lonely'));
    return c;
  }
  c.style.setProperty('--rarity', RARITY[pet.rarity].color);
  const icon = petIcon(owned ? pet : null);
  if (!owned) icon.classList.add('locked');
  c.appendChild(icon);
  c.appendChild(el('span', 'skin-name', owned ? pet.name : '???'));
  c.appendChild(el('span', 'skin-rarity', `${RARITY[pet.rarity].name} · +${Math.round(PET_BONUS[pet.rarity] * 100)}% 🪙`));
  return c;
}

export function createCasino({ wallet, sfx, hud, ch, onEquip, onPet, onBigWin = () => {} }) {
  // a new pet: own it, celebrate, offer to equip. Dupes refund coins.
  function grantPet(pet, refund = PET_DUPE_REFUND) {
    const isNew = wallet.ownPet(pet.id);
    if (isNew) {
      ch?.complete('pet');
      if (!wallet.pet) onPet(pet.id);
    } else wallet.add(refund);
    return isNew;
  }
  function grantSkin(skin) {
    const isNew = wallet.own(skin.id);
    if (!isNew) wallet.add(DUPE_REFUND);
    return isNew;
  }

  const symbolSrc = {};
  for (const s of SYMBOLS) symbolSrc[s.id] = s.id === 'matt' ? 'assets/sim-matt.webp' : memeIcon(s.id, 72).toDataURL();

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

  // ---------- loot crates (Cat Crates for skins, Pet Crates for pets) ----------
  function lootCrate({ cls, price, refund, roll, card, items, give, equip, blurb, fine }) {
    const root = el('div', `casino crate ${cls}`);
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
    const result = el('div', 'case-result', blurb);
    root.appendChild(result);
    const row = el('div', 'bets');
    const open = el('button', 'btn primary spin', `OPEN (${price} 🪙)`);
    open.type = 'button';
    row.appendChild(open);
    root.appendChild(row);
    root.appendChild(el('p', 'fine', fine));

    // idle strip
    for (let k = 0; k < 8; k++) strip.appendChild(card(items[k % items.length], false));
    const CARD = 118;
    let busy = false;
    open.addEventListener('click', () => {
      if (busy) return;
      if (!wallet.spend(price)) {
        result.textContent = 'NOT ENOUGH COINS. THE CRATE IS DISAPPOINTED.';
        sfx.fail();
        return;
      }
      coins.update();
      busy = true;
      open.disabled = true;
      const prize = roll();
      const N = 40;
      const winAt = 34;
      strip.innerHTML = '';
      for (let k = 0; k < N; k++) strip.appendChild(card(k === winAt ? prize : roll()));
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
        const isNew = give(prize);
        result.innerHTML = '';
        const t = el('b', 'case-title', `${RARITY[prize.rarity].name.toUpperCase()}: ${prize.name}`);
        t.style.color = RARITY[prize.rarity].color;
        result.appendChild(t);
        if (isNew) {
          result.appendChild(el('span', null, ' NEW! '));
          const eq = el('button', 'btn small primary', 'Equip');
          eq.type = 'button';
          eq.addEventListener('click', () => {
            equip(prize.id);
            eq.textContent = 'Equipped ✔';
            eq.disabled = true;
          });
          result.appendChild(eq);
        } else {
          result.appendChild(el('span', null, ` duplicate, +${refund} 🪙 back`));
        }
        coins.update();
        if (prize.rarity === 'legendary') {
          sfx.win();
          sfx.meow(1000);
          hud.banner('LEGENDARY PULL', prize.name, { pog: true });
          onBigWin();
        } else if (prize.rarity === 'epic') sfx.win();
        else sfx.ding();
      }, 4300);
    });
    return root;
  }

  const crate = () =>
    lootCrate({
      cls: 'cat-crate',
      price: CRATE_PRICE,
      refund: DUPE_REFUND,
      roll: rollSkin,
      card: skinCard,
      items: SKINS.filter((x) => !x.free),
      give: grantSkin,
      equip: onEquip,
      blurb: `${CRATE_PRICE} 🪙 per Cat Crate. Duplicates refund ${DUPE_REFUND} 🪙.`,
      fine: 'Loot boxes, but the only thing you can lose is fake money and your dignity.',
    });

  const petCrate = () =>
    lootCrate({
      cls: 'pet-crate',
      price: PET_CRATE_PRICE,
      refund: PET_DUPE_REFUND,
      roll: rollPet,
      card: petCard,
      items: PETS,
      give: (pet) => grantPet(pet),
      equip: onPet,
      blurb: `${PET_CRATE_PRICE} 🪙 per Pet Crate. Duplicates refund ${PET_DUPE_REFUND} 🪙.`,
      fine: 'Pets follow Claw everywhere and boost the coins you earn. Matt says pets are "an investment".',
    });

  // ---------- Wheel of Glorp ----------
  const WHEEL = [
    { label: 'BOILED', color: '#c0182f', coins: 0 },
    { label: '50', color: '#2a6fdb', coins: 50 },
    { label: 'PET!', color: '#ff7bf2', prize: 'pet' },
    { label: '100', color: '#2f9e44', coins: 100 },
    { label: 'MATT TAX', color: '#6b4226', coins: 0 },
    { label: '150', color: '#8a3cff', coins: 150 },
    { label: 'SKIN!', color: '#4fd8ff', prize: 'skin' },
    { label: '75', color: '#ff9a3c', coins: 75 },
    { label: 'BOILED', color: '#c0182f', coins: 0 },
    { label: '250', color: '#2f9e44', coins: 250 },
    { label: '25', color: '#2a6fdb', coins: 25 },
    { label: '600', color: '#ffb000', coins: 600, jackpot: true },
  ];
  function wheel() {
    const root = el('div', 'casino wheel');
    const coins = coinsLine();
    root.appendChild(coins.node);
    const S = 300;
    const cv = el('canvas', 'wheel-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.height = S * dpr;
    cv.style.width = cv.style.height = S + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    root.appendChild(cv);
    const result = el('div', 'slot-result', 'SPIN THE WHEEL OF GLORP');
    root.appendChild(result);
    const spin = el('button', 'btn primary spin', `SPIN (${WHEEL_PRICE} 🪙)`);
    spin.type = 'button';
    root.appendChild(spin);
    root.appendChild(el('p', 'fine', 'Win coins, a random PET or a random SKIN. Land on BOILED and Claw gets boiled. Dupes refund coins.'));
    const n = WHEEL.length;
    const seg = (Math.PI * 2) / n;
    let angle = 0;
    function draw() {
      ctx.clearRect(0, 0, S, S);
      const c = S / 2;
      const r = S / 2 - 12;
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(angle);
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, i * seg, (i + 1) * seg);
        ctx.closePath();
        ctx.fillStyle = WHEEL[i].color;
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        ctx.rotate((i + 0.5) * seg);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = "20px 'Bangers', Impact, sans-serif";
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 4;
        ctx.strokeText(WHEEL[i].label, r - 10, 0);
        ctx.fillText(WHEEL[i].label, r - 10, 0);
        ctx.restore();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c, c, 24, 0, Math.PI * 2);
      ctx.fillStyle = '#12041f';
      ctx.fill();
      ctx.stroke();
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐱', c, c + 1);
      // pointer at the top
      ctx.beginPath();
      ctx.moveTo(c - 14, 2);
      ctx.lineTo(c + 14, 2);
      ctx.lineTo(c, 30);
      ctx.closePath();
      ctx.fillStyle = '#7CFF4F';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#111';
      ctx.stroke();
    }
    draw();
    let busy = false;
    spin.addEventListener('click', () => {
      if (busy) return;
      if (!wallet.spend(WHEEL_PRICE)) {
        result.textContent = 'BROKE. MATT WILL NOT SPOT YOU.';
        sfx.fail();
        return;
      }
      coins.update();
      busy = true;
      spin.disabled = true;
      result.style.color = '';
      result.textContent = '...';
      const idx = Math.floor(Math.random() * n);
      // pointer is at -90deg; land the middle of segment idx (with a little wobble) under it
      const landing = -Math.PI / 2 - (idx + 0.5 + (Math.random() - 0.5) * 0.7) * seg;
      const start = angle;
      let end = landing;
      while (end < start + Math.PI * 8) end += Math.PI * 2;
      const dur = 4200;
      const t0 = performance.now();
      let lastSeg = Math.floor(start / seg);
      const step = (now) => {
        if (!root.isConnected) {
          // closed mid-spin: still pay out
          angle = end;
          settle(idx);
          return;
        }
        const k = Math.min(1, (now - t0) / dur);
        angle = start + (end - start) * (1 - Math.pow(1 - k, 4));
        const sg = Math.floor(angle / seg);
        if (sg !== lastSeg) {
          lastSeg = sg;
          sfx.click();
        }
        draw();
        if (k < 1) requestAnimationFrame(step);
        else settle(idx);
      };
      requestAnimationFrame(step);
    });
    function settle(idx) {
      busy = false;
      spin.disabled = false;
      const w = WHEEL[idx];
      if (w.prize === 'pet') {
        const pet = rollPet();
        const isNew = grantPet(pet);
        result.textContent = isNew ? `NEW PET: ${pet.name}!` : `${pet.name} again. +${PET_DUPE_REFUND} 🪙`;
        result.style.color = RARITY[pet.rarity].color;
        sfx.win();
        sfx.meow(900);
        if (isNew) {
          hud.banner('NEW PET', pet.name, { pog: pet.rarity === 'legendary' });
          onBigWin();
        }
      } else if (w.prize === 'skin') {
        const skin = rollSkin();
        const isNew = grantSkin(skin);
        result.textContent = isNew ? `NEW SKIN: ${skin.name}!` : `${skin.name} again. +${DUPE_REFUND} 🪙`;
        result.style.color = RARITY[skin.rarity].color;
        sfx.win();
      } else if (w.coins > 0) {
        wallet.add(w.coins);
        result.textContent = w.jackpot ? `JACKPOT!!! +${w.coins} 🪙` : `+${w.coins} 🪙`;
        result.style.color = '#ffe14d';
        if (w.jackpot) {
          sfx.win();
          sfx.meow(1000);
          hud.banner('WHEEL JACKPOT', `+${w.coins} Glorp Coins`, { pog: true });
          onBigWin();
        } else sfx.ding();
      } else {
        result.textContent = w.label === 'BOILED' ? 'BOILED. CLAW HAS BEEN BOILED.' : 'MATT TAX. MATT THANKS YOU.';
        result.style.color = '#ff4f6d';
        sfx.fail();
      }
      coins.update();
    }
    return root;
  }

  // ---------- Plinko Paws ----------
  const PLINKO_MULT = [9, 3, 1.5, 0.6, 0.3, 0.6, 1.5, 3, 9];
  function plinko() {
    const root = el('div', 'casino plinko');
    const coins = coinsLine();
    root.appendChild(coins.node);
    const W = 320;
    const H = 340;
    const ROWS = 8;
    const cv = el('canvas', 'plinko-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    root.appendChild(cv);
    const result = el('div', 'slot-result', 'DROP A YARN BALL');
    root.appendChild(result);
    const bets = el('div', 'bets');
    let bet = 50;
    const drop = el('button', 'btn primary spin', `DROP (${bet} 🪙)`);
    drop.type = 'button';
    for (const b of [10, 50, 100, 250]) {
      const btn = el('button', 'btn small' + (b === bet ? ' primary' : ''), `${b}`);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        bet = b;
        bets.querySelectorAll('button').forEach((x) => x.classList.toggle('primary', x === btn));
        drop.textContent = `DROP (${bet} 🪙)`;
        sfx.click();
      });
      bets.appendChild(btn);
    }
    root.appendChild(bets);
    root.appendChild(drop);
    root.appendChild(el('p', 'fine', 'The yarn bounces off the pegs into a multiplier. Edges pay 9x. The middle pays 0.3x. Drop as many as you want.'));

    const gapX = 30;
    const gapY = 30;
    const top = 40;
    const cx = W / 2;
    const pegX = (row, i) => cx + (i - row / 2) * gapX;
    const pegY = (row) => top + row * gapY;
    const binY = pegY(ROWS) + 4;
    const binX = (i) => cx + (i - ROWS / 2) * gapX;
    const balls = [];
    const flash = new Array(PLINKO_MULT.length).fill(0);
    let raf = 0;
    let last = performance.now();
    const multColor = (m) => (m >= 9 ? '#ffb000' : m >= 3 ? '#ff7bf2' : m >= 1.5 ? '#7CFF4F' : m >= 0.6 ? '#4fa3ff' : '#ff4f6d');

    function landed(b) {
      const m = PLINKO_MULT[b.bin];
      const win = Math.floor(b.bet * m);
      flash[b.bin] = 1;
      if (win > 0) wallet.add(win);
      coins.update();
      result.textContent = `${m}x  ${win >= b.bet ? '+' : ''}${win} 🪙`;
      result.style.color = multColor(m);
      if (m >= 9) {
        sfx.win();
        sfx.meow(950);
        ch?.complete('plinko');
        hud.banner('PLINKO 9x', `+${win} Glorp Coins`, { pog: true });
        onBigWin();
      } else if (m >= 1.5) sfx.ding();
      else sfx.pop();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#12041f';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8e0ff';
      for (let r = 1; r < ROWS; r++)
        for (let i = 0; i <= r; i++) {
          ctx.beginPath();
          ctx.arc(pegX(r, i), pegY(r), 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      PLINKO_MULT.forEach((m, i) => {
        const x = binX(i);
        ctx.fillStyle = multColor(m);
        ctx.globalAlpha = 0.55 + flash[i] * 0.45;
        ctx.fillRect(x - gapX / 2 + 2, binY, gapX - 4, 30 + flash[i] * 6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#111';
        ctx.font = "13px 'Bangers', Impact, sans-serif";
        ctx.fillText(`${m}x`, x, binY + 15);
      });
      ctx.font = '18px serif';
      for (const b of balls) ctx.fillText('🧶', b.x, b.y);
    }
    function frame(now) {
      if (!root.isConnected) {
        // closed with balls in the air: pay them out anyway
        for (const b of balls.splice(0)) landed(b);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (let i = 0; i < flash.length; i++) flash[i] = Math.max(0, flash[i] - dt * 2);
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        b.t += dt / 0.16;
        const k = Math.floor(b.t);
        if (k >= ROWS) {
          balls.splice(i, 1);
          landed(b);
          continue;
        }
        if (k !== b.k) {
          b.k = k;
          if (k > 0) sfx.bubble();
        }
        // hop from the peg above to the next row
        const f = b.t - k;
        const x0 = b.xs[k];
        const x1 = b.xs[k + 1];
        b.x = x0 + (x1 - x0) * f;
        b.y = pegY(k) - 8 + gapY * f - Math.sin(f * Math.PI) * 10;
      }
      draw();
      raf = balls.length || flash.some((x) => x > 0) ? requestAnimationFrame(frame) : 0;
      if (!raf) draw();
    }
    draw();
    drop.addEventListener('click', () => {
      if (!wallet.spend(bet)) {
        result.textContent = 'BROKE. NO YARN FOR YOU.';
        result.style.color = '#ff4f6d';
        sfx.fail();
        return;
      }
      coins.update();
      sfx.flap();
      // random walk: each row the yarn goes left or right
      let pos = 0;
      const xs = [cx];
      for (let r = 1; r <= ROWS; r++) {
        if (Math.random() < 0.5) pos++;
        xs.push(r < ROWS ? cx + (pos - r / 2) * gapX : binX(pos));
      }
      balls.push({ xs, bin: pos, bet, t: 0, k: -1, x: cx, y: top - 8 });
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    return root;
  }

  // ---------- Pet Derby ----------
  const DERBY_ODDS = [2, 3, 5, 8];
  const COMMENTARY = [
    (n) => `${n} takes the lead!`,
    (n) => `${n} is ZOOMING`,
    (n) => `${n} has the zoomies`,
    (n) => `${n} out front, unbelievable`,
    (n) => `${n} is cooking`,
  ];
  function derby() {
    const root = el('div', 'casino derby');
    const coins = coinsLine();
    root.appendChild(coins.node);
    const track = el('div', 'derby-track');
    root.appendChild(track);
    const result = el('div', 'slot-result', 'PICK A RUNNER');
    root.appendChild(result);
    const bets = el('div', 'bets');
    let bet = 50;
    const go = el('button', 'btn primary spin', 'START RACE');
    go.type = 'button';
    for (const b of [10, 50, 100, 250]) {
      const btn = el('button', 'btn small' + (b === bet ? ' primary' : ''), `${b}`);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        bet = b;
        bets.querySelectorAll('button').forEach((x) => x.classList.toggle('primary', x === btn));
        sfx.click();
      });
      bets.appendChild(btn);
    }
    root.appendChild(bets);
    root.appendChild(go);
    root.appendChild(el('p', 'fine', 'Bet on a pet. Win pays the odds. Win on the 8x longshot and you also adopt that pet.'));

    let runners = [];
    let pick = -1;
    let racing = false;
    function newCard() {
      track.innerHTML = '';
      const pool = PETS.slice().sort(() => Math.random() - 0.5).slice(0, 4);
      const odds = DERBY_ODDS.slice().sort(() => Math.random() - 0.5);
      runners = pool.map((pet, i) => {
        const lane = el('button', 'derby-lane');
        lane.type = 'button';
        const runner = el('div', 'derby-runner');
        runner.appendChild(petIcon(pet, 40));
        const name = el('span', 'derby-name', pet.name);
        const od = el('b', 'derby-odds', `${odds[i]}x`);
        lane.append(name, od, runner, el('div', 'derby-finish'));
        lane.addEventListener('click', () => {
          if (racing) return;
          pick = i;
          track.querySelectorAll('.derby-lane').forEach((l, j) => l.classList.toggle('picked', j === i));
          result.textContent = `Betting on ${pet.name} (${odds[i]}x)`;
          result.style.color = '';
          sfx.click();
        });
        track.appendChild(lane);
        return { pet, odds: odds[i], lane, runner };
      });
      pick = -1;
    }
    newCard();
    go.addEventListener('click', () => {
      if (racing) return;
      if (pick < 0) {
        result.textContent = 'TAP A PET TO BET ON IT FIRST';
        sfx.fail();
        return;
      }
      if (!wallet.spend(bet)) {
        result.textContent = 'BROKE. THE PETS ARE DISAPPOINTED.';
        sfx.fail();
        return;
      }
      coins.update();
      racing = true;
      go.disabled = true;
      const myBet = bet;
      const myPick = pick;
      // winner chance proportional to 1/odds (that's where the house edge lives)
      const w = runners.map((r) => 1 / r.odds);
      let x = Math.random() * w.reduce((a, b) => a + b, 0);
      let winner = 0;
      for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) { winner = i; break; }
      const T = runners.map((_, i) => (i === winner ? 4.6 : 4.9 + Math.random() * 1.4));
      const ph = runners.map(() => Math.random() * 6);
      const t0 = performance.now();
      let lastCall = 0;
      sfx.boing?.();
      const step = (now) => {
        const t = (now - t0) / 1000;
        const done = !root.isConnected || t >= T[winner];
        let lead = 0;
        let leadP = -1;
        runners.forEach((r, i) => {
          const k = Math.min(1, t / T[i]);
          // wobbly but always ends at the finish exactly at T[i]
          const p = Math.min(1, k + Math.sin(t * 3 + ph[i]) * 0.05 * k * (1 - k) * 4);
          r.runner.style.left = `calc(${(p * 100).toFixed(2)}% * 0.82)`;
          r.runner.classList.toggle('hop', Math.floor(t * 8 + ph[i]) % 2 === 0);
          if (p > leadP) {
            leadP = p;
            lead = i;
          }
        });
        if (t - lastCall > 1.1 && !done) {
          lastCall = t;
          result.textContent = COMMENTARY[Math.floor(Math.random() * COMMENTARY.length)](runners[lead].pet.name);
          sfx.click();
        }
        if (!done) {
          requestAnimationFrame(step);
          return;
        }
        // results
        racing = false;
        go.disabled = false;
        const wr = runners[winner];
        wr.lane.classList.add('won');
        if (winner === myPick) {
          const win = myBet * wr.odds;
          wallet.add(win);
          ch?.complete('derby');
          result.textContent = `${wr.pet.name} WINS! +${win} 🪙`;
          result.style.color = '#7CFF4F';
          sfx.win();
          if (wr.odds >= 8) {
            const isNew = grantPet(wr.pet, 0);
            hud.banner('LONGSHOT!', isNew ? `${wr.pet.name} joins your squad` : `+${win} Glorp Coins`, { pog: true });
            if (isNew) result.textContent += ' + NEW PET!';
            onBigWin();
          }
        } else {
          result.textContent = `${wr.pet.name} wins. Your pet tripped.`;
          result.style.color = '#ff4f6d';
          sfx.fail();
        }
        coins.update();
        const again = el('button', 'btn small', 'New race');
        again.type = 'button';
        again.addEventListener('click', () => {
          again.remove();
          result.textContent = 'PICK A RUNNER';
          result.style.color = '';
          newCard();
        });
        result.appendChild(document.createTextNode(' '));
        result.appendChild(again);
        go.disabled = true;
        again.addEventListener('click', () => (go.disabled = false));
      };
      requestAnimationFrame(step);
    });
    return root;
  }

  // ---------- wardrobe ----------
  function wardrobe() {
    const root = el('div', 'casino wardrobe');
    const owned = wallet.owned;
    const listed = SKINS.filter((s) => !s.secret || owned.includes(s.id));
    root.appendChild(el('p', 'fine', `${owned.length}/${listed.length} skins owned · win more from Cat Crates at the Glorp Casino downtown.`));
    const grid = el('div', 'skin-grid');
    for (const skin of listed) {
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

    const pets = wallet.pets;
    root.appendChild(el('h3', 'wardrobe-head', 'PETS'));
    root.appendChild(el('p', 'fine', `${pets.length}/${PETS.length} pets adopted · win them from Pet Crates, the Wheel of Glorp and the Pet Derby. Pets boost coins earned from points.`));
    const pgrid = el('div', 'skin-grid');
    for (const pet of [null, ...PETS]) {
      const has = !pet || pets.includes(pet.id);
      const card = petCard(pet, has);
      if ((pet ? pet.id : null) === wallet.pet) card.classList.add('equipped');
      if (has) {
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        const choose = () => {
          onPet(pet ? pet.id : null);
          pgrid.querySelectorAll('.skin-card').forEach((c) => c.classList.remove('equipped'));
          card.classList.add('equipped');
          sfx.click();
        };
        card.addEventListener('click', choose);
        card.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && choose());
      }
      pgrid.appendChild(card);
    }
    root.appendChild(pgrid);
    return root;
  }

  return { slots, crate, petCrate, wheel, plinko, derby, wardrobe, skinById, petById };
}
