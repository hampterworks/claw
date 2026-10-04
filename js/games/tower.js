// HAMPTER TOWER: stack wobbly hampters as high as you can until physics says no.
// One button. The claw swings, you drop, the hampters judge you.
import { createCanvasGame, showOverlay, hideOverlay, images, loadImages, text, drawImg, roundRect, rand, pick, clamp } from '../engine.js';
import { sfx } from '../audio.js';
import { LOSE, SIMMER } from '../brainrot.js';
import { submit, best } from '../scores.js';

export const meta = { id: 'tower', title: 'Hampter Tower' };

const W = 480;
const H = 720;
const GROUND_Y = 664; // world y of the grass
const BASE = { x: 240, w: 170, h: 58 }; // the cardboard box everyone stands on
const BASE_TOP = GROUND_Y - BASE.h;
const RAIL_Y = 92; // screen y of the claw rail
const ROPE = 44; // trolley to the top of the hanging hampter
const TOP_TARGET = 455; // screen y the top of the stack scrolls to
const GRAV = 2600;
const PERFECT_PX = 6;
const PX_PER_M = 80;

const OUTLINE = '#3a2216';
const PINK = '#ffaab8';
const FURS = [
  { fur: '#e39b55', dark: '#b8733a', cream: '#fbefd9' }, // classic hampter
  { fur: '#f2c47e', dark: '#c99a55', cream: '#fff6e6' }, // honey
  { fur: '#b8aca4', dark: '#877c75', cream: '#f3eeea' }, // dusty grey (the meme one)
  { fur: '#8f5d3e', dark: '#5e3a24', cream: '#f1dcc4' }, // choco
  { fur: '#f6eee6', dark: '#d6c6b8', cream: '#ffffff' }, // snow
  { fur: '#d9874f', dark: '#9b5a2c', cream: '#fbefd9', patch: '#5e3a24' }, // patchy boi
];
const KINDS = {
  normal: { w: 78, h: 50 },
  chonk: { w: 114, h: 62 },
  tiny: { w: 50, h: 36 },
};

const SQUEAKS = ['*squeak*', 'eek', 'hampter.', 'mlem', '*chews seed*', 'oop', 'hehe'];
const TOWER_LOSE = [
  'The hampters have fallen',
  'Hampter tower collapsed',
  'Gravity: 1, Hampters: 0',
  'Skill issue (hampter edition)',
  'They are fine. Probably.',
  'Physics was not on your side',
];
const MILESTONES = [
  [4, 'TALLER THAN A GIRAFFE'],
  [8, 'CLOUD HAMPTERS'],
  [13, 'SUNSET HAMPTERS'],
  [18, 'PLANES ARE CONFUSED'],
  [23, 'HAMPTERS IN SPACE'],
  [30, 'GLORP SAYS HI'],
  [42, 'OHIO VISIBLE FROM HERE'],
  [60, 'HAMPTER SINGULARITY'],
];

// Sky colour by altitude (px above the grass).
const SKY = [
  [0, [159, 224, 255]],
  [500, [90, 180, 240]],
  [800, [150, 170, 240]],
  [1020, [255, 170, 122]],
  [1230, [208, 103, 154]],
  [1440, [90, 58, 138]],
  [1720, [21, 16, 51]],
  [2200, [6, 4, 15]],
];

function skyAt(alt) {
  if (alt <= SKY[0][0]) return SKY[0][1];
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) {
      const [a0, c0] = SKY[i - 1];
      const [a1, c1] = SKY[i];
      const k = (alt - a0) / (a1 - a0);
      return c0.map((v, j) => v + (c1[j] - v) * k);
    }
  }
  return SKY[SKY.length - 1][1];
}
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// deterministic scenery
function seeded(n) {
  let x = n * 9301 + 49297;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}
const R = seeded(7);
const STARS = Array.from({ length: 90 }, () => ({ x: R() * W, y: R() * H, r: 0.6 + R() * 1.6, tw: R() * 6 }));
const CLOUDS = Array.from({ length: 16 }, () => ({ x: R() * (W + 200) - 100, alt: 300 + R() * 720, s: 0.7 + R() * 0.8, v: 6 + R() * 14 }));
const BIRDS = Array.from({ length: 5 }, () => ({ x: R() * W, alt: 220 + R() * 520, v: 20 + R() * 30, ph: R() * 6 }));

function ellipse(ctx, x, y, rx, ry, fill, stroke) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) ctx.stroke();
}

function loafPath(ctx, w, h) {
  const rt = Math.min(w / 2, h * 0.62);
  const rb = Math.min(w / 2, h * 0.3);
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, rt);
  ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, rb);
  ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, rb);
  ctx.arcTo(-w / 2, -h / 2, 0, -h / 2, rt);
  ctx.closePath();
}

