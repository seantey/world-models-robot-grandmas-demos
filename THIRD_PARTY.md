# Credits and licences

The code in this repository is MIT-licensed (see `LICENSE`). The 3D files the demos download, and the
libraries they load, come with their own terms:

| What | Credit | Licence |
|---|---|---|
| Cat scan (`kitty-preview.spz`, `kitty-default.spz`) | ["Kitty"](https://superspl.at/scene/79db08c0) by [Andrej Kurcik](https://superspl.at/user?id=andyone); compressed and reduced for the web | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Apartment world, collider mesh and detailed mesh (`apartment-*.spz`, `apartment-*.glb`) | Generated with [World Labs Marble](https://marble.worldlabs.ai) from an AI-made panorama based on photos by [Max Vakhtbovych](https://www.pexels.com/collections/pirowhite-g52elv4/) ([Pexels License](https://www.pexels.com/license/)); cleaned up by Sean Tey (splats cleaned, meshes compressed, the detailed mesh's texture removed) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Robot Grandma game (`robot-grandma/`, the packaged build) | Sean Tey: game code and the trained walking network | MIT |
| Inside the game: Unitree G1 model and meshes | [Unitree Robotics](https://github.com/unitreerobotics/unitree_ros) | BSD-3-Clause |
| Inside the game: G1 collision shapes, actuator gains and contact settings in `scene.xml` | [mjlab](https://github.com/mujocolab/mjlab) (Zakka et al., UC Berkeley) | Apache-2.0 |
| Inside the game: [MuJoCo](https://mujoco.org) 3.15.0 | Google DeepMind | Apache-2.0 |
| Inside the game: three.js 0.185.1, Spark 2.4.0, meshoptimizer | their authors | MIT |
| The game's room | From the apartment world above | CC0 1.0 |
| [three.js](https://threejs.org) 0.185.1 | three.js authors | MIT |
| [Spark](https://sparkjs.dev) 2.3.1 | World Labs | MIT |

**The AI-generated 3D files are released under CC0: no rights reserved, use them for anything.** If you do, a
credit to World Labs Marble, the photographer Max Vakhtbovych and this project is appreciated. CC0 covers these
files only: the original photos stay under the Pexels License and are not included.

The demos load their libraries from [jsDelivr](https://www.jsdelivr.com) at fixed versions; they are not copied
into this repository. The game carries its own copies, with every licence text in its `LICENSES/` folder. The
original photos are not included.
