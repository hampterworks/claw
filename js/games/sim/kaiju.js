// THE BATTLE OF OHIO. Clicky quits, summons a kaiju out of Lake Meowchigan, and the Mayor of Ohio
// goes MEGA. Everyone gets flung into the air with the camera locked on the fight. Players cheer:
// BONK for Matt, LICK for Godzilla. Matt usually wins, unless the crowd really wants Godzilla.
// The whole fight runs on the battle theme's clock (battlemusic.js): every hit lands on a downbeat.
// Online the server picks the start time, seed and winner, so every screen sees the same fight.
import * as THREE from 'three';
import { createBattleMusic, BAR, SECTIONS as S } from './battlemusic.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const FOCUS = new THREE.Vector3(0, 0, 40); // the middle of the fight
const G_HOME = new THREE.Vector3(0, 0, 53); // Godzilla stands in the shallows
const M_HOME = new THREE.Vector3(0, 0, 27); // Matt lands in the park
const RING = 62; // spectators get flung onto this circle around the fight
const END = S.end * BAR; // 80 s
const GRAV = -6;

export const winnerFor = (m, g) => (g > m * 1.5 + 10 ? 'g' : 'm');

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The fight card, in bars. Each move winds up and lands its hit on a downbeat.
const MOVES = {
  m: [
    { kind: 'punch', bars: 2, hit: 1, dmg: 7, w: 3 },
    { kind: 'kick', bars: 2, hit: 1, dmg: 9, w: 2 },
    { kind: 'pogblast', bars: 4, hit: 2, dmg: 13, w: 1, fling: true },
    { kind: 'pogray', bars: 4, hit: 3, dmg: 15, w: 1, beam: true },
  ],
  g: [
    { kind: 'swipe', bars: 2, hit: 1, dmg: 7, w: 3 },
    { kind: 'tail', bars: 2, hit: 1, dmg: 9, w: 2 },
    { kind: 'stomp', bars: 2, hit: 1, dmg: 8, w: 1, fling: true },
    { kind: 'breath', bars: 4, hit: 3, dmg: 15, w: 1, beam: true },
  ],
};
export function fightCard(seed) {
  const r = rng(seed);
  const card = [];
  let bar = S.fight;
  let who = r() < 0.5 ? 'm' : 'g';
  const pick = (list) => {
    let x = r() * list.reduce((a, m) => a + m.w, 0);
    for (const m of list) if ((x -= m.w) < 0) return m;
    return list[0];
  };
  while (bar < S.finale) {
    let mv = pick(MOVES[who]);
    if (bar + mv.bars > S.finale) mv = MOVES[who][0];
    if (bar + mv.bars > S.finale) break;
    card.push({ who, ...mv, bar, hitBar: bar + mv.hit });
    bar += mv.bars;
    who = r() < 0.75 ? (who === 'm' ? 'g' : 'm') : who;
  }
  return card;
}

