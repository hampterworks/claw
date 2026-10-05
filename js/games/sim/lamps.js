// Extra street lamps (along the dirt paths, Glorp Park, the road ends, the lake, the castle,
// Meowtown and the houses), so nights are never pitch black. They look like the road lamps in
// districts.js; environment.js lights their bulbs and draws a light pool under each one at night.
import * as THREE from 'three';

export function buildLamps({ scene, world, RAPIER, fixed, spots }) {
  const N = spots.length;
  const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.11, 3.6, 6), new THREE.MeshStandardMaterial({ color: '#2b2f3a' }), N);
  const cap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.18, 0.16, 8), post.material, N);
  const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2b0').multiplyScalar(1.6) }), N);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    post.setMatrixAt(i, m.makeTranslation(x, 1.8, z));
    cap.setMatrixAt(i, m.makeTranslation(x, 3.86, z));
    bulb.setMatrixAt(i, m.makeTranslation(x, 3.66, z));
    world.createCollider(RAPIER.ColliderDesc.cylinder(1.8, 0.11), fixed(x, 1.8, z));
  });
  post.castShadow = true;
  for (const o of [post, cap, bulb]) {
    o.computeBoundingSphere();
    scene.add(o);
  }
  return { bulb, positions: spots };
}

// lamp spots every `step` metres along a curve, alternating sides
export function lampsAlong(curve, step = 14, side = 1.9) {
  const out = [];
  const len = curve.getLength();
  const tan = new THREE.Vector3();
  let k = 0;
  for (let d = step * 0.5; d < len; d += step, k++) {
    const u = d / len;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, tan);
    const s = k % 2 ? side : -side;
    out.push([p.x - tan.z * s, p.z + tan.x * s]);
  }
  return out;
}
