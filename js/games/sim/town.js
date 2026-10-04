// Meowtown (Kenney Fantasy Town kit) and Glorp Mini Golf (Kenney Minigolf kit).
// Both kits snap to a grid, so their models keep their original pivots.
import * as THREE from 'three';
import { signTexture, memeSpriteTexture, markerTexture } from './textures.js';
import { waterMaterial } from './graphics.js';

export const MEOWTOWN = new THREE.Vector3(-58, 0, -30);
export const WINDMILL = new THREE.Vector3(-80, 0, -28);
export const GOLF = new THREE.Vector3(44, 0, 52);

const U = 2.6; // one Fantasy Town grid cell, in metres
const G = 3; // one mini golf tile
const FOUNTAIN_R = 2.25;

export function buildTown(ctx) {
  const { B, RAPIER, world, scene, rand, animated, disposables } = ctx;
  const { deco, staticBox, solidBox, prop, addBody, fixed, yawQ, template } = B;
  const out = { clear: [], npcs: [] };
  const rot2 = (x, z, r) => [x * Math.cos(r) + z * Math.sin(r), -x * Math.sin(r) + z * Math.cos(r)];

  const markerTex = markerTexture('!');
  disposables.push(markerTex);
  function npc(tex, x, z, { name, line, quests, size = 1.5 }) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    s.center.set(0.5, 0);
    s.scale.set(size, size, 1);
    s.position.set(x, 0, z);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex }));
    marker.center.set(0.5, 0);
    marker.scale.set(0.6, 0.6, 1);
    marker.position.set(x, size + 0.25, z);
    scene.add(s, marker);
    animated.push((dt, t) => (marker.position.y = size + 0.25 + Math.sin(t * 3 + x) * 0.12));
    const n = { sprite: s, marker, name, line, quests, pos: new THREE.Vector3(x, 0, z), talkCd: 0 };
    out.npcs.push(n);
    return n;
  }

  function sign(lines, x, y, z, rotY, w, h, o = {}) {
    const tex = signTexture(lines, { w: 512, h: Math.round((512 * h) / w), size: o.size || 70, ...o });
    disposables.push(tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    scene.add(m);
  }

  // Ring of thin boxes (a round wall the cat can't walk through).
  function ringWall(x, z, r, h, y0 = 0, segs = 16) {
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      staticBox(x + Math.cos(a) * r, y0 + h / 2, z + Math.sin(a) * r, 0.12, h / 2, (Math.PI * r) / segs + 0.05, -a);
    }
  }

  // ---------- Meowtown houses ----------
  const roofMats = ['#b4463c', '#3f6fb4', '#4f8a3a', '#8a5a9c'].map((c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8 }));
  function house(cx, cz, w, d, rot, { wood = false, roof = 0, chimney = true, name } = {}) {
    const wall = wood ? 't_wall-wood' : 't_wall';
    const win = wood ? 't_wall-wood-window-shutters' : 't_wall-window-shutters';
    const door = wood ? 't_wall-wood-door' : 't_wall-door';
    const put = (type, lx, lz, lr) => {
      const [x, z] = rot2(lx, lz, rot);
      deco(type, cx + x, 0, cz + z, lr + rot);
    };
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < d; j++) {
        const lx = (i - (w - 1) / 2) * U;
        const lz = (j - (d - 1) / 2) * U;
        if (i === w - 1) put(j % 2 ? wall : win, lx, lz, 0);
        if (i === 0) put(j % 2 ? win : wall, lx, lz, Math.PI);
        if (j === 0) put(i % 2 ? win : wall, lx, lz, Math.PI / 2);
        if (j === d - 1) put(i === Math.floor((w - 1) / 2) ? door : i % 2 ? wall : win, lx, lz, -Math.PI / 2);
      }
    }
    const W = w * U;
    const D = d * U;
    staticBox(cx, U / 2, cz, W / 2, U / 2, D / 2, rot);
    // gabled roof: a triangular prism along the house's long side
    const H = 1.9;
    const shape = new THREE.Shape([new THREE.Vector2(-D / 2 - 0.35, 0), new THREE.Vector2(D / 2 + 0.35, 0), new THREE.Vector2(0, H)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: W + 0.5, bevelEnabled: false });
    geo.translate(0, 0, -(W + 0.5) / 2);
    geo.rotateY(Math.PI / 2);
    const r = new THREE.Mesh(geo, roofMats[roof % roofMats.length]);
    r.position.set(cx, U, cz);
    r.rotation.y = rot;
    r.castShadow = true;
    r.receiveShadow = true;
    scene.add(r);
    disposables.push(geo);
    staticBox(cx, U + H * 0.3, cz, W / 2, H * 0.3, D / 4, rot);
    if (chimney) {
      const [x, z] = rot2(W / 4, 0, rot);
      deco('t_chimney', cx + x, U + H * 0.4, cz + z, rot);
    }
    if (name) {
      const [x, z] = rot2(0, D / 2 + 0.25, rot);
      sign([name], cx + x, U + 0.35, cz + z, rot, Math.min(W, 4.5), 0.75, { size: 60, bg: '#3a2a1a', border: '#c9a227', color: '#ffd23f' });
    }
  }

  // ---------- Meowtown ----------
  {
    const M = MEOWTOWN;
    solidBox(M.x, 0.02, M.z, 30, 0.04, 30, '#b9b2a6', { shadow: false, collide: false });
    // fountain + wishing water
    deco('t_fountain-round-detail', M.x, 0, M.z, 0);
    ringWall(M.x, M.z, FOUNTAIN_R + 0.35, 1.0);
    staticBox(M.x, 0.35, M.z, FOUNTAIN_R, 0.1, FOUNTAIN_R);
    const water = new THREE.Mesh(new THREE.CircleGeometry(FOUNTAIN_R, 32), waterMaterial({ shallow: '#7fe6ff', deep: '#2a9fd6' }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(M.x, 0.5, M.z);
    scene.add(water);
    // houses around the plaza
    house(M.x - 9, M.z - 11, 3, 2, 0, { roof: 0, name: 'THE GLORPY GOBLET' });
    house(M.x + 1.3, M.z - 11, 2, 2, 0, { wood: true, roof: 1 });
    house(M.x + 10.5, M.z - 11, 3, 2, 0, { roof: 2 });
    house(M.x - 8, M.z + 11, 2, 2, Math.PI, { wood: true, roof: 3 });
    house(M.x + 9, M.z + 11, 3, 2, Math.PI, { roof: 1, name: 'BLACKSMEOW' });
    house(M.x - 13, M.z, 2, 3, Math.PI / 2, { roof: 2 });
    house(M.x + 13.5, M.z + 0.5, 2, 2, -Math.PI / 2, { wood: true, roof: 0, chimney: false });
    // market stalls with goods to knock off
    const stalls = [
      ['t_stall-red', -5, -4, 0],
      ['t_stall-green', 5, -4, 0],
      ['t_stall-red', 5, 4.5, Math.PI],
      ['t_stall-green', -5, 4.5, Math.PI],
    ];
    const goods = ['k_books', 'k_plantSmall1', 'k_toaster', 'k_plantSmall2', 'k_kitchenBlender', 'k_radio'];
    stalls.forEach(([name, dx, dz, r], k) => {
      deco(name, M.x + dx, 0, M.z + dz, r);
      staticBox(M.x + dx, 0.5, M.z + dz, 1.25, 0.5, 1.25, r);
      for (let g = 0; g < 2; g++) {
        const [ox, oz] = rot2(-0.6 + g * 1.2, 0, r);
        prop(goods[(k * 2 + g) % goods.length], M.x + dx + ox, 1.02, M.z + dz + oz, rand() * 6, { density: 0.3, kind: 'market' });
      }
    });
    // lanterns (glowing bulbs batched in one instanced mesh)
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(2.5) }), 8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const x = M.x + Math.cos(a) * 8.5;
      const z = M.z + Math.sin(a) * 8.5;
      deco('t_lantern', x, 0, z, 0);
      world.createCollider(RAPIER.ColliderDesc.cylinder(2, 0.15), fixed(x, 2, z));
      bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 3.55, z));
    }
    bulbs.computeBoundingSphere();
    scene.add(bulbs);
    // carts, barrels of fun
    prop('t_cart', M.x + 3, 0, M.z + 8, 0.4, { density: 0.4 });
    prop('t_cart-high', M.x - 10, 0, M.z + 5, -0.6, { density: 0.4 });
    // fence + trees around the edge
    for (let i = -5; i <= 5; i++) {
      if (Math.abs(i) < 2) continue;
      deco('t_fence', M.x + i * U, 0, M.z + 16.5, Math.PI / 2);
      deco('t_fence', M.x + i * U, 0, M.z - 17.3, -Math.PI / 2);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 19 + rand() * 3;
      deco(['t_tree', 't_tree-high', 't_tree-crooked'][i % 3], M.x + Math.cos(a) * r, 0, M.z + Math.sin(a) * r, rand() * 6, 1.1 + rand() * 0.3);
    }
    sign(['MEOWTOWN', 'est. 1551'], M.x, 3.6, M.z + 17, 0, 4, 1.6, { size: 60, bg: '#3a2a1a', border: '#c9a227', colors: ['#ffd23f', '#fff'] });
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.0, 0.2), new THREE.MeshStandardMaterial({ color: '#5d3a1a' }));
    sp.position.set(M.x, 1.5, M.z + 17.1);
    scene.add(sp);
    out.crier = npc(memeSpriteTexture('smudge'), M.x + 3, M.z + 2.5, {
      name: 'TOWN CRIER CAT',
      line: 'HEAR YE: wreck the market stalls, bonk the windmill, and make a wish in the fountain!',
      quests: ['market', 'windmill', 'wish'],
    });
    out.fountain = M.clone();
    out.clear.push([M.x, M.z, 22]);
  }

  // ---------- windmill ----------
  {
    const W = WINDMILL;
    const stone = new THREE.MeshStandardMaterial({ color: '#cfc6b4', flatShading: true, roughness: 0.95 });
    const towerGeo = new THREE.CylinderGeometry(2.2, 2.9, 9, 10);
    const t = new THREE.Mesh(towerGeo, stone);
    t.position.set(W.x, 4.5, W.z);
    t.castShadow = t.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.0, 3.2, 10), new THREE.MeshStandardMaterial({ color: '#7a4a2a', flatShading: true }));
    cap.position.set(W.x, 10.6, W.z);
    cap.castShadow = true;
    scene.add(t, cap);
    world.createCollider(RAPIER.ColliderDesc.cylinder(4.5, 2.6), fixed(W.x, 4.5, W.z));
    const rotor = new THREE.Mesh(template('t_windmill').geo, B.furnitureMat);
    rotor.position.set(W.x + 2.9, 7.6, W.z);
    rotor.castShadow = true;
    scene.add(rotor);
    out.windmill = { spin: 0.6, pos: W.clone() };
    animated.push((dt) => {
      rotor.rotation.x += dt * out.windmill.spin;
      out.windmill.spin += (0.6 - out.windmill.spin) * dt * 0.25;
    });
    out.clear.push([W.x, W.z, 6]);
  }

  // ---------- Glorp Mini Golf ----------
  {
    const O = GOLF;
    // [tile, col, row, rotation]: start at the bottom, windmill, corner right, corner down, hole
    const course = [
      ['g_end', 0, 5, 0],
      ['g_start', 0, 4, 0],
      ['g_straight', 0, 3, 0],
      ['g_windmill', 0, 2, 0],
      ['g_straight', 0, 1, 0],
      ['g_corner', 0, 0, Math.PI],
      ['g_straight', 1, 0, Math.PI / 2],
      ['g_corner', 2, 0, Math.PI / 2],
      ['g_straight', 2, 1, 0],
      ['g_hole-round', 2, 2, 0],
    ];
    const q = new THREE.Quaternion();
    for (const [name, c, r, rot] of course) {
      const x = O.x + c * G;
      const z = O.z + r * G;
      deco(name, x, 0, z, rot, 1, false);
      // exact collision from the tile's own triangles
      const geo = template(name).geo;
      const src = geo.attributes.position;
      const verts = new Float32Array(src.count * 3);
      const v = new THREE.Vector3();
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      for (let i = 0; i < src.count; i++) {
        v.fromBufferAttribute(src, i).applyQuaternion(q);
        verts[i * 3] = v.x;
        verts[i * 3 + 1] = v.y;
        verts[i * 3 + 2] = v.z;
      }
      const idx = new Uint32Array(src.count);
      for (let i = 0; i < src.count; i++) idx[i] = i;
      world.createCollider(RAPIER.ColliderDesc.trimesh(verts, idx).setFriction(0.4), fixed(x, 0, z));
    }
    const hole = new THREE.Vector3(O.x + 2 * G, 0, O.z + 2 * G);
    deco('g_flag-red', hole.x + 0.35, 0.18, hole.z, 0);
    deco('g_castle', O.x - 4.5, 0, O.z + 6, 0.4);
    deco('g_castle', O.x + 9, 0, O.z + 12, -0.6);
    // the ball
    const ballMesh = new THREE.Mesh(template('g_ball-red').geo, B.furnitureMat);
    ballMesh.geometry.computeBoundingBox();
    const ballStart = new THREE.Vector3(O.x, 0.35, O.z + 4 * G);
    out.ball = addBody(ballMesh, RAPIER.ColliderDesc.ball(0.105).setFriction(0.3), ballStart.x, ballStart.y, ballStart.z, 0, 0, {
      density: 2,
      bounce: 0.4,
      kind: 'golf',
      centered: true,
    });
    out.ball.body.enableCcd(true);
    out.ball.body.setLinearDamping(0.55);
    out.ball.body.setAngularDamping(0.6);
    out.golf = { hole, ballStart, strokes: 0, cd: 0 };
    out.golfer = npc(memeSpriteTexture('huh'), O.x - 2.6, O.z + 4 * G + 1, {
      name: 'GOLF PRO CAT',
      line: 'Bonk the ball (F) into the hole by the red flag. Fewer bonks, more points. huh?',
      quests: ['golf'],
    });
    sign(['GLORP MINI GOLF'], O.x + 3, 3.6, O.z - 3.2, 0, 5, 1, { color: '#7CFF4F' });
    for (const dx of [-2.2, 2.2]) solidBox(O.x + 3 + dx, 1.6, O.z - 3.25, 0.2, 3.2, 0.2, '#5d3a1a');
    out.clear.push([O.x + 3, O.z + 7, 14]);
  }

  // ---------- quest logic ----------
  const st = { wishCd: 0 };
  out.check = (dt, t, { claw, ch, hud, sfx, mine = () => true }) => {
    const p = claw.position();
    for (const n of out.npcs) {
      n.talkCd -= dt;
      n.marker.visible = n.quests.some((q) => !ch.isDone(q));
      if (n.talkCd <= 0 && n.pos.distanceTo(p) < 3.2) {
        n.talkCd = 25;
        hud.banner(n.name, n.line);
        sfx.mrrp();
      }
    }
    // wishing fountain
    st.wishCd -= dt;
    if (st.wishCd <= 0 && Math.hypot(p.x - out.fountain.x, p.z - out.fountain.z) < FOUNTAIN_R && p.y < 1.4) {
      st.wishCd = 5;
      sfx.splash();
      hud.popup('YOU WISHED FOR MORE GLORP', '#5ff2ff');
      if (!ch.isDone('wish')) ch.chaos(150, 'WISH GRANTED', '#5ff2ff');
      ch.complete('wish');
    }
    // golf
    const g = out.golf;
    g.cd -= dt;
    const b = out.ball.body.translation();
    if (g.cd <= 0 && mine(out.ball) && Math.hypot(b.x - g.hole.x, b.z - g.hole.z) < 0.42 && b.y < 0.6) {
      g.cd = 2;
      sfx.ding();
      const strokes = Math.max(1, g.strokes);
      const label = strokes === 1 ? 'HOLE IN ONE!!' : strokes <= 3 ? `BIRDIE (${strokes} bonks)` : `SUNK IN ${strokes}`;
      ch.chaos(Math.max(100, 600 - strokes * 80), label, '#7CFF4F');
      ch.complete('golf');
      g.strokes = 0;
      out.resetBall();
    }
    if (mine(out.ball) && (b.y < -3 || Math.hypot(b.x - GOLF.x - 3, b.z - GOLF.z - 7) > 30)) out.resetBall();
  };
  out.resetBall = () => {
    const s = out.golf.ballStart;
    out.ball.body.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
    out.ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    out.ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };
  return out;
}
