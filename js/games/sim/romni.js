// Romni: runs the Bank of Romni. A classic blocky Roblox-style noob (yellow head and arms,
// blue torso, green legs) with a banker's top hat. Talk to him to take out or repay a loan.
import * as THREE from 'three';
import { markerTexture } from './textures.js';

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.beginPath();
  g.ellipse(44, 52, 7, 12, 0, 0, Math.PI * 2);
  g.ellipse(84, 52, 7, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.strokeStyle = '#111';
  g.beginPath();
  g.arc(64, 70, 26, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const LINES = [
  'Welcome to the Bank of Romni. Need some Glorp Coins?',
  'Loans are 20%. You have 5 minutes. Then 30 seconds. Then Winty.',
  'I am not a scam. I am a bank. Banks are never scams.',
  "Bloxy cola? No. Only loans.",
  'Oof.',
];

export function createRomni({ scene, world, RAPIER, hud, claw, at }) {
  const yellow = new THREE.MeshStandardMaterial({ color: '#f5cd30', roughness: 0.6 });
  const blue = new THREE.MeshStandardMaterial({ color: '#0d69ac', roughness: 0.6 });
  const green = new THREE.MeshStandardMaterial({ color: '#a4bd47', roughness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  const box = (w, h, d, m, x, y, z, parent) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // R6 proportions (studs ≈ 0.45 m): legs 2 tall, torso 2x2, head 1.2
  const legL = box(0.42, 0.85, 0.42, green, -0.22, 0.425, 0, body);
  const legR = box(0.42, 0.85, 0.42, green, 0.22, 0.425, 0, body);
  box(0.86, 0.86, 0.42, blue, 0, 1.28, 0, body);
  // gold tie and $ pin
  box(0.1, 0.5, 0.02, new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.6, roughness: 0.3 }), 0, 1.36, 0.22, body);
  const armPivot = (x) => {
    const p = new THREE.Group();
    p.position.set(x, 1.68, 0);
    box(0.42, 0.85, 0.42, yellow, 0, -0.38, 0, p);
    body.add(p);
    return p;
  };
  const armL = armPivot(-0.64);
  const armR = armPivot(0.64);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.52, 20), yellow);
  head.position.y = 1.98;
  head.castShadow = true;
  body.add(head);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true }));
  face.position.set(0, 1.98, 0.305);
  body.add(face);
  // banker's top hat
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), black);
  hatBrim.position.y = 2.27;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 20), black);
  hat.position.y = 2.52;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.08, 20), new THREE.MeshStandardMaterial({ color: '#2f7d2a' }));
  band.position.y = 2.33;
  body.add(hatBrim, hat, band);
  root.position.copy(at);
  scene.add(root);
  world.createCollider(RAPIER.ColliderDesc.cylinder(1.1, 0.45), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, at.y + 1.1, at.z)));
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('$') }));
  marker.scale.set(0.55, 0.55, 1);
  scene.add(marker);

  const st = { talkCd: 0, line: 0, wave: 0 };
  return {
    root,
    wave() {
      st.wave = 1.6;
    },
    update(dt, t) {
      const p = claw.position();
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      const want = d < 10 ? Math.atan2(p.x - at.x, p.z - at.z) : Math.PI;
      let diff = want - root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      root.rotation.y += diff * Math.min(1, dt * 4);
      // idle bob, and the classic arm swing
      body.position.y = Math.abs(Math.sin(t * 2)) * 0.03;
      st.wave = Math.max(0, st.wave - dt);
      armR.rotation.x = st.wave > 0 ? -2.6 + Math.sin(t * 14) * 0.3 : Math.sin(t * 1.5) * 0.08;
      armR.rotation.z = st.wave > 0 ? 0.3 : 0;
      armL.rotation.x = -Math.sin(t * 1.5) * 0.08;
      legL.rotation.x = legR.rotation.x = 0;
      marker.position.set(at.x, at.y + 3.2 + Math.sin(t * 3) * 0.1, at.z);
      st.talkCd -= dt;
      if (d < 4.5 && st.talkCd <= 0) {
        st.talkCd = 25;
        st.wave = 1.6;
        hud.say('ROMNI', LINES[st.line++ % LINES.length], { color: '#f5cd30', ms: 4500 });
      }
    },
    dispose() {
      scene.remove(root, marker);
    },
  };
}