// A chubby front-facing hampter loaf, centred at (x, y). Squish anchors at the feet.
function drawHampter(ctx, hm, x, y, o = {}) {
  const { w, h } = hm;
  const P = FURS[hm.fur];
  const t = o.t || 0;
  ctx.save();
  ctx.translate(x, y + h / 2);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.sx ?? 1, o.sy ?? 1);
  ctx.translate(0, -h / 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1.6, h * 0.05);
  const fl = o.flail || 0;

  // feet (behind the loaf so only the toes peek out)
  for (const s of [-1, 1]) {
    const kick = fl ? Math.sin(t * 28 + s * 1.7) * h * 0.08 : 0;
    ellipse(ctx, s * w * 0.22 + (fl ? s * h * 0.06 : 0), h * 0.46 + kick, w * 0.11, h * 0.085, PINK, true);
  }
  // ears
  for (const s of [-1, 1]) {
    const ex = s * w * 0.3;
    const ey = -h * 0.39 - (o.scared ? h * 0.04 : 0);
    const er = h * 0.17;
    ellipse(ctx, ex, ey, er, er, P.fur, true);
    ellipse(ctx, ex, ey + er * 0.08, er * 0.55, er * 0.55, PINK);
  }
  // the loaf
  loafPath(ctx, w, h);
  ctx.fillStyle = P.fur;
  ctx.fill();
  ctx.save();
  loafPath(ctx, w, h);
  ctx.clip();
  if (P.patch) ellipse(ctx, -w * 0.28, -h * 0.28, w * 0.2, h * 0.22, P.patch);
  ellipse(ctx, 0, -h * 0.47, w * 0.14, h * 0.12, P.dark); // stripe on the head
  ellipse(ctx, 0, h * 0.24, w * 0.36, h * 0.42, P.cream); // belly + muzzle
  ctx.restore();
  // chubby cheeks
  for (const s of [-1, 1]) ellipse(ctx, s * w * 0.29, h * 0.07, h * 0.2, h * 0.17, P.cream);
  loafPath(ctx, w, h);
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  for (const s of [-1, 1]) ellipse(ctx, s * w * 0.31, h * 0.08, h * 0.09, h * 0.055, '#ff8da4');
  ctx.globalAlpha = 1;

  // eyes
  const er = Math.max(2.3, h * 0.085);
  const ey = -h * 0.12;
  for (const s of [-1, 1]) {
    const ex = s * w * 0.16;
    if (o.scared) {
      ctx.lineWidth = Math.max(1.2, h * 0.03);
      ellipse(ctx, ex, ey, er * 1.85, er * 1.85, '#fff', true);
      const jx = Math.sin(t * 40 + s) * er * 0.25;
      ellipse(ctx, ex + jx, ey, er * 0.8, er * 0.8, '#141014');
      ellipse(ctx, ex + jx - er * 0.25, ey - er * 0.3, er * 0.3, er * 0.3, '#fff');
    } else if (o.blink) {
      ctx.lineWidth = Math.max(1.4, h * 0.035);
      ctx.beginPath();
      ctx.moveTo(ex - er, ey);
      ctx.quadraticCurveTo(ex, ey + er * 0.8, ex + er, ey);
      ctx.stroke();
    } else {
      ellipse(ctx, ex, ey, er, er * 1.08, '#141014');
      ellipse(ctx, ex - er * 0.32, ey - er * 0.38, er * 0.38, er * 0.38, '#fff');
    }
  }
  // nose + mouth
  ellipse(ctx, 0, -h * 0.01, h * 0.055, h * 0.04, '#ff7f99');
  ctx.lineWidth = Math.max(1.2, h * 0.03);
  if (o.scream) {
    ellipse(ctx, 0, h * 0.12, w * 0.065, h * (0.1 + Math.abs(Math.sin(t * 30)) * 0.03), '#7a2d3a', true);
  } else if (hm.mouth === 'o') {
    ellipse(ctx, 0, h * 0.1, h * 0.04, h * 0.05, '#7a2d3a');
  } else {
    const m = h * 0.05;
    ctx.beginPath();
    ctx.moveTo(-m * 1.4, h * 0.06);
    ctx.quadraticCurveTo(-m * 0.7, h * 0.06 + m * 1.1, 0, h * 0.04);
    ctx.quadraticCurveTo(m * 0.7, h * 0.06 + m * 1.1, m * 1.4, h * 0.06);
    ctx.stroke();
  }
  // tiny paws (up by the face when screaming or falling)
  for (const s of [-1, 1]) {
    const up = o.scream || fl;
    const px = s * w * (up ? 0.13 : 0.09);
    const py = up ? h * 0.1 + (fl ? Math.sin(t * 30 + s) * h * 0.05 : 0) : h * 0.24;
    ctx.lineWidth = Math.max(1.2, h * 0.03);
    ellipse(ctx, px, py, h * 0.065, h * 0.055, PINK, true);
  }
  ctx.restore();
}

