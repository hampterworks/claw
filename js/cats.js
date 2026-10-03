// Code-drawn homages to famous cat memes. Everything is drawn centred on
// (0, 0) with size `s` (about the width of the head), so any game can use them.
import { roundRect, text } from './engine.js';

const TAU = Math.PI * 2;

function ell(ctx, x, y, rx, ry, fill, stroke, lw) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw || 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function eye(ctx, x, y, r, side, o) {
  const line = o.line || '#111';
  switch (o.eyes) {
    case 'wide':
      ell(ctx, x, y, r * 0.2, r * 0.23, '#fff', line, r * 0.04);
      ell(ctx, x, y + r * 0.02, r * 0.08, r * 0.09, '#111');
      break;
    case 'happy':
      ctx.beginPath();
      ctx.arc(x, y + r * 0.08, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
      ctx.lineWidth = r * 0.07;
      ctx.strokeStyle = line;
      ctx.stroke();
      break;
    case 'grumpy':
      ell(ctx, x, y, r * 0.14, r * 0.13, o.eyeColor || '#6aa6d6', line, r * 0.03);
      ell(ctx, x, y + r * 0.02, r * 0.05, r * 0.08, '#111');
      // heavy eyelid
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.01, r * 0.17, r * 0.16, 0, Math.PI, TAU);
      ctx.fillStyle = o.mask || o.fur;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.2, y - r * 0.12);
      ctx.lineTo(x - side * r * 0.18, y - r * 0.02);
      ctx.lineWidth = r * 0.05;
      ctx.strokeStyle = line;
      ctx.stroke();
      break;
    case 'squint':
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.18, y - r * 0.1);
      ctx.lineTo(x - side * r * 0.14, y + r * 0.04);
      ctx.lineWidth = r * 0.07;
      ctx.strokeStyle = line;
      ctx.stroke();
      ell(ctx, x, y + r * 0.08, r * 0.06, r * 0.05, '#111');
      break;
    case 'sad':
      ell(ctx, x, y, r * 0.17, r * 0.19, '#111');
      ell(ctx, x - r * 0.06, y - r * 0.07, r * 0.06, r * 0.06, '#fff');
      ell(ctx, x + r * 0.05, y + r * 0.06, r * 0.03, r * 0.03, '#fff');
      break;
    default:
      if (o.eyeColor) {
        ell(ctx, x, y, r * 0.14, r * 0.15, o.eyeColor, line, r * 0.03);
        ell(ctx, x, y, r * 0.04, r * 0.12, '#111');
      } else {
        ell(ctx, x, y, r * 0.12, r * 0.13, '#111');
      }
      ell(ctx, x - r * 0.04, y - r * 0.05, r * 0.04, r * 0.04, '#fff');
  }
}

function mouth(ctx, r, o) {
  const line = o.line || '#111';
  ctx.lineWidth = r * 0.05;
  ctx.strokeStyle = line;
  switch (o.mouth) {
    case 'O':
      ell(ctx, 0, r * 0.48, r * 0.22, r * 0.3, '#3a0d12', line, r * 0.04);
      ell(ctx, 0, r * 0.64, r * 0.13, r * 0.09, '#f37b95');
      break;
    case 'open':
      ell(ctx, 0, r * 0.42, r * 0.17, r * 0.16, '#3a0d12', line, r * 0.04);
      ell(ctx, 0, r * 0.5, r * 0.1, r * 0.06, '#f37b95');
      break;
    case 'frown':
      ctx.beginPath();
      ctx.arc(0, r * 0.58, r * 0.22, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      break;
    case 'small':
      ell(ctx, 0, r * 0.4, r * 0.06, r * 0.08, '#3a0d12');
      break;
    case 'teeth':
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, r * 0.38);
      ctx.quadraticCurveTo(0, r * 0.3, r * 0.25, r * 0.38);
      ctx.quadraticCurveTo(0, r * 0.62, -r * 0.25, r * 0.38);
      ctx.fillStyle = '#3a0d12';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-r * 0.16, r * 0.36, r * 0.08, r * 0.07);
      ctx.fillRect(r * 0.08, r * 0.36, r * 0.08, r * 0.07);
      break;
    default: // 'w'
      ctx.beginPath();
      ctx.arc(-r * 0.09, r * 0.28, r * 0.09, 0.1, Math.PI - 0.1);
      ctx.moveTo(r * 0.18, r * 0.28);
      ctx.arc(r * 0.09, r * 0.28, r * 0.09, 0.1, Math.PI - 0.1);
      ctx.stroke();
  }
}

