// Entry for CLAW SIMULATOR (glorp/). three.js + Rapier load only when this page opens.
import { showOverlay } from '../../engine.js';

export const meta = { id: 'sim', title: 'Claw Simulator' };

// The arcade hub sits one folder up from glorp/. Works for /claw/glorp/, /claw/glorp and /claw/glorp/index.html.
export const arcadeUrl = () => location.origin + location.pathname.replace(/glorp(\/(index\.html)?)?$/, '');

export function mount(el, { fullscreen = false } = {}) {
  const exitToArcade = () => (location.href = arcadeUrl());
  const wrap = document.createElement('div');
  wrap.className = 'sim-wrap';
  el.appendChild(wrap);
  wrap.style.height = Math.max(320, window.innerHeight - wrap.getBoundingClientRect().top - (fullscreen ? 0 : 8)) + 'px';

  let cancelled = false;
  let game = null;
  const status = document.createElement('p');
  status.className = 'sim-status';
  status.textContent = 'Loading glorp...';
  showOverlay(wrap, { title: 'CLAW SIMULATOR', img: 'assets/sim-dance.webp', extra: status, buttons: [] });

  import('./game.js')
    .then((m) =>
      m.startGame(wrap, {
        onStatus: (s) => (status.textContent = s),
        isCancelled: () => cancelled,
        fullscreen,
        exitToArcade,
      })
    )
    .then((g) => {
      if (!g) return;
      if (cancelled) {
        g.dispose();
        return;
      }
      game = g;
      // multiplayer: pick a name for the shared Ohio
      let nameInput = null;
      if (g.mp) {
        nameInput = document.createElement('input');
        nameInput.className = 'mp-name';
        nameInput.maxLength = 20;
        nameInput.value = g.name;
        nameInput.setAttribute('aria-label', 'Your name in the shared Ohio');
        nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && g.start(nameInput.value, g.wantsOnline));
      }
      showOverlay(wrap, {
        title: 'CLAW SIMULATOR',
        img: 'assets/sim-dance.webp',
        text: [
          'You are Claw. Cause chaos. Knock things off tables. Boil yourself.',
          g.touch
            ? 'Left stick moves, drag to look. Buttons: JUMP (x2), BONK, LICK, FLOP, ZOOM.'
            : 'WASD move, mouse look. Space jump (x2), F bonk, E lick, R flop, Shift zoomies, P menu.',
          'Finish Claw-lenges to unlock mutators.',
          ...(g.mp ? ['Play online in the shared Ohio with your friends (T to chat), or offline on your own. Same progress either way. Your name:'] : []),
        ],
        extra: nameInput,
        buttons: g.mp
          ? [
              { label: '🌐 PLAY ONLINE', primary: g.wantsOnline, onClick: () => g.start(nameInput.value, true) },
              { label: '🎮 PLAY OFFLINE', primary: !g.wantsOnline, onClick: () => g.start(nameInput.value, false) },
            ]
          : [{ label: 'START GLORPING', primary: true, onClick: () => g.start() }],
      });
    })
    .catch((err) => {
      console.error(err);
      if (cancelled) return;
      showOverlay(wrap, {
        title: 'GLORP MALFUNCTION',
        text: ['Claw Simulator needs WebGL and a modern browser.', String(err && err.message ? err.message : err)],
        buttons: [{ label: 'Back to arcade', primary: true, onClick: exitToArcade }],
      });
    });

  return () => {
    cancelled = true;
    if (game) game.dispose();
    wrap.remove();
  };
}
