// The only non-cat things allowed: the pot and the fire (they ARE the joke).
const TAU = Math.PI * 2;

export function drawPotBack(ctx, x, y, w) {
  const ry = w * 0.13;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, ry, 0, 0, TAU);
  ctx.fillStyle = '#2a2a33';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#111';
  ctx.stroke();
}

// Water colour slides from chill blue to angry orange as heat rises (0..1).
export function waterColor(heat, alpha = 0.78) {
  const h = Math.max(0, Math.min(1, heat));
  const r = Math.round(60 + 195 * h);
  const g = Math.round(170 - 60 * h);
  const b = Math.round(230 - 200 * h);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function drawWater(ctx, x, y, w, heat, t) {
  const ry = w * 0.13;
  ctx.beginPath();
  ctx.ellipse(x, y + ry * 0.25, w / 2 - 8, ry * 0.8, 0, 0, TAU);
  ctx.fillStyle = waterColor(heat);
  ctx.fill();
  // surface shimmer
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const wx = x - w * 0.25 + i * w * 0.25 + Math.sin(t * 2 + i) * 8;
    ctx.moveTo(wx - 18, y + ry * 0.3);
    ctx.quadraticCurveTo(wx, y + ry * 0.1, wx + 18, y + ry * 0.3);
  }
  ctx.stroke();
}

// Front half of the water surface, drawn over whatever is sitting in the pot
// so it looks submerged instead of pasted on top.
export function drawWaterFront(ctx, x, y, w, heat) {
  const ry = w * 0.13;
  ctx.beginPath();
  ctx.ellipse(x, y + ry * 0.25, w / 2 - 8, ry * 0.8, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = waterColor(heat, 0.6);
  ctx.fill();
}

export function drawPotFront(ctx, x, y, w, h, o = {}) {
  const ry = w * 0.13;
  const left = x - w / 2;
  const right = x + w / 2;
  // handles
  ctx.fillStyle = '#3b3b44';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * (w / 2 + 6), y + h * 0.28, 18, 10, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left + w * 0.05, y + h - 22);
  ctx.quadraticCurveTo(left + w * 0.06, y + h, left + w * 0.12, y + h);
  ctx.lineTo(right - w * 0.12, y + h);
  ctx.quadraticCurveTo(right - w * 0.06, y + h, right - w * 0.05, y + h - 22);
  ctx.lineTo(right, y);
  ctx.ellipse(x, y, w / 2, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  const grad = ctx.createLinearGradient(left, 0, right, 0);
  const tint = o.tint || ['#5b5b66', '#b8b8c6', '#6c6c78', '#3a3a44'];
  grad.addColorStop(0, tint[0]);
  grad.addColorStop(0.3, tint[1]);
  grad.addColorStop(0.65, tint[2]);
  grad.addColorStop(1, tint[3]);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#111';
  ctx.stroke();
  // rim highlight
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, ry, 0, 0, Math.PI, false);
  ctx.lineWidth = 9;
  ctx.strokeStyle = o.rim || '#d6d6e0';
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#111';
  ctx.stroke();
  if (o.label) {
    ctx.save();
    ctx.font = `${Math.round(w * 0.09)}px 'Bangers', Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,20,20,0.55)';
    ctx.fillText(o.label, x, y + h * 0.62);
    ctx.restore();
  }
}

// intensity 0..1
export function drawFire(ctx, x, y, w, intensity, t) {
  // logs
  ctx.fillStyle = '#6b3d1e';
  ctx.strokeStyle = '#2b160a';
  ctx.lineWidth = 3;
  for (const [dx, rot] of [[-0.18, 0.12], [0.18, -0.12]]) {
    ctx.save();
    ctx.translate(x + dx * w, y - 6);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-w * 0.28, -9, w * 0.56, 18, 9) : ctx.rect(-w * 0.28, -9, w * 0.56, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  const n = 7;
  const layers = [
    ['#ff3b1f', 1],
    ['#ff9a1f', 0.7],
    ['#ffe14d', 0.42],
  ];
  for (const [color, k] of layers) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const fx = x + (i - (n - 1) / 2) * (w / n) * 0.9;
      const center = 1 - Math.abs(i - (n - 1) / 2) / n;
      const flick = 0.75 + 0.25 * Math.sin(t * 13 + i * 1.9) + 0.1 * Math.sin(t * 29 + i);
      const fh = (18 + intensity * 120) * flick * k * (0.6 + center * 0.6);
      const fw = (w / n) * 0.75 * k + 4;
      ctx.beginPath();
      ctx.moveTo(fx - fw, y);
      ctx.quadraticCurveTo(fx - fw, y - fh * 0.45, fx + Math.sin(t * 7 + i) * 6, y - fh);
      ctx.quadraticCurveTo(fx + fw, y - fh * 0.45, fx + fw, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Windows XP "Bliss" vibes (a nod to Claw's leaf picture).
export function drawBliss(ctx, w, h, t, scroll = 0) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2a6fe0');
  sky.addColorStop(0.55, '#8cc4ff');
  sky.addColorStop(1, '#d6ecff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 173 - scroll * 0.15 + t * 6) % (w + 200) + w + 200) % (w + 200) - 100;
    const cy = 60 + ((i * 97) % 200);
    for (const [dx, dy, r] of [[0, 0, 26], [24, -10, 22], [48, 0, 24], [22, 8, 22]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, TAU);
      ctx.fill();
    }
  }
  const hill = (base, amp, color, speed, freq) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) {
      const y = base + Math.sin((x + scroll * speed) * freq) * amp + Math.sin((x + scroll * speed) * freq * 2.3) * amp * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  hill(h * 0.7, 30, '#5fae3c', 0.25, 0.008);
  hill(h * 0.78, 24, '#3f8f2a', 0.5, 0.011);
}
