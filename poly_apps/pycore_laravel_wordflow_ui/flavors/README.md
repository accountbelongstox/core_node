# Flavors — multi-app build system (Flutter-flavors style)

This project is a **unified shell** hosting several sub-apps (`apps/laravel-manager`,
`apps/pycore-manager`, `apps/wordnew`, `apps/vortex`). A **flavor** lets you build
ONE of those apps as a standalone homepage app (web + Capacitor native), without
removing the others — the Flutter "flavors" pattern.

## Layout (one folder per buildable app)

```
flavors/
  <id>/
    flavor.json      # single source of truth (name, appId, route, colors, icon, splash)
    icon.svg         # 1024×1024 source icon (design)
    icon.png         # optional rasterized icon (used directly if present)
    splash.png       # optional 2732×2732 splash
```

`flavor.json`:

| field            | meaning                                                        |
|------------------|---------------------------------------------------------------|
| `id`             | flavor id = the `apps/<id>` to mount (also the folder name)   |
| `name`           | app display name (window title, Capacitor `appName`)          |
| `appId`          | reverse-DNS bundle id (Capacitor `appId`)                     |
| `rootRoute`      | in-app route the standalone build lands on (e.g. `/wordnew`)  |
| `themeColor`     | `<meta theme-color>` + icon background                        |
| `backgroundColor`| splash / native background                                    |
| `icon` / `splash`| asset filenames inside the flavor folder                      |

`shell` is the special default flavor = the full multi-app shell (normal
`npm run dev` / `npm run build`).

## How it works

- **Runtime** (`shell/flavor.ts`): statically imports every `flavor.json` into a
  registry and reads the build-time constant `__APP_FLAVOR__` (injected by Vite
  `define` from the `VITE_APP_FLAVOR` env var — the project avoids
  `import.meta.env`). `index.tsx` then renders the full `ShellApp` (shell flavor)
  or `StandaloneApp` (one app mounted at its `rootRoute`).
- **Build** (`build_app.ps1` → `scripts/flavor/flavor_build.py`): the Python helper
  writes `capacitor.config.json` (appId/appName/colors) and prepares
  `resources/icon.png` + `resources/splash.png`; then `vite build` runs with the
  flavor selected; then (optional) `npx cap sync` packages the native app.
- **Native vs web**: `-Native` sets `VITE_BUILD_TARGET=native`, which makes
  `vite.config.ts` drop the `@capacitor/*` browser shims so the REAL plugins are
  bundled (install them first). Web/default keeps the shims.

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
npm install @capacitor/core @capacitor/cli @capacitor/android   # + the plugins you use
npx cap init                 # uses capacitor.config.json
npx cap add android
./build_app.ps1 -App wordnew -Native -Sync
```

## Adding a new flavor

1. Create `flavors/<id>/flavor.json` (+ `icon.svg`, optional `icon.png`/`splash.png`).
2. Add `import <id>Flavor from '../flavors/<id>/flavor.json';` + include it in the
   registry array in `shell/flavor.ts`.
3. If the app isn't already in `shell/StandaloneApp.tsx`'s `APP_LOADERS`, add its
   lazy import there.
