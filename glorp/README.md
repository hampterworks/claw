# Claw Simulator (secret)

A 3D Goat-Simulator-style sandbox where you play Claw. It lives at **`/claw/glorp/`** and is
deliberately not linked from the arcade menu, so it can be a surprise.

You play Claw: knock things off tables, lick and fling stuff, flop like liquid, and boil yourself in the giant soup pot.
The world is ~180 m across, with a minimap: the original living room/park/tower/studio/corn field, plus
Glorpville downtown (Glorp Café, Glorp Towers + pool, Matt's House), the Zoomies Raceway, a UFO,
Lake Meowchigan, the giant Cat Tree, medieval Meowtown with its windmill, and Glorp Mini Golf.
25 Claw-lenges (NPCs with a "!" hand them out) unlock 7 mutators (Glorp Gravity, Cursed Face, Big Claw,
OIIA Mode, Popcat Mode, Tiny Claw, Matt Mode).

## Controls

| Action | Desktop | Phone |
| --- | --- | --- |
| Move | WASD / arrows | left stick |
| Look | mouse (click to lock) or drag | drag anywhere |
| Jump / glorp double jump | Space (x2) | JUMP |
| Bonk | F or left click | BONK |
| Lick (grab, again to fling) | E or right click | LICK |
| Flop (ragdoll) | R | FLOP |
| Zoomies | hold Shift | hold ZOOM |
| Music on/off | M | ♪ |
| Menu (challenges, mutators, graphics, settings) | P / Tab | ☰ |

## Ms Winter (Winty)

Hangs around the park (`js/games/sim/winty.js`). Walk up to her and she starts pitching her
"business opportunity", then chases Claw for ~10 s yelling sales lines. Get 16 m away to complete
**Just say no: outrun Winty** (zoomies help); otherwise she gives up and wanders back.

## Glorp Casino, Cat Crates and skins

Play money only. Points earn Glorp Coins (10 points = 1 coin, +50 per Claw-lenge, 200 welcome coins from Matt).
The Glorp Casino downtown (Matt owns it) has **Glorp Slots** (pairs 1.5x, triples 10x, three Mattpogs 50x;
~12% house edge) and the **Cat Crate** machine (300 coins, CS:GO-style spin; Common 55%, Rare 28%,
Epic 13%, Legendary 4%; duplicates refund 100). Walk up to a machine and press E (or tap the prompt).
20 Claw skins live in `js/games/sim/skins.js`; equip them from the pause menu's **Skins** wardrobe.

## Music

"Glorp Groove" is an original chiptune sequenced live in `js/games/sim/music.js`
(pulse lead + arpeggio, triangle bass, noise drums) with synthesized meows, mrrps and purrs
from `js/catvoice.js`. No audio files, nothing to license. Toggle it in the menu's Settings.

## Settings

The pause menu has Graphics (High: bloom, shadows, color grade, FXAA; Low: fast) and Settings
(Music, Antenna glow). Choices are saved per device. Phones start on Low graphics.

## Dev notes

- After editing any JS, run `node tools/stamp.mjs` before committing. It fingerprints module URLs
  in the import maps so browsers don't keep serving the old files from GitHub Pages' 10-minute cache.
- Code: `js/games/sim/` (entry `index.js`), page script `js/glorp.js`, page `glorp/index.html`
  (uses `<base href="../">` so it shares the site's assets).
- `?debug` exposes `window.__clawSim`; `?hq` forces High graphics.
- Model credits: `assets/models/CREDITS.md`.
