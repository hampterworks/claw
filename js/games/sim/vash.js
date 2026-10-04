// Lyonia, a.k.a. Vash: Matt's good friend. Tiny wolf boy built from a Kenney Mini Character
// (recoloured atlas) plus procedural ears, heart eyes, ponytail, sash and tail.
// Also used, in gold, as the statue in the secret Vash Shrine.
import * as THREE from 'three';
import { markerTexture } from './textures.js';

const PURPLE = '#8a5cff';
const HAIR = '#3a2c34';

function heartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const heart = (s, color) => {
    g.save();
    g.translate(32, 34);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(0, 18);
    g.bezierCurveTo(-30, -2, -18, -26, 0, -10);
    g.bezierCurveTo(18, -26, 30, -2, 0, 18);
    g.fillStyle = color;
    g.fill();
    g.restore();
  };
  heart(1.15, '#2a1450');
  heart(0.95, '#b48cff');
  heart(0.55, '#e6d8ff');
  g.fillStyle = '#ffffff';
  g.fillRect(24, 22, 6, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function swordMesh(gold) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.018), new THREE.MeshStandardMaterial({ color: '#c9b8ff', emissive: '#5a2cc9', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }));
  blade.position.x = 0.2;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.04), gold);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: '#2a1a3d' }));
  grip.position.x = -0.07;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), gold);
  pommel.position.x = -0.135;
  g.add(blade, guard, grip, pommel);
  return g;
}
export function vashSword() {
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.8, roughness: 0.3 });
  const s = swordMesh(gold);
  s.traverse((o) => (o.castShadow = true));
  return s;
}

// Build a posable Vash from a loaded vash.glb (each instance needs its own load).
export function buildVash(gltf, { gold = false } = {}) {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const bone = (n) => model.getObjectByName(n);
  const head = bone('head');
  const torso = bone('torso');
  const armR = bone('arm-right');
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.85, roughness: 0.32, emissive: '#140c00' });
  const mat = (color, o = {}) => (gold ? goldMat : new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }));
  const add = (parent, mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    model.add(mesh);
    mesh.updateMatrixWorld(true);
    parent.attach(mesh); // positions above are in model space (head spans y 0.34..0.67, face at +z)
    return mesh;
  };
  // wolf ears
  for (const s of [-1, 1]) {
    add(head, new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 4), mat(HAIR)), s * 0.13, 0.83, -0.02, 0, Math.PI / 4, -s * 0.22);
    add(head, new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.19, 4), mat('#7a5a68')), s * 0.125, 0.81, 0.03, 0, Math.PI / 4, -s * 0.22);
  }
  // purple hair tips + a streak in the bangs
  const tipMat = mat(PURPLE, { emissive: '#3a1a80' });
  for (const s of [-1, 1]) add(head, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.12), tipMat), s * 0.228, 0.37, -0.04);
  add(head, new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.015), tipMat), -0.05, 0.64, 0.172, 0, 0, 0.3);
  // ponytail (his left, behind)
  add(head, new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(HAIR)), 0.17, 0.64, -0.15);
  add(head, new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 6), mat(HAIR)), 0.25, 0.55, -0.18, 0, 0, 0.6);
  add(head, new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), tipMat), 0.315, 0.45, -0.2, 0, 0, 0.6 + Math.PI);
  // glowing purple heart eyes + blush
  if (!gold) {
    const eyeMat = new THREE.MeshBasicMaterial({ map: heartTexture(), transparent: true, alphaTest: 0.1, color: new THREE.Color(1.5, 1.5, 1.5) });
    for (const s of [-1, 1]) add(head, new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.105), eyeMat), s * 0.085, 0.49, 0.172);
    const blush = new THREE.MeshBasicMaterial({ color: '#ff8fa8', transparent: true, opacity: 0.55 });
    for (const s of [-1, 1]) add(head, new THREE.Mesh(new THREE.CircleGeometry(0.026, 10), blush), s * 0.15, 0.43, 0.171);
  }
  // gold cross earring (his right)
  const g = gold ? goldMat : new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.8, roughness: 0.3 });
  add(head, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, 0.012), g), -0.235, 0.38, 0.03);
  add(head, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.045), g), -0.235, 0.395, 0.03);
  // open white coat over the black suit (torso spans x ±0.14, y 0.18..0.34, z -0.15..0.10)
  const white = mat('#f1eef8');
  const coat = (w, h, d, x, y, z, m = white, rx = 0) => add(torso, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, rx);
  coat(0.3, 0.19, 0.02, 0, 0.26, -0.162);
  for (const s of [-1, 1]) {
    coat(0.02, 0.19, 0.26, s * 0.15, 0.26, -0.025);
    coat(0.085, 0.19, 0.02, s * 0.1, 0.26, 0.112);
    coat(0.012, 0.19, 0.024, s * 0.058, 0.26, 0.114, g);
    coat(0.02, 0.15, 0.24, s * 0.16, 0.115, -0.03); // coat skirt
  }
  coat(0.3, 0.16, 0.02, 0, 0.115, -0.17, white, 0.12);
  coat(0.085, 0.15, 0.02, 0.1, 0.115, 0.118);
  coat(0.02, 0.15, 0.16, -0.172, 0.11, 0.02, mat(PURPLE)); // purple coat panel, his right
  // purple sash, belt + gold buckle, choker
  coat(0.06, 0.3, 0.02, 0.0, 0.26, 0.13, mat(PURPLE)).rotation.z = 0.75;
  coat(0.31, 0.035, 0.28, 0, 0.19, -0.026, mat('#1a1420'));
  coat(0.06, 0.05, 0.02, 0, 0.19, 0.118, g);
  coat(0.13, 0.03, 0.1, 0, 0.345, -0.01, mat('#1a1420'));
  // wolf tail
  const tail = new THREE.Group();
  const seg = (r, l, color, y) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, l, 6), mat(color, color === PURPLE ? { emissive: '#3a1a80' } : {}));
    m.rotation.x = Math.PI;
    m.position.y = y;
    m.castShadow = true;
    return m;
  };
  tail.add(seg(0.075, 0.2, HAIR, -0.08), seg(0.06, 0.14, HAIR, -0.21), seg(0.045, 0.1, PURPLE, -0.3));
  add(torso, tail, 0, 0.1, -0.19, 1.1, 0, 0); // tips point down and back
  if (gold) model.traverse((o) => o.isMesh && (o.material = goldMat));
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false; // skinned bounds don't follow the animation
    }
  });
  return { model, head, torso, armR, tail };
}

