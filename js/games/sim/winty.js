// Ms Winter (Winty): hangs around the park with a "business opportunity".
// Talk to her and she follows Claw for a while, pitching. Outrun her to
// complete "Just say no". She's a billboard sprite that glides along the ground.
import * as THREE from 'three';

export const WINTY_HOME = new THREE.Vector3(-1, 0, 13);

const PITCH = [
  'psst... hey. wanna buy some fent?',
  "first one's free 😉",
  "it's fent-astic, trust",
  'I accept Glorp Coins',
  'Matt already bought some',
  'bro come back',
  'claw ur so boring',
  "it's basically catnip (it is not)",
  'family discount!!',
  'WAIT. bulk pricing',
];
const GIVE_UP = ['fine. ur loss', "whatever. I'll ask Matt", 'nobody appreciates small businesses'];
const CHASE_TIME = 10;
const SPEED = 4.3; // a bit slower than Claw's walk (4.8), way slower than zoomies

export function createWinty({ scene, texture, hud, sfx, ch }) {
  // slightly dimmed so her white outfit stays under the bloom threshold (no ghostly glow)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: new THREE.Color(0.78, 0.78, 0.78) }));
  sprite.center.set(0.5, 0);
  const H = 2.1;
  sprite.scale.set((H * texture.image.width) / texture.image.height, H, 1);
  sprite.position.copy(WINTY_HOME);
  scene.add(sprite);

  const st = {
    mode: 'idle', // idle | chase | home
    t: 0,
    cd: 0,
    lineT: 0,
    caughtCd: 0,
    lines: [],
  };
  const pos = sprite.position;
  const dir = new THREE.Vector3();
  // her lines go in the subtitle bar at the bottom, so HUD banners never cover them
  function say(text, seconds = 6) {
    hud.say('WINTY', text, { color: '#ff6a8a', ms: seconds * 1000 });
  }

  function nextLine() {
    if (!st.lines.length) st.lines = PITCH.slice(1).sort(() => Math.random() - 0.5);
    return st.lines.pop();
  }

  return {
    sprite,
    get mode() {
      return st.mode;
    },
    update(dt, t, claw) {
      const p = claw.position();
      const dist = Math.hypot(p.x - pos.x, p.z - pos.z);
      st.cd -= dt;
      st.caughtCd -= dt;

      if (st.mode === 'idle') {
        pos.y = Math.abs(Math.sin(t * 2)) * 0.05;
        sprite.material.rotation = Math.sin(t * 1.5) * 0.04;
        if (dist < 3.6 && st.cd <= 0) {
          st.mode = 'chase';
          st.t = 0;
          st.lineT = 2.2;
          say(PITCH[0]);
          sfx.mrrp();
        }
      } else if (st.mode === 'chase') {
        st.t += dt;
        st.lineT -= dt;
        if (dist > 1.4) {
          dir.set(p.x - pos.x, 0, p.z - pos.z).normalize();
          pos.addScaledVector(dir, SPEED * dt);
        }
        // hurried little hop + lean
        pos.y = Math.abs(Math.sin(t * 9)) * 0.22;
        sprite.material.rotation = Math.sin(t * 9) * 0.1;
        if (st.lineT <= 0) {
          st.lineT = 2.2;
          say(nextLine());
        }
        if (dist < 1.5 && st.caughtCd <= 0) {
          st.caughtCd = 3;
          hud.popup('SHE SLIPPED A FLYER IN YOUR FUR', '#ffe14d');
          // a little shove away, Claw is not interested
          const v = claw.body.linvel();
          claw.body.setLinvel({ x: v.x + (p.x - pos.x) * 4, y: 4, z: v.z + (p.z - pos.z) * 4 }, true);
        }
        if (dist > 16) {
          // outran her
          st.mode = 'home';
          st.cd = 25;
          say('WAIT. come back!!', 3);
          sfx.ding();
          if (!ch.isDone('winty')) ch.chaos(250, 'JUST SAID NO', '#7CFF4F');
          ch.complete('winty');
        } else if (st.t > CHASE_TIME) {
          st.mode = 'home';
          st.cd = 25;
          say(GIVE_UP[Math.floor(Math.random() * GIVE_UP.length)], 3.5);
        }
      } else if (st.mode === 'home') {
        const dh = Math.hypot(WINTY_HOME.x - pos.x, WINTY_HOME.z - pos.z);
        if (dh < 0.3) {
          st.mode = 'idle';
        } else {
          dir.set(WINTY_HOME.x - pos.x, 0, WINTY_HOME.z - pos.z).normalize();
          pos.addScaledVector(dir, Math.min(dh, 2.5 * dt));
          pos.y = Math.abs(Math.sin(t * 5)) * 0.08;
          sprite.material.rotation = Math.sin(t * 5) * 0.05;
        }
      }
    },
    dispose() {
      scene.remove(sprite);
      sprite.material.dispose();
    },
  };
}
