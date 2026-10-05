// Replay and speedrun.
// - Reset: wipe quest progress (keep coins, skins and pets) or everything, then reload.
// - Speedrun: your normal save is put aside, you start fresh, and an in-game timer (paused in
//   menus) records a split for every Claw-lenge. Any% ends at the Battle of Ohio, 100% at all
//   Claw-lenges. Personal bests are kept. Ending the run puts your normal save back.
import { read, write, freezeSaves } from '../../scores.js';

const P = 'claw.';
// everything that is "progress" (settings like graphics, music and your name are never touched)
const PROGRESS = ['sim', 'simwallet', 'simarena', 'simbucket', 'simclicky', 'simdaily', 'simfish', 'simloan', 'simtackle', 'simducky'];
const QUESTS = ['sim', 'simclicky', 'simarena', 'simdaily', 'simducky'];

const raw = {
  get: (k) => {
    try {
      return localStorage.getItem(P + k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (v == null) localStorage.removeItem(P + k);
      else localStorage.setItem(P + k, v);
    } catch {
      /* storage blocked */
    }
  },
};

export function fmtTime(s) {
  if (s == null) return '--:--';
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}

export function resetProgress(kind) {
  freezeSaves();
  for (const k of kind === 'all' ? PROGRESS : QUESTS) raw.set(k, null);
  location.reload();
}

export function createSpeedrun({ wrap, hud, sfx, ch, total }) {
  const run = read('speedrun', null); // { on, t, splits:[{id,t}], any, all }
  const pb = read('speedrunPB', { any: null, all: null, splits: [] });
  const el = document.createElement('div');
  el.className = 'sr-timer';
  el.hidden = !run?.on;
  wrap.appendChild(el);
  wrap.classList.toggle('sr-on', !!run?.on);
  let saveT = 0;

  function paint() {
    if (!run?.on) return;
    el.textContent = `🏁 ${fmtTime(run.t)} · ${run.splits.length}/${total}${run.all != null ? ' · DONE' : ''}`;
  }
  paint();

  if (run?.on) {
    ch.onComplete((id) => {
      if (run.all != null) return;
      run.splits.push({ id, t: run.t });
      const i = run.splits.length - 1;
      const best = pb.splits?.[i];
      const diff = best != null ? run.t - best : null;
      hud.popup(`SPLIT ${run.splits.length}/${total} · ${fmtTime(run.t)}${diff != null ? ` (${diff <= 0 ? '-' : '+'}${fmtTime(Math.abs(diff))})` : ''}`, diff != null && diff <= 0 ? '#7CFF4F' : '#ffe14d');
      if (id === 'kaiju' && run.any == null) {
        run.any = run.t;
        const isPB = pb.any == null || run.t < pb.any;
        if (isPB) pb.any = run.t;
        setTimeout(() => hud.banner(isPB ? 'NEW ANY% PB!' : 'ANY% FINISHED', `Battle of Ohio survived in ${fmtTime(run.t)}`, { pog: isPB }), 3500);
      }
      if (run.splits.length >= total) {
        run.all = run.t;
        const isPB = pb.all == null || run.t < pb.all;
        if (isPB) {
          pb.all = run.t;
          pb.splits = run.splits.map((s) => s.t);
        }
        sfx.win();
        setTimeout(() => hud.banner(isPB ? 'NEW 100% PB!' : 'RUN COMPLETE', `All ${total} Claw-lenges in ${fmtTime(run.t)}`, { pog: true }), 4200);
      }
      write('speedrunPB', pb);
      write('speedrun', run);
      paint();
    });
  }

  function begin() {
    // put the normal save aside (only once: restarting a run keeps the original backup)
    if (!run?.on) {
      const backup = {};
      for (const k of PROGRESS) backup[k] = raw.get(k);
      backup.simonline = raw.get('simonline');
      write('speedrunBackup', backup);
    }
    for (const k of PROGRESS) raw.set(k, null);
    raw.set('simonline', 'false'); // runs are solo
    write('speedrun', { on: true, t: 0, splits: [], any: null, all: null });
    freezeSaves();
    location.reload();
  }
  function end() {
    const backup = read('speedrunBackup', null);
    run.on = false; // (so a last autosave can't write the run back)
    for (const k of PROGRESS) raw.set(k, null);
    if (backup) {
      for (const k of PROGRESS) raw.set(k, backup[k]);
      raw.set('simonline', backup.simonline);
    }
    raw.set('speedrun', null);
    raw.set('speedrunBackup', null);
    freezeSaves();
    location.reload();
  }

  return {
    get running() {
      return !!run?.on;
    },
    // in-game time: only while actually playing
    update(dt, active) {
      if (!run?.on || !active || run.all != null) return;
      run.t += dt;
      paint();
      saveT -= dt;
      if (saveT <= 0) {
        saveT = 2;
        write('speedrun', run);
      }
    },
    save() {
      if (run?.on) write('speedrun', run);
    },
    // the menu panel
    panel({ onReset }) {
      const root = document.createElement('div');
      root.className = 'casino speedrun';
      const add = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        root.appendChild(e);
        return e;
      };
      const btn = (label, fn, primary = true) => {
        const b = add('button', `btn ${primary ? 'primary' : ''}`, label);
        b.type = 'button';
        b.addEventListener('click', fn);
        return b;
      };
      // two-click confirm for anything destructive
      const confirmBtn = (label, sure, fn, primary = false) => {
        const b = btn(label, () => {
          if (b.dataset.armed) return fn();
          b.dataset.armed = '1';
          b.textContent = sure;
          b.classList.add('danger');
          setTimeout(() => {
            delete b.dataset.armed;
            b.textContent = label;
            b.classList.remove('danger');
          }, 4000);
        }, primary);
        return b;
      };
      add('h3', null, '🏁 Speedrun');
      add('p', 'sr-pb', `PB Any% (Battle of Ohio): ${fmtTime(pb.any)} · PB 100% (all ${total}): ${fmtTime(pb.all)}`);
      if (run?.on) {
        add('p', 'slot-result', `Run time ${fmtTime(run.t)} · ${run.splits.length}/${total} splits`);
        if (run.splits.length) {
          const ol = add('ol', 'sr-splits');
          run.splits.slice(-8).forEach((sp) => {
            const li = document.createElement('li');
            const c = ch.CHALLENGES.find((x) => x.id === sp.id);
            li.textContent = `${fmtTime(sp.t)}  ${c ? c.name : sp.id}`;
            ol.appendChild(li);
          });
        }
        confirmBtn('🔁 Restart run', 'Sure? Click again', begin, true);
        confirmBtn('⏹ End run (restore my normal save)', 'Sure? Click again', end);
      } else {
        add('p', 'fine', 'Start fresh with a timer. Your normal save is put aside and comes back when you end the run. The timer pauses while menus are open. Splits for every Claw-lenge; Any% ends when you survive the Battle of Ohio, 100% when you finish them all. Runs are played offline.');
        confirmBtn('🏁 START A SPEEDRUN', 'Click again to start', begin, true);
      }
      add('h3', null, '♻️ Reset progress');
      if (run?.on) add('p', 'fine', 'During a run, use Restart run instead.');
      else {
        add('p', 'fine', 'Replay the game from the start. Settings (graphics, music, your name) are kept.');
        confirmBtn('Reset quests (keep coins, skins & pets)', 'Sure? Click again', () => onReset('quests'));
        confirmBtn('Reset EVERYTHING', 'Really everything? Click again', () => onReset('all'));
      }
      return root;
    },
    dispose() {
      this.save();
      el.remove();
    },
  };
}
