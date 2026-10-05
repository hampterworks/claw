// Surface detail for the code-built world: small procedural grayscale textures (brick, stone,
// hedge leaves, planks...) projected by world position on all three axes, so plain boxes need
// no UVs and nothing stretches. They only modulate the existing colour, so every colour in Ohio
// stays the same. Plus a cheap "contact shadow" that darkens surfaces near the ground.
import * as THREE from 'three';

const S = 256;
// shared switches: detail on/off and a cheaper one-sample path (Low graphics)
export const DETAIL = { uDetail: { value: 1 }, uDetailCheap: { value: 0 } };

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return [c, c.getContext('2d')];
}
// small deterministic RNG so textures are identical every visit
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const gray = (v) => {
  const n = Math.max(0, Math.min(255, Math.round(v * 255)));
  return `rgb(${n},${n},${n})`;
};
// draw something so it wraps around the tile edges (seamless)
function wrap(fn) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy);
}
function speckle(g, r, n, lo, hi, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = gray(lo + r() * (hi - lo));
    g.fillRect(Math.floor(r() * S), Math.floor(r() * S), size, size);
  }
}
function blotches(g, r, n, lo, hi, rad) {
  for (let i = 0; i < n; i++) {
    const x = r() * S;
    const y = r() * S;
    const rr = rad * (0.5 + r());
    g.globalAlpha = 0.18;
    g.fillStyle = gray(lo + r() * (hi - lo));
    wrap((dx, dy) => {
      g.beginPath();
      g.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
      g.fill();
    });
  }
  g.globalAlpha = 1;
}

const MAKERS = {
  grain(g, r) {
    g.fillStyle = gray(0.5);
    g.fillRect(0, 0, S, S);
    blotches(g, r, 40, 0.38, 0.62, 30);
    speckle(g, r, 2500, 0.4, 0.6);
  },
  plaster(g, r) {
    MAKERS.grain(g, r);
    blotches(g, r, 30, 0.35, 0.65, 18);
    speckle(g, r, 4000, 0.38, 0.62, 1);
  },
  brick(g, r) {
    g.fillStyle = gray(0.3); // mortar
    g.fillRect(0, 0, S, S);
    const rows = 8;
    const h = S / rows;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * (S / 8);
      for (let x = -1; x < 4; x++) {
        g.fillStyle = gray(0.5 + (r() - 0.5) * 0.18);
        g.fillRect(x * (S / 4) + off + 3, y * h + 3, S / 4 - 6, h - 6);
      }
    }
    speckle(g, r, 3000, 0.35, 0.65);
  },
  stone(g, r) {
    g.fillStyle = gray(0.28);
    g.fillRect(0, 0, S, S);
    const rows = 4;
    const h = S / rows;
    for (let y = 0; y < rows; y++) {
      let x = r() * 40;
      while (x < S + 40) {
        const w = 50 + r() * 60;
        const v = 0.48 + (r() - 0.5) * 0.2;
        wrap((dx) => {
          g.fillStyle = gray(v);
          g.beginPath();
          g.roundRect(x + dx + 3, y * h + 3, w - 6, h - 6, 6);
          g.fill();
        });
        x += w;
      }
    }
    speckle(g, r, 4000, 0.3, 0.7);
  },
  ice(g, r) {
    MAKERS.stone(g, r);
    g.globalAlpha = 0.25;
    g.strokeStyle = gray(0.85);
    g.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const x = r() * S;
      const y = r() * S;
      wrap((dx, dy) => {
        g.beginPath();
        g.moveTo(x + dx, y + dy);
        g.lineTo(x + dx + 20 + r() * 30, y + dy + 10 + r() * 20);
        g.stroke();
      });
    }
    g.globalAlpha = 1;
  },
  marble(g, r) {
    g.fillStyle = gray(0.55);
    g.fillRect(0, 0, S, S);
    blotches(g, r, 20, 0.45, 0.65, 40);
    g.strokeStyle = gray(0.38);
    for (let i = 0; i < 7; i++) {
      g.lineWidth = 1 + r() * 2;
      g.globalAlpha = 0.5;
      const y = r() * S;
      wrap((dx, dy) => {
        g.beginPath();
        g.moveTo(dx - 10, y + dy);
        g.bezierCurveTo(dx + 80, y + dy - 40 + r() * 80, dx + 170, y + dy - 40 + r() * 80, dx + S + 10, y + dy);
        g.stroke();
      });
    }
    g.globalAlpha = 1;
    // slab seams
    g.fillStyle = gray(0.4);
    g.fillRect(0, 0, S, 2);
    g.fillRect(0, 0, 2, S);
  },
  hedge(g, r) {
    g.fillStyle = gray(0.35);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 1400; i++) {
      const x = r() * S;
      const y = r() * S;
      const a = r() * Math.PI;
      const v = 0.3 + r() * 0.5;
      wrap((dx, dy) => {
        g.fillStyle = gray(v);
        g.beginPath();
        g.ellipse(x + dx, y + dy, 6, 3, a, 0, Math.PI * 2);
        g.fill();
      });
    }
  },
  wood(g, r) {
    g.fillStyle = gray(0.5);
    g.fillRect(0, 0, S, S);
    const planks = 6;
    const h = S / planks;
    for (let p = 0; p < planks; p++) {
      g.fillStyle = gray(0.47 + (r() - 0.5) * 0.14);
      g.fillRect(0, p * h + 2, S, h - 4);
      g.strokeStyle = gray(0.38);
      g.globalAlpha = 0.5;
      for (let k = 0; k < 6; k++) {
        const y = p * h + 4 + r() * (h - 8);
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + k) * 1.5);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = gray(0.25);
      g.fillRect(0, p * h, S, 2);
    }
  },
  roof(g, r) {
    g.fillStyle = gray(0.3);
    g.fillRect(0, 0, S, S);
    const rows = 8;
    const h = S / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = -1; x < 9; x++) {
        const cx = x * 32 + (y % 2) * 16;
        g.fillStyle = gray(0.5 + (r() - 0.5) * 0.16);
        g.beginPath();
        g.arc(cx + 16, y * h + 6, 15, 0, Math.PI);
        g.fill();
      }
    }
  },
  asphalt(g, r) {
    g.fillStyle = gray(0.5);
    g.fillRect(0, 0, S, S);
    speckle(g, r, 9000, 0.3, 0.7, 1);
    blotches(g, r, 14, 0.42, 0.58, 30);
  },
  grass(g, r) {
    g.fillStyle = gray(0.5);
    g.fillRect(0, 0, S, S);
    blotches(g, r, 30, 0.4, 0.6, 40);
    g.lineWidth = 1.5;
    for (let i = 0; i < 2600; i++) {
      const x = r() * S;
      const y = r() * S;
      const v = 0.3 + r() * 0.45;
      const dx0 = (r() - 0.5) * 4;
      wrap((dx, dy) => {
        g.strokeStyle = gray(v);
        g.beginPath();
        g.moveTo(x + dx, y + dy);
        g.lineTo(x + dx + dx0, y + dy - 5);
        g.stroke();
      });
    }
  },
  dirt(g, r) {
    g.fillStyle = gray(0.5);
    g.fillRect(0, 0, S, S);
    blotches(g, r, 40, 0.38, 0.62, 24);
    speckle(g, r, 5000, 0.35, 0.65, 2);
    for (let i = 0; i < 70; i++) {
      const x = r() * S;
      const y = r() * S;
      const v = 0.55 + r() * 0.25;
      wrap((dx, dy) => {
        g.fillStyle = gray(v);
        g.beginPath();
        g.ellipse(x + dx, y + dy, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, Math.PI * 2);
        g.fill();
      });
    }
  },
};

