// Input: keyboard + mouse (pointer lock or drag-to-look) and touch
// (virtual joystick on the left, drag-to-look anywhere else, action buttons).

export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export function createControls(wrap, canvas, { touch, onMenu, onMusic, onChat }) {
  const keys = new Set();
  const s = {
    lookX: 0,
    lookY: 0,
    jump: false,
    bonk: false,
    lick: false,
    flop: false,
    zoomTouch: false,
    stick: { x: 0, y: 0 },
  };
  let enabled = false;

  const KEYMAP = {
    Space: 'jump',
    KeyF: 'bonk',
    KeyE: 'lick',
    KeyR: 'flop',
  };

  function onKeyDown(e) {
    if (!enabled) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if ((e.code === 'KeyT' || e.code === 'Enter') && onChat && !e.repeat) {
      e.preventDefault();
      keys.clear();
      onChat();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Tab') {
      e.preventDefault();
      onMenu();
      return;
    }
    if (e.code === 'KeyM' && !e.repeat) {
      onMusic?.();
      return;
    }
    if (KEYMAP[e.code] && !e.repeat) s[KEYMAP[e.code]] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onBlur() {
    keys.clear();
  }

  // ---- mouse ----
  let dragging = null;
  function locked() {
    return document.pointerLockElement === canvas;
  }
  function onMouseMove(e) {
    if (!enabled) return;
    if (locked()) {
      s.lookX += e.movementX;
      s.lookY += e.movementY;
    }
  }
  function onMouseDown(e) {
    if (!enabled || touch) return;
    if (locked()) {
      if (e.button === 0) s.bonk = true;
      if (e.button === 2) s.lick = true;
    }
  }
  function onClickCanvas() {
    if (!enabled || touch || locked()) return;
    canvas.requestPointerLock?.()?.catch?.(() => {});
  }

  // ---- pointer drag look (touch, or mouse without lock) ----
  function onPointerDown(e) {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && locked()) return;
    if (dragging) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    const k = e.pointerType === 'touch' ? 1.6 : 1;
    s.lookX += (e.clientX - dragging.x) * k;
    s.lookY += (e.clientY - dragging.y) * k;
    dragging.x = e.clientX;
    dragging.y = e.clientY;
  }
  function onPointerUp(e) {
    if (dragging && e.pointerId === dragging.id) dragging = null;
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('click', onClickCanvas);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // ---- touch UI ----
  const ui = document.createElement('div');
  ui.className = 'sim-touch';
  if (touch) {
    ui.innerHTML = `
      <div class="sim-stick"><div class="sim-knob"></div></div>
      <div class="sim-buttons">
        <button type="button" data-act="flop">FLOP</button>
        <button type="button" data-act="lick">LICK</button>
        <button type="button" data-act="zoom">ZOOM</button>
        <button type="button" data-act="bonk">BONK</button>
        <button type="button" data-act="jump" class="big">JUMP</button>
      </div>`;
    wrap.appendChild(ui);
    const stick = ui.querySelector('.sim-stick');
    const knob = ui.querySelector('.sim-knob');
    let stickId = null;
    let cx = 0;
    let cy = 0;
    const R = 50;
    const moveStick = (e) => {
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx *= R / d;
        dy *= R / d;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      s.stick.x = dx / R;
      s.stick.y = -dy / R;
    };
    stick.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      stickId = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      stick.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    stick.addEventListener('pointermove', (e) => e.pointerId === stickId && moveStick(e));
    const release = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      s.stick.x = s.stick.y = 0;
      knob.style.transform = '';
    };
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);
    ui.querySelectorAll('.sim-buttons button').forEach((b) => {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!enabled) return;
        if (act === 'zoom') s.zoomTouch = true;
        else s[act] = true;
        b.classList.add('down');
      });
      const up = () => {
        if (act === 'zoom') s.zoomTouch = false;
        b.classList.remove('down');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
  }

  return {
    setEnabled(v) {
      enabled = v;
      if (!v) {
        keys.clear();
        dragging = null;
        s.zoomTouch = false;
        s.stick.x = s.stick.y = 0;
        if (locked()) document.exitPointerLock();
      }
    },
    requestLock() {
      if (!touch) canvas.requestPointerLock?.()?.catch?.(() => {});
    },
    isLocked: locked,
    // Snapshot of this frame's input; one-shot actions and look deltas reset.
    consume() {
      let mx = s.stick.x;
      let my = s.stick.y;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      const len = Math.hypot(mx, my);
      if (len > 1) {
        mx /= len;
        my /= len;
      }
      const out = {
        moveX: mx,
        moveY: my,
        lookX: s.lookX,
        lookY: s.lookY,
        jump: s.jump,
        bonk: s.bonk,
        lick: s.lick,
        flop: s.flop,
        zoom: s.zoomTouch || keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
      s.lookX = s.lookY = 0;
      s.jump = s.bonk = s.lick = s.flop = false;
      return out;
    },
    destroy() {
      if (locked()) document.exitPointerLock();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      ui.remove();
    },
  };
}
