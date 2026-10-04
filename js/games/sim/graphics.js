// Visual polish: gradient sky with a sun, filmic tone mapping, bloom,
// color grade + vignette, FXAA, rim light on Claw, wind on foliage, swirly soup.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// Shared clock for every animated shader.
export const uTime = { value: 0 };

export function createSky(scene, sunDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#2f7fe0') },
      horizon: { value: new THREE.Color('#c4ecff') },
      bottom: { value: new THREE.Color('#e8f7ff') },
      sunDir: { value: sunDir.clone().normalize() },
      sunColor: { value: new THREE.Color('#fff2c4') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, horizon, bottom, sunDir, sunColor;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.4));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.12);
        col += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // dither away banding
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  return sky;
}

// Gentle sway for leaves, grass and corn. Taller parts move more.
export function applyWind(material, strength = 0.03) {
  if (material.userData.wind) return;
  material.userData.wind = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        float h = max(transformed.y, 0.0);
        float w = sin(uTime * 1.8 + wp.x * 0.35 + wp.z * 0.27) + 0.4 * sin(uTime * 3.7 + wp.x * 1.3);
        transformed.x += w * h * ${strength.toFixed(4)};
        transformed.z += w * h * ${(strength * 0.6).toFixed(4)};
      }`
    );
  };
  material.customProgramCacheKey = () => 'wind' + strength;
  material.needsUpdate = true;
}

// Fresnel rim glow so Claw pops against the scenery.
export function applyRim(material, color = '#9dff6a', power = 2.5, intensity = 0.9) {
  const rimColor = new THREE.Color(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: rimColor };
    shader.fragmentShader = 'uniform vec3 rimColor;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        float rim = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
        totalEmissiveRadiance += rimColor * pow(rim, ${power.toFixed(2)}) * ${intensity.toFixed(2)};
      }`
    );
  };
  material.customProgramCacheKey = () => 'rim' + color + power + intensity;
  material.needsUpdate = true;
}

// Bubbling, swirling soup surface (bright enough to bloom).
export function soupMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float swirl = sin(a * 3.0 + r * 9.0 - uTime * 2.2) * 0.5 + 0.5;
        float waves = sin(p.x * 11.0 + uTime * 1.7) * sin(p.y * 13.0 - uTime * 1.3) * 0.5 + 0.5;
        vec3 deep = vec3(0.95, 0.32, 0.05);
        vec3 hot = vec3(1.0, 0.72, 0.18);
        vec3 col = mix(deep, hot, swirl * 0.6 + waves * 0.4);
        col += vec3(1.0, 0.85, 0.5) * smoothstep(0.82, 1.0, waves) * 0.8;
        col *= 1.0 - smoothstep(0.85, 1.0, r) * 0.45;
        gl_FragColor = vec4(col * 1.35, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.18 },
    contrast: { value: 1.06 },
    vignette: { value: 0.32 },
    tint: { value: new THREE.Vector3(1.02, 1.0, 0.97) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation, contrast, vignette;
    uniform vec3 tint;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * tint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      float v = smoothstep(0.85, 0.25, distance(vUv, vec2(0.5)) * 1.1);
      col *= mix(1.0 - vignette, 1.0, v);
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};

// quality: 'high' (post-processing) or 'low' (direct render, no shadows).
export function createGraphics(renderer, scene, camera) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.85);
  composer.addPass(bloom);
  // Grade in linear HDR space, then OutputPass tone maps + converts to sRGB.
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  const fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);

  let quality = 'high';
  let w = 1;
  let h = 1;

  return {
    get quality() {
      return quality;
    },
    setQuality(q) {
      quality = q;
      renderer.shadowMap.enabled = q === 'high';
      scene.traverse((o) => {
        if (o.isDirectionalLight) o.castShadow = q === 'high';
        if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
      });
    },
    setSize(width, height) {
      w = width;
      h = height;
      const pr = renderer.getPixelRatio();
      composer.setPixelRatio(pr);
      composer.setSize(width, height);
      bloom.resolution.set(width / 2, height / 2);
      fxaa.material.uniforms.resolution.value.set(1 / (width * pr), 1 / (height * pr));
    },
    render(t) {
      uTime.value = t;
      if (quality === 'high') composer.render();
      else renderer.render(scene, camera);
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
    },
  };
}
