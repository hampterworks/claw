// Spooktober dressing for Ohio (October only, see js/season.js): a graveyard north of Winter's Castle,
// jack-o'-lanterns by the street lamps and on porches, dead trees around the map, and pumpkin glows at night.
// Models come from halloween.glb (Kenney Graveyard Kit h_*, KayKit Halloween Bits y_*). Everything here is
// static, so it is baked into one vertex-coloured mesh per 64 m chunk (a handful of draw calls).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CHUNK = 64;
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
      templates.set(name, bakeTemplate(node));
    }
    return templates.get(name);
  };
  const chunks = new Map();
  const glowSpots = [];
  const jacks = []; // jack-o'-lantern spots (quests use them later)
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  const fixed = (x, y, z, rotY) => world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation(q.setFromAxisAngle(up, rotY)));
  // is a circle of radius r at (x, z) clear of colliders and paths?
  const shape = new RAPIER.Ball(1);
  function open(x, z, r) {
    if (free && !free(x, z, r * 0.5)) return false;
    shape.radius = r;
    let hit = false;
    world.intersectionsWithShape({ x, y: r + 0.15, z }, { x: 0, y: 0, z: 0, w: 1 }, shape, (c) => {
      hit = !c.isSensor();
      return !hit;
    });
    return !hit;
  }

  // place a model (feet on the ground); collide: 'box' (fitted cuboid) or false
  function place(name, x, z, rotY = 0, scale = 1, { y = 0, collide = 'box' } = {}) {
    const t = tpl(name);
    m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rotY), new THREE.Vector3(scale, scale, scale));
    const g = t.geo.clone().applyMatrix4(m);
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(g);
    if (collide === 'box') {
      const c = new THREE.Vector3((t.min.x + t.size.x / 2) * scale, 0, (t.min.z + t.size.z / 2) * scale).applyAxisAngle(up, rotY);
      const hy = (t.size.y * scale) / 2;
      world.createCollider(RAPIER.ColliderDesc.cuboid((t.size.x * scale) / 2, hy, (t.size.z * scale) / 2).setFriction(0.8), fixed(x + c.x, y + hy, z + c.z, rotY));
    }
  }
  function jack(name, x, z, rotY, scale, glow = 1.6) {
    place(name, x, z, rotY, scale, { collide: false });
    if (glow) glowSpots.push({ x, y: 0.35 * scale + 0.2, z, color: '#ff8a1f', size: glow }); // (each glow is a sprite: lamps light their own)
    jacks.push(new THREE.Vector3(x, 0, z));
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
    for (const s of [-1, 1]) jack('y_pumpkin_orange_jackolantern', G.x + GW - 1.4, gateZ + s * 1.9, -Math.PI / 2, 0.42, 1.8);
    glowSpots.push({ x: G.x - GW + 7.4, y: 0.9, z: G.z - 4.2, color: '#ffcf7a', size: 2.4 });
  }

  // ---------- jack-o'-lanterns by every third street lamp ----------
  lampSpots.forEach(([x, z], i) => {
    if (i % 3) return;
    const a = (i * 2.399) % (Math.PI * 2);
    const px = x + Math.cos(a) * 0.75;
    const pz = z + Math.sin(a) * 0.75;
    if (!open(px, pz, 0.35)) return;
    jack(i % 2 ? 'h_pumpkin_carved' : 'h_pumpkin_tall_carved', px, pz, -a + Math.PI / 2, 2.2, 0);
  });

  // ---------- porches: a big jack-o'-lantern each side of the door, small pumpkins around ----------
  for (const [x, z, rotY = 0, spread = 1.7] of porches) {
    const fwd = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (const s of [-1, 1]) {
      const px = x + right.x * spread * s + fwd.x * 0.6;
      const pz = z + right.z * spread * s + fwd.z * 0.6;
      if (!open(px, pz, 0.35)) continue;
      jack(s < 0 ? 'y_pumpkin_orange_jackolantern' : 'y_pumpkin_yellow_jackolantern', px, pz, rotY, 0.4, 1.6);
      const sx = px + right.x * 0.6 * s + fwd.x * 0.3;
      const sz = pz + right.z * 0.6 * s + fwd.z * 0.3;
      if (open(sx, sz, 0.2)) place('y_pumpkin_orange_small', sx, sz, rotY + s, 0.45, { collide: false });
    }
  }

  // ---------- dead trees and orange pines around the parks and the castle ----------
  const r = rng(77);
  for (const { x, z, rad, n } of parks) {
    let placed = 0;
    for (let tries = 0; tries < n * 8 && placed < n; tries++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rad;
      const tx = x + Math.cos(a) * d;
      const tz = z + Math.sin(a) * d;
      if (!open(tx, tz, 1.6)) continue;
      const kind = r();
      const name = kind < 0.35 ? 'y_tree_dead_large' : kind < 0.6 ? 'y_tree_dead_medium' : kind < 0.8 ? 'y_tree_pine_orange_medium' : 'y_tree_pine_orange_large';
      const s = name.includes('pine') ? 0.7 + r() * 0.25 : 0.8 + r() * 0.3;
      place(name, tx, tz, r() * 6.28, s, { collide: false });
      world.createCollider(RAPIER.ColliderDesc.cylinder(1.5, 0.3), fixed(tx, 1.5, tz, 0));
      placed++;
    }
  }

  // ---------- bake ----------
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const meshes = [];
  for (const geos of chunks.values()) {
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'spooky';
    scene.add(mesh);
    meshes.push(mesh);
  }
  for (const t of templates.values()) t.geo.dispose();
  return { glowSpots, jacks, meshes, graveyard: GRAVEYARD };
}

// Spooky sky: purple dusk, a sickly green-blue night, autumn-orange golden hour.
export const SPOOKY_LOOKS = {
  gold: { top: '#3b2a6e', horizon: '#ff8a3c', bottom: '#ffb070', fog: '#d9825a', sun: '#ff9a4a', glow: '#ff9a4a' },
  night: { top: '#120626', horizon: '#3d1f5c', bottom: '#1a0f2e', fog: '#2a1a40', sun: '#c9ffb0', hemiSky: '#6a4f9a', hemiGround: '#2a2238', glow: '#d6b8ff' },
};
