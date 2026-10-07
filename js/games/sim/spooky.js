// Spooktober dressing for Ohio (October only, see js/season.js): a graveyard north of Winter's Castle,
// jack-o'-lanterns by every street lamp and on porches, pumpkin patches, mini graveyards, braziers, posts and arches,
// dead trees around the map, and pumpkin glows at night. Models come from halloween.glb (Kenney Graveyard Kit h_*,
// KayKit Halloween Bits y_*). Everything here is static, so it is baked into one vertex-coloured mesh per 64 m chunk
// (a handful of draw calls), and the small lights share one Points object.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOUSE, TOWER, CORN } from './world.js';
import { CASTLE, LAKE, CAFE, TOWERS, MATT_HOUSE, HAMPTER_HOUSE, RACE, UFO, CAT_TREE, CASINO, BANK } from './districts.js';
import { MEOWTOWN } from './town.js';
import { ARENA, MAZE } from './park.js';

const CHUNK = 64;
const NEAR = 48; // chunk size for the small things, which are only drawn within FAR m of the camera
const FAR = 60;
export const GRAVEYARD = new THREE.Vector3(-48, 0, 22); // north of the castle, gate on the east side
const GW = 10; // half width (x)
const GD = 7; // half depth (z)

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// a model's meshes as plain float position/normal/colour geometry in the model's own space
function bakeTemplate(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const geos = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const g = new THREE.BufferGeometry();
    const n = src.getAttribute('position').count;
    for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3]]) {
      const a = src.getAttribute(name);
      const out = new Float32Array(n * size);
      for (let i = 0; i < n; i++) {
        out[i * size] = a ? a.getX(i) : 1;
        out[i * size + 1] = a ? a.getY(i) : 1;
        out[i * size + 2] = a ? a.getZ(i) : 1;
      }
      g.setAttribute(name, new THREE.BufferAttribute(out, size));
    }
    if (!src.getAttribute('normal')) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    geos.push(g);
  });
  const geo = mergeGeometries(geos);
  geo.computeBoundingBox();
  return { geo, size: geo.boundingBox.getSize(new THREE.Vector3()), min: geo.boundingBox.min.clone() };
}

