// Claw: the Quaternius cat, made green and glorpy, on a Rapier ball body.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sfx } from '../../audio.js';
import { applyRim } from './graphics.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const fwdV = new THREE.Vector3();
const rainbowCol = new THREE.Color();
const rainbowCol2 = new THREE.Color();
const rimWhite = new THREE.Color('#ffffff');

// Take a freshly loaded cat GLB (each cat gets its own load, skinned clones are
// fiddly), recolour it, scale it to `length` metres, face +z, feet at y=0.
// where the bikini sits along the body (fractions of tail-to-nose length)
// top/bottom: [u from, u to, v from, v to] (u: tail 0 -> nose 1, v: feet 0 -> ears 1)
const OUTFIT = { top: [0.44, 0.57, 0.24, 0.56], bottom: [0.1, 0.25, 0.24, 0.56], shades: [-0.036, 0.098], flower: [0.07, 0.03, -0.02] };

export function makeCat(gltf, { length = 1, colors = {}, emissive } = {}) {
  const root = gltf.scene;
  // Measure before merging: a freshly merged skinned mesh has no posed skeleton yet,
  // so its bounds would come out 100x too big.
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  // The converted cat comes in 72 skinned pieces (one per material group). They share
  // one skeleton, so merge them into a single skinned mesh with vertex colours: 1 draw call.
  const pieces = [];
  root.traverse((o) => o.isSkinnedMesh && pieces.push(o));
  const col = new THREE.Color();
  // remember which part (by original material name) every vertex belongs to, for skins
  const PARTS = ['Grey', 'White', 'Pink'];
  const partList = [];
  const geos = pieces.map((m) => {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    col.copy(mat.color);
    if (colors[mat.name]) col.set(colors[mat.name]);
    const n = g.getAttribute('position').count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.deleteAttribute('normal');
    const part = Math.max(0, PARTS.indexOf(mat.name));
    for (let i = 0; i < n; i++) partList.push(part);
    return g;
  });
  const parts = Uint8Array.from(partList);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
  if (emissive) {
    material.emissive = new THREE.Color(emissive);
    material.emissiveIntensity = 0.15;
  }
  const first = pieces[0];
  const merged = new THREE.SkinnedMesh(mergeGeometries(geos), material);
  geos.forEach((g) => g.dispose());
  merged.position.copy(first.position);
  merged.quaternion.copy(first.quaternion);
  merged.scale.copy(first.scale);
  first.parent.add(merged);
  merged.bind(first.skeleton, first.bindMatrix);
  merged.castShadow = true;
  merged.frustumCulled = false;
  pieces.forEach((m) => m.parent.remove(m));
  const scale = length / size.x;
  root.scale.setScalar(scale);
  root.rotation.y = -Math.PI / 2; // model faces +x, we want +z
  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(wrapper);
  root.position.y -= b2.min.y;
  root.position.x -= (b2.min.x + b2.max.x) / 2;
  root.position.z -= (b2.min.z + b2.max.z) / 2;
  wrapper.updateMatrixWorld(true);
  const height = b2.max.y - b2.min.y;

  // Outfit zones (Bikini Claw): sort every triangle by where it sits on the body in the bind pose
  // (u: tail 0 -> nose 1, v: feet 0 -> ears 1). 0 = skin, 1 = top, 2 = bottoms; +4 marks a polka dot.
  const zone = new Uint8Array(merged.geometry.getAttribute('position').count);
  {
    const pos = merged.geometry.getAttribute('position');
    const m = merged.matrixWorld; // the wrapper has no parent yet, so this is wrapper space
    const a = new THREE.Vector3();
    const cs = [];
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < pos.count; i += 3) {
      const c = new THREE.Vector3();
      for (let k = 0; k < 3; k++) c.add(a.fromBufferAttribute(pos, i + k).applyMatrix4(m));
      c.multiplyScalar(1 / 3);
      cs.push(c);
      z0 = Math.min(z0, c.z);
      z1 = Math.max(z1, c.z);
    }
    cs.forEach((c, t) => {
      const u = (c.z - z0) / (z1 - z0);
      const v = c.y / height;
      let zn = 0;
      if (u > OUTFIT.top[0] && u < OUTFIT.top[1] && v > OUTFIT.top[2] && v < OUTFIT.top[3]) zn = 1;
      else if (u > OUTFIT.bottom[0] && u < OUTFIT.bottom[1] && v > OUTFIT.bottom[2] && v < OUTFIT.bottom[3]) zn = 2;
      // polka dots: a stable hash of the triangle's position
      if (zn && Math.abs(Math.sin(c.x * 91.7 + c.y * 47.3 + c.z * 63.1) * 43758.5) % 1 < 0.22) zn |= 4;
      zone[t * 3] = zone[t * 3 + 1] = zone[t * 3 + 2] = zn;
    });
  }

  // Head bone = the most forward bone in the upper half of the body.
  let head = null;
  let best = -Infinity;
  root.traverse((o) => {
    if (!o.isBone) return;
    o.getWorldPosition(tmpV);
    if (tmpV.y > height * 0.45 && tmpV.z > best) {
      best = tmpV.z;
      head = o;
    }
  });

  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const clip of gltf.animations) {
    const a = mixer.clipAction(clip);
    a.play();
    a.setEffectiveWeight(0);
    actions[clip.name] = a;
  }
  // Repaint the cat: colours = [body, belly/paws, ears/nose].
  const colorAttr = merged.geometry.getAttribute('color');
  const pc = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  const oMain = new THREE.Color();
  const oDots = new THREE.Color();
  // outfit: { main, dots } paints the outfit zones over the skin
  function recolor(cols, outfit) {
    cols.forEach((c, i) => pc[i].set(c));
    if (outfit) {
      oMain.set(outfit.main);
      oDots.set(outfit.dots || outfit.main);
    }
    for (let i = 0; i < parts.length; i++) {
      const c = outfit && zone[i] ? (zone[i] & 4 ? oDots : oMain) : pc[parts[i]];
      colorAttr.setXYZ(i, c.r, c.g, c.b);
    }
    colorAttr.needsUpdate = true;
  }
  return { wrapper, root, mixer, actions, head, height, scale, mesh: merged, material, recolor };
}

