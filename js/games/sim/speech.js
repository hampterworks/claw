// Speech bubbles and labels as camera-facing sprites (NPC dialogue, player chat, name tags).
import * as THREE from 'three';

export function labelTexture(lines, { w = 256, h = 64, size = 30, bg = 'rgba(18,4,31,0.78)', color = '#7CFF4F' } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(2, 2, w - 4, h - 4, 14);
  g.fill();
  g.font = `${size}px 'Bangers', Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  const lh = h / (lines.length + 0.2);
  lines.forEach((l, i) => g.fillText(l, w / 2, lh * (i + 0.6), w - 16));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function wrapText(s, max = 26) {
  const lines = [''];
  for (const wd of s.split(/\s+/)) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + wd).trim().length > max && cur) lines.push(wd);
    else lines[lines.length - 1] = (cur + ' ' + wd).trim();
  }
  return lines.slice(0, 3);
}

// A bubble that follows an object. say() replaces the current line.
export function createBubble(scene, { color = '#12041f', bg = 'rgba(255,255,255,0.94)', width = 2.4 } = {}) {
  let sprite = null;
  let life = 0;
  const clear = () => {
    if (!sprite) return;
    scene.remove(sprite);
    sprite.material.map.dispose();
    sprite.material.dispose();
    sprite = null;
  };
  return {
    say(text, seconds = 5) {
      clear();
      const lines = wrapText(text);
      const h = 60 * lines.length + 20;
      sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(lines, { w: 512, h, size: 40, bg, color }), depthTest: false, transparent: true }));
      sprite.scale.set(width, (width * h) / 512, 1);
      sprite.renderOrder = 11;
      scene.add(sprite);
      life = seconds;
    },
    // pos: where the bottom of the bubble should sit
    update(dt, pos) {
      if (!sprite) return;
      life -= dt;
      if (life <= 0) return clear();
      sprite.position.set(pos.x, pos.y + sprite.scale.y / 2, pos.z);
    },
    clear,
  };
}
