// Gone Fishin': a Stardew-style fishing minigame at the Lake Meowchigan dock.
// Cast -> wait for a bite -> hook it on the "!" -> hold to keep the catch zone on the fish.
import { read, write } from '../../scores.js';

const RARITY_COLORS = {
  junk: '#9aa0a8',
  common: '#b9c4cc',
  uncommon: '#5fd35f',
  rare: '#4fa3ff',
  epic: '#c25cff',
  legendary: '#ffb000',
};

// speed: how fast the fish darts, jump: chance per frame of a sudden new target, zone: catch zone height,
// coins: what the Fisher Cat pays when you sell it
export const FISH = [
  { id: 'glorpfish', name: 'Glorpfish', emoji: '🐟', rarity: 'common', w: 30, speed: 0.55, jump: 0.01, coins: 12, pts: 60 },
  { id: 'tropical', name: 'Ohio Tropical Fish', emoji: '🐠', rarity: 'common', w: 22, speed: 0.7, jump: 0.012, coins: 15, pts: 70 },
  { id: 'boot', name: 'Old Boot', emoji: '🥾', rarity: 'junk', w: 12, speed: 0.2, jump: 0, coins: 2, pts: 10 },
  { id: 'duck', name: 'Rubber Duck', emoji: '🦆', rarity: 'junk', w: 8, speed: 0.35, jump: 0.005, coins: 5, pts: 20 },
  { id: 'puffer', name: 'Popcat Pufferfish', emoji: '🐡', rarity: 'uncommon', w: 12, speed: 1.0, jump: 0.02, coins: 30, pts: 120 },
  { id: 'catfish', name: 'Literal Catfish', emoji: '🐱', rarity: 'uncommon', w: 10, speed: 1.1, jump: 0.025, coins: 40, pts: 140 },
  { id: 'headphones', name: "Matt's Spare Headphones", emoji: '🎧', rarity: 'rare', w: 5, speed: 0.9, jump: 0.03, coins: 60, pts: 200 },
  { id: 'shark', name: 'Baby Shark (doo doo)', emoji: '🦈', rarity: 'rare', w: 5, speed: 1.5, jump: 0.03, coins: 75, pts: 250 },
  { id: 'card', name: "Winty's Business Card", emoji: '💳', rarity: 'rare', w: 4, speed: 1.3, jump: 0.05, coins: 50, pts: 180 },
  { id: 'squid', name: 'OIIA Squid', emoji: '🦑', rarity: 'epic', w: 3, speed: 1.8, jump: 0.06, coins: 140, pts: 400, zone: 62 },
  { id: 'lobster', name: 'Lobster Maxwell', emoji: '🦞', rarity: 'epic', w: 2.5, speed: 1.7, jump: 0.07, coins: 150, pts: 450, zone: 60 },
  { id: 'golden', name: 'Golden Glorpfish', emoji: '🐟', rarity: 'legendary', w: 1, speed: 2.2, jump: 0.08, coins: 400, pts: 1000, zone: 52, gold: true },
];
const LUCKY = new Set(['rare', 'epic', 'legendary']);
// luck: Golden Bait level, boosts the weight of rare+ catches
function rollFish(luck = 0) {
  const wOf = (f) => f.w * (LUCKY.has(f.rarity) ? 1 + luck * 0.6 : 1);
  let x = Math.random() * FISH.reduce((a, f) => a + wOf(f), 0);
  for (const f of FISH) if ((x -= wOf(f)) < 0) return f;
  return FISH[0];
}