// metres covered by one tile, and how strong the effect is
export const KINDS = {
  grain: { size: 3, strength: 0.18 },
  plaster: { size: 2.5, strength: 0.3 },
  brick: { size: 1.8, strength: 0.55 },
  stone: { size: 3.2, strength: 0.6 },
  ice: { size: 3.2, strength: 0.4 },
  marble: { size: 3, strength: 0.3 },
  hedge: { size: 1.6, strength: 0.75 },
  wood: { size: 1.5, strength: 0.45 },
  roof: { size: 1.6, strength: 0.5 },
  asphalt: { size: 2.5, strength: 0.35 },
  grass: { size: 2.2, strength: 0.32 },
  dirt: { size: 2.0, strength: 0.4 },
};

const textures = new Map();
function texture(kind) {
  let t = textures.get(kind);
  if (t) return t;
  const [c, g] = canvas();
  MAKERS[kind](g, rng(1000 + Object.keys(KINDS).indexOf(kind) * 77));
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  textures.set(kind, t);
  return t;
}

// Patch a MeshStandardMaterial. ao: how much darker surfaces get right at ground level (0..1).
export function applyDetail(material, kind = 'grain', { ao = 0.35, aoHeight = 1.1, strength } = {}) {
  const k = KINDS[kind] || KINDS.grain;
  const uniforms = {
    detailMap: { value: texture(kind) },
    uDetailScale: { value: 1 / k.size },
    uDetailStrength: { value: strength ?? k.strength },
    uAo: { value: ao },
    uAoHeight: { value: aoHeight },
  };
  material.userData.detail = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, DETAIL);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDetailPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 dw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            dw = instanceMatrix * dw;
          #endif
          vDetailPos = (modelMatrix * dw).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDetailPos;
        uniform sampler2D detailMap;
        uniform float uDetail, uDetailCheap, uDetailScale, uDetailStrength, uAo, uAoHeight;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (uDetail > 0.0) {
          // face direction from screen-space derivatives (many meshes here have no normals: flat shaded)
          vec3 dn = abs(normalize(cross(dFdx(vDetailPos), dFdy(vDetailPos)) + vec3(0.0, 1e-6, 0.0)));
          vec3 dp = vDetailPos * uDetailScale;
          float d;
          if (uDetailCheap > 0.5) {
            d = dn.y > max(dn.x, dn.z) ? texture2D(detailMap, dp.xz).r : (dn.x > dn.z ? texture2D(detailMap, dp.zy).r : texture2D(detailMap, dp.xy).r);
          } else {
            vec3 w = pow(dn, vec3(4.0));
            w /= (w.x + w.y + w.z);
            d = texture2D(detailMap, dp.zy).r * w.x + texture2D(detailMap, dp.xz).r * w.y + texture2D(detailMap, dp.xy).r * w.z;
          }
          diffuseColor.rgb *= 1.0 + (d - 0.5) * 2.0 * uDetailStrength * uDetail;
          // contact shadow: a little darker where things meet the ground
          // (walls and sides only: floors and roads lying on the ground stay as they are)
          float ao = smoothstep(0.0, uAoHeight, vDetailPos.y);
          diffuseColor.rgb *= mix(1.0 - uAo * uDetail * (1.0 - dn.y), 1.0, ao);
        }`
      );
  };
  material.customProgramCacheKey = () => 'detail-v2';
  material.needsUpdate = true;
  return material;
}

// Re-upload every detail texture. Called once after the loading-screen shader warm-up: a texture
// uploaded during that warm-up can come out corrupted on some GPUs (it rendered black).
export function refreshDetailTextures() {
  for (const t of textures.values()) t.needsUpdate = true;
}

export function setDetailQuality(q) {
  DETAIL.uDetail.value = 1;
  DETAIL.uDetailCheap.value = q === 'low' ? 1 : 0;
}
