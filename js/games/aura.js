// AURA FARMER: click Claw for aura, hire meme cats to farm aura for you.
// Progress is saved on this device.
import { createCanvasGame, images, text, drawImg, rand, pick } from '../engine.js';
import { drawMeme, memeIcon } from '../cats.js';
import { sfx } from '../audio.js';
import { MILESTONES, SIMMER } from '../brainrot.js';
import { read, write, submit } from '../scores.js';

export const meta = { id: 'aura', title: 'Aura Farmer' };

const W = 480;
const H = 430;
const CX = 240;
const CY = 250;

const UPGRADES = [
  { id: 'popcat', name: 'Popcat', desc: 'pops aura into existence', base: 15, rate: 0.3 },
  { id: 'oiia', name: 'OIIA Cat', desc: 'spins so fast it makes aura', base: 110, rate: 2 },
  { id: 'maxwell', name: 'Maxwell', desc: 'aura through eternal rotation', base: 700, rate: 11 },
  { id: 'nyan', name: 'Nyan Cat', desc: 'rainbow-powered aura', base: 4000, rate: 55 },
  { id: 'happy', name: 'Happy Happy Cat', desc: 'happy happy happy aura', base: 22000, rate: 280 },
  { id: 'banana', name: 'Banana Cat', desc: 'cries aura tears', base: 130000, rate: 1500 },
  { id: 'grumpy', name: 'Grumpy Cat', desc: 'hates this. farms anyway.', base: 900000, rate: 9000 },
];
const STOVE_BASE = 50;
const STOVE_MULT = 7;

export function fmt(n) {
  if (n < 10 && n % 1) return n.toFixed(1);
  if (n < 1000) return String(Math.floor(n));
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000;
    u++;
  }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[u];
}

const costOf = (u, owned) => Math.ceil(u.base * 1.15 ** owned);
const stoveCost = (n) => STOVE_BASE * STOVE_MULT ** n;

