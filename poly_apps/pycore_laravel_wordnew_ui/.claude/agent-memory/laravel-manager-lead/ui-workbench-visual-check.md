---
name: ui-workbench-visual-check
description: How to render and screenshot a laravel-manager tool workbench without running the app build (esbuild harness + headless Chrome)
metadata:
  type: reference
---

No dev server allowed, but a scratch harness works: esbuild API (`nodePaths` = UI node_modules, `alias @`, plugin that turns `?raw` imports into text, jsx automatic) bundles a page that mounts `WEB_WORKBENCHES[id]` with an i18next init; serve the folder with `python3 -m http.server` (file:// gives opaque "Script error."), load `@tailwindcss/browser@4` from jsdelivr plus `@custom-variant dark`, then `google-chrome --headless=new --no-sandbox --virtual-time-budget=9000 --screenshot|--dump-dom`. QR output can be verified with `zbarimg` and OpenCV (cv2 detector fails on big versions; zbar decodes all).
Keep the harness in the session scratchpad, never in the repo.
