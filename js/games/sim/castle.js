// Winter's Castle, the moving parts: the dungeon cell door, the lever that opens it from the
// outside, and the bookcase that slides away from the secret room. (The stone is in districts.js.)
import * as THREE from 'three';

const OPEN_FOR = 8; // seconds the cell door stays open after the lever

export function createCastle({ scene, world, RAPIER, castle }) {
  const { cellDoor: cd, lever: lv, bookcase: bk } = castle;
  const fixedBody = (x, y, z) => world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));

  // cell door: a frame of bars that slides up into the ceiling
  const door = new THREE.Group();
  const barMat = new THREE.MeshStandardMaterial({ color: '#6b7280', metalness: 0.75, roughness: 0.35 });
  const len = cd.z1 - cd.z0;
  for (let z = 0.15; z < len; z += 0.3) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, cd.h - 0.2, 6), barMat);
    b.position.set(0, (cd.h - 0.2) / 2, z - len / 2);
    door.add(b);
  }
  for (const y of [0.3, cd.h / 2, cd.h - 0.3]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), barMat);
    rail.position.y = y;
    door.add(rail);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.2), new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.8, roughness: 0.3 }));
  lock.position.set(0.08, 1.1, len / 2 - 0.2);
  door.add(lock);
  door.position.set(cd.x, 0, (cd.z0 + cd.z1) / 2);
  scene.add(door);
  const doorBody = fixedBody(cd.x, cd.h / 2, (cd.z0 + cd.z1) / 2);
  const doorCol = world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, cd.h / 2, len / 2), doorBody);

  // lever on a post in the corridor
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), new THREE.MeshStandardMaterial({ color: '#3a3f4f' }));
  post.position.set(lv.x, 0.55, lv.z);
  const pivot = new THREE.Group();
  pivot.position.set(lv.x, 1.05, lv.z);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), barMat);
  handle.position.y = 0.3;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff4f6d' }));
  knob.position.y = 0.6;
  pivot.add(handle, knob);
  pivot.rotation.x = 0.6;
  scene.add(post, pivot);

  // the suspicious bookcase (in the throne hall's west wall)
  const shelf = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3b22', roughness: 0.8 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 1.8), wood);
  frame.position.y = 1.6;
  shelf.add(frame);
  const bookCols = ['#c0182f', '#2d6bd1', '#2f9e44', '#ffcc33', '#8a3cff', '#ff9a3c'];
  let n = 0;
  for (const y of [0.5, 1.25, 2.0, 2.75]) {
    for (let z = -0.75; z < 0.7; z += 0.16) {
      const h = 0.4 + ((n * 37) % 10) / 40;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.12), new THREE.MeshStandardMaterial({ color: bookCols[n % bookCols.length] }));
      b.position.set(0.12, y + h / 2 - 0.1, z);
      shelf.add(b);
      n++;
    }
  }
  // the one book that sticks out
  const tell = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.13), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#553300' }));
  tell.position.set(0.24, 2.05, 0.1);
  shelf.add(tell);
  shelf.position.copy(bk);
  shelf.traverse((o) => (o.castShadow = true));
  scene.add(shelf);
  const shelfBody = fixedBody(bk.x, 1.6, bk.z);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 1.6, 0.9), shelfBody);

  const st = { doorOpen: 0, doorY: 0, shelf: 0, shelfOpen: false, leverT: 0 };
  const tmp = new THREE.Vector3();
  return {
    cell: castle.cell,
    leverAt: lv,
    shelfAt: new THREE.Vector3(bk.x + 0.9, 0, bk.z),
    get doorUp() {
      return st.doorY;
    },
    get shelfOpen() {
      return st.shelfOpen;
    },
    // is this point inside the jail cell?
    inCell(p) {
      return p.x < cd.x && p.x > cd.x - 3.9 && p.z > cd.z0 - 2 && p.z < cd.z1 + 1.6 && p.y < cd.h;
    },
    jail(claw) {
      st.doorOpen = 0;
      claw.setFlop?.(false);
      claw.teleport(castle.cell.x, castle.cell.y + 0.4, castle.cell.z);
    },
    openCell() {
      st.doorOpen = OPEN_FOR;
      st.leverT = 0.6;
    },
    pullBook() {
      st.shelfOpen = true;
    },
    update(dt) {
      // door slides up while open, back down after
      st.doorOpen = Math.max(0, st.doorOpen - dt);
      const want = st.doorOpen > 0 ? cd.h - 0.3 : 0;
      st.doorY += (want - st.doorY) * Math.min(1, dt * 4);
      door.position.y = st.doorY;
      doorCol.setEnabled(st.doorY < 1.2);
      st.leverT = Math.max(0, st.leverT - dt);
      pivot.rotation.x = st.doorOpen > 0 ? -0.6 : 0.6;
      // bookcase slides along the wall
      const s = st.shelfOpen ? 1.9 : 0;
      st.shelf += (s - st.shelf) * Math.min(1, dt * 1.5);
      shelf.position.z = bk.z + st.shelf;
      shelfBody.setTranslation(tmp.set(bk.x, 1.6, bk.z + st.shelf), true);
    },
    dispose() {
      scene.remove(door, post, pivot, shelf);
    },
  };
}
