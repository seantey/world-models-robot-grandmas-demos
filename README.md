# World Models and Robot Grandmas: demos

Small, readable versions of the 3D demos from the blog post
[Intro to World Models and Robot Grandmas](https://seantey.github.io/world-models-robot-grandmas-blog/intro-to-world-models-n-robot-grandmas-blog.html).
Each demo is one HTML page you can read top to bottom.

## Run it

Pick Node or Python. Both download the 3D files and the robot game (about 53 MB, every file checked against its
fingerprint) and start a local server.

### With Node (18 or newer)

    git clone https://github.com/seantey/world-models-robot-grandmas-demos
    cd world-models-robot-grandmas-demos
    npm run fetch-assets
    npm run serve

### With Python (3.9 or newer)

    git clone https://github.com/seantey/world-models-robot-grandmas-demos
    cd world-models-robot-grandmas-demos
    python3 scripts/fetch_assets.py
    python3 -m http.server 8080

Then open http://localhost:8080/

`uv run scripts/fetch_assets.py` works too. Opening the HTML files directly (double-click) won't: browsers
block the code the demos need on `file://` pages. You need a browser with WebGL 2 (current Chrome, Edge,
Firefox or Safari).

## The demos

| Demo | What it shows |
|---|---|
| [Blob](demos/blob.html) | One Gaussian splat: a soft, see-through blob of colour, drawn with a shader |
| [Cat](demos/cat.html) | A 3D Gaussian Splatting scan drawn from scratch: decoding, depth sorting in a worker, the shader |
| [Apartment world](demos/world.html) | A world generated with World Labs Marble, flown through with Spark |
| [Meshes](demos/meshes.html) | Marble's collider mesh next to its detailed mesh |
| [Robot Grandma](demos/robot.html) | The game from the post: a Unitree G1 walking with a cane, driven by a trained neural network, physics in MuJoCo, the room in Gaussian splats. For now the packaged build; its readable source will follow |

## How it fits together

- `assets/assets.json` lists the 3D files and the robot game's files: where each one is downloaded from and
  its SHA-256 fingerprint. The fetch scripts download them into `assets/` (git-ignored), and the pages load them
  from there; a page whose files are missing says which command to run.
- three.js and Spark load from jsDelivr at fixed versions, through an import map at the top of each page.
  There is no build step and nothing to install.
- The blog's own widgets, with loading screens, theming and embedding, are in the
  [blog's repository](https://github.com/seantey/world-models-robot-grandmas-blog/tree/main/docs/widgets).
  These demos keep only the 3D parts.

## Licences

Code, including the game and its trained network: MIT (`LICENSE`). The apartment world, its meshes and the
robot's room: CC0, no rights reserved (they are AI-generated from other people's photos). The cat scan: CC BY 4.0
by Andrej Kurcik. Details, and the libraries' licences: `THIRD_PARTY.md`.