const LINES_Q1 = [
  "Hi. I'm Lyonia. Call me Vash. Matt put my sword on his top shelf AGAIN. Can you get it down? I could. I just don't want to.",
  "The sword is in Matt's House, on the tall shelf. It's normal sized. The shelf is just rude.",
];
const LINES_Q2 = [
  'Thanks. Totally unrelated: there is NO secret shrine of me in the far corner past the lake. Do not look for it.',
  'I would never build a shrine to myself. Matt built it. Not that it exists. Northwest. Hypothetically.',
];
const LINES_DONE = [
  "I'm not short, I'm fun-sized.",
  'Matt and I go way back. He has to look down to say hi.',
  "I'm six foot in wolf years.",
  'Big ears. Big heart. Small everything else.',
  "You found the shrine? ...I don't know what you're talking about.",
  'Claw, if you boil me I will bite your ankles. I can reach those.',
];

export function createVash({ scene, world, RAPIER, gltf, hud, sfx, ch, claw, home }) {
  const v = buildVash(gltf);
  const root = new THREE.Group();
  root.add(v.model);
  root.position.copy(home);
  scene.add(root);
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.4, 0.22), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(home.x, 0.4, home.z)));
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('!') }));
  marker.scale.set(0.5, 0.5, 1);
  scene.add(marker);

  const mixer = new THREE.AnimationMixer(v.model);
  const actions = {};
  for (const a of gltf.animations) actions[a.name] = mixer.clipAction(a);
  for (const n of ['emote-yes', 'emote-no', 'jump']) {
    if (!actions[n]) continue;
    actions[n].setLoop(THREE.LoopRepeat, n === 'jump' ? 1 : 3);
    actions[n].clampWhenFinished = false;
  }
  let current = null;
  function play(name, fade = 0.2) {
    if (!actions[name] || current === name) return;
    const next = actions[name].reset().play();
    if (current) actions[current].crossFadeTo(next, fade, false);
    current = name;
  }
  play('idle', 0);
  mixer.addEventListener('finished', () => play('idle'));

  // the sword he gets back
  const heldSword = vashSword();
  heldSword.visible = false;
  heldSword.position.set(-0.03, -0.12, 0.05);
  heldSword.rotation.set(0, Math.PI / 2, -Math.PI / 2.4);
  v.armR.add(heldSword);

  const st = { talkCd: 0, line: 0, hopT: 6, hop: 0, spaceCd: 0, done: { vashshelf: ch.isDone('vashshelf'), shrine: ch.isDone('shrine') } };
  if (st.done.vashshelf) heldSword.visible = true;

  return {
    root,
    model: v.model,
    play,
    get pos() {
      return root.position;
    },
    giveSword() {
      heldSword.visible = true;
    },
    update(dt, t) {
      const p = claw.position();
      const d = Math.hypot(p.x - home.x, p.z - home.z);
      // face Claw when close
      if (d < 9) {
        const want = Math.atan2(p.x - home.x, p.z - home.z);
        let diff = want - root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, dt * 5);
      }
      // little hops "to see over things"
      st.hopT -= dt;
      if (st.hopT <= 0 && current === 'idle') {
        st.hopT = 6 + Math.random() * 6;
        st.hop = 0.5;
        play('jump', 0.1);
      }
      if (st.hop > 0) st.hop = Math.max(0, st.hop - dt);
      root.position.y = home.y + Math.sin((st.hop / 0.5) * Math.PI) * 0.25;
      v.tail.rotation.z = Math.sin(t * 4) * 0.35; // wag
      marker.visible = !ch.isDone('vashshelf') || !ch.isDone('shrine');
      marker.position.set(home.x, home.y + 1.25 + Math.sin(t * 3) * 0.1, home.z);
      // quest completions -> happy emote
      for (const id of ['vashshelf', 'shrine']) {
        if (!st.done[id] && ch.isDone(id)) {
          st.done[id] = true;
          play('emote-yes', 0.1);
          if (id === 'vashshelf') heldSword.visible = true;
          sfx.mrrp();
        }
      }
      // personal space
      st.spaceCd -= dt;
      if (d < 1.0 && st.spaceCd <= 0) {
        st.spaceCd = 8;
        play('emote-no', 0.1);
        hud.popup("VASH: PERSONAL SPACE. I'M SMALL, NOT A FOOTSTOOL", '#b48cff');
      }
      // chat
      st.talkCd -= dt;
      if (d < 3.2 && st.talkCd <= 0) {
        st.talkCd = 20;
        const pool = !ch.isDone('vashshelf') ? LINES_Q1 : !ch.isDone('shrine') ? LINES_Q2 : LINES_DONE;
        hud.banner('LYONIA (VASH)', pool[st.line++ % pool.length]);
        sfx.mrrp();
      }
      mixer.update(dt);
    },
    dispose() {
      scene.remove(root, marker);
      mixer.stopAllAction();
    },
  };
}
