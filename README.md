# We Will Boil The Claw 🍲

A brainrot cat-meme arcade for our friend **deathclaw1551** (aka Claw, the green cat).

Everything in it is a cat meme. Claw is played by his own pictures; the supporting cast
(Popcat, Maxwell, OIIA Cat, Nyan Cat, Banana Cat, Huh Cat, Smudge, Grumpy Cat, Happy Happy Cat)
is drawn in code.

## Games

| Game | How to play |
| --- | --- |
| **Boil the Claw** (main event) | Keep the heat in the green zone to fill the Boil-o-meter. Tap low on the screen (or Space) to stoke the fire. Tap Claw when he jumps out. Tap floating meme cats to season the soup (not Grumpy Cat). 3 pots: Kitchen, Witch Cauldron, Ohio Volcano. |
| **Claw Simulator** (3D) | Goat Simulator, but you're Claw. Knock things off tables, lick and fling stuff, flop like liquid, boil yourself in the giant soup pot. 10 Claw-lenges unlock mutators (Glorp Gravity, Cursed Face, Big Claw, OIIA Mode, Popcat Mode). |
| **Flappy Glorp** | Tap / Space to flap alien Claw through towers of spinning Maxwells. Grab Nyan Cat for bonus points. Don't fall in the soup. |
| **Dunk-a-Claw** | Whack-a-mole with pots. Dunk Claw, spare Banana Cat, Huh Cat and Smudge. 30 seconds. |
| **Aura Farmer** | Clicker. Tap Claw for aura, hire meme cats to farm it for you. Saves on your device. |

High scores, the "boiled" counter and Aura Farmer progress live in `localStorage` (per device, per browser).

### Claw Simulator controls

| Action | Desktop | Phone |
| --- | --- | --- |
| Move | WASD / arrows | left stick |
| Look | mouse (click to lock) or drag | drag anywhere |
| Jump / glorp double jump | Space (x2) | JUMP |
| Bonk | F or left click | BONK |
| Lick (grab, again to fling) | E or right click | LICK |
| Flop (ragdoll) | R | FLOP |
| Zoomies | hold Shift | hold ZOOM |
| Menu (challenges, mutators, graphics) | P / Tab | ☰ |

Graphics has High (bloom, shadows, color grade, FXAA) and Low. Phones start on Low, and High drops to Low on its own if the frame rate tanks.
Add `?debug` to the URL to expose `window.__clawSim` for poking at things, and `?hq` to force High graphics.

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

## Project layout

```
index.html          hub page
css/style.css       neon brainrot theme
js/main.js          hub + hash router (#boil, #sim, #flappy, #whack, #aura)
js/engine.js        canvas scaling, game loop, input, popups, particles, overlays
js/cats.js          code-drawn cat memes
js/props.js         pot, fire, water, Bliss background
js/audio.js         WebAudio sound effects (no audio files)
js/scores.js        localStorage helpers
js/brainrot.js      popup phrases (add group-chat lore here)
js/games/*.js       one file per game, each exports meta + mount(el)
js/games/sim/       Claw Simulator (3D): game loop, world, Claw, controls, HUD, challenges, shaders
assets/             Claw sprites + meme pictures
assets/models/      3D models (CC0, see assets/models/CREDITS.md)
vendor/three/       three.js 0.186.1 + the few addons used (MIT)
vendor/rapier/      Rapier 0.21.0 physics, WASM inlined (Apache-2.0)
```

three.js and Rapier are vendored (pinned copies in the repo) so the site needs no CDN and no build step.
They only load when Claw Simulator is opened, so the menu and 2D games stay fast.

## Adding a game

1. Create `js/games/mygame.js` exporting `meta = { id, title }` and `mount(el)` that returns a cleanup function.
   `createCanvasGame` in `js/engine.js` does most of the work.
2. Import it in `js/main.js` and add it to `GAMES`.
3. Add a card linking to `#<id>` in `index.html`.
