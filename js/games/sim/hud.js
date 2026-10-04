// DOM heads-up display layered over the 3D canvas.
export function createHud(wrap, { onMenu }) {
  const el = document.createElement('div');
  el.className = 'sim-hud';
  el.innerHTML = `
    <div class="sim-score"><b class="pts">0</b><span class="label">GLORP POINTS</span><span class="combo"></span></div>
    <div class="sim-top-right">
      <button type="button" class="sim-chip trophies">🏆 0/10</button>
      <button type="button" class="sim-chip menu" aria-label="Menu">☰</button>
    </div>
    <div class="sim-popups"></div>
    <div class="sim-banner"></div>
    <div class="sim-energy"><span></span><i>3AM ENERGY</i></div>
    <div class="sim-hint"></div>
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
  trophies.addEventListener('click', onMenu);

  let bannerTimer = 0;
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
    banner(title, sub = '') {
      banner.innerHTML = '';
      const h = document.createElement('b');
      h.textContent = title;
      banner.appendChild(h);
      if (sub) {
        const s = document.createElement('span');
        s.textContent = sub;
        banner.appendChild(s);
      }
      banner.classList.add('show');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('show'), 3200);
    },
    hint(text, ms = 4000) {
      hint.textContent = text;
      hint.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('show'), ms);
    },
    destroy() {
      clearTimeout(bannerTimer);
      clearTimeout(hintTimer);
      el.remove();
    },
  };
}
