# Credits, sources and licenses

This is an unofficial community project by **benlooning**. It is not an official
CCC or CCCV production. The soundtrack package originally credits
**benlooning & Antigravity**; its synthesis code is included in `music/render.mjs`.
Animation tooling and publication preparation were developed with AI assistance.

## 40C3 design assets

- Source: [official 40C3 styleguide](https://events.ccc.de/congress/2026/infos/styleguide/).
- Package: [40c3-styleguide-full-latest.zip](https://events.ccc.de/congress/2026/infos/styleguide/40c3-styleguide-full-latest.zip).
- Upstream paths: `Assets/Icons_Deco/Fairydust.svg` and `Assets/Logos/40C3_Logo_0.svg`.
- Credit: CCCV / the 40C3 design team.
- License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), as stated on the styleguide page.
- The two files in `assets/` are unmodified originals from the supplied package.

During rendering, the rocket's orange oval and original exhaust are removed,
the silhouette is recolored, and its original paths are rotated to face right
or up. A pixel rainbow replaces the exhaust. The logo is recolored in memory.
These changes do not alter the original asset files.

The rainbow uses six official styleguide color values. The lavender background
(`#9198bd`) and cream foreground (`#e1ecd1`) were sampled from user-provided
styleguide screenshots; they are not presented as the canonical CSS palette.

## Fonts

| Font | Bundled file | Source | License |
| --- | --- | --- | --- |
| Jersey 10 | `assets/jersey-10-latin-400-normal.ttf` | [Sarah Cadigan-Fried / Soft Type Jersey](https://github.com/scfried/soft-type-jersey) | [SIL OFL 1.1](licenses/Jersey-10.txt) |
| Hack Regular | `assets/Hack-Regular.ttf` | [Source Foundry / Hack](https://github.com/source-foundry/Hack) | [MIT, Bitstream Vera and public-domain notices](licenses/Hack.txt) |

Jersey: Copyright 2023 Sarah Cadigan-Fried. Hack: Copyright 2018 Source Foundry
Authors, with upstream DejaVu and Bitstream Vera components. Fonts are bundled
unmodified; the upstream license texts supplied with the styleguide are retained.

## Project code and media

- Python renderer, audio muxer, music synthesis source and documentation:
  [MIT](LICENSE).
- Soundtrack, preview media and original video contributions:
  [CC BY 4.0](licenses/MEDIA.md), credited to benlooning.
- The music source was adapted from the supplied **Model Citizens – 40C3 Rainbow
  Anthem (Pure Banger)** package, whose `package.json` declares MIT and credits
  benlooning & Antigravity. Changes here: English comments, portable output paths
  and lossless-only exports. The synthesis and arrangement are retained.

## Inspiration and tools

The rainbow trail and pixel-star animation are inspired by **Nyan Cat** by
Chris Torres / [PRguitarman](https://www.nyan.cat/). No original Nyan Cat image,
audio recording or animation frames are bundled. The soundtrack is synthesized
by the included generator rather than taken from Nyan Cat.

Rendering uses [Pillow](https://python-pillow.org/),
[resvg-py](https://github.com/baseplate-admin/resvg-py) and
[FFmpeg](https://ffmpeg.org/). Music synthesis uses built-in
[Node.js](https://nodejs.org/) modules. These tools are installed separately;
their source or executables are not bundled.

For sharing the project with the Congress community, see the
[40C3 Projects guide](https://events.ccc.de/congress/2026/infos/hub-projects/).
