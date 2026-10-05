// DOM heads-up display layered over the 3D canvas.
export function createHud(wrap, { onMenu, onQuests, onMusic, touch = false }) {
  const el = document.createElement('div');
  el.className = 'sim-hud';
  el.innerHTML = `
    <div class="sim-score"><b class="pts">0</b><span class="label">GLORP POINTS</span><span class="coins">🪙 0</span><span class="loan" hidden></span><span class="combo"></span></div>
    <button type="button" class="sim-prompt"></button>
    <div class="sim-top-right">
      <button type="button" class="sim-chip trophies">🏆 0</button>
      <button type="button" class="sim-chip music" aria-label="Toggle music">♪ ON</button>
      <button type="button" class="sim-chip menu" aria-label="Menu">☰</button>
    </div>
    <div class="sim-popups"></div>
    <div class="sim-banner"></div>
    <canvas class="sim-map" width="260" height="260" aria-hidden="true"></canvas>
    <div class="sim-timer"></div>
    <div class="sim-energy"><span></span><i>3AM ENERGY</i></div>
    <div class="sim-hint"></div>
    <div class="sim-say"><b></b><span></span></div>
    ${touch ? '' : '<div class="sim-keys"><kbd>P</kbd> menu <kbd>J</kbd> quests <kbd>H</kbd> controls</div>'}
    <div class="sim-invite"><p></p><div><button type="button" class="btn small primary yes"></button><button type="button" class="btn small no"></button></div></div>
  `;
  wrap.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const pts = $('.pts');
  const combo = $('.combo');
  const trophies = $('.trophies');
  const popups = $('.sim-popups');
  const banner = $('.sim-banner');
  const energy = $('.sim-energy span');
  const hint = $('.sim-hint');
  $('.menu').addEventListener('click', onMenu);
  trophies.addEventListener('click', onQuests || onMenu);
  const musicBtn = $('.music');
  musicBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onMusic();
  });

  const coinsEl = $('.coins');
  const prompt = $('.sim-prompt');
  let promptAction = null;
  prompt.addEventListener('click', (e) => {
    e.stopPropagation();
    promptAction?.();
  });
  const timer = $('.sim-timer');
  const mapCanvas = $('.sim-map');
  const mctx = mapCanvas.getContext('2d');
  let mapBg = null;
  let mapBounds = 92;
  const toMap = (v) => ((v + mapBounds) / (2 * mapBounds)) * 260;

  // invites (Hide and Seek, pet battle challenges): Y / N or tap
  const inviteEl = $('.sim-invite');
  let invite = null;
  function closeInvite(answer) {
    const inv = invite;
    if (!inv) return;
    invite = null;
    clearTimeout(inv.timer);
    inviteEl.classList.remove('show');
    if (answer) inv.onYes?.();
    else inv.onNo?.();
  }
  inviteEl.querySelector('.yes').addEventListener('click', (e) => {
    e.stopPropagation();
    closeInvite(true);
  });
  inviteEl.querySelector('.no').addEventListener('click', (e) => {
    e.stopPropagation();
    closeInvite(false);
  });
  function onInviteKey(e) {
    if (!invite || e.repeat || e.target?.tagName === 'INPUT') return;
    if (e.code === 'KeyY') closeInvite(true);
    else if (e.code === 'KeyN') closeInvite(false);
  }
  document.addEventListener('keydown', onInviteKey);

  let bannerTimer = 0;
  let sayTimer = 0;
  let hintTimer = 0;
  let shownScore = 0;

  return {
    setScore(n) {
      if (Math.floor(n) === shownScore) return;
      shownScore = Math.floor(n);
      pts.textContent = shownScore.toLocaleString();
      pts.classList.remove('bump');
      void pts.offsetWidth;
      pts.classList.add('bump');
    },
    setCombo(m) {
      combo.textContent = m > 1 ? `MEWTIPLIER x${m}` : '';
    },
    setMusic(on) {
      musicBtn.textContent = on ? '♪ ON' : '♪ OFF';
      musicBtn.classList.toggle('off', !on);
      musicBtn.setAttribute('aria-pressed', String(on));
    },
    setCoins(n) {
      coinsEl.textContent = `🪙 ${n.toLocaleString()}`;
    },
    // Contextual action button (also triggered by the E key in game.js).
    prompt(text, action) {
      promptAction = action || null;
      if (prompt.textContent !== (text || '')) prompt.textContent = text || '';
      prompt.classList.toggle('show', !!text);
    },
    setTimer(text) {
      timer.textContent = text || '';
      timer.classList.toggle('show', !!text);
    },
    // features: [{ x, z, w, d, color, label }] drawn once; POIs + Claw drawn every update.
    setupMap(bounds, features) {
      mapBounds = bounds;
      mapBg = document.createElement('canvas');
      mapBg.width = mapBg.height = 260;
      const c = mapBg.getContext('2d');
      c.fillStyle = '#4f9a3a';
      c.fillRect(0, 0, 260, 260);
      c.font = "bold 13px 'Comic Neue', sans-serif";
      c.textAlign = 'center';
      for (const f of features) {
        c.fillStyle = f.color;
        const x = toMap(f.x);
        const y = toMap(f.z);
        const w = (f.w / (2 * bounds)) * 260;
        const d = (f.d / (2 * bounds)) * 260;
        if (f.round) {
          c.beginPath();
          c.ellipse(x, y, w / 2, d / 2, 0, 0, Math.PI * 2);
          c.fill();
        } else c.fillRect(x - w / 2, y - d / 2, w, d);
        if (f.label) {
          c.fillStyle = '#fff';
          c.strokeStyle = '#111';
          c.lineWidth = 3;
          c.strokeText(f.label, x, y + 4);
          c.fillText(f.label, x, y + 4);
        }
      }
    },
    // heading: Claw faces world direction (sin h, 0, cos h); map north (-z) is up.
    updateMap(px, pz, heading, pois) {
      if (!mapBg) return;
      mctx.drawImage(mapBg, 0, 0);
      for (const p of pois) {
        mctx.beginPath();
        mctx.arc(toMap(p.x), toMap(p.z), 5, 0, Math.PI * 2);
        mctx.fillStyle = p.color || '#ffe14d';
        mctx.fill();
        mctx.lineWidth = 2;
        mctx.strokeStyle = '#111';
        mctx.stroke();
      }
      const x = toMap(px);
      const y = toMap(pz);
      mctx.save();
      mctx.translate(x, y);
      mctx.rotate(Math.PI - heading);
      mctx.beginPath();
      mctx.moveTo(0, -11);
      mctx.lineTo(7, 8);
      mctx.lineTo(-7, 8);
      mctx.closePath();
      mctx.fillStyle = '#7CFF4F';
      mctx.fill();
      mctx.lineWidth = 2.5;
      mctx.strokeStyle = '#111';
      mctx.stroke();
      mctx.restore();
    },
    setTrophies(done, total) {
      trophies.textContent = `🏆 ${done}/${total}`;
    },
    setEnergy(f) {
      energy.style.width = `${Math.round(f * 100)}%`;
    },
    popup(text, color = '#7CFF4F') {
      const p = document.createElement('div');
      p.className = 'sim-pop';
      p.textContent = text;
      p.style.color = color;
      p.style.setProperty('--rot', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
      popups.appendChild(p);
      while (popups.children.length > 4) popups.firstChild.remove();
      setTimeout(() => p.remove(), 1600);
    },
    banner(title, sub = '', { pog = false } = {}) {
      banner.innerHTML = '';
      const h = document.createElement('b');
      h.textContent = title;
      banner.appendChild(h);
      banner.classList.toggle('pog', pog);
      if (pog) {
        for (const side of ['left', 'right']) {
          const img = document.createElement('img');
          img.src = 'assets/sim-matt.webp';
          img.alt = '';
          img.className = 'sim-pog ' + side;
          banner.appendChild(img);
        }
      }
      if (sub) {
        const s = document.createElement('span');
        s.textContent = sub;
        banner.appendChild(s);
      }
      banner.classList.add('show');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('show'), 3200);
    },
    // NPC dialogue as a subtitle bar near the bottom, so banners never cover it
    say(name, text, { color = '#ff6a8a', ms = 2600 } = {}) {
      const box = $('.sim-say');
      box.querySelector('b').textContent = name;
      box.querySelector('b').style.color = color;
      box.querySelector('span').textContent = text;
      box.classList.add('show');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => box.classList.remove('show'), ms);
    },
    // loan countdown under the coins (null hides it); state: ok | soon | late | collect
    setLoan(text, state = 'ok') {
      const l = $('.loan');
      l.hidden = !text;
      wrap.classList.toggle('loan-on', !!text); // pushes the minimap (and phone feed) down a line
      if (!text) return;
      l.textContent = text;
      l.dataset.state = state;
    },
    invite(text, { yes = 'YES', no = 'NO', ms = 15000, onYes, onNo } = {}) {
      closeInvite(false); // a new invite replaces (declines) the old one
      invite = { onYes, onNo, timer: setTimeout(() => closeInvite(false), ms) };
      inviteEl.querySelector('p').textContent = text;
      inviteEl.querySelector('.yes').textContent = `${yes} (Y)`;
      inviteEl.querySelector('.no').textContent = `${no} (N)`;
      inviteEl.classList.add('show');
    },
    hint(text, ms = 4000) {
      hint.textContent = text;
      hint.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('show'), ms);
    },
    destroy() {
      if (invite) clearTimeout(invite.timer);
      document.removeEventListener('keydown', onInviteKey);
      clearTimeout(sayTimer);
      clearTimeout(bannerTimer);
      clearTimeout(hintTimer);
      el.remove();
    },
  };
}
