// October night atmosphere (game.js wires it in when isHalloween()): bats round the tall things, drifting
// ghosts, will-o'-wisps, ground fog, string lights over the main road and a witch's brew in the park soup pot.
// Every kind of moving thing shares one InstancedMesh or Points, so the lot is a handful of draw calls.
import * as THREE from 'three';

const POT = new THREE.Vector3(16, 1.65, 12); // the giant soup pot in the park (world.js), at soup level
const ROAD_Z = -52; // the main road (districts.js); its lamps stand at z -57 and -47

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function blobTexture(puffs) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = rng(7);
  for (let i = 0; i < puffs; i++) {
    // one soft disc in the middle, then lumpy puffs round it (fog patches don't look like circles)
    const x = i ? 32 + r() * 64 : 64;
    const y = i ? 32 + r() * 64 : 64;
    const rad = i ? 18 + r() * 22 : 62;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(255,255,255,${i ? 0.35 : 1})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

// a bat facing +z, wings along x (the vertex shader flaps anything away from the body)
function batGeometry() {
  const v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  // body (a little cross section diamond) and ears
  tri([0, 0.035, 0.12], [0, 0, -0.12], [0.035, 0, 0]);
  tri([0, 0.035, 0.12], [0, 0, -0.12], [-0.035, 0, 0]);
  tri([0, -0.03, 0.1], [0, 0, -0.12], [0.035, 0, 0]);
  tri([0, -0.03, 0.1], [0, 0, -0.12], [-0.035, 0, 0]);
  for (const s of [-1, 1]) {
    tri([s * 0.012, 0.02, 0.08], [s * 0.028, 0.075, 0.1], [s * 0.03, 0.02, 0.06]);
    // wing outline from the shoulder round to the hip, scalloped between the finger bones
    const o = [[0.03, 0.06], [0.17, 0.09], [0.36, 0.01], [0.28, -0.09], [0.24, -0.04], [0.17, -0.12], [0.12, -0.06], [0.03, -0.09]];
    for (let i = 0; i < o.length - 1; i++) tri([s * 0.03, 0, 0], [s * o[i][0], 0, o[i][1]], [s * o[i + 1][0], 0, o[i + 1][1]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

export function createSpookyFx({ scene, gltf, claw, env, lampSpots = [], graveyard, quality = 'high' }) {
  const G = graveyard;
  const uTime = { value: 0 };
  const objects = [];
  const add = (o) => {
    scene.add(o);
    objects.push(o);
    return o;
  };
  let low = quality === 'low';
  const tmp = new THREE.Vector3();
  const dummy = new THREE.Object3D();

  // ---------- bats ----------
  // [x, y, z, radius, count]: Winter's Castle towers, the graveyard, the Cat Tree, the radio tower,
  // the Glorp Towers roof; centre null = loose bats that follow Claw around
  const FLOCKS = [
    [-62, 15, 34, 3.5, 5], [-34, 15, 34, 3.5, 5], [-62, 15, 58, 3.5, 5], [-34, 15, 58, 3.5, 5],
    [G.x, 6.5, G.z, 7, 7],
    [-66, 25, 4, 5.5, 6],
    [-26, 18.5, 22, 4.5, 6],
    [24, 12.5, -66, 5.5, 7],
    [null, 4.5, null, 5, 4],
  ];
  const bats = [];
  {
    const r = rng(1313);
    FLOCKS.forEach(([x, y, z, rad, n], f) => {
      const dir = f % 2 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const br = rad * (0.6 + r() * 0.7);
        bats.push({ x, y, z, r: br, a: r() * 6.28, w: (dir * (3.2 + r() * 1.6)) / br, ph: r() * 6.28, s: (x == null ? 0.8 : 1.4) + r() * 0.6, keep: i % 2 === 0 });
      }
    });
    bats.sort((a, b) => b.keep - a.keep); // low quality draws only the first (kept) half
  }
  const batKeep = bats.filter((b) => b.keep).length;
  const batMat = new THREE.MeshBasicMaterial({ color: '#0b0510', side: THREE.DoubleSide });
  batMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = position;
      float wr = max(abs(position.x) - 0.03, 0.0);
      float flap = sin(uTime * 14.0 + float(gl_InstanceID) * 1.7) * 0.8 + 0.2;
      transformed.x = sign(position.x) * (min(abs(position.x), 0.03) + wr * cos(flap));
      transformed.y += wr * sin(flap);`
    );
  };
  batMat.customProgramCacheKey = () => 'spookyfx-bats';
  const batMesh = add(new THREE.InstancedMesh(batGeometry(), batMat, bats.length));
  batMesh.frustumCulled = false; // they roam the whole map
  batMesh.name = 'spookyfx-bats';
  function batPos(b, t, out, cx, cy, cz) {
    const a = b.a + b.w * t;
    const r = b.r + Math.sin(t * 0.7 + b.ph) * 1.2;
    return out.set(cx + Math.cos(a) * r, cy + Math.sin(t * 1.3 + b.ph) * 1.1 + Math.sin(t * 3.1 + b.ph * 2) * 0.25, cz + Math.sin(a) * r);
  }
  function updateBats(t, night) {
    batMesh.visible = night > 0.35; // bats sleep through the day
    if (!batMesh.visible) return;
    const p = claw.position();
    const n = low ? batKeep : bats.length;
    batMesh.count = n;
    for (let i = 0; i < n; i++) {
      const b = bats[i];
      const cx = b.x ?? p.x;
      const cy = b.x == null ? p.y + b.y : b.y;
      const cz = b.z ?? p.z;
      batPos(b, t, dummy.position, cx, cy, cz);
      dummy.lookAt(batPos(b, t + 0.08, tmp, cx, cy, cz));
      dummy.rotateZ(Math.sign(b.w) * 0.45);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      batMesh.setMatrixAt(i, dummy.matrix);
    }
    batMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- wandering ghosts ----------
  // [x, z, rx, rz]: loops in the graveyard (the quest ghost floats at its back), by the lake, in Meowtown,
  // in the park, on the main road and up the castle path. The first four stay on in low quality.
  const LOOPS = [[G.x + 4, G.z - 2, 3.5, 3], [4, 47.5, 7, 2], [-58, -30, 4.5, 4.5], [-12, ROAD_Z, 10, 2], [-2, 21, 4, 3], [-27, 40, 4, 3]];
  const ghostSrc = gltf.scene.getObjectByName('h_character_ghost');
  const idle = gltf.animations.find((a) => a.name === 'h_character_ghost|idle');
  const ghosts = ghostSrc
    ? LOOPS.map(([x, z, rx, rz], i) => {
        const obj = ghostSrc.clone(true);
        obj.scale.setScalar(1.35);
        const mats = [];
        obj.traverse((o) => {
          if (!o.isMesh) return;
          o.material = o.material.clone();
          Object.assign(o.material, { transparent: true, opacity: 0, depthWrite: false });
          o.material.emissive = new THREE.Color('#7dffd0');
          o.material.emissiveIntensity = 0.45;
          o.castShadow = false;
          mats.push(o.material);
        });
        const mixer = new THREE.AnimationMixer(obj);
        if (idle) mixer.clipAction(idle).play();
        mixer.setTime(i * 0.37);
        obj.visible = false;
        add(obj);
        return { obj, mats, mixer, x, z, rx, rz, u: i * 1.9, sp: (i % 2 ? 1 : -1) * (0.55 / Math.max(rx, rz)), ph: i * 2.3, push: new THREE.Vector2() };
      })
    : [];
  function updateGhosts(dt, t, night) {
    const p = claw.position();
    ghosts.forEach((g, i) => {
      const on = !(low && i >= 4);
      const vis = THREE.MathUtils.smoothstep(Math.sin(t * 0.21 + g.ph), -0.5, 0.4); // fade in and out (gone for a while)
      const opacity = on ? 0.5 * vis * THREE.MathUtils.smoothstep(night, 0.2, 0.7) : 0;
      g.u += g.sp * dt;
      const bx = g.x + Math.cos(g.u) * g.rx + Math.sin(t * 0.4 + g.ph) * 0.6;
      const bz = g.z + Math.sin(g.u) * g.rz + Math.cos(t * 0.33 + g.ph) * 0.6;
      // slide away from Claw, and drift back to the loop afterwards
      const dx = bx + g.push.x - p.x;
      const dz = bz + g.push.y - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.2) g.push.addScaledVector(tmp.set(dx, dz, 0).normalize(), (3.2 - d) * dt * 5);
      else g.push.multiplyScalar(Math.exp(-dt * 0.25));
      const x = bx + g.push.x;
      const z = bz + g.push.y;
      // hidden when see-through or far away (each ghost is 3 draw calls)
      g.obj.visible = opacity > 0.02 && Math.hypot(x - p.x, z - p.z) < 60;
      if (!g.obj.visible) return;
      const fleeing = d < 4.5;
      const heading = fleeing ? Math.atan2(dx, dz) : Math.atan2(-Math.sin(g.u) * g.rx * g.sp, Math.cos(g.u) * g.rz * g.sp);
      g.obj.rotation.y += Math.atan2(Math.sin(heading - g.obj.rotation.y), Math.cos(heading - g.obj.rotation.y)) * Math.min(1, dt * 3);
      g.obj.position.set(x, 0.45 + Math.sin(t * 1.3 + g.ph) * 0.2, z);
      for (const m of g.mats) m.opacity = opacity * (fleeing ? 0.6 : 1);
      g.mixer.update(dt);
    });
  }

  // ---------- will-o'-wisps (and the cauldron's bubbles): one Points ----------
  // [x, z, rx, rz, yMin, yMax, count]: the graveyard, over the lake, the corn field, the hedge maze
  const WISPS = [[G.x, G.z, 9, 6, 0.6, 2.2, 16], [0, 66, 18, 11, 0.5, 1.6, 14], [25, -24, 7, 7, 1.2, 2.6, 10], [111, 34, 14, 14, 1, 3, 14]];
  const pts = [];
  {
    const r = rng(4242);
    const green = new THREE.Color('#5dff6e');
    const orange = new THREE.Color('#ff9a2e');
    for (let i = 0; i < 28; i++) {
      const a = r() * 6.28;
      const d = Math.sqrt(r()) * 1.7;
      pts.push({ p: [POT.x + Math.cos(a) * d, POT.y, POT.z + Math.sin(a) * d], c: new THREE.Color('#8dff4a'), seed: r(), mode: 1, size: 0.16 + r() * 0.14, keep: true });
    }
    for (const [x, z, rx, rz, y0, y1, n] of WISPS) {
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28;
        const d = Math.sqrt(r());
        pts.push({ p: [x + Math.cos(a) * d * rx, y0 + r() * (y1 - y0), z + Math.sin(a) * d * rz], c: r() < 0.6 ? green : orange, seed: r(), mode: 0, size: 0.6 + r() * 0.4, keep: i % 2 === 0 });
      }
    }
    pts.sort((a, b) => b.keep - a.keep);
  }
  const ptsKeep = pts.filter((q) => q.keep).length;
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((q) => q.p), 3));
  ptGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(pts.flatMap((q) => [q.c.r, q.c.g, q.c.b]), 3));
  ptGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(pts.map((q) => q.seed), 1));
  ptGeo.setAttribute('aMode', new THREE.Float32BufferAttribute(pts.map((q) => q.mode), 1));
  ptGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(pts.map((q) => q.size), 1));
  const ptMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime, uPx: { value: 600 }, uWisp: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSeed;
      attribute float aMode;
      attribute float aSize;
      uniform float uTime;
      uniform float uPx;
      uniform float uWisp;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vMode;
      void main() {
        vec3 p = position;
        float s = aSeed * 6.2831;
        float a;
        if (aMode < 0.5) {
          p += vec3(sin(uTime * 0.23 + s * 3.1) * 1.6 + sin(uTime * 0.71 + s) * 0.4, sin(uTime * 0.9 + s * 2.0) * 0.35, cos(uTime * 0.19 + s * 4.3) * 1.6 + cos(uTime * 0.63 + s * 1.7) * 0.4);
          a = (0.6 + 0.4 * sin(uTime * (1.5 + aSeed * 2.0) + s * 7.0)) * smoothstep(-0.7, 0.1, sin(uTime * 0.13 + s * 5.0)) * uWisp;
        } else {
          float k = fract(uTime * (0.3 + aSeed * 0.3) + aSeed * 13.0);
          p += vec3(sin(k * 9.0 + s) * 0.1, k * 1.5, cos(k * 7.0 + s) * 0.1);
          a = sin(k * 3.1416);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vColor = aColor;
        vMode = aMode;
        vAlpha = a * (1.0 - smoothstep(70.0, 110.0, -mv.z));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPx / -mv.z, 1.0, 64.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vMode;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        // wisps: a hot core in a soft halo; bubbles: a ring
        float g = vMode < 0.5 ? exp(-d * d * 14.0) * 1.6 + (1.0 - d) * (1.0 - d) * 0.5 : smoothstep(0.55, 0.8, d) * (1.0 - smoothstep(0.85, 1.0, d)) + 0.15;
        gl_FragColor = vec4(vColor * g, vAlpha);
      }`,
  });
  const points = add(new THREE.Points(ptGeo, ptMat));
  points.frustumCulled = false;
  points.name = 'spookyfx-wisps';
  const bufSize = new THREE.Vector2();
  points.onBeforeRender = (renderer, _s, camera) => {
    renderer.getDrawingBufferSize(bufSize);
    ptMat.uniforms.uPx.value = bufSize.y / (2 * Math.tan(THREE.MathUtils.degToRad((camera.fov || 50) / 2)));
  };

  // ---------- ground fog: one InstancedMesh of flat, slowly drifting patches ----------
  // [x, z, rx, rz, count]: the graveyard, the lake's south shore, the park
  const FOG = [[G.x, G.z, 13, 9, 12], [0, 49, 20, 4, 10], [0, 20, 10, 8, 8]];
  const fogs = [];
  {
    const r = rng(99);
    for (const [x, z, rx, rz, n] of FOG) {
      for (let i = 0; i < n; i++) fogs.push({ x: x + (r() * 2 - 1) * rx, z: z + (r() * 2 - 1) * rz, y: 0.18 + r() * 0.7, s: 7 + r() * 5, rot: r() * 6.28, ph: r() * 6.28, keep: i % 2 === 0 });
    }
    fogs.sort((a, b) => b.keep - a.keep);
  }
  const fogKeep = fogs.filter((f) => f.keep).length;
  const fogTex = blobTexture(9);
  const fogMat = new THREE.MeshBasicMaterial({ map: fogTex, color: '#cfc6e8', transparent: true, opacity: 0, depthWrite: false });
  const fogMesh = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fogMat, fogs.length));
  fogMesh.frustumCulled = false;
  fogMesh.renderOrder = 2;
  fogMesh.name = 'spookyfx-fog';
  function updateFog(t, night) {
    fogMat.opacity = 0.42 * (0.3 + 0.7 * night);
    const n = low ? fogKeep : fogs.length;
    fogMesh.count = n;
    for (let i = 0; i < n; i++) {
      const f = fogs[i];
      dummy.position.set(f.x + Math.sin(t * 0.05 + f.ph) * 1.8, f.y, f.z + Math.cos(t * 0.04 + f.ph) * 1.4);
      dummy.rotation.set(0, f.rot + t * 0.02 * (i % 2 ? 1 : -1), 0);
      dummy.scale.setScalar(f.s * (1 + Math.sin(t * 0.11 + f.ph) * 0.08));
      dummy.updateMatrix();
      fogMesh.setMatrixAt(i, dummy.matrix);
    }
    fogMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- string lights: orange and purple bulbs sagging between main road lamps ----------
  const HANG = 3.3; // tied on just under the lamp heads
  const spans = [];
  {
    const road = lampSpots.filter(([, z]) => Math.abs(z - ROAD_Z) < 7);
    for (const [x, z] of road) {
      // along each kerb: to the next lamp east; across the road: every other lamp
      let next = null;
      for (const [x2, z2] of road) if (Math.abs(z2 - z) < 1 && x2 - x >= 8 && x2 - x <= 20 && (!next || x2 < next[0])) next = [x2, z2];
      if (next) spans.push([x, z, ...next, 0.7]);
      if (z < ROAD_Z && Math.round(x / 14) % 2 === 0) {
        const across = road.find(([x2, z2]) => Math.abs(x2 - x) < 1 && z2 - z >= 8 && z2 - z <= 20);
        if (across) spans.push([x, z, ...across, 0.9]);
      }
    }
  }
  const bulbPos = [];
  const wire = [];
  for (const [x0, z0, x1, z1, sag] of spans) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const at = (u) => [x0 + (x1 - x0) * u, HANG - sag * 4 * u * (1 - u), z0 + (z1 - z0) * u];
    const segs = 14;
    for (let i = 0; i < segs; i++) wire.push(...at(i / segs), ...at((i + 1) / segs));
    const nb = Math.floor(len / 0.85);
    for (let i = 1; i < nb; i++) bulbPos.push(at(i / nb));
  }
  let bulbs = null;
  let wires = null;
  if (bulbPos.length) {
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const uLit = { value: 1 };
    bulbMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.uniforms.uLit = uLit;
      sh.vertexShader = 'uniform float uTime;\nuniform float uLit;\n' + sh.vertexShader.replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        float id = float(gl_InstanceID);
        vColor *= uLit * (0.72 + 0.28 * sin(uTime * (1.3 + mod(id, 7.0) * 0.41) + id * 2.3));`
      );
    };
    bulbMat.customProgramCacheKey = () => 'spookyfx-bulbs';
    bulbs = add(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 0), bulbMat, bulbPos.length));
    const cols = [new THREE.Color('#ff7a12').multiplyScalar(2.6), new THREE.Color('#b04dff').multiplyScalar(2.6)];
    const m = new THREE.Matrix4();
    bulbPos.forEach(([x, y, z], i) => {
      bulbs.setMatrixAt(i, m.makeTranslation(x, y - 0.06, z));
      bulbs.setColorAt(i, cols[i % 2]);
    });
    bulbs.computeBoundingSphere();
    bulbs.name = 'spookyfx-bulbs';
    bulbs.userData.lit = uLit;
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    wires = add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#16111c' })));
    wires.name = 'spookyfx-wires';
  }

  // ---------- the witch's cauldron: a green glow over the soup pot (its bubbles are in the Points) ----------
  const glowTex = blobTexture(1);
  const brew = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#46ff3a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  brew.position.copy(POT).setY(POT.y + 0.35);
  brew.name = 'spookyfx-brew';

  function setQuality(q) {
    low = q === 'low';
    ptGeo.setDrawRange(0, low ? ptsKeep : pts.length);
  }
  setQuality(quality);

  return {
    update(dt, t) {
      const night = env.night;
      uTime.value = t;
      updateBats(t, night);
      updateGhosts(dt, t, night);
      updateFog(t, night);
      ptMat.uniforms.uWisp.value = 0.25 + 0.75 * night;
      if (bulbs) bulbs.userData.lit.value = 0.45 + 0.55 * night;
      const s = 5.5 + Math.sin(t * 2.1) * 0.35 + Math.sin(t * 5.3) * 0.15;
      brew.scale.set(s, s, 1);
      brew.material.opacity = 0.5 + 0.35 * night;
    },
    setQuality,
    dispose() {
      for (const g of ghosts) {
        g.mixer.stopAllAction();
        g.mats.forEach((m) => m.dispose());
      }
      for (const o of objects) {
        scene.remove(o);
        if (o.isMesh || o.isPoints || o.isLine) o.geometry.dispose(); // (sprites share one geometry; ghosts share halloween.glb's)
        if (o.isMesh || o.isPoints || o.isLine || o.isSprite) o.material.dispose();
      }
      fogTex.dispose();
      glowTex.dispose();
    },
  };
}
