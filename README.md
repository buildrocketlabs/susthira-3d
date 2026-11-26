# Susthira live 3D

A private, mobile first, live 3D look at three Susthira Bio Organics bottles (Banana Special, PSB Liquid, Jeevamrutha Culture), prepared by BuildRocket Labs for Dr. M. S. Rao.

Vite + React + TypeScript + React Three Fiber. Static site, no server code.

## Run it

```
npm install
npm run dev        # development, prints a local and a network address
npm run build      # type check, then production build into dist/
npm run preview    # serve dist/ locally
```

To try it on a phone on the same WiFi, open the Network address that `npm run dev` prints.

## Deploy on Vercel (by hand)

Upload the contents of this folder to a private GitHub repo (not `node_modules`, not `dist`; `.gitignore` already excludes them) and import it in Vercel with:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | 20.x or newer |

`vercel.json` already sets these, plus `X-Robots-Tag: noindex, nofollow` on every response and long cache headers for `/assets` and the texture folders.

**Link preview image.** WhatsApp needs an absolute `og:image` address. The build reads Vercel's `VERCEL_PROJECT_PRODUCTION_URL` automatically, so after you attach a custom domain, redeploy once and the preview points at that domain. To force a value, add an environment variable `SITE_URL` (for example `https://susthira.buildrocketlabs.com`).

**Web Analytics.** In the Vercel dashboard: Project, Analytics, Enable. `@vercel/analytics` is already wired in `src/main.tsx`. It only loads on a deployed production build; on localhost and in `npm run dev` it does nothing.

## What is where

```
index.html            opening screen (inline CSS, paints before any script), meta and og tags
src/config.ts         ALL visible copy, product facts, hotspot positions, Kannada lines
src/store.ts          interface state (zustand)
src/quality.ts        device tiers: low, mid, high
src/bottle/
  geometry.ts         procedural bottle, cap, label (centimetres); shared with the AR export
  materials.ts        HDPE, BOPP label, cap materials
  textures.ts         progressive label loading: 1024 WebP, then 4096 KTX2 or 2048 WebP
  Bottles.tsx         the three bottles
src/scene/
  Stage.tsx           canvas, lights, studio sweep, photo back plates, baked shadows
  Rig.tsx             camera, gestures, opening sequence, product swap, hotspot tracking
  rigState.ts         turntable and camera state shared without React renders
  Governor.tsx        adaptive pixel ratio and quality fallback
  Post.tsx            N8AO, SMAA, vignette, tone mapping (high tier only, lazy)
  BakeShadows.tsx     development tool for baking ground shadows (never loaded by visitors)
src/ui/               top bar, dock, hotspot card, flat artwork viewer, AR sheet, closing card, fallback
scripts/              asset pipeline (see below)
public/               generated assets, committed
docs/screens/         phone screenshots
```

## How it behaves

- **Opening** (about 4 s, tap to skip): forest screen, the mark, "For Dr. M. S. Rao" with the Kannada line. The lights come up, the bottle turns to the Dr. Rao panel, holds, then settles on the front.
- **Hero**: one finger turns the bottle (inertia), up and down tilts a little, pinch zooms, double tap zooms to the tapped spot and back. A hint shows once (remembered in `localStorage`).
- **Hotspots**: four gold dots follow the label. A tap turns the bottle and shows a card.
- **Products**: three chips. A switch is one turn with the labels cross fading.
- **Whole range**, **Scenes** (Studio, Banana field, Red soil), **Flat artwork** (pinch zoom, 5000 px master), **On your table** (AR), **closing card** with the WhatsApp button.

## Quality tiers

| Tier | Who | Labels | Pixel ratio | Extras |
| --- | --- | --- | --- | --- |
| high | desktop GPUs, flagship phones | KTX2 4096 | up to 2 | N8AO, SMAA, vignette |
| mid | the target phones | KTX2 4096 | starts 1.75, 1 to 2 | native MSAA, CSS vignette |
| low | weak GPU, 2 GB memory | WebP 2048 | 1 to 1.5 | simpler materials |