// ---------- Mega Godzilla (procedural, ~10 units tall, facing +z) ----------
function buildGodzilla() {
  const skin = new THREE.MeshStandardMaterial({ color: '#5a7a5c', emissive: '#16241a', roughness: 0.8, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: '#a3a37a', emissive: '#1c1c10', roughness: 0.85, flatShading: true });
  const plateMat = new THREE.MeshStandardMaterial({ color: '#9fd8ff', emissive: '#3aa0ff', emissiveIntensity: 0.5, roughness: 0.4, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#2f3b30', roughness: 0.8, flatShading: true });
  const blob = (r, m, x, y, z, sx = 1, sy = 1, sz = 1, parent) => {
    const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    parent.add(o);
    return o;
  };
  const group = (x, y, z, parent) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const plate = (s, x, y, z, parent, tilt = 0) => {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 1.3 * s, 4), plateMat);
    o.scale.z = 0.3;
    o.position.set(x, y, z);
    o.rotation.set(-0.35, 0, tilt);
    parent.add(o);
    return o;
  };
  const root = new THREE.Group();
  const body = group(0, 0, 0, root); // bobs, leans, turns
  const hips = group(0, 4.3, 0, body);
  blob(1.6, skin, 0, 0, -0.2, 1.25, 1.0, 1.15, hips);
  const chest = group(0, 1.2, 0.2, hips);
  chest.rotation.x = 0.22;
  blob(1.7, skin, 0, 1.2, 0, 1.25, 1.55, 1.1, chest);
  blob(1.3, belly, 0, 0.9, 0.9, 1.1, 1.6, 0.55, chest);
  // neck + head
  const neck = group(0, 3.2, 0.35, chest);
  blob(0.95, skin, 0, 0.3, 0.2, 1.0, 1.1, 1.0, neck);
  const head = group(0, 1.0, 0.55, neck);
  blob(0.95, skin, 0, 0.25, 0.45, 1.05, 0.8, 1.35, head);
  blob(0.5, skin, 0, 0.1, 1.35, 1.1, 0.65, 1.0, head); // snout
  blob(0.25, dark, 0, 0.55, 0.9, 2.4, 0.35, 0.6, head); // brow ridge
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23f').multiplyScalar(1.4) });
  for (const s of [-1, 1]) blob(0.11, eyeMat, s * 0.42, 0.42, 1.05, 1, 0.6, 0.6, head);
  const jaw = group(0, -0.1, 0.5, head);
  blob(0.55, belly, 0, -0.2, 0.55, 1.15, 0.45, 1.4, jaw);
  const toothMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', flatShading: true });
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), toothMat);
    const a = (i / 5 - 0.5) * 2.2;
    t.position.set(Math.sin(a) * 0.45, -0.05, 0.6 + Math.cos(a) * 0.45);
    head.add(t);
  }
  const mouth = group(0, 0, 1.6, head); // where the breath comes from
  // arms
  const arms = [-1, 1].map((s) => {
    const sh = group(s * 1.75, 2.0, 0.9, chest);
    blob(0.45, skin, 0, -0.5, 0.2, 0.9, 1.4, 0.9, sh);
    const fore = group(0, -1.1, 0.35, sh);
    blob(0.35, skin, 0, -0.4, 0.3, 0.85, 1.3, 0.85, fore);
    for (let k = -1; k <= 1; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 4), toothMat);
      c.position.set(k * 0.12, -0.95, 0.55);
      c.rotation.x = 1.3;
      fore.add(c);
    }
    sh.rotation.x = -0.5;
    return { sh, fore };
  });
  // legs
  const legs = [-1, 1].map((s) => {
    const hip = group(s * 1.35, -0.2, 0, hips);
    blob(1.0, skin, 0, -1.0, 0.25, 1.15, 1.6, 1.25, hip);
    const knee = group(0, -2.1, 0.2, hip);
    blob(0.7, skin, 0, -0.6, -0.2, 1, 1.3, 1, knee);
    const foot = blob(0.6, dark, 0, -1.65, 0.45, 1.35, 0.55, 1.9, knee);
    for (let k = -1; k <= 1; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 4), toothMat);
      c.position.set(k * 0.32, -1.75, 1.45);
      c.rotation.x = Math.PI / 2;
      knee.add(c);
    }
    return { hip, knee, foot };
  });
  // tail: a chain of segments, each a child of the last
  const tail = [];
  let parent = group(0, 0.1, -1.4, hips);
  for (let i = 0; i < 9; i++) {
    const r = 1.15 * (1 - i / 10);
    const seg = group(0, -0.16, -1.25, parent);
    blob(r, skin, 0, 0, 0, 1, 0.9, 1.25, seg);
    if (i < 7) plate(0.75 * (1 - i / 9), 0, r * 0.9, 0, seg);
    tail.push(seg);
    parent = seg;
  }
  tail[0].position.set(0, 0, 0);
  // the glowing dorsal plates, three rows
  const plates = [];
  for (let i = 0; i < 6; i++) {
    const y = 0.4 + i * 0.55;
    const s = 1.25 - Math.abs(i - 2.5) * 0.18;
    plates.push(plate(s, 0, y + 0.3, -1.25 - i * 0.04, chest));
    plates.push(plate(s * 0.7, -0.55, y + 0.1, -1.15, chest, 0.35));
    plates.push(plate(s * 0.7, 0.55, y + 0.1, -1.15, chest, -0.35));
  }
  for (let i = 0; i < 3; i++) plates.push(plate(0.9, 0, 0.9 - i * 0.1, -0.9 - i * 0.6, hips));
  return { root, body, hips, chest, neck, head, jaw, mouth, arms, legs, tail, plateMat };
}

// ---------- Mega Matt (Mini Character + Matt's face, cape, sash and a mayor's crown) ----------
function buildMatt(gltf, mattTex) {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const head = model.getObjectByName('head');
  const torso = model.getObjectByName('torso');
  const add = (parent, mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    model.add(mesh);
    mesh.updateMatrixWorld(true);
    parent.attach(mesh);
    return mesh;
  };
  if (mattTex) {
    // Matt's photo on the front of the head (measured, so it sits on the surface)
    const hb = new THREE.Box3().setFromObject(model.getObjectByName('head-mesh') || head);
    const w = (hb.max.x - hb.min.x) * 0.92;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: mattTex, transparent: true }));
    add(head, face, 0, hb.min.y + (hb.max.y - hb.min.y) * 0.42, hb.max.z + 0.004);
  }
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.6, roughness: 0.3, emissive: '#3a2600' });
  add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 12, 1, true), gold), 0, 0.7, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(head, new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), gold), Math.sin(a) * 0.15, 0.76, Math.cos(a) * 0.15);
  }
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42, 1, 4), new THREE.MeshStandardMaterial({ color: '#c0182f', side: THREE.DoubleSide, roughness: 0.7 }));
  add(torso, cape, 0, 0.14, -0.13, 0.12);
  add(torso, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: '#ffe14d' })), 0, 0.24, 0.115, 0, 0, 0.7);
  return { model, cape };
}

