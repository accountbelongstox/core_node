---
name: type-check-on-windows
description: mcp-chrome tsc/vue-tsc cannot run on Windows node (LX symlinks in node_modules); run them in Debian WSL with a portable Linux node
metadata:
  type: feedback
---

`apps/mcp-chrome/node_modules` (and each app's) were installed by Linux bun: every package entry is a Linux symlink into `.bun/`. Windows node fails with `EPERM ... stat node_modules\vue-tsc` (and `typescript`), and the `\\wsl.localhost` UNC path is access-denied. Debian WSL resolves the links but has no node of its own.

**Why:** the D22 G1 checks (2026-09-27) needed tsc in app/native-server and vue-tsc in app/chrome-extension.

**How to apply:** download `node-v22.x-linux-x64.tar.xz` from nodejs.org into the session scratchpad, then from WSL run `<node> node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.json` in `/mnt/d/.../app/chrome-extension` and `<node> ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` in `app/native-server` (about 1 to 6 minutes each). While `packages/shared/dist` is stale, the baseline shows 7 native and 5 extension errors, all "chrome-mcp-shared has no exported member" or `SIGN_CLIENT_REQUEST`; compare against that baseline. See [[native-host-stdio-and-shared-dist]].

Builds (`bun run build`) need a Linux bun too: `bun-linux-x64.zip` (same version as Windows `bun --version`) from the oven-sh GitHub releases; unzip with `python3 -m zipfile -e` (Debian has no unzip). WSL's `which bun` finds the Windows bun through PATH interop, so set PATH explicitly. Invoke WSL from Git Bash as `MSYS_NO_PATHCONV=1 wsl.exe -d Debian -- bash /mnt/d/<scratchpad>/script.sh`: inline `bash -lc '...'` loses `$VARS` and MSYS rewrites `/mnt/...` paths. Write the script with LF endings.

Line endings: check with `git ls-files --eol <file>` (index vs worktree), not only `grep -c $'\r$'`; `core.autocrlf=true` here, and the Edit tool writes the ending it detects.
