// Claw: the Quaternius cat, made green and glorpy, on a Rapier ball body.
import * as THREE from 'three';
import { sfx } from '../../audio.js';
import { applyRim } from './graphics.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const fwdV = new THREE.Vector3();

// Take a freshly loaded cat GLB (each cat gets its own load, skinned clones are
// fiddly), recolour it, scale it to `length` metres, face +z, feet at y=0.
export function makeCat(gltf, { length = 1, colors = {}, emissive } = {}) {
  const root = gltf.scene;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    const mats = [].concat(o.material).map((m) => {
      const c = m.clone();
      if (colors[m.name]) c.color.set(colors[m.name]);
      c.flatShading = true;
      if (emissive) {
        c.emissive = new THREE.Color(emissive);
        c.emissiveIntensity = 0.15;
      }
      return c;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
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
  return { wrapper, root, mixer, actions, head, height, scale };
}

export function createClaw({ RAPIER, world, scene, gltf, faceTex, spawn }) {
  const R = 0.34;
  const cat = makeCat(gltf, {
    length: 1.0,
    colors: { Grey: '#5fe03a', White: '#d4ffad', Pink: '#ff8fb1' },
    emissive: '#3cff3c',
  });
  cat.wrapper.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => applyRim(m)));
  const pivot = new THREE.Group();
  const body3 = new THREE.Group(); // tilt/lunge layer
  pivot.add(body3);
  body3.add(cat.wrapper);
  cat.wrapper.position.y = -R;
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

  // Cursed mode face decal
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 24),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })
  );
  face.visible = false;
  scene.add(face);

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(spawn.x, spawn.y, spawn.z)
    .lockRotations()
    .setCcdEnabled(true)
    .setLinearDamping(0.05);
  const body = world.createRigidBody(bodyDesc);
  let collider = world.createCollider(RAPIER.ColliderDesc.ball(R).setFriction(0).setRestitution(0).setDensity(3), body);

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
  };
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
        RAPIER.ColliderDesc.ball(R * k)
          .setFriction(st.flopping ? 0.9 : 0)
          .setRestitution(st.flopping ? 0.35 : 0)
          .setDensity(3),
        body
      );
      const p = body.translation();
      body.setTranslation({ x: p.x, y: p.y + R * (k - 1) + 0.05, z: p.z }, true);
    },
    lungeNow() {
      st.lunge = 1;
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
        const speed = (st.zooming ? 9.5 : 4.8) * Math.sqrt(st.scaleK);
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

    // After the physics step: move the model to match.
    sync(dt, t, mut) {
      const p = body.translation();
      const v = body.linvel();
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

      if (mut.oiia) {
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

      face.visible = !!mut.cursed;
      if (face.visible) {
        fwdV.set(0, 0, 1).applyQuaternion(pivot.quaternion);
        face.position.copy(antenna.position).addScaledVector(UP, -0.1 * st.scaleK).addScaledVector(fwdV, 0.1 * st.scaleK);
        face.quaternion.copy(pivot.quaternion);
      }
    },
    dispose() {
      scene.remove(pivot, antenna, face);
    },
  };
  return claw;
}
