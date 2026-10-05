# We Will Boil The Claw 🍲

A brainrot cat-meme arcade for our friend **deathclaw1551** (aka Claw, the green cat).

Everything in it is a cat meme. Claw is played by his own pictures; the supporting cast
(Popcat, Maxwell, OIIA Cat, Nyan Cat, Banana Cat, Huh Cat, Smudge, Grumpy Cat, Happy Happy Cat)
is drawn in code.

## Games

| Game | How to play |
| --- | --- |
| **Boil the Claw** (main event) | Keep the heat in the green zone to fill the Boil-o-meter. Tap low on the screen (or Space) to stoke the fire. Tap Claw when he jumps out. Tap floating meme cats to season the soup (not Grumpy Cat). 3 pots: Kitchen, Witch Cauldron, Ohio Volcano. |
| **Flappy Glorp** | Tap / Space to flap alien Claw through towers of spinning Maxwells. Grab Nyan Cat for bonus points. Don't fall in the soup. |
| **Dunk-a-Claw** | Whack-a-mole with pots. Dunk Claw, spare Banana Cat, Huh Cat and Smudge. 30 seconds. |
| **Claw Simulator** (3D, `glorp/`) | Goat-Simulator-style open world. WASD + mouse (or touch controls): knock things over, finish Claw-lenges, play the Glorp Casino, fish, collect pets, help Vash. "← Arcade" (or the pause menu) goes back to the hub. |
| **Aura Farmer** | Clicker. Tap Claw for aura, hire meme cats to farm it for you. Saves on your device. |

High scores, the "boiled" counter and Aura Farmer progress live in `localStorage` (per device, per browser).

## Run it locally

No build step and no npm. Any static server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.)

## Publish on GitHub Pages (free)

1. Merge this into `main`.
2. Repo **Settings → Pages**.
3. **Source:** Deploy from a branch. **Branch:** `main`, folder `/ (root)`. Save.
4. After a minute it's live at `https://hampterworks.github.io/claw/`.

All paths are relative, so it works under the `/claw/` sub-path. `.nojekyll` stops GitHub from running Jekyll on it.

## Multiplayer (shared Ohio)

Claw Simulator can put everyone in the same world: you see each other's Claws (names, skins,
pets, chat), knocked-over props are shared, and you can bonk each other. The site stays on
GitHub Pages; a tiny relay runs on Cloudflare Workers' free plan (`server/`, one Durable Object).
Quests, coins, the casino and fishing stay per player.

**One-time setup**

1. Make a free [Cloudflare](https://dash.cloudflare.com/sign-up) account. Copy your **Account ID**
   (Workers & Pages → Overview, right side).
2. My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers** → create, copy it.
3. GitHub repo → Settings → Secrets and variables → Actions → add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Actions → **Deploy multiplayer server** → Run workflow (it also runs on any push to `server/`).
   The log ends with the URL, like `https://claw-ohio.<subdomain>.workers.dev` (ours: `claw-ohio.hampterworks.workers.dev`).
   The Action replaces a personal account subdomain with a group name (see `WANTED` in the workflow).
5. Put it in `js/games/sim/net-config.js`: `export const MP_URL = 'wss://claw-ohio.<you>.workers.dev/ws';`
   then run `node tools/stamp.mjs` and push.

If you ever move the site off `hampterworks.github.io`, add the new origin to `ALLOWED_ORIGINS`
in `server/wrangler.jsonc`.

**Local testing:** `cd server && npx wrangler dev` (runs the Worker + Durable Object locally), serve the
site, and open `glorp/?mp=ws://localhost:8787/ws` in two browser windows. `?mp=off` forces single-player.

**Controls:** WASD move, mouse look, Space jump (x2), F bonk, E lick, R flop, Shift zoomies, G emote wheel,
J quest log, H controls card, P menu (P again closes it), T chat. Touch players get on-screen buttons.

**Daily quests:** three a day (the same for everyone), coins for each and a streak bonus for all three. See the
📅 chip or the quest log (J).

**Day, night and weather:** a 24-minute day shared by everyone online (about 3.5 minutes of it is night: lamps,
glowing windows, fireflies and a lantern that follows Claw), rain
now and then, and it always snows at Winter's Castle.

**Emotes:** dances and emotes from the wheel (G). Three Claws dancing together start a dance party.

**Clicky and the Battle of Ohio:** Clicky, Winter's grumpy castle wizard, wants out. Bring him a coffee, find his 4
spell pages and bonk 3 summoning stones awake, and he quits by summoning a kaiju. Mega Matt drops from the sky to
fight Mega Godzilla to an original battle theme (every hit lands on the beat). Everyone online is flung into the air
with the camera locked on the fight; BONK cheers for Matt, LICK for Godzilla, and the crowd decides who wins.

**Loans:** borrow at the Bank of Romni (20% interest). Pay back within 5 minutes of play; 30 seconds after
that Winty comes to collect, takes what you owe and locks you in the dungeon of Winter's Castle. Respawn (menu) to escape, or
in multiplayer a friend pulls the lever outside your cell. The castle also hides a secret room behind a bookcase.

**In game:** the start screen has **🌐 Play online** and **🎮 Play offline** (remembered for next time). Switch
any time with the 🌐/🎮 chip at the top or **Online** in the pause menu. Progress, coins, skins and pets are the
same in both. Online: T or Enter to chat (💬 on phones), F near another Claw to bonk them.

## Project layout

```
index.html          hub page
css/style.css       neon brainrot theme
js/main.js          hub + hash router (#boil, #flappy, #whack, #aura)
js/engine.js        canvas scaling, game loop, input, popups, particles, overlays
js/cats.js          code-drawn cat memes
js/props.js         pot, fire, water, Bliss background
js/audio.js         WebAudio sound effects (no audio files)
js/scores.js        localStorage helpers
js/brainrot.js      popup phrases (add group-chat lore here)
js/games/*.js       one file per game, each exports meta + mount(el)
js/games/sim/       a 3D side project (see glorp/README.md)
assets/             Claw sprites + meme pictures
assets/models/      3D models (CC0, see assets/models/CREDITS.md)
vendor/three/       three.js 0.186.1 + the few addons used (MIT)
vendor/rapier/      Rapier 0.21.0 physics, WASM inlined (Apache-2.0)
```

three.js and Rapier are vendored (pinned copies in the repo) so the site needs no CDN and no build step.
They're only used by the 3D side project, so the arcade itself stays light.

## Updating the site

After editing any JS, run `node tools/stamp.mjs` before committing. GitHub Pages lets browsers reuse files
for 10 minutes; the script adds a content hash to every module URL so changed files are always fetched fresh.

## Adding a game

1. Create `js/games/mygame.js` exporting `meta = { id, title }` and `mount(el)` that returns a cleanup function.
   `createCanvasGame` in `js/engine.js` does most of the work.
2. Import it in `js/main.js` and add it to `GAMES`.
3. Add a card linking to `#<id>` in `index.html`.
