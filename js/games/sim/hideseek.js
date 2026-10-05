// Hide and Seek in Glorp Park (start it at the noticeboard by the Hedge Maze).
// Online: everyone in Ohio gets an invite. The server picks a seeker, who is blindfolded for
// 25 seconds while the others hide inside the park. Seekers bonk hiders to find them, and found
// hiders become seekers. Anyone still hidden when the 2:30 runs out wins.
// Offline (or any time): Hampter Hunt. Six hampters hide around the park. Find them all.
import * as THREE from 'three';
import { trackDaily } from './daily.js';
import { HS_ZONE } from './park.js';
import { makeHamster } from './hampter.js';

const HUNT_N = 6;
const HUNT_TIME = 150;
const OUT_GRACE = 5; // seconds outside the park before it counts
const PRIZE = { tag: 50, survive: 200, seekWin: 150, play: 20, hunt: 25, huntAll: 150 };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function createHideSeek({ scene, wrap, claw, hud, sfx, ch, wallet, net, players, park, feed, onFx, closePanel }) {
  // the edge of the play area, drawn on the ground while a game is on
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(HS_ZONE.r - 0.35, HS_ZONE.r + 0.35, 160),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#7CFF4F').multiplyScalar(1.4), transparent: true, opacity: 0.55, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(HS_ZONE.x, 0.07, HS_ZONE.z);
  ring.visible = false;
  scene.add(ring);

  const blind = document.createElement('div');
  blind.className = 'hs-blind';
  blind.innerHTML = '<b>YOU ARE THE SEEKER</b><span>Eyes closed. Count with Winty…</span><big></big><small>Then bonk every Claw you find. Found Claws join your team.</small>';
  blind.hidden = true;
  wrap.appendChild(blind);

  let myId = null;
  let round = null; // the server's snapshot
  let offset = 0; // server clock - our clock
  let ticked = '';
  let outT = 0;
  let outWarn = 0;
  let hunt = null;
  let tagT = 0;
  const now = () => Date.now() + offset;
  const nameOf = (id) => (id === myId ? 'You' : players?.nameOf(id) || 'Someone');
  const inRound = () => !!round && !!myId && round.ids.includes(myId);
  const amSeeker = () => inRound() && round.seekers.includes(myId);
  const zoneDist = (p) => Math.hypot(p.x - HS_ZONE.x, p.z - HS_ZONE.z);

  function toBoard(spread) {
    const b = park.hsBoard;
    const a = Math.random() * Math.PI * 2;
    claw.setFlop?.(false);
    claw.teleport(b.x - 1.5 + Math.cos(a) * spread, 1, b.z + Math.sin(a) * spread);
  }

  // ---------- online rounds ----------
  function refreshTags() {
    if (!players) return;
    for (const r of players.remotes.values()) {
      const playing = round?.phase === 'play' && round.ids.includes(r.id);
      players.setBadge(r.id, playing && round.seekers.includes(r.id) ? '👁️ SEEKER' : null);
    }
    // seekers can't see hiders' name tags (or their pets)
    players.setTagFilter((id) => round?.phase === 'play' && amSeeker() && round.ids.includes(id) && !round.seekers.includes(id));
  }

  function onHs(m) {
    offset = m.now - Date.now();
    round = m.s;
    ticked = '';
    switch (m.ev) {
      case 'open':
        if (m.by === myId) hud.banner('HIDE AND SEEK', 'Waiting 20 seconds for players to join…');
        else {
          feed(`${nameOf(m.by)} started Hide and Seek in Glorp Park 🙈`, '#7CFF4F');
          hud.invite(`🙈 ${nameOf(m.by)} started HIDE AND SEEK`, {
            yes: 'JOIN',
            no: 'NAH',
            ms: Math.max(3000, round.lobbyEnd - now()),
            onYes: () => net.send({ t: 'hs', a: 'join' }),
          });
        }
        break;
      case 'join':
        if (m.by === myId) hud.popup('YOU JOINED HIDE AND SEEK', '#7CFF4F');
        else feed(`${nameOf(m.by)} joined Hide and Seek (${round.ids.length})`, '#7CFF4F');
        break;
      case 'begin':
        feed(`${nameOf(m.seeker)} ${m.seeker === myId ? 'are' : 'is'} the seeker 👁️`, '#ff7bf2');
        if (inRound()) {
          stopHunt(null);
          if (m.seeker === myId) {
            toBoard(0.5);
            sfx.boom();
          } else {
            toBoard(3);
            sfx.ding();
            hud.banner('HIDE!', `${nameOf(m.seeker)} is the seeker. Hide anywhere inside the green ring. 25 seconds!`);
          }
        }
        break;
      case 'tag':
        if (m.who === myId) {
          sfx.fail();
          hud.banner(m.by ? `${nameOf(m.by).toUpperCase()} FOUND YOU` : 'YOU LEFT THE PARK', "You're a seeker now. Find the rest!");
        } else if (m.by === myId) {
          sfx.win();
          wallet.add(PRIZE.tag);
          hud.popup(`FOUND ${nameOf(m.who).toUpperCase()}! +${PRIZE.tag} 🪙`, '#ffe14d');
        }
        feed(m.by ? `${nameOf(m.by)} found ${nameOf(m.who)} 👁️` : `${nameOf(m.who)} left the park (found)`, '#ff7bf2');
        break;
      case 'end':
        endRound(m);
        break;
    }
    refreshTags();
  }

  function endRound(m) {
    const was = m.ids?.includes(myId);
    round = null;
    blind.hidden = true;
    hud.setTimer(null);
    refreshTags();
    if (!m.win) {
      if (was) hud.banner('HIDE AND SEEK CANCELLED', m.why || '');
      return;
    }
    const hidersLeft = (m.ids || []).filter((id) => !m.seekers.includes(id));
    feed(m.win === 'hiders' ? `Hide and Seek: ${hidersLeft.map(nameOf).join(', ')} stayed hidden 🙈` : 'Hide and Seek: the seekers found everyone 👁️', '#ffe14d');
    if (!was) return;
    let prize = PRIZE.play;
    let title;
    if (m.win === 'hiders' && hidersLeft.includes(myId)) {
      prize += PRIZE.survive;
      title = 'YOU STAYED HIDDEN!';
      onFx?.('won Hide and Seek 🙈');
    } else if (m.win === 'seekers' && m.first === myId) {
      prize += PRIZE.seekWin;
      title = 'YOU FOUND EVERYONE!';
      onFx?.('found everyone in Hide and Seek 👁️');
    } else title = m.win === 'hiders' ? 'THE HIDERS WIN' : 'THE SEEKERS WIN';
    wallet.add(prize);
    if (prize > PRIZE.play) sfx.win();
    hud.banner(title, `+${prize} Glorp Coins`, { pog: prize > PRIZE.play });
  }

  function updateRound(dt) {
    if (!round) return;
    const t = now();
    // nudge the server when a deadline passes (its timers only move when messages arrive)
    const due = round.phase === 'lobby' ? round.lobbyEnd : round.end;
    if (t > due + 600 && ticked !== round.phase + due) {
      ticked = round.phase + due;
      net.send({ t: 'hs', a: 'tick' });
    }
    if (t > due + 10000) {
      // the server forgot about this round (e.g. it restarted)
      endRound({ win: null, ids: round.ids });
      return;
    }
    const me = inRound();
    if (round.phase === 'lobby') {
      hud.setTimer(`🙈 HIDE & SEEK IN ${Math.ceil((round.lobbyEnd - t) / 1000)}s · ${round.ids.length} IN${me ? '' : ' · JOIN AT THE MAZE BOARD'}`);
      return;
    }
    if (!me) {
      hud.setTimer(null);
      return;
    }
    const seeker = amSeeker();
    const hiders = round.ids.length - round.seekers.length;
    if (t < round.hideEnd) {
      const s = Math.ceil((round.hideEnd - t) / 1000);
      blind.hidden = !seeker;
      blind.querySelector('big').textContent = s;
      hud.setTimer(seeker ? null : `🙈 HIDE! ${s}s`);
    } else {
      blind.hidden = true;
      hud.setTimer(`${seeker ? '👁️ SEEK' : '🙈 HIDING'} · ${mmss((round.end - t) / 1000)} · ${hiders} HIDDEN`);
    }
    // stay inside the park
    const p = claw.position();
    if (zoneDist(p) > HS_ZONE.r) {
      outT += dt;
      outWarn -= dt;
      if (outWarn <= 0) {
        outWarn = 1;
        hud.popup(`BACK INTO THE PARK! ${Math.max(0, Math.ceil(OUT_GRACE - outT))}`, '#ff4f6d');
      }
      if (outT > OUT_GRACE) {
        outT = 0;
        if (seeker) toBoard(2);
        else net.send({ t: 'hs', a: 'out' });
      }
    } else outT = 0;
  }

  // ---------- Hampter Hunt (solo) ----------
  function startHunt() {
    if (inRound()) return hud.popup('FINISH HIDE AND SEEK FIRST', '#ff4f6d');
    stopHunt(null);
    const spots = [...park.hideSpots].sort(() => Math.random() - 0.5);
    const chosen = [];
    for (const s of spots) {
      if (chosen.every((c) => c.distanceTo(s) > 9)) chosen.push(s);
      if (chosen.length === HUNT_N) break;
    }
    hunt = { left: HUNT_TIME, found: 0, hintT: 20, hams: [] };
    for (const s of chosen) {
      const h = makeHamster();
      h.g.scale.setScalar(0.6);
      h.g.position.copy(s);
      h.g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(h.g);
      hunt.hams.push({ h, pos: s, found: false, hop: 0, phase: Math.random() * 6 });
    }
    sfx.squeak?.();
    hud.banner('HAMPTER HUNT', `${chosen.length} hampters are hiding in Glorp Park (inside the green ring). Find them all in ${mmss(HUNT_TIME)}!`);
  }

  function stopHunt(win) {
    if (!hunt) return;
    for (const hm of hunt.hams) scene.remove(hm.h.g);
    const n = hunt.found;
    const total = hunt.hams.length;
    hunt = null;
    hud.setTimer(null);
    if (win === true) {
      wallet.add(PRIZE.huntAll);
      sfx.win();
      hud.banner('ALL HAMPTERS FOUND', `+${PRIZE.huntAll} bonus Glorp Coins`, { pog: true });
      ch.complete('hunt');
      onFx?.('found every hiding hampter 🐹');
    } else if (win === false) {
      sfx.fail();
      hud.banner('THE HAMPTERS WIN', `You found ${n}/${total}. They were very well hidden (in plain sight).`);
    }
  }

  function updateHunt(dt, t) {
    if (!hunt) return;
    hunt.left -= dt;
    const p = claw.position();
    for (const hm of hunt.hams) {
      if (hm.found) {
        hm.hop += dt;
        hm.h.g.position.y = hm.pos.y + Math.sin(Math.min(1, hm.hop / 0.5) * Math.PI) * 0.8;
        hm.h.g.rotation.y += dt * 12;
        if (hm.hop > 0.5) hm.h.g.visible = false;
        continue;
      }
      // breathing, and the odd peek
      const peek = Math.max(0, Math.sin(t * 0.7 + hm.phase) - 0.85) * 3;
      hm.h.g.position.y = hm.pos.y + peek * 0.12;
      hm.h.g.scale.set(0.6, 0.6 * (1 + Math.sin(t * 3 + hm.phase) * 0.03), 0.6);
      if (Math.hypot(p.x - hm.pos.x, p.z - hm.pos.z) < 1.4 && Math.abs(p.y - hm.pos.y) < 2.2) {
        hm.found = true;
        hunt.found++;
        sfx.squeak?.();
        wallet.add(PRIZE.hunt);
        hud.popup(`HAMPTER ${hunt.found}/${hunt.hams.length} FOUND! +${PRIZE.hunt} 🪙`, '#ffb347');
        trackDaily('huntfind');
      }
    }
    hud.setTimer(`🐹 HAMPTER HUNT · ${hunt.found}/${hunt.hams.length} · ${mmss(hunt.left)}`);
    if (hunt.found === hunt.hams.length) return stopHunt(true);
    if (hunt.left <= 0) return stopHunt(false);
    // every so often the nearest one squeaks, which tells you roughly where it is
    hunt.hintT -= dt;
    if (hunt.hintT <= 0) {
      hunt.hintT = 22;
      let best = null;
      for (const hm of hunt.hams) if (!hm.found && (!best || hm.pos.distanceToSquared(p) < best.pos.distanceToSquared(p))) best = hm;
      if (best) {
        const a = Math.atan2(best.pos.x - p.x, -(best.pos.z - p.z)); // 0 = north (-z)
        const dir = COMPASS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
        const d = Math.round(Math.hypot(best.pos.x - p.x, best.pos.z - p.z));
        sfx.squeak?.();
        hud.popup(`*squeak* (${dir}, ~${d} m)`, '#ffb347');
      }
    }
  }

  // ---------- the noticeboard ----------
  function panel() {
    const root = document.createElement('div');
    root.className = 'casino hideseek';
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
      b.addEventListener('click', () => {
        sfx.click();
        fn();
        closePanel();
      });
      return b;
    };
    add('h3', null, '🙈 Hide and Seek (online)');
    if (!net?.connected) add('p', 'fine', 'Go online to play with other people (the 🌐 chip at the top, or Online in the menu).');
    else if (!round) {
      btn('START A ROUND', () => net.send({ t: 'hs', a: 'start' }));
      add('p', 'fine', `Everyone in Ohio gets an invite. One random player seeks (blindfolded for 25 s), everyone else hides inside the green ring. Bonk a hider to find them; found Claws join the seekers. Stay hidden for 2:30 to win ${PRIZE.survive} 🪙. Seekers earn ${PRIZE.tag} 🪙 per find.`);
    } else if (round.phase === 'lobby' && !inRound()) {
      btn(`JOIN (${round.ids.length} in, starts in ${Math.ceil((round.lobbyEnd - now()) / 1000)}s)`, () => net.send({ t: 'hs', a: 'join' }));
    } else if (round.phase === 'lobby') {
      add('p', 'slot-result', `You're in! Starting in ${Math.ceil((round.lobbyEnd - now()) / 1000)}s…`);
      btn('LEAVE', () => net.send({ t: 'hs', a: 'leave' }), false);
    } else add('p', 'fine', `A round is on (${round.ids.length - round.seekers.length} still hidden). Wait for the next one!`);
    add('h3', null, '🐹 Hampter Hunt (solo)');
    if (hunt) btn('GIVE UP', () => stopHunt(false), false);
    else btn('START HAMPTER HUNT', startHunt);
    add('p', 'fine', `${HUNT_N} hampters hide around Glorp Park: in the maze, behind the arena, under the trees. Find them all in ${mmss(HUNT_TIME)}. ${PRIZE.hunt} 🪙 each, ${PRIZE.huntAll} 🪙 bonus for all of them. They squeak sometimes.`);
    return root;
  }

  if (net) {
    net.on('welcome', (m) => {
      myId = m.you;
      offset = (m.now || Date.now()) - Date.now();
      round = m.hs || null;
      refreshTags();
    });
    net.on('hs', onHs);
    net.on('status', (up) => {
      if (!up && round) endRound({ win: null, ids: [] });
    });
  }

  return {
    panel,
    startHunt,
    get hunting() {
      return !!hunt;
    },
    get round() {
      return round;
    },
    // the blindfolded seeker can't move
    get frozen() {
      return !!round && round.phase === 'play' && amSeeker() && now() < round.hideEnd;
    },
    // a seeker bonked someone
    onBonk(r) {
      if (round?.phase === 'play' && amSeeker() && now() >= round.hideEnd && round.ids.includes(r.id) && !round.seekers.includes(r.id)) net.send({ t: 'hs', a: 'tag', who: r.id });
    },
    update(dt, t) {
      tagT -= dt;
      if (tagT <= 0) {
        tagT = 1; // players who just spawned get their badges too
        refreshTags();
      }
      updateRound(dt);
      updateHunt(dt, t);
      ring.visible = !!hunt || inRound();
      if (ring.visible) ring.material.opacity = 0.4 + Math.sin(t * 3) * 0.15;
    },
    dispose() {
      stopHunt(null);
      scene.remove(ring);
      blind.remove();
    },
  };
}
