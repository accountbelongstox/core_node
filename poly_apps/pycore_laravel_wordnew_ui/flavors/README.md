# Flavors — multi-app build system (Flutter-flavors style)

This project is a **unified shell** hosting several sub-apps (`apps/laravel-manager`,
`apps/pycore-manager`, `apps/wordnew`, `apps/vortex`). A **flavor** lets you build
ONE of those apps as a standalone homepage app (web + Capacitor native), without
removing the others — the Flutter "flavors" pattern.

## Layout (one folder per buildable app)

```
flavors/
  <id>/
    flavor.json      # single source of truth (identity, names, brand, launch)
```

`flavor.json`:

| field             | meaning                                                                 |
|-------------------|-------------------------------------------------------------------------|
| `id`              | flavor id = the `apps/<id>` to mount (also the folder name)             |
| `name`            | fallback display name                                                   |
| `names`           | localized app names, e.g. `{ "en": "WordNew", "zh": "千语单词", "zh-Hant": "千語單詞" }` |
| `appId`           | Java-package bundle id (Capacitor `appId`, letters/digits/underscore segments) |
| `rootRoute`       | in-app route the standalone build lands on (e.g. `/wordnew`)           |
| `themeColor`      | `<meta theme-color>`                                                    |
| `brand.icon`      | project-relative brand icon (PNG/JPEG/WebP/SVG), the ONE icon source; inside an app name it `*-logo-source.*` |
| `brand.iconBackground` / `adaptiveScale` | adaptive-icon background (default: sampled icon edge) and foreground scale |
| `launch.native`   | native splash: `background`, `backgroundDark`, optional `image` + `imageFocus`, `iconScale` (Android 12+), `logoScale` (pre-12) |
| `launch.web`      | web transition: `mode` (`none`/`logo`/`slides`), `show` (`always`/`session`/`daily`/`version`), `durationMs`, `slideMs`, `skippable`, `tagline`, `slides[]` (`image` under `apps/<id>/assets/launch/`, `focus`, `caption`) |

`shell` is the special default flavor = the full multi-app shell (normal
`bun run dev` / `bun run build`).

## How it works

- **Runtime** (`shell/flavor.ts`): statically imports every `flavor.json` into a
  registry and reads the build-time constant `__APP_FLAVOR__`. `index.tsx` renders
  the full `ShellApp` or `StandaloneApp`; standalone builds play
  `shell/FlavorLaunchScreen.tsx` (`launch.web`) and use the localized name + brand
  icon for the document title/favicon.
- **Build** (`scripts/flavor/build_apk.py`, `build_app.ps1`): `flavor_build.py`
  writes `capacitor.config.json`; `vite build` runs with the flavor selected;
  `brand_assets.py` renders launcher icons (legacy, round, adaptive), splash
  bitmaps (light/night), the Android 12 splash icon and localized `app_name`
  strings into `native/<id>/android` from `brand.icon` — idempotent (fingerprint
  in `native/<id>/android/.core-node-brand.json`), regenerated whenever the
  source or settings change, the source is never modified; then `cap sync`.
- **Native vs web**: `-Native` sets `VITE_BUILD_TARGET=native`, which makes
  `vite.config.ts` drop the `@capacitor/*` browser shims so the REAL plugins are
  bundled. Web/default keeps the shims.

## Usage

```powershell
# list flavors
./build_app.ps1 -List

# build wordnew as a standalone web app (dist/)
./build_app.ps1 -App wordnew

# build vortex with real Capacitor plugins + sync the Android project
./build_app.ps1 -App vortex -Native -Sync -Platform android
```

First-time native setup (per platform):

```powershell
bun add @capacitor/core @capacitor/cli @capacitor/android   # + the plugins you use
bun x cap init                 # uses capacitor.config.json
bun x cap add android
./build_app.ps1 -App wordnew -Native -Sync
```

## Adding a new flavor

1. Create `flavors/<id>/flavor.json` with `names`, `brand.icon` and `launch`
   (the registry picks it up automatically).
2. Give it an `entry` (`apps/<id>/<Name>App.tsx`) and add `android` to `platforms`
   for native builds.
