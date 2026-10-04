# 3D model credits

All models are CC0 (public domain). Credit isn't required, but these folks are great:

- **Cat** (Claw and the Maxwell statue): *Animal Pack Vol.2* by [Quaternius](https://quaternius.com), CC0.
- **Furniture** (living room, studio desk): *Furniture Kit* by [Kenney](https://kenney.nl), CC0.
- **Trees, bushes, rocks, corn**: *Ultimate Nature Pack* by [Quaternius](https://quaternius.com), CC0.

## How these files were made

`claw.glb` and `world.glb` were generated from the original packs with a one-off Node script:
three.js `FBXLoader`/`GLTFLoader` → recolor + normalize scale (feet at y=0) → `GLTFExporter`,
then optimized with `@gltf-transform/cli` (`dedup`, `weld`, `prune`; `world.glb` also `quantize`).
Don't quantize `claw.glb`: it breaks the skinned skeleton.

`world.glb` holds one named node per model: `k_<name>` (Kenney) and `n_<name>` (nature).
