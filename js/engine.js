// Tiny canvas game helper shared by every minigame.
// Games draw in a fixed logical resolution (default 480x720) and the canvas
// is scaled to fit the screen, so the same code works on phones and desktops.

export const images = {};

export function loadImages(map) {
  return Promise.all(
    Object.entries(map).map(
      ([key, src]) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images[key] = img;
            resolve();
          };
          img.onerror = () => resolve(); // a missing sprite should never break the game
          img.src = src;
        })
    )
  );
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createCanvasGame(container, opts) {
  const { width = 480, height = 720, fit = 'screen', update, draw, onTap, onKey } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'stage-wrap';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  container.appendChild(wrap);
  const ctx = canvas.getContext('2d');

  const g = {
    canvas,
    ctx,
    wrap,
    width,
    height,
    time: 0,
    popups: [],
    particles: [],
    shakeAmt: 0,
    paused: false,
  };

  let scale = 1;
  let raf = 0;
  let last = 0;
  let alive = true;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = container.clientWidth || width;
    if (fit === 'width') {
      scale = Math.min(availW / width, 1.25);
    } else {
      const top = container.getBoundingClientRect().top;
      const availH = Math.max(320, window.innerHeight - top - 12);
      scale = Math.min(availW / width, availH / height);
    }
    const cssW = Math.floor(width * scale);
    const cssH = Math.floor(height * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    wrap.style.width = cssW + 'px';
    wrap.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform((cssW * dpr) / width, 0, 0, (cssH * dpr) / height, 0, 0);
  }

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * width,
      y: ((e.clientY - r.top) / r.height) * height,
    };
  }

  function handlePointer(e) {
    e.preventDefault();
    if (!onTap || g.paused) return;
    const p = toLogical(e);
    onTap(p.x, p.y);
  }

  function handleKey(e) {
    if (!onKey || g.paused) return;
    if (e.target && /input|textarea|button/i.test(e.target.tagName) && e.code !== 'Space') return;
    if (onKey(e) === true) e.preventDefault();
  }

  canvas.addEventListener('pointerdown', handlePointer);
  window.addEventListener('keydown', handleKey);
  window.addEventListener('resize', resize);

  g.popup = (text, x, y, o = {}) => {
    g.popups.push({
      text,
      x,
      y,
      vy: o.vy ?? -55,
      life: o.life ?? 1.2,
      max: o.life ?? 1.2,
      color: o.color || '#7CFF4F',
      size: o.size || 28,
      rot: o.rot ?? rand(-0.15, 0.15),
    });
  };

  g.burst = (x, y, color, n = 12, o = {}) => {
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + rand(-o.spread, o.spread) : rand(0, Math.PI * 2);
      const sp = rand(o.min ?? 80, o.max ?? 260);
      g.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.4, 0.9),
        max: 0.9,
        r: rand(o.rMin ?? 3, o.rMax ?? 7),
        color: Array.isArray(color) ? pick(color) : color,
        grav: o.grav ?? 500,
      });
    }
  };

  g.shake = (amt) => {
    g.shakeAmt = Math.max(g.shakeAmt, amt);
  };

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!g.paused) {
      g.time += dt;
      update && update(dt);
      for (const p of g.particles) {
        p.life -= dt;
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      g.particles = g.particles.filter((p) => p.life > 0);
      for (const p of g.popups) {
        p.life -= dt;
        p.y += p.vy * dt;
      }
      g.popups = g.popups.filter((p) => p.life > 0);
      g.shakeAmt = Math.max(0, g.shakeAmt - dt * 30);
    }

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    if (g.shakeAmt > 0) ctx.translate(rand(-g.shakeAmt, g.shakeAmt), rand(-g.shakeAmt, g.shakeAmt));
    draw && draw(ctx);
    for (const p of g.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of g.popups) {
      const k = p.life / p.max;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const pop = 1 + Math.max(0, (k - 0.85) * 3);
      ctx.scale(pop, pop);
      text(ctx, p.text, 0, 0, { size: p.size, color: p.color });
      ctx.restore();
    }
    ctx.restore();
  }

  g.start = () => {
    resize();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  g.resize = resize;

  g.destroy = () => {
    alive = false;
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', handlePointer);
    window.removeEventListener('keydown', handleKey);
    window.removeEventListener('resize', resize);
    wrap.remove();
  };

  return g;
}

// Outlined meme text (Impact energy).
export function text(ctx, str, x, y, o = {}) {
  const size = o.size || 24;
  ctx.font = `${o.weight || ''} ${size}px ${o.font || "'Bangers', Impact, 'Arial Black', sans-serif"}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  ctx.lineJoin = 'round';
  if (o.stroke !== false) {
    ctx.lineWidth = o.lineWidth || Math.max(3, size / 6);
    ctx.strokeStyle = o.strokeColor || '#111';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(str, x, y);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Speech bubble with a little tail pointing down-left at (x, y).
export function bubble(ctx, str, x, y, o = {}) {
  const size = o.size || 18;
  ctx.font = `${size}px 'Bangers', Impact, sans-serif`;
  const w = ctx.measureText(str).width + 22;
  const h = size + 16;
  const bx = Math.min(Math.max(x, 8), (o.maxX || 480) - w - 8);
  const by = y - h - 14;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  roundRect(ctx, bx, by, w, h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  const tx = Math.min(Math.max(x + 14, bx + 10), bx + w - 24);
  ctx.moveTo(tx, by + h - 2);
  ctx.lineTo(tx + 14, by + h - 2);
  ctx.lineTo(tx - 2, by + h + 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, bx + 11, by + h / 2 + 1);
}

// Draw an image centred at (x, y) with height h, keeping aspect ratio.
export function drawImg(ctx, img, x, y, h, o = {}) {
  if (!img) return { w: h, h };
  const w = (img.width / img.height) * h;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.sx || o.sy) ctx.scale(o.sx ?? 1, o.sy ?? 1);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return { w, h };
}

// DOM overlay used for start / game-over screens.
export function showOverlay(wrap, { title, text: body, img, buttons = [], extra }) {
  hideOverlay(wrap);
  const el = document.createElement('div');
  el.className = 'overlay';
  const card = document.createElement('div');
  card.className = 'overlay-card';
  if (title) {
    const h = document.createElement('h2');
    h.textContent = title;
    card.appendChild(h);
  }
  if (img) {
    const i = document.createElement('img');
    i.src = img;
    i.alt = 'Claw';
    i.className = 'overlay-img';
    card.appendChild(i);
  }
  if (body) {
    for (const line of [].concat(body)) {
      const p = document.createElement('p');
      p.textContent = line;
      card.appendChild(p);
    }
  }
  if (extra) card.appendChild(extra);
  const row = document.createElement('div');
  row.className = 'overlay-buttons';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = 'btn' + (b.primary ? ' primary' : '');
    btn.textContent = b.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      b.onClick();
    });
    row.appendChild(btn);
  }
  card.appendChild(row);
  el.appendChild(card);
  wrap.appendChild(el);
  const primary = row.querySelector('.primary');
  if (primary) primary.focus({ preventScroll: true });
  return el;
}

export function hideOverlay(wrap) {
  wrap.querySelectorAll('.overlay').forEach((o) => o.remove());
}
