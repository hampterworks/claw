// Entry for CLAW SIMULATOR. three.js + Rapier load only when this route opens.
import { showOverlay } from '../../engine.js';

export const meta = { id: 'sim', title: 'Claw Simulator' };

export function mount(el, { fullscreen = false } = {}) {
  const exitToArcade = () => (location.href = new URL('./', document.baseURI).href);
  const wrap = document.createElement('div');
  wrap.className = 'sim-wrap';
  el.appendChild(wrap);
  wrap.style.height = Math.max(320, window.innerHeight - wrap.getBoundingClientRect().top - (fullscreen ? 0 : 8)) + 'px';

  let cancelled = false;
  let game = null;
  const status = document.createElement('p');
  status.className = 'sim-status';
  status.textContent = 'Loading glorp...';
  showOverlay(wrap, { title: 'CLAW SIMULATOR', img: 'assets/sim-dance.png', extra: status, buttons: [] });

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
      showOverlay(wrap, {
        title: 'CLAW SIMULATOR',
        img: 'assets/sim-dance.png',
        text: [
          'You are Claw. Cause chaos. Knock things off tables. Boil yourself.',
          g.touch
            ? 'Left stick moves, drag to look. Buttons: JUMP (x2), BONK, LICK, FLOP, ZOOM.'
            : 'WASD move, mouse look. Space jump (x2), F bonk, E lick, R flop, Shift zoomies, P menu.',
          'Finish Claw-lenges to unlock mutators.',
        ],
        buttons: [{ label: 'START GLORPING', primary: true, onClick: g.start }],
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
