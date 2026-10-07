// Zombie Tag (October, the board at the graveyard gate). Played on the whole map.
// Online: everyone in Ohio gets an invite. The server picks patient zero, who rises from the grave
// (frozen for 10 seconds) while everyone runs. A zombie's bonk turns a survivor into a zombie.
// Survivors win if anyone is still human when the 3:00 runs out; zombies win if they get everyone.
// Solo (offline, or any time): a horde of Kenney zombies shambles after you. Survive 3:00.
import * as THREE from 'three';
import { skinById } from './skins.js';
import { signTexture } from './textures.js';

const PLAY = 180; // seconds (the server's ZB_PLAY)
const HORDE = 8;
const PRIZE = { infect: 40, survive: 250, last: 150, zombieWin: 120, play: 20, solo: 200 };
const ZOMBIE_SPEED = 0.92; // zombie Claws are a little slower
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

export function createZombieTag({ scene, world, RAPIER, wrap, claw, hud, sfx, wallet, net, players, gltf, board, feed, onFx, onResult, setLook, closePanel }) {
  // ---------- the noticeboard at the graveyard gate ----------
  const sign = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3426', roughness: 0.9 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), wood);
    post.position.set(s * 0.75, 0.95, 0);
    sign.add(post);
  }
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.1),
    new THREE.MeshBasicMaterial({ map: signTexture(['🧟 ZOMBIE TAG', 'whole map · bonk to infect'], { w: 512, h: 312, size: 58, bg: '#1a0f24', border: '#8dff5a', colors: ['#8dff5a', '#ff8a1f'] }) })
  );
  face.position.set(0, 1.5, 0.07);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 0.08), wood);
  back.position.set(0, 1.5, 0);
  sign.add(back, face);
  sign.position.copy(board);
  sign.rotation.y = board.ry || 0;
  scene.add(sign);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.95, 0.95, 0.1), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(board.x, 0.95, board.z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), board.ry || 0))));

  const rise = document.createElement('div');
  rise.className = 'zb-rise';
  rise.innerHTML = '<b>YOU ARE PATIENT ZERO</b><span>Rising from the grave…</span><big></big><small>Then bonk every Claw you catch. They join the horde.</small>';
  rise.hidden = true;
  wrap.appendChild(rise);

  let myId = null;
  let round = null; // the server's snapshot
  let offset = 0;
  let ticked = '';
  let tagT = 0;
  let wasZombie = false;
  let groanT = 0;
  const now = () => Date.now() + offset;
  const nameOf = (id) => (id === myId ? 'You' : players?.nameOf(id) || 'Someone');
  const inRound = () => !!round && !!myId && round.ids.includes(myId);
  const amZombie = () => inRound() && round.phase === 'play' && round.zombies.includes(myId);

  function toGrave() {
    claw.setFlop?.(false);
    claw.teleport(board.x - 5 + (Math.random() - 0.5) * 2, 1, board.z + (Math.random() - 0.5) * 2);
  }

  // my own look and speed follow my zombie state
  function syncMe() {
    const z = amZombie();
    if (z === wasZombie) return;
    wasZombie = z;
    claw.st.speedK = z ? ZOMBIE_SPEED : 1;
    setLook(z ? skinById('zombie') : null);
  }

  function refreshTags() {
    if (!players) return;
    for (const r of players.remotes.values()) {
      const playing = round?.phase === 'play' && round.ids.includes(r.id);
      players.setBadge(r.id, playing ? (round.zombies.includes(r.id) ? '🧟 ZOMBIE' : '🏃 SURVIVOR') : null);
    }
  }

  function onZb(m) {
    offset = m.now - Date.now();
    round = m.s;
    ticked = '';
    if (m.busy) hud.popup('HIDE AND SEEK IS ON. TRY AFTER!', '#ff4f6d');
    switch (m.ev) {
      case 'open':
        if (m.by === myId) hud.banner('ZOMBIE TAG', 'Waiting 20 seconds for players to join…');
        else {
          feed(`${nameOf(m.by)} started Zombie Tag 🧟`, '#8dff5a');
          hud.invite(`🧟 ${nameOf(m.by)} started ZOMBIE TAG (whole map)`, {
            yes: 'JOIN',
            no: 'NAH',
            ms: Math.max(3000, round.lobbyEnd - now()),
            onYes: () => net.send({ t: 'zb', a: 'join' }),
          });
        }
        break;
      case 'join':
        if (m.by === myId) hud.popup('YOU JOINED ZOMBIE TAG', '#8dff5a');
        else feed(`${nameOf(m.by)} joined Zombie Tag (${round.ids.length})`, '#8dff5a');
        break;
      case 'begin':
        feed(`${nameOf(m.first)} ${m.first === myId ? 'are' : 'is'} patient zero 🧟`, '#8dff5a');
        if (inRound()) {
          stopSolo(null);
          if (m.first === myId) {
            toGrave();
            sfx.groan();
          } else {
            sfx.ding();
            hud.banner('RUN!', `${nameOf(m.first)} is patient zero, rising at the graveyard. Anywhere on the map. Survive 3:00!`);
          }
        }
        break;
      case 'tag':
        if (m.who === myId) {
          sfx.groan();
          hud.banner(`${nameOf(m.by).toUpperCase()} GOT YOU`, "You're a zombie now. Braaains. Bonk the survivors!");
        } else if (m.by === myId) {
          sfx.win();
          wallet.add(PRIZE.infect);
          hud.popup(`INFECTED ${nameOf(m.who).toUpperCase()}! +${PRIZE.infect} 🪙`, '#8dff5a');
        }
        feed(`${nameOf(m.by)} infected ${nameOf(m.who)} 🧟`, '#8dff5a');
        break;
      case 'end':
        endRound(m);
        break;
    }
    syncMe();
    refreshTags();
  }

  function endRound(m) {
    const was = m.ids?.includes(myId);
    round = null;
    rise.hidden = true;
    hud.setTimer(null);
    syncMe();
    refreshTags();
    if (!m.win) {
      if (was) hud.banner('ZOMBIE TAG CANCELLED', m.why || '');
      return;
    }
    const alive = (m.ids || []).filter((id) => !m.zombies.includes(id));
    feed(m.win === 'survivors' ? `Zombie Tag: ${alive.map(nameOf).join(', ')} survived 🏃` : 'Zombie Tag: the horde got everyone 🧟', '#ffe14d');
    if (!was) return;
    let prize = PRIZE.play;
    let title;
    if (m.win === 'survivors' && alive.includes(myId)) {
      prize += PRIZE.survive + (m.last === myId ? PRIZE.last : 0);
      title = m.last === myId ? 'LAST CLAW STANDING!' : 'YOU SURVIVED!';
      onFx?.('survived Zombie Tag 🏃');
      onResult?.('survived');
    } else if (m.win === 'zombies' && m.first === myId) {
      prize += PRIZE.zombieWin;
      title = 'PATIENT ZERO WINS!';
      onFx?.('turned everyone into zombies 🧟');
      onResult?.('horde');
    } else if (m.win === 'zombies' && m.last === myId) {
      prize += Math.round(PRIZE.last / 2);
      title = 'YOU WERE THE LAST ONE';
    } else title = m.win === 'survivors' ? 'THE SURVIVORS WIN' : 'THE HORDE WINS';
    wallet.add(prize);
    if (prize > PRIZE.play) sfx.win();
    hud.banner(title, `+${prize} Glorp Coins`, { pog: prize > PRIZE.play });
  }

  function updateRound() {
    if (!round) return;
    const t = now();
    const due = round.phase === 'lobby' ? round.lobbyEnd : round.end;
    if (t > due + 600 && ticked !== round.phase + due) {
      ticked = round.phase + due;
      net.send({ t: 'zb', a: 'tick' });
    }
    if (t > due + 10000) return endRound({ win: null, ids: round.ids }); // the server forgot (restart)
    const me = inRound();
    if (round.phase === 'lobby') {
      hud.setTimer(`🧟 ZOMBIE TAG IN ${Math.ceil((round.lobbyEnd - t) / 1000)}s · ${round.ids.length} IN${me ? '' : ' · JOIN AT THE GRAVEYARD'}`);
      return;
    }
    if (!me) return hud.setTimer(null);
    const zombie = amZombie();
    const alive = round.ids.length - round.zombies.length;
    if (t < round.graceEnd) {
      const s = Math.ceil((round.graceEnd - t) / 1000);
      rise.hidden = !zombie;
      rise.querySelector('big').textContent = s;
      hud.setTimer(zombie ? null : `🏃 RUN! ${s}s`);
    } else {
      rise.hidden = true;
      hud.setTimer(`${zombie ? '🧟 INFECT' : '🏃 SURVIVE'} · ${mmss((round.end - t) / 1000)} · ${alive} HUMAN${alive === 1 ? '' : 'S'} LEFT`);
    }
  }

  // ---------- solo: the horde ----------
  let solo = null;
  const tpl = gltf.scene.getObjectByName('h_character_zombie');
  const clips = gltf.animations.filter((a) => a.name.startsWith('h_character_zombie|'));
  const clipOf = (n) => clips.find((a) => a.name.endsWith('|' + n));
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const tmp = new THREE.Vector3();

  function groundAt(x, z, from = 30) {
    ray.origin = { x, y: from, z };
    ray.dir = { x: 0, y: -1, z: 0 };
    const hit = world.castRay(ray, from + 5, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, claw.body);
    return hit ? from - hit.timeOfImpact : 0;
  }
  function spawnZombie(p, near = false) {
    const a = Math.random() * Math.PI * 2;
    const d = near ? 22 + Math.random() * 6 : 24 + Math.random() * 14;
    const x = THREE.MathUtils.clamp(p.x + Math.cos(a) * d, -125, 125);
    const z = THREE.MathUtils.clamp(p.z + Math.sin(a) * d, -125, 125);
    return { x, z, y: groundAt(x, z, 4) };
  }

  function startSolo() {
    if (inRound()) return hud.popup('FINISH ZOMBIE TAG FIRST', '#ff4f6d');
    stopSolo(null);
    const p = claw.position();
    solo = { t: 0, zs: [] };
    for (let i = 0; i < HORDE; i++) {
      const g = tpl.clone(true);
      g.scale.setScalar(1.5);
      const at = spawnZombie(p);
      g.position.set(at.x, at.y, at.z);
      scene.add(g);
      const mixer = new THREE.AnimationMixer(g);
      const acts = {};
      for (const n of ['walk', 'sprint', 'attack-melee-right', 'emote-yes']) if (clipOf(n)) acts[n] = mixer.clipAction(clipOf(n));
      acts.walk?.play();
      solo.zs.push({ g, mixer, acts, cur: 'walk', side: Math.random() < 0.5 ? 1 : -1, dodge: 0, wobble: Math.random() * 6, gy: at.y, gT: i % 3 });
    }
    sfx.groan();
    hud.banner('THE HORDE IS COMING', `${HORDE} zombies are shambling towards you. Survive ${mmss(PLAY)}! Zoomies help.`);
  }

  function stopSolo(win) {
    if (!solo) return;
    const lasted = solo.t;
    for (const z of solo.zs) {
      z.mixer.stopAllAction();
      scene.remove(z.g);
    }
    solo = null;
    hud.setTimer(null);
    if (win === true) {
      wallet.add(PRIZE.solo);
      sfx.win();
      hud.banner('YOU SURVIVED THE HORDE', `+${PRIZE.solo} Glorp Coins`, { pog: true });
      onFx?.('survived the zombie horde 🧟');
      onResult?.('solo');
    } else if (win === false) {
      sfx.groan();
      hud.banner('THE HORDE GOT YOU', `You lasted ${mmss(lasted)}. Braaains.`);
    }
  }

  function play(z, name) {
    if (z.cur === name || !z.acts[name]) return;
    z.acts[name].reset().play();
    z.acts[z.cur]?.crossFadeTo(z.acts[name], 0.2, false);
    z.cur = name;
  }

  function updateSolo(dt, t) {
    if (!solo) return;
    solo.t += dt;
    const p = claw.position();
    const speed = Math.min(4.4, 2.8 + (1.6 * solo.t) / PLAY);
    let nearest = Infinity;
    for (const z of solo.zs) {
      const pos = z.g.position;
      tmp.set(p.x - pos.x, 0, p.z - pos.z);
      const d = tmp.length();
      nearest = Math.min(nearest, d);
      if (d > 60) {
        // lost track of you: a new one rises closer
        const at = spawnZombie(p, true);
        pos.set(at.x, at.y, at.z);
        z.gy = at.y;
        continue;
      }
      if (d < 1.0 * claw.st.scaleK + 0.5 && Math.abs(p.y - pos.y - 0.4) < 1.6) {
        play(z, 'attack-melee-right');
        return stopSolo(false);
      }
      tmp.normalize();
      // something in the way: shuffle sideways for a bit
      if (z.dodge <= 0) {
        ray.origin = { x: pos.x, y: pos.y + 0.6, z: pos.z };
        ray.dir = { x: tmp.x, y: 0, z: tmp.z };
        if (world.castRay(ray, 1.3, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, claw.body)) z.dodge = 0.9;
      }
      if (z.dodge > 0) {
        z.dodge -= dt;
        tmp.set(tmp.z * z.side, 0, -tmp.x * z.side);
      }
      const sp = speed * (0.9 + 0.1 * Math.sin(t * 1.3 + z.wobble));
      pos.x += tmp.x * sp * dt;
      pos.z += tmp.z * sp * dt;
      z.g.rotation.y = Math.atan2(tmp.x, tmp.z);
      // follow the ground (a third of them per frame)
      z.gT = (z.gT + 1) % 3;
      if (!z.gT) z.gy = groundAt(pos.x, pos.z, pos.y + 2);
      pos.y += (z.gy - pos.y) * Math.min(1, dt * 10);
      play(z, sp > 3.8 ? 'sprint' : 'walk');
      z.mixer.update(dt * (sp / 3));
    }
    groanT -= dt;
    if (nearest < 9 && groanT <= 0) {
      groanT = 2.5 + Math.random() * 2;
      sfx.groan();
    }
    hud.setTimer(`🧟 SURVIVE THE HORDE · ${mmss(PLAY - solo.t)} · nearest ${Math.round(nearest)} m`);
    if (solo.t >= PLAY) stopSolo(true);
  }

  // ---------- the board ----------
  function panel() {
    const root = document.createElement('div');
    root.className = 'casino hideseek zombietag';
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
    add('h3', null, '🧟 Zombie Tag (online, whole map)');
    if (!net?.connected) add('p', 'fine', 'Go online to play with other people (the 🌐 chip at the top, or Online in the menu).');
    else if (!round) {
      btn('START A ROUND', () => net.send({ t: 'zb', a: 'start' }));
      add('p', 'fine', `Everyone in Ohio gets an invite. One random player is patient zero and rises at the graveyard 10 s after the start. Zombies bonk survivors to infect them (zombies are a bit slower). Anyone still human after ${mmss(PLAY)} wins ${PRIZE.survive} 🪙, the last one standing gets ${PRIZE.last} 🪙 more. Zombies earn ${PRIZE.infect} 🪙 per bite.`);
    } else if (round.phase === 'lobby' && !inRound()) {
      btn(`JOIN (${round.ids.length} in, starts in ${Math.ceil((round.lobbyEnd - now()) / 1000)}s)`, () => net.send({ t: 'zb', a: 'join' }));
    } else if (round.phase === 'lobby') {
      add('p', 'slot-result', `You're in! Starting in ${Math.ceil((round.lobbyEnd - now()) / 1000)}s…`);
      btn('LEAVE', () => net.send({ t: 'zb', a: 'leave' }), false);
    } else add('p', 'fine', `A round is on (${round.ids.length - round.zombies.length} humans left). Wait for the next one!`);
    add('h3', null, '🧟‍♂️ Survive the Horde (solo)');
    if (solo) btn('GIVE UP', () => stopSolo(false), false);
    else btn('START THE HORDE', startSolo);
    add('p', 'fine', `${HORDE} zombies rise around you and shamble after you, faster and faster. Don't let one touch you for ${mmss(PLAY)}. Win ${PRIZE.solo} 🪙.`);
    return root;
  }

  if (net) {
    net.on('welcome', (m) => {
      myId = m.you;
      offset = (m.now || Date.now()) - Date.now();
      round = m.zb || null;
      syncMe();
      refreshTags();
    });
    net.on('zb', onZb);
    net.on('status', (up) => {
      if (!up && round) endRound({ win: null, ids: [] });
    });
  }

  return {
    panel,
    startSolo,
    board,
    get zombie() {
      return amZombie();
    },
    get round() {
      return round;
    },
    get active() {
      return inRound() || !!solo;
    },
    // patient zero waits in the grave
    get frozen() {
      return !!round && round.phase === 'play' && amZombie() && round.first === myId && now() < round.graceEnd;
    },
    onBonk(r) {
      if (round?.phase === 'play' && amZombie() && now() >= round.graceEnd && round.ids.includes(r.id) && !round.zombies.includes(r.id)) net.send({ t: 'zb', a: 'tag', who: r.id });
    },
    update(dt, t) {
      tagT -= dt;
      if (tagT <= 0) {
        tagT = 1;
        refreshTags();
      }
      updateRound();
      updateSolo(dt, t);
      if (amZombie() && !solo) {
        groanT -= dt;
        if (groanT <= 0) {
          groanT = 6 + Math.random() * 5;
          sfx.groan();
        }
      }
    },
    dispose() {
      stopSolo(null);
      scene.remove(sign);
      rise.remove();
      claw.st.speedK = 1;
    },
  };
}
