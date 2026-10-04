// Clicky the Wizard: Winter's castle wizard since 1726. Underpaid, overworked, no breaks.
// Built from a Kenney Mini Character plus a procedural hat, beard, robe, glasses and staff.
// His quest chain (coffee, spell pages, summoning stones) ends with him quitting in style:
// he summons a kaiju, and Ohio's mayor goes MEGA to stop it (see kaiju.js).
import * as THREE from 'three';
import { markerTexture } from './textures.js';
import { read, write } from '../../scores.js';

const NAME = 'CLICKY';
const COLOR = '#b48cff';

const LINES = {
  1: [
    "Three hundred years I've worked for Winter. Not one coffee break. Not ONE.",
    'Bring me a coffee mug from the Glorp Café. Any mug. I am begging, and wizards do not beg.',
    'Winter pays me in "exposure". I have been exposed to so much frost.',
  ],
  2: [
    'Ahh. Coffee. I can feel my spell slots again.',
    'Winter threw my spellbook out the window. Four pages are scattered around Ohio. Bring them back.',
    'One page blew into the bank, one is in the hedge maze, one is up the Cat Tree, and one got abducted by the UFO. Typical.',
  ],
  3: [
    'My spellbook! Now for my resignation letter. Written in magic.',
    'Wake the three summoning stones. Bonk them: one in the Pet Arena, one by the lake, one by the radio tower.',
    "I'm not saying I'll summon a monster to wreck this castle. I'm saying I won't NOT do that.",
  ],
  4: [
    'Everything is ready. Talk to me and I will hand in my notice. Loudly.',
    "Winter thinks I'm doing inventory. I am. I'm counting how many kaiju I can summon. One.",
  ],
  done: [
    'I quit and I feel AMAZING. Want me to do it again? I can quit as many times as I like.',
    "Winter put up a 'Help Wanted' sign. It's on fire. Unrelated.",
    "Matt sent me a fruit basket. It's a basket of one banana. Still the best pay I've had.",
    'Clicky Wizarding LLC. Now accepting clients. Rates: one (1) coffee.',
  ],
};

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a1a6b';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffe14d';
  const star = (x, y, r) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
  };
  for (const [x, y, r] of [[20, 22, 9], [78, 40, 7], [46, 84, 10], [104, 98, 8], [100, 14, 5], [14, 108, 6], [64, 18, 4]]) star(x, y, r);
  g.fillStyle = '#dff4ff';
  g.beginPath();
  g.arc(84, 70, 9, 0.6, Math.PI * 1.7);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function pageTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f3e3b8';
  g.beginPath();
  g.roundRect(4, 4, 88, 120, 6);
  g.fill();
  g.strokeStyle = '#8a5a2b';
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = '#5a3b8a';
  g.lineWidth = 2;
  for (let y = 22; y < 112; y += 12) {
    g.beginPath();
    g.moveTo(14, y);
    for (let x = 14; x < 82; x += 6) g.lineTo(x, y + Math.sin(x * 0.7 + y) * 2);
    g.stroke();
  }
  g.fillStyle = '#b48cff';
  g.font = 'bold 34px serif';
  g.textAlign = 'center';
  g.fillText('✦', 48, 74);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function runeTexture(lit) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = lit ? '#2a1450' : '#6b7280';
  g.fillRect(0, 0, 64, 128);
  g.strokeStyle = lit ? '#e6d8ff' : '#4b5160';
  g.lineWidth = 5;
  g.lineCap = 'round';
  const glyphs = [
    [[20, 20], [44, 44], [20, 44], [44, 20]],
    [[32, 56], [32, 88], [18, 72], [46, 72]],
    [[18, 98], [32, 112], [46, 98]],
  ];
  for (const gl of glyphs) {
    g.beginPath();
    gl.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// the wizard himself (gltf: assets/models/clicky.glb)
export function buildClicky(gltf) {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const head = model.getObjectByName('head');
  const add = (parent, mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    model.add(mesh);
    mesh.updateMatrixWorld(true);
    parent.attach(mesh); // positions are in model space (head spans y 0.34..0.67, face at +z)
    return mesh;
  };
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...o });
  const robeMat = mat('#4b2a86');
  const starMat = new THREE.MeshStandardMaterial({ map: starTexture(), roughness: 0.8 });
  // the hat, with a droopy tip
  add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 20), starMat), 0, 0.665, 0);
  const cone = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.38, 16), starMat), 0, 0.86, -0.02, -0.12);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 10), starMat);
  tip.position.set(0, 0.2, -0.04);
  tip.rotation.x = -0.7;
  tip.castShadow = true;
  cone.add(tip);
  add(head, new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 20), mat('#ffe14d', { metalness: 0.5 })), 0, 0.69, -0.005, Math.PI / 2);
  // a long grumpy beard and bushy brows
  const white = mat('#f1f1f1');
  add(head, new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 8), white), 0, 0.31, 0.15, Math.PI + 0.25);
  add(head, new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), white), -0.07, 0.43, 0.165);
  add(head, new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), white), 0.07, 0.43, 0.165);
  for (const s of [-1, 1]) add(head, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.03), white), s * 0.08, 0.58, 0.175, 0, 0, s * -0.3); // frowning brows
  // little round glasses
  const rim = mat('#2a1a3d', { metalness: 0.4 });
  for (const s of [-1, 1]) add(head, new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16), rim), s * 0.075, 0.515, 0.178);
  add(head, new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.008), rim), 0, 0.52, 0.18);
  // robe (stays put on the model root; arms poke out)
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 0.34, 14, 1, true), robeMat);
  robe.material.side = THREE.DoubleSide;
  robe.position.y = 0.17;
  robe.castShadow = true;
  model.add(robe);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.015, 6, 20), mat('#ffe14d', { metalness: 0.5 }));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.3;
  model.add(belt);
  // staff with a glowing orb
  const staff = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.95, 6), mat('#6b4226'));
  wood.position.y = 0.475;
  const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9a8ff').multiplyScalar(1.6) });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), orbMat);
  orb.position.y = 0.99;
  const prongs = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.01, 4, 10, Math.PI * 1.4), mat('#ffe14d', { metalness: 0.6 }));
  prongs.position.y = 0.97;
  prongs.rotation.z = Math.PI * 0.8;
  staff.add(wood, orb, prongs);
  staff.position.set(-0.27, 0, 0.06);
  staff.rotation.z = 0.06;
  model.add(staff);
  return { model, orb, orbMat };
}

