// The bigger Ohio: Glorpville downtown (Glorp Café, Glorp Towers + pool, Matt's House),
// the Zoomies Raceway, the UFO, Lake Meowchigan and the giant Cat Tree.
// Also owns the quest logic for everything out here (see `check`).
import * as THREE from 'three';
import { signTexture, memeSpriteTexture, markerTexture, ropeTexture, checkerTexture } from './textures.js';
import { waterMaterial } from './graphics.js';
import { vashSword } from './vash.js';

export const CAFE = new THREE.Vector3(-20, 0, -64);
export const TOWERS = new THREE.Vector3(24, 0, -66);
export const POOL = new THREE.Vector3(24, 0, -56.5);
export const MATT_HOUSE = new THREE.Vector3(46, 0, -64);
export const RACE = new THREE.Vector3(66, 0, 6);
export const UFO = new THREE.Vector3(70, 0, -34);
export const LAKE = new THREE.Vector3(0, 0, 66);
export const CAT_TREE = new THREE.Vector3(-66, 0, 4);
export const CASINO = new THREE.Vector3(36, 0, -40);
export const SHRINE = new THREE.Vector3(-76, 0, 74);

const RACE_A = 17;
const RACE_B = 24;
const LAKE_RX = 24;
const LAKE_RZ = 16;
const WATER_Y = 0.42;
const POOL_W = 9;
const POOL_D = 6;
const POOL_Y = 0.75;
const TREE_PLATFORMS = 14;
const LAP_TIME = 40;

const X = new THREE.Vector3(1, 0, 0);

