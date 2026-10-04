// Canvas-made textures: meme cats (from the 2D arcade's drawings), signs, yarn.
import * as THREE from 'three';
import { drawMeme } from '../../cats.js';

const loader = new THREE.TextureLoader();

export function loadTexture(url) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        resolve(t);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function canvasTexture(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  paint(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A meme cat on a cardboard-cutout background.
export function memeStandeeTexture(id) {
  return canvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#e9c9a0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a07a50';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    drawMeme(ctx, id, w / 2 + (id === 'nyan' ? 40 : 0), h / 2 + 10, id === 'nyan' ? 120 : 170, 0.3);
  });
}

export function signTexture(lines, o = {}) {
  const w = o.w || 512;
  const h = o.h || 256;
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = o.bg || '#1d0b33';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = o.border || '#7CFF4F';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = o.size || 70;
    lines.forEach((line, i) => {
      const y = h / 2 + (i - (lines.length - 1) / 2) * size * 1.1;
      ctx.font = `${size}px 'Bangers', Impact, 'Arial Black', sans-serif`;
      ctx.lineWidth = size / 7;
      ctx.strokeStyle = '#111';
      ctx.strokeText(line, w / 2, y);
      ctx.fillStyle = (o.colors && o.colors[i]) || o.color || '#7CFF4F';
      ctx.fillText(line, w / 2, y);
    });
  });
}

export function yarnTexture(color) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 4;
    for (let i = -h; i < w + h; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h * 0.6, h);
      ctx.stroke();
    }
  });
}

// Glorp Cat News TV: the news meme on the left, scrolling ticker at the bottom.
// Returns { texture, update(t, live) }.
export function newsTexture(newsImg, liveImg, mattImg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 288;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const headlines = [
    'BREAKING: CLAW REFUSES TO BE BOILED',
    'LOCAL CAT KNOCKS 400 MUGS OFF TABLE',
    'SCIENTISTS CONFIRM: GLORP',
    'OHIO DECLARES STATE OF ZOOMIES',
    'MAXWELL STILL SPINNING, EXPERTS BAFFLED',
    'SOUP PRICES SOAR AFTER CLAW SIGHTING',
  ];
  const ticker = headlines.join('   ★   ') + '   ★   ';
  let last = -1;
  function update(t, live) {
    const frame = Math.floor(t * 20);
    if (frame === last) return;
    last = frame;
    ctx.fillStyle = '#0b1a3a';
    ctx.fillRect(0, 0, 512, 288);
    const img = live && liveImg ? liveImg : newsImg;
    if (img) {
      const ih = 232;
      const iw = (img.width / img.height) * ih;
      ctx.drawImage(img, live ? 256 - iw / 2 : 18, 8, iw, ih);
    }
    ctx.textAlign = 'left';
    ctx.font = "34px 'Bangers', Impact, sans-serif";
    ctx.fillStyle = '#ff4f6d';
    if (live) {
      if (Math.sin(t * 6) > 0) ctx.fillText('● LIVE', 18, 36);
      ctx.fillStyle = '#7CFF4F';
      ctx.textAlign = 'center';
      ctx.font = "30px 'Bangers', Impact, sans-serif";
      ctx.fillText('CLAW IS ON TV RIGHT NOW', 256, 225);
      if (mattImg) {
        // reaction cam
        ctx.fillStyle = '#111';
        ctx.fillRect(392, 96, 112, 132);
        ctx.drawImage(mattImg, 396, 100, 104, 104);
        ctx.fillStyle = '#ffe14d';
        ctx.font = "18px 'Bangers', Impact, sans-serif";
        ctx.fillText('MATT REACTS', 448, 220);
      }
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = "40px 'Bangers', Impact, sans-serif";
      ctx.fillText('GLORP', 300, 80);
      ctx.fillText('CAT NEWS', 300, 124);
      ctx.fillStyle = '#5ff2ff';
      ctx.font = "22px 'Bangers', Impact, sans-serif";
      ctx.fillText('24/7 glorp coverage', 300, 160);
    }
    ctx.fillStyle = '#e8102c';
    ctx.fillRect(0, 244, 512, 44);
    ctx.fillStyle = '#fff';
    ctx.font = "28px 'Bangers', Impact, sans-serif";
    ctx.textAlign = 'left';
    const tw = ctx.measureText(ticker).width;
    const x = -((t * 90) % tw);
    ctx.fillText(ticker, x, 275);
    ctx.fillText(ticker, x + tw, 275);
    tex.needsUpdate = true;
  }
  return { texture: tex, update };
}

// Meme cat on a transparent background, for billboard NPCs.
export function memeSpriteTexture(id) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    drawMeme(ctx, id, w / 2 + (id === 'nyan' ? 40 : 0), h / 2 + 18, id === 'nyan' ? 120 : 170, 0.3);
  });
}

// Floating quest marker.
export function markerTexture(char = '!') {
  return canvasTexture(128, 128, (ctx) => {
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe14d';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.font = "84px 'Bangers', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(char, 64, 70);
  });
}

// Sisal rope wrapping for the giant cat tree.
export function ropeTexture() {
  const t = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c9a66b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(90,60,20,0.45)';
    ctx.lineWidth = 5;
    for (let y = 0; y < h; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + 4);
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 12);
  return t;
}

export function checkerTexture() {
  return canvasTexture(256, 64, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) {
      ctx.fillStyle = (x / 16 + y / 16) % 2 ? '#111' : '#fff';
      ctx.fillRect(x, y, 16, 16);
    }
  });
}
