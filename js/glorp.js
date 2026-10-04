// Claw Simulator on its own page (glorp/), full screen. Linked from the arcade hub.
import { mount, arcadeUrl } from './games/sim/index.js';
import { isMuted, toggleMuted, unlockAudio, sfx } from './audio.js';
import { isTouchDevice } from './games/sim/controls.js';

document.body.classList.toggle('touch', isTouchDevice());

const mute = document.getElementById('mute');
function paintMute() {
  mute.textContent = isMuted() ? '🔇' : '🔊';
  mute.setAttribute('aria-pressed', String(isMuted()));
}
mute.addEventListener('click', () => {
  toggleMuted();
  paintMute();
  if (!isMuted()) sfx.meow();
});
paintMute();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// way back to the arcade; hidden while the mouse is locked to the game
const back = document.getElementById('to-arcade');
back.href = arcadeUrl();
document.addEventListener('pointerlockchange', () => document.body.classList.toggle('locked', !!document.pointerLockElement));

mount(document.getElementById('glorp'), { fullscreen: true });
