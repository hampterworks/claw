// Ducky: Winty's little brother and Romni's oldest business associate. Big sis got the castle, he
// got "the duck genes", and she once put him on the castle menu as duck à l'orange (she says it was
// a joke). Outrun Winty 3 times and he waddles into Ohio. His quest is a sibling prank on his
// sister: knock her castle sign crooked, egg her throne, steal her crown. Finish it and
// you unlock Ducky Mode: Ducky follows you as a bodyguard, Winty runs from you, and Romni stops
// asking about your loan (they go way back).
// The duck is built entirely in code, no model file.
import * as THREE from 'three';
import { markerTexture } from './textures.js';
import { read, write } from '../../scores.js';

const NAME = 'DUCKY';
const COLOR = '#ffd23f';
export const ESCAPES_NEEDED = 3;

const LINES = {
  1: [
    'You outran my sister THREE times? Winty. Yes, my big sister. Somebody got the castle, somebody got the duck genes.',
    'First, a message. Bonk the WINTER\'S CASTLE sign by her gate. Make it crooked. Make it personal.',
    'She put me on her castle menu once. Duck à l\'orange. "It was a JOKE, Ducky." It was laminated.',
    'Romni and I go way back. Way, WAY back. Do not ask about 2019.',
  ],
  2: [
    'Crooked. Beautiful. I could cry, but ducks are waterproof.',
    'I slipped 3 eggs in your fur. They are not MY eggs. I bought them. Do not ask.',
    'Throw them at her throne. All three. Then come back for the grand finale.',
  ],
  3: [
    'Throne: egged. Morale: excellent. Now the big one.',
    'Steal her crown off the throne and bring it to me. Mom said we had to SHARE it. She never shared it.',
    'She will chase you. Run like Romni is collecting.',
    'Zoomies, kid. Use the zoomies.',
  ],
  done: [
    'The crown fits. I always knew it would.',
    'My sister sees me and runs. Some things never change since we were ducklings. Well. Since I was.',
    'Thanksgiving is going to be SO awkward this year. Worth it.',
    'Romni says your loan is "spiritually paid". That is how we do business.',
    'Quack. That is it. That is the line.',
  ],
};
const SCARE = ['QUACK', 'QUACK QUACK', '*aggressive quacking*', 'QUAAACK'];

