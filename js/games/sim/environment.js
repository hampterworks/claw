// Time of day and weather. One clock for everyone (wall time, plus the server offset when
// online), so all players share the same sunset and the same rain without any server work.
// A day is 24 minutes: dawn, ~17 min of day, dusk, ~3.5 min of night. Owns the sky colours, fog
// colour, sun/moon light, hemisphere light and exposure; the kaiju battle blends its storm on top.
import * as THREE from 'three';
import { WATER_LIGHT } from './graphics.js';

export const DAY_LEN = 24 * 60; // seconds
const SLOT = 6 * 60; // weather changes every 6 minutes
const SUN_END = 0.85; // the sun is up from phase 0 (dawn) to here; the moon has the rest (~3.6 min)
const C = (h) => new THREE.Color(h);
const LOOKS = {
  day: { top: C('#2f7fe0'), horizon: C('#c4ecff'), bottom: C('#e8f7ff'), fog: C('#c4ecff'), sun: C('#fff6dd'), sunI: 2.4, hemiSky: C('#e6f6ff'), hemiGround: C('#4f7a2f'), hemiI: 1.5, glow: C('#fff2c4') },
  gold: { top: C('#3a5fb0'), horizon: C('#ffb37a'), bottom: C('#ffd9b0'), fog: C('#f2b48a'), sun: C('#ffae66'), sunI: 1.9, hemiSky: C('#ffd2b8'), hemiGround: C('#5a5a32'), hemiI: 1.25, glow: C('#ffb36b') },
  night: { top: C('#060c2a'), horizon: C('#24366a'), bottom: C('#101a3a'), fog: C('#22325c'), sun: C('#aabfff'), sunI: 0.85, hemiSky: C('#5466a8'), hemiGround: C('#222a3c'), hemiI: 1.0, glow: C('#c9d6ff') },
  rain: { top: C('#59677a'), horizon: C('#9aa6b2'), bottom: C('#b3bcc4'), fog: C('#8f99a4') },
  storm: { top: C('#2a0f3d'), horizon: C('#7a3a5a'), bottom: C('#3a2030'), fog: C('#5a3550') },
};

