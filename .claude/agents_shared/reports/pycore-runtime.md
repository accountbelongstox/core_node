# pycore-runtime report

## shell-windows-3-fix

Task header tag is `[pycore-runtime]`, but all three dispatched items are out of the
pycore-runtime write scope under the current authoritative map
(`.claude/agents/pycore-lead.md`, user D22, 2026-09-27, cross-checked against
`development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md` §8). Each item's own
requirement text is prefixed `(pycore-ai)`, and every file it names matches the pycore-ai
entry in the map, not pycore-runtime's:

- `scripts/shells/win/install_powershells/Step{52,54,55,56}_*.ps1` and
  `scripts/shells/win/win_common/DockerWslBridge.ps1` are listed verbatim under
  pycore-ai ("Windows model and engine install steps:
  `Step{9,11,12,36,37,38,39,42,43,46,47,51..61}_*.ps1`" and "`DockerWslBridge.ps1`").
- `scripts/shells/linux/common/tts_docker_compose_common.sh` is listed verbatim under
  pycore-ai's Linux paths.
- `scripts/shells/linux/debian/install_shells/{139_install_melotts,143_install_fishspeech}.sh`
  and `scripts/shells/docker_compose/tts/{cosyvoice,gptsovits}/` fall under pycore-ai's
  catch-all ("every other Linux script whose purpose is installing or initializing a local
  model engine or its Docker runner").

None of these paths are under `pycore/callmodule/`, `pycore/database/`,
`pycore/pyutils/{common,rpc_v2,wsrpc,laravel,codesync}/`, `pycore/pyctl/{relay,runtime,
queue_center,laravel,audio_orchestration,task_history,upload,client}/`, or the
pyservice-prerequisite shell scripts pycore-runtime owns
(`scripts/shells/linux/common/{pyservice_entry,pyservice_www_permissions,
codesync_service}.sh` and their Windows counterparts). They are also explicitly called out
as not-mine in my own role brief ("Not yours: ... installers under `scripts/`
(shell-linux, shell-windows)").

Decision (recommended option, taken per the no-questions rule): make no edits under this
task. Writing TTS/Docker-model-runner installer logic here would violate the B1/B2/B3
boundary rule (write only inside your scope) on a path another owner (pycore-ai) already
holds, and would duplicate/conflict with whatever pycore-ai does concurrently on the same
files. No file was read-modified; only path lookups (`find`) were run to confirm ownership
before declining.

No service was started, stopped or restarted, and no code was changed, so no
`frankenphp/workers/restart` call was needed.

Items:

- `shell-windows-3-B1`: refuted (wrong owner). Files named (Step55/56 `.ps1`,
  `139_install_melotts.sh`, `143_install_fishspeech.sh`) are pycore-ai's per the map above.
  Route to pycore-ai; the fix as described (report-only status branch when neither
  `$doFull`/`DO_FULL` nor `-Force` is set, before any WSL/docker call) still looks correct
  on inspection of `Step55_InstallMelotts.ps1` / `Step56_InstallFishspeech.ps1` but was not
  applied here.
- `shell-windows-3-B2`: refuted (wrong owner). `DockerWslBridge.ps1` is pycore-ai's. Route
  to pycore-ai.
- `shell-windows-3-B3`: refuted (wrong owner). `Step52_InstallCosyVoice.ps1`,
  `Step54_InstallGptsovits.ps1`, `tts_docker_compose_common.sh`, and
  `docker_compose/tts/{cosyvoice,gptsovits}/` are pycore-ai's. Route to pycore-ai.

Verification: `find` over the repo confirmed the on-disk locations of every path named in
B1-B3 (`scripts/shells/win/install_powershells/Step{52,54,55,56}_*.ps1`,
`scripts/shells/win/win_common/DockerWslBridge.ps1`,
`scripts/shells/linux/common/tts_docker_compose_common.sh`,
`scripts/shells/linux/debian/install_shells/{139_install_melotts,143_install_fishspeech}.sh`);
each matched the pycore-ai map entry quoted above.

Changed files: none.

Blockers: none for pycore-runtime. Next owner: pycore-ai for all three items (B1, B2, B3);
pycore-lead/orchestrator to re-tag task `shell-windows-3-fix` with the `[pycore-ai]` owner
prefix per the team protocol ("every task subject starts with its owner role tag").

## pycore-assist-D7-fix

Group map note (recorded per the "no questions" rule): the dispatched item ids carry the
`pycore-assist-*` prefix from the D16 role map, but the current map (`.claude/agents_shared`
task header → `.claude/agents/pycore-lead.md`, user D22, 2026-09-27; also
`development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md` §8) assigns
`pycore/pyctl/agent_history/` to pycore-runtime ("every other pycore path"; there is no
`pycore-assist` role in the D22 map). Both items are inside the current pycore-runtime write
scope, so both were implemented here rather than deferred. Diff base for review: 74e7770.

### pycore-assist-D7-B1 (M-1): done (awaiting review)

- Requirement: `prompt_archive.ARCHIVE_ROOT_ONLY_FIELD`, read by
  `agent_history_service.py:415`, was never defined in `prompt_archive.py`, so every
  `_extract_inner` pass over a changed source with at least one prompt raised
  `AttributeError` before `write_index`/`write_prompts`/`write_state` ran; the outer
  `except` at `agent_history_service.py:511-515` then returned an `error` summary with
  nothing stored and no `sessions_changed`/`prompt_new` event.
- Fix (`pycore/pyctl/agent_history/prompt_archive.py` only; the caller line at
  `agent_history_service.py:415` is unchanged):
  - `ARCHIVE_ROOT_ONLY_FIELD = "root_only"` declared at the top, next to
    `PROMPT_ARCHIVE_DIR_NAME`, and exported in `__all__`.
  - `archive_prompts` now reads it off each incoming prompt dict, carries it alongside the
    built entry through grouping/dedupe (kept out of `_prompt_key` and out of the persisted
    JSON line, so the dedupe key and the on-disk schema are both unchanged), and uses it
    only to decide the per-tool file's chmod (see B2 below).
- Verification:
  - `grep -rn "0o666\|PROMPT_ARCHIVE_FILE_MODE" pycore/pyctl/agent_history` → empty.
  - `py_compile` on `prompt_archive.py`, `agent_history_txt.py`, `agent_history_service.py`,
    `root_spool.py` → all OK.
  - Module-attribute check (`import pycore.x.y as alias; alias.NAME` for every such
    reference) over every `.py` file in `pycore/pyctl/agent_history/` → 0 problems (was 1
    before this fix: `prompt_archive.ARCHIVE_ROOT_ONLY_FIELD`).
  - `python -c "import pycore.pyctl.agent_history.prompt_archive as m; hasattr(m, 'ARCHIVE_ROOT_ONLY_FIELD')"` → `True`; `agent_history_service` imports cleanly on Windows.
  - Functional: `archive_prompts([{..., prompt_archive.ARCHIVE_ROOT_ONLY_FIELD: True}])` runs
    without `AttributeError` and appends the entry (see the B2 scratch run below, which
    exercises this same call).

### pycore-assist-D7-B2 (AHSC-28 completion): done (awaiting review)

- Requirement: `prompt_archive.py:35` set `PROMPT_ARCHIVE_FILE_MODE = 0o666` (world
  writable/readable) and chmod'd every newly-created per-tool file to it unconditionally;
  `:107-111` silenced any chmod failure with a bare `except OSError: pass`; the
  `agent_history_txt.py` store had no restricted mode at all.
- Fix:
  - `pycore/pyctl/agent_history/prompt_archive.py`: no second mode literal — imports
    `pycore.pyctl.agent_history.root_spool as root_spool` and reuses
    `root_spool.SPOOL_FILE_MODE` (0o640, `root_spool.py:45`). A per-tool JSONL is chmod'd to
    that mode only for the batch that contains at least one `ARCHIVE_ROOT_ONLY_FIELD` prompt
    (`has_root_only`), and only once it ever does — there is no code path that widens a file
    back, so a file that has never carried a root-only entry keeps the OS/owner default
    mode untouched (no chmod call at all). The `os.name == "nt"` skip is a condition, not an
    except; a real chmod failure is logged via `ColorPrint.yellow` with the path, the octal
    mode and `exc.errno` instead of being swallowed.
  - `pycore/pyctl/agent_history/agent_history_txt.py`: the store mixes root-only and
    ordinary sessions into shared aggregate files (`index.txt`, `prompts.txt`, `state.txt`),
    so entries cannot be cleanly separated per file the way `prompt_archive`'s per-tool
    JSONLs are. The whole store is instead restricted unconditionally to the root-spool
    modes it already uses as the convention for this data (`SPOOL_DIR_MODE` 0o750 for
    `store_dir()`/`sessions_dir()`, `SPOOL_FILE_MODE` 0o640 applied in `_atomic_write`, the
    one shared write path for `state.txt`/`index.txt`/`prompts.txt`/`sessions/<id>.txt`/
    `prompt_edits.txt`). Both constants are imported from `root_spool`, no new literal. The
    same `_restrict_mode` helper is used for both files and directories: skip on
    `os.name == "nt"` via a condition, log a real failure via `ColorPrint.yellow` (path,
    octal mode, `errno`), never raise.
- Verification:
  - `grep -rn 0o666 pycore/pyctl/agent_history` → empty.
  - `py_compile` on both changed files → OK (see B1 above, same run).
  - WSL Debian scratch run (`wsl.exe -d Debian -- python3 <scratchpad>/verify_agent_history_modes.py`, `prompt_archive.store_dir` and `agent_history_txt._restricted_dir`/`_atomic_write` pointed at a fresh `tempfile.mkdtemp()`, no repo state touched):
    - a `claude` tool batch with one `ARCHIVE_ROOT_ONLY_FIELD=True` prompt → resulting `claude.jsonl` mode `0o640`;
    - a `codex` tool batch with no root-only prompt → resulting `codex.jsonl` mode `0o644` (untouched owner default, not restricted);
    - a second, non-root-only batch appended afterwards to the already-restricted `claude.jsonl` → mode stays `0o640` (never widened);
    - `agent_history_txt._restricted_dir` on a fresh dir → `0o750`; `agent_history_txt._atomic_write` on a fresh file → `0o640`;
    - printed `ALL OK`.
  - Windows check (same repo, native `python`, same monkeypatch pattern): the same root-only
    `archive_prompts` call and the same `_restricted_dir`/`_atomic_write` calls complete with
    no exception (the `os.name == "nt"` branch is taken, chmod is never invoked) and the
    files/dirs are created normally.
  - EOL: `git diff --numstat` equals `--ignore-space-at-eol` for both files; `agent_history_txt.py` stayed all-CRLF (453/453 lines), `prompt_archive.py` stayed all-LF (137/137 lines) — no line-ending churn, no header re-added.

### Round 2 (review `.claude/agents_shared/reviews/pycore-assist-D7-fix.json`, `issues[0]`): done (awaiting review)

- Blocking issue: `prompt_archive.py:121-128` re-implemented the same
  `os.name == "nt"` skip / `os.chmod` try / `ColorPrint.yellow` log sequence that this same
  change had just added as `agent_history_txt.py:45-54` `_restrict_mode` — a duplicate
  implementation (AGENTS.md "reuse or upgrade existing components" / "remove duplicate
  implementations"; PYTHON_PYCORE.md "shared libraries over copies").
- Fix, one shared public helper, kept in `agent_history_txt.py` (chosen over `root_spool.py`
  because it sits next to `SPOOL_DIR_MODE`/`SPOOL_FILE_MODE`'s only other two call sites,
  `_restricted_dir` and `_atomic_write`, in the same module):
  - `agent_history_txt._restrict_mode` renamed to public `restrict_mode(path, mode, label)`;
    both of its existing call sites (`_restricted_dir`, `_atomic_write`) updated to the new
    name. Docstring gained one line noting it is shared by both stores.
  - `prompt_archive.py` imports `restrict_mode` alongside `store_dir` from
    `agent_history_txt` and replaces the inline block with
    `if has_root_only: restrict_mode(path, root_spool.SPOOL_FILE_MODE, "Prompt archive")`.
  - Now-unused imports dropped from `prompt_archive.py`: `import os` and
    `from pycore.pyfoundations.pybasecommon.color_print import ColorPrint`. The log message
    is unchanged byte-for-byte (`label` fills the position the literal "Prompt archive" held).
  - Folded in the review's non-blocking docstring-duplication note in the same edit: the
    3-line inline comment that repeated the module docstring paragraph (`:21-26`) is now one
    line, `# See ``ARCHIVE_ROOT_ONLY_FIELD`` in the module docstring above.`
  - Decision recorded per the review's non-blocking item: no `chown` is applied anywhere in
    either file. The non-root worker process must keep append/write access to files it
    creates, so it cannot chown them to `root` even if it wanted to; only the mode is
    tightened. This is unchanged behavior, carried over from the round-1 fix.
  - The other non-blocking items (`_tighten_mode`-style `st_uid`-gated chmod to avoid a
    yellow log line on every `store_dir()`/`sessions_dir()` call against a store owned by
    another uid; chmod-before-`os.replace` ordering in `_atomic_write`) are left as filed —
    optional, and out of the round-2 blocking scope.
- Re-verification:
  - `grep -rn "_restrict_mode\b" .` (whole repo) → empty; no caller depended on the old
    private name.
  - `grep -rn "restrict_mode" pycore/pyctl/agent_history` → exactly the one definition in
    `agent_history_txt.py` and its three call sites (two in `agent_history_txt.py`, one in
    `prompt_archive.py`).
  - `grep -rn 0o666 pycore/pyctl/agent_history` → empty.
  - `py_compile` on `prompt_archive.py`, `agent_history_txt.py`, `agent_history_service.py`,
    `root_spool.py` → all OK.
  - Free RAM checked before verification: 3.63 GB (>= the 3 GB guard), so both scratch runs
    from round 1 were re-executed rather than skipped:
    - Windows (native `python`, monkeypatched `_SHARED_STATE_DIR`/`_LEGACY_DIR` to a fresh
      `tempfile.mkdtemp()`): `store_dir`/`sessions_dir`/`write_state`/`write_prompts` and
      `archive_prompts` (one ordinary batch, one `ARCHIVE_ROOT_ONLY_FIELD=True` batch) all
      complete with no exception; chmod is skipped (`os.name == "nt"` branch taken).
    - WSL Debian (`wsl.exe -d Debian -- python3 <scratchpad>/verify_d7p2_round2_wsl.py`, same
      script, POSIX repo path, fresh temp dir, no repo state touched): a batch with no
      root-only prompt leaves its `.jsonl` at the umask default (`0o644`, not `0o666` and not
      restricted); a batch with one `ARCHIVE_ROOT_ONLY_FIELD=True` prompt restricts that
      tool's `.jsonl` to `0o640` (`root_spool.SPOOL_FILE_MODE`); `store_dir()` is `0o750`
      (`root_spool.SPOOL_DIR_MODE`); printed `ALL_OK` on both platforms.
  - EOL unchanged: `git diff --numstat 74e7770` still equals `--ignore-space-at-eol` for both
    files (32/7 `agent_history_txt.py`, 22/14 `prompt_archive.py` after round 2, up from
    round 1's 29/7 and 29/11). Byte counts: `agent_history_txt.py` 456/456 lines all `\r\n`;
    `prompt_archive.py` 127/127 lines all `\n`. No BOM, no header re-added.

### Cross-scope notes

- None new. Both files (`prompt_archive.py`, `agent_history_txt.py`) are inside
  `pycore/pyctl/agent_history/`, which the current (D22) map assigns to pycore-runtime; no
  other role's path was touched. `agent_history_service.py` (the caller) was read but not
  edited, per the M-1 instruction to keep that line.
- Carried over from the round-1 review's `cross_scope` (informational, not fixed here — not
  in pycore-runtime's write scope): `scripts/shells/linux/common/scan_shared_cache.sh:169-170`
  (`chmod -R a+rX $SHARED_ROOT`) re-widens `pycore/.ai_state/agent_history` to world-readable.
  It is a manual utility with no caller in the repo, and `store_dir()` re-tightens the
  directory on its next call, so this does not block round 2. For the orchestrator to route
  to shell-linux: exclude `pycore/.ai_state` from that recursive chmod.
- Pre-existing, unrelated: `pycore/pyctl/assist/capability_sync.py`,
  `pycore/pyctl/tts/{audio_lane_full_sync,audio_resource_delivery,laravel_audio_delivery}.py`
  and `pycore/pyutils/tts/{audio_queue_center,word_audio_cache}.py` show as modified in the
  working tree from other concurrent agent work; none of them were read or touched for this
  task.

### Services and restarts

No pycore or Laravel service was started, stopped or restarted for this task; the two
changed modules only affect agent-history extraction, which the next pycore start or the
next `extract()`/`live_scan()` call picks up.

Changed files (this task, rounds 1+2):
- `pycore/pyctl/agent_history/prompt_archive.py`
- `pycore/pyctl/agent_history/agent_history_txt.py`

Blockers: none. Round 1's single blocking issue (`issues[0]`, the duplicate chmod helper) is
fixed and re-verified above. Next owner: reviewer, for round 2 of
`.claude/agents_shared/reviews/pycore-assist-D7-fix.json`.

## pycore-runtime-D7

Batch 1/1, 2026-09-27 17:2x. Four items are implemented and verified. CKA-10-routes is deferred because its dependency is missing. The task stays in progress until the reviewer writes `.claude/agents_shared/reviews/pycore-runtime-D7.json` with `"verdict": "approved"`. Reviewers diff against 74e7770.

Line endings: each file keeps its own endings. `git diff --numstat HEAD` equals `--ignore-space-at-eol` for all eight files. `relay_contract.py` and `laravel_relay_agent_service.py` are CRLF and were edited byte-wise with `\r\n`; the other six are LF.

### LTCW-12-consts: done (awaiting review)

- Files:
  - `pycore/pyutils/common/gnome_shell_dbus.py`: adds `BRIDGE_ERROR_NOT_APPLICABLE = "gnome_bridge_not_applicable"` and `INTROSPECT_ERROR_NOT_NEEDED = "gnome_introspect_not_needed"`, both in `__all__`.
  - `pycore/pyutils/common/xdg_desktop_portal.py`: adds `PORTAL_ERROR_NOT_APPLICABLE = "portal_not_applicable"`, in `__all__`.
- Naming: these follow the modules' existing `BRIDGE_ERROR_*`, `INTROSPECT_ERROR_*` and `PORTAL_ERROR_*` families. The bridge `status()` already carries its failure codes in `state` (for example `BRIDGE_ERROR_NOT_GNOME`), so the not-applicable code is a `BRIDGE_ERROR_*` too.
- Verification:
  - Both files compile.
  - `python -c "from ...gnome_shell_dbus import BRIDGE_ERROR_NOT_APPLICABLE, INTROSPECT_ERROR_NOT_NEEDED; from ...xdg_desktop_portal import PORTAL_ERROR_NOT_APPLICABLE; from ...x11_display import X11_ERROR_DISPLAY_UNSET"` prints `gnome_bridge_not_applicable gnome_introspect_not_needed portal_not_applicable x11_display_unset`.
- Side effect: importing `xdg_desktop_portal` runs pycore's third-party getter, which pip-installed `jeepney-0.9.0` into `D:\.dev_win10\python313`. That is the module's normal behavior. Nothing else was installed.
- Cross-scope (pycore-assist, `pycore/pyutils/window/linux_terminal_backend.py:286-301`): import these three names plus `x11_display.X11_ERROR_DISPLAY_UNSET` in place of the four string literals in `_capabilities`.

### AOQSD-21: done (awaiting review)

- Files:
  - `pycore/callmodule/rpc_routes/route_names.py`: a new section at the end with `ROUTE_ERROR_AUDIO_LANE_UNKNOWN = "AUDIO_LANE_UNKNOWN"` and `ROUTE_ERROR_QUEUE_HEAD_ITEMS_REQUIRED = "QUEUE_HEAD_ITEMS_REQUIRED"`. The file stays free of imports.
  - `pycore/callmodule/rpc_routes/local_queue_head_routes.py`:
    - `_KIND_LANES` is removed; `_resolve_lane` uses `AUDIO_QUEUE_LANE_BY_KIND`, imported from `pycore.pyutils.tts.audio_queue_center`. That file is in flight and was not edited.
    - The combined English failure is split in two. An empty or non-list `items` returns `{success: false, error_code: QUEUE_HEAD_ITEMS_REQUIRED}`. An unresolvable lane returns `{success: false, error_code: AUDIO_LANE_UNKNOWN}`.
  - `pycore/callmodule/rpc_routes/word_audio_full_sync_routes.py`: an unknown lane returns `error_code: AUDIO_LANE_UNKNOWN` instead of the bare `error` key.
- Codes for ui-pycore-manager p4-01, all under the `success: false` + `error_code` shape with no `error` key:

  | Route | Code | pc `errorCodes` entry |
  |---|---|---|
  | `ui/queue_center/promote_local_head` | `QUEUE_HEAD_ITEMS_REQUIRED` | new, needs to be added |
  | `ui/queue_center/promote_local_head` | `AUDIO_LANE_UNKNOWN` | exists |
  | `ui/queue_center/audio_lane_full_sync`, `ui/queue_center/word_audio_full_sync` | `AUDIO_LANE_UNKNOWN` | exists |
  | `ui/laravel_delivery/retry` (LDRI-53) | `DELIVERY_KIND_UNSUPPORTED` | new, needs to be added |

  The UI callers still read `response.error`: `OrchManifestPanel.tsx:105`, `PcAudioLaneFullSyncRow.tsx:40-41` and `PcDeliveryOutboxStatus.tsx:61`. Until p4-01 switches them to `error_code`, each falls back to its existing localized generic message, and no English is shown.
- Verification:
  - All three files compile.
  - `grep -rn _KIND_LANES pycore` finds nothing.
  - The scratch script `<scratchpad>/d7_route_errors.py` registers the real handlers on a fake server and calls them directly. It asserts `success is False`, the exact `error_code`, no `error` key, and no English phrase in any value. Result:
    - `promote no items` / `promote items not list`: `QUEUE_HEAD_ITEMS_REQUIRED`;
    - `promote bad kind` / `promote bad queue`: `AUDIO_LANE_UNKNOWN`;
    - `lane full sync bogus` / `lane full sync missing`: `AUDIO_LANE_UNKNOWN`;
    - `ALL OK`.
- Concurrent writer (coordination note for the pycore coordinator and reviewer): while this task ran, another agent added the X4 `_MD5_RE` / `_sanitize_item_md5` change to `local_queue_head_routes.py`. It was not in the in-flight list at task start. My edits were applied on top of it with fresh reads, and neither change was lost. The file diff, 26 added and 6 removed lines, therefore contains both changes. Mine are the route-name/lane imports, the `_KIND_LANES` removal, the `_resolve_lane` lookup and the two `error_code` returns.
- Cross-scope (pycore-ai, after the D1 closeout releases `pycore/pyctl/tts` and `pycore/pyutils/tts`):
  - `audio_lane_full_sync.py:131,133` `start_background` still returns a bare `error` key (`AUDIO_LANE_DISABLED` / `WORD_AUDIO_DISABLED` / `LARAVEL_ENDPOINT_UNKNOWN`). The full-sync routes pass that through, so switch it to `error_code`.
  - The literal `"AUDIO_LANE_UNKNOWN"` is also defined in `audio_lane_activation.py:45`. Recommended: define one `AUDIO_LANE_ERROR_UNKNOWN` next to `AUDIO_QUEUE_LANES` in `audio_queue_center.py`, import it in both routes and in `audio_lane_activation.py`, then drop `ROUTE_ERROR_AUDIO_LANE_UNKNOWN` from `route_names.py`. pycore-runtime makes the route side of that change.
  - `audio_queue_center.promote_local_head` returns English `f"unknown lane {lane}"`. The route guard makes this unreachable through RPC.

### LDRI-53: done (awaiting review)

- File: `pycore/callmodule/rpc_routes/local_task_center_routes.py`. `DELIVERY_ERROR_KIND_UNSUPPORTED` is read once at the top from the contract, `QUEUE_CENTER_DELIVERY["error_codes"]["kind_unsupported"]` (`config/queue_center_contract.json#delivery.error_codes`, value `DELIVERY_KIND_UNSUPPORTED`). The unknown-kind path returns `{success: false, error_code: DELIVERY_KIND_UNSUPPORTED}`.
- Decision (recommended option): reuse the contract's delivery code, which has the same meaning (a delivery kind the receiver does not support), instead of adding a second literal. The UI then localizes one code.
- Dependency: `QUEUE_CENTER_DELIVERY` is the D7 phase-2 addition to `pycore/pyutils/common/queue_center_contract.py`. It is in the working tree, uncommitted, written by the other D7 lane. That lane is inside the pycore-runtime scope. This file needs it to import.
- Verification:
  - The file compiles.
  - A direct handler call with `kind='bogus'` returns `{'success': False, 'error_code': 'DELIVERY_KIND_UNSUPPORTED'}` (same scratch script).
  - `grep -rn "unknown delivery kind" pycore` finds nothing.
- Not in this item: the same file still returns English for `control_name is required`, `task_id is required` and `lane must be word or sentence`. They are left for a follow-up item (smallest change).

### AHSC-35-py: done (awaiting review)

- Files:
  - `pycore/pyutils/common/relay_contract.py`: `agent_history_config_changed` is added to `RELAY_REQUIRED_EVENTS`.
  - `pycore/pyctl/relay/laravel_relay_agent_service.py`:
    - `start()` registers `BusSignals.AGENT_HISTORY_CONFIG_CHANGED` next to `AGENT_HISTORY_PROMPT_DERIVED` (lines 111-114), and `stop()` unregisters it (182-185).
    - The new `_publish_config_changed_device_event` publishes through `_publish_agent_history_event("agent_history_config_changed", payload, "config")`.
    - The bus payload from `agent_history/pipeline/config.py:204-208` is `{changed, config}`, which has no `ts`. The device event revision comes from `_allocate_event_revision` either way.
- Verification:
  - Both files compile.
  - `RelayContract()` loads (`contract.loaded`, digest `498009…eb93`). `'agent_history_config_changed' in RELAY_REQUIRED_EVENTS` is True, and `relay_contract.event('agent_history_config_changed')` is `agent_history.config.changed`.
  - An isolated call of `_publish_config_changed_device_event({'changed':['enabled'],'config':{'enabled':True}})`, with `_post_device_event` stubbed, produced `('agent_history_config_changed', 'agent_history.config.changed', payload, revision>0)`.
  - A grep shows the subscription beside `AGENT_HISTORY_PROMPT_DERIVED` at lines 108/112 and 179/183.
- Cross-scope (laravel-api, blocking end-to-end delivery of this event):
  - `RelayDeviceService::event` (`poly_apps/laravel_main/app/Apps/Relay/RelayServices/RelayDeviceService.php:60-67`) has an allowlist with only `terminal_changed`, `agent_history_prompt_new` and `agent_history_prompt_derived`. Add `RelayContract::event('agent_history_config_changed')`. Until then, Laravel answers the device event with 422 `device_event_invalid`. pycore logs `device.event.publish.failed` and carries on.
  - Also add the event to `RelayContract.php` `$requiredEvents` (line 553), as the contract note says.
  - The relay contract file itself is unchanged by this item.

### CKA-10-routes: deferred

- Reason: the item depends on the pycore-assist CKA-10 okx facade, and that facade does not exist.
  - Glob `pycore/**/*okx*` finds only the `database/models/app_okx` models.
  - No handler for any of the 15 names (`account_overview` … `status`) exists under `pycore/` or `pyapps/`.
  - `git log --all -S account_overview -- '*.py'` finds only an unrelated commit.
  - ui-vortex-D7 found the same: no okx/* server was ever committed, and `pyapps/okx_price_monitor` serves `monitor/*` / `trading/*` instead.
- Decision (recommended option): register no route names or handlers now. Constants without handlers would be dead code, and stub handlers would be served but broken. ui-vortex has hidden the panels until the routes are served.
- Next step:
  1. After pycore-assist lands the facade, pycore-runtime adds the 15 `OKX_*` names to `route_names.py` and one `okx_routes.py` in `callmodule/rpc_routes`.
  2. pycore-runtime diffs the names against `VORTEX_PYCORE_HTTP_ROUTES`, then tells ui-vortex which routes are live.
  3. The orchestrator adds relay `route_policies` entries for them.

### Services and restarts

No service was started, stopped or restarted. No restart is needed for review; the running pycore picks up the changes on its next start. The AHSC-35 relay event also needs the Laravel side (laravel-api) deployed before it reaches owners.

Changed files:
- `pycore/pyutils/common/gnome_shell_dbus.py`
- `pycore/pyutils/common/xdg_desktop_portal.py`
- `pycore/callmodule/rpc_routes/route_names.py`
- `pycore/callmodule/rpc_routes/local_queue_head_routes.py` (also holds another agent's concurrent X4 change)
- `pycore/callmodule/rpc_routes/word_audio_full_sync_routes.py`
- `pycore/callmodule/rpc_routes/local_task_center_routes.py`
- `pycore/pyutils/common/relay_contract.py`
- `pycore/pyctl/relay/laravel_relay_agent_service.py`

Blockers: CKA-10-routes waits for pycore-assist CKA-10. Next owners:
- reviewer (pycore-runtime-D7);
- ui-pycore-manager p4-01 (the error_code list above);
- pycore-assist (LTCW-12 import, CKA-10 facade);
- laravel-api (RelayDeviceService allowlist and `$requiredEvents`);
- pycore-ai (full-sync `error_code`, the `AUDIO_LANE_UNKNOWN` constant).

## pycore-runtime-D7P2-fix (part 1)

Re-routed by the orchestrator after three rounds mis-assigned this task to
pycore-ui (which correctly deferred every item each time). This session took
the round-3 verdict's open items B1, B2, B3, B5 exactly as stated in
`.claude/agents_shared/reviews/pycore-runtime-D7P2-fix.json` (reviewer
pycore-lead) and the underlying `.claude/agents_shared/reviews/pycore-runtime-D7P2.json`
blocking issues. B4 (pycore-lead's foundation fix in `serialized_worker.py`,
plus the docstring rewrite that depends on it) and B6 (this section) are
explicitly out of scope for part 1 per the task split; B6 is written here now
that B1/B2/B3/B5 are done.

Concurrency: the pycore group workflow was still running during this task
(other pycore-runtime and pycore-ai lanes on their own files, per the task's
concurrency note). None of B1/B2/B3/B5's files overlapped those lanes. Each
file was re-read immediately before its edit.

### B1 (word identity, one owner): done (awaiting review)

- Files: `pycore/pyutils/common/queue_center_contract.py`,
  `pycore/callmodule/rpc_routes/local_queue_head_routes.py`.
- `queue_center_contract.py`: reads `_CONTRACT_DOCUMENT["word_identity"]` once
  at the file top (right after `_TASK_CONTRACT`), derives
  `_WORD_IDENTITY_FALLBACK_CONTENT_TEMPLATE` from
  `word_identity.fallback_when_md5_absent.key_format` by stripping the
  `<lang>:` prefix (no `"text:"` literal anywhere), and adds two exported
  helpers: `word_identity_md5(value)` (strip/lower, `""` unless the result is
  32 hex chars) and `word_identity_content(md5, text)` (the normalized md5,
  else the fallback content for the cleaned word, else `""`). `audio_dedup_key`
  now calls `word_identity_content` instead of building `f"text:{...}"`
  inline, and its docstring drops the "matching ``build_local_task`` and
  ``audio_resource_ledger.resource_key``" clause. Both helpers are added to
  `__all__`.
- `local_queue_head_routes.py`: `_MD5_RE` is removed; `_sanitize_item_md5`
  now calls the contract's `word_identity_md5` and stores the normalized
  value on the item (so an upper-case md5 becomes lower-case instead of
  surviving as a second identity) or drops the key when it does not resolve
  to 32 hex chars.
- Verification:
  - `python -m py_compile` on both files: OK.
  - `word_identity_md5("5D41402ABC4B2A76B9719D911017C592")` ->
    `"5d41402abc4b2a76b9719d911017c592"`; on `"not-a-md5"` and `None` -> `""`.
  - `audio_dedup_key("word_audio", "en", "hello")` -> `"en:text:hello"`;
    with `md5="5D41402ABC4B2A76B9719D911017C592"` -> the lower-case md5 key,
    matching the review's exact verify values.
  - `grep -rn 'f"text:' pycore/pyutils/common pycore/callmodule` -> empty (the
    two remaining hits repo-wide are pycore-ai's `audio_resource_ledger.py`
    and `audio_queue_center.py`, explicitly out of this assignment).
  - `grep -rn _MD5_RE pycore` -> empty (only the new, differently-named
    `_WORD_IDENTITY_MD5_RE` exists, inside the contract module).

### B2 (RPC item whitelist): done (awaiting review)

- File: `pycore/callmodule/rpc_routes/local_queue_head_routes.py`.
- `promote_handler` now builds each item with the new `_build_rpc_item`
  helper instead of forwarding the caller's dict verbatim: only
  `language`/`text`/`kind`/`content_id` are copied, plus the sanitized `md5`
  when it resolves. `task`, `_laravel_base_url`, `owner` and any other
  caller-supplied key are dropped before the item reaches
  `audio_queue_center.promote_local_head`. `_sanitize_item_md5` is unchanged
  in shape (still used by `_build_rpc_item`) and still X4-normalizes the
  identity.
- In-process callers are unaffected: `orch_promote.py:57-64` calls
  `audio_queue_center.promote_local_head` directly (not through this RPC
  route) and keeps passing `task` in its own items; `promote_local_head`
  itself was not touched (pycore-ai's file).
- Verification (scratch script, `audio_queue_center` stubbed, no
  `register_http_routes` call, as the review specified):
  - `_build_rpc_item({..., "task": {...}, "_laravel_base_url": "http://evil", "owner": "x"})`
    keeps only `language`/`text`/`kind`/`content_id`/`md5`.
  - A direct `promote_handler` call with
    `items=[{language:'en', text:'hello', kind:'word', task:{task_id:'x', task_type:'word_audio', payload:{md5:'zz'}, _laravel_base_url:'http://evil'}}]`
    reaches the stubbed `promote_local_head` with an item dict that has no
    `task` key.

### B3 (wake-gate helper): done (awaiting review)

- File: `pycore/pyctl/queue_center/snapshot_service.py`.
- New module-level `_lane_wake_ready(control)`: true only when the lane's
  heartbeat callback is enabled (`LANE_REGISTRY[control]["heartbeat_callback"]`,
  the same check `wake_workers` already made) and, for an audio lane
  (`control in AUDIO_QUEUE_LANES`), `audio_queue_center.restore_complete(control)`
  is also true. `wake_workers` now calls this helper instead of its inline
  check. `apply_head_event` computes the target `lane` once
  (`"sentence_audio"` or `"word_audio"`, same logic as before, only hoisted
  out of the per-item loop) and gates its `worker.request_pull(prefer_remote=True)`
  on `_lane_wake_ready(lane)`. `set_cached_task_head` and the snapshot/cache
  update stay unconditional, so a replayed head ticket is still recorded; only
  the remote pull is gated, closing the boot-time race where a Mercure replay
  could pull remotely before the audio-lane cache restore finished.
- New import: `from pycore.pyutils.tts.audio_queue_center import AUDIO_QUEUE_LANES, audio_queue_center`
  (no cycle: `audio_queue_center.py` does not import from `pyctl.queue_center`).
- Verification: `python -m py_compile` OK; read-through of both call sites
  confirms `set_cached_task_head` is still called unconditionally per item,
  and `activate_audio_lane`'s post-restore `request_pull(prefer_remote=True)`
  (`audio_lane_activation.py`) is untouched, so no wake is lost for a lane
  whose restore has actually completed.

### B5 (delivery batch URL templates + history comments): done (awaiting review)

- Files: `pycore/pyutils/laravel/delivery_diff.py`,
  `pycore/pyutils/common/queue_center_contract.py`.
- `delivery_diff.py`: adds `DELIVERY_BATCH_CONTENT_PATH` /
  `DELIVERY_BATCH_STATUS_PATH` read from the existing `_DELIVERY_ROUTES`
  reader (`_DELIVERY_ROUTES["batch_content"]` /
  `_DELIVERY_ROUTES["batch_status"]`). The batch-content upload
  (`_upload_batch_once`) and the batch-status poll (`_await_batch`) now
  build their URL with `<PATH>.replace("{batch_id}", batch_id)` instead of
  suffixing `DELIVERY_BATCH_PATH` by hand.
- History phrasing removed: `delivery_diff.py:39-40` ("this module used to
  keep its own copy of every one of them") and
  `queue_center_contract.py:220-222` ("which used to keep their own copies of
  these values"); the surrounding factual comment (what the block is / where
  it is used) is kept.
- Verification:
  - `python -m py_compile` on both files: OK.
  - `DELIVERY_BATCH_CONTENT_PATH.replace("{batch_id}", "b1")` ->
    `"/api/app_qy_v1/delivery/batch/b1/content"`;
    `DELIVERY_BATCH_STATUS_PATH.replace("{batch_id}", "b1")` ->
    `"/api/app_qy_v1/delivery/batch/b1"` (same URLs the old suffixing built).
  - `grep -rn "used to keep" pycore/pyutils/laravel/delivery_diff.py pycore/pyutils/common/queue_center_contract.py` -> empty.

### Cross-checks and static verification (all four files)

- `python -m py_compile` on all four changed files together: OK.
- Import check (`PYTHONDONTWRITEBYTECODE=1`, `PIP_NO_INDEX=1`): `pycore.callmodule`,
  `pycore.pyutils.common.queue_center_contract`,
  `pycore.callmodule.rpc_routes.local_queue_head_routes`,
  `pycore.pyctl.queue_center.snapshot_service` and
  `pycore.pyutils.laravel.delivery_diff` all import cleanly (no new
  third-party auto-install beyond pycore's normal startup package check).
- `git diff --numstat` equals `--ignore-space-at-eol` for all four files (no
  line-ending churn):
  - `pycore/pyutils/common/queue_center_contract.py`: CRLF, 853/853 lines
    (was 814/814 at HEAD; the file's own convention, matching the prior
    pycore-6 CRLF restore recorded for this file).
  - `pycore/callmodule/rpc_routes/local_queue_head_routes.py`: LF, 91/91
    lines (was 73/73 at HEAD).
  - `pycore/pyctl/queue_center/snapshot_service.py`: LF, 863/863 lines (was
    851/851 at HEAD).
  - `pycore/pyutils/laravel/delivery_diff.py`: LF, 316/316 lines (was
    315/315 at HEAD).
- Note on a transient EOL flip observed mid-task, not caused by this session:
  partway through this task, `git status` showed a large number of unrelated
  `pycore/**` files (dozens, none touched by this task) as modified against
  HEAD, and `pycore/pyutils/laravel/delivery_diff.py` itself was momentarily
  found on disk as all-CRLF (with text otherwise byte-identical to HEAD once
  normalized) even though this session had not yet edited it. `core.autocrlf`
  is `true` repo-wide and `.gitattributes` sets no `eol` for `*.py`, so any
  concurrent checkout/reset/stash by another process in this shared working
  tree re-materializes Python files as CRLF regardless of their committed
  (LF) convention. This session built its `delivery_diff.py` edit directly
  from `git cat-file -p HEAD:...` (confirmed LF, and confirmed
  content-identical to the transient on-disk copy once EOL-normalized) so the
  final file is a clean LF diff with no churn. This is worth the orchestrator's
  attention if it recurs, since it affects files no lane is meant to touch.

### Services and restarts

No pycore or Laravel service was started, stopped or restarted for this
task. No test was added or run beyond the static checks above (none was
asked for).

Changed files (part 1):
- `pycore/pyutils/common/queue_center_contract.py` (CRLF)
- `pycore/callmodule/rpc_routes/local_queue_head_routes.py` (LF)
- `pycore/pyctl/queue_center/snapshot_service.py` (LF)
- `pycore/pyutils/laravel/delivery_diff.py` (LF)

Blockers: none for B1/B2/B3/B5. B4 still waits on pycore-lead's F-1
(`pyfoundations/serialized_worker.py` `BusTaskThread.run`, verified by the
reviewer service) before pycore-runtime can rewrite
`pyctl/runtime/event_handlers.py:431-434`'s docstring and re-check the
red-line. Next owners:
- reviewer / pycore-lead, for this part-1 verdict on B1/B2/B3/B5;
- pycore-lead, for F-1 (foundation fix backing B4);
- pycore-runtime (a later task), for the B4 docstring rewrite once F-1 lands;
- pycore-ai, to adopt `word_identity_md5`/`word_identity_content` in
  `audio_resource_ledger.py:42/:52` and `audio_queue_center.py:139-140`
  (non-blocking follow-up recorded in both prior reviews).
