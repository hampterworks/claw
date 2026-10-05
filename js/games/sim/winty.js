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
const COLLECT = ['ROMNI SENT ME. PAY UP.', 'you owe the bank, glorp', 'I have a castle. it has a dungeon.', 'interest is compounding, babe', 'running only makes it worse', 'debt collection is my side hustle'];
const FLEE = ['NOT THE DUCK', 'AAAAA DUCKY', 'Romni said you were cool!!', "I'm telling Clicky (he quit)", 'keep that bird AWAY from me', 'my castle has a NO DUCKS policy', 'ok ok no fent for you, sorry!!'];
const CROWN = ['MY CROWN!!!', 'GIVE IT BACK', 'that is a FAMILY HEIRLOOM (I bought it)', 'thief!! THIEF!!', 'Romni will hear about this', 'I KNOW WHO SENT YOU. IT WAS THE DUCK.'];
const COLLECT_SPEED = 7.4;
const CROWN_SPEED = 5.4; // a bit faster than walking: zoomies or jumps keep you ahead
const CROWN_GIVE_UP = 22; // seconds of cardio before she gives up
const FLEE_SPEED = 6.5; // faster than walking, slower than zoomies (which run out)
const CHASE_TIME = 10;
const SPEED = 4.3; // a bit slower than Claw's walk (4.8), way slower than zoomies

export function createWinty({ scene, texture, hud, sfx, ch, onOutran, bounds = 125 }) {
  // slightly dimmed so her white outfit stays under the bloom threshold (no ghostly glow)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: new THREE.Color(0.78, 0.78, 0.78) }));
  sprite.center.set(0.5, 0);
  const H = 2.1;
  sprite.scale.set((H * texture.image.width) / texture.image.height, H, 1);
  sprite.position.copy(WINTY_HOME);
  scene.add(sprite);

  const st = {
    mode: 'idle', // idle | chase | home | collect
    t: 0,
    cd: 0,
    lineT: 0,
    caughtCd: 0,
    lines: [],
    scared: false, // Ducky Mode: she runs from Claw
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
    // debt collection: she shows up ~22 m away and doesn't give up until she catches you
    collect(claw, onCatch) {
      const p = claw.position();
      const a = Math.random() * Math.PI * 2;
      pos.set(p.x + Math.cos(a) * 22, 0, p.z + Math.sin(a) * 22);
      st.mode = 'collect';
      st.onCatch = onCatch;
      st.lineT = 0;
      say(COLLECT[0], 4);
      sfx.mrrp();
    },
    stopCollect(reason) {
      if (st.mode !== 'collect') return;
      st.mode = 'home';
      st.cd = 20;
      say(reason === 'ducky' ? '...is that DUCKY? never mind. NEVER MIND.' : '...fine. you paid. this time.', 4);
    },
    // Ducky's quest: Claw stole her crown. She shows up nearby and chases until she catches you or gets tired.
    chaseCrown(claw, onCatch) {
      const p = claw.position();
      const a = Math.random() * Math.PI * 2;
      pos.set(p.x + Math.cos(a) * 14, 0, p.z + Math.sin(a) * 14);
      st.mode = 'crown';
      st.onCatch = onCatch;
      st.t = 0;
      st.lineT = 0;
      say(CROWN[0], 3);
      sfx.mrrp();
    },
    stopChase() {
      if (st.mode !== 'crown') return;
      st.mode = 'home';
      st.cd = 20;
      say('NOT THE DUCK. ANYONE BUT THE DUCK.', 4);
    },
    setScared(on) {
      st.scared = !!on;
      if (st.scared && st.mode === 'chase') st.mode = 'home';
    },
    update(dt, t, claw) {
      const p = claw.position();
      const dist = Math.hypot(p.x - pos.x, p.z - pos.z);
      st.cd -= dt;
      st.caughtCd -= dt;
      // Ducky Mode: she wants nothing to do with you (or your bodyguard)
      if (st.scared && st.mode !== 'flee' && st.mode !== 'crown' && dist < 12) {
        if (st.mode === 'collect') this.stopCollect('ducky');
        st.mode = 'flee';
        st.lineT = 0;
      }
      if (st.mode === 'flee') {
        if (dist > 22 || !st.scared) {
          st.mode = 'home';
          st.cd = 8;
        } else {
          dir.set(pos.x - p.x, 0, pos.z - p.z);
          if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
          dir.normalize();
          pos.addScaledVector(dir, FLEE_SPEED * dt);
          // cornered at the edge of the map: slide along it
          pos.x = THREE.MathUtils.clamp(pos.x, -bounds, bounds);
          pos.z = THREE.MathUtils.clamp(pos.z, -bounds, bounds);
        }
        pos.y = Math.abs(Math.sin(t * 13)) * 0.3;
        sprite.material.rotation = Math.sin(t * 13) * 0.16;
        st.lineT -= dt;
        if (st.lineT <= 0) {
          st.lineT = 2.6;
          say(FLEE[Math.floor(Math.random() * FLEE.length)], 3);
        }
        return;
      }
      if (st.mode === 'crown') {
        st.t += dt;
        if (dist > 0.01) {
          dir.set(p.x - pos.x, 0, p.z - pos.z).normalize();
          pos.addScaledVector(dir, Math.min(dist, CROWN_SPEED * dt));
        }
        pos.y = Math.abs(Math.sin(t * 11)) * 0.25;
        sprite.material.rotation = Math.sin(t * 11) * 0.12;
        st.lineT -= dt;
        if (st.lineT <= 0) {
          st.lineT = 2.8;
          say(CROWN[1 + Math.floor(Math.random() * (CROWN.length - 1))], 3);
        }
        if (dist < 1.3 && Math.abs(p.y - pos.y) < 2.5) {
          st.mode = 'home';
          st.cd = 20;
          say('MINE. back on the throne it goes.', 3.5);
          st.onCatch?.();
        } else if (st.t > CROWN_GIVE_UP) {
          st.mode = 'home';
          st.cd = 20;
          say("ugh. cardio. keep it, I'll buy another one", 4);
        }
        return;
      }
      if (st.mode === 'collect') {
        if (dist > 0.01) {
          dir.set(p.x - pos.x, 0, p.z - pos.z).normalize();
          pos.addScaledVector(dir, Math.min(dist, COLLECT_SPEED * dt));
        }
        pos.y = Math.abs(Math.sin(t * 11)) * 0.25;
        sprite.material.rotation = Math.sin(t * 11) * 0.12;
        st.lineT -= dt;
        if (st.lineT <= 0) {
          st.lineT = 3;
          say(COLLECT[1 + Math.floor(Math.random() * (COLLECT.length - 1))], 4);
        }
        if (dist < 1.3 && Math.abs(p.y - pos.y) < 2.5) {
          st.mode = 'home';
          st.cd = 30;
          pos.copy(WINTY_HOME); // she drops you off and heads back to the park
          st.onCatch?.();
        }
        return;
      }

      if (st.mode === 'idle') {
        pos.y = Math.abs(Math.sin(t * 2)) * 0.05;
        sprite.material.rotation = Math.sin(t * 1.5) * 0.04;
        if (dist < 3.6 && st.cd <= 0 && !st.scared) {
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
          onOutran?.();
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
