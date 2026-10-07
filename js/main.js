// Hub + hash router. Each game module exports `meta` and `mount(el) -> cleanup`.
import { loadImages, images } from './engine.js';
import { drawMeme, memeIcon } from './cats.js';
import { best, stat } from './scores.js';
import { isMuted, toggleMuted, unlockAudio, sfx } from './audio.js';
import * as boil from './games/boil.js';
import * as flappy from './games/flappy.js';
import * as whack from './games/whack.js';
import * as aura from './games/aura.js';
import * as tower from './games/tower.js';
import { isHalloween } from './season.js';

const GAMES = { boil, flappy, whack, aura, tower };

// Spooktober: swap in the Halloween palette and copy
if (isHalloween()) {
  document.body.classList.add('spooky');
  for (const el of document.querySelectorAll('[data-spooky]')) el.textContent = el.dataset.spooky;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0c0612');
}

const $ = (sel) => document.querySelector(sel);
const hub = $('#hub');
const stage = $('#stage');
const body = $('#stage-body');
const title = $('#stage-title');
const mute = $('#mute');

let cleanup = null;

function route() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  body.innerHTML = '';
  const game = GAMES[location.hash.slice(1)];
  if (game) {
    stopCouncil();
    hub.hidden = true;
    stage.hidden = false;
    body.dataset.game = game.meta.id;
    title.textContent = game.meta.title;
    document.title = `${game.meta.title} · We Will Boil The Claw`;
    window.scrollTo(0, 0);
    cleanup = game.mount(body);
  } else {
    stage.hidden = true;
    hub.hidden = false;
    document.title = 'We Will Boil The Claw';
    refreshHub();
    startCouncil();
  }
}

function refreshHub() {
  $('#boil-count').textContent = stat('boiled');
  $('#dunk-count').textContent = stat('dunks');
  document.querySelectorAll('[data-best]').forEach((el) => {
    const id = el.dataset.best;
    const b = best(id);
    el.textContent = b ? `Best: ${id === 'aura' ? aura.fmt(b) + ' aura' : b}` : 'Not played yet';
  });
}

// ---------- the cat council parade on the hub ----------
const council = $('#council');
const cctx = council.getContext('2d');
const PARADE = ['popcat', 'claw-leaf', 'maxwell', 'oiia', 'nyan', 'claw-alien', 'happy', 'huh', 'banana', 'smudge', 'claw-stand', 'grumpy'];
let councilRaf = 0;
let councilStart = 0;

function drawCouncil(now) {
  councilRaf = requestAnimationFrame(drawCouncil);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = council.clientWidth;
  const h = council.clientHeight;
  if (council.width !== Math.floor(w * dpr)) {
    council.width = Math.floor(w * dpr);
    council.height = Math.floor(h * dpr);
  }
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cctx.clearRect(0, 0, w, h);
  const t = (now - councilStart) / 1000;
  const gap = 96;
  const span = PARADE.length * gap;
  PARADE.forEach((id, i) => {
    const x = ((i * gap - t * 50) % span + span) % span - gap / 2;
    if (x > w + gap) return;
    const y = h / 2 + 6 + Math.sin(t * 4 + i) * 6;
    if (id.startsWith('claw-')) {
      const img = images[id.slice(5)];
      if (!img) return;
      const ih = id === 'claw-stand' ? 84 : 66;
      const iw = (img.width / img.height) * ih;
      cctx.drawImage(img, x - iw / 2, y - ih / 2, iw, ih);
    } else {
      drawMeme(cctx, id, x, y, id === 'nyan' ? 44 : 54, t + i);
    }
  });
}

function startCouncil() {
  if (councilRaf) return;
  councilStart = performance.now();
  councilRaf = requestAnimationFrame(drawCouncil);
}

function stopCouncil() {
  cancelAnimationFrame(councilRaf);
  councilRaf = 0;
}

// ---------- sound toggle ----------
function paintMute() {
  mute.textContent = isMuted() ? '🔇' : '🔊';
  mute.setAttribute('aria-pressed', String(isMuted()));
}
mute.addEventListener('click', () => {
  toggleMuted();
  paintMute();
  if (!isMuted()) sfx.ding();
});
paintMute();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

$('#aura-icon').appendChild(memeIcon('oiia', 96));

await loadImages({
  leaf: 'assets/claw-leaf.webp',
  alien: 'assets/claw-alien.webp',
  stand: 'assets/claw-stand.webp',
});
window.addEventListener('hashchange', route);
route();
