# shell-linux handoff report

## p1-linux: dual-boot drive layout, P1 Linux safety

- Status: implemented, awaiting reviewer (SAFETY constraints forbade running installers/mount/fstab/udev/grub; verified with `bash -n` and read-only greps only).
- Record: `docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md` sections 2, 3, 4 (phase P1). Contract: `config/service_contract.json` `paths.drive_layout`.
- Fenced files edited (only these): `scripts/shells/linux/common/gvar_storage_common.sh`, `scripts/shells/linux/common/shared_cache_env.sh`, `scripts/shells/linux/common/mount_common.sh`, `scripts/shells/linux/common/pyservice_entry.sh`. `gvar_common.sh` was fenced but left unmodified: everything it needs (CN_TREE_MNT/CN_TREE_BACKING/CN_TREE_CACHE_ROOT and the 5 toolchain cache vars) already reaches it for free, since `gvar_system_common.sh` sources `shared_cache_env.sh` before `gvar_common.sh` reaches its own directory-variable section -- adding a second definition there would have violated the "one definition" rule.

### Changed files (line ranges are post-edit)

- `scripts/shells/linux/common/gvar_storage_common.sh`
  - L3-28: new `get_program_drive_partuuid()`. Reads the program-drive PARTUUID (contract `program_partuuid`) from the global var store under key `CN_PROGRAM_PARTUUID`. Uses `get_var` when defined; otherwise reads the on-disk var-store file directly (`$GLOBAL_VAR_DIR/${OS_VAR_TAG}_CN_PROGRAM_PARTUUID` then the bare name), because this file's own `detect_desktop_windows_drives()` call (L620, unchanged call site) runs at source time BEFORE `global_var_store.sh` is sourced by `gvar_common.sh` -- the direct-file read keeps the exclusion effective even at that early point.
  - L30-53: `get_largest_ntfs_with_size` now excludes the device whose `blkid -s PARTUUID` matches the program-drive PARTUUID.
  - L318-364 (function body L346-364): `get_dev_compile_base` rewritten per requirement 1 -- always `/opt` (sticky check kept as-is), free-space check is now advisory-only (English warning, never a fallback), and the `IS_WSL` branch plus the `get_base_data_directory` (NTFS) fallback are both removed.
  - L491-524 (function body L495-524): `determine_largest_windows_drive` (feeds `get_base_data_directory` priority 4) now skips the drive whose underlying device (`findmnt -o SOURCE` on the `/media/$USER/<letter>` mountpoint) matches the excluded PARTUUID.
  - Left for another lane: the pycore (`pyfoundations/system_paths.py:204-231`) and Laravel (`PathMapper.php:690-708`) mirrors of the `get_dev_compile_base` change, per the requirements doc's own note that they "must change in lockstep."

- `scripts/shells/linux/common/shared_cache_env.sh`
  - L23-42: new declarations `CN_TREE_MNT`, `CN_TREE_BACKING`, `CN_TREE_CACHE_ROOT`, `BUN_INSTALL_CACHE_DIR`, `npm_config_cache`, `UV_CACHE_DIR`, `COMPOSER_CACHE_DIR`, `COREPACK_HOME` plus scratch vars, all declared empty at top per the file's existing "variable declarations" convention.
  - L48-105: new block. Sources `service_contract_common.sh` if `sc_get` isn't already defined, reads `paths.drive_layout.tree_root.{linux,linux_backing}`; on an unreadable contract (fresh machine, no node/php) logs one English line and stops (never guesses/falls back to NTFS). Resolves `CN_TREE_CACHE_ROOT` to `CN_TREE_MNT/cache` only when `findmnt -no FSTYPE -M "$CN_TREE_MNT"` reports ext2/3/4, else `CN_TREE_BACKING/cache`. mkdirs the 5 cache subdirs (bun/npm/uv/composer/corepack) best-effort (same `mkdir || sudo -n mkdir` pattern already used elsewhere in this file, not `$USE_SUDO`, since this file must stay usable when sourced directly by `pyservice_entry.sh` without `gvar_common.sh`/`USE_SUDO` ever having been set). Exports the 5 cache vars via `: "${VAR:=...}"` (respects a caller override, still outranks each tool's own `XDG_CACHE_HOME` default). `XDG_CACHE_HOME` itself: unchanged, per the task's explicit instruction. pnpm store: untouched, per the task's explicit instruction (noted for P3).

