// DUNK-A-CLAW: Claw pops out of pots, tap to dunk him back in.
// Leave the innocent meme cats alone.
import { createCanvasGame, showOverlay, hideOverlay, images, text, drawImg, rand, pick } from '../engine.js';
import { drawMeme, MEMES } from '../cats.js';
import { drawPotBack, drawPotFront, drawWater, drawWaterFront, drawFire } from '../props.js';
import { sfx } from '../audio.js';
import { DUNK, LOSE } from '../brainrot.js';
import { submit, best, bump } from '../scores.js';

export const meta = { id: 'whack', title: 'Dunk-a-Claw' };

const W = 480;
const H = 720;
const ROUND = 30;
const COLS = [92, 240, 388];
const ROWS = [300, 470, 640];
const POT_W = 126;
const POT_H = 52;
const DECOYS = ['banana', 'huh', 'smudge'];
const RISE = 0.14;

export function mount(el) {
  let mode = 'intro';
  let s;

  function reset() {
    s = {
      score: 0,
      combo: 0,
      timeLeft: ROUND,
      spawn: 0.6,
      dunks: 0,
      holes: ROWS.flatMap((y) => COLS.map((x) => ({ x, y, state: 'down', t: 0, up: 1, who: null }))),
    };
  }

  function lift(h) {
    // 0..1 how far out of the pot
    if (h.state === 'up') {
      if (h.t < RISE) return h.t / RISE;
      if (h.t > h.up - RISE) return Math.max(0, (h.up - h.t) / RISE);
      return 1;
    }
    if (h.state === 'hit') return Math.max(0, 1 - h.t / 0.12);
    return 0;
  }

  function update(dt) {
    if (mode !== 'play') return;
    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      s.timeLeft = 0;
      end();
      return;
    }
    const progress = 1 - s.timeLeft / ROUND; // 0 -> 1 over the round
    s.spawn -= dt;
    if (s.spawn <= 0) {
      s.spawn = 0.85 - progress * 0.45;
      const free = s.holes.filter((h) => h.state === 'down');
      if (free.length) {
        const h = pick(free);
        h.state = 'up';
        h.t = 0;
        h.up = 1.15 - progress * 0.5;
        const decoy = Math.random() < 0.3;
        h.who = decoy ? pick(DECOYS) : pick(['leaf', 'alien']);
        h.decoy = decoy;
      }
    }
    for (const h of s.holes) {
      if (h.state === 'down') continue;
      h.t += dt;
      if (h.state === 'up' && h.t >= h.up) {
        if (!h.decoy && s.combo > 0) {
          s.combo = 0;
          g.popup('combo lost', h.x, h.y - 70, { color: '#aaa', size: 20 });
        }
        h.state = 'down';
      }
      if (h.state === 'hit' && h.t > 0.35) h.state = 'down';
    }
  }

  function end() {
    mode = 'over';
    const isBest = submit('whack', s.score);
    sfx.win();
    showOverlay(g.wrap, {
      title: s.score >= 300 ? 'CERTIFIED CLAW DUNKER' : s.score > 0 ? 'NOT BAD' : pick(LOSE),
      img: 'assets/claw-full-stand.webp',
      text: [`Claw got dunked ${s.dunks} times.`, `Score: ${s.score}${isBest ? '  (NEW BEST!)' : ''}`, `Best: ${best('whack')}`],
      buttons: [
        { label: 'Dunk again', primary: true, onClick: start },
        { label: 'Menu', onClick: () => (location.hash = '') },
      ],
    });
  }

  function onTap(x, y) {
    if (mode !== 'play') return;
    for (const h of s.holes) {
      if (h.state !== 'up') continue;
      const k = lift(h);
      if (k < 0.3) continue;
      if (Math.abs(x - h.x) < 62 && y < h.y + 30 && y > h.y - 125) {
        h.state = 'hit';
        h.t = 0;
        if (h.decoy) {
          s.combo = 0;
          s.score = Math.max(0, s.score - 15);
          sfx.fail();
          g.shake(8);
          g.popup(`${MEMES[h.who].name} did nothing wrong`, h.x < 150 ? 150 : h.x > 330 ? 330 : h.x, h.y - 110, { color: '#ff4f6d', size: 22 });
          g.popup('-15', h.x, h.y - 70, { color: '#ff4f6d', size: 30 });
        } else {
          s.combo += 1;
          s.dunks += 1;
          bump('dunks');
          const pts = 10 * Math.min(5, 1 + Math.floor(s.combo / 3));
          s.score += pts;
          sfx.splash();
          g.burst(h.x, h.y, ['#8fd3ff', '#fff', '#5fb0ff'], 12, { angle: -Math.PI / 2, spread: 1, min: 120, max: 300, grav: 900 });
          g.popup(`+${pts}`, h.x, h.y - 70, { color: '#7CFF4F', size: 32 });
          if (s.combo % 5 === 0) g.popup(pick(DUNK), W / 2, 200, { color: '#5ff2ff', size: 30 });
        }
        return;
      }
    }
  }

  function draw(ctx) {
    const t = g.time;
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#2a0b4a');
    gr.addColorStop(1, '#0d3b1e');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);

    for (const h of s.holes) {
      drawFire(ctx, h.x, h.y + POT_H + 26, 90, 0.35, t + h.x);
      drawPotBack(ctx, h.x, h.y, POT_W);
      drawWater(ctx, h.x, h.y, POT_W, 0.75, t + h.y);
      const k = lift(h);
      if (k > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(h.x - 90, h.y - 220, 180, 220 + 4);
        ctx.clip();
        const headY = h.y + 40 - k * 110;
        if (h.decoy) drawMeme(ctx, h.who, h.x, headY, 82, t);
        else drawImg(ctx, h.who === 'leaf' ? images.leaf : images.alien, h.x, headY, 104, { rot: h.state === 'hit' ? 0.4 : 0 });
        ctx.restore();
      }
      drawWaterFront(ctx, h.x, h.y, POT_W, 0.75);
      drawPotFront(ctx, h.x, h.y, POT_W, POT_H);
    }

    text(ctx, `${s.score}`, 18, 34, { size: 36, align: 'left', color: '#ffe14d' });
    const tl = Math.ceil(s.timeLeft);
    text(ctx, `⏱ ${tl}s`, W - 18, 34, { size: 30, align: 'right', color: tl <= 5 ? '#ff4f6d' : '#fff' });
    if (s.combo >= 3) text(ctx, `COMBO x${Math.min(5, 1 + Math.floor(s.combo / 3))}`, W / 2, 34, { size: 30, color: '#ff7bf2' });
    text(ctx, 'DUNK CLAW. SPARE THE OTHERS.', W / 2, 92, { size: 22, color: '#7CFF4F' });
    // little legend of decoys
    DECOYS.forEach((id, i) => drawMeme(ctx, id, W / 2 - 70 + i * 70, 150, 40, t));
    text(ctx, '❌', W / 2 + 120, 150, { size: 26, stroke: false });
  }

  function start() {
    hideOverlay(g.wrap);
    reset();
    mode = 'play';
  }

  reset();
  const g = createCanvasGame(el, { width: W, height: H, update, draw, onTap });
  g.start();
  showOverlay(g.wrap, {
    title: 'DUNK-A-CLAW',
    img: 'assets/claw-full-leaf.webp',
    text: ['Claw keeps popping out of the pots.', 'Tap him to dunk him back in. Chain dunks for combos.', 'Do NOT dunk Banana Cat, Huh Cat or Smudge.', `${ROUND} seconds. Go.`],
    buttons: [{ label: 'START DUNKING', primary: true, onClick: start }],
  });
  return () => g.destroy();
}
