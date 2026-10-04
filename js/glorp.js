// The secret page: Claw Simulator on its own, full screen. Not linked from the arcade.
import { mount } from './games/sim/index.js';
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

mount(document.getElementById('glorp'), { fullscreen: true });