export function createKaiju({ RAPIER, scene, camera, wrap, hud, sfx, ch, wallet, claw, world, W, sky, music, mattGltf, mattTex, applyMutators, net, players, onFx, env }) {
  const bm = createBattleMusic({ isEnabled: () => music.enabled });
  // event HUD
  const ui = document.createElement('div');
  ui.className = 'kj-ui';
  ui.hidden = true;
  ui.innerHTML = `
    <div class="kj-bar top"><div class="kj-hp m"><b>MEGA MATT</b><span><i></i></span></div><div class="kj-vs">VS</div><div class="kj-hp g"><b>MEGA GODZILLA</b><span><i></i></span></div></div>
    <div class="kj-bar bottom"><div class="kj-cheer"><em class="m">👊 BONK = cheer MATT</em><span><i></i></span><em class="g">LICK = cheer GODZILLA 👅</em></div></div>`;
  wrap.appendChild(ui);
  const $ = (s) => ui.querySelector(s);
  const hpM = $('.kj-hp.m i');
  const hpG = $('.kj-hp.g i');
  const meter = $('.kj-cheer span i');

  let ev = null; // { start (server ms), seed, host, m, g, winner }
  let offset = 0;
  let myId = null;
  let run = null; // the live scene stuff
  const local = { m: 0, g: 0, sendM: 0, sendG: 0, sendT: 0 };
  const now = () => Date.now() + offset;
  const evT = () => (ev ? (now() - ev.start) / 1000 : -1);
  const isHost = () => !net?.connected || (ev && ev.host === myId);

  // remember what we change so it all goes back afterwards
  const saved = {};
  // the storm colours are blended in by the environment (over whatever time of day it is)
  function setStorm(k) {
    if (env) env.storm = k;
    scene.fog.near = THREE.MathUtils.lerp(saved.near, 160, k);
    scene.fog.far = THREE.MathUtils.lerp(saved.far, 700, k);
  }

  // ---------- effects ----------
  const fx = [];
  const sparkGeo = new THREE.OctahedronGeometry(1, 0);
  function burst(at, color, n = 18, speed = 18, size = 1.2) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sparkGeo, mat);
      m.position.copy(at);
      m.scale.setScalar(size * (0.5 + Math.random()));
      scene.add(m);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      fx.push({ m, v, life: 1.2, max: 1.2, grav: 14, mat });
    }
  }
  function ring(at, color, to = 70) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 64), mat);
    m.rotation.x = Math.PI / 2;
    m.position.copy(at);
    scene.add(m);
    fx.push({ m, ring: to, life: 1.4, max: 1.4, mat });
  }
  function splash(at, n = 40) {
    burst(at, '#dff4ff', n, 26, 2.2);
  }
  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      if (f.ring) {
        f.m.scale.setScalar(1 + (1 - k) * f.ring);
        f.m.scale.z = 1;
        f.mat.opacity = k;
      } else {
        f.v.y -= f.grav * dt;
        f.m.position.addScaledVector(f.v, dt);
        f.m.rotation.x += dt * 5;
        f.mat.opacity = k;
      }
      if (f.life <= 0) {
        scene.remove(f.m);
        if (f.ring) f.m.geometry.dispose();
        fx.splice(i, 1);
      }
    }
  }
  let shake = 0;
  function quake(amount = 1) {
    shake = Math.max(shake, amount);
    sfx.quake();
  }

  // beams (atomic breath / POG RAY): a stretched additive cylinder between two points
  function makeBeam(color) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), mat);
    m.visible = false;
    scene.add(m);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
    m.add(core);
    return m;
  }
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const beamDir = new THREE.Vector3();
  function aimBeam(beam, from, to, width) {
    beam.visible = true;
    const len = from.distanceTo(to);
    beam.quaternion.setFromUnitVectors(UP, beamDir.copy(to).sub(from).normalize());
    beam.position.copy(from).add(to).multiplyScalar(0.5);
    beam.scale.set(width, len, width);
  }

  // ---------- flinging the local player ----------
  function seat() {
    // my spot on the spectator ring (the side I'm already on)
    const p = claw.position();
    let a = Math.atan2(p.x - FOCUS.x, p.z - FOCUS.z);
    if (Math.hypot(p.x - FOCUS.x, p.z - FOCUS.z) < 5) a = Math.random() * Math.PI * 2;
    // not inside the titans: nudge off the fight axis
    if (Math.abs(Math.sin(a)) < 0.35) a += (Math.sin(a) >= 0 ? 1 : -1) * 0.6;
    return new THREE.Vector3(FOCUS.x + Math.sin(a) * RING, HOVER, FOCUS.z + Math.cos(a) * RING);
  }
  // During the show Claw is a ghost: no collisions, no gravity, steered through the air, so no
  // building or room can trap you. At the end you're set down on open lawn by the lake.
  const HOVER = 18; // above every roof in Ohio
  const LAND = new THREE.Vector3(0, 0, 33);
  function ghost(on, r = run) {
    const col = claw.collider;
    if (on) {
      r.groups = col.collisionGroups();
      col.setCollisionGroups(0);
    } else if (r.groups != null) col.setCollisionGroups(r.groups);
    claw.body.setGravityScale(on ? 0 : 1, true);
  }
  function spin(k = 1) {
    claw.body.setAngvel({ x: (Math.random() - 0.5) * 10 * k, y: (Math.random() - 0.5) * 10 * k, z: (Math.random() - 0.5) * 10 * k }, true);
  }
  const downRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  function land() {
    // a spot on the lawn between the park and the lake, on top of whatever is there
    const a = Math.random() * Math.PI * 2;
    const x = LAND.x + Math.cos(a) * (3 + Math.random() * 7);
    const z = LAND.z + Math.sin(a) * (3 + Math.random() * 5);
    downRay.origin = { x, y: 40, z };
    const hit = world.castRay(downRay, 60, true, undefined, undefined, undefined, claw.body);
    const y = hit ? 40 - hit.timeOfImpact : 0;
    claw.setFlop?.(false);
    claw.teleport(x, y + claw.radius() + 0.4, z);
  }
  // host only: titan impacts shove props around
  function shoveProps(at, radius = 35, power = 1) {
    if (!isHost() || !W) return;
    for (const pr of W.props) {
      if (pr.gone) continue;
      const t = pr.body.translation();
      const d = Math.hypot(t.x - at.x, t.z - at.z);
      if (d > radius) continue;
      const m = pr.body.mass();
      const k = (1 - d / radius) * power;
      tmpB.set(t.x - at.x, 0, t.z - at.z).normalize();
      pr.body.wakeUp();
      pr.body.applyImpulse({ x: tmpB.x * 9 * m * k, y: (6 + Math.random() * 6) * m * k, z: tmpB.z * 9 * m * k }, true);
    }
  }

  // ---------- the show ----------
  function begin(e) {
    if (run) return;
    ev = { ...e };
    const t0 = evT();
    if (t0 > END - 1) return (ev = null);
    // build the titans
    const gz = buildGodzilla();
    gz.root.scale.setScalar(3.2);
    gz.root.position.copy(G_HOME);
    gz.root.rotation.y = Math.PI;
    scene.add(gz.root);
    const mt = buildMatt({ scene: cloneSkinned(mattGltf.scene), animations: mattGltf.animations }, mattTex);
    const box = new THREE.Box3().setFromObject(mt.model);
    const ms = 30 / Math.max(0.1, box.max.y - box.min.y);
    const mRoot = new THREE.Group();
    mRoot.add(mt.model);
    mt.model.scale.setScalar(ms);
    mRoot.position.copy(M_HOME);
    scene.add(mRoot);
    const mixer = new THREE.AnimationMixer(mt.model);
    const acts = {};
    for (const a of mattGltf.animations) acts[a.name] = mixer.clipAction(a);
    for (const n of ['attack-melee-right', 'attack-melee-left', 'attack-kick-right', 'attack-kick-left', 'jump', 'die', 'emote-yes']) {
      if (!acts[n]) continue;
      acts[n].setLoop(THREE.LoopOnce, 1);
      acts[n].clampWhenFinished = true;
    }
    let cur = null;
    const playM = (name, fade = 0.15, speed = 1) => {
      if (!acts[name]) return;
      const next = acts[name].reset();
      next.timeScale = speed;
      next.play();
      if (cur && cur !== next) cur.crossFadeTo(next, fade, false);
      cur = next;
    };
    playM('idle', 0);
    const card = fightCard(ev.seed);
    const hitSteps = [...card.map((c) => c.hitBar * 16), (S.finale + 2) * 16, (S.finale + 4) * 16];
    run = {
      gz,
      mt,
      mRoot,
      mixer,
      playM,
      card,
      beamG: makeBeam('#5fc8ff'),
      beamM: makeBeam('#ffe14d'),
      last: Math.max(-1, t0 - 0.001),
      dmg: { m: 0, g: 0 }, // damage taken
      seated: false,
      rewarded: false,
      camPos: camera.position.clone(),
      focus: FOCUS.clone().setY(14),
      winnerShown: null,
    };
    // world changes
    saved.near = scene.fog.near;
    saved.far = scene.fog.far;
    saved.camFar = camera.far;
    camera.far = 760;
    camera.updateProjectionMatrix();
    music.stop();
    bm.setWinner(ev.winner || null);
    bm.play(Math.max(0, t0), hitSteps);
    ui.hidden = false;
    wrap.classList.add('kj-on');
    local.m = local.g = local.sendM = local.sendG = 0;
    // catch up on damage already dealt (late joiners)
    for (const c of card) if (c.hitBar * BAR <= t0) run.dmg[c.who === 'm' ? 'g' : 'm'] += c.dmg;
  }

  function finish() {
    if (!run) return;
    const r = run;
    run = null;
    ev = null;
    scene.remove(r.gz.root, r.mRoot, r.beamG, r.beamM);
    r.mixer.stopAllAction();
    for (const f of fx.splice(0)) scene.remove(f.m);
    setStorm(0);
    camera.far = saved.camFar;
    camera.updateProjectionMatrix();
    bm.stop();
    if (music.enabled) music.start();
    ui.hidden = true;
    wrap.classList.remove('kj-on');
    if (r.seated) {
      ghost(false, r);
      land();
    }
    claw.setFlop?.(false);
    applyMutators(); // restores gravity
  }

  // what happens at time t (crossing each moment exactly once, even after a hitch)
  function at(t, prev, when) {
    return prev < when && t >= when;
  }

  function hpOf(side) {
    // cheers make your titan hit harder (cosmetic until the server's verdict)
    const m = (ev?.m || 0) + local.sendM;
    const g = (ev?.g || 0) + local.sendG;
    const share = side === 'm' ? (g + 10) / (m + g + 20) : (m + 10) / (m + g + 20); // the attacker's crowd
    return Math.max(10, 100 - run.dmg[side] * (0.75 + share * 0.5));
  }

  function poseGodzilla(t, dt) {
    const g = run.gz;
    const k = 1;
    // idle life: breathing, tail wave, a little sway
    g.chest.scale.setScalar(1 + Math.sin(t * 2) * 0.015);
    g.tail.forEach((s, i) => (s.rotation.y = Math.sin(t * 1.6 - i * 0.55) * 0.16 * k));
    g.tail.forEach((s, i) => (s.rotation.x = -0.05 + Math.sin(t * 1.1 - i * 0.4) * 0.03));
    g.body.rotation.z = Math.sin(t * 0.8) * 0.03;
    g.plateMat.emissiveIntensity += (0.5 - g.plateMat.emissiveIntensity) * Math.min(1, dt * 2);
    g.jaw.rotation.x *= 1 - Math.min(1, dt * 4);
    g.head.rotation.x *= 1 - Math.min(1, dt * 3);
    g.body.rotation.x *= 1 - Math.min(1, dt * 3);
    g.legs.forEach((l) => (l.hip.rotation.x *= 1 - Math.min(1, dt * 5)));
    g.arms.forEach((a) => (a.sh.rotation.x += (-0.5 - a.sh.rotation.x) * Math.min(1, dt * 4)));
  }

  // The schedule. t: seconds into the song.
  function update(dt) {
    if (!run) return;
    const t = evT();
    const prev = run.last;
    run.last = t;
    const r = run;
    const g = r.gz;
    const mR = r.mRoot;
    const B = (n) => n * BAR;
    // storm in, storm out
    const stormK = THREE.MathUtils.clamp(t < B(S.outro) ? t / 4 : 1 - (t - B(S.outro)) / (B(S.end) - B(S.outro)), 0, 1);
    setStorm(stormK);

    // -- intro: sirens, the ground shakes
    if (at(t, prev, 0.05)) {
      sfx.siren();
      hud.banner("CLICKY QUIT. WINTER'S PROBLEM NOW.", 'Something is rising out of Lake Meowchigan…');
    }
    if (at(t, prev, B(2))) quake(0.6);

    // -- rise: Godzilla climbs out of the lake
    const rise = THREE.MathUtils.clamp((t - B(S.rise)) / B(4), 0, 1);
    poseGodzilla(t, dt);
    g.root.position.y = -36 * (1 - THREE.MathUtils.smoothstep(rise, 0, 1));
    if (t < B(S.rise)) g.root.visible = false;
    else g.root.visible = true;
    if (at(t, prev, B(S.rise))) splash(new THREE.Vector3(G_HOME.x, 2, G_HOME.z), 50);
    if (at(t, prev, B(S.rise + 2))) {
      sfx.roar();
      splash(new THREE.Vector3(G_HOME.x, 4, G_HOME.z), 40);
      quake(1);
    }
    if (t > B(S.rise + 2) && t < B(S.rise + 3.5)) {
      g.head.rotation.x = -0.5;
      g.jaw.rotation.x = 0.6;
    }

    // -- drop: Matt falls out of the sky and lands on the downbeat
    const fallT = THREE.MathUtils.clamp((t - B(S.drop)) / B(1), 0, 1);
    mR.visible = t >= B(S.drop);
    if (t < B(S.drop + 1)) mR.position.y = 260 * (1 - fallT * fallT);
    else if (mR.position.y !== 0 && t < B(S.finale)) mR.position.y = 0;
    if (at(t, prev, B(S.drop))) {
      hud.banner('THE MAYOR OF OHIO HAS ENTERED THE CHAT', 'MEGA MATT IS HERE');
      r.playM('fall', 0.1);
    }
    if (at(t, prev, B(S.drop + 1))) {
      r.playM('idle', 0.2);
      quake(1.4);
      ring(new THREE.Vector3(M_HOME.x, 0.5, M_HOME.z), '#ffe14d', 80);
      burst(new THREE.Vector3(M_HOME.x, 2, M_HOME.z), '#ffe14d', 30, 30, 2);
      shoveProps(M_HOME, 40, 1.2);
      run.wantFling = true;
    }
    // -- march: both close in
    if (t >= B(S.march) && t < B(S.fight)) {
      if (at(t, prev, B(S.march))) r.playM('walk', 0.2);
      if (at(t, prev, B(S.march + 1))) sfx.roar();
      g.legs.forEach((l, i) => (l.hip.rotation.x = Math.sin(t * 4 + i * Math.PI) * 0.35));
    }
    if (at(t, prev, B(S.fight))) r.playM('idle', 0.3);

    // -- the fight card
    let gLunge = 0;
    let mLunge = 0;
    g.beamOn = false;
    r.beamM.visible = false;
    r.beamG.visible = false;
    for (const c of r.card) {
      const s0 = B(c.bar);
      const hitT = B(c.hitBar);
      const s1 = B(c.bar + c.bars);
      if (t < s0 || t > s1) {
        if (at(t, prev, hitT)) impact(c); // (skipped past while throttled)
        continue;
      }
      const wind = THREE.MathUtils.clamp((t - s0) / (hitT - s0), 0, 1); // 0..1 up to the hit
      const after = THREE.MathUtils.clamp((t - hitT) / Math.max(0.2, s1 - hitT), 0, 1);
      if (c.who === 'g') {
        if (c.kind === 'swipe') {
          const arm = g.arms[c.bar % 2];
          arm.sh.rotation.x = t < hitT ? -0.5 - wind * 1.6 : -2.1 + after * 2.4;
          gLunge = t < hitT ? wind : 1 - after;
        } else if (c.kind === 'tail') {
          g.body.rotation.y = t < hitT ? -wind * 0.9 : -0.9 + after * 0.9 + Math.sin(after * Math.PI) * 2.6;
          g.tail.forEach((s, i) => (s.rotation.y += Math.sin(Math.min(1, after) * Math.PI) * 0.35));
        } else if (c.kind === 'stomp') {
          g.legs[0].hip.rotation.x = t < hitT ? -wind * 1.0 : -1.0 * (1 - Math.min(1, after * 6));
          g.root.position.y += t < hitT ? wind * 1.5 : 0;
        } else if (c.kind === 'breath') {
          g.plateMat.emissiveIntensity = 0.5 + Math.min(1, wind * 1.3) * 4;
          g.head.rotation.x = t < hitT ? -0.25 * wind : 0.1;
          g.jaw.rotation.x = t > hitT - BAR ? 0.7 : wind * 0.3;
          if (t > hitT - BAR * 0.5 && t < hitT + BAR * 0.6) {
            g.mouth.getWorldPosition(tmpA);
            tmpB.set(mR.position.x, 19, mR.position.z + 2);
            aimBeam(r.beamG, tmpA, tmpB, 1.6 + Math.sin(t * 40) * 0.25);
          }
        }
      } else {
        if (c.kind === 'punch' || c.kind === 'kick') {
          if (at(t, prev, Math.max(s0, hitT - 0.45))) r.playM(c.kind === 'punch' ? (c.bar % 4 ? 'attack-melee-left' : 'attack-melee-right') : 'attack-kick-right', 0.1);
          mLunge = t < hitT ? wind : 1 - after;
          if (at(t, prev, s1 - 0.05)) r.playM('idle', 0.25);
        } else if (c.kind === 'pogblast') {
          if (at(t, prev, hitT - BAR)) r.playM('jump', 0.1, 0.8);
          if (t > hitT - BAR && t < hitT) mR.position.y = Math.sin(((t - (hitT - BAR)) / BAR) * Math.PI) * 14;
          else mR.position.y = 0;
          if (at(t, prev, hitT + 0.3)) r.playM('idle', 0.3);
        } else if (c.kind === 'pogray') {
          if (at(t, prev, s0)) r.playM('emote-yes', 0.2);
          if (t > hitT - BAR * 0.5 && t < hitT + BAR * 0.6) {
            tmpA.set(mR.position.x, 17, mR.position.z + 4);
            tmpB.set(g.root.position.x, 18, g.root.position.z - 3);
            aimBeam(r.beamM, tmpA, tmpB, 1.3 + Math.sin(t * 40) * 0.2);
          }
          if (at(t, prev, s1 - 0.05)) r.playM('idle', 0.25);
        }
      }
      if (at(t, prev, hitT - BAR) && c.beam) c.who === 'g' ? sfx.beam() : sfx.beam();
      if (at(t, prev, hitT)) impact(c);
    }
    g.root.position.z = G_HOME.z - gLunge * 7;
    if (t < B(S.finale)) mR.position.z = M_HOME.z + mLunge * 6;

    // -- the finale: the crowd's choice
    if (t >= B(S.finale) - 0.2 && !ev.winner) {
      if (!net?.connected) ev.winner = winnerFor(local.m, local.g);
      else if (t > B(S.finale + 1)) ev.winner = winnerFor((ev.m || 0) + local.sendM, (ev.g || 0) + local.sendG); // server is late: best guess
      else if (!r.asked) {
        r.asked = true;
        net.send({ t: 'ev', a: 'tick' });
      }
    }
    const w = ev.winner;
    if (w) bm.setWinner(w);
    if (w && t >= B(S.finale)) finale(t, prev, w);

    // -- victory and rewards
    if (w && at(t, prev, B(S.victory + 1)) && !r.rewarded) {
      r.rewarded = true;
      wallet.add(300);
      ch.complete('kaiju');
      hud.banner(w === 'm' ? 'MEGA MATT SAVES OHIO' : 'GODZILLA WINS. OHIO IS A LAKE NOW.', '+300 Glorp Coins for surviving the Battle of Ohio', { pog: w === 'm' });
      onFx?.(w === 'm' ? 'watched Mega Matt save Ohio 🦖👊' : 'watched Godzilla flatten Mega Matt 🦖');
    }
    // -- outro: titans sink away
    if (t > B(S.outro)) {
      const k = (t - B(S.outro)) / (B(S.end) - B(S.outro));
      g.root.position.y = -k * 40;
      mR.position.y = -k * 34;
    }

    // HUD
    const hm = w && t >= B(S.finale + 4) && w === 'g' ? 0 : hpOf('m');
    const hg = w && t >= B(S.finale + 4) && w === 'm' ? 0 : hpOf('g');
    hpM.style.width = `${hm}%`;
    hpG.style.width = `${hg}%`;
    const cm = (ev.m || 0) + local.sendM;
    const cg = (ev.g || 0) + local.sendG;
    meter.style.width = `${((cm + 1) / (cm + cg + 2)) * 100}%`;

    r.mixer.update(dt);
    updateFx(dt);
    shake = Math.max(0, shake - dt * 1.6);
    if (t >= END) finish();
  }

  function impact(c) {
    const r = run;
    const target = c.who === 'm' ? 'g' : 'm';
    r.dmg[target] += c.dmg;
    const hitAt = c.who === 'm' ? new THREE.Vector3(0, 18, G_HOME.z - 5) : new THREE.Vector3(0, 17, M_HOME.z + 4);
    burst(hitAt, c.who === 'm' ? '#ffe14d' : '#5fc8ff', c.beam ? 30 : 18, c.beam ? 26 : 18, c.beam ? 1.0 : 0.7);
    quake(c.fling || c.beam ? 1.3 : 0.7);
    sfx.boom();
    if (target === 'g') {
      run.gz.body.rotation.x = -0.25;
      run.gz.jaw.rotation.x = 0.5;
    } else {
      run.mRoot.rotation.x = -0.12;
      setTimeout(() => run && (run.mRoot.rotation.x = 0), 300);
    }
    const ground = c.who === 'm' ? new THREE.Vector3(M_HOME.x, 0.5, M_HOME.z + 6) : new THREE.Vector3(G_HOME.x, 0.5, G_HOME.z - 6);
    if (c.fling) {
      ring(ground, c.who === 'm' ? '#ffe14d' : '#5fc8ff', 90);
      if (c.kind === 'pogblast') hud.popup('POG BLAST!', '#ffe14d');
      shoveProps(ground, 45, 1.2);
      run.wantFling = true;
    } else shoveProps(hitAt.clone().setY(0), 18, 0.5);
    if (c.kind === 'breath') hud.popup('ATOMIC BREATH!', '#5fc8ff');
    if (c.kind === 'pogray') hud.popup('POG RAY!', '#ffe14d');
  }

  function finale(t, prev, w) {
    const r = run;
    const g = r.gz;
    const B = (n) => n * BAR;
    const f0 = B(S.finale);
    // winner charges a finisher (bars 38-40), loser goes down (40-42)
    if (at(t, prev, f0)) {
      hud.banner(w === 'm' ? 'THE CROWD CHOSE MATT' : 'THE CROWD CHOSE GODZILLA', w === 'm' ? 'FINISH HIM (with a POG RAY)' : 'ATOMIC BREATH, FULL POWER');
      sfx.beam();
      if (w === 'm') r.playM('emote-yes', 0.2);
    }
    if (t < B(S.finale + 2)) {
      if (w === 'g') {
        g.plateMat.emissiveIntensity = 0.5 + ((t - f0) / B(2)) * 5;
        g.jaw.rotation.x = 0.7;
      }
    }
    if (t > B(S.finale + 1.5) && t < B(S.finale + 3)) {
      if (w === 'g') {
        g.mouth.getWorldPosition(tmpA);
        aimBeam(r.beamG, tmpA, tmpB.set(r.mRoot.position.x, 18, r.mRoot.position.z + 2), 2.4 + Math.sin(t * 40) * 0.3);
      } else {
        tmpA.set(r.mRoot.position.x, 17, r.mRoot.position.z + 4);
        aimBeam(r.beamM, tmpA, tmpB.set(g.root.position.x, 18, g.root.position.z - 3), 2.0 + Math.sin(t * 40) * 0.3);
      }
    }
    if (at(t, prev, B(S.finale + 2))) {
      impact({ who: w, dmg: 0, beam: true, fling: true, kind: w === 'm' ? 'pogray' : 'breath' });
      if (w === 'g') r.playM('die', 0.15);
      else sfx.roar();
    }
    // the fall
    const fall = THREE.MathUtils.clamp((t - B(S.finale + 2)) / B(2), 0, 1);
    const ease = fall * fall;
    if (w === 'm') {
      g.body.rotation.x = -1.45 * ease; // timber, backwards into the lake
      g.root.position.y = -2 * ease;
    }
    if (at(t, prev, B(S.finale + 4))) {
      quake(2);
      if (w === 'm') {
        splash(new THREE.Vector3(0, 3, G_HOME.z + 18), 90);
        sfx.splash();
      } else {
        burst(new THREE.Vector3(0, 2, M_HOME.z - 14), '#d9c27a', 60, 26, 2.4); // into the corn (ish)
      }
      ring(new THREE.Vector3(0, 0.5, FOCUS.z), '#ffffff', 110);
      shoveProps(FOCUS, 60, 1.4);
      run.wantFling = true;
    }
    // victory pose
    if (at(t, prev, B(S.victory))) {
      if (w === 'm') r.playM('emote-yes', 0.2);
      else {
        sfx.roar();
        g.head.rotation.x = -0.6;
        g.jaw.rotation.x = 0.7;
      }
    }
    if (w === 'g' && t > B(S.victory) && t < B(S.victory + 2)) {
      g.head.rotation.x = -0.6;
      g.jaw.rotation.x = 0.7;
    }
  }

  // ---------- the local player: fling, camera, cheers ----------
  function control(dt) {
    if (!run) return;
    const t = evT();
    if (!run.seated && t >= BAR) {
      run.seated = true;
      run.seat = seat();
      run.bump = 1;
      run.phase = Math.random() * 6;
      world.gravity = { x: 0, y: GRAV, z: 0 }; // (props fly floaty too)
      ghost(true);
      claw.setFlop?.(true);
      spin();
      hud.popup('WHEEEEE', '#ff7bf2');
    }
    if (run.wantFling) {
      run.wantFling = false;
      run.bump = 1;
      spin(1.3);
    }
    if (run.seated) {
      // (Big/Tiny mutators rebuild the collider: keep it a ghost)
      if (claw.collider.collisionGroups() !== 0) claw.collider.setCollisionGroups(0);
      // steer toward a hover spot (bobbing, bumped up by big hits); in the outro, drift down to the lawn
      run.bump = Math.max(0, run.bump - dt * 1.8);
      const outro = THREE.MathUtils.clamp((t - S.outro * BAR) / ((S.end - S.outro) * BAR), 0, 1);
      const p = claw.position();
      const tx = THREE.MathUtils.lerp(run.seat.x, LAND.x, outro);
      const tz = THREE.MathUtils.lerp(run.seat.z, LAND.z, outro);
      const ty = THREE.MathUtils.lerp(HOVER + Math.sin(t * 1.3 + run.phase) * 1.5 + run.bump * 9, 4, outro);
      let vx = (tx - p.x) * 1.4;
      let vz = (tz - p.z) * 1.4;
      const h = Math.hypot(vx, vz);
      if (h > 40) {
        vx *= 40 / h;
        vz *= 40 / h;
      }
      const vy = THREE.MathUtils.clamp((ty - p.y) * 2.5, -25, 30);
      claw.body.setLinvel({ x: vx, y: vy, z: vz }, true);
    }
    // cheers go to the server once a second
    local.sendT -= dt;
    if (net?.connected && local.sendT <= 0 && (local.m || local.g)) {
      local.sendT = 1;
      net.send({ t: 'ev', a: 'cheer', m: local.m, g: local.g });
      local.m = local.g = 0;
    }
  }

  const v3 = new THREE.Vector3();
  return {
    get active() {
      return !!run;
    },
    // the player is along for the ride: no walking during the show
    get frozen() {
      return !!run && evT() >= BAR;
    },
    get cheering() {
      return !!run && evT() >= S.march * BAR && evT() < S.finale * BAR;
    },
    cheer(side) {
      if (!this.cheering) return;
      local[side]++; // unsent (online) / total (offline)
      local[side === 'm' ? 'sendM' : 'sendG']++; // shown on the meter until the server's totals include it
      sfx.cheer();
      hud.popup(side === 'm' ? 'GO MATT!' : 'GO GODZILLA!', side === 'm' ? '#ffe14d' : '#5fc8ff');
    },
    // camera locked on the fight, riding just behind the flying Claw
    camera(cam, dt) {
      if (!run) return false;
      const p = claw.position();
      v3.set(p.x - FOCUS.x, 0, p.z - FOCUS.z);
      if (v3.lengthSq() < 1) v3.set(1, 0, 0);
      v3.normalize();
      tmpA.set(p.x + v3.x * 7, Math.max(2, p.y + 3), p.z + v3.z * 7);
      run.camPos.lerp(tmpA, 1 - Math.exp(-6 * dt));
      // look between the titans (and at whoever is attacking)
      tmpB.set(0, 15, FOCUS.z);
      run.focus.lerp(tmpB, 1 - Math.exp(-3 * dt));
      camera.position.copy(run.camPos);
      if (shake > 0) camera.position.add(tmpA.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
      camera.lookAt(run.focus);
      // afterwards, the normal camera picks up from here
      cam.yaw = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
      cam.pitch = 0.3;
      return true;
    },
    // offline (or online via the server)
    summon() {
      if (run) return 'The battle is already on!';
      if (net?.connected) {
        net.send({ t: 'ev', a: 'start' });
        return null;
      }
      offset = 0;
      begin({ start: Date.now() + 1500, seed: (Math.random() * 2 ** 31) | 0, host: null, m: 0, g: 0, winner: null });
      return null;
    },
    update,
    control,
    // network
    onEv(m) {
      if (typeof m.now === 'number') offset = m.now - Date.now();
      if (m.ev === 'busy') {
        hud.popup(`CLICKY IS OUT OF MANA (${Math.ceil((m.wait || 0) / 60000)} MIN)`, '#ff4f6d');
        return;
      }
      if (m.ev === 'start' && m.s) {
        const who = m.by === myId ? 'You' : players?.nameOf(m.by) || 'Someone';
        if (m.by !== myId) hud.banner('👹 CLICKY QUIT HIS JOB', `${who} made Clicky summon a kaiju. Hold on!`);
        begin(m.s);
        return;
      }
      if (!ev) return;
      if (m.ev === 'cheer') {
        ev.m = m.m;
        ev.g = m.g;
        local.sendM = local.sendG = 0; // now counted in the totals
      }
      if (m.ev === 'end' && m.winner) ev.winner = m.winner;
    },
    onWelcome(m) {
      myId = m.you;
      if (typeof m.now === 'number') offset = m.now - Date.now();
      if (m.ev && !run) begin(m.ev);
    },
    refreshMusic() {
      bm.refreshLevel();
    },
    dispose() {
      finish();
      bm.dispose();
      ui.remove();
    },
    _debugJump(sec) {
      if (ev) ev.start = now() - sec * 1000;
      if (run) run.last = sec - 0.01;
    },
  };
}

