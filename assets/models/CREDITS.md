# 3D model credits

All models are CC0 (public domain). Credit isn't required, but these folks are great:

- **Cat** (Claw and the Maxwell statue): *Animal Pack Vol.2* by [Quaternius](https://quaternius.com), CC0.
- **Furniture** (living room, studio desk): *Furniture Kit* by [Kenney](https://kenney.nl), CC0.
- **Trees, bushes, rocks, corn, palms, cactus, lilypads**: *Ultimate Nature Pack* by [Quaternius](https://quaternius.com), CC0.
- **Meowtown** (walls, fountain, stalls, lanterns, carts, windmill rotor, fences, trees): *Fantasy Town Kit 2.0* by [Kenney](https://kenney.nl), CC0.
- **Pets** (all 24 casino pets): *Cube Pets* by [Kenney](https://kenney.nl), CC0. Icons in `assets/sim-pets.png` are the kit's previews.
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
