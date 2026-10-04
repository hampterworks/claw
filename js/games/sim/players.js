// Other players in the shared Ohio: puppet Claws (same model and skins, kinematic bodies),
// name tags, chat bubbles, their pets, plus the small multiplayer UI (online chip, feed, chat).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createClaw } from './claw.js';
import { createPetCompanion } from './pets.js';
import { skinById } from './skins.js';
import { labelTexture, createBubble } from './speech.js';
import { sampleBuffer } from './net.js';

const DELAY = 0.12; // render other players this far in the past, to interpolate smoothly
export const FLAG = { grounded: 1, flopping: 2, zooming: 4, oiia: 8, cursed: 16, matt: 32, big: 64, tiny: 128 };

export function createPlayers({ RAPIER, world, scene, net, petsGltf, envMap, faceTex, mattTex, onHit, onFeed }) {
  const remotes = new Map();
  let clawBuf = null;
  const clawBufP = fetch('assets/models/claw.glb').then((r) => r.arrayBuffer()).then((b) => (clawBuf = b));
  const loader = new GLTFLoader();

  async function spawn(info) {
    const r = { id: info.id, name: info.name, skin: info.skin, pet: info.pet, buf: [], puppet: null, petCo: null, mut: {}, flags: 0, bubble: createBubble(scene), gone: false };
    remotes.set(info.id, r);
    if (info.d) r.buf.push({ t: performance.now() / 1000, d: info.d });
    await clawBufP;
    const gltf = await loader.parseAsync(clawBuf.slice(0), 'assets/models/');
    if (r.gone) return;
    const at = info.d ? new THREE.Vector3(info.d[0], info.d[1], info.d[2]) : new THREE.Vector3(0, -50, 0);
    r.puppet = createClaw({ RAPIER, world, scene, gltf, faceTex, spawn: at, remote: true });
    r.puppet.envMap = envMap;
    r.puppet.setGlow(true);
    applyLook(r);
    makeTag(r);
  }

  // name tag, with an optional second line (e.g. "👁️ SEEKER" in Hide and Seek)
  function makeTag(r) {
    if (r.tag) {
      scene.remove(r.tag);
      r.tag.material.map.dispose();
      r.tag.material.dispose();
    }
    const tex = r.badge ? labelTexture([r.name, r.badge], { h: 104, color: '#ff4f6d' }) : labelTexture([r.name]);
    r.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    r.tag.scale.set(1.3, r.badge ? 0.53 : 0.33, 1);
    r.tag.renderOrder = 10;
    scene.add(r.tag);
  }

  function applyLook(r) {
    if (!r.puppet) return;
    const skin = skinById(r.skin);
    r.puppet.setSkin(skin);
    r.puppet.setFaceTexture((r.mut.matt || skin.mattFace) && mattTex ? mattTex : faceTex);
    if (r.petCo) r.petCo.dispose();
    r.petCo = null;
    if (r.pet && petsGltf) {
      r.petCo = createPetCompanion({ gltf: petsGltf, scene, world, RAPIER, claw: r.puppet });
      r.petCo.set(r.pet);
    }
  }

  function despawn(id) {
    const r = remotes.get(id);
    if (!r) return;
    r.gone = true;
    r.puppet?.dispose();
    r.petCo?.dispose();
    if (r.tag) {
      scene.remove(r.tag);
      r.tag.material.map.dispose();
      r.tag.material.dispose();
    }
    r.bubble.clear();
    remotes.delete(id);
  }

  net.on('welcome', (m) => {
    for (const id of [...remotes.keys()]) despawn(id);
    for (const p of m.players) spawn(p);
  });
  net.on('join', (m) => {
    spawn(m);
    onFeed(`${m.name} joined Ohio`, '#7CFF4F');
  });
  net.on('leave', (m) => {
    const r = remotes.get(m.id);
    if (r) onFeed(`${r.name} left`, '#9aa0a8');
    despawn(m.id);
  });
  net.on('status', (up) => {
    if (!up) for (const id of [...remotes.keys()]) despawn(id);
  });
  net.on('p', (m) => {
    const r = remotes.get(m.id);
    if (!r) return;
    r.buf.push({ t: performance.now() / 1000, d: m.d });
    if (r.buf.length > 20) r.buf.shift();
  });
  net.on('look', (m) => {
    const r = remotes.get(m.id);
    if (!r) return;
    r.skin = m.skin;
    r.pet = m.pet;
    applyLook(r);
  });
  net.on('chat', (m) => {
    const r = remotes.get(m.id);
    const name = r ? r.name : 'You';
    onFeed(`${name}: ${m.text}`, '#ffffff');
    if (r?.puppet) r.bubble.say(m.text, 6);
  });
  net.on('fx', (m) => {
    const r = remotes.get(m.id);
    if (r) onFeed(`${r.name} ${m.text}`, '#ffe14d');
  });
  net.on('hit', (m) => onHit(m.d, remotes.get(m.from)?.name || 'someone'));

  let tagHidden = () => false;
  const q = { x: 0, y: 0, z: 0, w: 1 };
  const st = { x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0, q, scale: 1, grounded: true, flopping: false, zooming: false };
  return {
    remotes,
    get count() {
      return remotes.size;
    },
    nameOf(id) {
      return remotes.get(id)?.name || null;
    },
    // Hide and Seek: hide some name tags, badge others
    setTagFilter(fn) {
      tagHidden = fn || (() => false);
    },
    setBadge(id, badge) {
      const r = remotes.get(id);
      if (!r || (r.badge || null) === (badge || null)) return;
      r.badge = badge || null;
      if (r.tag) makeTag(r);
    },
    // which remote Claws are inside a bonk sphere
    near(center, radius) {
      const out = [];
      for (const r of remotes.values()) {
        if (!r.puppet) continue;
        const p = r.puppet.position();
        if (Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z) < radius + r.puppet.radius()) out.push(r);
      }
      return out;
    },
    // before the physics step: move puppets to their interpolated network state
    update() {
      const t = performance.now() / 1000 - DELAY;
      for (const r of remotes.values()) {
        if (!r.puppet || !r.buf.length) continue;
        const [a, c, f] = sampleBuffer(r.buf, t);
        const d0 = a.d;
        const d1 = c.d;
        const L = (i) => d0[i] + (d1[i] - d0[i]) * f;
        st.x = L(0);
        st.y = L(1);
        st.z = L(2);
        let dy = d1[3] - d0[3];
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        st.yaw = d0[3] + dy * f;
        st.vx = L(4);
        st.vy = L(5);
        st.vz = L(6);
        q.x = d1[7];
        q.y = d1[8];
        q.z = d1[9];
        q.w = d1[10];
        st.scale = d1[11] || 1;
        const fl = d1[12] | 0;
        st.grounded = !!(fl & FLAG.grounded);
        st.flopping = !!(fl & FLAG.flopping);
        st.zooming = !!(fl & FLAG.zooming);
        if (fl !== r.flags) {
          const mattBefore = r.mut.matt;
          r.flags = fl;
          r.mut = { oiia: !!(fl & FLAG.oiia), cursed: !!(fl & FLAG.cursed), matt: !!(fl & FLAG.matt) };
          if (mattBefore !== r.mut.matt) r.puppet.setFaceTexture((r.mut.matt || skinById(r.skin).mattFace) && mattTex ? mattTex : faceTex);
        }
        r.puppet.setRemote(st);
      }
    },
    // after the physics step: animate puppets, pets, tags, bubbles
    sync(dt, t) {
      for (const r of remotes.values()) {
        if (!r.puppet) continue;
        r.puppet.sync(dt, t, r.mut);
        r.petCo?.update(dt);
        const p = r.puppet.position();
        const k = r.puppet.st.scaleK;
        r.tag.position.set(p.x, p.y + 0.95 * k + (r.badge ? 0.35 : 0.25), p.z);
        r.tag.visible = !tagHidden(r.id);
        if (r.petCo?.object) r.petCo.object.visible = r.tag.visible; // a pet would give a hider away
        r.bubble.update(dt, { x: p.x, y: p.y + 0.95 * k + 0.5, z: p.z });
      }
    },
    dispose() {
      for (const id of [...remotes.keys()]) despawn(id);
    },
  };
}