export function buildSpooky({ scene, world, RAPIER, gltf, free, lampSpots = [], porches = [], parks = [] }) {
  const templates = new Map();
  const tpl = (name) => {
    if (!templates.has(name)) {
      const node = gltf.scene.getObjectByName(name);
      if (!node) throw new Error(`halloween.glb has no ${name}`);
      const t = bakeTemplate(node);
      // Kenney's iron fence comes out teal from the atlas: make it wrought iron
      if (name.startsWith('h_iron_fence')) {
        const c = t.geo.getAttribute('color');
        for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.25 + 0.04, c.getY(i) * 0.12 + 0.045, c.getZ(i) * 0.25 + 0.06);
      }
      // its crooked pine is a cheerful teal: make it a dead, inky one
      if (name === 'h_pine_crooked') {
        const c = t.geo.getAttribute('color');
        for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.3 + 0.06, c.getY(i) * 0.22 + 0.04, c.getZ(i) * 0.35 + 0.08);
      }
      // and its fire basket too, with hot coals (over-bright so they read at night) on the upward faces inside
      if (name === 'h_fire_basket') {
        const c = t.geo.getAttribute('color');
        const p = t.geo.getAttribute('position');
        const nrm = t.geo.getAttribute('normal');
        for (let i = 0; i < c.count; i++) {
          const coal = nrm.getY(i) > 0.6 && p.getY(i) > t.size.y * 0.4 && Math.hypot(p.getX(i), p.getZ(i)) < t.size.x * 0.4;
          if (coal) c.setXYZ(i, 3.2, 0.9, 0.12);
          else c.setXYZ(i, 0.07, 0.06, 0.07);
        }
      }
      templates.set(name, t);
    }
    return templates.get(name);
  };
  const chunks = new Map();
  const glowSpots = [];
  const jacks = []; // jack-o'-lantern spots (quests use them later)
  let board = null;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  const fixed = (x, y, z, rotY) => world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation(q.setFromAxisAngle(up, rotY)));
  // is a circle of radius r at (x, z) clear of colliders, paths, the road and the decorations already placed?
  // (anywhere: skip the path/landmark check, for spots picked by hand inside a landmark like Meowtown's square)
  const shape = new RAPIER.Ball(1);
  const taken = []; // [x, z, radius] of everything placed here, colliders or not
  function open(x, z, r, anywhere = false) {
    if (!anywhere && free && !free(x, z, r * 0.5)) return false;
    if (Math.abs(z + 52) < 4.6) return false; // the main road
    // Glorp Park's arena floor and hedge maze corridors (free() doesn't cover them)
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < 17.5 + r || (Math.abs(x - MAZE.x) < 18.5 + r && Math.abs(z - MAZE.z) < 18.5 + r)) return false;
    for (const [tx, tz, tr] of taken) if ((x - tx) ** 2 + (z - tz) ** 2 < (r + tr) ** 2) return false;
    shape.radius = r;
    let hit = false;
    world.intersectionsWithShape({ x, y: r + 0.15, z }, { x: 0, y: 0, z: 0, w: 1 }, shape, (c) => {
      hit = !c.isSensor();
      return !hit;
    });
    return !hit;
  }

  // place a model (feet on the ground); collide: 'box' (fitted cuboid), 'post' (a thin cylinder) or false.
  // tilt leans it over (radians about its own x axis), resting on the ground: a coffin propped against a wall.
  const tiltQ = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);
  function place(name, x, z, rotY = 0, scale = 1, { y = 0, collide = 'box', tilt = 0 } = {}) {
    const t = tpl(name);
    q.setFromAxisAngle(up, rotY);
    if (tilt) q.multiply(tiltQ.setFromAxisAngle(xAxis, tilt));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale));
    const g = t.geo.clone().applyMatrix4(m);
    if (tilt) {
      g.computeBoundingBox();
      g.translate(0, y - g.boundingBox.min.y, 0);
    }
    // small loose things (pumpkins, candles, mounds) go in smaller chunks that drop out at a distance (see the bake)
    const small = !collide && t.size.y * scale < 1.2;
    const key = small ? `s${Math.floor(x / NEAR)},${Math.floor(z / NEAR)}` : `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(g);
    taken.push([x, z, ((t.size.x + t.size.z) * scale) / 4]);
    if (collide === 'box') {
      const c = new THREE.Vector3((t.min.x + t.size.x / 2) * scale, 0, (t.min.z + t.size.z / 2) * scale).applyAxisAngle(up, rotY);
      const hy = (t.size.y * scale) / 2;
      world.createCollider(RAPIER.ColliderDesc.cuboid((t.size.x * scale) / 2, hy, (t.size.z * scale) / 2).setFriction(0.8), fixed(x + c.x, y + hy, z + c.z, rotY));
    } else if (collide === 'post') {
      const hy = (t.size.y * scale) / 2;
      world.createCollider(RAPIER.ColliderDesc.cylinder(hy, 0.22), fixed(x, y + hy, z, 0));
    }
  }
  // night glows for jack-o'-lanterns, braziers and candles: one Points object for all of them (see glowPoints)
  const lights = [];
  const lc = new THREE.Color();
  function light(x, y, z, color, size) {
    lc.set(color);
    lights.push(x, y, z, lc.r, lc.g, lc.b, size);
  }
  function jack(name, x, z, rotY, scale, glow = 2.4, { y = 0 } = {}) {
    place(name, x, z, rotY, scale, { y, collide: false });
    if (glow) light(x, y + tpl(name).size.y * scale * 0.55, z, '#ff8a1f', glow);
    jacks.push(new THREE.Vector3(x, y, z));
  }

  // ---------- the graveyard ----------
  {
    const G = GRAVEYARD;
    const r = rng(1031);
    // iron fence (1 m pieces at 1.6x), gate gap on the east side; one long collider per side
    const FS = 1.6;
    const side = (x0, z0, dx, dz, n, rotY, gapAt = -1) => {
      for (let i = 0; i < n; i++) {
        if (i === gapAt || i === gapAt + 1) continue;
        place(i % 5 === 4 ? 'h_iron_fence_damaged' : 'h_iron_fence', x0 + dx * (i + 0.5) * FS, z0 + dz * (i + 0.5) * FS, rotY, FS, { collide: false });
      }
    };
    const nx = Math.round((GW * 2) / FS);
    const nz = Math.round((GD * 2) / FS);
    side(G.x - GW, G.z - GD, 1, 0, nx, 0);
    side(G.x - GW, G.z + GD, 1, 0, nx, 0);
    side(G.x - GW, G.z - GD, 0, 1, nz, Math.PI / 2);
    const gate = Math.floor(nz / 2) - 1;
    side(G.x + GW, G.z - GD, 0, 1, nz, Math.PI / 2, gate);
    const wall = (x, z, hx, hz) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 0.7, hz), fixed(x, 0.7, z, 0));
    wall(G.x, G.z - GD, GW, 0.1);
    wall(G.x, G.z + GD, GW, 0.1);
    wall(G.x - GW, G.z, 0.1, GD);
    const gz0 = G.z - GD + gate * FS; // gate gap: gz0 .. gz0 + 2 FS
    wall(G.x + GW, (G.z - GD + gz0) / 2, 0.1, (gz0 - (G.z - GD)) / 2);
    wall(G.x + GW, (gz0 + 2 * FS + G.z + GD) / 2, 0.1, (G.z + GD - gz0 - 2 * FS) / 2);
    const gateZ = gz0 + FS;
    board = Object.assign(new THREE.Vector3(G.x + GW + 3.2, 0, gateZ + 4.2), { ry: Math.PI / 2 }); // Zombie Tag board, facing the road
    place('y_arch_gate', G.x + GW, gateZ, Math.PI / 2, 0.85, { collide: false });
    for (const s of [-1, 1]) place('y_post_lantern', G.x + GW + 1.2, gateZ + s * 2.6, -Math.PI / 2, 0.75);
    glowSpots.push({ x: G.x + GW + 1.2, y: 2.3, z: gateZ - 2.6, color: '#ffb347', size: 2.2 }, { x: G.x + GW + 1.2, y: 2.3, z: gateZ + 2.6, color: '#ffb347', size: 2.2 });
    // the crypt at the back (west), facing the gate
    place('h_crypt_large', G.x - GW + 3.2, G.z, Math.PI / 2, 2.4);
    place('h_crypt_large_roof', G.x - GW + 3.2, G.z, Math.PI / 2, 2.4, { y: 2.4, collide: false });
    place('h_crypt_large_door', G.x - GW + 3.2 + 2.95, G.z, Math.PI / 2, 2.4, { collide: false });
    place('y_coffin_decorated', G.x - GW + 7.4, G.z + 4.2, 0.3, 0.6);
    place('y_tree_dead_large_decorated', G.x - GW + 1.6, G.z - GD + 1.8, 0.4, 0.9, { collide: false });
    place('y_tree_dead_large', G.x - GW + 1.8, G.z + GD - 1.6, 2.2, 0.85, { collide: false });
    for (const [x, z] of [[G.x - GW + 1.6, G.z - GD + 1.8], [G.x - GW + 1.8, G.z + GD - 1.6]]) world.createCollider(RAPIER.ColliderDesc.cylinder(1.5, 0.35), fixed(x, 1.5, z, 0));
    // rows of graves
    const stones = ['h_gravestone_cross', 'h_gravestone_round', 'h_gravestone_bevel', 'h_gravestone_decorative', 'h_gravestone_roof', 'h_gravestone_broken', 'h_gravestone_wide', 'h_cross'];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = G.x - 1.5 + col * 2.6;
        const z = G.z - 4.6 + row * 4.6 + (row === 1 ? 0 : 0);
        if (row === 1 && col >= 2) continue; // the path from the gate to the crypt
        const name = stones[Math.floor(r() * stones.length)];
        place(name, x, z - 0.9, Math.PI / 2 + (r() - 0.5) * 0.25, 1.9);
        place(r() < 0.5 ? 'h_grave' : 'h_grave_border', x, z + 0.25, Math.PI / 2, 1.5, { collide: false });
        if (r() < 0.3) place('y_skull_candle', x + 0.6, z - 0.2, r() * 6, 0.22, { collide: false });
      }
    }
    place('h_shovel_dirt', G.x + 6.5, G.z + 4.2, 0.6, 1.8, { collide: false });
    place('y_ribcage', G.x + 2, G.z + 0.6, 1, 0.4, { collide: false });
    place('y_bone_A', G.x + 3.4, G.z - 0.4, 0.3, 0.6, { collide: false });
    place('y_plaque_candles', G.x - GW + 7.4, G.z - 4.2, 0, 0.55);
    for (const s of [-1, 1]) jack('y_pumpkin_orange_jackolantern', G.x + GW - 1.4, gateZ + s * 1.9, -Math.PI / 2, 0.42, 2.6);
    glowSpots.push({ x: G.x - GW + 7.4, y: 0.9, z: G.z - 4.2, color: '#ffcf7a', size: 2.4 });
    // an altar before the crypt (candles on top), lightposts by its door, two more stones by the gate
    const ax = G.x - GW + 7;
    place('h_altar_stone', ax, G.z, Math.PI / 2, 1.8);
    place('h_candle_multiple', ax, G.z + 0.4, 0.5, 1.8, { y: 0.88, collide: false });
    light(ax, 1.25, G.z + 0.4, '#ffcf7a', 1.2);
    for (const s of [-1, 1]) {
      place('h_lightpost_single', ax - 0.5, G.z + s * 2.6, Math.PI / 2, 2.2, { collide: 'post' });
      light(ax - 0.5 + 0.66, 2.45, G.z + s * 2.6, '#ffcf7a', 1.6);
      place(s < 0 ? 'h_gravestone_wide' : 'h_gravestone_roof', G.x + GW - 1.8, G.z + s * 5, Math.PI / 2, 1.9);
    }
  }

  // ---------- helpers for everything below ----------
  const R = rng(1551);
  const pick = (a) => a[Math.floor(R() * a.length)];
  // a random open spot within rad of (cx, cz), or null
  function spot(cx, cz, rad, r, anywhere = false) {
    for (let i = 0; i < 16; i++) {
      const a = R() * Math.PI * 2;
      const d = Math.sqrt(R()) * rad;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (open(x, z, r, anywhere)) return [x, z];
    }
    return null;
  }
  const farFromJacks = (x, z) => jacks.every((j) => Math.hypot(j.x - x, j.z - z) > 3.6); // one bonk, one jack
  function candle(x, z, y = 0) {
    const tall = R() < 0.5;
    place(tall ? 'y_candle_triple' : 'h_candle_multiple', x, z, R() * 6.28, tall ? 0.7 : 2, { y, collide: false });
    light(x, y + (tall ? 0.6 : 0.42), z, '#ffcf7a', 1.5);
  }
  function brazier(x, z, anywhere = false) {
    if (!open(x, z, 0.6, anywhere)) return;
    place('h_fire_basket', x, z, R() * 6.28, 2.8);
    light(x, 0.7, z, '#ff6a1a', 4.6);
  }
  // a skull post or a lantern post (its lantern hangs off an arm on the +z side)
  function post(name, x, z, rotY, s = 0.8, anywhere = false) {
    if (!open(x, z, 0.45, anywhere)) return;
    place(name, x, z, rotY, s, { collide: 'post' });
    if (name === 'y_post_lantern') light(x + Math.sin(rotY) * 1.05 * s, 2.45 * s, z + Math.cos(rotY) * 1.05 * s, '#ffb347', 2.8);
  }
  // an arch over an entrance (spans its own x), posts solid, with lantern posts outside it
  function arch(x, z, rotY, s = 0.9) {
    const rx = Math.cos(rotY);
    const rz = -Math.sin(rotY);
    place('y_arch_gate', x, z, rotY, s, { collide: false });
    for (const k of [-1, 1]) {
      const px = x + rx * k * 1.9 * s;
      const pz = z + rz * k * 1.9 * s;
      world.createCollider(RAPIER.ColliderDesc.cylinder(1.8 * s, 0.35 * s), fixed(px, 1.8 * s, pz, 0));
      taken.push([px, pz, 0.5]);
      post('y_post_lantern', x + rx * k * 3.4 * s, z + rz * k * 3.4 * s, rotY, 0.75, true);
    }
  }
  // iron fence pieces from (x, z) along the run direction rotY's x axis
  function fence(x, z, rotY, n, s = 1.5) {
    for (let i = 0; i < n; i++) place(i % 4 === 2 ? 'h_iron_fence_damaged' : 'h_iron_fence', x + Math.cos(rotY) * (i + 0.5) * s, z - Math.sin(rotY) * (i + 0.5) * s, rotY, s, { collide: false });
  }
  const PUMPKINS = [['y_pumpkin_orange', 0.55], ['y_pumpkin_orange', 0.75], ['y_pumpkin_orange_small', 0.7], ['h_pumpkin', 2.4], ['h_pumpkin_carved', 2.4]];
  // a pumpkin patch: one or two big lit jack-o'-lanterns among plain pumpkins
  function patch(cx, cz, rad, n, { big = 1, anywhere = false } = {}) {
    for (let i = 0; i < big; i++) {
      const s = spot(cx, cz, rad * 0.6, 0.8, anywhere);
      if (s && farFromJacks(...s)) jack(R() < 0.5 ? 'y_pumpkin_orange_jackolantern' : 'y_pumpkin_yellow_jackolantern', s[0], s[1], R() * 6.28, 0.6 + R() * 0.2, 3.4);
    }
    for (let i = 0; i < n; i++) {
      const s = spot(cx, cz, rad, 0.3, anywhere);
      if (!s) continue;
      const [name, sc] = pick(PUMPKINS);
      place(name, s[0], s[1], R() * 6.28, sc * (0.85 + R() * 0.35), { collide: false });
      if (name === 'h_pumpkin_carved') light(s[0], 0.45, s[1], '#ff8a1f', 1.4);
    }
  }
  const STONES = ['h_gravestone_cross', 'h_gravestone_round', 'h_gravestone_bevel', 'h_gravestone_decorative', 'h_gravestone_roof', 'h_gravestone_broken', 'h_gravestone_wide', 'h_cross'];
  // a little row of n graves facing rotY, candles, a skull or bones in front of some, an iron fence behind
  function graves(cx, cz, rotY, n, anywhere = false) {
    const fx = Math.sin(rotY);
    const fz = Math.cos(rotY);
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * 1.8;
      const x = cx + fz * o;
      const z = cz - fx * o;
      if (!open(x + fx * 0.8, z + fz * 0.8, 0.95, anywhere)) continue;
      const big = R() < 0.2;
      place(big ? 'y_gravestone' : pick(STONES), x, z, rotY + (R() - 0.5) * 0.3, big ? 0.6 : 1.9);
      place('h_grave', x + fx * 1.15, z + fz * 1.15, rotY, 1.4, { collide: false });
      const dx = x + fx * 0.5 + fz * 0.6;
      const dz = z + fz * 0.5 - fx * 0.6;
      const k = R();
      if (k < 0.3) {
        place('y_skull_candle', dx, dz, R() * 6.28, 0.26, { collide: false });
        light(dx, 0.32, dz, '#ffcf7a', 1.3);
      } else if (k < 0.6) candle(dx, dz);
      else if (k < 0.75) place('y_bone_A', dx, dz, R() * 6.28, 0.55, { y: 0.07, collide: false });
    }
    if (n >= 4) fence(cx - fz * (n * 0.9 + 0.3) - fx * 0.75, cz + fx * (n * 0.9 + 0.3) - fz * 0.75, rotY, Math.round((n * 1.8 + 0.6) / 1.5));
  }
  // a mini graveyard somewhere d..d+3 m from a landmark, facing it
  function gravesNear(L, d, n) {
    for (let i = 0; i < 20; i++) {
      const a = R() * Math.PI * 2;
      const dd = d + R() * 3;
      const x = L.x + Math.cos(a) * dd;
      const z = L.z + Math.sin(a) * dd;
      if (!open(x, z, n * 0.95)) continue;
      graves(x, z, Math.atan2(L.x - x, L.z - z), n);
      return [x, z];
    }
    return null;
  }
  const TREES = [['y_tree_dead_large', 0.8, 0.3], ['y_tree_dead_medium', 0.8, 0.3], ['y_tree_dead_small', 1, 0.3], ['h_pine_crooked', 2, 0.5], ['y_tree_pine_orange_medium', 0.7, 0.25], ['y_tree_pine_orange_large', 0.7, 0.25]];
  function tree(x, z, kinds = TREES) {
    const [name, s0, v] = pick(kinds);
    place(name, x, z, R() * 6.28, s0 + R() * v, { collide: false });
    world.createCollider(RAPIER.ColliderDesc.cylinder(1.5, 0.3), fixed(x, 1.5, z, 0));
  }

  // ---------- a jack-o'-lantern by every street lamp (beside it, off the path) ----------
  lampSpots.forEach(([x, z], i) => {
    // inside a landmark (Meowtown's square, the castle yard) free() is false all round, and the road's sidewalks are
    // tight: there, tuck it in closer and check colliders only
    const deep = free && [0, 1, 2, 3].every((k) => !free(x + Math.cos(k * 1.571) * 4, z + Math.sin(k * 1.571) * 4));
    const a0 = (i * 2.399) % (Math.PI * 2);
    for (let k = 0; k < 12; k++) {
      const a = a0 + k * 1.047;
      const close = deep || (k >= 6 && Math.abs(z + 52) < 6);
      const d = close ? 0.8 : 1.5;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (!open(px, pz, 0.35, close) || !farFromJacks(px, pz)) continue;
      jack(i % 2 ? 'y_pumpkin_orange_jackolantern' : 'y_pumpkin_yellow_jackolantern', px, pz, Math.PI / 2 - a, 0.42, 2.2);
      return;
    }
  });

  // ---------- porches: a big jack-o'-lantern each side of the door, small pumpkins around ----------
  for (const [x, z, rotY = 0, spread = 1.7] of porches) {
    const fwd = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (const s of [-1, 1]) {
      const px = x + right.x * spread * s + fwd.x * 0.6;
      const pz = z + right.z * spread * s + fwd.z * 0.6;
      if (!open(px, pz, 0.35)) continue;
      jack(s < 0 ? 'y_pumpkin_orange_jackolantern' : 'y_pumpkin_yellow_jackolantern', px, pz, rotY, 0.4, 2.4);
      const sx = px + right.x * 0.6 * s + fwd.x * 0.3;
      const sz = pz + right.z * 0.6 * s + fwd.z * 0.3;
      if (open(sx, sz, 0.2)) place('y_pumpkin_orange_small', sx, sz, rotY + s, 0.45, { collide: false });
    }
    // a coffin propped against the wall, an urn, candles on the step
    const at = (side, f) => [x + right.x * side + fwd.x * f, z + right.z * side + fwd.z * f];
    let [cx, cz] = at(-(spread + 1.5), 0.3);
    if (open(cx, cz, 0.45, true)) place('h_coffin', cx, cz, rotY + Math.PI, 2, { tilt: 0.22 - Math.PI / 2, collide: 'post' });
    [cx, cz] = at(spread + 1.2, 0.3);
    if (open(cx, cz, 0.3, true)) place('h_urn_round', cx, cz, R() * 6.28, 2.2, { collide: 'post' });
    for (const s of [-1, 1]) {
      [cx, cz] = at(s * (spread - 0.8), 1.2);
      if (open(cx, cz, 0.2, true)) candle(cx, cz);
    }
  }

  // ---------- dead trees and orange pines around the parks and the castle, and along the paths ----------
  for (const { x, z, rad, n } of parks) {
    let placed = 0;
    for (let tries = 0; tries < n * 8 && placed < n; tries++) {
      const s = spot(x, z, rad, 1.6);
      if (!s) continue;
      tree(...s);
      placed++;
    }
  }
  lampSpots.forEach(([x, z], i) => {
    if (i % 2) return;
    const a = R() * Math.PI * 2;
    const d = 4 + R() * 2.5;
    if (open(x + Math.cos(a) * d, z + Math.sin(a) * d, 1.6)) tree(x + Math.cos(a) * d, z + Math.sin(a) * d);
  });

  // ---------- Spooktober everywhere: something spooky in view wherever Claw goes ----------
  const firstOpen = (spots, r, fn) => {
    for (const [x, z] of spots) if (open(x, z, r, true)) return fn(x, z);
  };
  // Claw's house and the park around it
  patch(HOUSE.x + 11, HOUSE.z - 8, 3, 6);
  patch(HOUSE.x - 12, HOUSE.z + 10, 3, 5);
  graves(10, 1, -Math.PI / 2, 3);
  brazier(HOUSE.x + 7.5, HOUSE.z + 7.5, true);
  brazier(HOUSE.x - 7.5, HOUSE.z + 7.5, true);
  // downtown: posts along the main road, candles by the benches, patches by the shops, the casino and bank steps
  for (let k = 0; k < 11; k++) {
    const north = k % 2 === 0;
    post(k % 4 < 2 ? 'y_post_skull' : 'y_post_lantern', -71 + k * 14, north ? -58.4 : -45.6, north ? 0 : Math.PI);
  }
  for (const x of [-30, -6, 36, 58]) if (open(x + 1.6, -58.2, 0.25, true)) candle(x + 1.6, -58.2);
  for (const [L, dx] of [[CAFE, -9], [TOWERS, 10], [MATT_HOUSE, -7], [HAMPTER_HOUSE, 9]]) {
    patch(L.x + dx, L.z + 4, 2.5, 4);
    brazier(L.x + dx * 0.6, L.z + 6.5, true);
  }
  for (const L of [CASINO, BANK]) {
    for (const s of [-1, 1]) {
      firstOpen([3.5, 5, 6.5, 8].map((d) => [L.x + s * d, L.z - (L === BANK ? 6.9 : 5.2)]), 0.5, (x, z) => farFromJacks(x, z) && jack('y_pumpkin_orange_jackolantern', x, z, Math.PI, 0.55, 3));
      firstOpen([8.5, 10, 11.5].map((d) => [L.x + s * d, L.z - 5.5]), 0.6, (x, z) => brazier(x, z, true));
    }
  }
  // Meowtown: jack-o'-lanterns round the fountain, patches in the square, an arch at the south entrance
  {
    const M = MEOWTOWN;
    for (let k = 0; k < 4; k++) {
      const x = M.x + Math.cos(k * 1.571) * 3.8;
      const z = M.z + Math.sin(k * 1.571) * 3.8;
      if (open(x, z, 0.5, true)) jack(k % 2 ? 'y_pumpkin_yellow_jackolantern' : 'y_pumpkin_orange_jackolantern', x, z, Math.PI / 2 - k * 1.571, 0.5, 2.8);
    }
    for (const [dx, dz] of [[-11, 11], [11, 11], [-11, -11], [11, -11]]) patch(M.x + dx, M.z + dz, 2.6, 4, { anywhere: true });
    arch(M.x, M.z + 20.5, 0);
    for (const s of [-1, 1]) fence(M.x + s * 3.3 - (s < 0 ? 3 * 1.5 : 0), M.z + 20.5, 0, 3);
  }
  // the corn field: pumpkin patches round it
  patch(CORN.x + 11, CORN.z, 3.5, 8, { big: 2 });
  patch(CORN.x - 10, CORN.z + 7, 3, 5);
  patch(CORN.x + 3, CORN.z + 11, 3, 5);
  brazier(CORN.x + 9, CORN.z + 9);
  // the radio tower, the Cat Tree and the UFO: mini graveyards, a brazier each
  for (const [L, d, n] of [[TOWER, 6.5, 3], [CAT_TREE, 9, 4], [UFO, 9, 3]]) {
    gravesNear(L, d, n);
    const s = spot(L.x, L.z, d + 5, 0.6);
    if (s) brazier(...s);
    patch(L.x + d + 2, L.z - 2, 2.5, 4);
  }
  // the lake: patches on the sand, a coffin washed up, braziers on the beach
  {
    const L = LAKE;
    const sand = (a) => [L.x + Math.cos(a) * 26.6, L.z + Math.sin(a) * 18.6];
    for (const a of [Math.PI, 0, Math.PI / 2, 2.4, 0.75]) patch(...sand(a), 1.6, 4, { anywhere: true });
    const [cx, cz] = sand(-2.3);
    if (open(cx, cz, 0.6, true)) {
      place('h_coffin_old', cx, cz, 0.9, 2, { collide: 'post' });
      place('y_skull', cx + 0.9, cz + 0.6, 2.4, 0.3, { collide: false });
    }
    for (const a of [1.15, 1.95, -0.4]) brazier(...sand(a), true);
  }
  // Winter's Castle: jack-o'-lanterns by the gate and the walls, braziers, patches outside
  {
    const C = CASTLE;
    for (const dz of [-9, 9]) firstOpen([[C.x + 16.5, C.z + dz], [C.x + 17.5, C.z + dz]], 0.6, (x, z) => farFromJacks(x, z) && jack('y_pumpkin_yellow_jackolantern', x, z, Math.PI / 2, 0.6, 3));
    for (const dz of [-5, 5]) brazier(C.x + 17, C.z + dz, true);
    patch(C.x, C.z + 15, 3, 6, { anywhere: true });
    patch(C.x - 17, C.z, 3, 5, { anywhere: true });
    graves(GRAVEYARD.x, GRAVEYARD.z - GD - 3.4, Math.PI, 4);
  }
  // Glorp Park: a graveyard between the arena and the maze, an arch at the maze, braziers at the arena, patches
  {
    graves(ARENA.x + 2, ARENA.z + 25, 0, 5);
    arch(MAZE.x - 22, MAZE.z, Math.PI / 2);
    for (const s of [-1, 1]) brazier(ARENA.x + s * 7.5, ARENA.z - 19.5);
    patch(ARENA.x - 14, ARENA.z + 24, 3, 6, { big: 2 });
    patch(ARENA.x + 22, ARENA.z + 4, 3, 5);
    patch(RACE.x, RACE.z, 4, 9, { big: 2, anywhere: true }); // the raceway infield
  }

  // ---------- bake ----------
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const meshes = [];
  for (const [key, geos] of chunks) {
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'spooky';
    meshes.push(mesh);
    if (!key.startsWith('s')) {
      scene.add(mesh);
      continue;
    }
    // a pumpkin 70 m off in the dark is a few pixels (its glow stays): the renderer swaps this LOD to nothing there
    merged.computeBoundingSphere();
    const lod = new THREE.LOD();
    lod.position.copy(merged.boundingSphere.center);
    mesh.position.copy(lod.position).negate();
    lod.addLevel(mesh, 0);
    lod.addLevel(new THREE.Object3D(), FAR);
    scene.add(lod);
  }
  for (const t of templates.values()) t.geo.dispose();
  const glows = glowPoints(lights);
  scene.add(glows);
  return { glowSpots, jacks, meshes, glows, graveyard: GRAVEYARD, board };
}

// All the small night lights in one draw call: soft additive discs that flicker a little and fade in as the fog
// darkens (the environment darkens the fog at night, so this needs no hook into its clock).
function glowPoints(lights) {
  const n = lights.length / 7;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set(lights.slice(i * 7, i * 7 + 3), i * 3);
    col.set(lights.slice(i * 7 + 3, i * 7 + 6), i * 3);
    size[i] = lights[i * 7 + 6];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const uniforms = { uK: { value: 0 }, uScale: { value: 400 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float size;
      uniform float uScale;
      uniform float uTime;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vColor = color * (0.88 + 0.12 * sin(uTime * 9.0 + position.x * 7.1) * sin(uTime * 5.3 + position.z * 3.7));
        vFade = 1.0 - smoothstep(70.0, 150.0, -mv.z);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uScale / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uK;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        float d = 1.0 - length(gl_PointCoord - 0.5) * 2.0;
        if (d <= 0.0) discard;
        gl_FragColor = vec4(vColor, d * d * 0.85 * uK * vFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.name = 'spooky-glows';
  const v = new THREE.Vector2();
  pts.onBeforeRender = (renderer, scene, camera) => {
    const rt = renderer.getRenderTarget();
    const h = rt ? rt.height : renderer.getDrawingBufferSize(v).y;
    uniforms.uScale.value = h * 0.5 * camera.projectionMatrix.elements[5];
    uniforms.uTime.value = performance.now() / 1000;
    const f = scene.fog?.color;
    const lum = f ? 0.2126 * f.r + 0.7152 * f.g + 0.0722 * f.b : 0;
    uniforms.uK.value = 1 - THREE.MathUtils.smoothstep(lum, 0.04, 0.22);
  };
  return pts;
}

// Spooky sky: purple dusk, a sickly green-blue night, autumn-orange golden hour.
export const SPOOKY_LOOKS = {
  gold: { top: '#3b2a6e', horizon: '#ff8a3c', bottom: '#ffb070', fog: '#d9825a', sun: '#ff9a4a', glow: '#ff9a4a' },
  night: { top: '#120626', horizon: '#3d1f5c', bottom: '#1a0f2e', fog: '#2a1a40', sun: '#c9ffb0', hemiSky: '#6a4f9a', hemiGround: '#2a2238', glow: '#d6b8ff' },
};