// ---------- the model ----------
export function buildDucky({ crown = false } = {}) {
  const root = new THREE.Group();
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...o });
  const yellow = mat('#ffd23f', { emissive: '#3d2c00' });
  const orange = mat('#ff8c1a');
  const black = mat('#141418', { roughness: 0.25, metalness: 0.3 });
  const gold = mat('#ffcc33', { metalness: 0.85, roughness: 0.3 });
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  // the waddle pivots around the feet
  const body = new THREE.Group();
  root.add(body);
  add(body, new THREE.IcosahedronGeometry(0.5, 1), yellow, 0, 0.55, 0).scale.set(1, 0.82, 1.25);
  add(body, new THREE.ConeGeometry(0.22, 0.4, 6), yellow, 0, 0.75, -0.62, -2.2);
  // wings
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(s * 0.46, 0.68, 0);
    add(w, new THREE.IcosahedronGeometry(0.26, 1), mat('#f5c22a'), s * 0.04, -0.06, -0.08).scale.set(0.35, 0.8, 1.4);
    body.add(w);
    return w;
  });
  // head
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0.36);
  body.add(head);
  add(head, new THREE.IcosahedronGeometry(0.32, 1), yellow, 0, 0, 0);
  add(head, new THREE.BoxGeometry(0.36, 0.09, 0.34), orange, 0, -0.06, 0.36).scale.set(1, 1, 1);
  add(head, new THREE.BoxGeometry(0.3, 0.06, 0.26), orange, 0, -0.13, 0.31);
  // business shades
  for (const s of [-1, 1]) add(head, new THREE.BoxGeometry(0.16, 0.1, 0.04), black, s * 0.11, 0.08, 0.29);
  add(head, new THREE.BoxGeometry(0.08, 0.025, 0.03), black, 0, 0.1, 0.3);
  for (const s of [-1, 1]) add(head, new THREE.BoxGeometry(0.02, 0.025, 0.24), black, s * 0.2, 0.09, 0.17);
  // gold chain with a $ coin
  add(body, new THREE.TorusGeometry(0.27, 0.028, 6, 18), gold, 0, 0.88, 0.2, Math.PI / 2 - 0.5);
  add(body, new THREE.CylinderGeometry(0.08, 0.08, 0.025, 12), gold, 0, 0.74, 0.47, Math.PI / 2 - 0.3);
  // legs + feet
  const feet = [-1, 1].map((s) => {
    const f = new THREE.Group();
    f.position.set(s * 0.18, 0, 0.05);
    add(f, new THREE.CylinderGeometry(0.035, 0.035, 0.2, 5), orange, 0, 0.12, 0);
    add(f, new THREE.BoxGeometry(0.2, 0.04, 0.26), orange, 0, 0.02, 0.08);
    root.add(f);
    return f;
  });
  const crownG = new THREE.Group();
  crownG.position.set(0, 0.3, -0.02);
  add(crownG, new THREE.CylinderGeometry(0.17, 0.19, 0.12, 10, 1, true), gold, 0, 0, 0).material.side = THREE.DoubleSide;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(crownG, new THREE.ConeGeometry(0.045, 0.12, 4), gold, Math.sin(a) * 0.16, 0.11, Math.cos(a) * 0.16);
  }
  add(crownG, new THREE.OctahedronGeometry(0.04, 0), mat('#5ff2ff', { metalness: 0.3, roughness: 0.1 }), 0, 0.02, 0.18);
  crownG.visible = crown;
  head.add(crownG);

  return {
    root,
    head,
    set crown(v) {
      crownG.visible = v;
    },
    // walk: 0 still .. 1 full waddle; flap: wings up
    animate(t, walk, flap = 0) {
      body.rotation.z = Math.sin(t * 11) * 0.14 * walk;
      body.position.y = Math.abs(Math.sin(t * 11)) * 0.06 * walk + Math.sin(t * 2) * 0.012;
      feet[0].rotation.x = Math.sin(t * 11) * 0.6 * walk;
      feet[1].rotation.x = -Math.sin(t * 11) * 0.6 * walk;
      const fl = flap > 0 ? Math.abs(Math.sin(t * 22)) * 1.1 * flap : 0;
      wings[0].rotation.z = -fl;
      wings[1].rotation.z = fl;
      head.rotation.x = Math.sin(t * 1.7) * 0.05 + (flap > 0 ? -0.25 * flap : 0);
    },
  };
}

// ---------- the bodyguard (yours, and other players') ----------
export function createDuckyFollower({ scene, world, RAPIER, target, crown = true }) {
  const d = buildDucky({ crown });
  d.root.scale.setScalar(0.55);
  scene.add(d.root);
  const pos = d.root.position;
  const p0 = target.position();
  pos.set(p0.x - 1.5, p0.y, p0.z - 1.5);
  const fwd = new THREE.Vector3();
  const want = new THREE.Vector3();
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  let yaw = 0;
  let groundY = p0.y;
  let flapT = 0;
  return {
    root: d.root,
    get visible() {
      return d.root.visible;
    },
    set visible(v) {
      d.root.visible = v;
    },
    quack() {
      flapT = 0.6;
    },
    update(dt, t) {
      const p = target.position();
      target.forward(fwd);
      // behind and to the left (pets trail to the right)
      want.set(p.x - fwd.x * 1.7 - fwd.z * 0.9, 0, p.z - fwd.z * 1.7 + fwd.x * 0.9);
      const dx = want.x - pos.x;
      const dz = want.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 18) pos.set(want.x, p.y, want.z);
      else if (dist > 0.25) {
        const sp = Math.min(dist * 3, 13);
        pos.x += (dx / dist) * sp * dt;
        pos.z += (dz / dist) * sp * dt;
        let diff = Math.atan2(dx, dz) - yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        yaw += diff * Math.min(1, dt * 8);
      }
      ray.origin = { x: pos.x, y: Math.max(p.y, pos.y) + 1.5, z: pos.z };
      const hit = world.castRay(ray, 40, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, target.body);
      const gy = hit ? ray.origin.y - hit.timeOfImpact : 0;
      groundY += (gy - groundY) * Math.min(1, dt * 12);
      pos.y = groundY;
      d.root.rotation.y = yaw;
      flapT = Math.max(0, flapT - dt);
      d.animate(t, Math.min(1, dist / 0.8), flapT > 0 ? 1 : 0);
    },
    dispose() {
      scene.remove(d.root);
    },
  };
}

