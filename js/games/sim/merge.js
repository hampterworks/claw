// Draw-call diet: merge static, plain-coloured meshes (boxes, cylinders, cones... built in code)
// into one vertex-coloured mesh per material look per 64 m chunk.
// Anything that moves, changes colour, has a texture, is transparent, or that game code keeps a
// reference to is left alone. Movement is detected by stepping every world animation and
// comparing before/after, so a newly added animation can't get frozen by accident.
import * as THREE from 'three';
import { applyDetail } from './detail.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CHUNK = 64;

function collectRefs(value, out, depth = 0, seen = new Set()) {
  if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return;
  seen.add(value);
  if (value.isObject3D) {
    value.traverse((o) => out.add(o));
    return;
  }
  if (value.isMaterial) return;
  for (const v of Array.isArray(value) ? value : Object.values(value)) collectRefs(v, out, depth + 1, seen);
}

function mergeable(o) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible) return false;
  const m = o.material;
  if (!m || Array.isArray(m) || m.userData.wind) return false;
  if (!(m.isMeshStandardMaterial || m.isMeshBasicMaterial) || m.type === 'MeshPhysicalMaterial') return false;
  if (m.map || m.alphaMap || m.normalMap || m.emissiveMap || m.envMap || m.vertexColors || m.transparent || m.opacity < 1) return false;
  const g = o.geometry;
  return !!(g && g.getAttribute('position') && !g.morphAttributes.position);
}

function signature(o) {
  const m = o.material;
  return [m.color.getHexString(), m.emissive ? m.emissive.getHexString() : '', o.visible ? 1 : 0, ...o.matrixWorld.elements.map((e) => e.toFixed(4))].join(',');
}

// world: the object returned by buildWorld (W); extra: objects to keep untouched.
export function mergeStaticMeshes(scene, W, extra = []) {
  const keep = new Set();
  collectRefs(W.special, keep);
  for (const p of W.props) p.mesh.traverse((o) => keep.add(o));
  for (const e of extra) collectRefs(e, keep);

  scene.updateMatrixWorld(true);
  const cands = [];
  scene.traverse((o) => {
    if (keep.has(o) || !mergeable(o)) return;
    // skip anything inside a skinned/animated rig
    for (let p = o.parent; p; p = p.parent) if (p.isBone || p.isSkinnedMesh || keep.has(p)) return;
    cands.push(o);
  });
  const before = cands.map(signature);
  // step every animation a few times; whatever changed is animated
  for (const [dt, t] of [[0.37, 1.7], [0.41, 3.9], [0.29, 6.2], [0.33, 9.1]]) W.update(dt, t);
  scene.updateMatrixWorld(true);
  const statics = cands.filter((o, i) => signature(o) === before[i]);

  const groups = new Map();
  const v = new THREE.Vector3();
  for (const o of statics) {
    const m = o.material;
    o.getWorldPosition(v);
    const chunk = `${Math.floor(v.x / CHUNK)},${Math.floor(v.z / CHUNK)}`;
    const key = [
      m.type,
      chunk,
      m.isMeshStandardMaterial ? `${m.metalness}|${m.roughness}|${m.emissive.getHexString()}|${m.emissiveIntensity}` : '',
      m.flatShading ? 1 : 0,
      m.side,
      m.fog ? 1 : 0,
      m.toneMapped ? 1 : 0,
      o.castShadow ? 1 : 0,
      o.receiveShadow ? 1 : 0,
    ].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }

  let removed = 0;
  let added = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      g.applyMatrix4(o.matrixWorld);
      const c = o.material.color;
      const n = g.getAttribute('position').count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const src = list[0].material;
    const mat = src.clone();
    mat.color.set('#ffffff');
    mat.vertexColors = true;
    if (mat.isMeshStandardMaterial) applyDetail(mat, 'grain', { ao: 0.3 });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = list[0].castShadow;
    mesh.receiveShadow = list[0].receiveShadow;
    mesh.name = 'merged-static';
    scene.add(mesh);
    added++;
    for (const o of list) {
      o.parent?.remove(o);
      removed++;
    }
  }
  return { candidates: cands.length, statics: statics.length, removed, added };
}

// Merge a parent's direct plain-coloured child meshes (in the parent's local space), e.g. the
// boxes and cones bolted onto a character's bone. They keep moving with the parent.
export function mergeChildren(parent) {
  const groups = new Map();
  for (const o of parent.children) {
    if (!mergeable(o) || o.children.length) continue;
    const m = o.material;
    const key = [m.type, m.isMeshStandardMaterial ? `${m.metalness}|${m.roughness}|${m.emissive.getHexString()}|${m.emissiveIntensity}` : '', m.flatShading ? 1 : 0, m.side, o.castShadow ? 1 : 0].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      o.updateMatrix();
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      g.applyMatrix4(o.matrix);
      const c = o.material.color;
      const n = g.getAttribute('position').count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.toArray(col, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mat = list[0].material.clone();
    mat.color.set('#ffffff');
    mat.vertexColors = true;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = list[0].castShadow;
    mesh.frustumCulled = false;
    parent.add(mesh);
    for (const o of list) parent.remove(o);
  }
}
