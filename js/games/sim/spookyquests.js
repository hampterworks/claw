// Spooky Claw-lenges (October): their own list, so the 41 Claw-lenges and the 100% speedrun don't change.
// Trick-or-treat at the jack-o'-lantern porches, smash jack-o'-lanterns, find the graveyard ghost at night,
// survive Zombie Tag, and claim the Pumpkin King's crown on top of the Cat Tree. Each one pays coins, and
// most give a Halloween skin or pet. Progress is saved, so it carries over to next October.
// Also: the Gravekeeper at the graveyard, who sells Spooky Crates.
import * as THREE from 'three';
import { read, write } from '../../scores.js';
import { markerTexture } from './textures.js';

export const SPOOKY_CHALLENGES = [
  { id: 'spook_trick', name: 'Trick-or-treat at all 6 jack-o\'-lantern porches', goal: 6, coins: 150, skin: 'candycorn' },
  { id: 'spook_smash', name: 'Smash 10 jack-o\'-lanterns (BONK them)', goal: 10, coins: 150, skin: 'pumpkin' },
  { id: 'spook_ghost', name: 'Find the ghost haunting the graveyard (only at night)', coins: 200, pet: 'ghost' },
  { id: 'spook_zombie', name: 'Survive Zombie Tag (online, or the solo horde)', coins: 200, skin: 'zombie' },
  { id: 'spook_crown', name: "Claim the Pumpkin King's crown on top of the Cat Tree", coins: 250, skin: 'jackoclaw' },
];
const COLOR = '#ff8a1f';

