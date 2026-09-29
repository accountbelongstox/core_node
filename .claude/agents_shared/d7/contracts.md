# D7 contract changes (orchestrator, 2026-09-27)

Writer: orchestrator (scope `config/*_contract.json`). Reviewers diff against 74e7770. All three files parse as JSON and keep LF endings. No key with a live reader was removed.

| File | Key | Value | Reason | Readers (consumer task) |
|---|---|---|---|---|
| service_contract.json | `paths.windows_data_drive_root`, `www_dir_name`, `linux_www_root`, `linux_ntfs_nested_www_root`, `legacy_linux_data_dir`, `home_data_dir_fallback` | `D:/`, `www`, `/www`, `/www/www`, `/var/_core_node`, `~/core_node` | CKA-03 | pycore-architect CKA-04, ncore CKA-05, shell-linux CKA-06, shell-windows CKA-07, laravel CKA-08 (PathMapper), ui-laravel-manager CKA-09 (vite.config.ts) |
| service_contract.json | `paths.ntfs_fs_types` | `[ntfs, ntfs3, fuseblk, ntfs-3g]` | CKA-03 (PathMapper::NTFS_FILE_SYSTEMS, core_node_dirs.NTFS_FSTYPES) | same as above |
| service_contract.json | `paths.linux_www_ntfs_root_rule` | the rule text from wwwNtfsRootMounted / www_data_root_mounted | CKA-03: names the `when` condition used below | same as above |
| service_contract.json | `paths.linux_data_dir_candidates` | ordered `{path, join?, when?}`: nested www root + core_node when the rule holds; www root + core_node otherwise; legacy_linux_data_dir; home_data_dir_fallback | CKA-03 | same as above |
| service_contract.json | `paths.linux_data_dir_selection` | CORE_NODE_DATA_DIR wins, then the first writable candidate, with home as the last resort | CKA-03 | same as above |
| service_contract.json | `data_sync` | protocol_version 5, active [queued, running, paused], terminal [completed, failed, cancelled], driver [source, fetcher], passive [receiver, exporter], writer [receiver, fetcher], terminal_retention 5, default_port_ref `ports.laravel_api_backend` | MDSR-26, MDSR-12 | laravel-api (DataSyncProtocol.php: MDSR-26-php, MDSR-12), ui-laravel-manager (DataSyncModel.ts, DataSyncTab.tsx, DatabaseManagerAPI.ts: MDSR-26-ts, MDSR-11) |
| queue_center_contract.json | `schema_version` | 38 -> 39 | the file's convention of one bump per change; no reader enforces equality | informational (overview payload, TS/pycore constants) |
| queue_center_contract.json | `word_identity.fallback_when_md5_absent` | key_format `<lang>:text:<cleaned_word>`, resolver laravel, rule, `rejection_code` WORD_NOT_FOUND, applies_to [word_audio_upload, delivery_word_key, dict_lanes_batched] | X4, LDRI-13 + CKA-24 merged | laravel-qyapp LDRI-11 now; pycore-ai LDRI-12 in phase 2 |
| queue_center_contract.json | `delivery` (new) | routes info/diff/batch/batch_content/batch_status (`{batch_id}` token); server_identity {header X-Core-Node-Server-Id, body_field server_id}; diff_item_limits per kind + default 5000; diff_reasons; batch_kinds; batch_limits {items 500, min_item_bytes 100, item_bytes 2097152, total_bytes 33554432}; batch_states; batch_item_statuses; batch_stored_statuses; batch_terminal_rejections; error_codes (7 DELIVERY_*); retention_seconds 86400 | LDRI-35 (B4); values copied from AppQyV1DeliveryDiffService/BatchService/Ctl, ServerIdentityHeader.php:13, identity.py:9-12, delivery_diff.py:36-55 | laravel (App\Support reader, ServerIdentityHeader), laravel-qyapp (DeliveryDiff/Batch services, Ctl); pycore-runtime in phase 2 (identity.py, delivery_diff.py) |
| queue_center_contract.json | `library_cover.max_ids` | 200 | MCHR-22 | laravel-qyapp (AppQyV1LibraryCoverTaskService::MAX_IDS), ui-pycore-manager as B2 writer (AppQyV1AiToolsContract.ts:28) |
| queue_center_contract.json | `endpoints.audio_word_listing`, `audio_word_language_breakdown`, `audio_sentence_without_audio` | `/api/app_qy_v1/dictionary/words`, `/api/app_qy_v1/vocabulary/language-breakdown`, `/api/app_qy_v1/ai_tools/tts/sentence/without_audio` (routes checked in AppQyV1Vocabulary.php and AppQyV1AITools.php) | RV-010 path half (p4-03) | pycore word/sentence_audio_full_sync.py in phase 2 |
| pycore_relay_contract.json | `route_policies` + 3 exact entries | `ui/queue_center/audio_lane_state`, `ui/agent_history/prompt_rewritten`, `ui/audio_orch/task/manifest_page`: general_read, [POST] | RV-009, PRAO-23 (K7a). All three routes exist in route_names.py | pycore relay (relay_contract.py), laravel-api (RelayContract.php) |
| pycore_relay_contract.json | `events.agent_history_config_changed` + `event_payload_profiles.agent_history_config_changed` | `agent_history.config.changed`; [pairing_id, device_id, revision, metadata] | AHSC-35 (K7a). relay_contract.py needs a payload profile for every event, so both were added | pycore-runtime (then add to RELAY_REQUIRED_EVENTS), laravel-api (RelayContract.php $requiredEvents), ui-pycore-manager (RelayContract.ts) |

## Not applied

- `task_contract.stream_events` deletion (RV-004) was not applied because a live reader still exists: `poly_apps/pycore_laravel_wordnew_ui/core/contracts/QueueCenterContract.ts:132` (type) and `:283` (`GLOBAL_TASK_STREAM_EVENTS_BY_ROLE`). Apply it after ui-pycore-manager p4-02 removes both lines and a grep for `stream_events` in the TS/PHP/Python/mcp-chrome readers comes back empty.

## Decisions (recommended option taken)

- `linux_data_dir_candidates` names sibling `paths` keys instead of repeating literals, so each literal is declared once. `sc_get paths.linux_data_dir_candidates.0.path` works in the shell adapter.
- The fallback rejection reuses the existing `ErrorCodes::WORD_NOT_FOUND`. Inside a delivery batch the item status is `no_target`, the same as today.
- The delivery key keeps the requested name `retention_seconds`. It is the Laravel staged-batch retention (AppQyV1DeliveryBatchService::RETENTION_SECONDS), not pycore's 7-day receipt retention, which is X8 and in flight.
- Deployment: the relay contract digest (LF-normalized sha256) is compared between pycore and Laravel (`contract_digest_conflict`). Pycore and the Laravel server must ship this file together.
