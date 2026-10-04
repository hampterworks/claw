// Shared props. Whoever knocks a prop owns it: their game simulates it and streams its
// transform; everyone else turns that body kinematic and replays the stream. When the prop
// settles the owner releases it and the server remembers where it ended up.
import { GROUP_PROP } from './claw.js';
import { sampleBuffer } from './net.js';

const SEND_HZ = 15;
const DELAY = 0.12; // seconds of interpolation delay for followed props

export function createPropSync({ RAPIER, world, W, net }) {
  const props = W.props;
  const n = props.length;
  const owner = new Array(n).fill(null); // null | 'me' | remote player id
  const buf = Array.from({ length: n }, () => []); // followed props: [{t, d}]
  const held = new Set(); // props the local Claw is holding (never released while held)
  const slowT = new Float32Array(n); // how long an owned prop has been nearly still
  let sendT = 0;
  let quietT = 0; // no claims right after (re)connecting while the snapshot settles
  const DYN = RAPIER.RigidBodyType.Dynamic;
  const KIN = RAPIER.RigidBodyType.KinematicPositionBased;

  for (const pr of props) {
    for (let i = 0; i < pr.body.numColliders(); i++) pr.body.collider(i).setCollisionGroups(GROUP_PROP);
  }

  const now = () => performance.now() / 1000;
  const index = new Map(props.map((p, i) => [p, i]));

  function setDynamic(i) {
    const b = props[i].body;
    if (b.bodyType() !== DYN) b.setBodyType(DYN, true);
  }
  function setKinematic(i) {
    const b = props[i].body;
    if (b.bodyType() !== KIN) b.setBodyType(KIN, true);
  }
  // put a prop at a settled state and let it rest
  function settle(i, d) {
    setDynamic(i);
    const b = props[i].body;
    b.setTranslation({ x: d[0], y: d[1], z: d[2] }, false);
    b.setRotation({ x: d[3], y: d[4], z: d[5], w: d[6] }, false);
    b.setLinvel({ x: 0, y: 0, z: 0 }, false);
    b.setAngvel({ x: 0, y: 0, z: 0 }, false);
    b.sleep();
    props[i].moved = true;
    syncMesh(i);
  }
  function syncMesh(i) {
    const p = props[i];
    const t = p.body.translation();
    const r = p.body.rotation();
    p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    p.mesh.position.set(0, -p.hy, 0).applyQuaternion(p.mesh.quaternion);
    p.mesh.position.x += t.x;
    p.mesh.position.y += t.y;
    p.mesh.position.z += t.z;
  }
  function state(i) {
    const b = props[i].body;
    const t = b.translation();
    const r = b.rotation();
    return [t.x, t.y, t.z, r.x, r.y, r.z, r.w];
  }
  function release(i) {
    owner[i] = null;
    net.send({ t: 'rel', id: i, d: state(i) });
  }
  function claim(i) {
    if (owner[i] === 'me' || !net.connected) return;
    owner[i] = 'me';
    buf[i].length = 0;
    setDynamic(i);
    net.send({ t: 'claim', id: i });
  }
  function follow(i, by) {
    owner[i] = by;
    held.delete(i);
    setKinematic(i);
  }

  net.on('welcome', (m) => {
    quietT = 2;
    owner.fill(null);
    for (const b of buf) b.length = 0;
    for (const [id, d] of Object.entries(m.props || {})) {
      const i = +id;
      if (i >= 0 && i < n && Array.isArray(d) && d.length === 7) settle(i, d);
    }
    for (const [id, by] of Object.entries(m.owners || {})) {
      const i = +id;
      if (i >= 0 && i < n && by !== net.id) follow(i, by);
    }
  });
  net.on('owner', (m) => {
    const i = m.id;
    if (i < 0 || i >= n) return;
    if (m.by === net.id) owner[i] = 'me';
    else if (m.by) follow(i, m.by);
    else if (owner[i] !== 'me') {
      owner[i] = null;
      setDynamic(i);
    }
  });
  net.on('s', (m) => {
    const t = now();
    for (const row of m.d) {
      const i = row[0];
      if (i < 0 || i >= n) continue;
      if (owner[i] !== m.by) follow(i, m.by);
      const b = buf[i];
      b.push({ t, d: row.slice(1) });
      if (b.length > 20) b.shift();
    }
  });
  net.on('rel', (m) => {
    const i = m.id;
    if (i < 0 || i >= n || owner[i] === 'me') return;
    owner[i] = null;
    buf[i].length = 0;
    settle(i, m.d);
  });
  net.on('leave', (m) => {
    for (let i = 0; i < n; i++) if (owner[i] === m.id && !buf[i].length) {
      owner[i] = null;
      setDynamic(i);
    }
  });
  net.on('status', (up) => {
    if (up) return;
    // offline: everything goes back to being simulated locally
    for (let i = 0; i < n; i++) {
      if (owner[i] && owner[i] !== 'me') setDynamic(i);
      owner[i] = null;
      buf[i].length = 0;
    }
  });

  return {
    // may the local player score / deliver this prop?
    mine(pr) {
      if (!net.connected) return true;
      const i = index.get(pr);
      return i == null || owner[i] === 'me' || owner[i] === null;
    },
    isFollowed(pr) {
      const o = owner[index.get(pr)];
      return !!o && o !== 'me';
    },
    hold(pr, on) {
      const i = index.get(pr);
      if (i == null) return;
      if (on) {
        held.add(i);
        claim(i);
      } else held.delete(i);
    },
    claimProp(pr) {
      const i = index.get(pr);
      if (i != null) claim(i);
    },
    // owner puts a prop back where it started (after a delivery quest)
    reset(pr) {
      const i = index.get(pr);
      if (i == null) return;
      if (net.connected && owner[i] !== 'me' && owner[i] !== null) return;
      const s = pr.spawn;
      const q = pr.spawnQ || { x: 0, y: 0, z: 0, w: 1 };
      const d = [s.x, s.y, s.z, q.x, q.y, q.z, q.w];
      held.delete(i);
      settle(i, d);
      pr.knocked = false;
      pr.moved = false;
      if (net.connected) {
        owner[i] = null;
        net.send({ t: 'rel', id: i, d });
      }
    },
    // before the physics step
    update(dt) {
      if (!net.connected) return;
      const t = now() - DELAY;
      quietT -= dt;
      for (let i = 0; i < n; i++) {
        const o = owner[i];
        if (o === null) {
          // really moving and nobody owns it: our Claw (or one of our props) did this.
          // Props that are merely awake (settling jitter) are left alone.
          const b = props[i].body;
          if (quietT > 0 || b.bodyType() !== DYN || b.isSleeping()) continue;
          const v = b.linvel();
          const w = b.angvel();
          if (v.x * v.x + v.y * v.y + v.z * v.z > 0.16 || w.x * w.x + w.y * w.y + w.z * w.z > 1) claim(i);
        } else if (o !== 'me') {
          // replay the owner's stream
          const b = buf[i];
          if (!b.length) continue;
          const [a, c, f] = sampleBuffer(b, t);
          const body = props[i].body;
          const d0 = a.d;
          const d1 = c.d;
          body.setNextKinematicTranslation({ x: d0[0] + (d1[0] - d0[0]) * f, y: d0[1] + (d1[1] - d0[1]) * f, z: d0[2] + (d1[2] - d0[2]) * f });
          // nlerp is plenty at 15 Hz
          const dot = d0[3] * d1[3] + d0[4] * d1[4] + d0[5] * d1[5] + d0[6] * d1[6];
          const sgn = dot < 0 ? -1 : 1;
          const q = [0, 1, 2, 3].map((k) => d0[3 + k] + (d1[3 + k] * sgn - d0[3 + k]) * f);
          const len = Math.hypot(...q) || 1;
          body.setNextKinematicRotation({ x: q[0] / len, y: q[1] / len, z: q[2] / len, w: q[3] / len });
        }
      }
      // owned: stream while awake, release when settled
      sendT -= dt;
      const rows = [];
      for (let i = 0; i < n; i++) {
        if (owner[i] !== 'me') continue;
        const b = props[i].body;
        const v = b.linvel();
        const w = b.angvel();
        slowT[i] = v.x * v.x + v.y * v.y + v.z * v.z < 0.01 && w.x * w.x + w.y * w.y + w.z * w.z < 0.05 ? slowT[i] + dt : 0;
        if ((b.isSleeping() || slowT[i] > 1.2) && !held.has(i)) {
          slowT[i] = 0;
          release(i);
          continue;
        }
        if (sendT <= 0) {
          const v = b.linvel();
          rows.push([i, ...state(i), v.x, v.y, v.z]);
        }
      }
      if (sendT <= 0) {
        sendT = 1 / SEND_HZ;
        for (let k = 0; k < rows.length; k += 60) net.send({ t: 's', d: rows.slice(k, k + 60) });
      }
    },
    // after the physics step: followed props need their meshes moved too
    syncFollowed() {
      for (let i = 0; i < n; i++) if (owner[i] && owner[i] !== 'me' && buf[i].length) syncMesh(i);
    },
    stats() {
      let mine = 0;
      let followed = 0;
      for (const o of owner) {
        if (o === 'me') mine++;
        else if (o) followed++;
      }
      return { mine, followed };
    },
  };
}