export function mount(el) {
  const saved = read('aura', null);
  const s = {
    aura: 0,
    total: 0,
    owned: {},
    stove: 0,
    ms: 0,
    ...(saved || {}),
    bounce: 0,
  };
  const rate = () => UPGRADES.reduce((sum, u) => sum + (s.owned[u.id] || 0) * u.rate, 0);
  const perClick = () => 2 ** s.stove + rate() * 0.05;

  // offline earnings, capped at one hour
  if (saved && saved.at) {
    const away = Math.min(3600, (Date.now() - saved.at) / 1000);
    const gain = rate() * away;
    if (gain >= 1) {
      s.aura += gain;
      s.total += gain;
      s.offline = gain;
    }
  }

  function save() {
    write('aura', { aura: s.aura, total: s.total, owned: s.owned, stove: s.stove, ms: s.ms, at: Date.now() });
    submit('aura', s.total);
  }

  function gain(n) {
    s.aura += n;
    s.total += n;
    while (s.ms < MILESTONES.length && s.total >= MILESTONES[s.ms][0]) {
      g.popup(MILESTONES[s.ms][1].toUpperCase(), W / 2, 120, { color: '#ff7bf2', size: 30, life: 2.6, vy: -15 });
      sfx.win();
      s.ms++;
    }
  }

  function onTap(x, y) {
    const n = perClick();
    gain(n);
    s.bounce = 1;
    sfx.pop();
    g.popup(`+${fmt(n)} AURA`, x + rand(-10, 10), y - 10, { color: pick(['#7CFF4F', '#ffe14d', '#5ff2ff']), size: 24, life: 0.9 });
    if (Math.random() < 0.06) g.popup(pick(SIMMER), W / 2, 380, { color: '#fff', size: 22 });
    g.burst(x, y, ['#7CFF4F', '#c2ff4f', '#5ff2ff'], 5, { min: 60, max: 160, grav: 0, rMin: 2, rMax: 4 });
  }

  function onKey(e) {
    if (e.code === 'Space' && !e.repeat) {
      onTap(CX + rand(-50, 50), CY - 60);
      return true;
    }
    return false;
  }

  let saveTimer = 0;
  let shopTimer = 0;
  function update(dt) {
    const r = rate();
    if (r > 0) gain(r * dt);
    s.bounce = Math.max(0, s.bounce - dt * 6);
    saveTimer += dt;
    if (saveTimer > 3) {
      saveTimer = 0;
      save();
    }
    shopTimer += dt;
    if (shopTimer > 0.2) {
      shopTimer = 0;
      refreshShop();
    }
  }

  function draw(ctx) {
    const t = g.time;
    const r = rate();
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#16052e');
    gr.addColorStop(1, '#06210f');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);

    // aura glow grows with aura per second
    const power = Math.min(1, Math.log10(r + 1) / 6);
    const glowR = 120 + power * 90 + Math.sin(t * 3) * 10;
    const glow = ctx.createRadialGradient(CX, CY, 20, CX, CY, glowR);
    glow.addColorStop(0, `rgba(124,255,79,${0.55 + power * 0.3})`);
    glow.addColorStop(0.6, `rgba(160,60,255,${0.25 + power * 0.3})`);
    glow.addColorStop(1, 'rgba(160,60,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(CX, CY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // orbiting squad
    const squad = [];
    for (const u of UPGRADES) for (let i = 0; i < Math.min(4, s.owned[u.id] || 0); i++) squad.push(u.id);
    const shown = squad.slice(0, 20);
    const orbit = shown.map((id, i) => {
      const a = t * 0.5 + (i / Math.max(1, shown.length)) * Math.PI * 2;
      return { id, a, x: CX + Math.cos(a) * 190, y: CY + 20 + Math.sin(a) * 120 };
    });
    const behind = orbit.filter((o) => Math.sin(o.a) < 0);
    const front = orbit.filter((o) => Math.sin(o.a) >= 0);
    for (const o of behind) drawMeme(ctx, o.id, o.x, o.y, o.id === 'nyan' ? 34 : 40, t + o.a);

    const b = 1 + s.bounce * 0.08;
    drawImg(ctx, images.stand, CX, CY + 10, 250, { sx: b, sy: 2 - b });
    for (const o of front) drawMeme(ctx, o.id, o.x, o.y, o.id === 'nyan' ? 40 : 48, t + o.a);

    text(ctx, `${fmt(s.aura)} AURA`, W / 2, 36, { size: 40, color: '#7CFF4F' });
    text(ctx, `${fmt(r)} aura/sec  ·  ${fmt(perClick())} per click`, W / 2, 74, { size: 20, color: '#fff' });
    if (s.total < 20) text(ctx, 'TAP CLAW TO FARM AURA', W / 2, H - 22, { size: 24, color: '#ffe14d' });
  }

  // ---------- shop (DOM) ----------
  const shop = document.createElement('div');
  shop.className = 'shop';
  const rows = [];

  function addRow({ icon, name, desc, buy, cost, owned }) {
    const btn = document.createElement('button');
    btn.className = 'shop-item';
    btn.type = 'button';
    const ic = document.createElement('div');
    ic.className = 'shop-icon';
    ic.appendChild(icon);
    const info = document.createElement('div');
    info.className = 'shop-info';
    info.innerHTML = `<strong></strong><span class="desc"></span><span class="cost"></span>`;
    info.querySelector('strong').textContent = name;
    info.querySelector('.desc').textContent = desc;
    const own = document.createElement('div');
    own.className = 'shop-owned';
    btn.append(ic, info, own);
    btn.addEventListener('click', () => {
      if (s.aura < cost()) {
        sfx.fail();
        return;
      }
      s.aura -= cost();
      buy();
      sfx.ding();
      save();
      refreshShop();
    });
    shop.appendChild(btn);
    rows.push({ btn, cost, owned, costEl: info.querySelector('.cost'), own });
  }

  const stoveIcon = new Image();
  stoveIcon.src = 'assets/claw-leaf.webp';
  stoveIcon.alt = '';
  stoveIcon.width = stoveIcon.height = 52;
  addRow({
    icon: stoveIcon,
    name: 'Glorp Training',
    desc: 'x2 aura per click',
    cost: () => stoveCost(s.stove),
    owned: () => s.stove,
    buy: () => s.stove++,
  });
  for (const u of UPGRADES) {
    addRow({
      icon: memeIcon(u.id, 52),
      name: u.name,
      desc: `${u.desc} (+${fmt(u.rate)}/s)`,
      cost: () => costOf(u, s.owned[u.id] || 0),
      owned: () => s.owned[u.id] || 0,
      buy: () => (s.owned[u.id] = (s.owned[u.id] || 0) + 1),
    });
  }

  function refreshShop() {
    for (const r of rows) {
      const c = r.cost();
      r.costEl.textContent = `${fmt(c)} aura`;
      r.own.textContent = r.owned() ? `x${r.owned()}` : '';
      r.btn.classList.toggle('cant', s.aura < c);
    }
  }

  const reset = document.createElement('button');
  reset.className = 'btn small danger';
  reset.textContent = 'Reset aura (no undo)';
  reset.addEventListener('click', () => {
    if (!confirm('Reset all aura progress? Claw will lose his aura forever.')) return;
    Object.assign(s, { aura: 0, total: 0, owned: {}, stove: 0, ms: 0 });
    save();
    refreshShop();
  });

  const g = createCanvasGame(el, { width: W, height: H, fit: 'width', update, draw, onTap, onKey });
  el.appendChild(shop);
  el.appendChild(reset);
  refreshShop();
  g.start();
  if (s.offline) g.popup(`WHILE YOU WERE GONE: +${fmt(s.offline)}`, W / 2, 120, { color: '#ffe14d', size: 26, life: 3, vy: -10 });

  const onHide = () => document.visibilityState === 'hidden' && save();
  document.addEventListener('visibilitychange', onHide);
  return () => {
    save();
    document.removeEventListener('visibilitychange', onHide);
    g.destroy();
    shop.remove();
    reset.remove();
  };
}
