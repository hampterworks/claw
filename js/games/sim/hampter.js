// Hampter: lives in Hampter Works. A chubby low-poly hamster with a big wheel.
// Pet him (E) and he squeaks, hops and runs the wheel. No quest, just vibes.
import * as THREE from 'three';

const LINES = [
  '*squeak*',
  '*squeak squeak*',
  'hampter.',
  '*stuffs cheeks*',
  'eek!',
  '*happy wheel noises*',
  '*chews a seed very loudly*',
  'hampter is baby',
];
const SCREAM = '*AAAAAAAAAAA* (hamster scream)';

function makeHamster() {
  const g = new THREE.Group();
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
  const fur = mat('#e39b55');
  const cream = mat('#fbefd9');
  const pink = mat('#ffaab8');
  const black = new THREE.MeshStandardMaterial({ color: '#141014', roughness: 0.2 });
  const ball = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  ball(0.42, fur, 0, 0.42, 0, 1.0, 0.98, 1.05); // the loaf
  ball(0.3, cream, 0, 0.36, 0.2, 1.05, 1.05, 0.75); // belly
  ball(0.17, cream, -0.2, 0.52, 0.27); // cheeks
  ball(0.17, cream, 0.2, 0.52, 0.27);
  for (const s of [-1, 1]) {
    ball(0.1, fur, s * 0.24, 0.84, 0.0, 1, 1, 0.45); // ears
    ball(0.06, pink, s * 0.24, 0.84, 0.035, 1, 1, 0.3);
    ball(0.055, black, s * 0.14, 0.66, 0.36); // beady eyes
    ball(0.015, new THREE.MeshBasicMaterial({ color: '#ffffff' }), s * 0.13 + 0.015, 0.68, 0.405);
  }
  ball(0.04, pink, 0, 0.58, 0.41); // nose
  const mouth = ball(0.05, mat('#7a2d3a'), 0, 0.48, 0.39, 1, 0.25, 0.4);
  const paws = [-1, 1].map((s) => ball(0.07, pink, s * 0.1, 0.38, 0.4, 1, 0.8, 0.8)); // the scream pose
  for (const s of [-1, 1]) ball(0.08, pink, s * 0.18, 0.04, 0.22, 1, 0.5, 1.3); // feet
  return { g, mouth, paws };
}

function makeWheel() {
  const wheel = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#c8d0da', metalness: 0.8, roughness: 0.3 });
  const R = 1.0;
  const spin = new THREE.Group();
  for (const z of [-0.35, 0.35]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 6, 28), metal);
    rim.position.z = z;
    spin.add(rim);
    for (let k = 0; k < 6; k++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, R * 2, 5), metal);
      spoke.rotation.z = (k / 6) * Math.PI;
      spoke.position.z = z;
      spin.add(spoke);
    }
  }
  const rungs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), metal, 24);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    rungs.setMatrixAt(i, m.compose(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0), q, new THREE.Vector3(1, 1, 1)));
  }
  spin.add(rungs);
  spin.position.y = R + 0.15;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, R + 0.2, 0.12), new THREE.MeshStandardMaterial({ color: '#ff7bf2' }));
  stand.position.set(0, (R + 0.2) / 2, -0.45);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.1), stand.material);
  base.position.y = 0.04;
  wheel.add(spin, stand, base);
  wheel.traverse((o) => (o.castShadow = true));
  return { wheel, spin };
}

export function createHampter({ scene, world, RAPIER, hud, sfx, claw, home, wheelAt }) {
  const h = makeHamster();
  const root = new THREE.Group();
  root.add(h.g);
  root.position.copy(home);
  scene.add(root);
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.42, 0.42), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(home.x, home.y + 0.42, home.z)));
  const w = makeWheel();
  w.wheel.position.copy(wheelAt);
  w.wheel.rotation.y = -Math.PI / 2.4;
  scene.add(w.wheel);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 1.1, 0.45), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(wheelAt.x, 1.1, wheelAt.z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2.4))));

  const st = { hop: 0, talk: 0, wheelV: 0.4, cd: 0, n: 0 };
  return {
    get pos() {
      return root.position;
    },
    squeak() {
      if (st.cd > 0) return;
      st.cd = 0.6;
      st.n++;
      const scream = st.n % 5 === 0 || Math.random() < 0.12;
      if (scream) sfx.hamsterScream();
      else sfx.squeak();
      st.hop = 0.45;
      st.talk = scream ? 1.4 : 0.5;
      st.wheelV = 9;
      hud.say('HAMPTER', scream ? SCREAM : LINES[Math.floor(Math.random() * LINES.length)], { color: '#ffb347', ms: 2600 });
    },
    update(dt, t) {
      st.cd -= dt;
      const p = claw.position();
      const d = Math.hypot(p.x - root.position.x, p.z - root.position.z);
      // look at Claw when close, otherwise look at the door
      const want = d < 7 ? Math.atan2(p.x - root.position.x, p.z - root.position.z) : 0;
      let diff = want - root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      root.rotation.y += diff * Math.min(1, dt * 4);
      // breathing, hop, open mouth, wiggling paws
      st.hop = Math.max(0, st.hop - dt);
      st.talk = Math.max(0, st.talk - dt);
      const breathe = 1 + Math.sin(t * 3) * 0.025;
      h.g.scale.set(breathe, 1 / breathe, breathe);
      h.g.position.y = Math.sin((st.hop / 0.45) * Math.PI) * 0.35;
      h.mouth.scale.y = st.talk > 0 ? 0.6 + Math.abs(Math.sin(t * 30)) * 0.6 : 0.25;
      h.paws.forEach((pw, i) => (pw.position.y = 0.38 + (st.talk > 0 ? Math.sin(t * 25 + i * 2) * 0.04 : 0)));
      // the wheel spins up when he gets excited
      st.wheelV += (0.4 - st.wheelV) * Math.min(1, dt * 0.8);
      w.spin.rotation.z -= st.wheelV * dt;
    },
    dispose() {
      scene.remove(root, w.wheel);
    },
  };
}