// ---------- Ducky the NPC + his quest ----------
// spots: hangouts he might pick when he shows up. castle: districts' castle info (gateSign, crown, throne).
export function createDucky({ scene, world, RAPIER, hud, sfx, ch, claw, castle, spots, winty, loans, onMode }) {
  const st = read('simducky', { escapes: 0, spot: -1, met: false, on: false });
  const save = () => write('simducky', st);
  const here = () => st.escapes >= ESCAPES_NEEDED;
  const stage = () => (!here() ? 0 : !ch.isDone('ducky1') ? 1 : !ch.isDone('ducky2') ? 2 : !ch.isDone('ducky3') ? 3 : 'done');
  if (here() && (st.spot < 0 || st.spot >= spots.length)) st.spot = 0;

  const npc = buildDucky({ crown: stage() === 'done' });
  npc.root.scale.setScalar(1.15);
  npc.root.visible = here();
  scene.add(npc.root);
  let home = null;
  let body = null;
  function place() {
    home = spots[st.spot];
    npc.root.position.set(home.x, home.y || 0, home.z);
    npc.root.rotation.y = home.ry || 0;
    if (body) world.removeRigidBody(body);
    body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(home.x, (home.y || 0) + 0.6, home.z));
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.6, 0.55), body);
  }
  if (here()) place();
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('!') }));
  marker.scale.set(0.55, 0.55, 1);
  marker.visible = false;
  scene.add(marker);

  // ---- the prank props: crooked sign, egg splats, the crown ----
  const sign = castle.gateSign;
  const signRest = sign ? { y: sign.position.y, rz: sign.rotation.z } : null;
  let signSwing = 0;
  function paintSign(swing = 0) {
    if (!sign) return;
    const crooked = ch.isDone('ducky1');
    sign.rotation.z = signRest.rz + (crooked ? 0.32 : 0) + Math.sin(swing * 14) * swing * 0.5;
    sign.position.y = signRest.y - (crooked ? 0.25 : 0);
  }
  paintSign();

  const T = castle.throne;
  const splatTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,240,0.95)';
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 40 + (i % 2 ? 14 : 0) + Math.sin(i * 3.1) * 6;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.fill();
    g.fillStyle = '#ffb21f';
    g.beginPath();
    g.arc(60, 62, 20, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const splatMat = new THREE.MeshStandardMaterial({ map: splatTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.3 });
  // on the backrest (front face), the seat (top), and the backrest again
  const splats = [
    [T.x - 0.3, 1.7, T.z - 0.39, 0, 0.8],
    [T.x + 0.25, 0.715, T.z + 0.05, -Math.PI / 2, 0.75],
    [T.x + 0.35, 2.2, T.z - 0.39, 0.4, 0.6],
  ].map(([x, y, z, r, s]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), splatMat);
    m.position.set(x, y, z);
    if (Math.abs(r) > 1) m.rotation.x = r;
    else m.rotation.z = r;
    m.visible = false;
    scene.add(m);
    return m;
  });
  const eggsThrown = () => (ch.isDone('ducky2') ? 3 : ch.state.progress.ducky2 || 0);
  const paintSplats = () => splats.forEach((m, i) => (m.visible = i < eggsThrown()));
  paintSplats();
  const flying = []; // eggs in the air
  const eggGeo = new THREE.SphereGeometry(0.11, 10, 8);
  eggGeo.scale(1, 1.3, 1);
  const eggMat = new THREE.MeshStandardMaterial({ color: '#fbf6ea', roughness: 0.5 });

  const crown = castle.crown;
  const carried = crown ? crown.clone() : null;
  if (carried) {
    carried.scale.setScalar(0.55);
    carried.visible = false;
    scene.add(carried);
  }
  let carrying = false;
  const paintCrown = () => {
    if (crown) crown.visible = !carrying && !ch.isDone('ducky3');
    if (carried) carried.visible = carrying;
    npc.crown = stage() === 'done';
  };
  paintCrown();

  // ---- the bodyguard ----
  let guard = null;
  function setMode(on) {
    on = !!on && stage() === 'done';
    st.on = on;
    save();
    if (on && !guard) guard = createDuckyFollower({ scene, world, RAPIER, target: claw });
    if (!on && guard) {
      guard.dispose();
      guard = null;
    }
    winty?.setScared(on);
    loans?.setFrozen(on);
    onMode?.(on);
  }
  setMode(st.on);

  const say = (text, ms = 5200) => hud.say(NAME, text, { color: COLOR, ms });
  const talk = { cd: 2, line: 0, quackCd: 0, flap: 0 };
  let lastStage = stage();

  function finishQuest() {
    carrying = false;
    winty?.stopChase();
    ch.complete('ducky3');
    paintCrown();
    sfx.win();
    sfx.quack();
    talk.flap = 1.5;
    say('THE CROWN. Oh it fits. My sister is going to be SO mad. Here: you are family now. Unlike some people.', 6500);
    setTimeout(() => hud.banner('🦆 DUCKY MODE UNLOCKED', 'Ducky is your bodyguard. His big sister runs from you. Romni says no rush on that loan.', { pog: true }), 2500);
    setMode(true);
  }
  function dropCrown() {
    if (!carrying) return;
    carrying = false;
    paintCrown();
    hud.banner('WINTY TOOK HER CROWN BACK', 'It is back on her throne. Steal it again, and use your zoomies this time.');
    sfx.fail();
  }

  const api = {
    get here() {
      return here();
    },
    get stage() {
      return stage();
    },
    get mode() {
      return st.on;
    },
    get escapes() {
      return st.escapes;
    },
    get carrying() {
      return carrying;
    },
    get pos() {
      return npc.root.position;
    },
    setMode,
    // Winty's pitch got outrun
    escaped() {
      if (here()) return;
      st.escapes++;
      if (st.escapes >= ESCAPES_NEEDED) {
        st.spot = Math.floor(Math.random() * spots.length);
        place();
        npc.root.visible = true;
        sfx.quack();
        setTimeout(() => hud.banner('🦆 A DUCK HAS ENTERED OHIO', 'Winty\'s little brother is impressed by how much you run from her. Find the yellow dot on the map.'), 2600);
      } else hud.popup(`ESCAPED WINTY ${st.escapes}/${ESCAPES_NEEDED}`, COLOR);
      save();
    },
    // bonk the castle sign (step 1)
    onBonk(p) {
      if (stage() !== 1 || !st.met || !sign) return;
      const sp = sign.position;
      if (Math.hypot(p.x - sp.x, p.z - sp.z) > 4) return;
      ch.complete('ducky1');
      signSwing = 1;
      sfx.boom();
      sfx.quack();
      hud.popup('THE SIGN IS CROOKED NOW', COLOR);
      setTimeout(() => say('*distant proud quacking* Now egg her throne. The eggs are already in your fur. Do not ask how.'), 1400);
    },
    // which interaction Claw is standing at
    machine(p) {
      if (here() && Math.hypot(p.x - home.x, p.z - home.z) < 2.4 && Math.abs(p.y - (home.y || 0)) < 2.5) return 'ducky';
      const s = stage();
      if ((s === 2 || (s === 3 && !carrying)) && st.met && Math.hypot(p.x - T.x, p.z - T.z) < 2.6 && p.y < 2.5) return 'throne';
      return null;
    },
    thronePrompt() {
      return stage() === 2 ? `🥚 THROW AN EGG AT THE THRONE · ${Math.max(0, 3 - eggsThrown() - flying.length)} LEFT` : '👑 STEAL THE CROWN';
    },
    throneAction() {
      const s = stage();
      if (s === 2) {
        if (eggsThrown() + flying.length >= 3) return; // all in the air already
        const from = claw.headPos(new THREE.Vector3());
        const idx = eggsThrown() + flying.length;
        const to = splats[idx].position.clone();
        const m = new THREE.Mesh(eggGeo, eggMat);
        m.position.copy(from);
        scene.add(m);
        flying.push({ m, from, to, t: 0, idx });
        claw.lungeNow();
        sfx.flap?.();
      } else if (s === 3 && !carrying) {
        carrying = true;
        paintCrown();
        sfx.ding();
        hud.banner('👑 YOU STOLE THE CROWN', 'Winty is coming. Get it to Ducky (yellow dot). Zoomies help.');
        winty?.chaseCrown(claw, dropCrown);
      }
    },
    // for the quest log: [text, done, current]
    steps() {
      const s = stage();
      if (!here()) return [[`Outrun Winty's sales pitch in the park (${st.escapes}/${ESCAPES_NEEDED})`, false, true]];
      return [
        [`Outrun Winty's sales pitch in the park (${ESCAPES_NEEDED}/${ESCAPES_NEEDED})`, true, false],
        ['Talk to Ducky (yellow dot on the map)', st.met, !st.met],
        ["Bonk the WINTER'S CASTLE sign by her gate", ch.isDone('ducky1'), st.met && s === 1],
        [`Egg Winter's throne (${eggsThrown()}/3)`, ch.isDone('ducky2'), s === 2],
        ["Steal Winter's crown and bring it to Ducky (she will chase you)", ch.isDone('ducky3'), s === 3],
      ];
    },
    pois() {
      if (!here()) return [];
      const s = stage();
      if (!st.met || s === 'done' || carrying) return s === 'done' ? [] : [{ x: home.x, z: home.z, color: COLOR }];
      if (s === 1 && sign) return [{ x: sign.position.x, z: sign.position.z, color: COLOR }];
      if (s === 2 || s === 3) return [{ x: T.x, z: T.z, color: COLOR }];
      return [];
    },
    panel() {
      if (!st.met) {
        st.met = true;
        save();
      }
      if (carrying) finishQuest();
      const root = document.createElement('div');
      root.className = 'casino clicky ducky';
      const add = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        root.appendChild(e);
        return e;
      };
      const s = stage();
      const ul = add('ul', 'clicky-steps');
      const rows = [
        ['🪧', "Bonk the WINTER'S CASTLE sign by her gate", ch.isDone('ducky1')],
        ['🥚', `Egg her throne (${eggsThrown()}/3)`, ch.isDone('ducky2')],
        ['👑', 'Steal her crown and bring it to me', ch.isDone('ducky3')],
      ];
      rows.forEach(([icon, text, done], i) => {
        const li = document.createElement('li');
        li.textContent = `${done ? '✅' : i + 1 === s ? '👉' : '⬜'} ${icon} ${text}`;
        if (done) li.className = 'done';
        ul.appendChild(li);
      });
      const quote = add('p', 'slot-result', `"${(LINES[s] || LINES.done)[s === 'done' ? Math.floor(Math.random() * LINES.done.length) : 1]}"`);
      quote.style.color = COLOR;
      if (s === 'done') {
        const b = add('button', `btn ${st.on ? '' : 'primary'} spin`, st.on ? '🦆 DUCKY MODE: ON (turn off)' : '🦆 DUCKY MODE: OFF (turn on)');
        b.type = 'button';
        b.addEventListener('click', () => {
          setMode(!st.on);
          sfx.quack();
          b.textContent = st.on ? '🦆 DUCKY MODE: ON (turn off)' : '🦆 DUCKY MODE: OFF (turn on)';
          b.classList.toggle('primary', !st.on);
        });
        add('p', 'fine', 'Ducky Mode: Ducky follows you as your bodyguard, Winty runs away from you, and your Romni loan never comes due.');
      }
      add('p', 'fine', 'Ducky is Winty\'s little brother. He has also known Romni since before banks were invented, and will not say how long that is.');
      sfx.quack();
      talk.flap = 1;
      return root;
    },
    update(dt, t) {
      const p = claw.position();
      const s = stage();
      if (s !== lastStage) {
        lastStage = s;
        paintCrown();
        paintSplats();
      }
      // Ducky himself
      if (here()) {
        const d = Math.hypot(p.x - home.x, p.z - home.z);
        const want = d < 9 ? Math.atan2(p.x - home.x, p.z - home.z) : home.ry || 0;
        let diff = want - npc.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        npc.root.rotation.y += diff * Math.min(1, dt * 4);
        talk.flap = Math.max(0, talk.flap - dt);
        npc.animate(t, 0, talk.flap > 0 ? 1 : 0);
        marker.visible = s !== 'done' && (!st.met || carrying);
        marker.position.set(home.x, (home.y || 0) + 2.3 + Math.sin(t * 3) * 0.1, home.z);
        talk.cd -= dt;
        if (d < 4.5 && talk.cd <= 0) {
          talk.cd = 20;
          const pool = LINES[s] || LINES.done;
          say(pool[talk.line++ % pool.length]);
          talk.flap = 0.8;
        }
        // delivered the crown just by walking up to him
        if (carrying && d < 2.6) finishQuest();
      }
      // the sign's swing settles
      if (signSwing > 0) {
        signSwing = Math.max(0, signSwing - dt * 0.8);
        paintSign(signSwing);
      }
      // eggs in flight
      for (let i = flying.length - 1; i >= 0; i--) {
        const e = flying[i];
        e.t = Math.min(1, e.t + dt * 1.8);
        e.m.position.lerpVectors(e.from, e.to, e.t);
        e.m.position.y += Math.sin(e.t * Math.PI) * 1.4;
        e.m.rotation.x += dt * 12;
        if (e.t >= 1) {
          scene.remove(e.m);
          flying.splice(i, 1);
          sfx.pop?.();
          ch.progress('ducky2');
          paintSplats();
          hud.popup(eggsThrown() >= 3 ? 'THRONE: FULLY EGGED' : `SPLAT ${eggsThrown()}/3`, COLOR);
          if (eggsThrown() >= 3) setTimeout(() => say('*quacks in admiration* Now grab her crown off the throne. Then RUN to me.'), 1200);
        }
      }
      // the stolen crown rides on Claw's head
      if (carrying && carried) {
        claw.headPos(carried.position);
        carried.position.y += 0.32 * claw.st.scaleK;
        carried.rotation.y += dt * 2;
      }
      // the bodyguard
      if (guard) {
        guard.update(dt, t);
        talk.quackCd -= dt;
        const w = winty?.sprite.position;
        if (w && talk.quackCd <= 0 && Math.hypot(w.x - p.x, w.z - p.z) < 10) {
          talk.quackCd = 3.5;
          guard.quack();
          sfx.quack();
          hud.popup(SCARE[Math.floor(Math.random() * SCARE.length)], COLOR);
        }
      }
    },
    dispose() {
      scene.remove(npc.root, marker);
      for (const m of splats) scene.remove(m);
      for (const e of flying) scene.remove(e.m);
      if (carried) scene.remove(carried);
      guard?.dispose();
    },
  };
  return api;
}
