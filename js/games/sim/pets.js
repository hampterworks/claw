// Pets: Kenney Cube Pets that follow Claw around. Won from Pet Crates, the Wheel of
// Glorp and Pet Derby. Each pet boosts the coins Claw earns from points.
import * as THREE from 'three';

// Order matches the icon atlas (assets/sim-pets.png, 64px per pet, alphabetical).
const ATLAS = ['beaver', 'bee', 'bunny', 'cat', 'caterpillar', 'chick', 'cow', 'crab', 'deer', 'dog', 'elephant', 'fish',
  'fox', 'giraffe', 'hog', 'koala', 'lion', 'monkey', 'panda', 'parrot', 'penguin', 'pig', 'polar', 'tiger'];

export const PET_BONUS = { common: 0.05, rare: 0.1, epic: 0.2, legendary: 0.35 };

export const PETS = [
  { id: 'chick', name: 'Chicken Nugget', rarity: 'common' },
  { id: 'pig', name: 'Bacon Bits', rarity: 'common' },
  { id: 'cow', name: 'Moo Glorp', rarity: 'common' },
  { id: 'bunny', name: 'Big Chungus Jr', rarity: 'common' },
  { id: 'beaver', name: 'Dam Beaver', rarity: 'common' },
  { id: 'hog', name: 'Hog Rider', rarity: 'common' },
  { id: 'caterpillar', name: 'Very Hungry Caterpillar', rarity: 'common' },
  { id: 'deer', name: 'Oh Deer', rarity: 'common' },
  { id: 'dog', name: 'Doge', rarity: 'rare' },
  { id: 'crab', name: 'Crab Rave', rarity: 'rare' },
  { id: 'fish', name: 'Fish Out of Water', rarity: 'rare' },
  { id: 'bee', name: 'Bee Movie', rarity: 'rare' },
  { id: 'penguin', name: 'Noot Noot', rarity: 'rare' },
  { id: 'koala', name: 'Sleepy Koala', rarity: 'rare' },
  { id: 'parrot', name: 'Party Parrot', rarity: 'rare' },
  { id: 'fox', name: 'What Does the Fox Say', rarity: 'rare' },
  { id: 'monkey', name: 'Monke', rarity: 'epic' },
  { id: 'panda', name: 'Kung Fu Panda', rarity: 'epic' },
  { id: 'elephant', name: 'Elephant in the Room', rarity: 'epic' },
  { id: 'giraffe', name: 'Long Neck Larry', rarity: 'epic' },
  { id: 'polar', name: 'Polar Plunge', rarity: 'epic' },
  { id: 'lion', name: 'Glorp King', rarity: 'legendary' },
  { id: 'tiger', name: 'Tiger King', rarity: 'legendary' },
  { id: 'cat', name: 'Lil Glorp', rarity: 'legendary', tint: [0.8, 2.6, 0.55] },
].map((p) => ({ ...p, icon: ATLAS.indexOf(p.id) }));

export const petById = (id) => PETS.find((p) => p.id === id) || null;

// DOM icon from the atlas
export function petIcon(pet, size = 56) {
  const d = document.createElement('div');
  d.className = 'pet-icon' + (pet && pet.tint ? ' glorp' : '');
  d.style.width = d.style.height = size + 'px';
  if (pet) d.style.backgroundPosition = `${(pet.icon / (ATLAS.length - 1)) * 100}% 0`;
  else d.textContent = '?';
  return d;
}

const FOLLOW = 1.3;
const SCALE = 0.3;

// The pet that trails Claw. gltf: loaded pets.glb.
export function createPetCompanion({ gltf, scene, world, RAPIER, claw }) {
  const templates = {};
  for (const pet of PETS) templates[pet.id] = gltf.scene.getObjectByName('p_' + pet.id);
  const clips = {};
  for (const a of gltf.animations) {
    const [id, name] = a.name.split('|');
    (clips[id] ||= {})[name] = a;
  }
  let pet = null;
  let obj = null;
  let mixer = null;
  let actions = {};
  let current = null;
  let danceT = 0;
  const pos = new THREE.Vector3();
  const target = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  let yaw = 0;
  let groundY = 0;

  function play(name, fade = 0.2) {
    if (current === name || !actions[name]) return;
    const next = actions[name];
    next.reset().play();
    if (current && actions[current]) actions[current].crossFadeTo(next, fade, false);
    current = name;
  }

  function set(id) {
    if (obj) {
      scene.remove(obj);
      mixer.stopAllAction();
      obj = null;
    }
    pet = petById(id);
    if (!pet || !templates[pet.id]) return;
    obj = templates[pet.id].clone(true);
    obj.position.set(0, 0, 0);
    obj.scale.setScalar(SCALE);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (pet.tint) {
        o.material = o.material.clone();
        o.material.color.setRGB(...pet.tint); // brightens the grey cat into a glorp
      }
    });
    const holder = new THREE.Group();
    holder.add(obj);
    obj = holder;
    mixer = new THREE.AnimationMixer(holder.children[0]);
    actions = {};
    current = null;
    for (const [name, clip] of Object.entries(clips[pet.id] || {})) actions[name] = mixer.clipAction(clip);
    const p = claw.position();
    claw.forward(fwd);
    pos.set(p.x - fwd.x * FOLLOW, p.y, p.z - fwd.z * FOLLOW);
    groundY = p.y - claw.radius();
    obj.position.copy(pos);
    scene.add(obj);
    play('idle', 0);
  }

  return {
    get pet() {
      return pet;
    },
    get object() {
      return obj;
    },
    set,
    celebrate(sec = 3) {
      danceT = sec;
    },
    update(dt) {
      if (!obj) return;
      const p = claw.position();
      claw.forward(fwd);
      // trail behind and a bit to the side of Claw
      target.set(p.x - fwd.x * FOLLOW + fwd.z * 0.7, 0, p.z - fwd.z * FOLLOW - fwd.x * 0.7);
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 18) {
        pos.set(target.x, p.y, target.z); // got lost, warp
      } else if (d > 0.25) {
        const sp = Math.min(d * 3.2, 14);
        pos.x += (dx / d) * sp * dt;
        pos.z += (dz / d) * sp * dt;
        const want = Math.atan2(dx, dz);
        let diff = want - yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        yaw += diff * Math.min(1, dt * 8);
      }
      // stand on whatever is under the pet (roofs, tables, the ground)
      ray.origin.x = pos.x;
      ray.origin.y = Math.max(p.y, pos.y) + 1.5;
      ray.origin.z = pos.z;
      const hit = world.castRay(ray, 40, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, claw.body);
      const gy = hit ? ray.origin.y - hit.timeOfImpact : 0;
      groundY += (gy - groundY) * Math.min(1, dt * 12);
      pos.y = groundY;
      obj.position.copy(pos);
      obj.rotation.y = yaw;
      danceT -= dt;
      const moving = d > 0.6;
      play(danceT > 0 && !moving ? 'dance' : moving ? (d > 4 ? 'run' : 'walk') : 'idle');
      mixer.update(dt);
    },
    dispose() {
      if (obj) scene.remove(obj);
    },
  };
}