// Collision groups ((membership << 16) | filter). Remote Claws are in group 4 and props don't
// collide with them (each prop is simulated by the player who knocked it), but the local
// Claw and the world still do.
export const GROUP_REMOTE = 0x0004ffff;
export const GROUP_PROP = 0x0001fffb;

// remote: a puppet for another player, driven by setRemote() instead of control().
export function createClaw({ RAPIER, world, scene, gltf, faceTex, spawn, remote = false }) {
  const R = 0.34;
  const cat = makeCat(gltf, {
    length: 1.0,
    colors: { Grey: '#5fe03a', White: '#d4ffad', Pink: '#ff8fb1' },
    emissive: '#3cff3c',
  });
  cat.wrapper.traverse((o) => o.isSkinnedMesh && applyRim(o.material));
  const pivot = new THREE.Group();
  const body3 = new THREE.Group(); // tilt/lunge layer
  pivot.add(body3);
  body3.add(cat.wrapper);
  cat.wrapper.position.y = -R;
  const wrapBase = { y: cat.wrapper.position.y, s: cat.wrapper.scale.clone() };
  scene.add(pivot);

  // antennae
  const antenna = new THREE.Group();
  const stalkMat = new THREE.MeshStandardMaterial({ color: '#5fe03a', flatShading: true });
  const ballMat = new THREE.MeshStandardMaterial({ color: '#b6ff5c', emissive: '#7CFF4F', emissiveIntensity: 3 });
  const stalks = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.24, 6), stalkMat);
    stalk.position.y = 0.12;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), ballMat);
    ball.position.y = 0.25;
    g.add(stalk, ball);
    g.position.x = side * 0.07;
    g.rotation.z = -side * 0.3;
    g.userData.side = side;
    antenna.add(g);
    stalks.push(g);
  }
  scene.add(antenna);

  // Bikini Claw extras, riding on the head with the antennae: heart sunglasses + a hibiscus
  const outfit = new THREE.Group();
  outfit.visible = false;
  {
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.035);
    heart.bezierCurveTo(-0.01, -0.025, -0.05, -0.005, -0.045, 0.02);
    heart.bezierCurveTo(-0.04, 0.042, -0.012, 0.045, 0, 0.025);
    heart.bezierCurveTo(0.012, 0.045, 0.04, 0.042, 0.045, 0.02);
    heart.bezierCurveTo(0.05, -0.005, 0.01, -0.025, 0, -0.035);
    const lensGeo = new THREE.ExtrudeGeometry(heart, { depth: 0.012, bevelEnabled: false, curveSegments: 6 });
    const lensMat = new THREE.MeshStandardMaterial({ color: '#2a0a1e', roughness: 0.15, metalness: 0.4 });
    const frameMat = new THREE.MeshStandardMaterial({ color: '#ff3fa4', roughness: 0.4 });
    const shades = new THREE.Group();
    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(lensGeo, frameMat);
      rim.scale.set(1.18, 1.18, 0.6);
      rim.position.set(sx * 0.043, 0, -0.003);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(sx * 0.043, 0, 0);
      shades.add(rim, lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.008), frameMat);
    bridge.position.set(0, 0.018, 0.006);
    shades.add(bridge);
    shades.position.set(0, OUTFIT.shades[0], OUTFIT.shades[1]);
    shades.rotation.x = -0.25; // follows the slope of the face
    shades.scale.setScalar(0.9);
    outfit.add(shades);
    outfit.userData.shades = shades;
    // hibiscus by the right ear
    const flower = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({ color: '#ff2f6d', roughness: 0.6, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), petalMat);
      p.scale.set(1, 0.45, 1.5);
      p.position.set(Math.cos(a) * 0.028, 0, Math.sin(a) * 0.028);
      p.rotation.y = -a + Math.PI / 2;
      flower.add(p);
    }
    const middle = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshStandardMaterial({ color: '#ffe14d', emissive: '#ffb000', emissiveIntensity: 0.4 }));
    middle.position.y = 0.012;
    flower.add(middle);
    flower.position.set(...OUTFIT.flower);
    flower.rotation.set(0.9, 0, -0.5);
    outfit.add(flower);
  }
  antenna.add(outfit);

  // Cursed mode face decal
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 24),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })
  );
  face.visible = false;
  scene.add(face);

  const bodyDesc = remote
    ? RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z)
    : RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).lockRotations().setCcdEnabled(true).setLinearDamping(0.05);
  const body = world.createRigidBody(bodyDesc);
  const ballDesc = (r) => {
    const d = RAPIER.ColliderDesc.ball(r).setFriction(0).setRestitution(0).setDensity(3);
    return remote ? d.setCollisionGroups(GROUP_REMOTE) : d;
  };
  let collider = world.createCollider(ballDesc(R), body);

  const st = {
    yaw: 0,
    grounded: false,
    groundCollider: null,
    jumps: 1,
    flopping: false,
    flopTime: 0,
    airTime: 0,
    energy: 1,
    scaleK: 1,
    lunge: 0,
    oiia: 0,
    speed: 0,
    zooming: false,
    rv: { x: 0, y: 0, z: 0 }, // remote puppets: velocity from the network
    emote: null, // { id, t, dur } while dancing / emoting (emotes.js)
  };
  function resetWrapper() {
    const w = cat.wrapper;
    w.position.set(0, wrapBase.y, 0);
    w.scale.copy(wrapBase.s);
    w.rotation.set(0, 0, 0);
  }
  // Emotes are procedural: the cat model only has Idle and Walking.
  function poseEmote(e) {
    const w = cat.wrapper;
    const k = e.t;
    resetWrapper();
    switch (e.id) {
      case 'chipi': {
        const b = k * Math.PI * 2 * 1.15;
        w.position.y += Math.abs(Math.sin(b)) * 0.16;
        w.rotation.z = Math.sin(b) * 0.22;
        w.rotation.y = Math.sin(b / 2) * 0.6;
        break;
      }
      case 'spin':
        w.rotation.y = k * 18;
        w.scale.y *= 1 + Math.sin(k * 30) * 0.06;
        break;
      case 'caramell': {
        const b = k * Math.PI * 2 * 1.4;
        w.position.y += Math.max(0, Math.sin(b)) * 0.22;
        w.position.x = Math.sin(b / 2) * 0.14;
        w.rotation.z = -Math.sin(b / 2) * 0.15;
        break;
      }
      case 'pog': {
        const j = Math.min(1, k / 0.55);
        w.position.y += Math.sin(j * Math.PI) * 0.45;
        w.scale.multiplyScalar(1 + Math.max(0, 0.3 - Math.abs(k - 0.55)) * 0.8);
        break;
      }
      case 'loaf': {
        const j = Math.min(1, k * 4);
        w.scale.y *= 1 - 0.32 * j;
        w.scale.x *= 1 + 0.12 * j;
        w.scale.z *= 1 + 0.1 * j;
        break;
      }
      case 'wave':
        w.rotation.z = Math.sin(k * 10) * 0.2;
        w.position.y += Math.abs(Math.sin(k * 5)) * 0.05;
        break;
      case 'cry':
        w.rotation.y = Math.sin(k * 28) * 0.08;
        w.scale.y *= 1 + Math.sin(k * 14) * 0.04;
        w.rotation.x = 0.25;
        break;
      case 'scream': {
        const j = Math.min(1, k * 5);
        w.scale.y *= 1 + 0.35 * j;
        w.scale.x *= 1 - 0.1 * j;
        w.rotation.y = Math.sin(k * 60) * 0.06 * j;
        break;
      }
    }
  }
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

  function approach(v, target, maxDelta) {
    return v + Math.max(-maxDelta, Math.min(maxDelta, target - v));
  }

  function setFlop(on) {
    if (on === st.flopping) return;
    st.flopping = on;
    st.flopTime = 0;
    if (on) {
      body.lockRotations(false, true);
      collider.setFriction(0.9);
      collider.setRestitution(0.35);
      const m = body.mass();
      body.applyImpulse({ x: 0, y: 3 * m, z: 0 }, true);
      body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 0.4 * m, y: (Math.random() - 0.5) * 0.3 * m, z: (Math.random() - 0.5) * 0.4 * m }, true);
    } else {
      body.lockRotations(true, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      collider.setFriction(0);
      collider.setRestitution(0);
      const v = body.linvel();
      body.setLinvel({ x: v.x, y: Math.max(v.y, 4), z: v.z }, true);
    }
  }

  const claw = {
    body,
    pivot,
    cat,
    st,
    get collider() {
      return collider;
    },
    radius: () => R * st.scaleK,
    position: () => body.translation(),
    forward: (out = new THREE.Vector3()) => out.set(Math.sin(st.yaw), 0, Math.cos(st.yaw)),
    headPos(out = new THREE.Vector3()) {
      if (cat.head) cat.head.getWorldPosition(out);
      else out.copy(pivot.position).add(tmpV.set(0, 0.3, 0));
      return out;
    },
    setFlop,
    teleport(x, y, z) {
      body.setTranslation({ x, y, z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    },
    setScale(k) {
      if (k === st.scaleK) return;
      st.scaleK = k;
      pivot.scale.setScalar(k);
      antenna.scale.setScalar(k);
      face.scale.setScalar(k);
      world.removeCollider(collider, false);
      collider = world.createCollider(
        ballDesc(R * k)
          .setFriction(st.flopping ? 0.9 : 0)
          .setRestitution(st.flopping ? 0.35 : 0),
        body
      );
      const p = body.translation();
      body.setTranslation({ x: p.x, y: p.y + R * (k - 1) + 0.05, z: p.z }, true);
    },
    lungeNow() {
      st.lunge = 1;
    },
    // dances loop until you move; emotes play once (dur seconds)
    emote(id, dur = 0) {
      st.emote = { id, t: 0, dur };
    },
    stopEmote() {
      if (!st.emote) return;
      st.emote = null;
      resetWrapper();
    },
    setFaceTexture(tex) {
      if (tex && face.material.map !== tex) {
        face.material.map = tex;
        face.material.needsUpdate = true;
      }
    },
    setSkin(skin) {
      st.skin = skin;
      const m = cat.material;
      cat.recolor([skin.body, skin.belly, skin.ears], skin.bikini);
      outfit.visible = skin.outfit === 'bikini';
      stalkMat.color.set(skin.body);
      m.metalness = skin.metal || 0;
      m.roughness = skin.rough ?? 0.8;
      m.envMap = skin.metal ? claw.envMap || null : null;
      m.envMapIntensity = 1.2;
      // classic keeps its faint green glow; other skins only glow if they say so
      m.emissive.set(skin.emissive || (skin.id === 'classic' ? '#3cff3c' : '#000000'));
      m.emissiveIntensity = skin.glow ?? (skin.id === 'classic' ? 0.15 : 0);
      // rim light follows the skin: its body colour, lifted toward white
      if (m.userData.rimColor) m.userData.rimColor.set(skin.body).lerp(rimWhite, 0.45).multiplyScalar(skin.id === 'classic' ? 1 : 0.7);
      m.transparent = skin.opacity != null;
      m.opacity = skin.opacity ?? 1;
      m.depthWrite = skin.opacity == null;
      m.needsUpdate = true;
      st.skinT = 0;
    },
    setGlow(on) {
      ballMat.emissiveIntensity = on ? 3 : 0;
      ballMat.color.set(on ? '#b6ff5c' : '#7cd650');
    },

    // Before the physics step: read input, set velocity.
    control(dt, input, camYaw, events) {
      const p = body.translation();
      const v = body.linvel();
      ray.origin = { x: p.x, y: p.y, z: p.z };
      const hit = world.castRay(ray, R * st.scaleK + 0.14, true, undefined, undefined, undefined, body);
      const wasGrounded = st.grounded;
      st.grounded = !!hit && v.y < 4;
      st.groundCollider = hit ? hit.collider : null;
      if (st.grounded) st.jumps = 1;

      if (input.flop) setFlop(!st.flopping);
      // moving (or jumping, bonking, flopping) ends a dance
      if (st.emote && (Math.abs(input.moveX) + Math.abs(input.moveY) > 0.15 || input.jump || input.bonk || input.flop)) claw.stopEmote();

      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      let dx = fx * input.moveY + rx * input.moveX;
      let dz = fz * input.moveY + rz * input.moveX;
      const mag = Math.hypot(dx, dz);
      const moving = mag > 0.05;

      st.zooming = input.zoom && moving && st.energy > 0.02 && !st.flopping;
      if (st.zooming) st.energy = Math.max(0, st.energy - dt * 0.22);
      else st.energy = Math.min(1, st.energy + dt * 0.12);

      if (!st.flopping) {
        const speed = (st.zooming ? 9.5 : 4.8) * Math.sqrt(st.scaleK) * (st.speedK ?? 1); // speedK: Zombie Tag
        const accel = st.grounded ? 45 : 14;
        const nvx = approach(v.x, dx * speed, accel * dt);
        const nvz = approach(v.z, dz * speed, accel * dt);
        let nvy = v.y;
        if (input.jump) {
          if (st.grounded) {
            nvy = 8.6 * Math.sqrt(st.scaleK);
            sfx.flap();
            events.jump?.();
          } else if (st.jumps > 0) {
            st.jumps = 0;
            nvy = 7.8 * Math.sqrt(st.scaleK);
            sfx.glorp();
            events.doubleJump?.();
          }
        }
        body.setLinvel({ x: nvx, y: nvy, z: nvz }, true);
        if (moving) {
          const target = Math.atan2(dx, dz);
          let diff = target - st.yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          st.yaw += diff * (1 - Math.exp(-14 * dt));
        }
      } else {
        st.flopTime += dt;
        if (moving) {
          const m = body.mass();
          body.applyImpulse({ x: dx * 6 * m * dt, y: 0, z: dz * 6 * m * dt }, true);
        }
        if (input.jump && st.grounded) {
          body.applyImpulse({ x: 0, y: 6 * body.mass(), z: 0 }, true);
          sfx.flap();
        }
      }

      if (!st.grounded) st.airTime += dt;
      if (st.grounded && !wasGrounded && st.airTime > 0.05) {
        events.land?.(st.airTime);
        st.airTime = 0;
      }
      if (st.grounded) st.airTime = 0;
      st.speed = Math.hypot(v.x, v.z);
    },

    // Remote puppets: place the body where the network says (interpolated by the caller).
    setRemote(r) {
      body.setNextKinematicTranslation({ x: r.x, y: r.y, z: r.z });
      if (r.flopping) body.setNextKinematicRotation(r.q);
      else body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
      st.yaw = r.yaw;
      st.rv.x = r.vx;
      st.rv.y = r.vy;
      st.rv.z = r.vz;
      st.grounded = r.grounded;
      st.flopping = r.flopping;
      st.zooming = r.zooming;
      if (Math.abs(r.scale - st.scaleK) > 0.01) claw.setScale(r.scale);
    },

    // After the physics step: move the model to match.
    sync(dt, t, mut) {
      const p = body.translation();
      const v = remote ? st.rv : body.linvel();
      pivot.position.set(p.x, p.y, p.z);
      if (st.flopping) {
        const r = body.rotation();
        pivot.quaternion.set(r.x, r.y, r.z, r.w).multiply(tmpQ.setFromAxisAngle(UP, st.yaw));
        body3.rotation.set(0, 0, 0);
      } else {
        pivot.quaternion.setFromAxisAngle(UP, st.yaw);
        const pitch = st.grounded ? 0 : Math.max(-0.5, Math.min(0.5, -v.y * 0.05));
        body3.rotation.x += (pitch - body3.rotation.x) * Math.min(1, dt * 10);
      }
      st.lunge = Math.max(0, st.lunge - dt * 5);
      body3.position.z = Math.sin(st.lunge * Math.PI) * 0.35;

      if (st.emote && !st.flopping) {
        st.emote.t += dt;
        poseEmote(st.emote);
        if (st.emote.dur && st.emote.t > st.emote.dur) claw.stopEmote();
      } else if (mut.oiia) {
        st.oiia += dt * 22;
        cat.wrapper.rotation.y = st.oiia;
      } else {
        cat.wrapper.rotation.y = 0;
      }

      // animation blend
      const hs = Math.hypot(v.x, v.z);
      const idle = cat.actions.Idle;
      const walk = cat.actions.Walking;
      if (st.flopping) {
        cat.mixer.timeScale = 0;
      } else {
        cat.mixer.timeScale = 1;
        let w = Math.min(1, hs / 1.2);
        if (!st.grounded) w = 1;
        idle?.setEffectiveWeight(1 - w);
        walk?.setEffectiveWeight(w);
        if (walk) walk.timeScale = st.grounded ? Math.max(0.6, Math.min(3.4, hs / 1.6)) : 2.6;
      }
      cat.mixer.update(dt);

      // animated skins
      const sk = st.skin;
      if (sk && sk.anim) {
        st.skinT = (st.skinT || 0) + dt;
        if (sk.anim === 'rainbow' && st.skinT > 0.08) {
          st.skinT = 0;
          const h = (t * 0.25) % 1;
          rainbowCol.setHSL(h, 0.9, 0.55);
          rainbowCol2.setHSL((h + 0.5) % 1, 0.9, 0.7);
          cat.recolor([rainbowCol.getHex(), '#ffffff', rainbowCol2.getHex()]);
          cat.material.userData.rimColor?.copy(rainbowCol2);
        } else if (sk.anim === 'pulse') {
          cat.material.emissiveIntensity = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3));
        }
      }

      // antennae ride on the head, wobble with speed
      pivot.updateMatrixWorld(true);
      claw.headPos(tmpV);
      antenna.position.copy(tmpV).addScaledVector(UP, 0.07 * st.scaleK).addScaledVector(claw.forward(fwdV), 0.09 * st.scaleK);
      antenna.quaternion.copy(pivot.quaternion);
      const wob = Math.sin(t * 14) * Math.min(0.35, hs * 0.05 + (st.grounded ? 0.02 : 0.2));
      for (const s of stalks) {
        s.rotation.z = -s.userData.side * 0.3 + wob * s.userData.side;
        s.rotation.x = -0.25 - Math.min(0.5, hs * 0.04);
      }

      face.visible = !!(mut.cursed || mut.matt || (st.skin && st.skin.mattFace));
      if (outfit.visible) outfit.userData.shades.visible = !face.visible; // the face decal wins
      if (face.visible) {
        fwdV.set(0, 0, 1).applyQuaternion(pivot.quaternion);
        face.position.copy(antenna.position).addScaledVector(UP, -0.1 * st.scaleK).addScaledVector(fwdV, 0.1 * st.scaleK);
        face.quaternion.copy(pivot.quaternion);
      }
    },
    dispose() {
      scene.remove(pivot, antenna, face);
      if (remote) world.removeRigidBody(body);
    },
  };
  return claw;
}