// Tackle Shop upgrades: 3 levels each, bought with Glorp Coins.
export const TACKLE = [
  { id: 'rod', name: 'Chonky Rod', emoji: '🎣', desc: 'bigger catch zone', cost: [100, 300, 700] },
  { id: 'reel', name: 'Turbo Reel', emoji: '⚙️', desc: 'reels in faster', cost: [150, 400, 900] },
  { id: 'lure', name: 'Catnip Lure', emoji: '🌿', desc: 'calmer fish', cost: [200, 500, 1000] },
  { id: 'bait', name: 'Golden Bait', emoji: '✨', desc: 'rarer fish', cost: [250, 600, 1200] },
];

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export function createFishing({ wallet, ch, sfx, hud }) {
  const dex = read('simfish', {});
  const saveDex = () => write('simfish', dex);
  // caught fish wait in the bucket (saved) until you sell them
  const bucket = read('simbucket', []).filter((id) => FISH.some((f) => f.id === id));
  const saveBucket = () => write('simbucket', bucket);
  const fishById = (id) => FISH.find((f) => f.id === id);
  const tackle = { rod: 0, reel: 0, lure: 0, bait: 0, ...read('simtackle', {}) };
  const saveTackle = () => write('simtackle', tackle);
  const bucketValue = () => bucket.reduce((a, id) => a + fishById(id).coins, 0);

  function panel() {
    const root = el('div', 'casino fishing');
    const top = el('div', 'casino-coins');
    const coinsB = el('b', null, String(wallet.coins));
    const dexB = el('b', null, '');
    top.append('🪙 ', coinsB, '  ·  Fishdex ', dexB);
    root.appendChild(top);
    const W = 320;
    const H = 360;
    const canvas = el('canvas', 'fish-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    root.appendChild(canvas);
    const msg = el('div', 'slot-result', 'Press CAST (or Space / E)');
    root.appendChild(msg);
    const btn = el('button', 'btn primary spin', 'CAST 🎣');
    btn.type = 'button';
    root.appendChild(btn);
    const bucketRow = el('div', 'fish-bucket');
    const bucketText = el('span');
    const sell = el('button', 'btn small primary', 'SELL ALL');
    sell.type = 'button';
    bucketRow.append(bucketText, sell);
    root.appendChild(bucketRow);
    const shop = el('div', 'tackle-shop');
    root.appendChild(el('div', 'tackle-head', '🛠 TACKLE SHOP'));
    root.appendChild(shop);
    function renderShop() {
      shop.innerHTML = '';
      for (const u of TACKLE) {
        const lv = tackle[u.id];
        const max = lv >= u.cost.length;
        const b = el('button', 'btn small tackle' + (max ? ' maxed' : ''));
        b.type = 'button';
        b.append(el('b', null, `${u.emoji} ${u.name}`), el('span', 'pips', '●'.repeat(lv) + '○'.repeat(u.cost.length - lv)), el('small', null, max ? `MAXED · ${u.desc}` : `${u.desc} · ${u.cost[lv]} 🪙`));
        b.disabled = max;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (max) return;
          if (!wallet.spend(u.cost[lv])) {
            msg.textContent = `Need ${u.cost[lv]} 🪙. Sell some fish first.`;
            msg.style.color = '#ff4f6d';
            sfx.fail();
            return;
          }
          tackle[u.id]++;
          saveTackle();
          msg.textContent = `${u.name} upgraded to level ${tackle[u.id]}!`;
          msg.style.color = '#7CFF4F';
          sfx.win();
          renderShop();
          renderBucket();
        });
        shop.appendChild(b);
      }
    }
    const grid = el('div', 'fishdex');
    root.appendChild(grid);
    root.appendChild(el('p', 'fine', 'Hold the button (or Space / E / tap the water) to raise the green zone. Keep the catch on it until the bar fills. Sell your bucket to the Fisher Cat for Glorp Coins.'));

    function renderBucket() {
      const v = bucketValue();
      bucketText.textContent = bucket.length ? `🪣 ${bucket.length} fish · worth ${v} 🪙` : '🪣 Bucket empty. Go catch something.';
      sell.textContent = bucket.length ? `SELL ALL (+${v} 🪙)` : 'SELL ALL';
      sell.disabled = !bucket.length;
      coinsB.textContent = String(wallet.coins);
    }
    renderShop();
    sell.addEventListener('click', () => {
      if (!bucket.length) return;
      const n = bucket.length;
      const v = bucketValue();
      bucket.length = 0;
      saveBucket();
      wallet.add(v);
      hud.popup(`SOLD ${n} FISH +${v} 🪙`, '#ffe14d');
      msg.textContent = `Fisher Cat: "pleasure doing business" +${v} 🪙`;
      msg.style.color = '#ffe14d';
      if (v >= 100) sfx.win();
      else sfx.ding();
      renderBucket();
    });

    function renderDex() {
      grid.innerHTML = '';
      let found = 0;
      for (const f of FISH) {
        const n = dex[f.id] || 0;
        if (n) found++;
        const c = el('div', 'fishdex-item' + (n ? '' : ' locked'));
        c.style.setProperty('--rarity', RARITY_COLORS[f.rarity]);
        c.title = n ? `${f.name} (${f.rarity}) x${n} · sells for ${f.coins} 🪙` : '???';
        c.append(el('span', 'fe' + (f.gold ? ' gold' : ''), n ? f.emoji : '?'), el('small', null, n ? `x${n}` : ''));
        grid.appendChild(c);
      }
      dexB.textContent = `${found}/${FISH.length}`;
      renderBucket();
    }
    renderDex();

    // ---------- state machine ----------
    const TRACK_TOP = 30;
    const TRACK_H = 300;
    let mode = 'ready'; // ready | wait | bite | reel | done
    let timer = 0;
    let fish = null;
    let holding = false;
    let zoneY = 0; // bottom of zone, 0..TRACK_H
    let zoneV = 0;
    let zoneH = 74;
    let fishY = 0;
    let fishTarget = 0;
    let progress = 0;
    let last = performance.now();
    let t = 0;

    function cast() {
      mode = 'wait';
      timer = 1.2 + Math.random() * 2.6;
      msg.textContent = 'waiting for a bite...';
      btn.textContent = '...';
      sfx.flap();
    }
    function bite() {
      mode = 'bite';
      timer = 1.3;
      fish = rollFish(tackle.bait);
      msg.textContent = '! HOOK IT !';
      btn.textContent = 'HOOK!';
      sfx.pop();
    }
    function hook() {
      mode = 'reel';
      zoneH = (fish.zone || 84) + tackle.rod * 18;
      zoneY = 40;
      zoneV = 0;
      fishY = TRACK_H * 0.4;
      fishTarget = fishY;
      progress = 0.35;
      msg.textContent = `Something's on the line...`;
      btn.textContent = 'REEL (hold)';
      sfx.click();
    }
    function finish(caught) {
      mode = 'done';
      timer = 1.4;
      btn.textContent = 'CAST AGAIN 🎣';
      if (!caught) {
        msg.textContent = 'It got away. Skill issue.';
        sfx.fail();
        return;
      }
      dex[fish.id] = (dex[fish.id] || 0) + 1;
      saveDex();
      bucket.push(fish.id);
      saveBucket();
      ch.chaos(fish.pts, `CAUGHT ${fish.name.toUpperCase()}`, RARITY_COLORS[fish.rarity]);
      ch.progress('fishing');
      msg.textContent = `${fish.emoji} ${fish.name} (${fish.rarity})! Worth ${fish.coins} 🪙, in the bucket`;
      msg.style.color = RARITY_COLORS[fish.rarity];
      if (fish.rarity === 'legendary') {
        sfx.win();
        sfx.meow(1000);
        hud.banner('LEGENDARY CATCH', fish.name, { pog: true });
        ch.complete('golden');
      } else if (fish.rarity === 'epic' || fish.rarity === 'rare') sfx.win();
      else sfx.ding();
      renderDex();
    }

    function press() {
      if (mode === 'ready' || mode === 'done') {
        msg.style.color = '';
        cast();
      } else if (mode === 'wait') {
        msg.textContent = 'Too early! You scared it off.';
        mode = 'done';
        timer = 0.6;
        btn.textContent = 'CAST AGAIN 🎣';
        sfx.fail();
      } else if (mode === 'bite') hook();
      holding = true;
    }
    const release = () => (holding = false);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press();
    });
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press();
    });
    window.addEventListener('pointerup', release);
    const onKey = (e) => {
      if (e.code !== 'Space' && e.code !== 'KeyE') return;
      e.preventDefault();
      if (e.type === 'keydown' && !e.repeat) press();
      if (e.type === 'keyup') release();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);

    function step(now) {
      if (!root.isConnected) {
        // panel closed: clean up
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup', onKey);
        window.removeEventListener('pointerup', release);
        return;
      }
      requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (mode === 'wait') {
        timer -= dt;
        if (timer <= 0) bite();
      } else if (mode === 'bite') {
        timer -= dt;
        if (timer <= 0) {
          msg.textContent = 'Too slow, it spat out the hook.';
          mode = 'done';
          timer = 0.6;
          btn.textContent = 'CAST AGAIN 🎣';
          sfx.fail();
        }
      } else if (mode === 'reel') {
        // catch zone: hold to rise, gravity pulls it down, bouncy floor
        zoneV += (holding ? 500 : -420) * dt;
        zoneV = Math.max(-340, Math.min(340, zoneV));
        zoneY += zoneV * dt;
        if (zoneY < 0) {
          zoneY = 0;
          zoneV = -zoneV * 0.35;
        }
        if (zoneY > TRACK_H - zoneH) {
          zoneY = TRACK_H - zoneH;
          zoneV = 0;
        }
        // fish darts between random targets
        const calm = 1 - tackle.lure * 0.17;
        if (Math.random() < fish.jump * calm || Math.abs(fishTarget - fishY) < 4) fishTarget = 10 + Math.random() * (TRACK_H - 20);
        fishY += (fishTarget - fishY) * Math.min(1, dt * fish.speed * calm * 2.2) + Math.sin(t * 9) * fish.speed * calm * 0.5;
        fishY = Math.max(8, Math.min(TRACK_H - 8, fishY));
        const inZone = fishY > zoneY && fishY < zoneY + zoneH;
        progress += (inZone ? 0.32 * (1 + tackle.reel * 0.3) : -0.16 * (1 - tackle.reel * 0.15)) * dt;
        if (progress >= 1) finish(true);
        else if (progress <= 0) finish(false);
      } else if (mode === 'done') {
        timer -= dt;
      }
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // lake
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#5fc8ff');
      g.addColorStop(0.25, '#2a9fd6');
      g.addColorStop(1, '#0b3b63');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const y = 70 + i * 50 + Math.sin(t * 1.3 + i) * 4;
        ctx.moveTo(0, y);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.05 + t * 2 + i) * 3);
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (mode !== 'reel') {
        // bobber + line
        const bx = 200;
        const by = 150 + Math.sin(t * 3) * 3 + (mode === 'bite' ? Math.sin(t * 40) * 6 : 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(W, 0);
        ctx.quadraticCurveTo(260, 40, bx, by - 10);
        ctx.stroke();
        if (mode !== 'ready') {
          ctx.fillStyle = '#ff3b3b';
          ctx.beginPath();
          ctx.arc(bx, by - 6, 8, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(bx, by + 2, 8, 0, Math.PI);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.ellipse(bx, by + 8, 18 + (t * 20) % 14, 4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (mode === 'bite') {
          ctx.font = "64px 'Bangers', Impact, sans-serif";
          ctx.fillStyle = '#ffe14d';
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 6;
          ctx.strokeText('!', bx, by - 60);
          ctx.fillText('!', bx, by - 60);
        }
        if (mode === 'ready') {
          ctx.font = '48px serif';
          ctx.fillText('🎣', W / 2, H / 2);
        }
        return;
      }
      // reel meter
      const tx = 70;
      const tw = 56;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(tx, TRACK_TOP, tw, TRACK_H);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.strokeRect(tx, TRACK_TOP, tw, TRACK_H);
      const zTop = TRACK_TOP + TRACK_H - zoneY - zoneH;
      ctx.fillStyle = 'rgba(124,255,79,0.55)';
      ctx.fillRect(tx + 3, zTop, tw - 6, zoneH);
      ctx.strokeStyle = '#7CFF4F';
      ctx.strokeRect(tx + 3, zTop, tw - 6, zoneH);
      const fy = TRACK_TOP + TRACK_H - fishY;
      if (fish.gold) {
        ctx.fillStyle = 'rgba(255,200,0,0.8)';
        ctx.beginPath();
        ctx.arc(tx + tw / 2, fy, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = '30px serif';
      ctx.fillText(fish.emoji, tx + tw / 2, fy);
      // progress bar
      const px = tx + tw + 14;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(px, TRACK_TOP, 16, TRACK_H);
      const ph = TRACK_H * Math.max(0, Math.min(1, progress));
      ctx.fillStyle = progress > 0.66 ? '#7CFF4F' : progress > 0.33 ? '#ffe14d' : '#ff4f6d';
      ctx.fillRect(px, TRACK_TOP + TRACK_H - ph, 16, ph);
      ctx.strokeStyle = '#111';
      ctx.strokeRect(px, TRACK_TOP, 16, TRACK_H);
      // Claw cheering on the right
      ctx.font = '22px serif';
      ctx.fillText(holding ? '💪' : '🐈', 240, TRACK_TOP + 40 + Math.sin(t * 6) * 4);
      ctx.font = "20px 'Bangers', Impact, sans-serif";
      ctx.fillStyle = '#fff';
      ctx.fillText(holding ? 'REELING' : 'HOLD!', 240, TRACK_TOP + 80);
    }

    // read-only peek for automated tests (?debug)
    root.fishingState = () => ({ mode, fishY, zoneY, zoneH, progress, fish: fish && fish.id });
    requestAnimationFrame((now) => {
      last = now;
      step(now);
    });
    return root;
  }

  return { panel, dex, bucket, bucketValue, tackle };
}