export function createSpookyQuests({ scene, wallet, hud, sfx, claw, env, gltf, porches, jacks, graveyard, crownAt, onFx }) {
  const st = read('simspooky', { done: {}, progress: {}, porches: [], smashed: [] });
  st.porches ||= [];
  st.smashed ||= [];
  const save = () => write('simspooky', st);
  const done = (id) => !!st.done[id];

  function complete(id) {
    if (done(id)) return;
    const c = SPOOKY_CHALLENGES.find((x) => x.id === id);
    st.done[id] = true;
    save();
    wallet.add(c.coins);
    let prize = `+${c.coins} 🪙`;
    if (c.skin && wallet.own(c.skin)) prize += ' · new skin in Skins & Pets';
    if (c.pet && wallet.ownPet(c.pet)) prize += ' · new pet in Skins & Pets';
    sfx.win();
    hud.banner('🎃 SPOOKY CLAW-LENGE', `${c.name} · ${prize}`, { pog: true });
    onFx?.(`finished a Spooky Claw-lenge 🎃`);
  }
  function progress(id, n) {
    const c = SPOOKY_CHALLENGES.find((x) => x.id === id);
    st.progress[id] = n;
    save();
    if (n >= c.goal) complete(id);
  }

  // ---------- bits of scenery the quests need ----------
  const clone = (name) => {
    const n = gltf.scene.getObjectByName(name);
    return n ? n.clone(true) : new THREE.Group();
  };
  // the graveyard ghost (only out at night), with its idle float animation
  const ghost = clone('h_character_ghost');
  ghost.scale.setScalar(1.6);
  const ghostAt = new THREE.Vector3(graveyard.x - 2.5, 0, graveyard.z + 4.6);
  ghost.position.copy(ghostAt);
  ghost.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.opacity = 0.75;
    o.material.emissive = new THREE.Color('#9fd4ff');
    o.material.emissiveIntensity = 0.35;
  });
  scene.add(ghost);
  const ghostMixer = new THREE.AnimationMixer(ghost);
  const idle = gltf.animations.find((a) => a.name === 'h_character_ghost|idle');
  if (idle) ghostMixer.clipAction(idle).play();

  // the Pumpkin King's crown: a little jack-o'-lantern wearing a gold crown, spinning over the Cat Tree
  const crown = new THREE.Group();
  const pumpkin = clone('h_pumpkin_carved');
  pumpkin.scale.setScalar(1.6);
  crown.add(pumpkin);
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.8, roughness: 0.3, emissive: '#7a4a00', emissiveIntensity: 0.4 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 10, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  band.position.y = 0.56;
  crown.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), gold);
    spike.position.set(Math.sin(a) * 0.19, 0.67, Math.cos(a) * 0.19);
    crown.add(spike);
  }
  crown.position.copy(crownAt);
  crown.visible = !done('spook_crown');
  scene.add(crown);

  // the Gravekeeper sells Spooky Crates by the gate
  const keeper = clone('h_character_keeper');
  keeper.scale.setScalar(2.2);
  const keeperAt = new THREE.Vector3(graveyard.x + 8.4, 0, graveyard.z - 4.6);
  keeper.position.copy(keeperAt);
  keeper.rotation.y = Math.PI / 2;
  scene.add(keeper);
  const keeperMixer = new THREE.AnimationMixer(keeper);
  const kIdle = gltf.animations.find((a) => a.name === 'h_character_keeper|idle');
  if (kIdle) keeperMixer.clipAction(kIdle).play();
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('🎃') }));
  marker.scale.set(0.55, 0.55, 1);
  marker.position.set(keeperAt.x, 2.6, keeperAt.z);
  scene.add(marker);

  // smash bursts
  const bitGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const bitMat = new THREE.MeshStandardMaterial({ color: '#ff8a1f', emissive: '#7a2a00', emissiveIntensity: 0.6 });
  const bits = [];
  function burst(at) {
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(bitGeo, bitMat);
      m.position.set(at.x, 0.5, at.z);
      scene.add(m);
      bits.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5), life: 0.9 });
    }
  }

  let booCd = 0;
  return {
    keeperAt,
    get state() {
      return st;
    },
    isDone: done,
    // bonking near a jack-o'-lantern smashes it (it grows back by tomorrow; only the count matters)
    onBonk(p) {
      if (done('spook_smash')) return;
      jacks.forEach((j, i) => {
        if (st.smashed.includes(i) || Math.hypot(p.x - j.x, p.z - j.z) > 1.7 || p.y > 2.5) return;
        st.smashed.push(i);
        burst(j);
        sfx.pop();
        sfx.splash?.();
        hud.popup(`SPLAT! ${st.smashed.length}/10`, COLOR);
        progress('spook_smash', st.smashed.length);
      });
    },
    // Zombie Tag reports a win (survived, horde, solo)
    onZombie() {
      complete('spook_zombie');
    },
    steps() {
      return SPOOKY_CHALLENGES.map((c) => {
        const n = c.goal && !done(c.id) ? ` (${st.progress[c.id] || 0}/${c.goal})` : '';
        return [`${c.name}${n}`, done(c.id), false];
      });
    },
    pois() {
      const out = [];
      if (!done('spook_trick')) porches.forEach(([x, z], i) => !st.porches.includes(i) && out.push({ x, z, color: COLOR }));
      if (!done('spook_ghost') && env.isNight) out.push({ x: ghostAt.x, z: ghostAt.z, color: '#9fd4ff' });
      return out;
    },
    update(dt, t) {
      const p = claw.position();
      // trick-or-treat: walk up to a porch
      if (!done('spook_trick')) {
        porches.forEach(([x, z], i) => {
          if (st.porches.includes(i) || Math.hypot(p.x - x, p.z - z) > 2.6 || p.y > 2.5) return;
          st.porches.push(i);
          wallet.add(15);
          sfx.ding();
          hud.popup(`TRICK OR TREAT! 🍬 +15 🪙 (${st.porches.length}/6)`, COLOR);
          progress('spook_trick', st.porches.length);
        });
      }
      // the ghost: out at night, bobbing over the graves, BOO when you get close
      const night = env.isNight;
      ghost.visible = night && !done('spook_ghost');
      if (ghost.visible) {
        ghost.position.y = 0.4 + Math.sin(t * 1.5) * 0.25;
        ghost.rotation.y = Math.atan2(p.x - ghostAt.x, p.z - ghostAt.z);
        ghostMixer.update(dt);
        booCd -= dt;
        const d = Math.hypot(p.x - ghostAt.x, p.z - ghostAt.z);
        if (d < 2.2) complete('spook_ghost');
        else if (d < 9 && booCd <= 0) {
          booCd = 5;
          hud.say('GHOST', 'booooo… (come closer… I just want a friend)', { color: '#9fd4ff', ms: 3500 });
        }
      }
      // the crown spins until someone grabs it
      if (crown.visible) {
        crown.rotation.y += dt * 1.5;
        crown.position.y = crownAt.y + Math.sin(t * 2) * 0.12;
        if (Math.hypot(p.x - crown.position.x, p.y - crown.position.y, p.z - crown.position.z) < 1.4) {
          crown.visible = false;
          complete('spook_crown');
        }
      }
      keeper.rotation.y = Math.atan2(p.x - keeperAt.x, p.z - keeperAt.z);
      keeperMixer.update(dt);
      marker.position.y = 2.6 + Math.sin(t * 3) * 0.1;
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.life -= dt;
        b.v.y -= 9 * dt;
        b.m.position.addScaledVector(b.v, dt);
        if (b.life <= 0) {
          scene.remove(b.m);
          bits.splice(i, 1);
        }
      }
    },
    dispose() {
      scene.remove(ghost, crown, keeper, marker);
      for (const b of bits) scene.remove(b.m);
      ghostMixer.stopAllAction();
      keeperMixer.stopAllAction();
    },
  };
}