export function createClicky({ scene, world, RAPIER, gltf, hud, sfx, ch, claw, home, pageSpots, stoneSpots, onSummon }) {
  const c = buildClicky(gltf);
  const root = new THREE.Group();
  root.add(c.model);
  c.model.scale.setScalar(2.4);
  root.position.copy(home);
  root.rotation.y = Math.PI;
  scene.add(root);
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.8, 0.45), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(home.x, 0.8, home.z)));
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('!') }));
  marker.scale.set(0.55, 0.55, 1);
  scene.add(marker);

  const mixer = new THREE.AnimationMixer(c.model);
  const actions = {};
  for (const a of gltf.animations) actions[a.name] = mixer.clipAction(a);
  for (const n of ['emote-yes', 'emote-no', 'interact-right', 'attack-melee-right']) {
    if (!actions[n]) continue;
    actions[n].setLoop(THREE.LoopRepeat, n.startsWith('emote') ? 2 : 1);
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

  // sparkles for the finger snaps
  const sparkGeo = new THREE.OctahedronGeometry(0.05, 0);
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e6d8ff').multiplyScalar(1.8) });
  const sparks = [];
  function snap(n = 10) {
    play('interact-right', 0.1);
    sfx.click();
    setTimeout(() => sfx.click(), 90);
    const o = new THREE.Vector3(0.4, 1.3, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y).add(root.position);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sparkGeo, sparkMat);
      m.position.copy(o);
      scene.add(m);
      sparks.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3), life: 0.8 });
    }
  }

  // ---------- quest state ----------
  const st = read('simclicky', { pages: [], stones: [] });
  const save = () => write('simclicky', st);
  const stage = () => (!ch.isDone('clicky1') ? 1 : !ch.isDone('clicky2') ? 2 : !ch.isDone('clicky3') ? 3 : ch.isDone('kaiju') ? 'done' : 4);

  // spell pages: floating parchment
  const pageTex = pageTexture();
  const pages = pageSpots.map((p, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: pageTex }));
    s.scale.set(0.55, 0.73, 1);
    s.position.copy(p);
    s.visible = false;
    scene.add(s);
    return { s, p, i };
  });
  // summoning stones: rune monoliths that light up when bonked
  const offTex = runeTexture(false);
  const onTex = runeTexture(true);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#8a8f9c', roughness: 0.9, flatShading: true });
  const stones = stoneSpots.map((p, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 0.7), stoneMat);
    body.position.y = 1.2;
    body.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.9), new THREE.MeshBasicMaterial({ map: offTex }));
    face.position.set(0, 1.25, 0.36);
    const back = face.clone();
    back.position.z = -0.36;
    back.rotation.y = Math.PI;
    const glow = new THREE.PointLight('#b48cff', 0, 9);
    glow.position.y = 2.6;
    g.add(body, face, back, glow);
    g.position.copy(p);
    g.rotation.y = p.ry || 0;
    scene.add(g);
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.55, 1.2, 0.35), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y + 1.2, p.z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry || 0))));
    return { g, face, back, glow, p, i };
  });
  function paintStones() {
    for (const s of stones) {
      const lit = st.stones.includes(s.i);
      s.face.material.map = s.back.material.map = lit ? onTex : offTex;
      s.glow.intensity = lit ? 6 : 0;
    }
  }
  paintStones();

  const say = (text, ms = 5200) => hud.say(NAME, text, { color: COLOR, ms });
  const talk = { cd: 2, line: 0, snapT: 7 };
  let lastStage = stage();

  // mugs delivered (props), page pickups, stone bonks
  function checkMug(props, { mine, reset, online }) {
    for (const pr of props) {
      if (pr.kind !== 'mug' || pr.gone || !mine(pr)) continue;
      const t = pr.body.translation();
      if (Math.hypot(t.x - home.x, t.z - home.z) < 2.6 && t.y < 3) {
        ch.complete('clicky1');
        snap(16);
        say('COFFEE. Oh, sweet bean water. I can feel my mana again. Okay, next problem: my spellbook.');
        sfx.purr?.();
        if (online) reset(pr);
        return;
      }
    }
  }

  return {
    root,
    get pos() {
      return root.position;
    },
    get stage() {
      return stage();
    },
    snap,
    // what to show on the minimap
    pois() {
      const s = stage();
      if (s === 2) return pages.filter((pg) => !st.pages.includes(pg.i)).map((pg) => ({ x: pg.p.x, z: pg.p.z, color: COLOR }));
      if (s === 3) return stones.filter((sn) => !st.stones.includes(sn.i)).map((sn) => ({ x: sn.p.x, z: sn.p.z, color: COLOR }));
      if (s === 4) return [{ x: home.x, z: home.z, color: COLOR }];
      return [];
    },
    // bonk near a stone wakes it
    onBonk(p) {
      if (stage() !== 3) return;
      for (const s of stones) {
        if (st.stones.includes(s.i) || Math.hypot(p.x - s.p.x, p.z - s.p.z) > 2.6) continue;
        st.stones.push(s.i);
        save();
        paintStones();
        sfx.boom();
        sfx.ding();
        hud.popup(`SUMMONING STONE ${st.stones.length}/3 AWAKE`, COLOR);
        ch.progress('clicky3');
        if (st.stones.length >= 3) setTimeout(() => hud.banner('THE STONES ARE AWAKE', 'Go back to Clicky in Winter\'s Castle.'), 1200);
      }
    },
    panel(online) {
      const root = document.createElement('div');
      root.className = 'casino clicky';
      const add = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        root.appendChild(e);
        return e;
      };
      const s = stage();
      const steps = [
        ['☕', "Bring Clicky a coffee mug from the Glorp Café (carry it with LICK)", ch.isDone('clicky1')],
        ['📜', `Find his 4 lost spell pages (${st.pages.length}/4)`, ch.isDone('clicky2')],
        ['🗿', `Bonk the 3 summoning stones awake (${st.stones.length}/3)`, ch.isDone('clicky3')],
        ['👹', 'Let Clicky hand in his notice', ch.isDone('kaiju')],
      ];
      const ul = add('ul', 'clicky-steps');
      steps.forEach(([icon, text, done], i) => {
        const li = document.createElement('li');
        li.textContent = `${done ? '✅' : i + 1 === s ? '👉' : '⬜'} ${icon} ${text}`;
        if (done) li.className = 'done';
        ul.appendChild(li);
      });
      const quote = add('p', 'slot-result', `"${(LINES[s] || LINES.done)[0]}"`);
      quote.style.color = COLOR;
      if (s === 4 || s === 'done') {
        const b = add('button', 'btn primary spin', s === 4 ? '👹 HAND IN MY NOTICE (SUMMON THE KAIJU)' : '👹 QUIT AGAIN (SUMMON THE KAIJU)');
        b.type = 'button';
        const msg = add('p', 'fine', online ? 'Everyone online gets flung into the air for this one.' : 'Hold on to something. Actually, you will not be able to.');
        b.addEventListener('click', () => {
          const err = onSummon();
          if (err) {
            msg.textContent = err;
            msg.style.color = '#ff4f6d';
            return;
          }
          snap(30);
        });
      }
      add('p', 'fine', 'Clicky has worked for Ms Winter since 1726. Benefits: none. Dental: frozen.');
      return root;
    },
    update(dt, t, { props, mine, reset, online }) {
      const p = claw.position();
      const d = Math.hypot(p.x - home.x, p.z - home.z);
      const want = d < 10 ? Math.atan2(p.x - home.x, p.z - home.z) : Math.PI;
      let diff = want - root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      root.rotation.y += diff * Math.min(1, dt * 4);
      c.orbMat.color.setHSL(0.74, 0.9, 0.7 + Math.sin(t * 4) * 0.12).multiplyScalar(1.5);
      marker.visible = stage() !== 'done';
      marker.position.set(home.x, home.y + 3.3 + Math.sin(t * 3) * 0.1, home.z);
      const s = stage();
      if (s === 1) checkMug(props, { mine, reset, online });
      // pages
      for (const pg of pages) {
        const want = s === 2 && !st.pages.includes(pg.i);
        pg.s.visible = want;
        if (!want) continue;
        pg.s.position.y = pg.p.y + Math.sin(t * 2 + pg.i) * 0.15;
        pg.s.material.rotation = Math.sin(t * 1.5 + pg.i) * 0.25;
        if (pg.s.position.distanceTo(p) < 1.3 * claw.st.scaleK + 0.3) {
          st.pages.push(pg.i);
          save();
          sfx.ding();
          hud.popup(`SPELL PAGE ${st.pages.length}/4`, COLOR);
          ch.progress('clicky2');
        }
      }
      // stones hum when it's their turn
      for (const sn of stones) if (!st.stones.includes(sn.i)) sn.glow.intensity = s === 3 ? 1.5 + Math.sin(t * 3 + sn.i) * 1.2 : 0;
      // a new stage: happy wizard
      if (s !== lastStage) {
        lastStage = s;
        talk.cd = 1.5;
        play('emote-yes', 0.1);
      }
      // grumbling
      talk.cd -= dt;
      if (d < 4.5 && talk.cd <= 0) {
        talk.cd = 22;
        const pool = LINES[s] || LINES.done;
        say(pool[talk.line++ % pool.length]);
      }
      // the habit that gave him his name
      talk.snapT -= dt;
      if (talk.snapT <= 0 && current === 'idle') {
        talk.snapT = 7 + Math.random() * 7;
        if (d < 14) snap(8);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life -= dt;
        sp.v.y -= 6 * dt;
        sp.m.position.addScaledVector(sp.v, dt);
        sp.m.rotation.y += dt * 8;
        sp.m.scale.setScalar(Math.max(0.01, sp.life / 0.8));
        if (sp.life <= 0) {
          scene.remove(sp.m);
          sparks.splice(i, 1);
        }
      }
      mixer.update(dt);
    },
    dispose() {
      scene.remove(root, marker);
      for (const pg of pages) scene.remove(pg.s);
      for (const s of stones) scene.remove(s.g);
      for (const sp of sparks) scene.remove(sp.m);
      mixer.stopAllAction();
    },
  };
}