export function catFace(ctx, s, o = {}) {
  const r = s / 2;
  const fur = o.fur || '#ccc';
  const line = o.line || '#111';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (!o.noEars) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.92, -r * 0.15);
      ctx.lineTo(side * r * 0.78, -r * 1.08);
      ctx.lineTo(side * r * 0.18, -r * 0.66);
      ctx.closePath();
      ctx.fillStyle = o.ear || fur;
      ctx.fill();
      ctx.lineWidth = s * 0.03;
      ctx.strokeStyle = line;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(side * r * 0.78, -r * 0.4);
      ctx.lineTo(side * r * 0.74, -r * 0.9);
      ctx.lineTo(side * r * 0.36, -r * 0.64);
      ctx.closePath();
      ctx.fillStyle = o.innerEar || '#f4a6b8';
      ctx.fill();
    }
  }
  ell(ctx, 0, 0, r, r * 0.86, fur, line, s * 0.03);
  if (o.stripes) {
    ctx.strokeStyle = o.stripes;
    ctx.lineWidth = s * 0.045;
    for (const dx of [-0.18, 0, 0.18]) {
      ctx.beginPath();
      ctx.moveTo(dx * r, -r * 0.82);
      ctx.lineTo(dx * r * 0.8, -r * 0.5);
      ctx.stroke();
    }
  }
  if (o.mask) {
    ell(ctx, -r * 0.36, -r * 0.04, r * 0.3, r * 0.27, o.mask);
    ell(ctx, r * 0.36, -r * 0.04, r * 0.3, r * 0.27, o.mask);
    ell(ctx, 0, r * 0.18, r * 0.16, r * 0.24, o.mask);
  }
  if (o.muzzle) ell(ctx, 0, r * 0.36, r * 0.44, r * 0.32, o.muzzle);
  if (o.cheeks) {
    ell(ctx, -r * 0.55, r * 0.22, r * 0.12, r * 0.08, o.cheeks);
    ell(ctx, r * 0.55, r * 0.22, r * 0.12, r * 0.08, o.cheeks);
  }
  const ey = -r * 0.06;
  eye(ctx, -r * 0.36, ey, r, -1, { ...o, fur });
  eye(ctx, r * 0.36, ey, r, 1, { ...o, fur });
  ctx.beginPath();
  ctx.moveTo(-r * 0.09, r * 0.14);
  ctx.lineTo(r * 0.09, r * 0.14);
  ctx.lineTo(0, r * 0.24);
  ctx.closePath();
  ctx.fillStyle = o.nose || '#e5607a';
  ctx.fill();
  mouth(ctx, r, o);
  ctx.strokeStyle = o.whisker || 'rgba(20,20,20,0.7)';
  ctx.lineWidth = Math.max(1, s * 0.012);
  for (const side of [-1, 1]) {
    for (const dy of [-0.06, 0.06, 0.18]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.42, r * 0.26);
      ctx.lineTo(side * r * 1.15, r * (0.2 + dy * 1.6));
      ctx.stroke();
    }
  }
  if (o.tears) {
    ctx.fillStyle = 'rgba(90,170,255,0.85)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.42, r * 0.05);
      ctx.quadraticCurveTo(side * r * 0.52, r * 0.5, side * r * 0.42, r * 0.85);
      ctx.quadraticCurveTo(side * r * 0.3, r * 0.5, side * r * 0.42, r * 0.05);
      ctx.fill();
    }
  }
}

function at(ctx, x, y, fn, rot = 0, sx = 1, sy = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  fn();
  ctx.restore();
}

