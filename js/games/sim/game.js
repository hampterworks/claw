// CLAW SIMULATOR: the 3D sandbox. three.js renders, Rapier simulates.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '../../../vendor/rapier/rapier.mjs';
import { createClaw } from './claw.js';
import { buildWorld, HOUSE, PARK_POT, TOWER, STATUE, BOUNDS } from './world.js';
import { createControls, isTouchDevice } from './controls.js';
import { createHud } from './hud.js';
import { createChallenges } from './challenges.js';
import { loadTexture } from './textures.js';
import { createGraphics, createSky, applyWind } from './graphics.js';
import { showOverlay, hideOverlay } from '../../engine.js';
import { sfx } from '../../audio.js';
import { bump, read, write } from '../../scores.js';

const KNOCK = ['KNOCKED IT OFF THE TABLE', 'GRAVITY CHECK', 'IT WAS IN MY WAY', 'OOPS (NOT SORRY)', 'CAT BEHAVIOR', 'SIGMA SWIPE'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function loadImage(src) {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

export async function startGame(wrap, { onStatus, isCancelled }) {
  const touch = isTouchDevice();
  wrap.classList.toggle('touch', touch);
  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');
  const forceHigh = params.has('hq');

  onStatus('Booting physics...');
  await RAPIER.init();
  if (isCancelled()) return null;

  onStatus('Summoning Claw...');
  const loader = new GLTFLoader();
  const [catGltf, maxGltf, worldGltf, matt, huh, baby, dance, forp, face, newsImg, clawImg, mattImg] = await Promise.all([
    loader.loadAsync('assets/models/claw.glb'),
    loader.loadAsync('assets/models/claw.glb'),
    loader.loadAsync('assets/models/world.glb'),
    loadTexture('assets/sim-matt.png'),
    loadTexture('assets/sim-huh.png'),
    loadTexture('assets/sim-baby.png'),
    loadTexture('assets/sim-dance.png'),
    loadTexture('assets/sim-forp.webp'),
    loadTexture('assets/claw-alien.png'),
    loadImage('assets/sim-news.webp'),
    loadImage('assets/claw-alien.png'),
    loadImage('assets/sim-matt.png'),
  ]);
  if (isCancelled()) return null;
  onStatus('Building Ohio...');

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'sim-canvas';
  wrap.appendChild(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  const gfx = createGraphics(renderer, scene, camera);

  function resize() {
    const top = wrap.getBoundingClientRect().top;
    const h = Math.max(320, window.innerHeight - Math.max(0, top) - 8);
    wrap.style.height = h + 'px';
    const w = wrap.clientWidth;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    gfx.setSize(w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- world ----------
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  const W = buildWorld({
    RAPIER,
    world,
    scene,
    models: worldGltf.scene,
    catGltf: maxGltf,
    images: { news: newsImg, claw: clawImg, matt: mattImg },
    textures: { matt, huh, baby, dance, forp },
  });
  const S = W.special;
  const sky = createSky(scene, new THREE.Vector3(14, 26, 9));
  scene.traverse((o) => {
    if (o.isMesh) [].concat(o.material).forEach((m) => m.name === 'Wood' && m.color.set('#8d5e3b'));
  });
  const windy = new Set(['Green', 'DarkGreen', 'Berry', 'Cyan', 'Yellow', 'plant']);
  scene.traverse((o) => {
    if (o.isMesh) [].concat(o.material).forEach((m) => windy.has(m.name) && applyWind(m, m.name === 'plant' ? 0.05 : 0.02));
  });
  gfx.setQuality(forceHigh ? 'high' : read('simgfx', touch ? 'low' : 'high'));
  const spawn = new THREE.Vector3(HOUSE.x + 2, 0.8, HOUSE.z + 2.8);
  const claw = createClaw({ RAPIER, world, scene, gltf: catGltf, faceTex: face, spawn });
  // Let everything settle before scoring starts, so nothing counts as "knocked" on load.
  for (let i = 0; i < 90; i++) world.step();
  for (const p of W.props) {
    const t = p.body.translation();
    p.spawn.set(t.x, t.y, t.z);
    p.elevated = t.y - p.baseOff > 0.3;
    p.body.sleep();
  }
  W.syncAll();

  const propByHandle = new Map(W.props.map((p) => [p.body.handle, p]));

  // tongue
  const tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 6), new THREE.MeshStandardMaterial({ color: '#ff6f9a', roughness: 0.4 }));
  tongue.visible = false;
  scene.add(tongue);

  // ---------- game state ----------
  let menuOpen = false;
  let playing = false;
  const mut = { gravity: false, cursed: false, big: false, oiia: false, popcat: false };

  const hud = createHud(wrap, { onMenu: () => openMenu() });
  const ch = createChallenges(hud);
  const controls = createControls(wrap, canvas, { touch, onMenu: () => openMenu() });

  ch.state.babies.forEach((i) => S.babies[i] && (S.babies[i].visible = false));

  const cam = { yaw: Math.PI, pitch: 0.32, dist: 4.4, target: spawn.clone() };
  const st = {
    bonkCd: 0,
    held: null,
    boilCd: 0,
    launchT: 0,
    newsT: 0,
    liveT: 0,
    towerHere: false,
    huhCd: 0,
    danceCd: 0,
    boundsCd: 0,
    sitT: 0,
    sitCd: 0,
    spin: 0,
    oiiaT: 0,
    lowFps: 0,
    saveT: 0,
  };

  const v3 = new THREE.Vector3();
  const v3b = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const ballShape = new RAPIER.Ball(0.9);
  const ident = { x: 0, y: 0, z: 0, w: 1 };
  const camRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

  const dist2 = (p, x, z) => Math.hypot(p.x - x, p.z - z);

  // ---------- actions ----------
  function bonk() {
    if (st.bonkCd > 0) return;
    st.bonkCd = 0.3;
    claw.lungeNow();
    const k = claw.st.scaleK;
    const p = claw.position();
    claw.forward(fwd);
    const center = { x: p.x + fwd.x * 0.75 * k, y: p.y + 0.1 * k, z: p.z + fwd.z * 0.75 * k };
    ballShape.radius = 0.9 * k;
    const hits = [];
    world.intersectionsWithShape(center, ident, ballShape, (col) => {
      const b = col.parent();
      if (b && b.handle !== claw.body.handle && b.isDynamic()) hits.push(b);
      return true;
    });
    if (mut.popcat) sfx.pop();
    else sfx.stoke();
    for (const b of hits) {
      const m = b.mass();
      b.wakeUp();
      b.applyImpulse({ x: fwd.x * 7 * m * k, y: 3.5 * m * k, z: fwd.z * 7 * m * k }, true);
      b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m, y: (Math.random() - 0.5) * m, z: (Math.random() - 0.5) * m }, true);
      const pr = propByHandle.get(b.handle);
      if (pr && !pr.bonked) {
        pr.bonked = true;
        if (pr.kind === 'matt') ch.chaos(67, 'MATT GOT BONKED', '#ffe14d');
        else if (mut.popcat) ch.chaos(15, 'POP', '#ffe14d');
        else ch.chaos(10, 'BONK', '#5ff2ff');
      }
    }
    if (dist2(p, STATUE.x, STATUE.z) < 2.9 && p.y < 4) {
      S.maxwell.spin = 30;
      sfx.oiia();
      ch.chaos(100, 'MAXWELL APPROVES', '#fff');
      ch.complete('maxwell');
    }
  }

  function lick() {
    if (st.held) {
      const b = st.held.body;
      const m = b.mass();
      claw.forward(fwd);
      b.applyImpulse({ x: fwd.x * 6 * m, y: 3 * m, z: fwd.z * 6 * m }, true);
      st.held = null;
      tongue.visible = false;
      sfx.flap();
      return;
    }
    const k = claw.st.scaleK;
    claw.headPos(v3);
    claw.forward(fwd);
    let best = null;
    let bestD = 2.6 * k;
    for (const pr of W.props) {
      const t = pr.body.translation();
      v3b.set(t.x - v3.x, t.y - v3.y, t.z - v3.z);
      const d = v3b.length();
      if (d < bestD && v3b.normalize().dot(fwd) > 0.15) {
        best = pr;
        bestD = d;
      }
    }
    if (!best) {
      claw.st.lunge = 0.6;
      hud.popup('*lick* (nothing)', '#ff8fb1');
      return;
    }
    st.held = best;
    best.body.wakeUp();
    sfx.glorp();
    ch.chaos(5, 'LICKED', '#ff8fb1');
  }

  function holdSpring(dt) {
    const pr = st.held;
    if (!pr) return;
    const k = claw.st.scaleK;
    const p = claw.position();
    claw.forward(fwd);
    const tx = p.x + fwd.x * 1.1 * k;
    const ty = p.y + 0.55 * k;
    const tz = p.z + fwd.z * 1.1 * k;
    const b = pr.body;
    const t = b.translation();
    const v = b.linvel();
    const m = b.mass();
    const d = Math.hypot(tx - t.x, ty - t.y, tz - t.z);
    if (d > 4 * k) {
      st.held = null;
      tongue.visible = false;
      hud.popup('IT SLIPPED', '#ff8fb1');
      return;
    }
    const gain = 12;
    b.applyImpulse(
      { x: ((tx - t.x) * gain - v.x) * m * 0.35, y: ((ty - t.y) * gain - v.y) * m * 0.35 + 20 * m * dt, z: ((tz - t.z) * gain - v.z) * m * 0.35 },
      true
    );
    const av = b.angvel();
    b.setAngvel({ x: av.x * 0.9, y: av.y * 0.9, z: av.z * 0.9 }, true);
  }

  function drawTongue() {
    if (!st.held) {
      tongue.visible = false;
      return;
    }
    claw.headPos(v3);
    claw.forward(fwd);
    v3.addScaledVector(fwd, 0.15 * claw.st.scaleK);
    const t = st.held.body.translation();
    v3b.set(t.x, t.y, t.z);
    const len = v3.distanceTo(v3b);
    tongue.visible = true;
    tongue.position.copy(v3).add(v3b).multiplyScalar(0.5);
    tongue.scale.set(claw.st.scaleK, len, claw.st.scaleK);
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3b.sub(v3).normalize());
    tongue.quaternion.copy(q);
  }

  // ---------- gameplay checks ----------
  function checks(dt, t) {
    const p = claw.position();
    const k = claw.st.scaleK;

    // knocked props
    for (const pr of W.props) {
      if (pr.body.isSleeping()) continue;
      const tr = pr.body.translation();
      if (!pr.moved && Math.hypot(tr.x - pr.spawn.x, tr.z - pr.spawn.z) > 0.7) {
        pr.moved = true;
        if (!pr.elevated) ch.chaos(5, null);
      }
      if (pr.elevated && !pr.knocked && tr.y < pr.spawn.y - 0.45) {
        pr.knocked = true;
        ch.chaos(50, pick(KNOCK), '#ffe14d');
        ch.progress('knock');
      }
    }

    // giant soup pot
    st.boilCd -= dt;
    if (st.boilCd <= 0 && dist2(p, PARK_POT.x, PARK_POT.z) < W.POT_R - 0.25 && p.y < S.soupY + 0.6) {
      st.boilCd = 4;
      st.launchT = 1.3;
      sfx.splash();
      sfx.boom();
      bump('boiled');
      ch.chaos(200, 'SELF-BOILED', '#ff9a3c');
      ch.complete('boil');
      hud.hint('Claw has been boiled. He seems fine.', 2500);
    }
    if (st.launchT > 0) {
      st.launchT -= dt;
      if (st.launchT <= 0) {
        const v = claw.body.linvel();
        claw.body.setLinvel({ x: v.x + (Math.random() - 0.5) * 4, y: 15, z: v.z - 5 }, true);
        hud.popup('TOO SPICY', '#ff4f6d');
      }
    }

    // radio tower top
    const onTower = p.y > S.towerTop - 0.3 && dist2(p, TOWER.x, TOWER.z) < 3;
    if (onTower && !st.towerHere) {
      sfx.ding();
      ch.chaos(150, 'PHONE HOME', '#5ff2ff');
      ch.complete('tower');
    }
    st.towerHere = onTower;

    // higher than the tower
    if (p.y > S.towerTop + 2) {
      if (!ch.isDone('sky')) ch.chaos(300, 'SKY CLAW', '#5ff2ff');
      ch.complete('sky');
    }

    // news spot
    const spot = S.newsSpot;
    if (dist2(p, spot.x, spot.z) < 1.0 && p.y < spot.y + 1.3) {
      st.newsT += dt;
      if (st.newsT > 1.2 && st.liveT <= 0) {
        st.liveT = 10;
        sfx.win();
        ch.chaos(150, 'LIVE ON GLORP CAT NEWS', '#ff4f6d');
        ch.complete('news');
      }
    } else {
      st.newsT = 0;
    }
    st.liveT -= dt;
    S.news.update(t, st.liveT > 0);
    S.newsRing.material.color.setHSL(st.newsT > 0 ? 0.33 : 0.14, 1, 0.55 + 0.1 * Math.sin(t * 6));

    // if I fits I sits
    st.sitCd -= dt;
    let sitting = false;
    if (claw.st.speed < 1.2) {
      for (const pr of W.props) {
        if (pr.kind !== 'box') continue;
        const tr = pr.body.translation();
        const r = pr.body.rotation();
        q.set(r.x, r.y, r.z, r.w).invert();
        v3.set(p.x - tr.x, p.y - tr.y, p.z - tr.z).applyQuaternion(q);
        const h = pr.half;
        if (Math.abs(v3.x) < h.x + 0.15 && Math.abs(v3.z) < h.z + 0.15 && v3.y > -h.y && v3.y < h.y + 0.6) {
          sitting = true;
          break;
        }
      }
    }
    st.sitT = sitting ? st.sitT + dt : 0;
    if (st.sitT > 1 && st.sitCd <= 0) {
      st.sitCd = 6;
      ch.chaos(100, 'IF I FITS I SITS', '#7CFF4F');
      ch.complete('box');
    }

    // Huh Cat
    st.huhCd -= dt;
    if (S.huh && st.huhCd <= 0 && dist2(p, S.huh.position.x, S.huh.position.z) < 2.4) {
      st.huhCd = 4;
      sfx.oiia();
      hud.popup('huh?', '#fff');
      S.huh.scale.set(2.3, 2.3, 1);
      setTimeout(() => S.huh && S.huh.scale.set(1.8, 1.8, 1), 400);
      if (!ch.isDone('huh')) ch.chaos(150, 'FOUND HUH CAT', '#fff');
      ch.complete('huh');
    }

    // dancer
    st.danceCd -= dt;
    if (S.dancer && st.danceCd <= 0 && dist2(p, S.dancer.position.x, S.dancer.position.z) < 2.4) {
      st.danceCd = 3.5;
      hud.popup(pick(['CHIPI CHIPI CHAPA CHAPA', 'DUBI DUBI DABA DABA', 'MAGICO MI DUBI DUBI']), '#7CFF4F');
    }

    // Baby Glorps
    S.babies.forEach((b, i) => {
      if (!b.visible) return;
      if (b.position.distanceTo(v3.set(p.x, p.y, p.z)) < 1.1 * k + 0.2) {
        b.visible = false;
        if (ch.babyFound(i)) {
          sfx.ding();
          ch.chaos(120, `BABY GLORP ${ch.state.babies.length}/5`, '#7CFF4F');
        }
      }
    });

    // flop
    if (claw.st.flopping && claw.st.flopTime > 5 && !ch.isDone('flop')) {
      ch.chaos(150, 'LIQUID CAT', '#ff7bf2');
      ch.complete('flop');
    }
    if (claw.st.flopping && !claw.st.grounded) {
      const av = claw.body.angvel();
      st.spin += Math.hypot(av.x, av.y, av.z) * dt;
    }

    // leaving Ohio
    st.boundsCd -= dt;
    if ((Math.abs(p.x) > BOUNDS - 2 || Math.abs(p.z) > BOUNDS - 2) && st.boundsCd <= 0) {
      st.boundsCd = 3;
      hud.popup("YOU CAN'T LEAVE OHIO", '#ff4f6d');
    }
    if (p.y < -6) claw.teleport(spawn.x, 2, spawn.z);

    // OIIA mode soundtrack
    if (mut.oiia) {
      st.oiiaT -= dt;
      if (st.oiiaT <= 0) {
        st.oiiaT = 0.7;
        sfx.oiia();
      }
    }
  }

  const events = {
    land(air) {
      if (st.spin > Math.PI * 2) {
        const n = Math.floor(st.spin / (Math.PI * 2));
        ch.chaos(40 * n, `OIIA SPIN x${n}`, '#ff7bf2');
      }
      st.spin = 0;
      if (air > 0.9) ch.chaos(Math.round(air * 30), air > 2 ? 'SKIBIDI AIRTIME' : 'BIG AIR', '#5ff2ff');
    },
  };

  function applyMutators() {
    world.gravity = { x: 0, y: mut.gravity ? -6.5 : -20, z: 0 };
    claw.setScale(mut.big ? 2.6 : 1);
    cam.dist = mut.big ? 8.5 : 4.4;
  }

  // ---------- camera ----------
  function updateCamera(dt, input) {
    const sens = touch ? 0.006 : 0.0035;
    cam.yaw -= input.lookX * sens;
    cam.pitch = Math.max(-0.25, Math.min(1.2, cam.pitch + input.lookY * sens));
    const p = claw.position();
    const k = claw.st.scaleK;
    v3.set(p.x, p.y + 0.55 * k, p.z);
    cam.target.lerp(v3, 1 - Math.exp(-14 * dt));
    const cp = Math.cos(cam.pitch);
    const dir = v3b.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
    let d = cam.dist;
    camRay.origin = { x: cam.target.x, y: cam.target.y, z: cam.target.z };
    camRay.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = world.castRay(camRay, d, true, undefined, undefined, undefined, claw.body, (c) => !c.parent() || c.parent().isFixed());
    if (hit) d = Math.max(0.6, hit.timeOfImpact - 0.25);
    camera.position.copy(cam.target).addScaledVector(dir, d);
    camera.lookAt(cam.target);
    hideBlockingTrees();
    // keep the shadow camera around Claw
    S.sun.position.set(p.x + 14, p.y + 26, p.z + 9);
    S.sun.target.position.set(p.x, p.y, p.z);
  }

  // Trees between the camera and Claw get hidden so the canopy never blocks the view.
  function hideBlockingTrees() {
    const ax = camera.position.x;
    const az = camera.position.z;
    const bx = cam.target.x;
    const bz = cam.target.z;
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    for (const tr of S.trees) {
      let u = ((tr.x - ax) * dx + (tr.z - az) * dz) / len2;
      u = Math.max(0, Math.min(1, u));
      const px = ax + dx * u - tr.x;
      const pz = az + dz * u - tr.z;
      tr.mesh.visible = !(px * px + pz * pz < 6.5 && camera.position.y < tr.h);
    }
  }

  // ---------- loop ----------
  const timer = new THREE.Timer();
  let acc = 0;
  let raf = 0;
  let alive = true;
  let fpsT = 0;
  let fpsN = 0;

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();
    if (playing && !menuOpen) {
      const input = controls.consume();
      updateCameraYawOnly(input);
      claw.control(dt, input, cam.yaw, events);
      // trampoline bounce
      if (claw.st.grounded && claw.st.groundCollider && claw.st.groundCollider.handle === S.trampCollider.handle) {
        const v = claw.body.linvel();
        claw.body.setLinvel({ x: v.x, y: 29 * Math.sqrt(claw.st.scaleK), z: v.z }, true);
        sfx.boing();
        S.trampMat.scale.y = 0.2;
        ch.chaos(20, 'BOING', '#5ff2ff');
      }
      if (input.bonk) bonk();
      if (input.lick) lick();
      holdSpring(dt);
      st.bonkCd -= dt;
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 4) {
        world.step();
        acc -= 1 / 60;
        steps++;
      }
      W.syncProps();
      claw.sync(dt, t, mut);
      drawTongue();
      checks(dt, t);
      ch.update(dt);
      hud.setEnergy(claw.st.energy);
      updateCamera(dt, { lookX: 0, lookY: 0 });
      st.saveT += dt;
      if (st.saveT > 5) {
        st.saveT = 0;
        ch.saveBest();
      }
    } else {
      claw.sync(0, t, mut);
      updateCamera(dt, { lookX: 0, lookY: 0 });
      if (!playing) cam.yaw += dt * 0.25;
    }
    S.trampMat.scale.y += (1 - S.trampMat.scale.y) * Math.min(1, dt * 8);
    W.update(dt, t);
    sky.position.copy(camera.position);
    gfx.render(t);

    // drop to Low graphics once if the device is struggling
    fpsT += dt;
    fpsN++;
    if (fpsT > 4) {
      const fps = fpsN / fpsT;
      if (playing && !forceHigh && fps < 28 && gfx.quality === 'high' && !st.autoLow) {
        st.autoLow = true;
        gfx.setQuality('low');
        hud.hint('Graphics set to Low for smoother glorping (change it in the menu).', 4000);
      }
      fpsT = 0;
      fpsN = 0;
    }
  }

  function updateCameraYawOnly(input) {
    const sens = touch ? 0.006 : 0.0035;
    cam.yaw -= input.lookX * sens;
    cam.pitch = Math.max(-0.25, Math.min(1.2, cam.pitch + input.lookY * sens));
  }

  // ---------- menus ----------
  function menuContent() {
    const box = document.createElement('div');
    box.className = 'sim-menu';
    const h = document.createElement('h3');
    h.textContent = `Claw-lenges ${ch.count()}/${ch.CHALLENGES.length}`;
    box.appendChild(h);
    const ul = document.createElement('ul');
    for (const c of ch.CHALLENGES) {
      const li = document.createElement('li');
      const done = ch.isDone(c.id);
      const prog = c.goal && !done ? ` (${ch.state.progress[c.id] || 0}/${c.goal})` : '';
      li.textContent = `${done ? '✅' : '⬜'} ${c.name}${prog}`;
      if (done) li.className = 'done';
      ul.appendChild(li);
    }
    box.appendChild(ul);
    const h2 = document.createElement('h3');
    h2.textContent = 'Mutators';
    box.appendChild(h2);
    const row = document.createElement('div');
    row.className = 'sim-mutators';
    for (const m of ch.MUTATORS) {
      const b = document.createElement('button');
      b.type = 'button';
      const ok = ch.unlocked(m.id);
      b.className = 'btn small' + (mut[m.id] ? ' primary' : '');
      b.disabled = !ok;
      b.textContent = ok ? `${mut[m.id] ? '✔ ' : ''}${m.name}` : `🔒 ${m.name} (${m.need})`;
      b.title = m.desc;
      b.addEventListener('click', () => {
        mut[m.id] = !mut[m.id];
        applyMutators();
        sfx.click();
        openMenu();
      });
      row.appendChild(b);
    }
    box.appendChild(row);
    const h3 = document.createElement('h3');
    h3.textContent = 'Graphics';
    box.appendChild(h3);
    const gfxRow = document.createElement('div');
    gfxRow.className = 'sim-mutators';
    for (const qv of ['high', 'low']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small' + (gfx.quality === qv ? ' primary' : '');
      b.textContent = qv === 'high' ? 'High (bloom, shadows)' : 'Low (fast)';
      b.addEventListener('click', () => {
        gfx.setQuality(qv);
        write('simgfx', qv);
        sfx.click();
        openMenu();
      });
      gfxRow.appendChild(b);
    }
    box.appendChild(gfxRow);
    const help = document.createElement('p');
    help.className = 'sim-help';
    help.textContent = touch
      ? 'Stick: move · Drag: look · JUMP x2: glorp jump · BONK · LICK grabs/throws · FLOP ragdoll · hold ZOOM'
      : 'WASD move · Mouse look (click to lock) · Space jump x2 · F / click bonk · E / right-click lick · R flop · Shift zoomies · P menu';
    box.appendChild(help);
    return box;
  }

  function openMenu() {
    if (!playing) return;
    menuOpen = true;
    controls.setEnabled(false);
    showOverlay(wrap, {
      title: 'PAUSED',
      extra: menuContent(),
      buttons: [
        { label: 'Resume', primary: true, onClick: closeMenu },
        {
          label: 'Respawn',
          onClick: () => {
            claw.setFlop(false);
            claw.teleport(spawn.x, spawn.y + 0.5, spawn.z);
            closeMenu();
          },
        },
        { label: 'Arcade', onClick: () => (location.hash = '') },
      ],
    });
  }

  function closeMenu() {
    hideOverlay(wrap);
    menuOpen = false;
    controls.setEnabled(true);
    controls.requestLock();
  }

  function onLockChange() {
    if (!touch && playing && !menuOpen && !controls.isLocked() && st.hadLock) openMenu();
    st.hadLock = controls.isLocked();
  }
  document.addEventListener('pointerlockchange', onLockChange);

  ch.onComplete(() => {
    // tell players about new toys
    const n = ch.count();
    const m = ch.MUTATORS.find((x) => x.need === n);
    if (m) setTimeout(() => hud.hint(`Mutator unlocked: ${m.name}. Open the menu (${touch ? '☰' : 'P'}) to turn it on.`, 5000), 3400);
  });

  function onVisibility() {
    if (document.hidden && playing && !menuOpen) openMenu();
  }
  document.addEventListener('visibilitychange', onVisibility);

  if (debug) {
    window.__clawSim = { claw, W, ch, mut, cam, gfx, applyMutators, world, camera, scene, renderer, openMenu, closeMenu, get state() { return st; } };
  }

  raf = requestAnimationFrame(frame);

  const start = () => {
    hideOverlay(wrap);
    playing = true;
    controls.setEnabled(true);
    controls.requestLock();
    hud.hint(touch ? 'Left stick to move, drag to look. Go knock stuff off tables.' : 'Click to lock the mouse. Go knock stuff off tables.', 5000);
  };

  return {
    start,
    touch,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ch.saveBest();
      controls.destroy();
      hud.destroy();
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('visibilitychange', onVisibility);
      claw.dispose();
      W.dispose();
      gfx.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      world.free();
      if (window.__clawSim) delete window.__clawSim;
    },
  };
}
