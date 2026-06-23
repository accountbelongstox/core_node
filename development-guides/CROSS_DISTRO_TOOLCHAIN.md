# Cross-distro dev toolchain & package managers (Kali / Debian / Ubuntu)

How this repo installs and runs Node/npm/pnpm/yarn, Python tooling (pipx/poetry/uv), PHP,
and the rest — identically across Kali, Debian and Ubuntu, under one per-distro prefix.

## The model

- **One install set:** `scripts/shells/linux/debian/install_shells/<NN>_*.sh` (run in numeric
  order via the `dd.sh` menu / bootstrap). Each is idempotent — safe to re-run.
- **One per-distro prefix — `COMPILE_DIR`:** every toolchain installs under
  `COMPILE_DIR = /opt/_<distro>_<version>` (e.g. `/opt/_kali_2026`, `/opt/_ubuntu_24`,
  `/opt/_debian_13`). Resolved by `map_web_path "compile_dir"` in
  `scripts/shells/linux/common/gvar_common.sh`. Nothing is hard-coded per distro — the
  prefix carries the distro/version.
- **One PATH for all users — `/usr/local/bin`:** binaries installed under `COMPILE_DIR` are
  symlinked into `/usr/local/bin`, so every user (and root) gets them without per-user PATH
  edits. Global env vars go to `/etc/environment`.
- **Cross-distro gate:** `is_debian_based()` (gvar_common.sh) accepts the whole Debian family
  via `ID` + `ID_LIKE`, so Kali (`ID=kali`, `ID_LIKE=debian`) and Ubuntu take the Debian path.
- **Region mirror:** `SELECTED_REGION` switches registries (China → Huawei Cloud mirror,
  else the upstream registry) for npm/pnpm, pip, apt, etc.

## Per-toolchain layout (under `$COMPILE_DIR`)

| script | tool | installs to | linked into `/usr/local/bin` |
|--------|------|-------------|------------------------------|
| `13_ensure_python.sh` | Python + venv | `$COMPILE_DIR/python3_venv` | `python3`, `pip` |
| `15_install_node_24.sh` | Node 24 / npm / npx / **pnpm** / yarn | `$COMPILE_DIR/node/node-v24.x` | `node npm npx pnpm yarn` |
| `16_enable_pipx.sh` | pipx | `$COMPILE_DIR/pipx_venv` (`PIPX_HOME=$COMPILE_DIR/pipx_home`) | `pipx` (tool shims → `PIPX_BIN_DIR=/usr/local/bin`) |
| `17_enable_poetry.sh` | poetry | `$COMPILE_DIR/poetry_venv` | `poetry` |
| `19_install_uv.sh` | uv | `$COMPILE_DIR` | `uv` |
| `31_ensure_php85_intelligent.sh` / `34_install_composer.sh` | PHP 8.5 / Composer | distro PHP + `/usr/local/bin` | `php`, `composer` |

Other `install_shells/*` cover dotnet (37), flutter (38), ruby (41), rust (42), redis (45),
nginx (25), etc. — same prefix + symlink model.

### Node / npm / pnpm / yarn (`15_install_node_24.sh`)
- Node → `$COMPILE_DIR/node/node-v<ver>/bin`; `node/npm/npx` symlinked to `/usr/local/bin`.
- `pnpm` and `yarn` installed via `npm install -g`, then symlinked to `/usr/local/bin`.
- npm global packages live under `$COMPILE_DIR` (not `~`); pnpm `global-dir` /
  `global-bin-dir` are set under the node install dir; a `~/.pnpmrc` carries pnpm settings.

## pnpm build-scripts gotcha (`ERR_PNPM_IGNORED_BUILDS`)

What fails a frontend `start.sh` after a fresh Node install. **Mind the pnpm major version** —
the build-approval mechanism changed:

- **pnpm 11** (what `15_install_node_24.sh`'s `npm i -g pnpm` actually installs — currently
  11.8.x): a dependency's build/postinstall scripts are NOT run unless approved in
  **`pnpm-workspace.yaml`** under **`allowBuilds`** (a MAP). `strictDepBuilds` defaults to true,
  so any UNREVIEWED build aborts `pnpm install` with `ERR_PNPM_IGNORED_BUILDS` (exit 1), and
  `pnpm exec` / `pnpm run` re-trigger the same check (`verifyDepsBeforeRun`). pnpm auto-writes
  unreviewed deps with a placeholder `dep: "set this to true or false"` — that placeholder is
  **not** an approval.
- **pnpm ≤10** used `onlyBuiltDependencies: [...]`; that key was **removed in pnpm 11**, and the
  `pnpm` field in `package.json` is ignored (the harmless `"pnpm field … no longer read"` warning).

**Fix — approve the build in `pnpm-workspace.yaml`** (per project, next to its `package.json`):
```yaml
allowBuilds:
  esbuild: true          # flip pnpm's placeholder to `true`; esbuild's postinstall is required
  # better-sqlite3: true # add native-build deps the project actually uses
  # puppeteer: true
```
Flipping the value to `true` is enough: the next `pnpm install` runs the now-approved build
even on an "Already up to date" tree, clears `node_modules/.modules.yaml`'s `ignoredBuilds`, and
exits 0 — so `pnpm exec vite` passes too. Non-interactive bulk approve: `pnpm approve-builds --all`.
Don't rely on `onlyBuiltDependencies` (dead on v11) or the `package.json` `pnpm` field.

> Pin caveat: root `package.json` has `packageManager: pnpm@10.32.0`, but corepack isn't active,
> so `/usr/local/bin/pnpm` (from `npm i -g pnpm`) is the v11 that actually runs. Use `allowBuilds`.

## Running a frontend (`poly_apps/*/scripts/start.sh`)

`start.sh` installs prerequisites (node/pnpm + deps), optionally builds `dist/`, then serves
(Vite dev or `vite preview`). It keeps existing `node_modules` when an install doesn't finish
cleanly; pass `-f` / `--force-install` to recreate them from scratch. The deps check runs
`pnpm install` again at dev-server start — so the `allowBuilds` approval above is required
for a clean start, not optional.
