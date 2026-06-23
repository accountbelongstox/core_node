# History.txt ⇄ codebase reconciliation report

**Source:** `_prompts/History.txt` — a Claude Code transcript export (14 sessions / 15 blocks,
1,893 tool calls, generated 2026-06-23 11:45:21). Every path in it uses the **old drive mount**
`/mnt/dev_nvme0n1p1/...`; the current project root is `/mnt/dev_nvme1n1p1/programing/core_node`.
This is the **same repository** previously on another mount — the recorded work was already applied
there, so reconciliation is mostly *verify-it-is-present* + *prune the log*, with forward-only fixes
for genuine gaps.

**Strategy (user-chosen):** verify current code → apply forward-only fixes for genuine gaps
(never revert) → prune reconciled blocks tail-first → log ranges in `History.deletions.txt`.
**Sources:** `History.txt` only. Backup of the original log: `_prompts/History (copy 1).txt`.

**Hard constraints honored:** only `git commit` (no other git ops); no revert/overwrite of existing
code or the user's uncommitted changes; truncated-and-unrecoverable content surfaced, never
fabricated. 685 truncation markers mean byte-exact 1:1 restore is impossible for many edits —
verification relied on file existence + untruncated snippets, and forward-fixes were taken verbatim
from untruncated recorded edits where available.

**Result: History.txt 58,304 → 11,292 lines.** 11 blocks pruned; 4 kept (genuine un-applied /
decision-needed work).

---

## Per-block status (tail-first = latest-first)

| # | orig lines | session | verdict | action |
|---|-----------|---------|---------|--------|
| 15 | 58290–58304 | 38387177 | header + 1 truncated prompt, no mutations | **PRUNED** |
| 14 | 58177–58289 | c3c67a65(dup) | `claude_tools/README.md` present | **PRUNED** |
| 13 | 57848–58176 | a3c83991 | `extract_claude_history.{py,sh}` present | **PRUNED** |
| 12 | 53233–57847 | de800a42 | 8 task-system files present/superseded | **PRUNED** |
| 11 | 36039–53232 | 12d3adc4 | PHP/Kali install fixes + AI-safety doc present | **PRUNED** |
| 10 | 35200–36038 | c3c67a65 | claudeteam opus-force edits present | **PRUNED** |
| 9 | 31259–35199 | 72f100dd | product code present; 2 docs + 1 scratch lost (unrecoverable) | **PRUNED** (loss recorded ↓) |
| 8 | 25721–31258 | 1cdf1159 | 13 cross-OS launcher files present | **PRUNED** (after F1) |
| 7 | 15414–25720 | c4f2933e | install merges + AI-safety rollout present/superseded | **PRUNED** |
| 6 | 13493–15413 | 3330ef60 | ~59 install-script fixes never committed; unrecoverable | **KEEP** (F7 fixed 1) ↓ |
| 5 | 10858–13492 | 5849e1f9 | autostart backend un-applied → UI/API mismatch | **KEEP** ↓ |
| 4 | 10838–10857 | 633c359a | "HI" greeting, no mutations | **PRUNED** |
| 3 | 7416–10837 | ce3decd1 | prompt-5 legacy retirement not persisted (re-doing = a deletion) | **KEEP** ↓ |
| 2 | 4106–7415 | db694d3b | F2/F3 applied; F4/F5 need a decision | **KEEP** (after F2/F3) ↓ |
| 1 | 5–4105 | 6245db8a | claude/CUDA tooling present | **PRUNED** (after F6) |

---

## Forward-fixes — APPLIED (additive only; never a revert; all `bash -n` clean)

