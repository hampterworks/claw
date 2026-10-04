// Builds the sandbox: Ohio. Living room, park with the giant soup pot,
// radio tower, Glorp Cat News studio, corn field, meme cats everywhere.
import * as THREE from 'three';
import { makeCat } from './claw.js';
import { memeStandeeTexture, signTexture, yarnTexture, newsTexture } from './textures.js';
import { soupMaterial } from './graphics.js';
import { createBuilder } from './builder.js';
import { buildDistricts } from './districts.js';
import { buildTown } from './town.js';
import { buildPark } from './park.js';

export const HOUSE = new THREE.Vector3(-12, 0, -6);
export const PARK_POT = new THREE.Vector3(16, 0, 12);
export const TRAMP = new THREE.Vector3(8, 0, 17);
export const STATUE = new THREE.Vector3(23, 0, 0);
export const TOWER = new THREE.Vector3(-26, 0, 22);
export const STUDIO = new THREE.Vector3(0, 0, -27);
export const CORN = new THREE.Vector3(25, 0, -24);
export const BOUNDS = 132; // Ohio got bigger (Glorp Park + the Outskirts woods)

const POT_R = 2.3;
const POT_H = 1.45;
const TOWER_STEPS = 18;
const STEP_RISE = 0.85;

// Small deterministic RNG so the map is the same every visit.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function buildWorld({ RAPIER, world, scene, models, catGltf, images, textures }) {
  const rand = rng(1551);
  const disposables = [];
  const animated = [];
  const special = {};
  const B = createBuilder({ RAPIER, world, scene, models });
  const { props, yawQ, template, deco, fixed, staticBox, staticModel, prop, addBody } = B;

  // ---------- sky, light, ground ----------
  scene.background = new THREE.Color('#8fd3ff');
  scene.fog = new THREE.Fog('#c4ecff', 70, 210);
  const hemi = new THREE.HemisphereLight('#e6f6ff', '#4f7a2f', 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff6dd', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -18;
  sc.right = sc.top = 18;
  sc.near = 1;
  sc.far = 80;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  special.sun = sun;

  {
    const geo = new THREE.PlaneGeometry(460, 460, 72, 72); // reaches past the fog from anywhere in Ohio
    geo.rotateX(-Math.PI / 2);
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < geo.attributes.position.count; i++) {
      c.setHSL(0.27 + rand() * 0.04, 0.55, 0.36 + rand() * 0.08);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    ground.receiveShadow = true;
    scene.add(ground);
    staticBox(0, -0.5, 0, 230, 0.5, 230);
    // invisible borders of Ohio
    for (const [x, z, hx, hz] of [[BOUNDS, 0, 0.5, BOUNDS], [-BOUNDS, 0, 0.5, BOUNDS], [0, BOUNDS, BOUNDS, 0.5], [0, -BOUNDS, BOUNDS, 0.5]]) staticBox(x, 10, z, hx, 10, hz);
  }

  // clouds: one instanced mesh, 4 puffs per cloud
  {
    const N = 16;
    const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }), N * 4);
    const clouds = [];
    for (let i = 0; i < N; i++) {
      clouds.push({
        x: rand() * 240 - 120,
        y: 26 + rand() * 14,
        z: rand() * 240 - 120,
        speed: 0.6 + rand() * 0.8,
        parts: [0, 1, 2, 3].map((k) => [k * 1.6 - 2.4, rand() * 0.6, rand() * 1.2, 1.4 + rand() * 1.2]),
      });
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pv = new THREE.Vector3();
    const sv = new THREE.Vector3();
    puffs.frustumCulled = false;
    scene.add(puffs);
    animated.push((dt) => {
      clouds.forEach((c, i) => {
        c.x += c.speed * dt;
        if (c.x > 130) c.x = -130;
        c.parts.forEach(([dx, dy, dz, s], k) => puffs.setMatrixAt(i * 4 + k, m.compose(pv.set(c.x + dx * 2, c.y + dy, c.z + dz), q, sv.set(s * 2, s * 1.4, s * 2))));
      });
      puffs.instanceMatrix.needsUpdate = true;
    });
  }

  // ---------- the living room ----------
  const H = HOUSE;
  {
    B.room(H.x, H.z, 6, 5, { doors: ['s2', 's3', 'e1'], windows: ['n1', 'n4', 's1', 's4', 'w1', 'w3', 'e3'] });

    deco('k_rugRectangle', H.x, 0.06, H.z + 1, 0, 1, false);
    deco('k_rugRound', H.x - 4, 0.06, H.z + 1.5, 0, 1, false);

    // lounge corner
    prop('k_loungeSofa', H.x, 0.06, H.z + 4.6, Math.PI, { density: 0.8 });
    prop('k_pillow', H.x - 0.5, 0.6, H.z + 4.5, Math.PI, { density: 0.2 });
    prop('k_pillowBlue', H.x + 0.6, 0.6, H.z + 4.5, Math.PI, { density: 0.2 });
    const onTable = (name, lx, lz, y, rot = 0, o = {}) => prop(name, H.x + lx, y, H.z + lz, rot, { density: 0.35, ...o });
    prop('k_tableCoffee', H.x, 0.06, H.z + 2.3, 0, { density: 0.5 });
    onTable('k_books', -0.4, 2.2, 0.58);
    onTable('k_plantSmall1', 0.45, 2.4, 0.58);
    onTable('k_laptop', 0.0, 2.1, 0.58, 0.4);
    prop('k_cabinetTelevision', H.x, 0.06, H.z - 4.9, 0, { density: 0.8 });
    special.houseTv = prop('k_televisionModern', H.x, 0.75, H.z - 4.95, 0, { density: 0.4 });
    onTable('k_speakerSmall', 1.1, -4.9, 0.75);
    onTable('k_plantSmall2', -1.1, -4.9, 0.75);

    // dining
    prop('k_table', H.x - 3.8, 0.06, H.z + 0.9, 0, { density: 0.5 });
    for (const [lx, lz, r] of [[-4.5, 0.05, 0], [-3.1, 0.05, 0], [-4.5, 1.75, Math.PI], [-3.1, 1.75, Math.PI]]) prop('k_chairCushion', H.x + lx, 0.06, H.z + lz, r, { density: 0.4 });
    onTable('k_toaster', -4.3, 0.8, 0.79);
    onTable('k_kitchenBlender', -3.6, 1.1, 0.79);
    onTable('k_books', -3.2, 0.7, 0.79, 0.6);
    onTable('k_plantSmall3', -4.0, 1.25, 0.79);
    onTable('k_kitchenCoffeeMachine', -3.2, 1.2, 0.79, 1.2);

    // kitchen
    prop('k_kitchenFridge', H.x - 6.0, 0.06, H.z + 4.7, Math.PI, { density: 0.9 });
    prop('k_kitchenStove', H.x - 4.9, 0.06, H.z + 4.85, Math.PI, { density: 0.9 });
    prop('k_kitchenCabinet', H.x - 3.9, 0.06, H.z + 4.85, Math.PI, { density: 0.9 });
    onTable('k_kitchenBlender', -3.9, 4.85, 1.06);
    onTable('k_toaster', -4.9, 4.85, 1.06, 0.3);

    // reading corner
    prop('k_bookcaseOpen', H.x - 5.9, 0.06, H.z - 4.9, 0, { density: 0.7 });
    onTable('k_books', -5.9, -4.9, 2.02);
    prop('k_sideTable', H.x + 4.6, 0.06, H.z - 5.0, 0, { density: 0.5 });
    onTable('k_lampRoundTable', 4.2, -5.0, 0.92);
    onTable('k_radio', 4.9, -5.0, 0.92);
    prop('k_lampSquareFloor', H.x + 6.0, 0.06, H.z - 3.2, 0, { density: 0.4 });
    prop('k_desk', H.x + 5.9, 0.06, H.z - 0.4, -Math.PI / 2, { density: 0.5 });
    onTable('k_computerScreen', 6.0, -0.4, 0.92, -Math.PI / 2);
    onTable('k_laptop', 6.0, 0.3, 0.92, -Math.PI / 2);
    prop('k_stoolBar', H.x + 5.0, 0.06, H.z - 0.4, 0, { density: 0.4 });
    prop('k_pottedPlant', H.x + 6.0, 0.06, H.z + 4.9, 0, { density: 0.4 });
    prop('k_coatRackStanding', H.x + 5.8, 0.06, H.z + 2.3, 0, { density: 0.3 });
    prop('k_bear', H.x + 2.6, 0.06, H.z + 4.7, Math.PI, { density: 0.25 });
    prop('k_trashcan', H.x - 6.1, 0.06, H.z - 1.5, 0, { density: 0.3 });
    prop('k_cardboardBoxOpen', H.x + 3.4, 0.06, H.z + 1.4, 0.3, { density: 0.25, kind: 'box' });
    prop('k_cardboardBoxClosed', H.x + 4.4, 0.06, H.z + 0.3, -0.2, { density: 0.25, kind: 'box' });
  }

  // ---------- meme cat standees ----------
  const cardboardMat = new THREE.MeshStandardMaterial({ color: '#c79a64', roughness: 1 });
  function standee(tex, x, z, rotY, kind = 'standee', w = 1.0, h = 1.25) {
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    disposables.push(face, tex);
    const geo = new THREE.BoxGeometry(w, h, 0.06);
    geo.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, [cardboardMat, cardboardMat, cardboardMat, cardboardMat, face, face]);
    mesh.castShadow = true;
    return addBody(mesh, RAPIER.ColliderDesc.cuboid(w / 2, h / 2, 0.04), x, 0, z, rotY, h / 2, { density: 0.3, kind });
  }
  for (const [id, x, z, r] of [
    ['popcat', 10, 3, 0.4], ['oiia', 19, 6, -0.6], ['banana', 5, 9, 0.9], ['happy', 21, 17, -0.3],
    ['smudge', -3, 7, 0.2], ['grumpy', 3, -14, 0], ['nyan', 12, -5, 0.5], ['huh', -18, 8, -0.4],
  ]) {
    standee(memeStandeeTexture(id), x, z, r, 'standee');
  }
  if (textures.matt) {
    special.mattStandee = standee(textures.matt, 4, 1.5, 0.3, 'matt', 1.1, 1.3);
  }

  // ---------- the park + giant soup pot ----------
  {
    const P = PARK_POT;
    const prof = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(POT_R - 0.2, 0.0),
      new THREE.Vector2(POT_R, 0.25),
      new THREE.Vector2(POT_R + 0.05, POT_H),
      new THREE.Vector2(POT_R + 0.2, POT_H + 0.05),
      new THREE.Vector2(POT_R + 0.2, POT_H + 0.15),
      new THREE.Vector2(POT_R - 0.1, POT_H + 0.15),
      new THREE.Vector2(POT_R - 0.15, 0.3),
      new THREE.Vector2(0.01, 0.3),
    ];
    const potMat = new THREE.MeshStandardMaterial({ color: '#9aa0ad', metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });
    const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), potMat);
    pot.position.set(P.x, 0.5, P.z);
    pot.castShadow = pot.receiveShadow = true;
    scene.add(pot);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(POT_R - 0.12, 28), soupMaterial());
    soup.rotation.x = -Math.PI / 2;
    soup.position.set(P.x, 0.5 + POT_H - 0.3, P.z);
    scene.add(soup);
    special.soupY = soup.position.y;
    // label
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshStandardMaterial({ map: signTexture(['CLAW SOUP'], { w: 512, h: 180, size: 110, bg: '#9aa0ad', border: '#9aa0ad', color: '#2b2b33' }), transparent: true }));
    label.position.set(P.x - POT_R - 0.07, 0.5 + POT_H * 0.55, P.z);
    label.rotation.y = -Math.PI / 2;
    scene.add(label);
    // stones + fire under the pot
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      deco('n_Rock_2', P.x + Math.cos(a) * 1.6, 0, P.z + Math.sin(a) * 1.6, a, 0.7, false);
    }
    // over-bright (HDR) colours so the flames bloom; one instanced mesh for all flames
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.9, 5), flameMat, 14);
    const fireCols = ['#ff3b1f', '#ff9a1f', '#ffe14d'].map((c) => new THREE.Color(c).multiplyScalar(2.2));
    const fm = new THREE.Matrix4();
    const fq = new THREE.Quaternion();
    const fp = new THREE.Vector3();
    const fs = new THREE.Vector3();
    for (let i = 0; i < 14; i++) flames.setColorAt(i, fireCols[i % 3]);
    scene.add(flames);
    // colliders: ring of walls + inner floor
    const segs = 18;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const r = POT_R + 0.05;
      staticBox(P.x + Math.cos(a) * r, 0.5 + (POT_H + 0.15) / 2, P.z + Math.sin(a) * r, 0.12, (POT_H + 0.15) / 2, (Math.PI * r) / segs + 0.05, -a);
    }
    staticBox(P.x, 0.65, P.z, POT_R - 0.15, 0.15, POT_R - 0.15);
    // steam + bubbles
    const steamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    const steamMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.4, 0), steamMat, 12);
    const steam = Array.from({ length: 12 }, (_, i) => ({ k: i / 12, a: rand() * Math.PI * 2, r: rand() * 1.6 }));
    const bubbleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffcf8a', roughness: 0.3 }), 10);
    const bubbles = Array.from({ length: 10 }, () => ({ k: rand(), a: rand() * Math.PI * 2, r: rand() * 1.8 }));
    scene.add(steamMesh, bubbleMesh);
    animated.push((dt, t) => {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = POT_R + 0.15;
        const sc = 0.75 + 0.35 * Math.sin(t * 13 + i * 1.7);
        flames.setMatrixAt(i, fm.compose(fp.set(P.x + Math.cos(a) * r, 0.45 * sc, P.z + Math.sin(a) * r), fq, fs.set(1, sc, 1)));
      }
      flames.instanceMatrix.needsUpdate = true;
      steam.forEach((u, i) => {
        u.k = (u.k + dt * 0.25) % 1;
        const sc = 0.5 + u.k * 1.8;
        steamMesh.setMatrixAt(i, fm.compose(fp.set(P.x + Math.cos(u.a) * u.r, soup.position.y + 0.2 + u.k * 4, P.z + Math.sin(u.a) * u.r), fq, fs.set(sc, sc, sc)));
      });
      bubbles.forEach((u, i) => {
        u.k = (u.k + dt * 0.8) % 1;
        if (u.k < 0.02) {
          u.a = rand() * Math.PI * 2;
          u.r = rand() * 1.8;
        }
        const sc = u.k < 0.85 ? u.k * 1.5 : 0.001;
        bubbleMesh.setMatrixAt(i, fm.compose(fp.set(P.x + Math.cos(u.a) * u.r, soup.position.y + 0.02, P.z + Math.sin(u.a) * u.r), fq, fs.set(sc, sc, sc)));
      });
      steamMesh.instanceMatrix.needsUpdate = true;
      bubbleMesh.instanceMatrix.needsUpdate = true;
    });
    // ramp up to the rim
    const rampLen = 4.2;
    const ang = Math.atan2(POT_H + 0.7, rampLen);
    const rampQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang);
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(rampLen + 0.4, 0.2, 1.5), new THREE.MeshStandardMaterial({ color: '#8b5a2b', flatShading: true }));
    const rx = P.x - POT_R - rampLen / 2 - 0.05;
    const ry = (POT_H + 0.65) / 2;
    rampMesh.position.set(rx, ry, P.z);
    rampMesh.quaternion.copy(rampQ);
    rampMesh.castShadow = rampMesh.receiveShadow = true;
    scene.add(rampMesh);
    staticBox(rx, ry, P.z, (rampLen + 0.4) / 2, 0.1, 0.75, 0, rampQ);
  }

  // trampoline
  {
    const T = TRAMP;
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 24), new THREE.MeshStandardMaterial({ color: '#2d6cdf' }));
    frame.position.set(T.x, 0.25, T.z);
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.04, 24), new THREE.MeshStandardMaterial({ color: '#111' }));
    mat.position.set(T.x, 0.52, T.z);
    frame.castShadow = frame.receiveShadow = true;
    scene.add(frame, mat);
    const b = fixed(T.x, 0.25, T.z);
    special.trampCollider = world.createCollider(RAPIER.ColliderDesc.cylinder(0.27, 1.6).setFriction(0.8), b);
    special.trampMat = mat;
  }
  // kicker ramps
  for (const [x, z, rot] of [[4, 4, 0.3], [18, 21, 2.2], [-6, 14, -0.8]]) {
    const ang = 0.38;
    const q = yawQ(rot).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ang));
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 3.4), new THREE.MeshStandardMaterial({ color: '#ff7bf2', flatShading: true }));
    m.position.set(x, 0.55, z);
    m.quaternion.copy(q);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    staticBox(x, 0.55, z, 1.1, 0.125, 1.7, 0, q);
  }

  // yarn balls
  for (const [x, z, c] of [[9, 7, '#ff5a7a'], [13, 2, '#5ff2ff'], [20, 10, '#ffe14d'], [6, 13, '#a03cff'], [-10, 2, '#ff9a1f'], [2, 8, '#7CFF4F']]) {
    const tex = yarnTexture(c);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    m.castShadow = true;
    disposables.push(tex);
    addBody(m, RAPIER.ColliderDesc.ball(0.32), x, 0, z, 0, 0.32, { density: 0.25, bounce: 0.6, kind: 'yarn', centered: true });
  }

  // Maxwell statue: a giant spinning black cat on a plinth
  {
    const S = STATUE;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 2.6), new THREE.MeshStandardMaterial({ color: '#b9b2a6', flatShading: true }));
    plinth.position.set(S.x, 0.6, S.z);
    plinth.castShadow = plinth.receiveShadow = true;
    scene.add(plinth);
    staticBox(S.x, 0.6, S.z, 1.3, 0.6, 1.3);
    const max = makeCat(catGltf, { length: 2.6, colors: { Grey: '#161616', White: '#f2f2f2', Pink: '#d9a0a0' } });
    max.wrapper.position.set(S.x, 1.2, S.z);
    scene.add(max.wrapper);
    max.actions.Idle?.setEffectiveWeight(1);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ map: signTexture(['MAXWELL'], { w: 512, h: 128, size: 90, bg: '#3a3127', border: '#c9a227', color: '#ffd23f' }) }));
    plaque.position.set(S.x - 1.31, 0.62, S.z);
    plaque.rotation.y = -Math.PI / 2;
    scene.add(plaque);
    special.maxwell = { spin: 1, cat: max };
    animated.push((dt) => {
      max.wrapper.rotation.y += dt * special.maxwell.spin;
      special.maxwell.spin += (1 - special.maxwell.spin) * dt * 0.3;
      max.mixer.update(dt);
    });
  }

  // ---------- radio tower (spiral steps) ----------
  {
    const T = TOWER;
    const metal = new THREE.MeshStandardMaterial({ color: '#d33f2f', flatShading: true });
    const white = new THREE.MeshStandardMaterial({ color: '#f2f2f2', flatShading: true });
    const topY = TOWER_STEPS * STEP_RISE;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, topY + 2, 8), metal);
    pole.position.set(T.x, (topY + 2) / 2, T.z);
    pole.castShadow = true;
    scene.add(pole);
    world.createCollider(RAPIER.ColliderDesc.cylinder((topY + 2) / 2, 0.42), fixed(T.x, (topY + 2) / 2, T.z));
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.2, 1.0), new THREE.MeshStandardMaterial({ flatShading: true }), TOWER_STEPS);
    steps.castShadow = steps.receiveShadow = true;
    special.towerSteps = [];
    const red = new THREE.Color('#d33f2f');
    const wht = new THREE.Color('#f2f2f2');
    for (let i = 0; i < TOWER_STEPS; i++) {
      const a = i * 0.62;
      const r = 1.55;
      const x = T.x + Math.cos(a) * r;
      const z = T.z + Math.sin(a) * r;
      const y = 0.55 + i * STEP_RISE;
      steps.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), yawQ(-a), new THREE.Vector3(1, 1, 1)));
      steps.setColorAt(i, i % 2 ? red : wht);
      staticBox(x, y, z, 0.75, 0.1, 0.5, -a);
      special.towerSteps.push(new THREE.Vector3(x, y, z));
    }
    steps.computeBoundingSphere();
    scene.add(steps);
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.3, 16), white);
    plat.position.set(T.x, topY + 0.7, T.z);
    plat.receiveShadow = true;
    scene.add(plat);
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.15, 2.3), fixed(T.x, topY + 0.7, T.z));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshStandardMaterial({ color: '#e6e6e6', side: THREE.DoubleSide, flatShading: true }));
    dish.position.set(T.x, topY + 2.6, T.z);
    dish.rotation.x = Math.PI * 0.75;
    scene.add(dish);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2222').multiplyScalar(4) }));
    light.position.set(T.x, topY + 3.1, T.z);
    scene.add(light);
    animated.push((dt, t) => {
      light.visible = Math.sin(t * 4) > 0;
      dish.rotation.z = Math.sin(t * 0.5) * 0.6;
    });
    special.towerTop = topY + 0.85;
  }

  // ---------- Glorp Cat News studio ----------
  {
    const S = STUDIO;
    const stage = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 7), new THREE.MeshStandardMaterial({ color: '#2b2f4a' }));
    stage.position.set(S.x, 0.15, S.z);
    stage.receiveShadow = true;
    scene.add(stage);
    staticBox(S.x, 0.15, S.z, 5.5, 0.15, 3.5);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(11, 5.5, 0.4), new THREE.MeshStandardMaterial({ color: '#141a33' }));
    wall.position.set(S.x, 2.75, S.z - 3.6);
    wall.castShadow = true;
    scene.add(wall);
    staticBox(S.x, 2.75, S.z - 3.6, 5.5, 2.75, 0.2);
    const news = newsTexture(images.news, images.claw, images.matt);
    disposables.push(news.texture);
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.05), new THREE.MeshBasicMaterial({ map: news.texture }));
    tv.position.set(S.x, 3.0, S.z - 3.38);
    scene.add(tv);
    special.news = news;
    // the house TV shows the same channel
    if (special.houseTv) {
      const small = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.73), new THREE.MeshBasicMaterial({ map: news.texture }));
      small.position.set(0, 0.6, 0.08);
      special.houseTv.mesh.add(small);
    }
    const onAir = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.8), new THREE.MeshBasicMaterial({ map: signTexture(['ON AIR'], { w: 512, h: 140, size: 100, bg: '#300', border: '#ff2a2a', color: '#ff4f4f' }) }));
    onAir.position.set(S.x, 5.15, S.z - 3.38);
    scene.add(onAir);
    prop('k_desk', S.x + 2.6, 0.3, S.z - 1.6, 0, { density: 0.5 });
    prop('k_chairCushion', S.x + 2.6, 0.3, S.z - 2.6, 0, { density: 0.4 });
    prop('k_laptop', S.x + 2.4, 1.16, S.z - 1.6, Math.PI, { density: 0.3 });
    // the spot
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 32), new THREE.MeshBasicMaterial({ color: '#ffe14d', side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(S.x - 1.2, 0.32, S.z - 0.8);
    scene.add(ring);
    special.newsSpot = ring.position.clone();
    special.newsRing = ring;
    // camera rig
    const camMat = new THREE.MeshStandardMaterial({ color: '#333' });
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.8), camMat);
    camBody.position.set(S.x - 1.2, 1.5, S.z + 4.8);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 12), camMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(S.x - 1.2, 1.5, S.z + 4.25);
    const tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, 1.3, 6), camMat);
    tripod.position.set(S.x - 1.2, 0.65, S.z + 4.8);
    scene.add(camBody, lens, tripod);
    staticBox(S.x - 1.2, 0.9, S.z + 4.8, 0.3, 0.9, 0.4);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2222').multiplyScalar(4) }));
    red.position.set(S.x - 1.0, 1.78, S.z + 4.5);
    scene.add(red);
    animated.push((dt, t) => (red.visible = Math.sin(t * 5) > 0));
  }

  // ---------- Ohio: corn field, Huh Cat, welcome sign ----------
  {
    const C = CORN;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 3 && j === 3) continue;
        deco(rand() < 0.5 ? 'n_Corn_1' : 'n_Corn_2', C.x - 5 + i * 1.7 + rand() * 0.4, 0, C.z - 5 + j * 1.7 + rand() * 0.4, rand() * 6, 0.9 + rand() * 0.3, false);
      }
    }
    if (textures.huh) {
      const huh = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.huh }));
      huh.center.set(0.5, 0);
      huh.scale.set(1.8, 1.8, 1);
      huh.position.set(C.x, 0, C.z);
      scene.add(huh);
      special.huh = huh;
    }
    // welcome sign with the Mayor
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 2.6),
      new THREE.MeshStandardMaterial({ map: signTexture(['WELCOME TO', 'OHIO', 'pop: 1 claw'], { w: 512, h: 220, size: 58, colors: ['#fff', '#ffe14d', '#7CFF4F'] }) })
    );
    sign.position.set(C.x - 1, 3.0, C.z + 8.5);
    scene.add(sign);
    const postMat = new THREE.MeshStandardMaterial({ color: '#6b4226' });
    for (const dx of [-2.6, 2.6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), postMat);
      post.position.set(C.x - 1 + dx, 1.6, C.z + 8.45);
      scene.add(post);
      staticBox(C.x - 1 + dx, 1.6, C.z + 8.45, 0.13, 1.6, 0.13);
    }
    if (textures.matt) {
      const mayor = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: textures.matt, transparent: true }));
      mayor.position.set(C.x + 2.9, 3.7, C.z + 8.52);
      scene.add(mayor);
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshBasicMaterial({ map: signTexture(['MAYOR MATT'], { w: 512, h: 128, size: 80, color: '#ffe14d' }) }));
      cap.position.set(C.x + 2.9, 2.6, C.z + 8.52);
      scene.add(cap);
    }
  }

  // ---------- billboards ----------
  // o.cutout: image with transparency (e.g. Matt), shown unlit over a coloured board
  function billboard(tex, x, z, rotY, w = 4.4, h = 3.3, o = {}) {
    const g = new THREE.Group();
    const faceMat = o.cutout ? new THREE.MeshBasicMaterial({ map: tex, transparent: true }) : new THREE.MeshStandardMaterial({ map: tex });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat);
    board.position.y = 2.2 + h / 2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.15), new THREE.MeshStandardMaterial({ color: o.back || '#222' }));
    back.position.set(0, 2.2 + h / 2, -0.09);
    const postMat = new THREE.MeshStandardMaterial({ color: '#555' });
    for (const dx of [-w / 3, w / 3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.3, 0.2), postMat);
      post.position.set(dx, 1.15, -0.1);
      g.add(post);
    }
    g.add(board, back);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    staticBox(x, 2.2 + h / 2, z, w / 2, h / 2, 0.15, rotY);
    return g;
  }
  if (textures.forp) billboard(textures.forp, -28, -12, 0.9);
  if (textures.matt) {
    // downtown, facing the road: you cannot escape the pog
    billboard(textures.matt, -2, -61, 0, 5.2, 5.2, { cutout: true, back: '#ffe14d' });
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.1), new THREE.MeshBasicMaterial({ map: signTexture(['MATT POGS AT YOU'], { w: 512, h: 104, size: 54, color: '#ffe14d' }) }));
    cap.position.set(-2, 1.55, -60.9);
    scene.add(cap);
  }

  // Matt: giant head watching over Ohio + employee of the month in the living room
  if (textures.matt) {
    const sky = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.matt, fog: false, transparent: true }));
    sky.scale.set(26, 26, 1);
    sky.position.set(-10, 40, -95);
    scene.add(sky);
    animated.push((dt, t) => {
      sky.position.y = 40 + Math.sin(t * 0.4) * 2;
      sky.material.rotation = Math.sin(t * 0.3) * 0.08;
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.55, 0.06), new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.5, roughness: 0.4 }));
    frame.position.set(H.x + 2.4, 1.85, H.z - 5.38);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshBasicMaterial({ map: textures.matt }));
    pic.position.set(H.x + 2.4, 1.97, H.z - 5.34);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.26), new THREE.MeshBasicMaterial({ map: signTexture(['EMPLOYEE OF THE MONTH'], { w: 512, h: 128, size: 52, bg: '#2b2310', border: '#c9a227', color: '#ffd23f' }) }));
    plate.position.set(H.x + 2.4, 1.24, H.z - 5.34);
    scene.add(frame, pic, plate);
  }

  // Dancing glorp cat in the living room
  if (textures.dance) {
    const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.dance }));
    d.center.set(0.5, 0);
    d.scale.set(0.9, 1.35, 1);
    d.position.set(H.x + 1.8, 0.06, H.z - 1.6);
    scene.add(d);
    special.dancer = d;
    animated.push((dt, t) => {
      const beat = Math.abs(Math.sin(t * 5));
      d.scale.set(0.9 + beat * 0.08, 1.35 - beat * 0.1, 1);
      d.material.rotation = Math.sin(t * 5) * 0.12;
      d.position.y = 0.06 + beat * 0.12;
    });
  }

  // ---------- Baby Glorps ----------
  special.babies = [];
  if (textures.baby) {
    const spots = [
      new THREE.Vector3(H.x - 5.9, 2.5, H.z - 4.9),
      new THREE.Vector3(CORN.x + 3.4, 0.7, CORN.z + 1.7),
      special.towerSteps[9].clone().add(new THREE.Vector3(0, 0.75, 0)),
      new THREE.Vector3(STUDIO.x + 4, 0.7, STUDIO.z - 5.2),
      new THREE.Vector3(TRAMP.x, 10, TRAMP.z),
    ];
    spots.forEach((p, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.baby }));
      s.scale.set(0.75, 0.75, 1);
      s.position.copy(p);
      s.userData.base = p.y;
      scene.add(s);
      special.babies.push(s);
      animated.push((dt, t) => {
        s.position.y = s.userData.base + Math.sin(t * 2 + i) * 0.15;
        s.material.rotation = Math.sin(t * 3 + i) * 0.2;
      });
    });
  }

  // ---------- the rest of Ohio (downtown, raceway, UFO, lake, cat tree) ----------
  const districts = buildDistricts({ B, RAPIER, world, scene, rand, animated, disposables, textures, props });
  special.districts = districts;
  const town = buildTown({ B, RAPIER, world, scene, rand, animated, disposables });
  special.town = town;

  // ---------- nature ----------
  const clear = [
    [-1, 13, 3], // Winty's corner of the park
    ...districts.clear,
    ...town.clear,
    [HOUSE.x, HOUSE.z, 9.5], [PARK_POT.x, PARK_POT.z, 6], [TRAMP.x, TRAMP.z, 4], [STATUE.x, STATUE.z, 3.5],
    [TOWER.x, TOWER.z, 4.5], [STUDIO.x, STUDIO.z + 2, 8], [CORN.x, CORN.z, 8], [-28, -12, 3.5], [4, 4, 3], [18, 21, 3], [-6, 14, 3], [0, 0, 6],
  ];
  const free = (x, z, pad = 0) => clear.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r + pad);
  const trees = ['n_CommonTree_1', 'n_CommonTree_2', 'n_CommonTree_3', 'n_CommonTree_4', 'n_CommonTree_Autumn_1', 'n_PineTree_1', 'n_PineTree_2', 'n_PineTree_3', 'n_BirchTree_1', 'n_Willow_1', 'n_Willow_2'];
  function place(n, pad, fn) {
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 30; tries++) {
      const x = rand() * 176 - 88;
      const z = rand() * 176 - 88;
      if (Math.abs(z + 52) < 7) continue; // keep the road clear
      if (!free(x, z, pad)) continue;
      fn(x, z);
      placed++;
    }
  }
  special.trees = [];
  place(130, 1.5, (x, z) => {
    const name = trees[Math.floor(rand() * trees.length)];
    const sc = 0.8 + rand() * 0.5;
    const handle = deco(name, x, 0, z, rand() * 6, sc);
    special.trees.push({ handle, x, z, h: template(name).size.y * sc });
    world.createCollider(RAPIER.ColliderDesc.cylinder(1.6, 0.35), fixed(x, 1.6, z));
    clear.push([x, z, 1.5]);
  });
  place(50, 0.8, (x, z) => deco(['n_Bush_1', 'n_BushBerries_1', 'n_BushBerries_2'][Math.floor(rand() * 3)], x, 0, z, rand() * 6, 0.8 + rand() * 0.4));
  place(36, 0.8, (x, z) => {
    const name = ['n_Rock_1', 'n_Rock_2', 'n_Rock_3', 'n_Rock_Moss_1', 'n_Rock_Moss_2'][Math.floor(rand() * 5)];
    staticModel(name, x, 0, z, rand() * 6);
  });
  place(220, 0.3, (x, z) => deco(['n_Flowers', 'n_Grass', 'n_Plant_1'][Math.floor(rand() * 3)], x, 0, z, rand() * 6, 0.9, false));
  place(12, 1, (x, z) => staticModel(rand() < 0.5 ? 'n_TreeStump' : 'n_WoodLog', x, 0, z, rand() * 6));

  // extra boxes outside, for sitting
  prop('k_cardboardBoxOpen', 11, 0, 9, 0.8, { density: 0.25, kind: 'box' });
  prop('k_cardboardBoxClosed', -2, 0, -9, 0.2, { density: 0.25, kind: 'box' });

  // MEGA BOX: a hollow, open-top cardboard box Claw can actually jump INTO.
  // One dynamic body with 5 colliders (floor + 4 walls), so it can still be shoved around.
  {
    const S3 = 3;
    const t = template('k_cardboardBoxOpen');
    const mesh = new THREE.Mesh(t.geo, t.mat);
    mesh.scale.setScalar(S3);
    const half = 0.23 * S3; // body footprint without the flaps
    const wallH = 0.5 * S3;
    const hy = (t.size.y * S3) / 2;
    const th = 0.05;
    const C = RAPIER.ColliderDesc;
    const mega = addBody(mesh, C.cuboid(half, th, half).setTranslation(0, -hy + th, 0), -8, 0, 3.6, 0.3, hy, { density: 0.35, kind: 'box', extra: { mega: true } });
    const wallY = -hy + wallH / 2;
    for (const [hx, hz, x, z] of [[th, half, half - th, 0], [th, half, -(half - th), 0], [half, th, 0, half - th], [half, th, 0, -(half - th)]]) {
      world.createCollider(C.cuboid(hx, wallH / 2, hz).setTranslation(x, wallY, z).setDensity(0.35).setFriction(0.7), mega.body);
    }
    mega.half = new THREE.Vector3(half, hy, half);
    special.megaBox = mega;
  }

  // the cactus patch of eastern Ohio
  for (let i = 0; i < 9; i++) staticModel('n_Cactus_1', 84 - rand() * 6, 0, 30 + rand() * 30, rand() * 6, 1 + rand() * 0.6);

  // ---------- Glorp Park (arena + hedge maze) and the Outskirts ----------
  const park = buildPark({ B, RAPIER, world, scene, disposables, bounds: BOUNDS });
  special.park = park;
  special.trees.push(...park.trees);

  B.finalize();

  // ---------- per-frame ----------
  const tq = new THREE.Quaternion();
  const off = new THREE.Vector3();
  return {
    props,
    special,
    POT_R,
    syncProps() {
      for (const p of props) {
        if (p.body.isSleeping()) continue;
        const t = p.body.translation();
        const r = p.body.rotation();
        tq.set(r.x, r.y, r.z, r.w);
        off.set(0, -p.hy, 0).applyQuaternion(tq);
        p.mesh.position.set(t.x + off.x, t.y + off.y, t.z + off.z);
        p.mesh.quaternion.copy(tq);
      }
    },
    syncAll() {
      for (const p of props) {
        const t = p.body.translation();
        const r = p.body.rotation();
        tq.set(r.x, r.y, r.z, r.w);
        off.set(0, -p.hy, 0).applyQuaternion(tq);
        p.mesh.position.set(t.x + off.x, t.y + off.y, t.z + off.z);
        p.mesh.quaternion.copy(tq);
      }
    },
    update(dt, t) {
      for (const f of animated) f(dt, t);
    },
    dispose() {
      B.dispose();
      for (const d of disposables) d.dispose?.();
    },
  };
}
