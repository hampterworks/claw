// FLAPPY GLORP: alien Claw flaps between towers of spinning Maxwells.
// Do not touch the Maxwells. Do not fall in the soup.
import { createCanvasGame, showOverlay, hideOverlay, images, text, drawImg, rand, pick, clamp } from '../engine.js';
import { drawMeme } from '../cats.js';
import { drawBliss } from '../props.js';
import { sfx } from '../audio.js';
import { LOSE, SIMMER } from '../brainrot.js';
import { submit, best } from '../scores.js';

export const meta = { id: 'flappy', title: 'Flappy Glorp' };

const W = 480;
const H = 720;
const SOUP_Y = 655;
const BIRD_X = 130;
const BIRD_R = 25;
const COL_W = 74;
const GRAVITY = 1450;
const FLAP = -440;

export function mount(el) {
  let mode = 'ready';
  let s;

  function reset() {
    s = { y: 330, vy: 0, cols: [], nyans: [], score: 0, speed: 175, dist: 0, nextCol: 260, deadT: 0 };
  }

  function flap() {
    s.vy = FLAP;
    sfx.flap();
  }

  function die(reason) {
    if (mode !== 'play') return;
    mode = 'dead';
    sfx.fail();
    g.shake(12);
    g.burst(BIRD_X, s.y, ['#7CFF4F', '#3cff6e', '#fff'], 24);
    setTimeout(() => {
      if (!alive) return;
      const isBest = submit('flappy', s.score);
      showOverlay(g.wrap, {
        title: pick(LOSE),
        img: 'assets/claw-full-alien.webp',
        text: [reason, `Score: ${s.score}${isBest ? '  (NEW BEST!)' : ''}`, `Best: ${best('flappy')}`],
        buttons: [
          { label: 'Glorp again', primary: true, onClick: begin },
          { label: 'Menu', onClick: () => (location.hash = '') },
        ],
      });
    }, 700);
  }

  function begin() {
    hideOverlay(g.wrap);
    reset();
    mode = 'ready';
  }

  function update(dt) {
    if (mode === 'ready') {
      s.y = 330 + Math.sin(g.time * 3) * 12;
      s.dist += s.speed * dt * 0.5;
      return;
    }
    if (mode === 'dead') {
      s.vy += GRAVITY * dt;
      s.y = Math.min(SOUP_Y, s.y + s.vy * dt);
      return;
    }
    s.speed = Math.min(300, 175 + s.score * 4);
    const dx = s.speed * dt;
    s.dist += dx;
    s.vy += GRAVITY * dt;
    s.y += s.vy * dt;
    if (s.y < BIRD_R) {
      s.y = BIRD_R;
      s.vy = 0;
    }

    s.nextCol -= dx;
    if (s.nextCol <= 0) {
      s.nextCol = rand(230, 270);
      const gap = Math.max(150, 215 - s.score * 3);
      const gapY = rand(140 + gap / 2, SOUP_Y - 60 - gap / 2);
      s.cols.push({ x: W + COL_W, gapY, gap, passed: false, spin: rand(0, 6) });
      if (Math.random() < 0.3) s.nyans.push({ x: W + COL_W + 130, y: gapY + rand(-40, 40), t: 0 });
    }
    for (const c of s.cols) {
      c.x -= dx;
      if (!c.passed && c.x + COL_W / 2 < BIRD_X) {
        c.passed = true;
        s.score += 1;
        sfx.click();
        if (s.score % 5 === 0) g.popup(pick(SIMMER), W / 2, 200, { color: '#ffe14d', size: 30 });
      }
      // circle vs the two rectangles
      const left = c.x - COL_W / 2;
      const right = c.x + COL_W / 2;
      const top = c.gapY - c.gap / 2;
      const bottom = c.gapY + c.gap / 2;
      if (hitRect(BIRD_X, s.y, BIRD_R, left, -100, right, top) || hitRect(BIRD_X, s.y, BIRD_R, left, bottom, right, SOUP_Y + 100)) {
        die('Claw bonked a Maxwell. Maxwell keeps spinning.');
      }
    }
    s.cols = s.cols.filter((c) => c.x > -COL_W);
    for (const n of s.nyans) {
      n.x -= dx;
      n.t += dt;
      if (!n.got && Math.hypot(n.x - BIRD_X, n.y - s.y) < 46) {
        n.got = true;
        s.score += 3;
        sfx.ding();
        g.popup('+3 NYAN BONUS', n.x, n.y - 30, { color: '#ff7bf2', size: 28 });
        g.burst(n.x, n.y, ['#ff1a1a', '#ff9a1a', '#fff21a', '#36ff1a', '#1a9cff', '#7a1aff'], 18);
      }
    }
    s.nyans = s.nyans.filter((n) => n.x > -80 && !n.got);

    if (s.y + BIRD_R * 0.6 >= SOUP_Y) {
      s.y = SOUP_Y;
      g.burst(BIRD_X, SOUP_Y, ['#ffb347', '#fff'], 20, { angle: -Math.PI / 2, spread: 1, min: 150, max: 380, grav: 900 });
      sfx.splash();
      die('Claw fell into the soup. Accidentally boiled. Still counts.');
    }
  }

  function hitRect(cx, cy, r, x1, y1, x2, y2) {
    const nx = clamp(cx, x1, x2);
    const ny = clamp(cy, y1, y2);
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  function drawColumn(ctx, c, fromY, toY) {
    // stacked Maxwells from fromY towards toY
    const step = 58;
    const dir = toY > fromY ? 1 : -1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.x - COL_W, Math.min(fromY, toY), COL_W * 2, Math.abs(toY - fromY));
    ctx.clip();
    for (let y = fromY + dir * 30, i = 0; dir > 0 ? y < toY + 40 : y > toY - 40; y += dir * step, i++) {
      drawMeme(ctx, 'maxwell', c.x, y, 62, g.time * (i % 2 ? 1 : -1) + c.spin + i);
    }
    ctx.restore();
  }

  function draw(ctx) {
    const t = g.time;
    drawBliss(ctx, W, H, t, s.dist);
    for (const c of s.cols) {
      drawColumn(ctx, c, c.gapY - c.gap / 2, -40);
      drawColumn(ctx, c, c.gapY + c.gap / 2, SOUP_Y + 20);
    }
    for (const n of s.nyans) drawMeme(ctx, 'nyan', n.x, n.y + Math.sin(n.t * 6) * 6, 46, n.t);

    // the soup
    const gr = ctx.createLinearGradient(0, SOUP_Y, 0, H);
    gr.addColorStop(0, '#ffb347');
    gr.addColorStop(1, '#c2560e');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, SOUP_Y + Math.sin(x * 0.05 + t * 4) * 5);
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const k = (t * 1.3 + i * 0.37) % 1;
      ctx.beginPath();
      ctx.arc(((i * 67 - s.dist * 0.6) % W + W) % W, SOUP_Y + 30 - k * 20, 3 + k * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    text(ctx, 'HOT SOUP (do not)', W / 2, SOUP_Y + 38, { size: 20, color: '#fff' });

    const rot = clamp(s.vy / 700, -0.5, 1.1);
    drawImg(ctx, images.alien, BIRD_X, s.y, BIRD_R * 2.5, { rot: mode === 'dead' ? t * 8 : rot });

    text(ctx, String(s.score), W / 2, 70, { size: 64, color: '#fff' });
    if (mode === 'ready') {
      text(ctx, 'TAP / SPACE TO GLORP', W / 2, 470, { size: 34, color: '#7CFF4F' });
      text(ctx, `best: ${best('flappy')}`, W / 2, 515, { size: 22, color: '#fff' });
    }
  }

  function onTap() {
    if (mode === 'ready') {
      mode = 'play';
      flap();
    } else if (mode === 'play') flap();
  }

  function onKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      onTap();
      return true;
    }
    return false;
  }

  let alive = true;
  reset();
  const g = createCanvasGame(el, { width: W, height: H, update, draw, onTap, onKey });
  g.start();
  return () => {
    alive = false;
    g.destroy();
  };
}