| id | file | change |
|----|------|--------|
| F1 | `…/install_shells/32_install_swoole.sh` (L304) | diagnostic now lists all 4 temp-dir candidates (`GLOBAL_TEMP_DIR, TMPDIR, /var/tmp, /tmp`) |
| F2 | `…/install_shells/50_install_mysql.sh` (L39) | dropped `local` used at script scope (runtime error "local: can only be used in a function") — verbatim recorded edit |
| F3 | `…/common/gvar_common.sh` | `PUPPETEER_SKIP_DOWNLOAD=true` set once-only (silence the per-source "Successfully set…" spam) — verbatim recorded edit |
| F6 | `…/dd_helper/linux_management.sh` | re-added the CUDA-toolkit slim-menu entry + `install_cuda_toolkit_menu()` (installer already present; uses the file's existing `$CORE_NODE_ROOT_DIR`) — verbatim recorded 3-edit set |
| F7 | `…/install_shells/120_install_desktop_applications.sh` | `fix_npm_permissions` → `fix_pnpm_permissions` ×4 (the called name was **defined nowhere** in the repo = guaranteed runtime error) |

## Forward-fixes — NOT applied (would revert newer code, or ambiguous) → human decision

- **F4 — apt backups location (block 2).** The recorded edit changed `apt_repository_manager.sh`'s
  `APT_BACKUP_BASE_DIR` to live *outside* the repo (`/var/_core_node/...`). The **current**
  `apt_repository_manager.sh` was rewritten *later* to keep backups *inside* the repo
  (`$APT_REPO_MANAGER_DIR/apt_repository_backups`, 540 files tracked). Applying the session edit
  would **revert newer code** → not done. Decide: keep backups in-repo (newer design) or move them
  out (older intent, safer cross-distro). (There was **no** real `.gitignore` edit — an earlier
  analyst note misattributed it.)
- **F5 — `13_ensure_python.sh` ubuntu-keyring gate (block 2).** Session gated
  `apt-get install -y ubuntu-keyring` to Ubuntu-only (it doesn't exist on Debian/Kali). Current code
  installs it unconditionally, but `13_ensure_python.sh` was also **rewritten by a newer session**,
  and the recorded gate edit is **truncated** → can't confirm whether the current state is newer
  intent or an un-migrated gap, and can't restore 1:1. Decide whether to add an Ubuntu-only guard.

## Un-applied / unrecoverable work — surfaced (blocks KEPT)

- **Block 5 (5849e1f9) — autostart-target backend NOT applied → live UI/API contract mismatch.**
  Frontend landed (`pycoreTypes.ts` `AutostartTarget`, `PycoreApi.setAutostart`, `PcSettingsPage`
  target selector) but the backend (`control_router.AutostartRequest` is only `{enabled:bool}`; the
  linux/windows/startup managers were rewritten in a **newer** pyservice-only direction) never honors
  `target` — so the boot-target selector is inert. `autostart_target.py` /
  `systemd_user_startup_manager.py` / `AUTOSTART.md` were never committed and are truncated → no 1:1
  restore. **Decision:** forward-port an optional `target` onto the current managers, OR remove the
  inert UI. Not auto-fixed (would risk contradicting newer code).
- **Block 3 (ce3decd1) — legacy retirement did NOT persist.** Prompt 5 of this session removed the
  legacy `dev_system_old` web-path key, the `old_compile_dir` Python key, and the `migrate_*`
  legacy-install functions across 8 files (`gvar_common.sh`, `common_functions.sh`,
  `system_paths.py`, `15_install_node_24.sh`, `28_ensure_pnpm_packages.sh`, `29_ensure_npmrc.sh`,
  `120_install_desktop_applications.sh`, `webpath_permissions.sh`). All those symbols are **back and
  live** in the current tree. Re-applying = **deleting currently-live code**, which the
  no-revert/no-delete policy forbids. **Decision:** keep the legacy machinery, or authorize a
  deliberate re-retirement. (Prompts 1–4 + 6 of this session — path/install infra + the Linux
  terminal launcher — ARE present/superseded; only prompt 5 is the blocker.)
- **Block 6 (3330ef60) — ~59 install-script idempotency / cross-distro fixes left unstaged on the
  old drive, never committed.** Verified still-present pre-fix bugs, e.g. `121_install_cursor.sh`
  runs destructive `sed -i /^PATH=/d` before reading current PATH; `101_natgateway.sh` has
  Ubuntu-only header + `gawk` mapping + raw `apt-get`. F7 fixed the one concrete, verifiable bug
  (`120_…` undefined `fix_npm_permissions`). The per-script edits are truncated → the bulk cannot be
  restored 1:1; the dir has also diverged via committed merges. **Recovery = re-run the
  audit/remediation against the current tree.**

## Unrecoverable losses recorded (block pruned anyway — code was applied)

- **Block 9 (72f100dd):** `development-guides/UNIFIED_TASK_SYSTEM_AS_BUILT.md` and
  `…_UPGRADE_PLAN.md` were created then lost (PLAN generated from now-gone /tmp outputs; AS_BUILT
  Write truncated) → not restorable 1:1. `verify_phase1.php` was a throwaway tinker scratch.
  **All product code from this session IS present** → block pruned; regenerate the two docs from the
  live code if still wanted.

## Out-of-scope (noted, not acted on)

- `~/.claude/.../memory/*.md` and `.claude` temp workflow scripts (Claude-internal, not project code).
- `.gitignore` tail shows unrelated UTF-16-style byte corruption
  (`p o l y _ a p p s / t o p - r o u t e r …` at the end of the file) — flagged for the user; not
  part of this reconciliation.