export const MEMES = {
  popcat: {
    name: 'Popcat',
    draw(ctx, x, y, s, t) {
      const open = Math.sin(t * 9) > 0;
      at(ctx, x, y, () =>
        catFace(ctx, s, { fur: '#ead2b4', ear: '#d6b58e', muzzle: '#fbf1e4', mouth: open ? 'O' : 'w' })
      );
    },
  },
  maxwell: {
    name: 'Maxwell',
    draw(ctx, x, y, s, t) {
      at(
        ctx,
        x,
        y,
        () =>
          catFace(ctx, s, {
            fur: '#1c1c1c',
            line: '#000',
            muzzle: '#f4f4f4',
            innerEar: '#5a4a4a',
            eyeColor: '#b6d96b',
            whisker: '#ddd',
            mouth: 'w',
          }),
        t * 2.5
      );
    },
  },
  oiia: {
    name: 'OIIA Cat',
    draw(ctx, x, y, s, t) {
      const sx = Math.cos(t * 14);
      at(
        ctx,
        x,
        y,
        () =>
          catFace(ctx, s, {
            fur: '#d8d2c8',
            stripes: '#8e877c',
            muzzle: '#fff',
            eyes: Math.abs(sx) < 0.3 ? 'happy' : 'normal',
            mouth: 'open',
          }),
        0,
        Math.abs(sx) < 0.08 ? 0.08 : sx
      );
    },
  },
  huh: {
    name: 'Huh Cat',
    draw(ctx, x, y, s, t) {
      at(ctx, x, y, () => catFace(ctx, s, { fur: '#f2a65a', stripes: '#c9742e', eyes: 'wide', mouth: 'small', muzzle: '#fff3e0' }), Math.sin(t * 2) * 0.12);
      text(ctx, 'huh?', x + s * 0.45, y - s * 0.65, { size: s * 0.28, color: '#fff' });
    },
  },
  grumpy: {
    name: 'Grumpy Cat',
    draw(ctx, x, y, s) {
      at(ctx, x, y, () =>
        catFace(ctx, s, { fur: '#f3e6d0', ear: '#9b7b5e', mask: '#a5876a', eyes: 'grumpy', eyeColor: '#6aa6d6', mouth: 'frown', muzzle: '#fbf6ec' })
      );
    },
  },
  smudge: {
    name: 'Smudge',
    draw(ctx, x, y, s, t) {
      at(ctx, x, y, () => {
        catFace(ctx, s, { fur: '#fafafa', eyes: 'squint', mouth: 'teeth', line: '#333' });
        // salad on the table, as is tradition
        ell(ctx, 0, s * 0.62, s * 0.5, s * 0.14, '#fff', '#888', 2);
        for (let i = 0; i < 5; i++) ell(ctx, -s * 0.25 + i * s * 0.12, s * 0.56, s * 0.08, s * 0.05, i % 2 ? '#5fb648' : '#8fd36a');
        ell(ctx, s * 0.12, s * 0.54, s * 0.05, s * 0.04, '#e33');
      }, Math.sin(t * 3) * 0.05);
    },
  },
  banana: {
    name: 'Banana Cat',
    draw(ctx, x, y, s, t) {
      at(ctx, x, y, () => {
        // banana suit hood
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.85);
        ctx.quadraticCurveTo(s * 0.7, -s * 0.6, s * 0.62, s * 0.2);
        ctx.quadraticCurveTo(s * 0.5, s * 0.75, 0, s * 0.72);
        ctx.quadraticCurveTo(-s * 0.5, s * 0.75, -s * 0.62, s * 0.2);
        ctx.quadraticCurveTo(-s * 0.7, -s * 0.6, 0, -s * 0.85);
        ctx.fillStyle = '#ffe135';
        ctx.fill();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = '#7a5c00';
        ctx.stroke();
        ctx.fillStyle = '#6b4a12';
        roundRect(ctx, -s * 0.06, -s * 1.0, s * 0.12, s * 0.2, 4);
        ctx.fill();
        at(ctx, 0, s * 0.08, () => catFace(ctx, s * 0.82, { fur: '#e9dfd0', noEars: true, eyes: 'sad', mouth: 'frown', tears: true, muzzle: '#fff' }));
      }, Math.sin(t * 20) * 0.04);
    },
  },
  happy: {
    name: 'Happy Happy Cat',
    draw(ctx, x, y, s, t) {
      const hop = -Math.abs(Math.sin(t * 7)) * s * 0.18;
      at(ctx, x, y + hop, () => catFace(ctx, s, { fur: '#fff', line: '#333', eyes: 'happy', mouth: 'open', cheeks: '#ffb3c6' }));
    },
  },
  nyan: {
    name: 'Nyan Cat',
    draw(ctx, x, y, s, t) {
      at(ctx, x, y, () => {
        const colors = ['#ff1a1a', '#ff9a1a', '#fff21a', '#36ff1a', '#1a9cff', '#7a1aff'];
        const band = s * 0.09;
        for (let seg = 0; seg < 5; seg++) {
          const off = Math.sin(t * 10 + seg) > 0 ? band * 0.4 : -band * 0.4;
          colors.forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.fillRect(-s * 0.45 - (seg + 1) * s * 0.22, -s * 0.27 + i * band + off, s * 0.23, band);
          });
        }
        // legs + tail
        ctx.fillStyle = '#999';
        const leg = Math.sin(t * 16) * s * 0.03;
        for (const lx of [-0.38, -0.2, 0.15, 0.3]) ctx.fillRect(lx * s + leg, s * 0.24, s * 0.08, s * 0.1);
        ctx.fillRect(-s * 0.58, -s * 0.02 + leg, s * 0.15, s * 0.07);
        // poptart
        ctx.fillStyle = '#f5c48a';
        roundRect(ctx, -s * 0.45, -s * 0.3, s * 0.82, s * 0.58, s * 0.08);
        ctx.fill();
        ctx.lineWidth = s * 0.025;
        ctx.strokeStyle = '#111';
        ctx.stroke();
        ctx.fillStyle = '#ff99ff';
        roundRect(ctx, -s * 0.39, -s * 0.24, s * 0.7, s * 0.46, s * 0.06);
        ctx.fill();
        ctx.fillStyle = '#ff3a9a';
        for (const [px, py] of [[-0.3, -0.15], [-0.1, -0.1], [0.1, -0.17], [-0.22, 0.06], [0.0, 0.1], [0.18, 0.02]])
          ctx.fillRect(px * s, py * s, s * 0.04, s * 0.04);
        at(ctx, s * 0.36, s * 0.05, () => catFace(ctx, s * 0.46, { fur: '#999', mouth: 'w', cheeks: '#ff99aa', innerEar: '#999' }));
      });
    },
  },
};

export function drawMeme(ctx, id, x, y, s, t = 0) {
  const m = MEMES[id];
  if (m) m.draw(ctx, x, y, s, t);
}

// Render a meme once into a small <canvas> (for DOM icons).
export function memeIcon(id, size = 56) {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = c.height = size * dpr;
  c.style.width = c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawMeme(ctx, id, size / 2 + (id === 'nyan' ? size * 0.18 : 0), size / 2 + size * 0.06, size * (id === 'nyan' ? 0.5 : 0.62), 0.3);
  return c;
}
