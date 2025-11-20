# Nuxt Remote Factory Sync Plan

## Goal
Create an enhanced `switch-app-entry` pipeline that mirrors each Nuxt app into the unified build root produced by `map_web_path` (e.g. `D:\programing\.build_dir\nuxt_factory\_linux\app_{name}`), keeps the clone in sync, and runs the PNPM dev/build commands from that clone so multiple app debuggers can coexist.

## Proposed Workflow

1. **App Resolution**
   - Accept app name from CLI/env (`APP_ENTRY`).
   - Derive compile directory using the same algorithm as `map_web_path` in `scripts/shells/linux/common/gvar_common.sh` → `D:\programing\.build_dir\nuxt_factory\_linux\app_{app}`.

2. **Initial Sync**
   - Create compile dir if missing.
   - Copy only new/changed files from `poly_apps/nuxt_main` into the compile dir.
   - Remove stale files that exist only in the compile dir so both trees match exactly.

3. **Entry Switch**
   - Run the existing `switch-app-entry` logic inside the compile dir to materialize `pages/index.vue` for the selected app.

4. **Dual Thread Runner**
   - Start a Node process with two workers:
     - **Watcher Thread**: `chokidar` on source tree, batching changes every 2s and re-syncing the affected files (add/update/remove) into the compile dir.
     - **PNPM Thread**: launches `pnpm dev:{app}` (or build) from inside the compile dir with `APP_ENTRY={app}` so Nuxt runs against the cloned tree.

5. **Runtime Behavior**
   - Any edits in the source repo propagate automatically to the clone.
   - If the pnpm process exits, capture logs and optionally restart based on flags.
   - The script never edits the source tree; it only mirrors changes outward.

6. **Next Steps**
   - Implement prototype script.
   - Test full cycle (sync → switch → dev server) for at least one app.
   - Document new workflow in developer guides after successful tests.

## Status
Design documented. Implementation and verification pending.
