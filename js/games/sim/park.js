// Glorp Park, the new east side of Ohio: the Pet Battle Arena, the Hedge Maze (home of
// Hide and Seek) and the Outskirts forest that now rings the whole (bigger) map.
// Uses its own random numbers so the rest of Ohio is laid out exactly like before.
import * as THREE from 'three';
import { signTexture, memeSpriteTexture } from './textures.js';

export const ARENA = new THREE.Vector3(112, 0, -16);
export const MAZE = new THREE.Vector3(111, 0, 34);
// Hide and Seek is played inside this circle (arena, maze and the woods around them)
export const HS_ZONE = { x: 106, z: 12, r: 46 };

const CELLS = 11;
const CELL = 3.2;
const HEDGE_H = 2.4;
const ARENA_R = 12;

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function buildPark({ B, RAPIER, world, scene, disposables, bounds }) {
  const rand = rng(4242);
  const { deco, solidBox, fixed, template } = B;
  const out = { trees: [], hideSpots: [] };
  const clear = [];

  function sign(lines, x, y, z, rotY, w, h, o = {}) {
    const tex = signTexture(lines, { w: 512, h: Math.round((512 * h) / w), size: o.size || 70, ...o });
    disposables.push(tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    scene.add(m);
    return m;
  }
  const cyl = (r, h, color, x, y, z, collide = true, seg = 24) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (collide) world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, r), fixed(x, y, z));
    return m;
  };

  // ---------- roads: the main road now runs all the way across, plus a lane to the arena ----------
  for (const s of [-1, 1]) {
    solidBox(s * 108.5, 0.015, -52, 47, 0.03, 8, '#3b3f4a', { tex: 'asphalt', shadow: false, collide: false });
    solidBox(s * 108.5, 0.04, -52, 47, 0.02, 0.25, '#ffe14d', { shadow: false, collide: false });
  }
  solidBox(ARENA.x, 0.015, -38.5, 5, 0.03, 19, '#3b3f4a', { tex: 'asphalt', shadow: false, collide: false });

  // ---------- Pet Battle Arena (a little colosseum, entrance faces the road at -z) ----------
  {
    const A = ARENA;
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 0.6, ARENA_R + 0.6, 0.04, 40), new THREE.MeshStandardMaterial({ color: '#e8d29a', roughness: 1 }));
    sand.position.set(A.x, 0.02, A.z);
    sand.receiveShadow = true;
    scene.add(sand);
    // stepped stands, in segments around the ring with a gap for the gate
    const N = 30;
    const tiers = [
      [13.2, 0.8, '#c9b48a'],
      [14.4, 1.6, '#b9a37a'],
      [15.6, 2.4, '#c9b48a'],
      [16.7, 3.6, '#a08a62'],
    ];
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) / N) * Math.PI * 2;
      // gate: the segments around "north" (-z) stay open
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.2) continue;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      for (const [r, h, color] of tiers) {
        const wide = (2 * Math.PI * r) / N + 0.12;
        const depth = r > 16 ? 0.6 : 1.25;
        solidBox(A.x + dx * r, h / 2, A.z + dz * r, wide, h, depth, i % 2 ? color : '#d6c299', { tex: 'stone', rotY: a });
      }
    }
    // gate arch + sign
    const gz = A.z - 15.2;
    solidBox(A.x - 2.6, 2.4, gz, 1.0, 4.8, 3.4, '#a08a62', { tex: 'stone' });
    solidBox(A.x + 2.6, 2.4, gz, 1.0, 4.8, 3.4, '#a08a62', { tex: 'stone' });
    solidBox(A.x, 5.2, gz, 6.4, 0.9, 3.4, '#8a7450', { tex: 'stone' });
    sign(['PET BATTLE ARENA'], A.x, 5.2, gz - 1.72, Math.PI, 6.0, 0.7, { size: 52, color: '#ffe14d', bg: '#3a1d5c', border: '#ffe14d' });
    // centre stage: two pet pedestals facing each other
    cyl(4.2, 0.4, '#8a7450', A.x, 0.2, A.z, true, 32);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.08, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7bf2').multiplyScalar(1.6) }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(A.x, 0.42, A.z);
    scene.add(ring);
    for (const s of [-1, 1]) cyl(0.8, 0.5, s < 0 ? '#2d6bd1' : '#c0182f', A.x + s * 2.4, 0.65, A.z, true, 16);
    // banners on poles around the top
    const cloth = ['#ff7bf2', '#7CFF4F', '#5ff2ff', '#ffe14d'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = A.x + Math.sin(a) * 16.7;
      const z = A.z + Math.cos(a) * 16.7;
      cyl(0.08, 3, '#3a3f4f', x, 3.6 + 1.5, z, false, 6);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ color: cloth[i % 4], side: THREE.DoubleSide }));
      flag.position.set(x + Math.cos(a) * 0.6, 6.5, z - Math.sin(a) * 0.6);
      flag.rotation.y = a + Math.PI / 2;
      scene.add(flag);
    }
    // the announcer's desk just inside the gate (the interaction spot)
    solidBox(A.x - 4.2, 0.55, A.z - 10.4, 2.6, 1.1, 0.9, '#6b4226', { tex: 'wood' });
    sign(['⚔️ SIGN UP HERE'], A.x - 4.2, 1.45, A.z - 10.9, Math.PI, 2.4, 0.5, { size: 40, color: '#ffe14d', bg: '#3a1d5c', border: '#ffe14d' });
    const host = new THREE.Sprite(new THREE.SpriteMaterial({ map: memeSpriteTexture('smudge') }));
    host.center.set(0.5, 0);
    host.scale.set(1.5, 1.5, 1);
    host.position.set(A.x - 4.2, 1.1, A.z - 9.9);
    scene.add(host);
    out.arenaDesk = new THREE.Vector3(A.x - 4.2, 0, A.z - 11.4);
    out.arenaHost = host;
    clear.push([A.x, A.z, 19.5]);
  }

  // ---------- the Hedge Maze ----------
  {
    const M = MAZE;
    const size = CELLS * CELL;
    const x0 = M.x - size / 2;
    const z0 = M.z - size / 2;
    // walls[k]: east wall of cell (i,j) = 'e', south wall = 's' (outer border handled separately)
    const east = Array.from({ length: CELLS }, () => Array(CELLS).fill(true));
    const south = Array.from({ length: CELLS }, () => Array(CELLS).fill(true));
    const seen = Array.from({ length: CELLS }, () => Array(CELLS).fill(false));
    const stack = [[0, 5]];
    seen[0][5] = true;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < CELLS && b < CELLS && !seen[a][b]);
      if (!nb.length) {
        stack.pop();
        continue;
      }
      const [a, b] = nb[Math.floor(rand() * nb.length)];
      if (a > i) east[i][j] = false;
      else if (a < i) east[a][j] = false;
      else if (b > j) south[i][j] = false;
      else south[i][b] = false;
      seen[a][b] = true;
      stack.push([a, b]);
    }
    // a few extra openings so it's loops, not one long corridor (better for chasing)
    for (let k = 0; k < 14; k++) {
      const i = Math.floor(rand() * (CELLS - 1));
      const j = Math.floor(rand() * (CELLS - 1));
      if (rand() < 0.5) east[i][j] = false;
      else south[i][j] = false;
    }
    const hedge = (x, z, sx, sz) => {
      const g = 0.62 + rand() * 0.1;
      solidBox(x, HEDGE_H / 2, z, sx, HEDGE_H, sz, new THREE.Color().setHSL(0.31, 0.5, g * 0.42), { tex: 'hedge' });
    };
    const T = 0.7;
    // interior walls, merged into runs
    for (let i = 0; i < CELLS - 1; i++) {
      let start = -1;
      for (let j = 0; j <= CELLS; j++) {
        const on = j < CELLS && east[i][j];
        if (on && start < 0) start = j;
        if (!on && start >= 0) {
          hedge(x0 + (i + 1) * CELL, z0 + ((start + j) / 2) * CELL, T, (j - start) * CELL + T);
          start = -1;
        }
      }
    }
    for (let j = 0; j < CELLS - 1; j++) {
      let start = -1;
      for (let i = 0; i <= CELLS; i++) {
        const on = i < CELLS && south[i][j];
        if (on && start < 0) start = i;
        if (!on && start >= 0) {
          hedge(x0 + ((start + i) / 2) * CELL, z0 + (j + 1) * CELL, (i - start) * CELL + T, T);
          start = -1;
        }
      }
    }
    // outer border with gates: west (row 5) and south (column 5)
    const gate = 5;
    hedge(x0, z0 + (gate / 2) * CELL, T, gate * CELL + T);
    hedge(x0, z0 + ((gate + 1 + CELLS) / 2) * CELL, T, (CELLS - gate - 1) * CELL + T);
    hedge(x0 + size, M.z, T, size + T);
    hedge(M.x, z0, size + T, T);
    hedge(x0 + (gate / 2) * CELL, z0 + size, gate * CELL + T, T);
    hedge(x0 + ((gate + 1 + CELLS) / 2) * CELL, z0 + size, (CELLS - gate - 1) * CELL + T, T);
    // dead ends make the best hiding spots
    for (let i = 0; i < CELLS; i++) {
      for (let j = 0; j < CELLS; j++) {
        const walls = (i === 0 ? !(j === gate) : east[i - 1][j]) + (i === CELLS - 1 ? 1 : east[i][j]) + (j === 0 ? 1 : south[i][j - 1]) + (j === CELLS - 1 ? !(i === gate) : south[i][j]);
        if (walls >= 3 && !(i === 5 && j === 5)) out.hideSpots.push(new THREE.Vector3(x0 + (i + 0.5) * CELL, 0, z0 + (j + 0.5) * CELL));
      }
    }
    // the middle: a tiny fountain with a golden hampter on top
    {
      const cx = x0 + 5.5 * CELL;
      const cz = z0 + 5.5 * CELL;
      cyl(0.9, 0.5, '#cfd6de', cx, 0.25, cz, true, 16);
      const gold = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.4, roughness: 0.35, emissive: '#3a2600' });
      const ham = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 2), gold);
      ham.scale.set(1, 0.9, 1.05);
      ham.position.set(cx, 0.82, cz);
      ham.castShadow = true;
      scene.add(ham);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), gold);
        ear.position.set(cx + s * 0.2, 1.12, cz);
        scene.add(ear);
      }
    }
    // the noticeboard by the west gate (Hide and Seek starts here)
    const bx = x0 - 3.2;
    const bz = z0 + (gate + 0.5) * CELL;
    for (const s of [-1, 1]) solidBox(bx, 1.1, bz + s * 1.3, 0.18, 2.2, 0.18, '#6b4226', { tex: 'wood' });
    solidBox(bx, 1.75, bz, 0.12, 1.3, 2.9, '#8d5e3b', { tex: 'wood' });
    sign(['HIDE & SEEK', 'START HERE'], bx - 0.07, 1.75, bz, -Math.PI / 2, 2.6, 1.1, { size: 46, color: '#7CFF4F', bg: '#12041f', border: '#7CFF4F', colors: ['#7CFF4F', '#ffe14d'] });
    sign(['THE HEDGE MAZE'], x0 - 0.36, HEDGE_H + 0.35, z0 + (gate + 0.5) * CELL, -Math.PI / 2, 3.4, 0.6, { size: 44, color: '#ffe14d', bg: '#2f5d2a', border: '#ffe14d' });
    out.hsBoard = new THREE.Vector3(bx - 1.0, 0, bz);
    out.mazeRect = { x0, z0, x1: x0 + size, z1: z0 + size };
    clear.push([M.x, M.z, size * 0.75 + 2], [bx, bz, 3]);
  }

  // ---------- the Outskirts: woods all around the edge of the (now bigger) map ----------
  {
    const names = ['n_CommonTree_1', 'n_CommonTree_2', 'n_CommonTree_3', 'n_CommonTree_4', 'n_PineTree_1', 'n_PineTree_2', 'n_PineTree_3', 'n_BirchTree_1', 'n_CommonTree_Autumn_1', 'n_Willow_1', 'n_Willow_2'];
    const inRing = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > 94 && Math.max(Math.abs(x), Math.abs(z)) < bounds - 3;
    const free = (x, z, pad) => clear.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r + pad) && Math.abs(z + 52) > 6 && !(Math.abs(x - ARENA.x) < 4 && z < -26 && z > -50);
    const place = (n, pad, fn) => {
      for (let k = 0, tries = 0; k < n && tries < n * 40; tries++) {
        const x = (rand() * 2 - 1) * bounds;
        const z = (rand() * 2 - 1) * bounds;
        if (!inRing(x, z) || !free(x, z, pad)) continue;
        fn(x, z);
        k++;
      }
    };
    place(190, 1.6, (x, z) => {
      const name = names[Math.floor(rand() * names.length)];
      const sc = 0.85 + rand() * 0.55;
      const handle = deco(name, x, 0, z, rand() * 6, sc);
      out.trees.push({ handle, x, z, h: template(name).size.y * sc });
      world.createCollider(RAPIER.ColliderDesc.cylinder(1.6, 0.35), fixed(x, 1.6, z));
      clear.push([x, z, 1.6]);
      if (Math.hypot(x - HS_ZONE.x, z - HS_ZONE.z) < HS_ZONE.r - 4 && rand() < 0.35) out.hideSpots.push(new THREE.Vector3(x + 0.9, 0, z + 0.9));
    });
    place(90, 0.9, (x, z) => {
      deco(['n_Bush_1', 'n_BushBerries_1', 'n_BushBerries_2'][Math.floor(rand() * 3)], x, 0, z, rand() * 6, 1.0 + rand() * 0.6);
      clear.push([x, z, 0.9]);
    });
    place(40, 1, (x, z) => B.staticModel(['n_Rock_1', 'n_Rock_2', 'n_Rock_3', 'n_Rock_Moss_1', 'n_Rock_Moss_2'][Math.floor(rand() * 5)], x, 0, z, rand() * 6, 1.2 + rand() * 0.6));
    place(160, 0.3, (x, z) => deco(['n_Flowers', 'n_Grass', 'n_Plant_1'][Math.floor(rand() * 3)], x, 0, z, rand() * 6, 0.9, false));
  }
  return out;
}