- `scripts/shells/linux/common/mount_common.sh`
  - L19-56 (new logic L29-35): `mount_fstab_ensure_single_entry` now writes fsck pass 0 for `ntfs|ntfs3|fuseblk|ntfs-3g`, pass 2 unchanged for everything else.
  - L124-156: `detect_ntfs_disks` skips the excluded PARTUUID device (same helper/lookup as `get_largest_ntfs_with_size`).
  - L158-217: new `PROGRAM_DRIVE_UDEV_RULE_FILE` constant (L162) and `ensure_program_drive_udev_exclusion()` (L173-217) (writes `/etc/udev/rules.d/99-core-node-ignore-program-drive.rules` only when content differs; no-ops gracefully when the PARTUUID is unknown, the contract is unreadable, or `linux_mounts_program_drive` isn't `false`).
  - L219-262: new `warn_ntfs_dirty_windows_repair()` (English warning + `grub-reboot` gated on `GRUB_DEFAULT=saved` and a discovered Windows `menuentry`, else a manual-step message). **Neither this nor `ensure_program_drive_udev_exclusion` is called from anywhere in this task's fenced files** -- both are left for the lane that owns `3_setting_base.sh` to wire in (the latter is also called by `mount_disk`/`handle_ntfs_disk` below on the dirty-volume path).
  - L349-360: `update_fstab`'s log line now reports the real fsck pass instead of a hardcoded "0 2".
  - L383, L566 (post-edit; the two `mount_options=` assignments in `mount_disk` and `handle_ntfs_disk`): `windows_names` added to both NTFS mount-option strings.
  - `mount_disk` (L362-425, fallback L400-419) and `handle_ntfs_disk` (L431-638, fallback L566-609): the ntfs3-dirty-volume fallback no longer persists the fallback type into fstab (this was the documented root cause of the dirty-volume loop). It now mounts explicitly with `-t ntfs-3g` for that boot only, calls `warn_ntfs_dirty_windows_repair`, and fstab keeps `ntfs3`. `handle_ntfs_disk`'s old `_tries` retry loop is replaced with an explicit two-step (try `ntfs3`, on failure try `ntfs-3g`) so the fallback type is never looped back into `ntfs_type`/persisted.
  - L953-1011: new `ensure_tree_root_bind_mount()` (idempotent fstab bind `<backing> <mnt> none bind,nofail,x-systemd.requires-mounts-for=/www 0 0`, only when `/www` is the NTFS dual-boot share; mkdir of the plain mountpoint only). **Not called anywhere in this task's fenced files** -- left for the `3_setting_base.sh` lane.

- `scripts/shells/linux/common/pyservice_entry.sh`
  - `build_worker_env_args` (L710-724), forwarding list at L717-722: gains exactly `BUN_INSTALL_CACHE_DIR npm_config_cache UV_CACHE_DIR COMPOSER_CACHE_DIR COREPACK_HOME`. This is the ONLY edit made to this file, per the fence note that the rest of it belongs to another role.

### Verification (SAFETY: no installers/mount/umount/fstab/udev/grub commands were run)

- `bash -n` passes on all 5 fenced files.
- CR count is 0 on all 5 (LF-only, unchanged).
- `git diff --stat`: `gvar_storage_common.sh` +/-, `mount_common.sh` +/-, `shared_cache_env.sh` +, `pyservice_entry.sh` 1-line change, `gvar_common.sh` untouched (0 diff).
- Greps confirm: `windows_names` appears exactly twice (both NTFS mount-option strings); no `force`/`ntfsfix` introduced (only the two comments that say "never use/run" them); the four historical `0 2` fsck literals are now `0 $fsck_pass` (x2), `0 0` (handle_ntfs_disk, always NTFS) and one untouched `0 2` (handle_data_disk, non-NTFS, correctly left alone).

### Known limitation (flagged, not fixed here -- would require restructuring gvar_common.sh's load order, out of this fence)

- `gvar_storage_common.sh`'s own top-level `detect_desktop_windows_drives()` call runs during sourcing, before `global_var_store.sh` defines `get_var`. `get_program_drive_partuuid` works around this for its own callers by reading the var-store file directly, so `get_largest_ntfs_with_size` / `get_base_data_directory` priority 3 are correctly exclusion-aware whenever actually invoked later. Priority 4's `DESKTOP_LARGEST_WINDOWS_PATH`, however, is computed ONCE at that early top-level call and cached in an exported variable; if `GLOBAL_VAR_DIR`/`OS_VAR_TAG` were for some reason not yet set at that exact point either, the very first sourcing pass could miss the exclusion for that specific rare priority-4 path (multi-boot desktop with Windows drives auto-mounted under `/media/$USER`). This does not affect the primary dual-boot scenario (priority 3), which is correctly fixed.
- `CN_PROGRAM_PARTUUID` is currently an OS-tagged var-store key (via `get_var`'s default behavior), not a cross-OS shared key, because making it shared requires adding it to `CORE_NODE_SHARED_GVAR_KEYS` in `runtime_environment.sh` (not fenced for this lane) and to the Windows mirror `$script:SharedGlobalVarKeys` in `CommonFunc.ps1` (shell-windows). Until P2 wires up Windows recording `program_partuuid` on first E: adoption, `get_program_drive_partuuid` simply returns empty everywhere (no exclusion active), which is the correct, safe default for today.

### Parity (binding; ledger at `.claude/agents_shared/shell_parity/linux.md`)

- New rows: SPL-113 (get_dev_compile_base hard-pin), SPL-114 (PARTUUID exclusion hooks + udev rule), SPL-115 (tree-root constants + fstab bind), SPL-116 (toolchain caches off NTFS + pyservice_entry.sh forwarding) -- all `pending-windows`, referencing the requirements doc's own phase P2 ("Windows 3-drive keys with E: detection and fallback; Linux tree/tool roots; contract keys"), which is where `program_partuuid` actually gets recorded on the Windows side and where the Windows program-drive/tree-root/toolchain-cache counterparts belong.
- SPL-117 (mount_common.sh NTFS mount hardening: windows_names, fsck pass 0, dirty-volume ntfs-3g runtime fallback, grub-reboot) is `platform-only`: no Windows analog (Windows owns NTFS natively; its chkdsk/readiness flow is shell-windows' existing DiskRepairManager.ps1 / DualBootReadinessManager.ps1 from D1/D2).
- Alignment requests for the orchestrator to file for shell-windows (no live shell-windows/ct-shell-windows session was reachable via ListAgents at the time of this task -- only `ca-orchestrator` was live -- so this is written here per the workflow's "or in a workflow write it in your result" rule):
  - `[shell-windows] align: SPL-113 tool-root hard-pin (E: primary/D: fallback for tools, never silently NTFS-agnostic) -- P2 scope`
  - `[shell-windows] align: SPL-114 record program_partuuid on first E: adoption + Windows-side program-drive exclusion -- P2 scope`
  - `[shell-windows] align: SPL-115 Windows tree_root consumption (<program_drive>\core_node_trees) -- P2 scope`
  - `[shell-windows] align: SPL-116 Windows toolchain cache vars under tree_cache_root -- P2/P3 scope`

### Blockers

- None for this lane's own fenced files. Wiring `ensure_program_drive_udev_exclusion` and `ensure_tree_root_bind_mount` into an actual convergence step (`3_setting_base.sh` or a new step) is out of this fence and left for whichever lane owns that file next.
- Next owner: the reviewer (p1-linux verdict), then the P2 lanes (shell-windows, shell-linux, orchestrator for contract) per the phase table.

## p1-linux (review round): adjudicate + fix P1 findings

- Status: findings adjudicated, confirmed ones fixed, awaiting reviewer. SAFETY constraints (no installers/mount/fstab/udev/grub) honored; verification is `bash -n` plus harmless scratchpad probes (bash semantics only, no system state touched). shellcheck is not installed in this environment (`command -v shellcheck` empty) -- noted, not worked around.
- Fenced files for this round: `gvar_storage_common.sh`, `shared_cache_env.sh`, `gvar_common.sh`, `mount_common.sh`, `pyservice_entry.sh` (cache-vars-only). Edited: `gvar_storage_common.sh`, `shared_cache_env.sh`, `mount_common.sh`. Left unmodified: `gvar_common.sh` (no finding required a change), `pyservice_entry.sh` (its forwarding list at `build_worker_env_args` L710-724 was re-checked against every var this round's `shared_cache_env.sh` changes touch -- still exactly the 5 explicit cache vars, still correct, no edit needed).

### Findings: fixed

1. **HIGH - `shared_cache_env.sh` toolchain caches, no permission handling, unconditional export (both duplicate reports).** CONFIRMED by reading the model-cache block in the same file (which already does `chmod 1777` + `[ -w ]`-gated wiring) versus the new toolchain block (neither). Fixed: `CN_TREE_CACHE_ROOT` now gets a best-effort `chmod 1777` after creation; a new `__scc_wire_tool_cache` helper (L131-160) wires each of the 5 vars to `CN_TREE_CACHE_ROOT/<tool>` only when that subdir exists (creating + chmod'ing 1777 it first) AND is writable by the current euid, otherwise to a per-user `$HOME/.cache/core_node/<tool>` ext4 fallback -- never left unset, since an unset var would fall through to the tool's own `XDG_CACHE_HOME` default, which this same file can point at the NTFS cross-OS tree. Verified with a scratchpad probe (3 cases: contract-unreadable fallback, shared-root-writable preference, caller-override preserved) -- all three behaved as designed.
2. **MEDIUM - `shared_cache_env.sh` L36 top-of-file declarations wipe a caller's exported override (both duplicate reports).** CONFIRMED with a scratchpad probe: `VAR=""` then `: "${VAR:=default}"` always takes `default` even when the shell inherited an exported override, reproducing exactly the report's claim. Fixed: removed the 5 pre-declarations (`BUN_INSTALL_CACHE_DIR`/`npm_config_cache`/`UV_CACHE_DIR`/`COMPOSER_CACHE_DIR`/`COREPACK_HOME`) from the top block, matching the existing pattern for `HF_HOME`/`TORCH_HOME`/`XDG_CACHE_HOME` (also not pre-declared). Re-verified with the same probe style that an override now survives.
3. **MEDIUM - `shared_cache_env.sh` L75 bare `sc_get` assignment aborts `set -e` callers silently (both duplicate reports).** CONFIRMED with a scratchpad probe (`set -e; f(){ return 7; }; if true; then x="$(f)"; fi; echo survived` -> does NOT print "survived", exits 7) -- a command-substitution assignment inside an `if`-THEN body is NOT exempt from `errexit`. Fixed: every `sc_get` read in `shared_cache_env.sh` (`CN_TREE_MNT`, `CN_TREE_BACKING`, the new cache-root template read) and in `mount_common.sh` (`ensure_program_drive_udev_exclusion`'s `contract_probe` and `mounts_program_drive`) now has `|| VAR=""`.
4. **MEDIUM/LOW - `shared_cache_env.sh` L85 hardcoded `/cache` suffix and subdir names instead of reading the contract (two pairs of duplicate reports, one medium one low each).** Partially confirmed, fixed the confirmed part: `CN_TREE_CACHE_ROOT` is now built by substituting the resolved tree root into `sc_get paths.drive_layout.tree_cache_root` (`<tree_root>/cache`) instead of re-declaring `/cache` as a bare literal (falls back to the same literal only when the contract read is empty). Rejected fixing the per-tool subdir NAMES (bun/npm/uv/composer) as a generic loop over `sc_list paths.drive_layout.tree_cache_subdirs`: that list also contains `pnpm-store`, and P1's own explicit instruction (and the requirements doc's phase table) is "do NOT touch pnpm's store location in P1" -- looping over the full contract list would either silently create an unwanted pnpm-store dir or need extra exclusion logic that isn't simpler than 5 named calls. `corepack` is required by the task itself (item 4) but is genuinely not yet in the contract's `tree_cache_subdirs`; kept it (task requirement overrides), documented the gap in code and the ledger, flagged as a follow-up for ca-orchestrator.
5. **HIGH - `mount_common.sh` udev rule built from an unvalidated, world-writable PARTUUID (both duplicate reports).** CONFIRMED: `global_var_store.sh` creates `GLOBAL_VAR_DIR` and every var file at mode 777 (`ensure_core_state_roots`, `set_global_var`), and `get_var`/`get_global_var` returns the raw file content via `cat` with no sanitization; the old `get_program_drive_partuuid` passed that straight through into the udev rule's `desired_content` string. Verified the injection shape with a scratchpad probe (a value containing `", RUN+="..."` passes through unmodified). Fixed at the source: `get_program_drive_partuuid` (`gvar_storage_common.sh` L13-44) now normalizes (strip CR/BOM/braces/whitespace, lowercase) and shape-validates against a PARTUUID or MBR-signature regex, returning empty (with an English log line) for anything else -- this is also where finding 9 (below) is fixed in the same place. Re-verified with the same probe: the injection payload is now rejected, a real GUID (with braces/CRLF/uppercase, i.e. the shape a Windows writer would use) normalizes correctly.
6. **HIGH (both duplicate reports) + the near-duplicate MEDIUM report on `mount_common.sh` L474/481 - `handle_ntfs_disk`'s "already correct" fast path compares only the fstab mount point, never type/options/pass.** CONFIRMED by reading L505-513 (now L505-524 post-fix): `fstab_correct` was set from `awk '{print $2}'` equality alone, so a pre-existing entry with the persisted plain `ntfs` type (exactly the dual-boot machine this task targets, per the requirements doc's own root-cause section) reads as "already correct" and the whole hardening (`windows_names`, fsck pass 0, `ntfs3`) never applies. Verified with a scratchpad fstab fixture: the old single-field compare would have called a stale plain-`ntfs` entry "correct"; the new compare (below) correctly calls it "not correct". Fixed: `handle_ntfs_disk` now computes the full desired entry (`ntfs_mount_type` + `ntfs_mount_options` + pass 0) up front and requires an exact single-line match (`grep -Fxq` plus a UUID-count-of-1 check, mirroring `mount_fstab_ensure_single_entry`'s own fast path) before taking the "no action needed" branch; the later fstab-write code reuses the same precomputed values instead of recomputing them a second time.

### Findings: fixed as part of a broader, related fix (not a separate diff)

7. **MEDIUM - `gvar_storage_common.sh` L16 no CR/brace/case normalization of the PARTUUID.** CONFIRMED (see finding 5's evidence). Fixed by the same `get_program_drive_partuuid` rewrite as finding 5 -- normalizing is what makes the value comparable to `blkid`'s lowercase, brace-free output at every comparison site (`get_largest_ntfs_with_size`, `determine_largest_windows_drive`, `detect_ntfs_disks`) as well as safe to embed in the udev rule. Confirmed the resulting lowercase/no-brace format matches what shell-windows' `SharedCacheEnv.ps1` already writes into its `.cn_volume` marker (ledger row SPW-035), so no Windows-side format change is needed once it starts writing `CN_PROGRAM_PARTUUID`.
8. **MEDIUM - `mount_common.sh` L194/L195-199 (PHP's `echo false` prints an empty string, indistinguishable from "contract unreadable").** CONFIRMED by reading `service_contract_common.sh`'s PHP branch (`echo $c===null?"":$c;` -- PHP echoes boolean `false` as `""`, not `"false"`); that file is NOT fenced for this lane, so it cannot be edited directly. Worked around inside `ensure_program_drive_udev_exclusion` (mount_common.sh, fenced): reads a known non-boolean contract key (`paths.drive_layout.tree_subdir`) first as a readability probe, then treats an empty `linux_mounts_program_drive` (once the contract is confirmed readable) as the boolean `false` it actually is on a php-only host, instead of permanently skipping the rule there. Verified all 4 truth-table cases (node `false`/`true`, php-empty-for-false, genuinely-unreadable) with a scratchpad probe.
9. **LOW - `gvar_storage_common.sh` L507 bare `blkid`/`findmnt` assignments in `determine_largest_windows_drive` can abort a `set -e` caller (blkid exits 2 when the tag isn't found).** CONFIRMED (blkid(8) documents exit 2 for "specified token was not found"; this function is called directly, not via `$()`, from `detect_desktop_windows_drives` at file top level, unlike `get_largest_ntfs_with_size`'s callers which ARE wrapped in `$()` and so don't propagate). Fixed: both assignments now have `|| var=""`.
10. **LOW - `mount_common.sh` L215 bare `udevadm trigger` replays every device on the system.** CONFIRMED by reading the call (no `--action`/`--subsystem-match`/`--property-match`). Fixed: scoped to `--action=change --subsystem-match=block --property-match="ID_PART_ENTRY_UUID=$partuuid"` (safe now that `partuuid` is validated GUID-shaped by finding 5's fix).
11. **LOW - `mount_common.sh` L356 (+2 more copies) the NTFS-fstype/fsck-pass case list is duplicated three times in this file.** CONFIRMED (L33, L356, L980-982 in the pre-edit file). Fixed: added `mount_is_ntfs_fstype()`/`mount_fsck_pass_for_type()` (L16-32) and reused them from `mount_fstab_ensure_single_entry`, `update_fstab`, and `ensure_tree_root_bind_mount`'s findmnt fallback branch. `runtime_environment.sh`'s own copy is out of this lane's fence and untouched, as noted in the finding itself.
12. **LOW - `mount_common.sh` L978 `ensure_tree_root_bind_mount` reads the cached `CORE_NODE_WWW_BASE` (via `www_ntfs_root_mounted`) instead of a live probe, so it can read "not mounted" in the same run that just bound `/www`.** CONFIRMED: `runtime_environment.sh` computes `CORE_NODE_WWW_BASE` once at source time (before `ensure_www_base_mount` runs), and confirmed via grep that `ensure_tree_root_bind_mount` currently has 0 callers anywhere in the repo (so this is a forward-looking fix for whichever lane wires it into `3_setting_base.sh` next, not a live bug today). Fixed: swapped priority so a live `findmnt -no FSTYPE -M /www` probe (reusing `mount_is_ntfs_fstype`) runs first, with `www_ntfs_root_mounted` only as the fallback when `findmnt` itself is unavailable.
13. **LOW - `mount_common.sh` L400 ntfs3 mount failure is always diagnosed as "dirty volume", including an EINVAL from `windows_names` on a pre-6.2 kernel.** CONFIRMED as a real (if narrow) risk: `windows_names` was unconditionally added to the ntfs3 option set, and any non-zero mount exit is treated as "dirty". Debian 13 (6.12) and Ubuntu 26.04 (newer) are unaffected; Kali (rolling) is also unaffected in practice, so this had zero real-world impact on this project's actual targets, but the fix is cheap and correctness-improving. Fixed: new `ntfs3_supports_windows_names()` (kernel `>= 6.2`, per `Documentation/filesystems/ntfs3.rst`) gates the option only for the `ntfs3` driver via a new shared `ntfs_mount_options()` builder used by both `mount_disk` and `handle_ntfs_disk`; `ntfs-3g` always gets the option. Verified the version-comparison logic against 5 sample `uname -r` strings (5.15, 6.1, 6.2, 6.12, 7.0) in a scratchpad probe -- all classified correctly. This also removed the last remaining duplicate copies of the option-string literal (only `ntfs_mount_options` builds it now).

### Findings: rejected (with reason)

- **HIGH (both duplicate reports) - `mount_common.sh` L573, dirty-volume ntfs-3g fallback is runtime-only, nothing re-converges at the next boot.** Not rejected as wrong -- confirmed as a real, accepted gap, but NOT something to fix in this lane's fenced files: this is the exact, explicit behavior the original task text requested ("mount it read-write for this boot with ntfs-3g at runtime... do NOT persist the fallback type into fstab"), and the fix the finding suggests (a boot-time systemd oneshot unit ordered `Before=www.mount`) requires a NEW file outside this lane's fence, or edits to `3_setting_base.sh` (also outside the fence). The requirements doc already tracks this itself (section 3.6, "Make the disk setup a per-run convergence... today it is gated by DISK_SETUP_COMPLETED"). Recorded as a blocker/follow-up for the `3_setting_base.sh`/systemd lane, both in code comments (`warn_ntfs_dirty_windows_repair`'s doc comment already explained the boot-order issue) and in the ledger (SPL-117).
- **HIGH (both duplicate reports, same underlying issue as the "6." fix above) - `mount_common.sh` L481, the early return skips the NTFS hardening for a pre-existing mount.** This is the SAME bug as finding 6 (L474/481 both point at the same `fstab_correct` computation); already fixed there, not a second issue.

### Verification

- `bash -n` passes on all 3 edited files (`gvar_storage_common.sh`, `shared_cache_env.sh`, `mount_common.sh`) after every edit.
- `shellcheck`: not installed in this environment (`command -v shellcheck` -> not found). Not worked around (installing it would be a system-changing action outside SAFETY).
- Scratchpad probes (bash semantics only, nothing touched on disk outside `/tmp` and the scratchpad, no mount/fstab/udev/grub/apt commands run): PARTUUID normalize+validate (5 cases incl. an injection payload and a braced/CRLF GUID), `__scc_wire_tool_cache` (3 cases: fallback, shared-preferred, override-preserved), kernel-version gate (5 `uname -r` samples), `set -e` propagation through an `if`-body command substitution, the PHP-false-as-empty-string 4-case truth table, and the fstab exact-entry comparison (stale-entry vs. correct-entry fixtures).
- `git diff --stat` (informational only; this environment auto-commits on some cadence unrelated to this session, so HEAD may already include part of the diff): `mount_common.sh` and `shared_cache_env.sh` show as modified; `gvar_storage_common.sh`'s edits landed in an intervening auto-commit (confirmed by reading the file's current content directly, matching what was written).

### Final changed line ranges (current file state)

- `scripts/shells/linux/common/gvar_storage_common.sh`: L13-44 (`get_program_drive_partuuid`, normalize + validate), L504-509 (`determine_largest_windows_drive`, guarded blkid/findmnt reads).
- `scripts/shells/linux/common/shared_cache_env.sh`: L23-46 (top declarations: removed the 5 tool-var pre-declarations, added 2 scratch vars + a comment explaining why), L74-165 (contract read guards, `<tree_root>` template substitution, 1777 on the cache root, new `__scc_wire_tool_cache` + 5 calls + `unset -f`).
- `scripts/shells/linux/common/mount_common.sh`: L9-32 (new `mount_is_ntfs_fstype`/`mount_fsck_pass_for_type`), L44-49 (`mount_fstab_ensure_single_entry` uses the helper), L191-247 (`ensure_program_drive_udev_exclusion`: guarded partuuid read, readability probe, php-false workaround, scoped udevadm trigger), L391-420 (new `ntfs3_supports_windows_names`/`ntfs_mount_options`), L425-431 (`update_fstab` uses the helper), L447-465 (`mount_disk` reorders `fstab_type` before options, uses `ntfs_mount_options`), L505-525 (`handle_ntfs_disk` full-entry fstab comparison), L651-652 (`handle_ntfs_disk` reuses the precomputed values), L1003-1013 (`ensure_tree_root_bind_mount` live-findmnt-first NTFS check, uses the shared helper).

### Parity ledger updates

- Updated (not new IDs; same features, this round's fixes): SPL-114, SPL-115, SPL-116, SPL-117 in `.claude/agents_shared/shell_parity/linux.md` -- descriptions revised to match the corrected behavior; statuses unchanged (SPL-114/115/116 stay `pending-windows`, SPL-117 stays `platform-only`).
- SPL-114's note now cross-references shell-windows' own SPL-035/SPW-035 row (`windows.md`): Windows' `.cn_volume` marker already uses the same normalized lowercase/no-brace GUID format this round's fix produces, and that row itself says Windows has not yet written `CN_PROGRAM_PARTUUID` to the shared var store -- no format mismatch, just the already-tracked pending write.
- No live `shell-windows`/`ct-shell-windows` session was reachable via `ListAgents` (only `ca-orchestrator`), so per the workflow fallback rule this is written here instead of sent live:
  - `[shell-windows] align: SPL-116 corepack cache dir is not in config/service_contract.json paths.drive_layout.tree_cache_subdirs but is required by the P1 task text (item 4); when P3's Windows wrap-type installers add their own toolchain caches, either add "corepack" to the contract list or confirm Windows also needs a non-contract corepack cache dir the same way.`
  - `[shell-windows] align: SPL-114 CN_PROGRAM_PARTUUID normalization -- confirmed no action needed: SPW-035's `.cn_volume` marker format (lowercase, no braces) already matches what Linux now normalizes to and validates against.`

### Follow-ups for other lanes (not fixed here; outside this fence)

- `3_setting_base.sh`/systemd lane: wire `ensure_program_drive_udev_exclusion` and `ensure_tree_root_bind_mount` into an actual convergence step; add a boot-time re-convergence for the ntfs3-dirty-volume runtime fallback (requirements doc section 3.6) so a D: that stays dirty across a reboot doesn't leave `/www` and the tree bind permanently unmounted.
- `scripts/shells/linux/debian/install_shells/25_install_uv.sh` (not fenced for this lane): still writes `cache-dir` into `~/.config/uv/uv.toml` from `XDG_CACHE_HOME` (the NTFS cross-OS tree when active), so an interactive `uv sync`/`uv pip install` outside this file's callers can still hard-link into an NTFS-backed uv cache. Should read from `UV_CACHE_DIR` (the ext4 tree cache from this round's fix) instead, or drop the `cache-dir` line. Flagged for the installer lane / P3, per the original finding.
- ca-orchestrator (contract): add `corepack` to `paths.drive_layout.tree_cache_subdirs`, or confirm it should stay Linux-only and out of the contract.
- pycore/laravel mirrors: unchanged this round (no finding required touching `get_dev_compile_base`'s already-correct behavior); the P2/P3 lockstep note from the earlier p1-linux entry still applies.

### Blockers

- None for this lane's own fenced files.
- Next owner: the reviewer (this round's verdict), then the `3_setting_base.sh`/systemd lane for the wiring + boot-convergence follow-up, then ca-orchestrator for the `corepack` contract question.

## shell-linux-3: D12b Linux side (docker model runner, model definitions, Debian 13 WSL ensure)

- Status: in progress (runs below), awaiting reviewer.
- Record: docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md §1 D12, §11.

### Changed files

- `scripts/shells/linux/common/tts_docker_compose_common.sh` (rewritten; the lifecycle library)
- `scripts/shells/linux/debian/install_shells/docker_model_runner.sh` (new CLI)
- `scripts/shells/linux/debian/install_shells/apply_tts_docker_for_engine.sh` (thin wrapper: runner ensure, then up)
- `scripts/shells/linux/debian/install_shells/139_install_melotts.sh`, `143_install_fishspeech.sh` (docker branch)
- `scripts/shells/docker_compose/tts/melotts/{model.sh,Dockerfile,compose.yml}`
- `scripts/shells/docker_compose/tts/fishspeech/{model.sh,Dockerfile,compose.yml}`
- `.claude/agents_shared/shell_parity/linux.md` (new ledger)

### Runs

(filled in below)

## shell-linux-1: D13 Linux launchers on the official configuration (parity with shell-windows-1)

- Status: done, awaiting reviewer (the task stays in progress until the verdict). The team was not launched.
- Spec: `.claude/agents_shared/d13/DESIGN.md` §1-§6. Record: `docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md` §12.
- Not touched: `.claude/settings.json`, `.claude/hooks/` (shell-windows holds them for D13; Linux needs no change there), `config/claude_team_roles.json`, `.claude/agents/`.

### Changed files

- `scripts/shells/linux/common/claude_team_common.sh`: rewritten.
- `scripts/linuxenvs/claudeteam.sh`: rewritten (role pane contract, session_env, `--effort`, kickoff, PID file, remote loop).
- `scripts/linuxenvs/claudeagents.sh`, `scripts/linuxenvs/claudeteamup.sh`: header and help text only (options unchanged).
- `scripts/ai_shtools/claude_code_install.sh`: `claude_team_install` prerequisites, terminal report, state dir, `user_settings_merge`.
- `scripts/shells/linux/debian/install_shells/171_install_claude_code.sh`: one comment line (what `claude_team_install` does).
- `.claude/agents_shared/shell_parity/linux.md`: rows SPL-101 to SPL-112 appended.

### What the Linux side does now

1. Roles (§1): `.claude/agents/*.md` frontmatter `name`/`model`/`effort`, with catalog rows as overrides (`enabled`, `remote`). `grid` is no longer read, so the orchestrator can delete it.
2. Sessions (§2): both launchers start every enabled role as its own session, each in a pane of one tmux session.
   - The lead: `ca-orchestrator` with `team.kickoff` (claudeagents), or `ct-orchestrator` with `sessions.kickoff_lead` (claudeteamup).
   - Every other role: `ct-<role>` with `sessions.kickoff`.
   - Pane command: `claudeteam.sh --team-pane <mode> --agent <role> --name <session> [--remote-control <lead>] [--team-roles a,b] [--team-no-kickoff]`. These are the claudeteam.ps1 names.
   - claudeteam.sh does the rest itself, in this order:
     1. writes `<state>/<session>.pid`, where state is `${XDG_STATE_HOME:-~/.local/state}/core_node/claude_team` (exec keeps the PID);
     2. applies session_env;
     3. adds `--effort <frontmatter>` (the lead also gets `--teammate-mode tmux`);
     4. expands the kickoff (all placeholders, including `{task_list}`);
     5. a remote role pane runs the ssh loop instead of claude.
3. session_env:
   - lead and standalone `claudeteam`: `all` + `lead`;
   - every other role: `all`, with the `lead` names removed (an inherited `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is unset);
   - remote role on its server: `remote`.
   - The server command gets `--effort` and `-e` for every session_env.remote pair, plus `CLAUDE_AGENTS_SESSION=1`, replacing the old `-e CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
4. Layout (§3):
   - One tmux session `layout.tmux_session` on the mode's socket, one window per packed tab. Packing follows `tab_groups`, `min_lead`/`min_role` and `merge_groups_when_room`; unlisted roles go to the last group.
   - The lead gets a full-height left column.
   - Each tab gets an equal grid built with `split-window -l <pct>%`.
   - Panes are tagged `@claude_role`/`@claude_session`, and `pane-border-status top` shows the role titles.
   - Session hooks `after-split-window`/`after-select-layout`/`after-kill-pane` run `claude_team_common.sh --regrid` (resize-pane only).
   - Also set: `allow-passthrough all` (fallback on), `extended-keys on`, `terminal-features xterm*:extkeys`, mouse on.
5. Grid size and terminal:
   - The grid is chosen from tmux `client_width`/`client_height` after one maximized terminal attaches.
   - Terminal order: ptyxis `--maximize`, gnome-terminal `--maximize`, konsole `--fullscreen`, xterm `-maximized`, then xfce4-terminal, qterminal, x-terminal-emulator.
   - Headless: the current tty size, then `tmux attach` in that tty.
   - No positioning, so it is Wayland-safe. WSL2 is detected.
6. Idempotency and verification. A role is skipped when any of these holds:
   - its PID file is live (the process started before the file was written);
   - a live process of this user runs with `--name <session>`;
   - a pre-D13 per-role tmux session is still up.
   - A role pane whose claude exited is respawned in place.
   - After the build, a role without a pane reopens in a new tab, and PID files are awaited.
7. `--status` is a dry run. It prints:
   - the install check, roster, terminal, cell budget and source;
   - tabs and columns, every tmux command, and each role's resolved claude line with env;
   - options and hooks;
   - the table Role/Session/Tab/Pane/PID/Cells/State.
8. `claude_team_install` (§4):
   - installs what is missing: tmux (its version is reported against 3.5), python3, node, curl, ca-certificates, bubblewrap, socat;
   - reports the terminal and installs none (the xrandr and xfce4-terminal installs are gone);
   - repairs the state/shared/reports/reviews/agent-memory dirs;
   - adds the `user_settings_merge` keys only when absent and never overwrites them;
   - keeps `cci_check_remote_control_env` and the isolatePeerMachines/disableRemoteControl checks as report-only.

### Verification (static and dry runs only)

- `bash -n` passes on all six changed shell files: Git Bash, and bash 5.2.37 in Debian 13 WSL2. shellcheck is not installed on Windows or in Debian.
- Debian 13 WSL2: python3 is present; tmux, node and any terminal are missing. WSLg exports DISPLAY/WAYLAND_DISPLAY, so the run is headless.
  - `claudeagents.sh --status` and `claudeteamup.sh --status [--no-kickoff] [--roles ...]` printed the full plan.
  - The install check was read-only: it reported MISSING tmux/node/bwrap/socat, the state dir, the 4 settings keys and the links.
- Scratchpad harness (sourcing the common; no tmux, no claude) packed these budgets:
  - 1920x1080: 213x52 cells, 4 tabs;
  - 2560x1440@125%: 227x57 cells, 3 tabs;
  - 3840x2160@150%: 284x72 cells, 2 tabs. The lead is 100 cols; splits go 64% then 67/50% for columns and 67/50% for rows; role panes are 60-71 x 23 cells.
- Remote loop: fake ssh and a stub server install/tmux. All quoting levels round-trip, and the server pane command parses.
- `claudeteam.sh` with a fake claude:
  - the argv is exact;
  - the non-lead role has `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` removed even when inherited;
  - PID files `ca-orchestrator.pid` and `ct-shell-linux.pid` hold the claude PID;
  - a given `--effort` is kept.
- Not run: real tmux (splits, hooks, regrid, respawn), the terminal flags, and a real launch. That needs a Debian 13 / Ubuntu 26.04 desktop at the orchestrator's launch after review.

### Decisions (no questions asked)

1. Sockets: one per mode, the "existing socket" (`team.tmux_socket` for claudeagents, `sessions.tmux_socket` for claudeteamup), each holding `core-node-team`. PID files named by session, plus the `--name` process check, make a role live in the other launcher count as running. A warning shows when the other launcher's layout is up.
2. Flag names and the PID file name follow claudeteam.ps1 (`--team-pane`, `--team-no-kickoff`, `--team-roles`, `<session>.pid`), so both OSes share one contract.
3. The lead gets `--teammate-mode <team.teammate_mode_linux>` in both modes, because session_env.lead turns agent teams on in both.
4. `--roles` keeps its per-mode meaning (sessions filters the lead too; team always starts the lead), the same as Windows.
5. Terminal list: the spec order first, then xfce4-terminal/qterminal/x-terminal-emulator for Kali (AGENTS.md).
6. Headless grid: the current tty size, since the attach happens in that tty. With neither a client nor a tty, a labelled 213x52 estimate is used.
7. An idle role pane is respawned in place (`respawn-pane -k`), keeping the grid. A role with no pane opens in a new tab.
8. The regrid never calls select-layout, so the after-select-layout hook cannot loop. Hooks are set after the build.
9. A tmux older than 3.5 is only a WARN; options fall back.
10. `user_settings_merge` never overwrites. This changes Linux behavior: a differing `crossSessionInbound` used to be forced to `accept`, and is now reported.
11. Standalone `claudeteam` keeps agent teams on (all + lead) and passes no teammate-mode flag.
12. Parity ids use the SPL-101 block, because concurrent shell-linux workflows are writing SPL-007 and later.
13. A concurrent workflow removed the AI rules header repo-wide (about 16:07) while this task ran, including these files. I kept the current state (no header).
14. The working-tree copies of the five target files were CRLF, although HEAD and `.gitattributes` (`*.sh eol=lf`) say LF. I normalized them to LF (no git diff from that; bash under WSL needs LF).

### Parity

- Aligned: SPL-101 to SPL-107, SPL-111, SPL-112. Their parts that are platform-only (session_env.windows, the teammate-mode value, the WT version warning) are noted in the rows.
- Platform-only: SPL-108 (tmux specifics) and SPL-109 (Linux terminals, Wayland, tmux client size). Windows uses the PMv2 DPI measurement.
- SPL-110 is pending-windows for its `--name` process check. Respawn in place is platform-only; the PID-file skip is aligned.

Alignment request for shell-windows (task shell-linux-1):
- SPL-110: in `scripts/shells/win/win_common/ClaudeTeamCommon.ps1` `Get-ClaudeTeamLiveProcess`, after the PID-file candidates, also treat as live any process of the current user whose `Win32_Process.CommandLine` has the exact tokens `--name <session>`. That skips a session started by hand or by another launcher (the spec §2 name-collision rule).
- Orchestrator: please create `[shell-windows] align: SPL-110 --name process liveness check`.
- For information, no change needed: the remote server runs the Linux `claudeteam.sh` for both launchers. For `--agent <remote role>` it applies session_env.remote and removes the lead variables, and a given `--effort` is kept. `Get-ClaudeTeamRemoteArgument` already matches.

### Blockers

- None.
- Next owner: the reviewer (shell-linux-1 verdict), then shell-windows for the SPL-110 alignment.

## shell-linux-2: D12a desktop shortcut organizer, Linux side (SPW-001/002/003)

- Status: done, awaiting reviewer (the task stays in progress until the verdict).
- Record: docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md §1 D12, §11. Windows ref: DesktopIconManager.ps1 (shell-windows-2).
- An earlier run of this task wrote the organizer and stopped before verification, ledger and report; this run reviewed it, fixed what is below, verified it, and wrote the ledger rows.

### Changed files

- `scripts/shells/linux/common/desktop_shortcut_manager.sh`: the organizer (scan, classify, plan, collisions, placement decision, apply, manifest, undo, CLI); filed launchers updated in place by create/edit/remove; root runs act as each user.
- `scripts/shells/linux/debian/install_shells/154_repair_desktop_icons.sh`: shared Exec parsing (`_dsm_entry_exec_target`, `_dsm_exec_program_exists`), filed launchers count as present, organizer run and undo hint at the end.
- `scripts/shells/linux/refresh_desktop_icons.sh`: `organize|preview|undo [manifest]`, cache refresh after organize/undo, user fallback to `id -un`.
- `scripts/shells/linux/dd_helper/management_and_backup.sh`: menu "Organize Desktop Icons" [Organize/Preview/Undo]. Outside the task's three listed files but inside the shell-linux scope; the dd.sh menu SPW-003 asks for lives here.
- `.claude/agents_shared/shell_parity/linux.md`: rows SPW-001 to SPW-005.

### Fixes made in this run

1. Root safety (blocking class). A root run moved, copied, chowned and replayed manifests inside other users' homes with root rights, so a planted symlink (`desktopIcons/APITools -> /etc/xdg/autostart`, a filed launcher linked to a system file) or a forged manifest made root move or overwrite files outside the home. Now a root run organizes, previews and undoes every other user's Desktop as that user (`_dsm_org_run_as_user`: runuser, the library on stdin since the repo may be unreadable to the user, manifests collected from the output). An explicit manifest is replayed as its owner. Installer writes to user launchers (`_dsm_write_desktop_icon`, edit's `_dsm_set_key`) run as the user (`_dsm_as_user`); the old `chown user:user` of the Desktop dir and target (which followed symlinks) is gone.
2. Launchers were written without a trailing newline, so `edit_desktop_shortcut_...` appended onto the last line (`StartupNotify=falseComment=Edited`). The writers end with a newline, and edit adds one first when a file lacks it.

### Runs (Debian 13 WSL2, bash 5.2.37, mawk 1.3.4; scratch dirs under /tmp; the distro was stopped again afterwards)

- Keyword table: a script compared the Linux table with `$Global:DESKTOP_ORGANIZATION_CATEGORIES`: 1084 keywords, 20 categories, identical in order.
- Non-root sandbox (nobody, scratch HOME), 21 fixtures: Postman with `[x]` in the file name, Chrome keep-copy, Edge identical copy, a Notepad++ identical duplicate, a 7-Zip older filed one (replace), a PeaZip newer filed one (conflict), an Insomnia Desktop vs filed collision (the newer filed one refiles, the Desktop one is a conflict), window-launcher, broken Exec, a CJK name, an Exec-basename match (OBS), a generic host (env sh), camelCase (VSCodiumInsiders), a short keyword at the start (Go Tool) and not at the start (Let's Go), `Type=Link`, and a symlinked .desktop.
  - Preview 1 changed nothing, and its 10 items equal Run 1's 10 items.
  - Preview 2, Run 2 and Run 3 printed "Nothing to move"; Run 3 left the tree identical; 1 manifest in total.
  - Undo with a read-only Desktop: 2 restored, 9 skipped, 8 errors, UndoneAt stayed empty. The retry restored 15, skipped 4 (no-ops), 0 errors, and set UndoneAt. The next undo printed "No organizer run to undo".
  - After undo, every launcher is back with its size and mtime. The only difference: the Desktop links to CompressionTools and DevelopmentTools, two folders that already held launchers before the run, stay. That is the Windows rule (a link to a non-empty category folder is not moved away).
- Root sandbox (`unshare -m` with a bind-mounted fake /etc/passwd: root plus alice with a localized `XDG_DESKTOP_DIR=$HOME/Schreibtisch`; `CORE_NODE_DESKTOP_ICONS_DIR`/`XDG_STATE_HOME` applied to root only):
  - Preview and organize covered both desktops. Every file, folder, link and manifest in alice's home is alice-owned.
  - create/edit updated the filed launchers in place; the Desktop gained nothing; the next organize was "Nothing to move" for both.
  - Undo for all users and an explicit-manifest undo both set UndoneAt.
  - Attacks: a category dir symlinked to a root-only dir gave "failed" and moved nothing; a filed launcher symlinked to a root file was not written (still root-owned, content unchanged); a forged manifest aiming at a root file gave 2 errors and moved nothing.
- `bash -n` passes on the four shell files, all LF. 154 was not run end to end: it rewrites /usr/share/applications entries of installed apps; its organizer call is the same function exercised above.

### Decisions (no questions asked)

1. The direct CLI is the library itself (`desktop_shortcut_manager.sh organize|preview|undo [manifest]`) plus `refresh_desktop_icons.sh`, not a new `desktop_icon_organizer.sh` (reuse over a new file; the task write scope lists no new file).
2. The menu sits where the Windows one does: dd.sh > Linux Management > Linux System Tools > Management & Backup > Organize Desktop Icons.
3. "chown moved launchers to the user" is met by running as the user (the files are the user's own), not by chown from root.
4. Preview counts a missing folder or Desktop link as a change, so "Nothing to move" means the run writes no manifest. For a second identical item to one destination, preview reports what the run does (copy: unchanged, refile: conflict, move: duplicate).

### Parity

- Aligned: SPW-001, SPW-002, SPW-003. Platform-only: SPW-004 (Windows shortcut formats), SPW-005 (icon extraction).
- For shell-windows, information only, no request: Windows preview counts only shortcut placements, so it can print "Nothing to move" while Organize still recreates a missing `<Category>.lnk` and writes a manifest. Linux counts those as changes.

### Blockers

- None. A real GNOME/KDE/XFCE desktop run (gio trust, the icons shown) needs a Debian 13 / Ubuntu 26.04 desktop; WSL has no desktop and no gio.
- Next owner: the reviewer (shell-linux-2 verdict).

## shell-linux-G1: close the 7 shell-linux-1 review blockers + confirm window:false exclusion

- Status: done, awaiting reviewer. Diff base for the review: 74e7770. Resolves every `blocking` finding in `.claude/agents_shared/reviews/shell-linux-1.json`.
- Spec: `.claude/agents_shared/d13/DESIGN.md` §3.1-§3.2 (shared packing rule, one-lead-at-a-time), reviews/shell-linux-1.json.
- Not touched: `.claude/settings.json`, `.claude/hooks/`, `config/claude_team_roles.json`, `.claude/agents/` (all read-only here).

### Changed files

- `scripts/shells/linux/common/claude_team_common.sh`
- `.claude/agents_shared/shell_parity/linux.md` (SPL-101, SPL-107, SPL-110, SPL-111 updated; new row SPW-036)

`scripts/ai_shtools/claude_code_install.sh` was read but needed no edit for this round (see item D13-LIN-BLOCKERS-6 below).

### Item D13-LIN-BLOCKERS (7 sub-fixes)

1. **One lead at a time (`claude_team_scan_live`, DESIGN S3.2).** Added `claude_team_other_lead_session()` (the other mode's lead session name: `ca-orchestrator` for claudeteamup, `ct-orchestrator` for claudeagents). For the lead role only, when this mode's own PID check fails, `claude_team_role_pid orchestrator <other-lead-session>` is checked before the legacy/idle/stopped branches; a hit sets `state=other-lead`, records the PID, WARNs, and leaves `ROW_ACTION` empty (no place, no respawn — verified by inspection: `claude_team_place_order`/`claude_team_respawn_roles` both gate on `ROW_ACTION`). Windows already had this (SPW-023), so the row is `aligned`, not a new SPW request.
2. **Report columns (`claude_team_print_report`).** Added `MODEL`/`EFFORT` columns from the already-populated `CLAUDE_TEAM_ROLE_MODEL`/`CLAUDE_TEAM_ROLE_EFFORT` arrays. Verified by reading the new `row_format`/header/row line: `ROLE SESSION MODEL EFFORT TAB PANE PID CELLS STATE`.
3. **`--name`/`-n` matching (`claude_team_named_pid`).** New constant `CLAUDE_TEAM_NAME_FLAGS=("--name" "-n")`; the pgrep prefilter now matches `(--name|-n) <session>` and the awk token test accepts either flag immediately before the session token. Verified live in WSL (see Verification).
4. **Catalog parser (`claude_team_load_catalog` python heredoc).** Both `open()` calls (catalog JSON and every agent `.md`) now use `encoding="utf-8-sig"` (BOM-tolerant). A duplicate frontmatter `name` now keeps the first file (sorted order) and emits a new `D` record consumed as `claude_team_log WARN "Duplicate agent name <n> ignored: <path>"`; previously the last file silently won. Verified live in WSL with a BOM'd agent file and two files sharing one name.
5. **Lead-top fallback (`claude_team_tab_grid`, DESIGN S3.1).** New helper `claude_team_best_grid` (max-area column search with no lead). `claude_team_tab_grid`'s lead-left search no longer clamps an infeasible `lead_cols` up to `min_lead`; it now `continue`s past any column count that would leave the lead below `min_lead`. When every column count is infeasible (`best_score` stays -1), the tab switches to `shape=top`: the lead takes a full-width top row fixed at `min_lead` rows, and the roles grid fills below it over the reduced row budget (via the same `claude_team_best_grid` helper, full width, no lead subtraction). `claude_team_build_tab` was extended to build this with `-v` instead of `-h` for the lead's own first split (sized from the row budget). `claude_team_regrid` (the tmux hook's live self-healing pass, which otherwise would immediately squash a freshly-built lead-top tab back toward a left-column shape) was also extended: it now detects the lead pane directly from its own `pane_width`/`pane_height` (full height -> left, full width only -> top) instead of the old "column 0 has exactly one pane" heuristic, excludes the lead from the role-column grouping in both shapes, and for `top` resizes the lead's height (`-y`) to `min_lead_rows` (a new 4th `claude_team_regrid` argument, threaded through `claude_team_regrid_hook_command` and both call sites/the `--regrid` CLI dispatcher). Documented in SPL-107 (now `aligned` against Windows SPW-025, which already had the max-area + lead-top rule per `windows.md`).
6. **Duplicate constant (`claude_code_install.sh`/`claude_team_common.sh`).** `claude_team_common.sh:28` no longer declares its own `CLAUDE_TEAM_CATALOG_PATH` literal; it now sets `CLAUDE_TEAM_CATALOG_PATH="$CCI_TEAM_CATALOG_PATH"` right after sourcing `claude_code_install.sh`, the same pattern already used for `CLAUDE_TEAM_STATE_DIR`. No edit needed in `claude_code_install.sh` itself (its `CCI_TEAM_CATALOG_PATH` was already the canonical definition).

### Item D13-LIN-CATALOG (window:false roles + SPL-107 wording)

- Confirmed a real bug, not just an audit: before this fix, `reviewer`/`ncore`/`flutter` (catalog `window:false`) had no code path excluding them, so `claude_team_validate_roles` gave them `state=session` like any other role and `claude_team_place_order`'s "roles in no tab group, appended to the last group" fallback silently placed them into the codemart tab (verified live in WSL with the real catalog before the fix: `reviewer placed=1 ncore placed=1 flutter placed=1`).
- This is exactly the gap Windows' own ledger already tracked: `.claude/agents_shared/shell_parity/windows.md` SPW-036 already implements `window:false` exclusion and was marked `pending-linux`, citing this identical bug. Fixed by having `claude_team_load_catalog`'s python heredoc emit `roles[].window` (default true) into a new `CLAUDE_TEAM_ROLE_WINDOW` array, and `claude_team_validate_roles` setting `state="no-window"` (matching Windows' own state name) with no `ROW_ACTION` for a `window:false` role, so it's invisible to `claude_team_scan_live`/`claude_team_place_order`/`claude_team_pack` but still a full row in `claude_team_print_report` (Tab/Pane/Cells stay `-`). No change needed to `groups[]` parsing, per the item's own note: `layout.tab_groups` already reflects per-group placement.
- Recorded in `linux.md` as `SPW-036` (reusing the Windows id, aligned), not a new `SPL-###`, since Windows initiated the feature.
- SPL-107 wording confirmed to match the lead-top rule implemented above (both talk about "max area, column fill, lead-top fallback when the lead cannot get a full-height column at min_lead").

### Verification

- `bash -n` passes on both `claude_team_common.sh` and `claude_code_install.sh`; both stay LF-only (0 CR).
- Live WSL Debian checks (no tmux available there; `claude_team_regrid`'s tmux calls were exercised through a stub `claude_team_tmux` function instead — see below), sourcing the real file against the real catalog/agents unless noted:
  - Catalog parity bug (before fix): `reviewer placed=1 ncore placed=1 flutter placed=1`. After fix: all three resolve to `state=no-window` and are absent from `CLAUDE_TEAM_PLACE_ORDER` and every `CLAUDE_TEAM_PACK_GROUPS` entry.
  - Scratch catalog with a BOM'd agent file and two files sharing frontmatter `name: duprole`: the BOM'd role loads correctly (`window=1 model=opus effort=high`, not dropped), and the duplicate keeps the first file (`model=sonnet`) with `[WARN] Duplicate agent name duprole ignored: .../dup_b.md`.
  - `claude_team_named_pid`: two real background processes with literal argv `--name fake-session-long` and `-n fake-session-short` are both found by PID; a non-existent session name returns not-found (rc=1).
  - Lead-top fallback hand-recomputed via the real functions: at budget 161x52 (a size where `claude_team_pack` still assigns the lead's tab 1 side column at cap 3, but `claude_team_tab_grid`'s own per-candidate `(cols-columns)/(columns+1)` formula can't reach `min_lead`=100), the tab now resolves to `shape=top`, lead cells `161x30`, roles gridded `80x20` each below — instead of the old behavior of clamping the lead to 100 cols against a squeezed side column. Re-checked at 213x52 (the review's own measured 1920x1080 plan) that the common case is unaffected: `shape=left`, lead `106x51`.
  - `claude_team_regrid` exercised with a stubbed `claude_team_tmux` (canned `list-windows`/`display-message`/`list-panes`, resize-pane calls logged): left-shape numbers are byte-for-byte identical to the pre-fix formula (verified by hand); new top-shape case resizes the lead to `-y 30` and a role column to `-x 80`; a plain (no tagged lead) tab and a lead-alone tab (no role panes) both behave as before (the latter issues no resize-pane calls at all, same as before the refactor).
- Full detail (line numbers, exact commands) is in this session's own scratchpad; not copied here per the "no progress summaries in source files" rule.

### Parity ledger

- `SPL-101`, `SPL-107`, `SPL-110`, `SPL-111`: updated, `aligned` (Windows already had the matching behavior: SPW-023 for SPL-110, SPW-025 for SPL-107; SPL-101/111 are Linux-only wording/column fixes with no Windows counterpart needed).
- `SPW-036`: new row, `aligned` (Windows-initiated; Linux now implements it).
- No `pending-windows` rows were left by this task — everything Windows needed already existed, and the one row Windows was waiting on (SPW-036) is now closed from the Linux side.

### Cross-scope / messages

- Tried `SendMessage` to `shell-windows` and `ct-shell-windows` to report SPW-036 done; neither is a reachable agent in this session (`ListAgents` shows only `core-node-e9` and `ct-laravel-remote`). Recording it here instead, per the task's third option ("in a workflow write it in your result"): **shell-windows does not need to do anything** — SPW-036's Linux side is closed, and SPW-023/SPW-025 already matched before this task ran.
- Noted, not actioned: `git log` shows periodic auto-commits (`win0.0.1`, ~20 min apart) landing this session's own working-tree edits into HEAD during the task. This session never ran a git write command itself (AGENTS.md read-only-git honored); flagging only because it makes `git diff` (no base) look small — `git diff 74e7770` shows the real scope.

### Blockers

- None.
- Next owner: the reviewer (shell-linux-G1 verdict).

## shell-linux-11: Tailscale management (D29) in dd.sh > Linux Management

- Status: done, awaiting reviewer.
- Source: `docs_fix` D29 (user request via dd.cmd/dd.sh menus), official-docs spec supplied in the task text (tailscale.com KB/docs + pkg.go.dev/tailscale.com/ipn/ipnstate, all URLs checked 2026-09-27). Windows counterpart: `scripts/shells/win/win_common/TailscaleCommon.ps1` (already existed on disk when this task started, see "Pre-existing state" below).

### Pre-existing state found at task start

Both `scripts/shells/linux/common/tailscale_common.sh` (this task's target file) and the Windows `TailscaleCommon.ps1` were already present and fully implemented on disk (git log: commit `7a23f57d0` "win0.0.1", an auto-commit, not something this run wrote). `97_install_tailscale.sh` was already updated to source the common library instead of declaring its own `TAILSCALE_SERVICE`/`is_tailscale_installed()`. None of the following existed yet, so this run did only the remaining, unfinished part of the task:
- no menu wiring anywhere (the library's own doc comment already pointed at a `menu_itemshells/tailscale_menu.sh` that did not exist);
- no parity ledger row (neither `linux.md` nor `windows.md` had a Tailscale row);
- no `shell-linux-11` report section.

### Changed files (this run)

- `scripts/shells/linux/menu_itemshells/tailscale_menu.sh` (new): arrow-menu wrapper, paths resolved from its own location (matches `app_install_menu.sh`'s style). Items: Status, List Devices, Restart Service, Open Panel, Install/Reconfigure (delegates to `97_install_tailscale.sh`, not duplicated), Help, Back. Every action calls straight into `tailscale_common.sh`'s public functions (`ts_show_status`, `ts_show_devices`, `ts_restart_service`, `ts_show_panel`, `ts_show_help`); no logic re-implemented here.
- `scripts/shells/linux/dd_helper/linux_management.sh` (not owned by the running dd.sh/menu_display.sh/permissions_repair_menu.sh lane, so free to edit): new `show_tailscale_management_menu()` wrapper (same `bash "<script>"` pattern as `show_app_install_menu`); new item "Tailscale Management (status, devices, restart, panel)" inserted into `show_linux_system_tools_submenu`'s `menu_items` array (position 8, between "APP Install" and "Slim & Disk Cleanup"); the `case` block's indices 8-10 were shifted to 9-11 to match. `upgrade_idx`/`back_idx` are computed from `${#menu_items[@]}` at runtime, so they needed no change.
- `scripts/shells/linux/common/tailscale_common.sh`: one wording fix only, no logic change -- `ts_show_help`'s menu path corrected from "dd.sh > Linux Management > Tailscale Management" to "dd.sh > Linux Management > Linux System Tools > Tailscale Management" (the actual path, now that the item is wired in).
- `.claude/agents_shared/shell_parity/linux.md`: new row `SPL-118`.

No other file needed a change: `97_install_tailscale.sh` already reused the common library correctly, and `network_detect_common.sh`'s pre-existing `net_detect_tailscale_ipv4()` is already the one IPv4 source `ts_show_status` calls -- no second implementation was added anywhere.

### Menu placement decision (no queued item needed)

The task listed `dd_helper/menu_display.sh` and `dd_helper/permissions_repair_menu.sh` as files the running dd.sh plan owns (do not edit), but `dd_helper/linux_management.sh` -- the file that actually defines `show_linux_management_submenu()` and `show_linux_system_tools_submenu()` -- is a separate file in the same directory and was NOT on that list. Verified this by reading `menu_display.sh` itself: it only wires "Linux Management" -> `show_linux_management_submenu`, which is defined in `linux_management.sh`. So the entry went into `linux_management.sh`'s existing "Linux System Tools" submenu (alongside "NAT Gateway Configuration", "RustDesk Server Install Info", etc.), which needed no queued hook-in.

### Verification

- `bash -n` passes on all four touched/added files; all confirmed LF-only (0 CR via `tr -cd '\r' | wc -c`, not `grep -c` per this repo's own CRLF pitfall).
- WSL Debian (`wsl.exe -d Debian`, systemd active per `/etc/wsl.conf` `[boot] systemd=true`, repo reachable at `/mnt/d/programing/core_node`), Tailscale NOT installed there (`command -v tailscale` empty) -- confirmed with `command -v tailscale && echo FOUND || echo NOTFOUND` after an earlier `which`-based probe gave a misleading `rc=0` (this minimal Debian image has no `which`, only the bash builtin `command -v` is reliable here):
  - `bash tailscale_common.sh status` -> `CLI installed: no`, `Service unit: tailscaled.service not found` (rc 0, no exit-code-as-return-value).
  - `bash tailscale_common.sh devices` -> `Tailscale is not installed; no devices to list.`
  - `bash tailscale_common.sh restart` -> `Tailscale is not installed; nothing to restart.` (confirms no restart is attempted when absent -- read-only-safe).
  - `bash tailscale_common.sh panel` -> printed both documented URLs (admin console + Quad100 local UI) and correctly skipped `xdg-open` ("No desktop session detected"; `HAS_DESKTOP_ENVIRONMENT` unset in this shell).
  - `bash tailscale_common.sh help` -> dispatcher usage + the five official doc links.
  - `DD_AUTO_CONTINUE=1 timeout 10 bash tailscale_menu.sh` -> exits immediately with rc 0 (arrow_menu.sh's non-interactive probe returns the back index without blocking, confirming the new menu script is safe to invoke from a non-TTY/CI context).
- Per the task's explicit instruction, no `tailscale up`/`down`/`set`/`restart` was ever actually run against a live install (none was installed here to run it against in the first place); every call above is read-only or a documented no-op.

### Parity ledger

- New row `SPL-118` in `linux.md`: `aligned` against `scripts/shells/win/win_common/TailscaleCommon.ps1` (`Get-TailscaleInstallInfo`, `Show-TailscaleStatus`, `Show-TailscaleDevices`, `Restart-TailscaleServiceElevated`, `Show-TailscalePanel`, `-Action Status|Devices|Restart|Panel|Help`) -- read side by side with the Linux file; both implement the same official-docs command set (status --json BackendState, the Self+Peer device table with the same connection-label precedence direct/peer-relay/relay, the two documented panels, `systemctl restart tailscaled` / `Restart-Service -Name Tailscale`).
- No `pending-windows` row was left: Windows already had the full counterpart on disk before this task started.
- Not actioned (informational only, no alignment task needed): `.claude/agents_shared/shell_parity/windows.md` has no Tailscale row of its own yet (verified by reading it -- only an unrelated `SPW-034` entry matched the grep). Since the Linux row here already documents both sides as aligned, shell-windows does not need to change any code; it may want its own ledger entry pointing back at `SPL-118` for its own bookkeeping, but that is house-keeping, not a required change.
- `ListAgents` in this session shows only `core-node-e9` (busy) and `ct-laravel-remote` (idle) -- no `shell-windows`/`ct-shell-windows` peer to message directly, matching what shell-linux-G1's report already noted about this environment. Recording the above here instead, per the task's third option ("in a workflow write it in your result").

### Blockers

- None.
- Next owner: the reviewer (shell-linux-11 verdict).
