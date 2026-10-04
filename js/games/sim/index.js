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
      const msg = String(err && err.message ? err.message : err);
      // Opened mid-update: the new page arrived before all the new files did. Reload once and it's fine.
      const loadFail = /dynamically imported module|importing a module script failed|failed to fetch/i.test(msg);
      let last = 0;
      try {
        last = +sessionStorage.getItem('claw.simretry') || 0;
      } catch {
        /* storage blocked */
      }
      if (loadFail && Date.now() - last > 60000) {
        try {
          sessionStorage.setItem('claw.simretry', String(Date.now()));
        } catch {
          /* storage blocked */
        }
        status.textContent = 'Ohio just got an update. Reloading…';
        setTimeout(() => location.reload(), 1500);
        return;
      }
      showOverlay(wrap, {
        title: 'GLORP MALFUNCTION',
        text: loadFail ? ['Part of Ohio failed to download (probably a fresh update still rolling out).', 'Wait a minute and try again.', msg] : ['Claw Simulator needs WebGL and a modern browser.', msg],
        buttons: [
          ...(loadFail ? [{ label: 'Try again', primary: true, onClick: () => location.reload() }] : []),
          { label: 'Back to arcade', primary: !loadFail, onClick: exitToArcade },
        ],
      });
    });

  return () => {
    cancelled = true;
    if (game) game.dispose();
    wrap.remove();
  };
}
