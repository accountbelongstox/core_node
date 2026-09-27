# pycore-lead report

## Confirm pycore-ai-D7 (PRAO-07)

- Status: approved stands; confirm only, no re-review (done_before_outage_unreviewed).
- Verdict file: `.claude/agents_shared/reviews/pycore-ai-D7.json` (added `lead_confirmation`; original 17:30 findings kept).
- Checked: `pycore/pyctl/ai/prompt_derive.py` unchanged since the verdict; diff vs 74e7770 is 3/2 with no EOL churn (LF); py_compile OK; signature defaults equal `AI_SOURCE_PROMPT_DERIVE` / `AI_SOURCE_PROMPT_REWRITE`. The change is now in HEAD 5bbb23682 (user commit).
- Changed files (this task): the verdict file and this report only.
- Deferred to orchestrator: `AI_SOURCE_PROMPT_DERIVE` is not in `OPENROUTER_ATTEMPT_SOURCES` (`pycore/pyctl/agent_history/ai_sources.py:15-19`).
- Blockers: none. Next owner: orchestrator.

## Review ui-vortex-D7 (CKA-10-ui interim, member pycore-ui)

- Verdict: approved (interim). File: `.claude/agents_shared/reviews/ui-vortex-D7.json`.
- Scope reviewed: the D7 delta in HEAD 5bbb23682 (`apps/vortex/api/VortexPycoreContract.ts` +34, `apps/vortex/api/index.ts` +1, `apps/vortex/VortexApp.tsx` +25/-13). The rest of the 74e7770 diff for these files is f4f223414, already approved in vortex-1..5.
- Checks: CRLF kept on every line, with no EOL churn; tsc --noEmit exit 0 (5.81 GB free); scratch route diff: 15 declared, 0 served, each panel gate equals the routes that panel calls, 0 unserved routes without a hidden panel; no pycore connection while the panels are hidden.
- Decision (recommended option): approve the interim state instead of holding it until okx/* exists. The B9 ruling asks only to hide the unserved panels, and shape alignment is already assigned to pycore-ui-G5 CKA-10-ui.
- Non-blocking, for G5 and the owners: `pycore/pyctl/okx/` is absent and `route_names.py` has 0 okx entries, so pycore-runtime CKA-10-routes cannot be complete until pycore-assist CKA-10 lands. The okx_market_* event topics are not gated and are not published today. Relay route_policies for okx/* (orchestrator).
- Changed files (this task): the verdict file and this report only.
- Blockers: none. Next owner: pycore-ui (G5 CKA-10-ui, after CKA-10 and CKA-10-routes).

## Review pycore-assist-D7 (partial, pre-outage, successor pycore-runtime)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/pycore-assist-D7.json`.
- Scope: what is on HEAD 5bbb23682 with no report and no merge_meta entry (the changed set is derived from git). That covers AHSC-04 (`extractor_registry.py`, `pipeline/config.py`, `agent_history_service.py`, `ui_service.py`), the AHSC-36 remainder (`agent_history_service.py:201-204,512`) and the half-landed AHSC-28 (`agent_history_service.py:415`).
- AHSC-04 is accepted, with no change needed. The registry is the one source, with an import-time RuntimeError on a marker mismatch or a duplicate tool. SUPPORTED_TOOLS keeps its value and order.
- Checks: EOL gate clean (LF, numstat equals --ignore-space-at-eol); compile OK; item verify passed (9 tools, marker order, monkeypatched mismatch and duplicate both raise); the scratch imports have no cycle; the module-attribute check flags only M-1. Free RAM was 6.04 GB.
- Blocking, for pycore-runtime G1 (first item):
  - M-1: `prompt_archive.ARCHIVE_ROOT_ONLY_FIELD` is undefined, so every extraction fails before the store is written.
  - AHSC-28 completion: `prompt_archive.py:35` still sets 0o666, `:107-111` still has `except OSError: pass`, and the `agent_history_txt.py` modes are unchanged. Reuse root_spool.SPOOL_FILE_MODE.
- Non-blocking:
  - The AHSC-36 propagate path overwrites the last summary with an error after a successful store, and `prompt_new_cache.py:83` still says failures are non-fatal.
  - `ui_service.py:435-436` looks up the marker table twice per tool.
- Not started, and stays in G1: AHSC-11, LTCW-05, AHSC-29, AHSC-33-py, LTCW-12, LTCW-29, PRAO-08, CKA-10.
- Decision (recommended option): the whole task is changes_requested rather than approving AHSC-04 alone, because the M-1 blocker sits in one of its files. The eight unstarted items are not re-listed as blocking, because they are already in the successor assignment.
- Changed files (this task): the verdict file and this report only.
- Blockers: M-1 (extraction is down until G1 lands). Next owner: pycore-runtime (G1), then pycore-lead re-review.

## Review ui-pycore-manager-D7 (partial, pre-outage, member pycore-ui)

- Verdict: approved. File: `.claude/agents_shared/reviews/ui-pycore-manager-D7.json`. This releases pycore-ui-G1.
- Scope: p4-02 (with the p5-01 UI half of RV-004), AOQSD-27, LTCW-17, MCHR-22-ts and AHSC-35-ui. There is no merge_meta entry and no member report, so the changed set comes from git: 18 pycore-ui files in HEAD 5bbb23682. The working tree equals HEAD. The other hunks against 74e7770 come from f4f223414 and were approved earlier.
- Checks: no EOL churn (numstat equals --ignore-space-at-eol, and per-line endings are kept in the mixed AppQyV1AiToolsContract.ts); tsc --noEmit exit 0 with 0 errors (6.59 GB free); every item's verify grep is empty; the 'stopping' values match the pycore producer; the relay payload shape matches pycore and Laravel.
- Decision (recommended option): accept the config.changed relay bridge in AgentHistoryRuntimeStore.ts:340, which owns the config state, instead of next to prompt.new in the page. The prompt.new bridge was folded into the same shared helper, bridgeRelayDeviceEvent.
- Non-blocking, for the owners:
  - pycore-laravel AHSC-35-relay: RelayDeviceService.php:60-64 still rejects agent_history_config_changed with a 422.
  - Orchestrator: can now delete `task_contract.stream_events` (queue_center_contract.json:530). An optional contract follow-up: one lifecycle list to replace the TS union, the TS array and the Python Literal.
  - pycore-ui: MCHR-31 is only started (the status constants exist, but there is no presenter and no adoption).
- Changed files (this task): the verdict file and this report only.
- Blockers: none. Next owner: pycore-ui (G1).

## Review shell-windows-3 (D12b Windows side, pre-outage; model-step files now pycore-ai)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/shell-windows-3.json`.
- Scope:
  - Files: `DockerWslBridge.ps1`, Step55/56 (pycore-ai), Step29/30 (shell-windows), and windows.md SPW-006..017.
  - Checked against shell-linux-3: the runner, the lifecycle lib, 139/143, and melotts/fishspeech model.sh.
  - No merge_meta entry and no items in items_pycore.json, so the spec is record §1 D12/D12b, §11.1-§11.3 and the TASKS.md row.
  - HEAD equals the working tree.
- Accepted: the runner contract matches Linux (RESULT line, restart-required, root, WSLENV device, staging). The WSL2 + Debian 13 ensure never unregisters, never sets a default and never touches .wslconfig (caps unchanged). The Step29 wsl.conf merge keeps [boot] systemd. Step30 unattended/side-by-side is correct.
- Blocking, as one extra assignment for pycore-ai (before the G3 model runs):
  - B1: the Step55/56 docker branch skips the opt-in gate. With Step56 now defaulting to docker, a fresh pyservice boot runs the heavy ensure. Gate it on $doFull/$Force on both platforms.
  - B2: test and up -Release terminate a distro that was already running before the call, and so does the restart branch. Terminate only a distro this call started.
  - B3: the wrappers now need model.sh, which is missing for cosyvoice and gptsovits. The Step52/54 and 133/137 docker branches regress to a certain FAIL plus exit 1. Add model.sh and the compose env, pass -StagingDir, and replace exit 1. Interim alternative: drop the docker option.
- Non-blocking:
  - pycore runtime start of docker-backed engines (phase 2, pyutils/tts frozen).
  - windows.md rows still say pending-linux (shell-windows ledger).
  - ensure_docker_for_tts.sh has no callers left.
  - Initialize-failure distro leak.
  - wsl.conf created with mode 0755.
  - WSL helpers are a cross-group dependency.
  - No ensure RAM pre-flight.
  - The D12b model-run acceptance is still open (G3).
- Checks: PS parser 0 errors (5 files); bash -n OK (7 files); in-process Get-DockerModelDefinition; no EOL churn (i/lf w/lf, 0 CR). No WSL start, build or test (5.96 GB free).
- Decision (recommended option): keep the Step56 docker default, which follows D12 and the Fish Speech docs ("System: Linux, WSL"), and enforce the steps' own opt-in gate instead of reverting the default.
- Changed files (this task): the verdict file and this report only.
- Blockers: B1-B3. Next owner: pycore-ai (extra assignment), then pycore-lead re-review. shell-windows: ledger flip only (non-blocking).

## Review pycore-architect-D7 (pre-outage, retired lane now in lead scope)

- Verdict: approved. File: `.claude/agents_shared/reviews/pycore-architect-D7.json`. This releases pycore-lead-G1 to edit `system_paths.py` and `service_contract.py`.
- Scope: arch-bus-signals, LTCW-03-exports, LTCW-02, CKA-04, AHSC-21 and LTCW-20. There is no merge_meta entry and no lane report, so the changed set comes from git: 10 pyfoundations files in HEAD 5bbb23682. The working tree equals HEAD. The desktop_session `_cookie_mtime` hunk is from f4f223414. arch-audit stays open in G1.
- Checks:
  - EOL: no churn (shortstat equals --ignore-space-at-eol). Per-line endings are kept in the mixed service_contract.py and the CRLF _cache.py.
  - Windows: py_compile passes on all 10 files; the item verifies pass. Base and HEAD core_node_dirs agree on the data dir, the global_var dir, the OS tag and 12 constants. Sample os-release tags are unchanged. Free RAM was 4.26 GB.
  - Debian WSL: base and HEAD agree on the OS tag, the www base and the NTFS mount check. The per-user resolver and the slot roots resolve.
  - Imports: an AST sweep of 344 importer names finds 0 missing, and fresh-process imports have no cycle.
- Non-blocking, in lead scope for the next pyfoundations touch:
  - `_dep_check.py:44-47`: use PLATFORM_ONLY_PACKAGES instead of a second platform switch.
  - `third_party/api.py`: re-export LINUX_ONLY_PACKAGES.
  - `desktop_session.py:232,243-245`: move the remaining inline env names into constants.
  - Fix the stale 'MyBest' example at `system_paths.py:121` and the 'stdlib-only' docstring at `core_node_dirs.py:3`.
- For pycore-runtime G1 (AHSC-11): the consumers still register the literal 'tray.show_notification'.
- Decision (recommended option): approve rather than hold for the cosmetic notes. None of them breaks a requirement or a verify step.
- Note: I started Debian WSL for one static check. It idles out on its own, and nothing was left running.
- Changed files (this task): the verdict file and this report only.
- Blockers: none. Next owner: pycore-lead (G1).

## Review pycore-runtime-D7 (pre-outage, member pycore-runtime)

- Verdict: approved. File: `.claude/agents_shared/reviews/pycore-runtime-D7.json`. This releases pycore-runtime-G3 and pycore-ui p4-01.
- Scope: LTCW-12-consts, AOQSD-21, LDRI-53 and AHSC-35-py. The delta is f4f223414..HEAD 5bbb23682 on the 8 merge_meta files, and the working tree equals HEAD. The rest of the diff against 74e7770 comes from f4f223414. The X4 `_MD5_RE` hunk is left to pycore-runtime-D7P2. CKA-10-routes was deferred correctly: there is still no okx facade.
- Checks:
  - EOL: no churn. The 2 CRLF files are fully CRLF and the 6 LF files are fully LF.
  - py_compile passes on all 8 files. The item verifies pass, including the direct handler calls (`ALL OK`: error_code only, no English).
  - RelayContract() loads with the new required event.
  - Start chain: imports OK. 293 routes register with 0 duplicates. Free RAM was 6.65 GB.
- Side effect (mine): the full register_http_routes check resumed the 19 `generating` orchestration tasks for about 1 s before exit, even though my memory already warns against this. pycore was not running, and all 20 tasks are still `generating`.
- Non-blocking, for the owners:
  - pycore-laravel AHSC-35-relay: the RelayDeviceService.php:60-64 allowlist, and RelayContract.php `$requiredEvents`.
  - pycore-ai phase 2: the bare `error` codes in audio_lane_full_sync.py, one AUDIO_LANE_UNKNOWN constant, and the English `unknown lane` text.
  - pycore-ui p4-01: QUEUE_HEAD_ITEMS_REQUIRED and DELIVERY_KIND_UNSUPPORTED. Read error_code first, then error.
  - pycore-runtime:
    - CKA-10 facade plus the routes (both in its scope under D22);
    - the remaining English in local_task_center_routes.py;
    - the stale `_publish_agent_history_event` docstring;
    - the duplicate MEMORY.md index line.
- Decision (recommended option): approve rather than hold for the notes. Every note is in a frozen file, is another owner's item, or is cosmetic.
- Changed files (this task): the verdict file, this report and my memory index.
- Blockers: none. Next owners: pycore-runtime (G3), pycore-ui (p4-01), pycore-laravel (AHSC-35-relay).

## Review laravel-D7 (partial, pre-outage lane plus the 18:3x coordinator fixes, successor pycore-laravel)

- Verdict: approved (landed subset only). File: `.claude/agents_shared/reviews/laravel-D7.json`. This releases pycore-laravel-G1.
- Scope: merge_meta has no laravel-D7 entry, so the changed set comes from git.
  - Diffing f4f223414 against the working tree with --ignore-space-at-eol, 9 laravel files changed.
  - Lane (in HEAD 5bbb23682): LaravelConfig, logging.php, services.php, RuntimeConfigurationServiceProvider, the new ContractDocument, ServiceContract.
  - Coordinator (uncommitted): the AppServiceProvider registration, 25 codemart lang keys (13 ledger, 12 cli), the ContractDocument docblock.
- Item status:
  - USER175-11 is confirmed.
  - contract-readers is partial: the ServiceContract/ContractDocument half landed; the QueueCenterContract accessors and ServerIdentityHeader did not.
  - USER175-07 is partial: the registration landed; the sys:codemartinit text did not.
  - CKA-08, srv-06, T12, the srv-01 record, D9-01, CKA-13, USER175-09, D9-09 and CKA-25 have not started.
  - The final laravel-merge verification is open.
- Checks:
  - EOL: no churn; all 9 files are LF in both base and working tree.
  - php -l passes on 10 files.
  - In-process script, read-only, with array cache; free RAM was 4.82 GB:
    - seed_demo === true;
    - the bank_transfer shape is unchanged (null defaults);
    - the daily and single log levels are 'warning' (stack -> daily);
    - the ServiceContract paths readers equal the contract and the PathMapper values;
    - dataSync() equals the raw block;
    - all 25 keys resolve in en and zh_CN with matching placeholders, and codemart.php has full key parity;
    - codemart:admin-password is registered with --file.
  - A grep finds no env( in config, app, routes or bootstrap.
- Decision (recommended option): approve the landed subset, following the pycore-assist and pycore-ui D7 precedent. The landed code has no defect. The open items are not re-listed as blocking, because they stay in pycore-laravel-G1 as its own item list. The non_blocking entries in the verdict are inputs for those items:
  - CKA-08 must consume the currently unused ServiceContract paths readers and delete the PathMapper constants;
  - dataSync() has no caller: turn it into a generic section() or delete it;
  - fix the ContractDocument value() docblock or make value() private;
  - correct the syslog note at laravel.md:233 in the pycore-laravel report;
  - the USER175-07 remainder should reuse codemart.cli.seed.done and codemart.cli.seed.password_file.
- For the orchestrator: whether D17 also covers the launcher and OS getenv reads (ECDICT_DB_PATH, PHP_CLI_SERVER_WORKERS, the FrankenPHP builder envs, LARAVEL_SERVICE_RUN).
- Cross-scope:
  - codemart-lead: the coordinator's open codemart-laravel items (apply a generated secret to the existing accounts; keep the password out of Log::info), and the null/'' tolerance at CodeMartV1Initializer.php:552-554.
  - shell group: the stale CODEMART_SEED_DEMO env comments at 175:652 and Step175:91.
- Changed files (this task): the verdict file and this report only. No Laravel code changed, and the workers were not restarted.
- Blockers: none. Next owner: pycore-laravel (G1).

## Review pycore-runtime-D7P2 (pre-outage phase-2 runtime half, member pycore-runtime)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/pycore-runtime-D7P2.json`. pycore-runtime-G3 stays gated until the re-review.
- Scope: the D7P2 hunks on HEAD 5bbb23682 in these files (the working tree equals HEAD; the later user commits do not touch pycore):
  - `queue_center_contract.py`: QUEUE_CENTER_DELIVERY, the X4 audio_dedup_key fallback, and 7 EOL-only lines;
  - `pyutils/laravel/{delivery_diff,identity}.py` (LDRI-35-py);
  - `event_handlers.py`: apply_assist_runtime now runs at the end of the boot chain;
  - `local_queue_head_routes.py`: the `_MD5_RE` check (p5-02).
  
  `snapshot_service.py` was not changed in D7P2 (mtime 16:14; its hunks were approved in pycore-5). There is no merge_meta entry and no D7P2 report, so the hunks were separated by time.
- Checks:
  - EOL: accepted. The 7 LF lines that 45901d3f6 introduced are CRLF again, so the file is uniform CRLF and pycore-6 has nothing left to restore there. The other files have no churn.
  - py_compile passes on all 6 files, and the delivery and identity constants equal the old literals.
  - The fallback keys agree across the three builders.
  - start_bus_task with a raising callback prints nothing.
  - Free RAM was 5.91 GB.
- Blocking, as an extra assignment for pycore-runtime:
  - B1: one X4 word-identity helper in queue_center_contract, derived from `word_identity.fallback_when_md5_absent.key_format`. It normalizes an upper-case md5 to lower-case, and both audio_dedup_key and _sanitize_item_md5 use it.
  - B2: the promote RPC drops `items[].task`. Today that field bypasses the md5 check and `_laravel_base_url`, and the route is relay-exposed through the general_action default.
  - B3: the snapshot head-ticket wake (`snapshot_service.py:549-550`) is gated on the lane callback being enabled and on `restore_complete`. The realtime replay at boot currently pulls remote before the cache restore finishes.
  - B4: a boot-chain failure is now silent, because BusTaskThread drops errors when no response_signal is set, and the docstring says it propagates.
  - B5: build the batch content/status URLs from the contract templates, and remove the "used to" history comments.
  - B6: write the D7P2 report section.
- Own follow-up F-1 (pycore-lead, foundation; the reviewer service verifies it): in `pyfoundations/serialized_worker.py`, `BusTaskThread.run` reports a failed fire-and-forget callback with ColorPrint.red. B4 depends on it. Not started in this task.
- Cross-scope, pycore-ai:
  - use the B1 helper in `audio_resource_ledger.py:42,52` and `audio_queue_center.py:140`;
  - log the `capability_sync.py:35` restore-wait timeout (M-4 family).
- Decision (recommended option): changes_requested, not approval with notes. B2 and B3 are behavior defects, and B4 is a regression in error visibility.
- Changed files (this task): the verdict file, this report, and my pitfalls memory (the BusTaskThread swallow).
- Blockers: B1-B6. Next owners: pycore-runtime (extra assignment), then pycore-lead for the re-review and F-1.

## Review shell-linux-3 (D12b Linux runner, pre-outage; now pycore-ai scope)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/shell-linux-3.json`. pycore-ai-G3 stays gated until the re-review.
- Scope: the 11 files in the task text, 74e7770..HEAD. User commit 5bbb23682 is the only commit that touches them, and the working tree equals HEAD. merge_meta.json has no shell-linux-3 key, and items_pycore.json has no items for it. I reviewed against §1 D12b, §11 and the Windows contract rows SPW-006..017.
- Accepted:
  - the runner contract (one RESULT line on every path, exit 0 only on PASS);
  - the finest-grain idempotent ensure, which never starts the service container;
  - test always runs down;
  - the 139/143 docker branches;
  - the melotts/fishspeech definitions, Dockerfiles and compose files. The v1.5.1 api_client `--no-play`, the api_server args, `/v1/health` and `torch<=2.4.1` were checked upstream.
- Evidence on this machine: the MeloTTS ensure reached the import check at 17:08 with the current repo fingerprint `899b66bb...:cpu`. The test never ran. The Fish Speech ensure stopped after the asset sync at 17:18.
- Blocking (extra assignment for pycore-ai), B1: add model.sh for cosyvoice, gptsovits and voxcpm2. Their compose.yml also needs the `pycore.fingerprint` build label and the limits. voxcpm2 also needs `tts_server_common.py` in its image and the pyfoundations/contract mounts. Without these, the 133:69 and 137:83 `tts_docker_apply_engine` docker branches (and Windows Step52/54) now always FAIL `model_definition_missing`, which the harness reproduced.
- Decisions (recommended options):
  - keep the CRLF->LF change on the 4 melotts/fishspeech Docker/compose files, because a revert would force a MeloTTS rebuild for no gain;
  - make the missing model.sh files blocking, since no follow-up task exists;
  - the model runs are G3's job and are not needed for this verdict.
- Non-blocking: see the verdict file. The main ones:
  - pycore has no docker-backend start path (tts_service_manager.py, phase 2);
  - the test trap handling and the missing RESULT line on INT/TERM;
  - the runner is committed as 100644;
  - windows.md SPW-006..014 still show pending-linux (orchestrator/shell-windows);
  - small helper duplications.
- Checks: bash -n on 9 files; the static harness; the fingerprint compare; the EOL numstat. No distro, build or container was started (Debian stopped, free RAM 5.95 GB).
- Changed files (this task): the verdict file and this report only.
- Blockers: B1. Next owners: pycore-ai (B1, then the G3 runs, one at a time), then pycore-lead for the re-review.

## Review pycore-ai-D7P2 (pre-outage phase-2 lane, member pycore-ai)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/pycore-ai-D7P2.json`. B1-B4 go to pycore-ai as an extra assignment. pycore-ai-G1 (M-4) may run in the same writer lane; B4 and M-4 both touch the restore gate.
- Scope: the pycore-ai-path hunks in f4f223414..HEAD. All of them are in 5bbb23682, and b20962b4f has no pycore change. The pycore-5 D10 hunks (approved at 16:48, committed later) were separated using the pycore-5 changed-files list and its "X4 detail" in reports/pycore.md.
- Hunks reviewed:
  - X4 in `audio_resource_ledger.py`, `audio_resource_delivery.py` and `audio_queue_center.build_local_task`;
  - the restore gate: `audio_queue_center` restore signal and `wait_for_restore`, `capability_sync`, `audio_lane_full_sync`;
  - `runtime_profile` docstring, `word_audio_cache.note_stored`, and the `memory_gate:151` timeout.
- Not judged here, fit-checked only: `event_handlers.py`, `queue_center_contract.py` and `local_queue_head_routes.py` (pycore-runtime-D7P2).
- Accepted:
  - RESTARTTRAY-05;
  - the memory_gate timeout;
  - the gate design. wait_signal does not consume the signal, and the boot order fits.
- Blocking:
  - B1: `laravel_audio_worker_state.py:566-589` still requires payload.md5, so every md5-less local word task (orchestration Part1, manual promote) fails in the lane worker. Probe-confirmed.
  - B2: `audio_resource_delivery.py:312-329`. The md5-less single upload gets 400 from every server without LDRI-11 (AppQyV1WordMediaController.php:153-157), and the kind has no permanent_error, so the row retries forever.
  - B3: `word_audio_cache.py:200-216`. note_stored exposes a partial index for a language load_all has not installed yet, so cached words read as misses during the boot load. Probe-confirmed.
  - B4: the 180 s restore-wait constant is duplicated (`capability_sync.py:27`, `audio_lane_full_sync.py:46`), and neither caller logs a timeout.
- Non-blocking:
  - M-4 is still present (G1).
  - The restore never signals when it raises.
  - flush_dirty is not gated on the restore (pre-existing).
  - Legacy snapshot and ledger rows still carry invented md5s.
  - cleaned_word normalization is not pinned in the contract (orchestrator/LDRI-11).
  - Carried: 'error' codes should be 'error_code', and the English 'unknown lane' text.
  - Adopt the pycore-runtime-D7P2 B1 helpers once they land.
  - A failed request_start in the audio-lane bus task is silent until F-1.
  - Open phase-2 items: LDRI-55, AOQSD-36, AOQSD-29, p4-03-pycore, and the p4-04 remainder.
- Checks:
  - EOL: no churn against 74e7770 or f4f223414. capability_sync and memory_gate are fully CRLF; the rest are LF.
  - py_compile and ast pass on 9 files.
  - Scratch probe `d7p2_probe.py` (no route registration, no data-dir writes). Free RAM was 5.9 GB.
- Decisions (recommended option):
  - The items came from merge_meta deferred, d7/phase2_items.json and §8.0/§8.3, because items_pycore.json has no D7P2 entry.
  - B2 is fixed in pycore (terminal classification) rather than waiting for LDRI-11.
  - B4 is blocking because centralized constants is a code-leader rule.
- For the orchestrator (not caused by this review): `D:\www\core_node\data\audio_orchestration\tasks` has 19 task files rewritten at 20:05:06 and a 0-byte `orch_10dbeb70ad15.json.partial.0b82515e…` from 20:04:15. This looks like another session's check that resumed orchestration and was killed mid-write. My only probe ran about 20:09 and registered no routes. The partial file was not deleted, because deleting it is destructive.
- Changed files (this task): the verdict file and this report only.
- Blockers: B1-B4. Next owner: pycore-ai (extra assignment plus G1), then pycore-lead for the re-review.

## Review laravel-api-D7 (partial, pre-outage lane, successor pycore-laravel)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/laravel-api-D7.json`.
- Scope: MDSR-01, MDSR-03, MDSR-09, MDSR-12, MDSR-17 and MDSR-26-php, in `app/Services/DataSync/*`, `DataSyncController.php` and `CommonApiInfo.php`.
  - merge_meta has no laravel-api-D7 entry, so the scope comes from git f4f223414..HEAD and reports/laravel.md:282.
  - The lane changes are committed in the user's win0.0.1 commits.
- Confirmed in-process:
  - All six items pass their stated checks, except MDSR-09's "a terminal save deletes it" on Windows (see B1).
  - Contract readers match the contract.
  - normalizeAddress gives :9000 for bare hosts (IPv4 and IPv6) and :443 for https.
  - The index returns terminal_retention 5.
  - Each driver end path sends exactly one token-authenticated peer cancel.
  - An active local driver blocks both passive roles.
  - 50,000 export paths leave a 2,778-byte session JSON.
  - The 7z manifest check lands the good files and skips and reports the tampered, unplanned and missing files, and a replay gives the same result.
- Blocking:
  - B1: `app/Utils/FileSystemManager.php:602-636`. `delete()` is sudo-only and a no-op on Windows (probe-confirmed).
  - On the D8 Windows node this breaks:
    - DataSync forgetSession, so MDSR-09's stated check fails;
    - pruneTerminal, so retention 5 is not enforced;
    - completeArchive staging and part cleanup.
  - Fix: a native Windows branch in `delete()` (pycore-laravel scope). It touches no G3 file.
- Non-blocking (inputs for G3):
  - The MDSR-17 manifest is omitted above ARCHIVE_MAX_FILES (`DataSyncDriverService.php:898`), so the check is skipped for roots with more than 100k changed files. Fix: split the 7z items.
  - Upgrade-window guard for legacy pending_archives (`DataSyncPassiveService.php:469-470`).
  - Variables-at-top nits.
  - `FileSystemManager::rename()` has the same sudo pattern.
- Not started, stays in G3: MDSR-18, MDSR-24, MDSR-07, AHSC-35-relay, CKA-27.
- Checks:
  - EOL: the lane files are fully CRLF at the base and now; no churn.
  - php -l is clean.
  - Free RAM was 5.83 GB. Scratch scripts: `scratchpad/d7rev/{probe,check,check2}.php`.
  - Http::fake with TEST-NET peers.
  - The 4 real sync sessions are unchanged, and no scratch file is left behind.
  - The local FrankenPHP was untouched.
- Decisions (recommended option):
  - The review uses changes_requested rather than approve-with-notes, because a stated verification fails locally and the cause breaks the Windows/Linux compatibility rule. A blocking entry is the only way the fix becomes an assignment.
  - The MDSR-17 size gap stays non-blocking: it is not a regression, verifyResources still fails the session, and the largest local root has 40k files.
- Changed files (this task): the verdict file and this report only.
- Blockers: B1. Next owner: pycore-laravel (extra assignment; it can run in parallel with G3), then pycore-lead for the re-review.

## laravel-api-D7-fix (leader dispatch; item laravel-api-D7-B1)

- Status: deferred to the owner. Dispatched to pycore-laravel as task `[pycore-laravel] laravel-api-D7-fix`, with the patch below already validated.
- Why deferred: `poly_apps/laravel_main/app/Utils/` is pycore-laravel's scope (path map; B1 one writer per path). The task says "write scope only", and pycore-lead has no temporary-writer clause.
- Changed files (this task): this report only. No repo code was touched.
- Scratch prototypes (not repo): `scratchpad/d7fix/{native_delete_proto,native_delete_proto2,link_probe,junction_trace}.php`. Each one cleans up its own sandbox.
- Finding (binding for the fix): the item's `is_dir && !is_link` guard is unsafe on Windows.
  - PHP 8.5 reports `is_link() = false` for a junction. `is_dir()` on a junction is inconsistent: false in link_probe, true in junction_trace and proto2.
  - With that guard, the first prototype walked through a top-level junction and deleted the target's file (`outside_intact_after_top_junction: false`).
  - The lstat view is stable: `filetype()` gives `dir` only for a real directory, `unknown` for a junction and `link` for a symlink.
  - `RecursiveDirectoryIterator` (no FOLLOW_SYMLINKS) never descends into junctions or symlinks; they come back as leaves.
- Patch for pycore-laravel (`FileSystemManager.php`; the file is LF, keep LF; no comments needed):
  - In `delete()`, right after the `!file_exists` early return (:606-608), add `if (\App\Providers\PathMapper::isWindows()) { return self::deleteNative($mappedPath); }`. This skips the sudo user lookup and `fixPermissions` (chown/chgrp) on Windows. The POSIX path stays unchanged.
  - `private static function deleteNative(string $path): bool`:
    - `$iterator = null;` at the top;
    - if `@filetype($path) === 'dir'`, walk `new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST)` and call `self::removeNativeEntry($entry->getPathname())` on each entry. Wrap the walk in `try/catch (\UnexpectedValueException)` so the method keeps its bool contract;
    - then `self::removeNativeEntry($path); return !file_exists($path);`.
  - `private static function removeNativeEntry(string $path): void`:
    - `if (@unlink($path) || @rmdir($path)) { return; }`, then `@chmod($path, 0666); @unlink($path);`;
    - unlink removes files and file links; rmdir removes emptied directories, directory symlinks and junctions without touching their targets; the chmod retry clears the Windows read-only attribute.
- Verification of the prototype (in-process on scratch paths; identical output from CLI PHP 8.5.2 twice and FrankenPHP 1.12.7 `php-cli`, the D8 runtime):
  - `{"file":true,"readonly_file":true,"top_junction_created":true,"top_junction_is_dir_reported":true,"top_junction_removed":true,"top_junction_target_intact":true,"top_dir_symlink_removed":true,"top_dir_symlink_target_intact":true,"top_file_symlink_removed":true,"top_file_symlink_target_intact":true,"nested_junction_created":true,"nested_dir_symlink_created":true,"nested_file_symlink_created":true,"nested_removed":true,"nested_targets_intact":true,"missing_path":true,"work_empty":true,"cleanup_done":true}`
  - Free RAM was 3.09 GB, and only the scratch PHP scripts ran. The local FrankenPHP server was not touched.
- Member verification (pycore-laravel):
  - the stated checks: `php -l`; scratch file and nested directory; a terminal save of a scratch session removes its artifacts and incoming directories; `pruneTerminal` removes a scratch session beyond retention;
  - plus: the prototype's junction and dir-symlink cases through `FileSystemManager::delete` (targets intact), and a completeArchive staging and `.7z.part` cleanup, if it can be reached with a scratch session;
  - prune safety: back-date the scratch sessions' `updated_at` so that every pruned id is a scratch one; the 4 real terminal sessions must stay unchanged;
  - after the edit: `curl -X POST http://localhost:2019/frankenphp/workers/restart`, then health 200.
- Blast radius (for the re-review): 45 `FileSystemManager::delete(` calls in 17 files, plus `writeFileAtomic` staging cleanup (:408). All of them were silent no-ops on Windows and now delete, as they already do on Linux. The lstat guard keeps a delete from going through a junction or link. The user-facing path is `CodeBrowserFileOpsController` (Linux parity; its existing path guard applies).
- Cross-scope and non-blocking (pycore-laravel, optional in the same pass): `FileSystemManager::rename()` (:527-600) is also sudo-only (`cp` + `rm`) with no Windows branch. Nothing in DataSync depends on it, since DataSync uses `moveFile` (:512, native).
- Decisions (recommended option):
  - Dispatch to the owner instead of a leader edit, per the binding §8 boundary and the task's "write scope only".
  - Use the lstat-based `filetype() === 'dir'` guard instead of the item's `is_dir && !is_link`, because the prototype proved the latter deletes a junction target's contents.
  - Use one unified `unlink || rmdir` for each entry instead of type branching, because `is_dir` is unreliable for junctions.
- Next owner: pycore-laravel (implements the patch and runs the member verification). Then pycore-lead re-reviews and writes `.claude/agents_shared/reviews/laravel-api-D7-fix.json`, and updates the B1 entry of `laravel-api-D7.json`.

## Review pycore-runtime-D7P2-fix round 1 (dispatched to member pycore-ui)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/pycore-runtime-D7P2-fix.json`.
- Result under review: pycore-ui deferred all six items (B1-B6) as out of scope, and changed only `reports/pycore-ui.md`.
- The member acted correctly. The B1-B6 paths belong to pycore-runtime, and F-1 (for B4) belongs to pycore-lead. Nothing in the record assigns them to pycore-ui, so the misroute was the dispatcher's.
- The task is not done: every defect is still present at HEAD 4ddb4be8e (the user commit at 20:24, which touches none of those files). Approving would close the task with B1-B6 open.
- Non-blocking notes on the member's report:
  - The working copy of `reports/pycore-ui.md` is CRLF, but every other report and review is LF (the index is LF through autocrlf).
  - Two line references drifted: `serialized_worker.py:42-43` and `OrchManifestPanel.tsx:105`.
  - UI backlog: `OrchManifestPanel.tsx:105` reads `error`, but the route returns `error_code`.
- B2 scope note: `orch_promote.py:60-64` passes `task` in-process on purpose. Only the RPC item building changes.
- Checks: read-only (git log/diff/status, grep/sed, Python EOL byte counts). No code changed, so there was nothing to build or test.
- Decisions (recommended option):
  - changes_requested rather than approved, because an approved verdict completes the task.
  - F-1 is not done inside this review. It is my own foundation work, which the reviewer service verifies, and it lands before the B4 docstring rewrite.
- Changed files (this task): the verdict file and this report only.
- Blockers: B1-B6. Next owners: pycore-lead for F-1, and pycore-runtime for B1, B2, B3, B5, B6 and the B4 docstring (round 2 of pycore-runtime-D7P2-fix). Then pycore-lead re-reviews.

## Review pycore-runtime-D7P2-fix round 2 (dispatched to member pycore-ui again)

- Verdict: changes_requested (round 2). File: `.claude/agents_shared/reviews/pycore-runtime-D7P2-fix.json`.
- Result under review: pycore-ui deferred B1-B6 again and changed only `reports/pycore-ui.md` (committed in the user commit 2f31f9cd3, 20:31).
- The member acted correctly. The round-1 notes are fixed: the report is LF (crlf=0, lf=54, no BOM, HEAD blob identical), and every line reference in it is exact.
- The task is still not done. At HEAD 2f31f9cd3 all six defects are present, and the six code files are unchanged since 4ddb4be8e. `reports/pycore-runtime.md` has no D7P2 section; its uncommitted edit belongs to pycore-assist-D7-fix. F-1 is not started.
- Note for pycore-ai: after the 2f31f9cd3 change, the hand-built fallback in `audio_queue_center.py` is at `:146`, not `:140`. The other one is at `audio_resource_ledger.py:42`. pycore-ai adopts the helpers after B1.
- Escalation (orchestrator): round 2 went to pycore-ui even though the round-1 verdict routed the work to the owners. A third round on pycore-ui cannot converge. Re-dispatch the task with role pycore-runtime (B1, B2, B3, B5, B6 and the B4 docstring), and give F-1 to pycore-lead as its own task, verified by the reviewer service.
- Checks: read-only (git log/diff/status, grep/sed, Python byte counts, JSON parse of the verdict). Nothing was built or tested, and no git writes were made.
- Changed files (this task): the verdict file and this report only.
- Blockers: B1-B6. Next owners: the orchestrator (re-dispatch), pycore-lead (F-1), pycore-runtime (B1-B6).

## Review pycore-runtime-D7P2-fix round 3 (dispatched to member pycore-ui a third time)

- Verdict: changes_requested (round 3). File: `.claude/agents_shared/reviews/pycore-runtime-D7P2-fix.json`.
- Result under review: pycore-ui deferred B1-B6 again and changed only `reports/pycore-ui.md` (uncommitted, 20:43, LF, no BOM).
- The member acted correctly, and the round-2 wording note is fixed. Every line reference in the report is exact.
- The task is still not done. HEAD is still 2f31f9cd3, the six code files are unchanged (mtimes 15:50-17:17), all six defects are present, F-1 has not started, and `reports/pycore-runtime.md` has no D7P2 section.
- The orchestrator has now recorded the re-route: the `client_key_auth/TASKS.md` row "reroute-pending" (20:42) runs `[pycore-runtime] pycore-runtime-D7P2-fix` after the current loop ends. The verdict points to it. A fourth round on pycore-ui would get the same verdict.
- Checks: read-only (git log/diff/status, grep/sed, Python byte counts), plus py_compile on the six code files as a sanity check. Nothing was built or tested, and no git writes were made.
- Changed files (this task): the verdict file and this report only.
- Blockers: B1-B6. Next owners: the orchestrator (end the pycore-ui loop, run the re-route), pycore-lead (F-1, verified by the reviewer service), pycore-runtime (B1, B2, B3, B5, the B4 docstring, then B6), then pycore-ai (adopt the B1 helpers).

## Review pycore-assist-D7-fix (round 1, member pycore-runtime)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/pycore-assist-D7-fix.json`. Base 74e7770; the changes are on HEAD 2f31f9cd3.
- B1 (M-1) is accepted. `prompt_archive.py:44` ARCHIVE_ROOT_ONLY_FIELD is exported, consumed at :87, and never persisted. The caller at `agent_history_service.py:415` is unchanged. The AST module-attribute check finds 0 problems in 353 references. The negative control on the base file flags only :415.
- B2 (AHSC-28) is functionally correct. There is no 0o666, the modes come from root_spool, restriction applies only to root-only batches and never widens, the nt check is a condition, and chmod failures are logged. The store is 0750/0640.
- Blocking: `prompt_archive.py:121-128` copies the `agent_history_txt.py:45-54` `_restrict_mode` helper that the same change adds. Make it one public helper and call it from both files.
- Checks: static only. Free RAM was 1.45 GB, below 3 GB, so the WSL and Windows functional runs were not repeated. compile OK, grep clean, the EOL gate is clean (txt CRLF, archive LF), and the added lines are ASCII.
- Cross-scope, for shell-linux via the orchestrator (informational): `scan_shared_cache.sh:169-170` `chmod -R a+rX` re-widens the store.
- Changed files (this task): the verdict file and this report only.
- Blockers: issues[0]. Next owner: pycore-runtime (round 2).
