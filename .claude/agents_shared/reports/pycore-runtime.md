# pycore-runtime report

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

### Cross-scope notes

- None. Both files (`prompt_archive.py`, `agent_history_txt.py`) are inside
  `pycore/pyctl/agent_history/`, which the current (D22) map assigns to pycore-runtime; no
  other role's path was touched. `agent_history_service.py` (the caller) was read but not
  edited, per the M-1 instruction to keep that line.
- Pre-existing, unrelated: `pycore/pyctl/assist/capability_sync.py`,
  `pycore/pyctl/tts/{audio_lane_full_sync,audio_resource_delivery,laravel_audio_delivery}.py`
  and `pycore/pyutils/tts/{audio_queue_center,word_audio_cache}.py` show as modified in the
  working tree from other concurrent agent work; none of them were read or touched for this
  task.

### Services and restarts

No pycore or Laravel service was started, stopped or restarted for this task; the two
changed modules only affect agent-history extraction, which the next pycore start or the
next `extract()`/`live_scan()` call picks up.

Changed files (this task):
- `pycore/pyctl/agent_history/prompt_archive.py`
- `pycore/pyctl/agent_history/agent_history_txt.py`

Blockers: none. Next owner: reviewer, for `.claude/agents_shared/reviews/pycore-assist-D7-fix.json`.

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