The first guess is instant (`guessQuality`). After the bottle is on screen, `detect-gpu` checks the self hosted benchmark tables in `public/benchmarks` and can only lower the tier. `Governor.tsx` then watches real frame times and steps the pixel ratio down, then post processing off, then to the low tier. Force a tier with `?q=low`, `?q=mid` or `?q=high`. `?nointro` skips the opening.

Also handled: no WebGL (still photographs from `public/fallback` with the same interface), a lost WebGL context (stills, then an automatic rebuild when the context returns), `prefers-reduced-motion`.

## Decisions that differ from the brief, and why

- **Tone mapping is Khronos PBR Neutral, not ACES or AgX.** Measured against the artwork on the front of the bottle: label yellow renders `239,186,35` for `242,194,48` in the PNG, white `241,237,234`. ACES and AgX both shift the range colours visibly; Neutral exists for exactly this product colour case.
- **Ground shadows are baked, not computed on the phone.** A round bottle casts the same shadow however it is turned, so the shadows were accumulated once with drei's `AccumulativeShadows` (600 samples) and saved as four 3 KB textures. No shadow maps run on the device.
- **The canvas renders on demand** (nothing is drawn while the bottle is still) to keep phones cool. drei's `PerformanceMonitor` assumes a continuous loop, so `Governor.tsx` does the same job and only measures runs of consecutive frames.
- **The mould parting line is real geometry** (a 35 micron ridge on both sides), not a normal map: sharper at any zoom and no texture to download.
- **Labels are 4096 x 1968**, not 1966: block compressed formats need multiples of 4. The stretch is 0.1 %.
- **three is pinned to 0.183** because `@google/model-viewer` requires it; sharing one copy keeps the AR sheet small.
- **AR button is hidden in a bare Android WebView** (user agent contains `; wv)`), which cannot open Scene Viewer. Chrome and Chrome custom tabs show it.

## Regenerating assets

Everything in `public/` is committed, so Vercel only runs `vite build`. Run these only when a source changes:

```
npm run assets:textures   # labels (WebP, KTX2), flat artwork, plates, fallbacks, og image, icons, HDRI, vendor files
npm run assets:maps       # procedural plastic and cap normal and roughness maps
npm run assets:glb        # AR models in public/ar
```

- `assets:textures` reads `../assets` (the label masters must stay next to this folder for that) and needs `basisu` on the PATH for KTX2: `brew install basis_universal`. Without it the KTX2 step is skipped. One step only: `node scripts/build-textures.mjs labels` (or `plates`, `brand`, `env`, `vendor`).
- The HDRI is `studio_small_09` from Poly Haven (CC0), kept at 1k in `scripts/` and shrunk to 384 x 192 for the site.
- Ground shadows: start `npm run dev -- --port 5199`, then run `node bake-shadows.mjs` in the sibling `qa/` folder.
- Label artwork is never redrawn. Every texel comes from `assets/labels/*.png`.

## Copy rules

All visible text is in `src/config.ts` and `index.html`. No hyphens or dashes, the legal name Prajwal Bedavatti, product claims say "helps" or "supports", no invented claims. Kannada renders in Noto Sans Kannada (`public/fonts`); lines written for this site are marked `NEW KANNADA` in `src/config.ts`.

## Measured (production build, Galaxy A54 viewport, Chrome, 4x CPU throttle)

| | |
| --- | --- |
| Opening screen painted | 0.7 s on 4G (9 Mbps), 0.9 s on slow 4G (1.6 Mbps) |
| First 3D frame ready | 2.6 to 3.1 s on 4G, 7.9 s on slow 4G (the opening screen covers it, with a progress line) |
| Download before the first 3D frame | 1.28 MB |
| Download with the full resolution label | 4.5 MB |
| JavaScript, first load | about 330 KB brotli |
| Label textures | 1024 WebP 73 to 83 KB, 2048 WebP 245 to 300 KB, 4096 KTX2 2.9 to 3.2 MB (about 11 MB of video memory each) |
| Lighthouse mobile | Performance 90, Accessibility 100, Best Practices 100 (SEO 63 on purpose: noindex) |

Frame rate was measured on a desktop GPU only (steady 60 fps). Confirm on a real mid range Android phone before sending.