export function buildDistricts(ctx) {
  const { B, RAPIER, world, scene, rand, animated, disposables, textures } = ctx;
  const { deco, staticBox, staticModel, solidBox, prop, addBody, fixed, yawQ } = B;
  const clear = [];
  const npcs = [];
  const golds = [];
  const out = { clear, npcs, golds };

  function sign(lines, x, y, z, rotY, w = 4, h = 1.1, o = {}) {
    const tex = signTexture(lines, { w: 512, h: Math.round((512 * h) / w), size: o.size || 70, ...o });
    disposables.push(tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    scene.add(m);
    return m;
  }

  function sprite(tex, x, y, z, w, h) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    s.center.set(0.5, 0);
    s.scale.set(w, h, 1);
    s.position.set(x, y, z);
    scene.add(s);
    return s;
  }

  const markerTex = markerTexture('!');
  disposables.push(markerTex);
  // A quest giver: billboard + bobbing "!" + a line of dialogue.
  function npc(tex, x, y, z, { name, line, quests, size = 1.5 }) {
    const s = sprite(tex, x, y, z, size, size);
    const marker = sprite(markerTex, x, y + size + 0.25, z, 0.6, 0.6);
    const n = { sprite: s, marker, name, line, quests, pos: new THREE.Vector3(x, y, z), talkCd: 0 };
    animated.push((dt, t) => {
      marker.position.y = y + size + 0.25 + Math.sin(t * 3 + x) * 0.12;
    });
    npcs.push(n);
    return n;
  }

  // ---------- Glorpville: road + lamps ----------
  solidBox(0, 0.015, -52, 170, 0.03, 8, '#3b3f4a', { shadow: false, collide: false });
  solidBox(0, 0.02, -52, 170, 0.02, 0.25, '#ffe14d', { shadow: false, collide: false });
  solidBox(12, 0.015, -42, 6, 0.03, 12, '#3b3f4a', { shadow: false, collide: false });
  {
    const N = 24;
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 6), new THREE.MeshStandardMaterial({ color: '#2b2f3a' }), N);
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2b0').multiplyScalar(2.5) }), N);
    const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const x = -78 + (i % 12) * 14;
      const z = i < 12 ? -57 : -47;
      post.setMatrixAt(i, m.makeTranslation(x, 2.1, z));
      bulb.setMatrixAt(i, m.makeTranslation(x, 4.3, z));
      world.createCollider(RAPIER.ColliderDesc.cylinder(2.1, 0.12), fixed(x, 2.1, z));
    }
    post.castShadow = true;
    post.computeBoundingSphere();
    bulb.computeBoundingSphere();
    scene.add(post, bulb);
  }
  for (const x of [-30, -6, 36, 58]) staticModel('k_bench', x, 0, -57.6, Math.PI);

  // ---------- Glorp Café ----------
  {
    const C = CAFE;
    B.room(C.x, C.z, 4, 3, { doors: ['s1'], windows: ['s3', 'w1', 'e1'], floor: '#e7d3b0' });
    for (let i = 0; i < 5; i++) staticModel('k_kitchenBar', C.x - 3.5 + i * 0.95, 0.06, C.z - 2.5, 0);
    staticModel('k_kitchenBarEnd', C.x + 1.33, 0.06, C.z - 2.5, 0);
    prop('k_kitchenCoffeeMachine', C.x - 3.3, 0.98, C.z - 2.5, 0, { density: 0.4 });
    prop('k_kitchenCoffeeMachine', C.x - 1.1, 0.98, C.z - 2.5, 0, { density: 0.4 });
    const mugColors = ['#ff7bf2', '#7CFF4F', '#5ff2ff', '#ffe14d', '#ff9a1f', '#ffffff'];
    const mug = (x, y, z, i) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: mugColors[i % mugColors.length], roughness: 0.4 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.22, 10), mat);
      cup.position.y = 0.11;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), mat);
      handle.position.set(0.13, 0.11, 0);
      g.add(cup, handle);
      g.traverse((o) => (o.castShadow = true));
      return addBody(g, RAPIER.ColliderDesc.cylinder(0.11, 0.12), x, y, z, rand() * 6, 0.11, { density: 0.3, kind: 'mug' });
    };
    let i = 0;
    for (const dx of [-3.0, -2.3, -1.6, -0.6, 0.1, 0.8]) mug(C.x + dx, 0.98, C.z - 2.45, i++);
    for (const [tx, tz] of [[-1.8, 0.6], [2.2, 0.4]]) {
      staticModel('k_tableRound', C.x + tx, 0.06, C.z + tz, 0);
      mug(C.x + tx - 0.3, 0.88, C.z + tz, i++);
      mug(C.x + tx + 0.3, 0.88, C.z + tz + 0.2, i++);
      prop('k_chairRounded', C.x + tx - 1.1, 0.06, C.z + tz, Math.PI / 2, { density: 0.4 });
      prop('k_chairRounded', C.x + tx + 1.1, 0.06, C.z + tz, -Math.PI / 2, { density: 0.4 });
    }
    prop('k_pottedPlant', C.x + 3.8, 0.06, C.z - 2.7, 0, { density: 0.4 });
    sign(['GLORP CAFÉ'], C.x, 3.25, C.z + 3.42, 0, 5, 1.0, { color: '#ff7bf2' });
    out.barista = npc(memeSpriteTexture('happy'), C.x - 1.0, 0.06, C.z - 3.0, {
      name: 'BARISTA CAT',
      line: 'Knock my mugs off, I dare you. Also: bring me a fish from the dock. Lick it to carry it.',
      quests: ['mugs', 'fish'],
    });
    out.cafeRect = { x0: C.x - 4.4, x1: C.x + 4.4, z0: C.z - 3.3, z1: C.z + 3.3 };
    clear.push([C.x, C.z, 8]);
  }

  // ---------- Glorp Towers (3 floors + roof) and the pool ----------
  {
    const T = TOWERS;
    const W = 8.8;
    const D = 6.6;
    B.room(T.x, T.z, 4, 3, { doors: ['s1'], windows: ['s3', 'n1', 'n2', 'w1'], floor: '#bfc6d6' });
    solidBox(T.x, 2.9, T.z, W, 0.2, D, '#d9dde6');
    B.room(T.x, T.z, 4, 3, { y: 3, floor: null, doors: ['e0'], windows: ['s1', 's2', 'n1', 'n2', 'w1'] });
    solidBox(T.x, 5.9, T.z, W, 0.2, D, '#d9dde6');
    B.room(T.x, T.z, 4, 3, { y: 6, floor: null, doors: ['s3'], windows: ['s1', 'n1', 'n2', 'w1', 'e1'] });
    solidBox(T.x, 8.9, T.z, W + 0.3, 0.2, D + 0.3, '#9aa3b5');
    // roof parapet (gap on the south for the diving board, east for the stairs)
    solidBox(T.x - 2.5, 9.25, T.z + D / 2, 3.8, 0.5, 0.2, '#9aa3b5');
    solidBox(T.x + 3.0, 9.25, T.z + D / 2, 2.8, 0.5, 0.2, '#9aa3b5');
    solidBox(T.x, 9.25, T.z - D / 2, W, 0.5, 0.2, '#9aa3b5');
    solidBox(T.x - W / 2, 9.25, T.z, 0.2, 0.5, D, '#9aa3b5');
    // floors' furniture
    prop('k_loungeSofa', T.x - 2.5, 0.06, T.z - 2.4, 0, { density: 0.8 });
    prop('k_pottedPlant', T.x + 3.8, 0.06, T.z - 2.6, 0, { density: 0.4 });
    prop('k_coatRackStanding', T.x + 3.6, 0.06, T.z + 2.2, 0, { density: 0.3 });
    prop('k_bedDouble', T.x - 2.6, 3.0, T.z - 1.8, 0, { density: 0.6 });
    prop('k_toilet', T.x + 3.4, 3.0, T.z + 2.4, Math.PI, { density: 0.5 });
    prop('k_bathtub', T.x + 1.8, 3.0, T.z - 2.5, 0, { density: 0.6 });
    prop('k_washer', T.x - 3.6, 6.0, T.z - 2.6, 0, { density: 0.6 });
    prop('k_televisionVintage', T.x - 0.5, 6.0, T.z - 2.7, 0, { density: 0.4 });
    prop('k_loungeDesignSofa', T.x - 0.5, 6.0, T.z + 0.5, Math.PI, { density: 0.7 });
    prop('k_speaker', T.x + 3.5, 6.0, T.z - 2.6, 0, { density: 0.4 });
    staticModel('k_bench', T.x - 2, 9.0, T.z - 2.4, 0);
    prop('k_plantSmall1', T.x + 2, 9.0, T.z - 2.6, 0, { density: 0.3 });
    prop('k_plantSmall3', T.x + 2.6, 9.0, T.z - 2.6, 0, { density: 0.3 });
    // fire escape: switchback ramps on the east side
    const ex = T.x + W / 2;
    const ramp = (x, y0, y1, zStart, zEnd) => {
      const len = Math.abs(zEnd - zStart);
      const ang = Math.atan2(y1 - y0, len) * (zEnd < zStart ? 1 : -1);
      const q = new THREE.Quaternion().setFromAxisAngle(X, ang);
      solidBox(x, (y0 + y1) / 2, (zStart + zEnd) / 2, 1.4, 0.18, Math.hypot(len, y1 - y0) + 0.3, '#5a6273', { rotQ: q });
    };
    ramp(ex + 1.4, 0, 3, T.z + 4.8, T.z - 2.6);
    solidBox(ex + 2.1, 2.9, T.z - 3.5, 2.9, 0.2, 1.8, '#5a6273');
    ramp(ex + 2.8, 3, 6, T.z - 2.6, T.z + 4.8);
    solidBox(ex - 0.6, 5.9, T.z + 5.6, 6.6, 0.2, 1.8, '#5a6273');
    ramp(ex + 1.4, 6, 9, T.z + 4.8, T.z - 2.6);
    solidBox(ex + 0.7, 8.9, T.z - 3.5, 2.8, 0.2, 1.8, '#5a6273');
    // diving board
    solidBox(T.x, 9.1, T.z + D / 2 + 1.3, 1.0, 0.12, 2.8, '#ffffff');
    sign(['GLORP TOWERS'], T.x, 10.4, T.z + D / 2 + 0.05, 0, 5, 1.0, { color: '#5ff2ff' });
    out.roofY = 9.0;
    // pool
    const P = POOL;
    const rim = '#f2f2f2';
    solidBox(P.x, 0.45, P.z - POOL_D / 2, POOL_W + 0.6, 0.9, 0.3, rim);
    solidBox(P.x, 0.45, P.z + POOL_D / 2, POOL_W + 0.6, 0.9, 0.3, rim);
    solidBox(P.x - POOL_W / 2, 0.45, P.z, 0.3, 0.9, POOL_D, rim);
    solidBox(P.x + POOL_W / 2, 0.45, P.z, 0.3, 0.9, POOL_D, rim);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(POOL_W, POOL_D), waterMaterial({ shallow: '#6ee7ff', deep: '#1a8fd6', round: false }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(P.x, POOL_Y, P.z);
    scene.add(water);
    out.poolRect = { x0: P.x - POOL_W / 2, x1: P.x + POOL_W / 2, z0: P.z - POOL_D / 2, z1: P.z + POOL_D / 2 };
    clear.push([T.x, T.z, 9], [P.x, P.z, 7]);
  }

  // ---------- Matt's House ----------
  {
    const M = MATT_HOUSE;
    B.room(M.x, M.z, 3, 3, { doors: ['s1'], windows: ['n1', 'w1', 'e1'], floor: '#b98b5e' });
    deco('k_rugRound', M.x, 0.06, M.z, 0, 1, false);
    prop('k_bedDouble', M.x + 1.6, 0.06, M.z - 1.9, 0, { density: 0.6 });
    prop('k_televisionVintage', M.x - 2.4, 0.06, M.z - 2.6, 0, { density: 0.4 });
    prop('k_loungeChairRelax', M.x - 1.8, 0.06, M.z + 0.8, Math.PI, { density: 0.5 });
    prop('k_plantSmall2', M.x + 2.7, 0.06, M.z + 2.6, 0, { density: 0.3 });
    if (textures.matt) {
      const frameMat = new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.5, roughness: 0.4 });
      const picMat = new THREE.MeshBasicMaterial({ map: textures.matt });
      for (const [x, z, r] of [[M.x - 1, M.z - 3.2, 0], [M.x - 3.2, M.z, Math.PI / 2], [M.x + 3.2, M.z + 0.6, -Math.PI / 2]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.06), frameMat);
        f.position.set(x, 1.8, z);
        f.rotation.y = r;
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), picMat);
        pic.position.set(x, 1.8, z).add(new THREE.Vector3(0, 0, 0.04).applyAxisAngle(new THREE.Vector3(0, 1, 0), r));
        pic.rotation.y = r;
        scene.add(f, pic);
      }
      out.matt = npc(textures.matt, M.x, 0, M.z + 5.2, {
        name: 'MATT',
        line: 'I lost my headphones somewhere on the giant Cat Tree. Lick them and bring them back to me!',
        quests: ['headphones'],
        size: 1.8,
      });
    }
    // Matt's very tall shelf, with Vash's sword on top (he can't reach it)
    solidBox(M.x - 2.85, 1.3, M.z + 2.3, 0.5, 2.6, 1.3, '#6b4226');
    for (const y of [0.5, 1.15, 1.8]) deco('k_books', M.x - 2.55, y, M.z + 2.3, Math.PI / 2, 1, false);
    const swordG = new THREE.Group();
    const swordM = vashSword();
    swordM.position.x = -0.145; // centre the blade over its collider
    swordG.add(swordM);
    out.vashSword = addBody(swordG, RAPIER.ColliderDesc.cuboid(0.26, 0.03, 0.08), M.x - 2.8, 2.62, M.z + 2.3, 0.3, 0.03, { density: 0.3, kind: 'vashsword' });
    out.vashHome = new THREE.Vector3(M.x - 2.6, 0, M.z + 5.0);
    sign(["MATT'S HOUSE"], M.x, 3.2, M.z + 3.42, 0, 4.4, 0.9, { color: '#ffe14d' });
    clear.push([M.x, M.z, 7]);
  }

  // ---------- shops (closed) ----------
  solidBox(-46, 2.5, -65, 11, 5, 8, '#e8e2d0');
  sign(['OHIO MART'], -46, 4.2, -60.95, 0, 6, 1.2, { color: '#ff4f6d' });
  solidBox(-66, 2, -64, 8, 4, 7, '#f4f4f4');
  sign(['VET (NOPE)'], -66, 3.3, -60.45, 0, 5, 1.1, { color: '#ff4f6d', bg: '#fff', border: '#ff4f6d' });
  solidBox(68, 3, -65, 10, 6, 8, '#2b2b3a');
  sign(['HAMPTER WORKS'], 68, 4.8, -60.95, 0, 7, 1.2, { color: '#7CFF4F' });
  clear.push([-46, -65, 8], [-66, -64, 6], [68, -65, 8]);

  // ---------- Glorp Casino (Matt owns it) ----------
  {
    const K = CASINO;
    solidBox(K.x, 3, K.z, 11, 6, 8, '#2a0b4a');
    solidBox(K.x, 6.15, K.z, 11.6, 0.3, 8.6, '#ffd23f');
    const front = K.z - 4.02;
    // neon sign, over-bright so it blooms
    const neonTex = signTexture(['GLORP CASINO'], { w: 512, h: 128, size: 92, bg: '#12041f', border: '#ff7bf2', color: '#7CFF4F' });
    disposables.push(neonTex);
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: neonTex, color: new THREE.Color(1.7, 1.7, 1.7) }));
    neon.position.set(K.x, 4.4, front - 0.02);
    neon.rotation.y = Math.PI;
    scene.add(neon);
    const doorTex = signTexture(['THE HOUSE', 'ALWAYS WINS'], { w: 512, h: 256, size: 64, bg: '#1d0b33', border: '#ffd23f', colors: ['#ffd23f', '#ff7bf2'] });
    disposables.push(doorTex);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: doorTex }));
    door.position.set(K.x, 1.7, front - 0.02);
    door.rotation.y = Math.PI;
    scene.add(door);
    // blinking marquee bulbs around the sign
    const nb = 26;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), nb);
    const bm = new THREE.Matrix4();
    for (let i = 0; i < nb; i++) {
      const tt = i / nb;
      const per = 2 * (8.4 + 2.4);
      let d = tt * per;
      let bx;
      let by;
      if (d < 8.4) [bx, by] = [-4.2 + d, 5.6];
      else if ((d -= 8.4) < 2.4) [bx, by] = [4.2, 5.6 - d];
      else if ((d -= 2.4) < 8.4) [bx, by] = [4.2 - d, 3.2];
      else [bx, by] = [-4.2, 3.2 + (d - 8.4)];
      bulbs.setMatrixAt(i, bm.makeTranslation(K.x - bx, by, front - 0.12));
    }
    bulbs.computeBoundingSphere();
    scene.add(bulbs);
    const bc = new THREE.Color();
    animated.push((dt, t) => {
      const step = Math.floor(t * 6);
      for (let i = 0; i < nb; i++) bulbs.setColorAt(i, (i + step) % 3 === 0 ? bc.set('#ffe14d').multiplyScalar(3) : bc.set('#552200'));
      bulbs.instanceColor.needsUpdate = true;
    });
    // slot machine
    const slot = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.9), new THREE.MeshStandardMaterial({ color: '#c0182f', metalness: 0.4, roughness: 0.4 }));
    cab.position.y = 1.05;
    const screenTex = signTexture(['🎰', 'SLOTS'], { w: 256, h: 256, size: 80, bg: '#12041f', border: '#ffd23f', colors: ['#fff', '#ffd23f'] });
    disposables.push(screenTex);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color(1.4, 1.4, 1.4) }));
    scr.position.set(0, 1.45, -0.46);
    scr.rotation.y = Math.PI;
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.9 }));
    lever.position.set(0.75, 1.6, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff2a2a' }));
    knob.position.set(0.75, 2.05, 0);
    slot.add(cab, scr, lever, knob);
    slot.traverse((o) => (o.castShadow = true));
    slot.position.set(K.x - 3.6, 0, front - 1.2);
    scene.add(slot);
    staticBox(slot.position.x, 1.05, slot.position.z, 0.65, 1.05, 0.45);
    // Cat Crate vending machine
    const vend = new THREE.Group();
    const vcab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.3, 1.0), new THREE.MeshStandardMaterial({ color: '#4f2a9a', metalness: 0.3, roughness: 0.5 }));
    vcab.position.y = 1.15;
    const vTex = signTexture(['CAT', 'CRATES'], { w: 256, h: 256, size: 86, bg: '#12041f', border: '#7CFF4F', colors: ['#7CFF4F', '#ff7bf2'] });
    disposables.push(vTex);
    const vscr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: vTex, color: new THREE.Color(1.4, 1.4, 1.4) }));
    vscr.position.set(0, 1.4, -0.51);
    vscr.rotation.y = Math.PI;
    vend.add(vcab, vscr);
    vend.traverse((o) => (o.castShadow = true));
    vend.position.set(K.x + 3.6, 0, front - 1.2);
    scene.add(vend);
    staticBox(vend.position.x, 1.15, vend.position.z, 0.8, 1.15, 0.5);
    deco('k_cardboardBoxClosed', vend.position.x, 2.3, vend.position.z, 0.3, 0.8);
    // more machines on both flanks of the building
    function cabinet(lines, body, border, colors, x, z, rotY, w = 1.4, h = 2.2) {
      const g = new THREE.Group();
      const cb = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.9), new THREE.MeshStandardMaterial({ color: body, metalness: 0.35, roughness: 0.45 }));
      cb.position.y = h / 2;
      const tex = signTexture(lines, { w: 256, h: 256, size: 64, bg: '#12041f', border, colors });
      disposables.push(tex);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, w - 0.3), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.4, 1.4, 1.4) }));
      sc.position.set(0, h * 0.62, 0.46);
      g.add(cb, sc);
      g.traverse((o) => (o.castShadow = true));
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      scene.add(g);
      const c = Math.abs(Math.cos(rotY));
      staticBox(x, h / 2, z, c > 0.5 ? w / 2 : 0.45, h / 2, c > 0.5 ? 0.45 : w / 2);
      return g;
    }
    // Pet Crate vending machine (east of the door)
    const petVend = cabinet(['🐾', 'PET', 'CRATES'], '#1f7a6a', '#ff7bf2', ['#fff', '#7CFF4F', '#ff7bf2'], K.x + 7.4, front - 1.0, Math.PI, 1.6, 2.3);
    deco('k_cardboardBoxOpen', petVend.position.x, 2.3, petVend.position.z, 0.6, 0.8);
    // Plinko cabinet (west side) and the Pet Derby screen (east side)
    const plinko = cabinet(['🧶', 'PLINKO', 'PAWS'], '#c25cff', '#ffd23f', ['#fff', '#ffd23f', '#7CFF4F'], K.x - 7.1, K.z + 1.2, -Math.PI / 2);
    const derby = cabinet(['🏁', 'PET', 'DERBY'], '#2a6fdb', '#7CFF4F', ['#fff', '#7CFF4F', '#ffd23f'], K.x + 7.1, K.z + 1.2, Math.PI / 2, 1.8, 2.4);
    // Wheel of Glorp: a big spinning prize wheel on a stand (west of the door)
    const wheelPos = new THREE.Vector3(K.x - 7.6, 0, front - 1.0);
    {
      const cvs = document.createElement('canvas');
      cvs.width = cvs.height = 256;
      const g2 = cvs.getContext('2d');
      const cols = ['#c0182f', '#2a6fdb', '#ff7bf2', '#2f9e44', '#6b4226', '#8a3cff', '#4fd8ff', '#ff9a3c', '#c0182f', '#2f9e44', '#2a6fdb', '#ffb000'];
      const seg = (Math.PI * 2) / cols.length;
      cols.forEach((c, i) => {
        g2.beginPath();
        g2.moveTo(128, 128);
        g2.arc(128, 128, 126, i * seg, (i + 1) * seg);
        g2.closePath();
        g2.fillStyle = c;
        g2.fill();
        g2.strokeStyle = '#111';
        g2.lineWidth = 3;
        g2.stroke();
      });
      g2.beginPath();
      g2.arc(128, 128, 26, 0, Math.PI * 2);
      g2.fillStyle = '#ffd23f';
      g2.fill();
      const wtex = new THREE.CanvasTexture(cvs);
      wtex.colorSpace = THREE.SRGBColorSpace;
      disposables.push(wtex);
      const wheel = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), new THREE.MeshBasicMaterial({ map: wtex, color: new THREE.Color(1.25, 1.25, 1.25) }));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.08, 8, 40), new THREE.MeshStandardMaterial({ color: '#ffd23f', metalness: 0.7, roughness: 0.3 }));
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), new THREE.MeshStandardMaterial({ color: '#2a0b4a' }));
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.9), new THREE.MeshStandardMaterial({ color: '#2a0b4a' }));
      const tick = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 4), new THREE.MeshStandardMaterial({ color: '#7CFF4F', emissive: '#2a8a1a' }));
      const g = new THREE.Group();
      stand.position.y = 0.8;
      base.position.y = 0.125;
      wheel.position.set(0, 2.9, -0.2);
      rim.position.copy(wheel.position);
      tick.position.set(0, 4.35, -0.2);
      tick.rotation.z = Math.PI;
      wheel.rotation.y = rim.rotation.y = Math.PI;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 10), stand.material);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(0, 2.9, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), stand.material);
      arm.position.set(0, 2.2, 0);
      g.add(stand, base, wheel, rim, tick, hub, arm);
      g.traverse((o) => (o.castShadow = true));
      g.position.copy(wheelPos);
      scene.add(g);
      staticBox(wheelPos.x, 1.4, wheelPos.z, 0.8, 1.4, 0.45);
      animated.push((dt, t) => (wheel.rotation.z = t * 0.6));
    }
    out.casino = {
      slots: slot.position.clone(),
      crate: vend.position.clone(),
      petcrate: petVend.position.clone(),
      wheel: wheelPos.clone(),
      plinko: plinko.position.clone(),
      derby: derby.position.clone(),
    };
    clear.push([K.x - 8, K.z, 3], [K.x + 8, K.z, 3]);
    if (textures.matt) {
      npc(textures.matt, K.x, 0, front - 1.6, { name: 'MATT (OWNER)', line: 'Welcome to my casino. The house always wins. The house is me.', quests: [], size: 1.8 });
    }
    clear.push([K.x, K.z, 9]);
  }

  // ---------- the secret Vash Shrine (no sign, no map marker) ----------
  {
    const S = SHRINE; // faces +x
    const stone = '#8a8f99';
    solidBox(S.x, 0.06, S.z, 6, 0.12, 6, stone, { shadow: false });
    for (let i = 0; i < 4; i++) solidBox(S.x + 3.8 + i * 1.3, 0.03, S.z + Math.sin(i) * 0.3, 0.9, 0.06, 0.9, '#9aa0a8', { shadow: false, collide: false });
    // torii gate
    const pillar = '#2a1a3d';
    for (const dz of [-1.3, 1.3]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.7, 10), new THREE.MeshStandardMaterial({ color: pillar }));
      m.position.set(S.x + 2.4, 1.35, S.z + dz);
      m.castShadow = true;
      scene.add(m);
      world.createCollider(RAPIER.ColliderDesc.cylinder(1.35, 0.15), fixed(S.x + 2.4, 1.35, S.z + dz));
    }
    solidBox(S.x + 2.4, 2.75, S.z, 0.32, 0.2, 3.6, '#6b3cc9');
    solidBox(S.x + 2.4, 2.3, S.z, 0.2, 0.12, 2.9, pillar);
    for (const dz of [-1.85, 1.85]) solidBox(S.x + 2.4, 2.75, S.z + dz, 0.36, 0.24, 0.12, '#ffcc33', { collide: false });
    const plaque = sign(['VASH'], S.x + 2.56, 2.52, S.z, Math.PI / 2, 0.9, 0.36, { size: 60, color: '#ffcc33', bg: '#2a1a3d', border: '#ffcc33' });
    plaque.material.color.setScalar(1.2);
    // shrine house: back wall + roof
    solidBox(S.x - 2.4, 1.5, S.z, 0.3, 3, 4.4, '#3a2c34');
    solidBox(S.x - 1.9, 3.1, S.z, 1.6, 0.18, 5.0, '#6b3cc9', { collide: false });
    // hidden: a hedge ring and pines all round, open only toward the lake (+x)
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6) continue;
      deco(i % 3 ? 'n_Bush_1' : 'n_BushBerries_1', S.x + Math.cos(a) * 4.9, 0, S.z + Math.sin(a) * 4.9, a, 1.5);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.7) continue;
      const tx = S.x + Math.cos(a) * 7.6;
      const tz = S.z + Math.sin(a) * 7.6;
      deco(`n_PineTree_${(i % 3) + 1}`, tx, 0, tz, a, 1.2);
      world.createCollider(RAPIER.ColliderDesc.cylinder(1.6, 0.3), fixed(tx, 1.6, tz));
    }
    // portrait
    if (textures.vash) {
      const img = textures.vash.image;
      const h = 2.0;
      const w = (h * img.width) / img.height;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, h + 0.16, w + 0.16), new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.6, roughness: 0.35 }));
      const pz = S.z - 1.0;
      frame.position.set(S.x - 2.2, 1.55, pz);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textures.vash, transparent: true, alphaTest: 0.2 }));
      pic.position.set(S.x - 2.16, 1.55, pz);
      pic.rotation.y = Math.PI / 2;
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#1d0b33' }));
      back.position.set(S.x - 2.165, 1.55, pz);
      back.rotation.y = Math.PI / 2;
      scene.add(frame, back, pic);
    }
    // pedestal for the gold statue (game.js puts the statue on it)
    solidBox(S.x - 0.9, 0.5, S.z + 0.9, 0.9, 0.9, 0.9, '#4a4f5a');
    solidBox(S.x - 0.9, 0.97, S.z + 0.9, 1.0, 0.06, 1.0, '#ffcc33', { collide: false });
    out.shrine = { statue: new THREE.Vector3(S.x - 0.9, 1.0, S.z + 0.9), altar: new THREE.Vector3(S.x + 0.6, 0, S.z) };
    // offering: a fish on a plate
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.04, 14), new THREE.MeshStandardMaterial({ color: '#f4f4f4' }));
    plate.position.set(S.x + 0.05, 0.14, S.z);
    const fish = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff9a3c' }));
    fish.scale.set(1.2, 0.45, 0.6);
    fish.position.set(S.x + 0.05, 0.2, S.z);
    scene.add(plate, fish);
    // purple lanterns + flickering candles
    const lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#b48cff').multiplyScalar(2.2) });
    for (const dz of [-1.9, 1.9]) {
      solidBox(S.x + 0.9, 0.55, S.z + dz, 0.12, 1.1, 0.12, pillar);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), lanternMat);
      l.position.set(S.x + 0.9, 1.3, S.z + dz);
      scene.add(l);
      solidBox(S.x + 0.9, 1.56, S.z + dz, 0.46, 0.08, 0.46, '#2a1a3d', { collide: false });
    }
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(2.4) });
    const flames = [];
    for (const [dx, dz] of [[0.2, -0.85], [0.2, 0.85], [-0.1, -1.2], [-0.1, 1.2]]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), new THREE.MeshStandardMaterial({ color: '#fff6e0' }));
      c.position.set(S.x + dx, 0.23, S.z + dz);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), flameMat);
      f.position.set(S.x + dx, 0.37, S.z + dz);
      scene.add(c, f);
      flames.push(f);
    }
    animated.push((dt, t) => flames.forEach((f, i) => f.scale.set(1, 1.2 + Math.sin(t * 13 + i * 2) * 0.35, 1)));
    clear.push([S.x, S.z, 8]);
  }

  // ---------- Zoomies Raceway ----------
  {
    const R = RACE;
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, RACE_A + 2.6, RACE_B + 2.6, 0, Math.PI * 2);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, RACE_A - 2.6, RACE_B - 2.6, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const track = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64), new THREE.MeshStandardMaterial({ color: '#b8875a', roughness: 1 }));
    track.rotation.x = -Math.PI / 2;
    track.position.set(R.x, 0.025, R.z);
    track.receiveShadow = true;
    scene.add(track);
    const checker = checkerTexture();
    disposables.push(checker);
    const postMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const colors = ['#ff4f6d', '#ff9a1f', '#ffe14d', '#7CFF4F', '#5ff2ff', '#a03cff'];
    out.checkpoints = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cx = R.x + RACE_A * Math.cos(a);
      const cz = R.z + RACE_B * Math.sin(a);
      const nrm = new THREE.Vector3(Math.cos(a) / RACE_A, 0, Math.sin(a) / RACE_B).normalize();
      const yaw = Math.atan2(nrm.x, nrm.z) + Math.PI / 2;
      for (const s of [-1, 1]) {
        const px = cx + nrm.x * 3 * s;
        const pz = cz + nrm.z * 3 * s;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.6, 8), postMat);
        post.position.set(px, 1.8, pz);
        post.castShadow = true;
        scene.add(post);
        world.createCollider(RAPIER.ColliderDesc.cylinder(1.8, 0.15), fixed(px, 1.8, pz));
      }
      const banner = new THREE.Mesh(
        new THREE.BoxGeometry(6.3, 0.8, 0.12),
        i === 0 ? new THREE.MeshStandardMaterial({ map: checker }) : new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.35 })
      );
      banner.position.set(cx, 3.6, cz);
      banner.rotation.y = yaw;
      scene.add(banner);
      out.checkpoints.push({ pos: new THREE.Vector3(cx, 0, cz), banner });
    }
    // cones
    const coneGeo = new THREE.ConeGeometry(0.28, 0.75, 10);
    coneGeo.translate(0, 0.375, 0);
    const coneMat = new THREE.MeshStandardMaterial({ color: '#ff7a1a' });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + 0.2;
      const r = k % 2 ? 1.0 : 0.82;
      addBody(new THREE.Mesh(coneGeo, coneMat), RAPIER.ColliderDesc.cone(0.375, 0.28), R.x + RACE_A * r * Math.cos(a), 0, R.z + RACE_B * r * Math.sin(a), 0, 0.375, { density: 0.2, kind: 'cone' });
    }
    // bleachers
    for (let s = 0; s < 4; s++) solidBox(R.x + RACE_A + 6 + s * 0.9, 0.3 + s * 0.45, R.z, 0.9, 0.6 + s * 0.9, 12, '#c0c6d2');
    out.marshal = npc(memeSpriteTexture('popcat'), R.x + RACE_A + 3.6, 0.03, R.z + 4.5, {
      name: 'RACE MARSHAL',
      line: `Zoom through all 6 arches in order, starting at the checkered one, in ${LAP_TIME} seconds. Hold Shift / ZOOM!`,
      quests: ['lap'],
    });
    clear.push([R.x, R.z, 27]);
  }

  // ---------- UFO ----------
  {
    const U = UFO;
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.LatheGeometry([new THREE.Vector2(0.01, -0.6), new THREE.Vector2(2.2, -0.35), new THREE.Vector2(4.2, 0), new THREE.Vector2(2.4, 0.45), new THREE.Vector2(0.01, 0.6)], 32),
      new THREE.MeshStandardMaterial({ color: '#c8cfdb', metalness: 0.8, roughness: 0.25 })
    );
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7CFF4F', emissive: '#3cff3c', emissiveIntensity: 0.8, transparent: true, opacity: 0.8 }));
    dome.position.y = 0.4;
    g.add(hull, dome);
    const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 12);
    const lm = new THREE.Matrix4();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      lights.setMatrixAt(i, lm.makeTranslation(Math.cos(a) * 3.6, 0.05, Math.sin(a) * 3.6));
    }
    g.add(lights);
    g.position.set(U.x, 13, U.z);
    scene.add(g);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 3.4, 12.5, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: '#9dff6a', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    beam.position.set(U.x, 6.25, U.z);
    scene.add(beam);
    const crop = new THREE.Mesh(new THREE.RingGeometry(4, 4.6, 48), new THREE.MeshBasicMaterial({ color: '#d9c27a' }));
    crop.rotation.x = -Math.PI / 2;
    crop.position.set(U.x, 0.03, U.z);
    scene.add(crop);
    const col = new THREE.Color();
    animated.push((dt, t) => {
      g.rotation.y += dt * 0.8;
      g.position.y = 13 + Math.sin(t * 1.2) * 0.4;
      beam.material.opacity = 0.14 + Math.sin(t * 5) * 0.05;
      for (let i = 0; i < 12; i++) lights.setColorAt(i, col.setHSL(((i / 12 + t * 0.5) % 1), 1, 0.6).multiplyScalar(2));
      lights.instanceColor.needsUpdate = true;
    });
    npc(memeSpriteTexture('oiia'), U.x + 6, 0, U.z + 3, { name: 'OIIA CAT', line: 'Step into the beam. They want to study you. oiia oiia.', quests: ['ufo'] });
    clear.push([U.x, U.z, 7]);
  }

  // ---------- Lake Meowchigan ----------
  {
    const L = LAKE;
    const sand = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#ecd9a5', roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.scale.set(LAKE_RX + 5, LAKE_RZ + 5, 1);
    sand.position.set(L.x, 0.015, L.z);
    sand.receiveShadow = true;
    scene.add(sand);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMaterial());
    water.rotation.x = -Math.PI / 2;
    water.scale.set(LAKE_RX, LAKE_RZ, 1);
    water.position.set(L.x, WATER_Y, L.z);
    scene.add(water);
    // island with a palm
    solidBox(L.x + 10, 0.3, L.z + 4, 6, 0.6, 5, '#ecd9a5', { shadow: false });
    // visual palm + trunk-only collider (a full bounding box would swallow the whole island)
    deco('n_PalmTree_2', L.x + 10, 0.6, L.z + 4, 1.2, 0.8);
    world.createCollider(RAPIER.ColliderDesc.cylinder(1.6, 0.3), fixed(L.x + 10, 0.6 + 1.6, L.z + 4));
    for (let i = 0; i < 6; i++) deco('n_Lilypad', L.x - 14 + rand() * 24, WATER_Y + 0.02, L.z + rand() * 12 - 6, rand() * 6, 0.9, false);
    // dock
    const dx = L.x - 10;
    solidBox(dx, 0.7, L.z - 9, 2.6, 0.2, 13, '#8b5a2b');
    for (let k = 0; k < 4; k++) {
      solidBox(dx - 1.2, 0.35, L.z - 14 + k * 3.6, 0.25, 0.7, 0.25, '#5d3a1a', { collide: false });
      solidBox(dx + 1.2, 0.35, L.z - 14 + k * 3.6, 0.25, 0.7, 0.25, '#5d3a1a', { collide: false });
    }
    out.dockRect = { x0: dx - 1.3, x1: dx + 1.3, z0: L.z - 15.5, z1: L.z - 2.5 };
    out.fishSpot = new THREE.Vector3(dx + 0.6, 0.8, L.z - 4.2);
    out.islandRect = { x0: L.x + 7, x1: L.x + 13, z0: L.z + 1.5, z1: L.z + 6.5 };
    // fish
    const fishMat = new THREE.MeshStandardMaterial({ color: '#8fb6d9', metalness: 0.3, roughness: 0.4 });
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), fishMat);
      body.scale.set(1.1, 0.5, 0.35);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 4), fishMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.42;
      f.add(body, tail);
      f.traverse((o) => (o.castShadow = true));
      addBody(f, RAPIER.ColliderDesc.cuboid(0.36, 0.13, 0.12), dx - 0.6 + k * 0.6, 0.8, L.z - 4.5 - k * 0.8, rand() * 6, 0.13, { density: 0.3, kind: 'fish', centered: true });
    }
    out.fisher = npc(memeSpriteTexture('banana'), dx, 0.8, L.z - 2.8, {
      name: 'FISHER CAT',
      line: "Don't steal my fish (lick one to the Glorp Café). Or catch your own: stand at the end of the dock and press E.",
      quests: ['fish', 'fishing', 'golden'],
    });
    // beach stuff
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4;
      deco(k % 2 ? 'n_PalmTree_1' : 'n_PalmTree_2', L.x + Math.cos(a) * (LAKE_RX + 3.2), 0, L.z + Math.sin(a) * (LAKE_RZ + 3.2), rand() * 6, 0.7);
    }
    const towelCols = ['#ff7bf2', '#5ff2ff', '#ffe14d'];
    for (let k = 0; k < 3; k++) solidBox(L.x + 6 + k * 3, 0.03, L.z - LAKE_RZ - 2.6, 1.4, 0.04, 2.4, towelCols[k], { collide: false, shadow: false });
    clear.push([L.x, L.z, LAKE_RX + 6]);
  }

  // ---------- giant Cat Tree ----------
  {
    const K = CAT_TREE;
    const rope = ropeTexture();
    disposables.push(rope);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 23, 16), new THREE.MeshStandardMaterial({ map: rope, roughness: 1 }));
    trunk.position.set(K.x, 11.5, K.z);
    trunk.castShadow = true;
    scene.add(trunk);
    world.createCollider(RAPIER.ColliderDesc.cylinder(11.5, 1.0), fixed(K.x, 11.5, K.z));
    const plat = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.0, 2.0, 0.3, 16), new THREE.MeshStandardMaterial({ roughness: 1 }), TREE_PLATFORMS);
    plat.castShadow = plat.receiveShadow = true;
    const carpets = [new THREE.Color('#c98bdb'), new THREE.Color('#8bc7db'), new THREE.Color('#f2a6c4')];
    out.treePlatforms = [];
    for (let i = 0; i < TREE_PLATFORMS; i++) {
      const a = i * 1.15;
      const h = 1.3 + i * 1.45;
      const x = K.x + Math.cos(a) * 2.7;
      const z = K.z + Math.sin(a) * 2.7;
      plat.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, h, z));
      plat.setColorAt(i, carpets[i % 3]);
      world.createCollider(RAPIER.ColliderDesc.cylinder(0.15, 2.0), fixed(x, h, z));
      out.treePlatforms.push(new THREE.Vector3(x, h + 0.15, z));
    }
    plat.computeBoundingSphere();
    scene.add(plat);
    const topY = 1.3 + TREE_PLATFORMS * 1.45;
    solidBox(K.x, topY, K.z, 6, 0.4, 6, '#c98bdb');
    out.treeTop = topY + 0.2;
    // the crown
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd23f', metalness: 0.9, roughness: 0.25, emissive: '#ffb000', emissiveIntensity: 0.4 });
    const crown = new THREE.Group();
    crown.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 8, 24), gold));
    crown.children[0].rotation.x = Math.PI / 2;
    for (let k = 0; k < 6; k++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), gold);
      const a = (k / 6) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.7, 0.3, Math.sin(a) * 0.7);
      crown.add(spike);
    }
    crown.position.set(K.x, topY + 1.4, K.z);
    scene.add(crown);
    animated.push((dt, t) => {
      crown.rotation.y += dt;
      crown.position.y = topY + 1.4 + Math.sin(t * 2) * 0.15;
    });
    // giant yarn ball at the base
    const yarn = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), new THREE.MeshStandardMaterial({ color: '#ff5a7a', roughness: 0.9 }));
    yarn.castShadow = true;
    addBody(yarn, RAPIER.ColliderDesc.ball(1.3), K.x + 6, 0, K.z + 3, 0, 1.3, { density: 0.15, bounce: 0.5, kind: 'yarn', centered: true });
    out.guru = npc(memeSpriteTexture('grumpy'), K.x + 4.5, 0, K.z - 4.5, {
      name: 'CAT TREE GURU',
      line: 'Only a true king reaches the top. Jump platform to platform (double jump helps).',
      quests: ['king'],
    });
    // Matt's headphones, left on platform 7
    const hp = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
    const green = new THREE.MeshStandardMaterial({ color: '#7CFF4F', emissive: '#3cff3c', emissiveIntensity: 0.6 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 20, Math.PI), black);
    band.position.y = 0.3;
    hp.add(band);
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14), green);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(s * 0.28, 0.3, 0);
      hp.add(cup);
    }
    hp.traverse((o) => (o.castShadow = true));
    const spot = out.treePlatforms[7];
    out.headphones = addBody(hp, RAPIER.ColliderDesc.cuboid(0.34, 0.2, 0.13), spot.x, spot.y, spot.z, 0.5, 0.2, { density: 0.3, kind: 'headphones' });
    clear.push([K.x, K.z, 10]);
  }

  // ---------- golden yarn collectibles ----------
  {
    const geo = new THREE.SphereGeometry(0.32, 16, 12);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffd23f', metalness: 0.8, roughness: 0.25, emissive: '#ffb000', emissiveIntensity: 1.2 });
    const spots = [
      [CAFE.x + 1.3, 1.45, CAFE.z - 2.5],
      [TOWERS.x, 9.7, TOWERS.z],
      [MATT_HOUSE.x + 1.6, 1.4, MATT_HOUSE.z - 1.9],
      [UFO.x, 6.5, UFO.z],
      [RACE.x, 0.9, RACE.z],
      [LAKE.x + 11.6, 1.5, LAKE.z + 5],
      [out.treePlatforms[11].x, out.treePlatforms[11].y + 0.7, out.treePlatforms[11].z],
      [-46, 0.9, -70.5],
    ];
    spots.forEach(([x, y, z], i) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      scene.add(m);
      golds.push(m);
      animated.push((dt, t) => {
        m.rotation.y += dt * 2;
        m.position.y = y + Math.sin(t * 2.5 + i) * 0.15;
      });
    });
  }

  // ---------- quest logic for the new areas ----------
  const st = { lap: null, ufoT: 0, ufoCd: 0, wet: false, wetCd: 0, fall: 0, poolCd: 0 };
  const inRect = (p, r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
  const inLake = (p) => ((p.x - LAKE.x) / LAKE_RX) ** 2 + ((p.z - LAKE.z) / LAKE_RZ) ** 2 < 1;

  // mine(prop): may this player score it (in multiplayer, only the player moving it).
  // reset(prop): put a delivered quest item back for the next player (multiplayer only).
  out.check = (dt, t, { claw, ch, hud, sfx, mine = () => true, reset = () => {}, online = false }) => {
    const p = claw.position();
    const v = claw.body.linvel();

    // NPC chat
    for (const n of npcs) {
      n.talkCd -= dt;
      n.marker.visible = n.quests.some((q) => !ch.isDone(q));
      if (n.talkCd <= 0 && n.pos.distanceTo(p) < 3.2) {
        n.talkCd = 25;
        hud.banner(n.name, n.line);
        sfx.mrrp();
      }
    }

    // golden yarn
    golds.forEach((g, i) => {
      if (!g.visible) return;
      if (g.position.distanceTo(p) < 1.0 * claw.st.scaleK + 0.3) {
        g.visible = false;
        if (ch.collect('gold', i)) {
          sfx.ding();
          ch.chaos(150, `GOLDEN YARN ${ch.state.gold.length}/8`, '#ffd23f');
        }
      }
    });

    // deliveries: fish to the café, headphones to Matt
    for (const pr of ctx.props) {
      if (pr.kind === 'fish' && !pr.delivered && mine(pr) && inRect(pr.body.translation(), out.cafeRect)) {
        pr.delivered = true;
        if (online) reset(pr);
        sfx.meow(820);
        ch.chaos(250, 'FISH DELIVERED', '#5ff2ff');
        ch.complete('fish');
      }
    }
    if (out.matt && !ch.isDone('headphones') && mine(out.headphones)) {
      const h = out.headphones.body.translation();
      if (Math.hypot(h.x - out.matt.pos.x, h.z - out.matt.pos.z) < 3) {
        sfx.meow(950);
        hud.banner('MATT', 'MY HEADPHONES! Thank you Claw. You are now an honorary Hampter.');
        ch.chaos(300, 'MATT IS HAPPY', '#ffe14d');
        ch.complete('headphones');
        if (online) reset(out.headphones);
      }
    }

    // Vash's sword back to Vash
    if (out.vashSword && !out.vashSword.gone && !ch.isDone('vashshelf') && mine(out.vashSword)) {
      const s = out.vashSword.body.translation();
      if (Math.hypot(s.x - out.vashHome.x, s.z - out.vashHome.z) < 2.6) {
        sfx.meow(1100);
        hud.banner('LYONIA (VASH)', "MY SWORD! It's a normal sized sword. I'm just small.");
        ch.chaos(300, 'VASH IS ARMED', '#b48cff');
        ch.complete('vashshelf');
      }
    }

    // rooftop + cannonball
    if (p.y > out.roofY + 0.2 && Math.abs(p.x - TOWERS.x) < 4.6 && Math.abs(p.z - TOWERS.z) < 3.5 && !ch.isDone('roof')) {
      ch.chaos(200, 'ROOFTOP CLAW', '#5ff2ff');
      ch.complete('roof');
    }
    st.fall = v.y < st.fall ? v.y : st.fall * 0.9;
    st.poolCd -= dt;
    if (inRect(p, out.poolRect) && p.y < POOL_Y + 0.5 && st.poolCd <= 0) {
      st.poolCd = 2;
      sfx.splash();
      if (st.fall < -13) {
        ch.chaos(400, 'CANNONBALL!!', '#5ff2ff');
        ch.complete('cannonball');
      } else {
        hud.popup('*splash*', '#5ff2ff');
      }
    }

    // water: float + hate it
    const swimming = (inLake(p) && !inRect(p, out.dockRect) && !inRect(p, out.islandRect) && p.y < WATER_Y + 0.5) || (inRect(p, out.poolRect) && p.y < POOL_Y + 0.4);
    if (swimming) {
      const surf = inLake(p) ? WATER_Y : POOL_Y;
      claw.body.setLinvel({ x: v.x * 0.92, y: Math.max(v.y, (surf - p.y + 0.1) * 6), z: v.z * 0.92 }, true);
      st.wetCd -= dt;
      if (!st.wet || st.wetCd <= 0) {
        st.wetCd = 6;
        if (inLake(p)) {
          sfx.meow(1100);
          hud.popup('CATS HATE WATER', '#5ff2ff');
          if (!ch.isDone('swim')) ch.chaos(150, 'SOGGY CLAW', '#5ff2ff');
          ch.complete('swim');
        }
      }
    }
    st.wet = swimming;

    // UFO abduction
    st.ufoCd -= dt;
    const du = Math.hypot(p.x - UFO.x, p.z - UFO.z);
    if (du < 3.2 && p.y < 12 && st.ufoCd <= 0) {
      st.ufoT += dt;
      claw.body.setLinvel({ x: (UFO.x - p.x) * 1.5, y: 5.5, z: (UFO.z - p.z) * 1.5 }, true);
      if (st.ufoT > 0.1 && st.ufoT - dt <= 0.1) {
        sfx.oiia();
        hud.popup('BEING ABDUCTED...', '#9dff6a');
      }
      if (p.y > 10.5) {
        st.ufoT = 0;
        st.ufoCd = 4;
        const a = Math.random() * Math.PI * 2;
        claw.body.setLinvel({ x: Math.cos(a) * 14, y: 8, z: Math.sin(a) * 14 }, true);
        sfx.boom();
        hud.popup('REJECTED: TOO GLORPY', '#9dff6a');
        if (!ch.isDone('ufo')) ch.chaos(300, 'ABDUCTED', '#9dff6a');
        ch.complete('ufo');
      }
    } else {
      st.ufoT = 0;
    }

    // Cat Tree king
    if (p.y > out.treeTop - 0.2 && Math.hypot(p.x - CAT_TREE.x, p.z - CAT_TREE.z) < 4.5 && !ch.isDone('king')) {
      sfx.win();
      ch.chaos(400, 'KING OF THE CAT TREE', '#ffd23f');
      ch.complete('king');
    }

    // Zoomies lap
    const cps = out.checkpoints;
    const near = (i) => Math.hypot(p.x - cps[i].pos.x, p.z - cps[i].pos.z) < 3.4 && p.y < 4;
    if (st.lap) {
      st.lap.t += dt;
      const left = LAP_TIME - st.lap.t;
      hud.setTimer(`LAP ${st.lap.next === 6 ? 'FINISH' : st.lap.next + '/6'} · ${Math.max(0, left).toFixed(1)}s`);
      const target = st.lap.next % 6;
      if (near(target)) {
        if (st.lap.next === 6) {
          hud.setTimer(null);
          sfx.win();
          ch.chaos(500, `LAP ${st.lap.t.toFixed(1)}s`, '#7CFF4F');
          ch.complete('lap');
          st.lap = null;
        } else {
          sfx.ding();
          hud.popup(`CHECKPOINT ${st.lap.next}/6`, '#7CFF4F');
          st.lap.next++;
        }
      } else if (left <= 0) {
        hud.setTimer(null);
        sfx.fail();
        hud.popup('TOO SLOW. TRY AGAIN', '#ff4f6d');
        st.lap = null;
        st.lapCd = 2;
      }
    } else {
      st.lapCd = (st.lapCd || 0) - dt;
      if (st.lapCd <= 0 && near(0)) {
        st.lap = { next: 1, t: 0 };
        sfx.ding();
        hud.popup('LAP STARTED!', '#7CFF4F');
      }
    }
    cps.forEach((c, i) => {
      const s = st.lap && i === st.lap.next % 6 ? 1 + Math.sin(t * 8) * 0.08 : 1;
      c.banner.scale.set(s, s, s);
    });
  };

  out.reset = (ch) => {
    golds.forEach((g, i) => (g.visible = !ch.state.gold.includes(i)));
  };

  return out;
}
