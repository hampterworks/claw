// World-building toolkit, tuned for draw calls:
// - every model in world.glb is merged into ONE geometry with baked vertex colours
//   (so a table is 1 draw call instead of 4),
// - static scenery (walls, trees, corn, rocks...) is drawn with InstancedMesh,
//   one per model per 64 m map chunk, so off-screen chunks are culled,
// - dynamic props share their model's geometry and one material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyDetail } from './detail.js';

const CHUNK = 64;
const UP = new THREE.Vector3(0, 1, 0);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export function createBuilder({ RAPIER, world, scene, models }) {
  const props = [];
  const templates = new Map();
  const batches = new Map();
  const yawQ = (y) => new THREE.Quaternion().setFromAxisAngle(UP, y);

  const furnitureMat = applyDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }), 'grain', { ao: 0.3 });
  const natureMat = applyDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }), 'grain', { ao: 0.4, aoHeight: 1.4 });
  const RECOLOR = { Wood: '#8d5e3b' };

  function template(name) {
    let t = templates.get(name);
    if (t) return t;
    const obj = models.getObjectByName(name);
    if (!obj) throw new Error('missing model ' + name);
    obj.updateMatrixWorld(true);
    const inv = obj.matrixWorld.clone().invert();
    const parts = [];
    const col = new THREE.Color();
    obj.traverse((m) => {
      if (!m.isMesh) return;
      const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      const pos = src.getAttribute('position');
      const arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        arr[i * 3] = pos.getX(i);
        arr[i * 3 + 1] = pos.getY(i);
        arr[i * 3 + 2] = pos.getZ(i);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      col.copy(mat.color);
      if (RECOLOR[mat.name]) col.set(RECOLOR[mat.name]);
      const colors = new Float32Array(pos.count * 3);
      const baked = src.getAttribute('color'); // Kenney atlas colours baked per vertex
      for (let i = 0; i < pos.count; i++) {
        if (baked) {
          colors[i * 3] = baked.getX(i) * col.r;
          colors[i * 3 + 1] = baked.getY(i) * col.g;
          colors[i * 3 + 2] = baked.getZ(i) * col.b;
        } else col.toArray(colors, i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(g);
    });
    const geo = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const size = geo.boundingBox.getSize(new THREE.Vector3());
    t = { geo, size, box: geo.boundingBox, mat: name.startsWith('n_') ? natureMat : furnitureMat };
    templates.set(name, t);
    return t;
  }

  // ---------- static scenery (instanced) ----------
  // Returns a handle with setVisible() (used to hide trees in front of the camera).
  function deco(name, x, y, z, rotY = 0, scale = 1, shadow = true) {
    const key = `${name}|${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}|${shadow ? 1 : 0}`;
    let b = batches.get(key);
    if (!b) {
      b = { name, shadow, matrices: [], mesh: null };
      batches.set(key, b);
    }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), yawQ(rotY), new THREE.Vector3(scale, scale, scale));
    const index = b.matrices.length;
    b.matrices.push(m);
    let visible = true;
    return {
      x,
      z,
      setVisible(v) {
        if (v === visible || !b.mesh) return;
        visible = v;
        b.mesh.setMatrixAt(index, v ? m : HIDDEN);
        b.mesh.instanceMatrix.needsUpdate = true;
      },
    };
  }

  function finalize() {
    finalizeBoxes();
    for (const b of batches.values()) {
      const t = template(b.name);
      const mesh = new THREE.InstancedMesh(t.geo, t.mat, b.matrices.length);
      b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = b.shadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
      b.mesh = mesh;
    }
  }

  // ---------- physics helpers ----------
  function fixed(x, y, z, q) {
    const d = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (q) d.setRotation(q);
    return world.createRigidBody(d);
  }

  function staticBox(x, y, z, hx, hy, hz, rotY = 0, rotQ = null) {
    const b = fixed(x, y, z, rotQ || yawQ(rotY));
    return world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.8), b);
  }

  function staticModel(name, x, y, z, rotY = 0, scale = 1) {
    const h = deco(name, x, y, z, rotY, scale);
    const s = template(name).size;
    staticBox(x, y + (s.y * scale) / 2, z, (s.x * scale) / 2, (s.y * scale) / 2, (s.z * scale) / 2, rotY);
    return h;
  }

  // Plain coloured boxes (floors, platforms, roofs, ramps...) + matching static colliders.
  // All of them become a few InstancedMeshes (per chunk, per shadow flag) with per-instance colour.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // one material per surface kind (o.tex: 'brick', 'stone', 'hedge'... see detail.js); default: fine grain
  const boxMats = new Map();
  const boxMat = (tex = 'grain') => {
    let m = boxMats.get(tex);
    if (!m) boxMats.set(tex, (m = applyDetail(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), tex)));
    return m;
  };
  const boxBatches = new Map();
  function solidBox(x, y, z, sx, sy, sz, color, o = {}) {
    const shadow = o.shadow !== false;
    const tex = o.tex || 'grain';
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}|${shadow ? 1 : 0}|${tex}`;
    let b = boxBatches.get(key);
    if (!b) boxBatches.set(key, (b = { shadow, tex, items: [] }));
    const q = o.rotQ ? o.rotQ.clone() : yawQ(o.rotY || 0);
    b.items.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)), c: new THREE.Color(color) });
    if (o.collide !== false) staticBox(x, y, z, sx / 2, sy / 2, sz / 2, o.rotY || 0, o.rotQ || null);
  }
  function finalizeBoxes() {
    for (const b of boxBatches.values()) {
      const mesh = new THREE.InstancedMesh(boxGeo, boxMat(b.tex), b.items.length);
      b.items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, it.c);
      });
      mesh.castShadow = b.shadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  }

  // ---------- dynamic props ----------
  function addBody(mesh, colliderDesc, x, y, z, rotY, hy, o = {}) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y + hy, z)
        .setRotation(yawQ(rotY))
        .setLinearDamping(0.1)
        .setAngularDamping(0.3)
        .setCanSleep(true)
    );
    world.createCollider(colliderDesc.setDensity(o.density ?? 0.6).setFriction(o.friction ?? 0.7).setRestitution(o.bounce ?? 0.1), body);
    body.sleep();
    mesh.castShadow = o.shadow !== false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = true;
    scene.add(mesh);
    const p = {
      body,
      mesh,
      hy: o.centered ? 0 : hy,
      baseOff: hy,
      kind: o.kind || 'prop',
      name: o.name || o.kind || 'prop',
      spawn: new THREE.Vector3(x, y + hy, z),
      elevated: y > 0.3,
      knocked: false,
      moved: false,
      bonked: false,
      ...(o.extra || {}),
    };
    props.push(p);
    return p;
  }

  function prop(name, x, y, z, rotY = 0, o = {}) {
    const t = template(name);
    const s = o.scale || 1;
    const mesh = new THREE.Mesh(t.geo, t.mat);
    mesh.scale.setScalar(s);
    const hx = (t.size.x * s) / 2;
    const hy = (t.size.y * s) / 2;
    const hz = (t.size.z * s) / 2;
    const p = addBody(mesh, RAPIER.ColliderDesc.cuboid(hx, Math.max(hy, 0.03), hz), x, y, z, rotY, hy, { ...o, name });
    p.half = new THREE.Vector3(hx, hy, hz);
    return p;
  }

  // A walled room from Kenney wall pieces (2.2 m each). `doors`/`windows` are
  // sets like 'n2' (north side, piece 2). Open roof so the camera can see in.
  function room(cx, cz, nx, nz, { doors = [], windows = [], y = 0, floor = '#c99a6b', floorCollide = true } = {}) {
    const W = nx * 2.2;
    const D = nz * 2.2;
    if (floor) solidBox(cx, y + 0.03, cz, W, 0.06, D, floor, { shadow: false, collide: floorCollide });
    const piece = (side, i) => (doors.includes(side + i) ? 'k_wallDoorway' : windows.includes(side + i) ? 'k_wallWindow' : 'k_wall');
    const place = (type, x, z, rotY) => {
      deco(type, x, y, z, rotY);
      const q = yawQ(rotY);
      if (type === 'k_wallDoorway') {
        const off = new THREE.Vector3(0.8, 0, 0).applyQuaternion(q);
        staticBox(x + off.x, y + 1.42, z + off.z, 0.3, 1.42, 0.09, rotY);
        staticBox(x - off.x, y + 1.42, z - off.z, 0.3, 1.42, 0.09, rotY);
        staticBox(x, y + 2.5, z, 1.1, 0.34, 0.09, rotY);
      } else {
        staticBox(x, y + 1.42, z, 1.1, 1.42, 0.09, rotY);
      }
    };
    for (let i = 0; i < nx; i++) {
      const x = cx - W / 2 + 1.1 + i * 2.2;
      place(piece('n', i), x, cz - D / 2, 0);
      place(piece('s', i), x, cz + D / 2, Math.PI);
    }
    for (let i = 0; i < nz; i++) {
      const z = cz - D / 2 + 1.1 + i * 2.2;
      place(piece('w', i), cx - W / 2, z, Math.PI / 2);
      place(piece('e', i), cx + W / 2, z, -Math.PI / 2);
    }
    return { W, D };
  }

  return {
    props,
    yawQ,
    template,
    deco,
    finalize,
    fixed,
    staticBox,
    staticModel,
    solidBox,
    addBody,
    prop,
    room,
    natureMat,
    furnitureMat,
    dispose() {
      templates.forEach((t) => t.geo.dispose());
      boxGeo.dispose();
      boxMat.dispose();
      furnitureMat.dispose();
      natureMat.dispose();
    },
  };
}
