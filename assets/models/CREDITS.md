# 3D model credits

All models are CC0 (public domain). Credit isn't required, but these folks are great:

- **Cat** (Claw and the Maxwell statue): *Animal Pack Vol.2* by [Quaternius](https://quaternius.com), CC0.
- **Furniture** (living room, studio desk): *Furniture Kit* by [Kenney](https://kenney.nl), CC0.
- **Trees, bushes, rocks, corn, palms, cactus, lilypads**: *Ultimate Nature Pack* by [Quaternius](https://quaternius.com), CC0.
- **Meowtown** (walls, fountain, stalls, lanterns, carts, windmill rotor, fences, trees): *Fantasy Town Kit 2.0* by [Kenney](https://kenney.nl), CC0.
- **Pets** (all 24 casino pets): *Cube Pets* by [Kenney](https://kenney.nl), CC0. Icons in `assets/sim-pets.webp` are the kit's previews.
- **Lyonia (Vash)** and his gold shrine statue: *Mini Characters* by [Kenney](https://kenney.nl), CC0 (recoloured, plus procedural ears, tail and heart eyes in `js/games/sim/vash.js`).
- **Clicky the Wizard** and **Mega Matt**: *Mini Characters* by [Kenney](https://kenney.nl), CC0 (`character-male-e` and `character-male-c`, plus a procedural hat, beard, robe and staff in `js/games/sim/wizard.js`, and Matt's face, crown and cape in `js/games/sim/kaiju.js`). Mega Godzilla is built entirely in code (`kaiju.js`). So is Ducky (`ducky.js`).
- **Glorp Mini Golf** (course tiles, flag, castles, ball): *Minigolf Kit* by [Kenney](https://kenney.nl), CC0.

## How these files were made

`claw.glb` and `world.glb` were generated from the original packs with a one-off Node script:
three.js `FBXLoader`/`GLTFLoader` → recolor + normalize scale (feet at y=0) → `GLTFExporter`,
then optimized with `@gltf-transform/cli` (`dedup`, `weld`, `prune`; `world.glb` also `quantize`).
Don't quantize `claw.glb`: it breaks the skinned skeleton.

`world.glb` holds one named node per model: `k_<name>` (Kenney furniture), `n_<name>` (nature),
`t_<name>` (Fantasy Town) and `g_<name>` (Minigolf). The Town and Minigolf kits colour their models with a
texture atlas; those colours were baked into vertex colours (gltf-transform script) and the models keep their
original grid pivots so tiles snap together.

`pets.glb` holds the Cube Pets: one root node per pet named `p_<animal>`, with the kit's atlas colours baked into
vertex colours and animations renamed `<animal>|idle|walk|run|dance` (others dropped). Normals and colours are
quantized; positions are not, because the pets use node animations.

`vash.glb` is Mini Characters `character-male-f` with its palette atlas recoloured (hair, coat, pants, skin swatches)
and only the clips Vash uses (idle, walk, sprint, jump, sit, emote-yes, emote-no, interact-right). Not quantized (skinned).

`wizard.glb` and `megamatt.glb` are Mini Characters `character-male-e` and `character-male-c` with only the clips they
use (gltf-transform `prune` + `dedup`, texture embedded). Not quantized (skinned).

## Spooktober (`halloween.glb`, loaded only in October)

- **Graveyard Kit** by [Kenney](https://kenney.nl/assets/graveyard-kit), CC0: gravestones, crypts, iron fences, coffins,
  pumpkins, lanterns, crooked pines, and the animated ghost, skeleton, vampire, zombie and keeper characters (`h_*` nodes).
- **Halloween Bits** by [Kay Lousberg (KayKit)](https://kaylousberg.itch.io/halloween-bits), CC0: jack-o'-lanterns,
  skulls and bones, candles, dead and orange trees, arches and shrines (`y_*` nodes).

Built with a one-off gltf-transform script: each pack's colour atlas baked into vertex colours, one named root node
per model, character clips renamed `<model>|<clip>` (idle, walk, sprint, die, emote-yes, attack-melee-right), then
`dedup`, `weld`, `prune`, normals and colours quantized, meshopt. Positions are not quantized (node animations).
