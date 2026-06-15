# Cross-OS / Relative Path Conversion Specification

Canonical, single source of truth for how AI assistants (Claude, OpenAI/Codex,
Cursor, Gemini, etc.) and developers must handle paths in this monorepo.
When this file changes, update every AI entry point that references it
(`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursor/rules/path-conversion.mdc`).

---

## 1. Why this rule exists

The same repository is reached through different shells/hosts that each use a
different path syntax and a different set of available commands. A path or
command copied verbatim from a prompt that came from one environment will fail
in another. Example that triggered this spec: a user ran
`./poly_apps/laravel_main/scripts/start.sh` from **WSL**
(`/mnt/d/programing/core_node`); the script then called `composer`, which is not
on `PATH` in that environment — `composer: command not found`.

The AI must **not** blindly reuse the path/command form from the prompt. It must
convert to the form valid for the environment that will actually execute the
command.

---

## 2. The repository root in every environment

This repo's canonical Windows location is `D:\programing\core_node`. Equivalent
roots — convert between these as needed:

| Environment | Repository root |
|---|---|
| Windows (PowerShell / cmd) | `D:\programing\core_node` or `D:/programing/core_node` |
| Git-Bash (Claude Code `Bash` tool on Windows) | `/d/programing/core_node` |
| WSL / Ubuntu | `/mnt/d/programing/core_node` |
| Deployed Linux server | `/www/wwwroot/core_node` |

Path-segment rules:
- `D:\x\y`  ↔  `D:/x/y`  ↔  `/d/x/y`  ↔  `/mnt/d/x/y`
- Drive letter `D:` → `/d` (Git-Bash) → `/mnt/d` (WSL); reverse the same way.
- Backslashes are Windows-only; forward slashes work in Git-Bash/WSL/Linux and
  in most Windows tooling — prefer forward slashes when the form is ambiguous.

---

## 3. What the AI must do on every prompt

1. **Detect the source path style in the prompt** (`D:\…`, `D:/…`, `/d/…`,
   `/mnt/d/…`, `/www/wwwroot/…`, or relative).
2. **Detect the executing environment** from the session context (OS, shell,
   primary working directory, which tool will run the command).
3. **Convert** the path to the form valid for that executing environment using
   the table in §2 before passing it to any tool. Never pass a WSL `/mnt/d/...`
   path to a Windows/Git-Bash tool (or vice versa) unchanged.
4. **Resolve relative paths to absolute** against the repo root for the target
   environment. For PowerShell (`*.ps1`) do not concatenate strings or use
   `..\..\`; resolve with `Split-Path` / `Join-Path` / `Resolve-Path`
   (consistent with the global PowerShell rule).
5. **Do not assume command availability across environments.** A binary present
   in one shell (e.g. `composer`, `php`, `node`) may be absent in another.
   Verify it exists in the executing environment, resolve an absolute binary
   path, or use that environment's launcher/installer instead of failing.

---

## 4. Quick conversion examples

| In prompt (source) | Convert to (target environment) |
|---|---|
| `/mnt/d/programing/core_node/poly_apps/laravel_main` (WSL) | `/d/programing/core_node/poly_apps/laravel_main` (Git-Bash) or `D:\programing\core_node\poly_apps\laravel_main` (PowerShell) |
| `D:\programing\core_node\scripts\start.ps1` (Windows) | `/mnt/d/programing/core_node/scripts/start.ps1` (WSL) |
| `./poly_apps/laravel_main/scripts/start.sh` (relative) | absolute repo-root form for the executing env (see §2) |
| `/www/wwwroot/core_node/...` (deployed Linux) | local dev root equivalent from §2 when working locally |

---

## 5. Scope

Applies repo-wide to all assistants and to every `app/`, `poly_apps/`,
`ncore/`, `pycore/`, and `scripts/` path. App- or stack-specific guides may add
clauses but must not contradict this canonical spec.

---

## 6. Application runtime path resolution (mandatory)

Every filesystem path the Laravel app (`poly_apps/laravel_main`) resolves at
runtime MUST go through the canonical mapper
`App\Providers\PathMapper::mapWebPath($key, $subPath)` — or a `PathMapper`
helper that delegates to it. The following are **prohibited** for runtime path
resolution: raw `storage_path()`, `base_path()`, `database_path()`,
`env('*_PATH')`, and ad-hoc string concatenation of root directories. The
reason is the same as §1: `storage_path()`/cwd-relative paths differ between the
`php artisan sys:init` CLI process and the Octane HTTP worker and do not map to
the portable `www` root across WSL / Windows / Ubuntu.

- The path-key registry is the `match($pathKey)` block inside
  `PathMapper::mapWebPath()`. Register new logical roots there; never inline a
  root elsewhere.
- AppQyV1 external data resolves via key `app_external_data` →
  `<www>/wwwroot/laravel_db/external_data` (Windows `D:\www\...`,
  WSL `/mnt/d/www/...`, Ubuntu/deployed `/www/...`). Markers, word audio and
  sentence sounds derive from it via
  `PathMapper::getAppQyV1ExternalDataRoot('<sub>')` /
  `getAppQyV1AudioDir()` / `getAppQyV1SentenceSoundsDir()`.
- **Sanctioned override:** an absolute path explicitly pinned via env
  (`DICT_EXTERNAL_DATA_PATH`, `DB_DATABASE`, …) is the only allowed bypass and
  is honored verbatim. The `storage_path()` defaults in `config/AppQyV1.php`
  are sentinels that `PathMapper` detects and replaces with the mapped
  location; do not treat them as real paths.
- CLI (`php artisan sys:init`) and the Octane worker MUST resolve byte-identical
  paths. Any helper whose result depends on `storage_path()`/cwd violates this.

Keys registered with this revision: `app_external_data`.