function makeSpec(n, prevFur) {
  let kind = 'normal';
  if (n % 10 === 0) kind = 'chonk';
  else if (n > 5 && Math.random() < 0.13) kind = 'tiny';
  let fur = Math.floor(Math.random() * FURS.length);
  if (fur === prevFur) fur = (fur + 1 + Math.floor(Math.random() * (FURS.length - 1))) % FURS.length;
  return { kind, ...KINDS[kind], fur, mouth: pick(['w', 'w', 'w', 'o']), blinkOff: rand(0, 4) };
}

export function mount(el) {
  let mode = 'ready';
  let s;
  loadImages({
    hampter2: 'assets/sim-hampter-2.webp',
    hampter3: 'assets/sim-hampter-3.webp',
    hampter4: 'assets/sim-hampter-4.webp',
    hampter5: 'assets/sim-hampter-5.webp',
  });

  function reset() {
    const cur = makeSpec(1, -1);
    s = {
      stack: [],
      bodies: [],
      cam: 0,
      phase: 0,
      theta: 0,
      trolleyX: W / 2,
      cur,
      next: makeSpec(2, cur.fur),
      hangT: 1,
      drop: null,
      count: 0,
      score: 0,
      streak: 0,
      instab: 0,
      leanDir: 0,
      swayA: 0,
      wind: null,
      windOff: 0,
      fall: null,
      deadT: 0,
      milestone: 0,
      react: null,
      warnT: 0,
      reason: '',
      peak: 0,
    };
  }

  // ---------- tower geometry ----------
  const topLocal = () => (s.stack.length ? s.stack[s.stack.length - 1] : null);
  const stackTopY = () => {
    const t = topLocal();
    return t ? t.y - t.h / 2 : BASE_TOP;
  };
  const towerHeight = () => BASE_TOP - stackTopY();

  // rotate a local tower point by the current sway around the base pivot
  function sway(x, y, a = s.swayA) {
    const dx = x - BASE.x;
    const dy = y - BASE_TOP;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return { x: BASE.x + dx * c - dy * sn, y: BASE_TOP + dx * sn + dy * c };
  }

  // How close the tower is to falling: for every level, how far the centre of mass of
  // everything above sits from the middle of the contact patch (1 = right at the edge).
  function balance() {
    let M = 0;
    let MX = 0;
    let worst = 0;
    let worstLevel = -1;
    for (let i = s.stack.length - 1; i >= 0; i--) {
      const hm = s.stack[i];
      const m = hm.w * hm.h;
      M += m;
      MX += hm.x * m;
      const sup = i > 0 ? s.stack[i - 1] : BASE;
      const lo = Math.max(hm.x - hm.w / 2, sup.x - sup.w / 2);
      const hi = Math.min(hm.x + hm.w / 2, sup.x + sup.w / 2);
      const half = Math.max(1, (hi - lo) / 2);
      const r = (MX / M - (lo + hi) / 2) / half;
      if (Math.abs(r) > Math.abs(worst)) {
        worst = r;
        worstLevel = i;
      }
    }
    s.instab = Math.abs(worst);
    s.leanDir = Math.sign(worst);
    return worstLevel;
  }

  // ---------- actions ----------
  function hangPos() {
    const L = ROPE + s.cur.h / 2;
    return { x: s.trolleyX + Math.sin(s.theta) * L, y: RAIL_Y + Math.cos(s.theta) * L };
  }

  function release() {
    if (s.drop || s.hangT < 0.25) return;
    const p = hangPos();
    s.drop = { spec: s.cur, x: p.x, y: p.y + s.cam, vy: 0, rot: -s.theta, t: 0 };
    sfx.click();
  }

  function land(d) {
    const top = topLocal();
    const sup = top || BASE;
    const supTopLocal = stackTopY();
    const vis = top ? sway(top.x, supTopLocal) : { x: BASE.x, y: BASE_TOP };
    let dx = d.x - vis.x;
    const spec = d.spec;
    const sy = vis.y - s.cam;

    if (Math.abs(dx) > (sup.w + spec.w) / 2 - 6) {
      // clean miss: it sails right past and the tower falls over in sympathy
      const dir = Math.sign(dx) || 1;
      s.bodies.push({ spec, x: d.x, y: d.y, vx: dir * 90, vy: d.vy * 0.6, rot: 0, vr: dir * rand(4, 8) });
      s.drop = null;
      g.popup('MISSED', d.x, sy - 40, { color: '#ff5a5a', size: 34 });
      topple(dir, s.stack.length
        ? 'A hampter missed the tower entirely. The tower fell over out of sympathy.'
        : 'A hampter missed the whole box. Hampter is fine. Your aim is not.');
      return;
    }

    const perfect = Math.abs(dx) <= PERFECT_PX;
    if (perfect) dx = 0;
    const hm = { ...spec, x: sup.x + dx, y: supTopLocal - spec.h / 2, sqT: 0, sqA: 1, born: g.time };
    s.stack.push(hm);
    s.drop = null;
    // the squish travels down the tower
    for (let i = s.stack.length - 2, k = 1; i >= 0 && k < 6; i--, k++) {
      const o = s.stack[i];
      o.sqT = -k * 0.05;
      o.sqA = 0.55 * Math.pow(0.65, k - 1);
    }
    s.count++;
    s.score++;
    sfx.squeak();

    const worstLevel = balance();
    if (s.instab >= 1) {
      const edge = worstLevel === s.stack.length - 1;
      topple(s.leanDir || Math.sign(dx) || 1, edge
        ? 'That hampter landed on the very edge and took everyone down with it.'
        : 'The tower leaned too hard. Gravity collected its taxes.');
      return;
    }

    if (perfect) {
      s.streak++;
      const bonus = Math.min(s.streak, 5);
      s.score += bonus;
      sfx.ding();
      g.popup(s.streak > 1 ? `PERFECT x${s.streak}` : 'PERFECT!', W / 2, sy - 70, { color: '#ffe14d', size: 40, life: 1.1 });
      g.popup(`+${bonus}`, d.x + spec.w * 0.7, sy - 20, { color: '#7CFF4F', size: 26 });
      g.burst(d.x, sy, ['#ffe14d', '#fff', '#ffaab8'], 18, { angle: -Math.PI / 2, spread: 1.3, min: 120, max: 320 });
      if (s.streak >= 3 && (!s.react || s.react.t > 1.2)) {
        s.react = { t: 0, img: pick(['hampter4', 'hampter3']), cap: pick(['hampter approves', 'certified stacker', 'big brain stack']) };
      }
    } else {
      s.streak = 0;
      g.burst(d.x, sy, ['#fff', '#f3e3c8'], 8, { angle: -Math.PI / 2, spread: 1.4, min: 60, max: 160, rMax: 5 });
      if (s.instab > 0.6) g.popup(pick(['WOBBLY', 'UH OH', 'CAREFUL', 'HOLD STILL']), W / 2, sy - 70, { color: '#ff9a3c', size: 30 });
      else if (Math.random() < 0.35) g.popup(pick(SQUEAKS), d.x + rand(-30, 30), sy - 30, { color: '#fff', size: 20 });
    }
    if (spec.kind === 'chonk') {
      g.shake(5);
      sfx.boing();
    }
    // height milestones (or a bit of brainrot every 5)
    const m = towerHeight() / PX_PER_M;
    let shouted = false;
    while (s.milestone < MILESTONES.length && m >= MILESTONES[s.milestone][0]) {
      g.popup(MILESTONES[s.milestone][1], W / 2, 290, { color: '#7CFF4F', size: 32, life: 1.8, vy: -25 });
      sfx.win();
      s.milestone++;
      shouted = true;
    }
    if (!shouted && s.count % 5 === 0) g.popup(pick([...SIMMER, 'STACK MAXXING', 'HAMPTER RIZZ', 'TOWER ARC']), W / 2, 290, { color: '#ff7bf2', size: 28 });

    // wind gusts once things get tall
    if (!s.wind && s.count >= 12 && Math.random() < 0.18) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      s.wind = { t: 0, dur: rand(3, 4.5), dir };
      sfx.stoke();
      g.popup(dir > 0 ? 'WINDY >>>' : '<<< WINDY', W / 2, 335, { color: '#bfe9ff', size: 30 });
    }

    // next hampter
    s.cur = s.next;
    s.next = makeSpec(s.count + 2, s.cur.fur);
    s.hangT = 0;
    if (s.cur.kind === 'chonk') g.popup('CHONK INCOMING', W / 2, 245, { color: '#ffb347', size: 28 });
    if (s.cur.kind === 'tiny') g.popup('smol bean (careful)', W / 2, 245, { color: '#ffaab8', size: 24 });
  }

  function topple(dir, reason) {
    mode = 'falling';
    s.reason = reason;
    s.streak = 0;
    s.fall = { t: 0, a0: s.swayA, a: s.swayA, w: dir * 0.15, dir };
    g.shake(8);
    sfx.hamsterScream();
  }

  function breakApart() {
    const f = s.fall;
    for (const hm of s.stack) {
      const p = sway(hm.x, hm.y, f.a);
      const rx = p.x - BASE.x;
      const ry = p.y - BASE_TOP;
      let vx = -f.w * ry;
      let vy = f.w * rx;
      const sp = Math.hypot(vx, vy);
      if (sp > 380) {
        vx *= 380 / sp;
        vy *= 380 / sp;
      }
      s.bodies.push({
        spec: hm,
        x: p.x,
        y: p.y,
        vx: vx + rand(-150, 150) + f.dir * rand(30, 120),
        vy: vy - rand(180, 480),
        rot: f.a,
        vr: f.w * rand(0.6, 2) + rand(-4, 4),
      });
    }
    s.stack = [];
    f.broken = true;
    g.shake(16);
    sfx.fail();
    g.burst(BASE.x + f.dir * 80, clamp(TOP_TARGET, 200, 600), ['#e39b55', '#fbefd9', '#ffaab8'], 24);
  }

  function gameOver() {
    mode = 'dead';
    const isBest = submit('tower', s.score);
    const m = (s.peak / PX_PER_M).toFixed(1);
    showOverlay(g.wrap, {
      title: Math.random() < 0.7 ? pick(TOWER_LOSE) : pick(LOSE),
      img: pick(['assets/sim-hampter-2.webp', 'assets/sim-hampter-5.webp']),
      text: [s.reason, `Stacked ${s.count} hampter${s.count === 1 ? '' : 's'} (${m} m tall)`, `Score: ${s.score}${isBest ? '  (NEW BEST!)' : ''}`, `Best: ${best('tower')}`],
      buttons: [
        { label: 'Stack again', primary: true, onClick: begin },
        { label: 'Menu', onClick: () => (location.hash = '') },
      ],
    });
  }

  function begin() {
    hideOverlay(g.wrap);
    reset();
    mode = 'ready';
  }

  // ---------- update ----------
  function update(dt) {
    const t = g.time;
    // swing
    const omega = Math.min(4.3, 1.7 + s.count * 0.06);
    const amp = Math.min(168, 92 + s.count * 2.5);
    s.phase += omega * dt;
    if (s.wind) {
      s.wind.t += dt;
      const k = Math.sin(Math.PI * clamp(s.wind.t / s.wind.dur, 0, 1));
      s.windOff = s.wind.dir * 60 * k;
      if (Math.random() < dt * 30) g.particles.push({ x: s.wind.dir > 0 ? -10 : W + 10, y: rand(110, 640), vx: s.wind.dir * rand(500, 800), vy: rand(-20, 20), life: 0.8, max: 0.8, r: rand(1.5, 3), color: 'rgba(255,255,255,0.7)', grav: 0 });
      if (s.wind.t >= s.wind.dur) s.wind = null;
    } else s.windOff *= Math.max(0, 1 - dt * 3);
    s.trolleyX = W / 2 + s.windOff + Math.sin(s.phase) * amp;
    const accel = -amp * omega * omega * Math.sin(s.phase);
    const wantTheta = clamp(-accel * 0.00011, -0.22, 0.22) + (s.windOff / 60) * 0.12;
    s.theta += (wantTheta - s.theta) * Math.min(1, dt * 7);
    s.hangT += dt;

    // tower sway: the displacement at the top stays readable no matter how tall it gets
    const hgt = Math.max(160, towerHeight());
    if (!s.fall) {
      const topPx = (2.5 + s.instab * 26) * Math.sin(t * (2.4 + s.instab * 3.2)) + s.leanDir * s.instab * 10 + s.windOff * 0.12;
      s.swayA = s.stack.length ? topPx / hgt : 0;
    }
    for (const hm of s.stack) hm.sqT += dt;

    // falling hampter
    if (s.drop) {
      const d = s.drop;
      d.t += dt;
      d.vy += GRAV * dt;
      const prevBottom = d.y + d.spec.h / 2;
      d.y += d.vy * dt;
      d.rot *= Math.max(0, 1 - dt * 8);
      const top = topLocal();
      const surf = top ? sway(top.x, stackTopY()).y : BASE_TOP;
      if (mode === 'play' && prevBottom <= surf + 1 && d.y + d.spec.h / 2 >= surf) {
        d.y = surf - d.spec.h / 2;
        land(d);
      }
    }

    // camera follows the top of the stack
    if (!s.fall) {
      const want = Math.min(0, stackTopY() - TOP_TARGET);
      s.cam += (want - s.cam) * Math.min(1, dt * 4);
    } else if (s.fall.broken && s.bodies.length) {
      // ride the avalanche down to the grass
      const avg = s.bodies.reduce((a, b) => a + b.y, 0) / s.bodies.length;
      const want = Math.min(0, avg - 430);
      s.cam += (want - s.cam) * Math.min(1, dt * 3.5);
    }
    s.peak = Math.max(s.peak || 0, towerHeight());

    // topple
    if (s.fall) {
      const f = s.fall;
      f.t += dt;
      if (!f.broken) {
        const alpha = f.dir * clamp(2400 / hgt, 1.6, 10);
        f.w += alpha * dt;
        f.a += f.w * dt;
        // break apart once the visible top has keeled over a bit
        if (Math.abs(f.a - f.a0) * hgt > 70 || f.t > 0.55) breakApart();
      }
      if (f.t > 2.4 && mode === 'falling') gameOver();
    }
    for (const b of s.bodies) {
      b.vy += 1700 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      if (b.y + b.spec.h / 2 > GROUND_Y && b.vy > 0) {
        b.y = GROUND_Y - b.spec.h / 2;
        b.vy *= -0.35;
        b.vx *= 0.5;
        b.vr *= 0.4;
      }
    }
    if (s.react) {
      s.react.t += dt;
      if (s.react.t > 1.8) s.react = null;
    }
    s.warnT = s.instab > 0.75 && !s.fall ? s.warnT + dt : 0;
  }

  // ---------- drawing ----------
  function drawSky(ctx) {
    const alt0 = GROUND_Y - s.cam; // altitude at the top of the screen
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, rgb(skyAt(Math.max(0, alt0 - (H * i) / 4))));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);

    const t = g.time;
    // stars
    const starA = clamp((alt0 - H / 2 - 1050) / 700, 0, 1);
    if (starA > 0) {
      for (const st of STARS) {
        const y = (((st.y - s.cam * 0.25) % H) + H) % H;
        ctx.globalAlpha = starA * (0.55 + 0.45 * Math.sin(t * 2 + st.tw));
        ctx.fillStyle = '#fff';
        ctx.fillRect(st.x, y, st.r, st.r);
      }
      ctx.globalAlpha = 1;
    }
    // ringed planet and a moon in space
    const planetY = -600 - s.cam * 0.5;
    if (planetY > -120 && planetY < H + 120) {
      ellipse(ctx, 120, planetY, 54, 54, '#ff7bf2');
      ellipse(ctx, 105, planetY - 14, 18, 10, 'rgba(255,255,255,0.25)');
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(120, planetY, 92, 20, -0.35, 0, Math.PI * 2);
      ctx.stroke();
    }
    const moonY = -235 - s.cam * 0.5;
    if (moonY > -80 && moonY < H + 80) {
      ellipse(ctx, 390, moonY, 34, 34, '#f4f1de');
      ellipse(ctx, 380, moonY - 8, 7, 7, '#d9d4bb');
      ellipse(ctx, 400, moonY + 10, 5, 5, '#d9d4bb');
    }
    // Glorp, floating around in space
    const glorpY = -840 - s.cam * 0.6;
    if (glorpY > -120 && glorpY < H + 120 && images.alien) {
      drawImg(ctx, images.alien, 380 + Math.sin(t * 0.7) * 30, glorpY + Math.sin(t * 1.3) * 10, 90, { rot: Math.sin(t) * 0.4 });
    }
    // clouds
    for (const c of CLOUDS) {
      const y = GROUND_Y - c.alt - s.cam * 0.8;
      if (y < -60 || y > H + 60) continue;
      const x = ((((c.x + t * c.v) % (W + 240)) + W + 240) % (W + 240)) - 120;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [ox, oy, r] of [[-30, 6, 22], [0, -6, 30], [32, 4, 22], [14, 10, 20], [-14, 12, 18]]) {
        ellipse(ctx, x + ox * c.s, y + oy * c.s, r * c.s, r * c.s, 'rgba(255,255,255,0.88)');
      }
    }
    // birds
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 2;
    for (const b of BIRDS) {
      const y = GROUND_Y - b.alt - s.cam * 0.9;
      if (y < -20 || y > H + 20) continue;
      const x = ((b.x + t * b.v) % (W + 40)) - 20;
      const f = Math.sin(t * 8 + b.ph) * 5;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - f);
      ctx.quadraticCurveTo(x - 4, y - 3, x, y);
      ctx.quadraticCurveTo(x + 4, y - 3, x + 9, y - f);
      ctx.stroke();
    }
    // far hills
    const hy = GROUND_Y - s.cam * 0.7 - 30;
    if (hy < H + 80) {
      ctx.fillStyle = '#7fcf6a';
      ctx.beginPath();
      ctx.moveTo(0, H + 400);
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, hy - 30 - Math.sin(x * 0.013 + 1) * 26 - Math.sin(x * 0.031) * 10);
      ctx.lineTo(W, H + 400);
      ctx.fill();
    }
    // ground
    const gy = GROUND_Y - s.cam;
    if (gy < H + 10) {
      ctx.fillStyle = '#5db14a';
      ctx.fillRect(0, gy, W, H - gy + 400);
      ctx.fillStyle = '#8a5a3a';
      ctx.fillRect(0, gy + 22, W, H - gy + 400);
      ctx.fillStyle = '#4b9a3a';
      for (let x = 0; x < W; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, gy + 1);
        ctx.lineTo(x + 4, gy - 8 - ((x * 7) % 5));
        ctx.lineTo(x + 8, gy + 1);
        ctx.fill();
      }
      // a few sunflowers (hampter snacks)
      for (const fx of [40, 92, 400, 446]) {
        ctx.strokeStyle = '#3c7d2c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fx, gy + 4);
        ctx.lineTo(fx, gy - 34);
        ctx.stroke();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + Math.sin(g.time + fx) * 0.1;
          ellipse(ctx, fx + Math.cos(a) * 9, gy - 38 + Math.sin(a) * 9, 5, 5, '#ffd23f');
        }
        ellipse(ctx, fx, gy - 38, 6, 6, '#6b3e1f');
      }
    }
  }

  function drawBase(ctx) {
    const y = BASE_TOP - s.cam;
    if (y > H + 10) return;
    const x = BASE.x - BASE.w / 2;
    ctx.fillStyle = '#c8955a';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, BASE.w, BASE.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e3b679';
    ctx.fillRect(x + 3, y + 3, BASE.w - 6, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(BASE.x - 12, y + 2, 24, BASE.h - 4);
    text(ctx, 'HAMPTERS', BASE.x, y + 27, { size: 19, color: '#5a3418', stroke: false });
    text(ctx, '(fragile)', BASE.x, y + 45, { size: 13, color: '#5a3418', stroke: false });
  }

  function hampterFace(hm, i) {
    const t = g.time;
    const scared = mode === 'falling' || mode === 'dead' || s.instab > 0.6;
    const blink = !scared && (t + hm.blinkOff + i * 0.37) % 3.6 < 0.12;
    return { scared, blink };
  }

  function drawTower(ctx) {
    ctx.save();
    const a = s.fall && !s.fall.broken ? s.fall.a : s.swayA;
    const py = BASE_TOP - s.cam;
    ctx.translate(BASE.x, py);
    ctx.rotate(a);
    ctx.translate(-BASE.x, -py);
    const t = g.time;
    s.stack.forEach((hm, i) => {
      const y = hm.y - s.cam;
      if (y < -120 || y > H + 120) return;
      const k = hm.sqT >= 0 ? hm.sqA * Math.exp(-hm.sqT * 7) * Math.cos(hm.sqT * 22) : 0;
      const breathe = Math.sin(t * 3 + i) * 0.02;
      const f = hampterFace(hm, i);
      drawHampter(ctx, hm, hm.x, y, { sx: 1 + k * 0.2 + breathe, sy: 1 - k * 0.24 - breathe, scared: f.scared, blink: f.blink, scream: !!s.fall, t: t + i });
    });
    ctx.restore();
  }

  function drawClaw(ctx) {
    const t = g.time;
    // rail
    ctx.fillStyle = '#2c2440';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    roundRect(ctx, -10, RAIL_Y - 12, W + 20, 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff7bf2';
    for (let x = 12; x < W; x += 48) ellipse(ctx, x, RAIL_Y - 6, 2.5, 2.5, '#ff7bf2');

    const tx = s.trolleyX;
    // trolley
    ctx.fillStyle = '#ff7bf2';
    roundRect(ctx, tx - 24, RAIL_Y - 4, 48, 18, 6);
    ctx.fill();
    ctx.stroke();
    ellipse(ctx, tx - 13, RAIL_Y - 6, 5, 5, '#ddd', true);
    ellipse(ctx, tx + 13, RAIL_Y - 6, 5, 5, '#ddd', true);
    ellipse(ctx, tx, RAIL_Y + 5, 3, 3, mode === 'play' && !s.drop ? (Math.sin(t * 8) > 0 ? '#7CFF4F' : '#2f7a2a') : '#ff5a5a');

    // rope + grabber
    const L = ROPE - 8;
    const gx = tx + Math.sin(s.theta) * L;
    const gy = RAIL_Y + Math.cos(s.theta) * L;
    ctx.strokeStyle = '#6b5a4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, RAIL_Y + 12);
    ctx.lineTo(gx, gy);
    ctx.stroke();

    const holding = !s.drop && mode !== 'falling' && mode !== 'dead';
    if (holding) {
      const p = hangPos();
      if (mode === 'play' || mode === 'ready') {
        // faint aim guide
        const top = topLocal();
        const surf = (top ? sway(top.x, stackTopY()).y : BASE_TOP) - s.cam;
        ctx.save();
        ctx.setLineDash([4, 9]);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + s.cur.h / 2 + 6);
        ctx.lineTo(p.x, surf);
        ctx.stroke();
        ctx.restore();
      }
      const scared = mode === 'falling' || s.instab > 0.6;
      const blink = !scared && (t + s.cur.blinkOff) % 3.2 < 0.12;
      // pops in when a fresh hampter gets loaded
      const k = clamp(s.hangT / 0.28, 0, 1);
      const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.25 - (1 - k) : 1;
      drawHampter(ctx, s.cur, p.x, p.y, { rot: -s.theta, scared, blink, t, sx: pop * (1 + Math.sin(t * 5) * 0.02), sy: pop * (1 - Math.sin(t * 5) * 0.02) });
    }

    // the claw prongs (drawn over the hampter's scruff)
    const open = holding ? clamp(1 - (s.hangT - 0.05) / 0.2, 0, 1) : 1;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(-s.theta);
    for (const sgn of [-1, 1]) {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(sgn * 3, 0);
      ctx.quadraticCurveTo(sgn * (16 + open * 10), 4, sgn * (11 + open * 14), 16 - open * 4);
      ctx.stroke();
      ctx.strokeStyle = '#c8d0da';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ellipse(ctx, 0, 0, 7, 7, '#c8d0da');
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawHud(ctx) {
    text(ctx, String(s.score), W / 2, 40, { size: 50, color: '#fff' });
    const m = (s.fall ? s.peak : towerHeight()) / PX_PER_M;
    text(ctx, `${m.toFixed(1)} m`, 16, 30, { size: 24, color: '#ffe14d', align: 'left' });
    text(ctx, `${s.count} stacked`, 16, 56, { size: 16, color: '#fff', align: 'left' });
    // next up
    text(ctx, 'NEXT', W - 46, 22, { size: 16, color: '#fff' });
    ctx.save();
    ctx.translate(W - 46, 52);
    ctx.scale(0.5, 0.5);
    drawHampter(ctx, s.next, 0, 0, { t: g.time });
    ctx.restore();
    if (s.next.kind !== 'normal') text(ctx, s.next.kind === 'chonk' ? 'CHONK' : 'smol', W - 46, 78, { size: 13, color: '#ffb347' });

    // wobble-o-meter
    if (mode === 'play') {
      const cx = W / 2;
      const y = H - 22;
      const bw = 190;
      ctx.fillStyle = 'rgba(20,10,30,0.7)';
      roundRect(ctx, cx - bw / 2 - 14, y - 24, bw + 28, 40, 14);
      ctx.fill();
      text(ctx, 'WOBBLE-O-METER', cx, y - 12, { size: 13, color: '#fff', lineWidth: 3 });
      const gr = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
      gr.addColorStop(0, '#ff3b3b');
      gr.addColorStop(0.25, '#ffd23f');
      gr.addColorStop(0.5, '#7CFF4F');
      gr.addColorStop(0.75, '#ffd23f');
      gr.addColorStop(1, '#ff3b3b');
      ctx.fillStyle = gr;
      roundRect(ctx, cx - bw / 2, y, bw, 9, 4.5);
      ctx.fill();
      const lean = clamp(s.leanDir * s.instab, -1, 1);
      const bx = cx + lean * (bw / 2 - 4) + Math.sin(g.time * 9) * s.instab * 2;
      ellipse(ctx, bx, y + 4.5, 7, 7, '#fff');
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    if (s.warnT > 0 && Math.sin(s.warnT * 14) > -0.2) text(ctx, '!! WOBBLE !!', W / 2, H - 66, { size: 26, color: '#ff5a5a' });

    if (s.react) {
      const k = s.react.t;
      const slide = k < 0.2 ? 1 - k / 0.2 : k > 1.5 ? (k - 1.5) / 0.3 : 0;
      const img = images[s.react.img];
      if (img) {
        ctx.save();
        ctx.translate(W - 74 + slide * 160, H - 170);
        ctx.rotate(0.12);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        roundRect(ctx, -62, -62, 124, 138, 6);
        ctx.fill();
        ctx.stroke();
        ctx.drawImage(img, -50, -54, 100, 100);
        text(ctx, s.react.cap, 0, 62, { size: 13, color: '#111', stroke: false });
        ctx.restore();
      }
    }

    if (mode === 'ready') {
      text(ctx, 'TAP / SPACE TO DROP', W / 2, 330, { size: 34, color: '#ffe14d' });
      text(ctx, 'stack the hampters. do not let them fall.', W / 2, 368, { size: 18, color: '#fff' });
      text(ctx, `best: ${best('tower')}`, W / 2, 400, { size: 22, color: '#fff' });
    }
  }

  function draw(ctx) {
    const t = g.time;
    drawSky(ctx);
    drawBase(ctx);
    drawTower(ctx);
    // falling hampter
    if (s.drop) {
      const d = s.drop;
      drawHampter(ctx, d.spec, d.x, d.y - s.cam, { rot: d.rot, flail: 1, t, scared: d.t > 0.15, sx: 0.94, sy: 1.08 });
    }
    // tumbling hampters
    for (const b of s.bodies) {
      const y = b.y - s.cam;
      if (y > H + 100 || y < -200) continue;
      drawHampter(ctx, b.spec, b.x, y, { rot: b.rot, flail: 1, scared: true, scream: true, t: t + b.x });
    }
    drawClaw(ctx);
    drawHud(ctx);
  }

  function onTap() {
    if (mode === 'ready') {
      mode = 'play';
      release();
    } else if (mode === 'play') release();
  }

  function onKey(e) {
    if (mode === 'dead' || mode === 'falling') return false; // let overlay buttons have the keys
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS') {
      onTap();
      return true;
    }
    return false;
  }

  reset();
  const g = createCanvasGame(el, { width: W, height: H, update, draw, onTap, onKey });
  g.start();
  return () => g.destroy();
}