// Online chip, event feed and chat box. Text is always set with textContent.
export function createMpUi(wrap, { touch, onSend, onOpenChange, onToggle }) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'sim-chip mp-online';
  chip.textContent = '🌐 …';
  chip.title = 'Switch between online and offline';
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    onToggle?.();
  });
  wrap.querySelector('.sim-top-right')?.prepend(chip);
  const feed = document.createElement('div');
  feed.className = 'mp-feed';
  wrap.appendChild(feed);
  const box = document.createElement('form');
  box.className = 'mp-chat';
  box.hidden = true;
  const input = document.createElement('input');
  input.maxLength = 80;
  input.placeholder = 'say something glorpy… (Enter)';
  input.autocomplete = 'off';
  box.appendChild(input);
  wrap.appendChild(box);
  let chatBtn = null;
  if (touch) {
    chatBtn = document.createElement('button');
    chatBtn.type = 'button';
    chatBtn.className = 'sim-chip mp-chat-btn';
    chatBtn.textContent = '💬';
    wrap.querySelector('.sim-top-right')?.prepend(chatBtn);
    chatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      open();
    });
  }
  function open() {
    box.hidden = false;
    input.value = '';
    input.focus();
    onOpenChange(true);
  }
  function close() {
    box.hidden = true;
    input.blur();
    onOpenChange(false);
  }
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = input.value.trim();
    if (s) onSend(s);
    close();
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('blur', () => !box.hidden && close());

  return {
    chip,
    get open() {
      return !box.hidden;
    },
    openChat: open,
    setStatus(connected, n, solo = false) {
      chip.textContent = solo ? '🎮 offline' : connected ? `🌐 ${n + 1} online` : '🌐 connecting…';
      chip.classList.toggle('off', !connected);
    },
    feed(text, color = '#fff') {
      const row = document.createElement('div');
      row.className = 'mp-feed-row';
      row.style.color = color;
      row.textContent = text;
      feed.appendChild(row);
      while (feed.children.length > 6) feed.firstChild.remove();
      setTimeout(() => row.classList.add('fade'), 6000);
      setTimeout(() => row.remove(), 7000);
    },
    dispose() {
      chip.remove();
      feed.remove();
      box.remove();
      chatBtn?.remove();
    },
  };
}