function hash(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function moonTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  grad.addColorStop(0, 'rgba(230,236,255,0.9)');
  grad.addColorStop(0.45, 'rgba(200,215,255,0.25)');
  grad.addColorStop(1, 'rgba(200,215,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f2f4ff';
  g.beginPath();
  g.arc(64, 64, 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(160,170,200,0.5)';
  for (const [x, y, r] of [[56, 58, 5], [72, 70, 4], [66, 52, 3]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// falling stuff: streaks (rain) or flakes (snow), wrapped around a centre in the vertex shader
function makeFall({ count, size, speed, color, snow }) {
  const geo = new THREE.BufferGeometry();
  const n = snow ? count : count * 2;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size.x;
    const y = Math.random() * size.y;
    const z = Math.random() * size.z;
    if (snow) pos.set([x, y, z], i * 3);
    else {
      pos.set([x, y, z], i * 6);
      pos.set([x + 0.08, y + 0.9, z + 0.05], i * 6 + 3); // streak top
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSize: { value: size }, uSpeed: { value: speed }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      uniform float uTime, uSpeed;
      uniform vec3 uCenter, uSize;
      varying float vFade;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * uSpeed, uSize.y);
        ${snow ? 'p.x += sin(uTime * 0.8 + position.y * 1.7) * 0.6; p.z += cos(uTime * 0.6 + position.x) * 0.6;' : ''}
        // wrap the box around the centre so it always surrounds it
        vec3 base = uCenter - uSize * 0.5;
        vec3 w = mod(p - base, uSize) + base;
        vFade = 1.0 - abs((w.y - uCenter.y) / (uSize.y * 0.5));
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = ${snow ? 'clamp(2.5 * (40.0 / -mv.z), 1.0, 4.0)' : '1.0'};
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        ${snow ? 'vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard;' : ''}
        gl_FragColor = vec4(uColor, uOpacity * clamp(vFade * 2.0, 0.0, 1.0));
      }`,
  });
  const obj = snow ? new THREE.Points(geo, mat) : new THREE.LineSegments(geo, mat);
  obj.frustumCulled = false;
  obj.renderOrder = 5;
  return obj;
}

export function createEnvironment({ scene, renderer, sky, sun, camera, claw, lampSets = [], fireflyAt = [], glowSpots = [], snowAt, quality = 'high', looks = null }) {
  // seasonal sky colours (spooky.js) override the defaults for this page load
  if (looks) for (const [k, cols] of Object.entries(looks)) for (const [key, v] of Object.entries(cols)) LOOKS[k][key] = C(v);
  // Signs, posters and character cut-outs are unlit (MeshBasic / Sprite), so at night they would
  // glow like neon. Dim them with the light. Real neon has an over-bright colour (> 1): left alone.
  const unlit = [];
  scene.traverse((o) => {
    const m = o.material;
    if (!m || Array.isArray(m) || !(m.isMeshBasicMaterial || m.isSpriteMaterial) || !m.map) return;
    if (m.blending === THREE.AdditiveBlending || Math.max(m.color.r, m.color.g, m.color.b) > 1.001) return;
    if (!unlit.some((u) => u.m === m)) unlit.push({ m, base: m.color.clone() });
  });
  const hemi = (() => {
    let h = null;
    scene.traverse((o) => o.isHemisphereLight && (h = o));
    return h;
  })();
  const u = sky.material.uniforms;
  const st = { offset: 0, forced: null, forcedWeather: null, rainK: 0, storm: 0, flash: 0, nextBolt: 8, night: 0, weather: 'clear' };
  const sunOffset = new THREE.Vector3(14, 26, 9);

  // stars + moon ride along with the camera
  const sky2 = new THREE.Group();
  {
    const N = 700;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(195);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    st.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    st.stars.renderOrder = -0.5;
    st.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false }));
    st.moon.scale.set(34, 34, 1);
    sky2.add(st.stars, st.moon);
    sky2.frustumCulled = false;
    st.stars.frustumCulled = false;
    scene.add(sky2);
  }
  // lamp pools on the ground + glows at landmarks (additive, night only)
  const gtex = glowTexture();
  const pools = [];
  const poolMat = new THREE.MeshBasicMaterial({ map: gtex, color: '#ffcf7a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const allLamps = lampSets.filter(Boolean).flatMap((l) => l.positions || []);
  if (allLamps.length) {
    const pm = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), poolMat, allLamps.length);
    const m = new THREE.Matrix4();
    allLamps.forEach(([x, z], i) => pm.setMatrixAt(i, m.makeTranslation(x, 0.06, z)));
    pm.computeBoundingSphere();
    scene.add(pm);
    pools.push(pm);
  }
  // Claw's lantern: a soft warm light that follows you at night
  const lantern = new THREE.PointLight('#ffd9a0', 0, 11, 1.6);
  scene.add(lantern);
  // fireflies in the parks
  const flies = (() => {
    if (!fireflyAt.length) return null;
    const per = 40;
    const pos = new Float32Array(fireflyAt.length * per * 3);
    let k = 0;
    for (const [cx, cz, r] of fireflyAt) {
      for (let i = 0; i < per; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r;
        pos.set([cx + Math.cos(a) * d, 0.5 + Math.random() * 2.5, cz + Math.sin(a) * d], k++ * 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying float vBlink;
        void main() {
          vec3 p = position;
          float s = position.x * 0.37 + position.z * 0.53;
          p += vec3(sin(uTime * 0.7 + s), sin(uTime * 1.1 + s * 2.0) * 0.4, cos(uTime * 0.6 + s)) * 0.8;
          vBlink = 0.5 + 0.5 * sin(uTime * 3.0 + s * 5.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(3.0 * (30.0 / -mv.z), 1.5, 6.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vBlink;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = 1.0 - smoothstep(0.0, 0.5, length(c));
          gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * d, d * uOpacity * vBlink);
        }`,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  })();
  const glows = glowSpots.map(({ x, y, z, color = '#ffb36b', size = 4 }) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    scene.add(s);
    return s;
  });
  const bulbs = lampSets.filter((l) => l?.bulb).map((l) => ({ mat: l.bulb.material, base: l.bulb.material.color.clone() }));

  // weather particles
  const lowQ = () => quality === 'low';
  const rain = makeFall({ count: 1400, size: new THREE.Vector3(46, 26, 46), speed: 24, color: '#c9d6e6' });
  scene.add(rain);
  const snow = snowAt ? makeFall({ count: 900, size: new THREE.Vector3(56, 18, 56), speed: 1.4, color: '#ffffff', snow: true }) : null;
  if (snow) {
    snow.material.uniforms.uCenter.value.set(snowAt.x, 8, snowAt.z);
    scene.add(snow);
  }

  const now = () => Date.now() / 1000 + st.offset;
  // 0..1 through the day; 0 = dawn begins
  const phase = () => (st.forced != null ? st.forced : ((now() % DAY_LEN) + DAY_LEN) % DAY_LEN / DAY_LEN);
  function weatherAt(t) {
    if (st.forcedWeather) return st.forcedWeather;
    return hash(Math.floor(t / SLOT)) < 0.2 ? 'rain' : 'clear';
  }

  const col = new THREE.Color();
  const tmp = new THREE.Color();
  function mix3(key, L, G, R, K) {
    col.copy(LOOKS.night[key]).lerp(LOOKS.day[key], L);
    if (LOOKS.gold[key]) col.lerp(LOOKS.gold[key], G);
    if (LOOKS.rain[key]) col.lerp(tmp.copy(LOOKS.rain[key]).multiplyScalar(0.25 + 0.75 * L), R * 0.75);
    if (LOOKS.storm[key]) col.lerp(LOOKS.storm[key], K);
    return col;
  }

  return {
    get sunOffset() {
      return sunOffset;
    },
    get night() {
      return st.night; // 0 day .. 1 full night
    },
    get isNight() {
      return st.night > 0.6;
    },
    get weather() {
      return st.weather;
    },
    get raining() {
      return st.rainK > 0.5;
    },
    set storm(k) {
      st.storm = k;
    },
    setClaw(c) {
      claw = c;
    },
    setServerOffset(ms) {
      st.offset = ms / 1000;
    },
    setQuality(q) {
      quality = q;
    },
    // debug: force a time of day (0..1, 0 = dawn, 0.42 = noon, 0.82 = dusk, 0.93 = night) or weather
    setTime(f) {
      st.forced = f;
    },
    setWeather(w) {
      st.forcedWeather = w;
    },
    update(dt, t) {
      const g = phase();
      // the sun: up from dawn (g=0) to the end of dusk (g=SUN_END), the moon the rest of the time
      const sp = Math.min(1, g / SUN_END);
      const elev = g < SUN_END ? Math.sin(sp * Math.PI) : -Math.sin(((g - SUN_END) / (1 - SUN_END)) * Math.PI) * 0.6;
      const L = THREE.MathUtils.smoothstep(elev, -0.05, 0.22);
      const G = L * (1 - THREE.MathUtils.smoothstep(elev, 0.08, 0.42));
      st.night = 1 - L;
      // weather (eased)
      st.weather = weatherAt(now());
      const wantRain = st.weather === 'rain' ? 1 : 0;
      st.rainK += (wantRain - st.rainK) * Math.min(1, dt * 0.25);
      const R = st.rainK;
      const K = st.storm;
      // sky + fog
      u.top.value.copy(mix3('top', L, G, R, K));
      u.horizon.value.copy(mix3('horizon', L, G, R, K));
      u.bottom.value.copy(mix3('bottom', L, G, R, K));
      scene.fog.color.copy(mix3('fog', L, G, R, K));
      if (scene.background?.isColor) scene.background.copy(scene.fog.color);
      // sun (by day) or moon (by night) as the one shadow-casting light
      if (L > 0.02) {
        const a = sp * Math.PI;
        sunOffset.set(-Math.cos(a) * 26, 6 + Math.max(0, elev) * 24, 9);
      } else {
        const q = (g - SUN_END) / (1 - SUN_END);
        sunOffset.set(Math.cos(q * Math.PI) * 18, 24, -12);
      }
      const sunCol = mix3('sun', L, G, 0, 0);
      sun.color.copy(sunCol);
      sun.intensity = THREE.MathUtils.lerp(LOOKS.night.sunI, LOOKS.day.sunI, L) * (1 - 0.15 * G) * (1 - 0.55 * R) * (1 - 0.45 * K);
      u.sunDir.value.copy(sunOffset).normalize();
      u.sunColor.value.copy(sunCol).multiplyScalar(L * (1 - R) * (1 - K));
      if (hemi) {
        hemi.color.copy(mix3('hemiSky', L, G, 0, 0));
        hemi.groundColor.copy(mix3('hemiGround', L, G, 0, 0));
        hemi.intensity = THREE.MathUtils.lerp(LOOKS.night.hemiI, LOOKS.day.hemiI, L) * (1 - 0.25 * R);
      }
      // lightning in rainy nights
      st.flash = Math.max(0, st.flash - dt * 4);
      if (R > 0.7 && st.night > 0.5) {
        st.nextBolt -= dt;
        if (st.nextBolt <= 0) {
          st.nextBolt = 12 + Math.random() * 20;
          st.flash = 1;
        }
      }
      renderer.toneMappingExposure = 1.05 + st.flash * 1.8;
      // stars, moon, lamps, glows
      sky2.position.copy(camera.position);
      const starK = THREE.MathUtils.smoothstep(st.night, 0.4, 0.9) * (1 - R) * (1 - K);
      st.stars.material.opacity = starK;
      st.stars.visible = starK > 0.01;
      st.moon.material.opacity = starK;
      st.moon.visible = starK > 0.01;
      st.moon.position.set(-sunOffset.x, Math.max(30, sunOffset.y * 3), -sunOffset.z).normalize().multiplyScalar(170);
      const lampK = THREE.MathUtils.smoothstep(st.night, 0.25, 0.75);
      poolMat.opacity = lampK * 0.55;
      for (const p of pools) p.visible = lampK > 0.01;
      for (const s of glows) {
        s.material.opacity = lampK * 0.45;
        s.visible = lampK > 0.01;
      }
      for (const b of bulbs) b.mat.color.copy(b.base).multiplyScalar(0.6 + lampK * 1.2);
      const dim = 1 - 0.62 * THREE.MathUtils.smoothstep(st.night, 0.15, 0.85);
      if (dim !== st.dim) {
        st.dim = dim;
        for (const u of unlit) u.m.color.copy(u.base).multiplyScalar(dim);
        WATER_LIGHT.value = 0.3 + 0.7 * dim;
      }
      if (claw) {
        const p = claw.position();
        lantern.position.set(p.x, p.y + 1.4, p.z);
        lantern.intensity = lampK * 9;
        lantern.visible = lampK > 0.01;
      }
      if (flies) {
        flies.material.uniforms.uTime.value = t;
        flies.material.uniforms.uOpacity.value = lampK * (1 - R);
        flies.visible = lampK > 0.01 && R < 0.9;
      }
      // rain follows the camera; snow is always on at Winter's Castle
      rain.visible = R > 0.02;
      rain.material.uniforms.uOpacity.value = R * 0.75;
      rain.material.uniforms.uTime.value = t;
      rain.material.uniforms.uCenter.value.copy(camera.position);
      rain.material.uniforms.uSpeed.value = 24;
      rain.geometry.setDrawRange(0, lowQ() ? 1000 : Infinity);
      if (snow) {
        const d = Math.hypot(camera.position.x - snowAt.x, camera.position.z - snowAt.z);
        const k = 1 - THREE.MathUtils.smoothstep(d, 40, 70);
        snow.visible = k > 0.01;
        snow.material.uniforms.uOpacity.value = k * 0.9;
        snow.material.uniforms.uTime.value = t;
        snow.geometry.setDrawRange(0, lowQ() ? 450 : Infinity);
      }
    },
    dispose() {
      scene.remove(sky2, rain, lantern, ...pools, ...glows);
      if (flies) scene.remove(flies);
      if (snow) scene.remove(snow);
      renderer.toneMappingExposure = 1.05;
    },
  };
}
