# Pending User Actions

Scope: cross-cutting actions that need the user: the live deployment checklist, files awaiting deletion approval, and open user decisions. Topic open items stay in their `DESIGN_*.md`.

Authority: code > config/*_contract.json > this document.

## 1. Deployment checklist

Run together: the relay contract digest and the lease/gap schema changed, so Laravel, the repo-root contracts and every pycore must move as one.

1. Push `poly_apps/laravel_main` and the repo-root `config/*.json` (`queue_center_contract.json`, `pycore_relay_contract.json`, `pycore_rpc_contract.json`, `service_contract.json`) through `gitsync`.
2. On the Laravel server: `git pull`.
3. `php artisan sys:init`. It applies the pending migrations and self-heals:
   - `database/migrations/AppQyV1_2026_10_02_000001_add_media_gap_partial_indexes.php` (media gap and lease indexes);
   - `database/migrations/AppQyV1_2026_10_02_000002_ensure_hot_path_gap_lease_indexes.php` (word and sentence gap, failed-free lease claim, lease expiry and failed indexes for every language, each index once its columns exist (the sys:init alignment builds the rest); built `CONCURRENTLY` outside a transaction, so writes continue; a rerun repairs an interrupted build);
   - `database/migrations/global_Relay_2026_10_01_000001_create_relay_ledger_table.php` (`global_relay_ledger`).
4. Restart the FrankenPHP/Octane workers: systemd unit `ncore-laravel-frankenphp` (contracts are cached per worker); `php artisan optimize:clear` when config/route caches are used.
5. Run step 175 once on the server (book seed).
6. Restart the Windows pycore after its tree is synced (it must run the current `task_puller`).
7. Keep `CORE_NODE_CLIENT_KEY_1` identical on Laravel, every pycore, ncore, the mcp-chrome native host and wordnew.
8. Post-deploy checks: `php artisan route:list --path=relay`; Redis connection `relay` (db 3) reachable; the `mercure_hub` public URL shares the origin that `laravel_endpoint_manager.resolve()` returns; `taskTypeExecution("tts_synthesize")` returns `remote_compute`; redeploy every device and UI build.

Host actions (see `DESIGN_SHELL_HOSTS.md` Open items):
- Every Linux host: rerun `175 --domains-only`.
- debian-gpu: pull, rerun 175/Step175, run Windows Step2, then set `WINDOWS_RTC_UTC=1`.
- After an NVIDIA driver upgrade: reboot, then rerun `183_install_qwen3tts` and the other GPU engine installers.
- Restart pyservice on hosts whose agent-history root spool still runs old code (`DESIGN_AGENT_HISTORY.md` Open items).

## 2. Files pending deletion (user approval required)

Each entry exists and has no live importer outside its own group (checked 2026-10-02).

Shell / tools:
- `scripts/shells/win/install_powershells/Step48_InstallDesktopManager.ps1` (only forwards to Step69).
- `scripts/pytools/ai_tools/auto_add_mcp_linux.py`.
- `scripts/pytools/media_compressor/json_store.py` (the compressor uses `SplitFileStore`).

Laravel:
- `app/Services/QueueCenter/DictLane/DictLaneTableProbe.php`.
- `app/Services/TimerTasks/DiffQueueFeederTaskAbstract.php`, `app/Services/TimerTasks/QueueFeederTaskAbstract.php` (no subclass or caller).

pycore RPC / codesync:
- `pycore/pyutils/codesync/legacy_json.py`.
- `pycore/pyutils/common/rpc_route_contract.py` (the live one is `pyfoundations/rpc_route_contract.py`).
- `pycore/callmodule/rpc_routes/local_queue_bumps_routes.py` (unregistered).
- `pycore/callmodule/rpc_routes/machine_receive_routes.py` + `pycore/pyctl/desktop/machine_receive_service.py` (delete together; `machine_send_*` covers them).
- `pycore/pyctl/relay/fabric/` (only `__pycache__`).
- `pycore/pyctl/runtime/global_config.py`.

pycore shell-install rule (Python never downloads):
- `pycore/pyutils/ensure_library/ffmpeg_installer.py`, `pycore/pyutils/common/robust_downloader.py`, `pyapps/matrix/matrix_config/scrcpy_server_downloader.py`, `pyapps/matrix/services/adb_manager.py`.

pycore UI/tool domains (`pycore/pyutils/` unless noted; importers only inside this list):
- `desktop/**` (moved to `native_ui/step11_desktop`, `window/tk_taskbar`, `pyfoundations/shortcut_manager`).
- native_ui: `step1_config/config.py`, `step4_startup/startup_window.py`, `step5_main_ui/tkinter/{styled_widgets,theme_system}.py`, `step7_managers/{file_monitor,shutdown_manager}.py`, `step8_utils/{resize_handles,image_converter,embedded_images}.py`, `step9_frontend/port_killer.py`, `step0_i18n/translations/translations_en_bak.json`, `重构.txt`, `_prompts/`, `_analysis/`.
- translator: `romanization.py`, `phonetic.py`, `__main__.py`.
- window: `unified_detector.py`, `integrated_analyzer.py`, `ui_analyzer.py`.
- image_tools: `icon_analyzer.py`, `image_enhancer.py`, `png_matcher.py`, `image_processor.py`, `image_split.py`, `image_transform.py`, `dataset_generator.py`, `image_comparator.py`, plus `pyapps/d3-check/providor/common_imports.py`.
- `ensure_library/{quick_test_ffmpeg,verify_pyside6_fix}.py`, `device/adb_exceptions.py`, `control/coordinate_mapper.py`, `clipboard/clipboard_sync.py`, `external_apis/movie_poster_client.py`, `hotkey/hotkey_listener.py`, `frontend_launcher/universal_launcher.py`, `voc_annotator/annotation_io.py`, `voc_annotator/backup_before_tk/`, `nodejs_bridge/`.
- `pycore/pyctl/desktop/video_processor.py`, `pycore/pyctl/mcpctl/**` (imports the missing `pyapps.mcp`), `pycore/pyctl/pybrowserauto/**`.
- `pyapps/d3-check/utils/_obsolete_*.py` (`_obsolete_diablo_button_clicker.py` does not parse).

UI (`poly_apps/pycore_laravel_wordnew_ui`, details in `DESIGN_UI.md` Open items):
- `apps/pdd-manager` (and its entry in the `StandaloneApp.tsx` glob).
- wordnew dumps `apps/wordnew/_niv*.json`, `_ref.json`; the wordnew mock API layer (`api/WfNewApiMock*.ts`, `api/methods/mock*.ts`, `WORDNEW_MOCK_*` keys, `social.ts` `MOCK_*` returns); unused `platform/capabilities` modules; capacitor web shims; `apps/wordnew/components/WfNewToast.tsx`.
- pycore-manager: `PcOperationContext`, `LlmStatusRuntimeStore` and unused PycoreCache queue functions, unused `PcLiveContext` exports, `pages/PcCodeSyncPage.tsx`, `api/CodeSyncRuntimeStore.ts` (+ export in `api/index.ts`), `PycoreApi.getCodeSyncRuntime`.

Data files (no code reads them):
- Old prompt caches, imported once into the SQLite prompt store: `/var/_core_node/cache/pycore/.ai_state/agent_history/{prompt_new_cache/,prompt_derived_cache.json,prompt_rewrite_cache.json,prompt_archive/}` (same paths on other hosts).
- Stale SQLite: `/www/core_node/config/audio_delivery_outbox.sqlite3`, `/var/_core_node/config/audio_delivery_outbox.sqlite3`, `/var/_core_node/data/terminal_windows/state.sqlite3`.

## 3. Open user decisions

- Owners for `ncore` (the Node runtime) and `poly_apps/flutter_bloom`. Flutter (`flutter_bloom`, pycore `pyutils/flutter_dev_tools`, `pyctl/flutter_dev_tools`) stays frozen until then; its dead files (`flutter_dev_tools/config/routes_config.py`, the last `SerializedSingletonProvider` user; `utils/update_to_english.py`; `design_structure_auto_expand`, whose root resolves to `pycore/` and whose fix would enable a destructive `cleanup_deprecated_files()`) are decided with it.
- Larger lease prefetch while Laravel is unstable: raise `work_leases.prefetch_fraction` (0.25) / batch toward `batch_max` (500) in `config/queue_center_contract.json` so nodes ride out Laravel outages, at the cost of longer-held leases.
- Team launcher `ServerAliveCountMax`: code and contract use 3 (`service_contract.json` `ssh_client.server_alive_count_max`, read by `claude_team_common.sh` and `ClaudeTeamCommon.ps1`); confirm 3 and correct the shell parity ledgers (`.claude/agents_shared/shell_parity/linux.md` SPL-134, `windows.md` SPW-054) that still say 4.
- Relay owner routes accept a client-key signature (shared fleet owner) or any logged-in user (`client.key_or_dashboard:user`), and the loopback debug bypass binds a debug user (`DESIGN_RELAY.md` §2): keep, or tighten to admin level / refuse the bypass.
- qwen3tts 0.6B variant for bulk sentence audio (8 GB / 24-SM GPU: batch 4 vs 2 for 1.7B).
- Azure TTS without the SDK: align status ("not installed") with the on-request "package missing" code.
- `AppQyV1BackfillGlobalTasks` writes unclaimable `word_audio` GlobalTask rows: retire it or make it write history rows only; drop the stale `idx_sent_<lang>_gap_audio_id` / `_gap_audio_live_id` indexes and, once `<prefix>_gap_audio_free_lease` exists, the superseded word and sentence `<prefix>_gap_audio_lease` indexes.
- The SQLAlchemy layer under `pycore/database` and okx `lib/models.py` + `foundation/database_handler.py`, deleted without explicit approval in `e3cf19e10`: keep deleted (DB audit: safe) or restore from `e3cf19e10^`.
