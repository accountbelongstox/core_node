# reviewer report — client key auth and audit fixes (2026-09-27)

## Baseline
- Test vectors (`.claude/agents_shared/client_key_auth/test_vectors.json`) are self-consistent: key_id, canonical strings, body digests and all 3 HMAC signatures reproduce in a scratchpad check.
- Git baseline at review start: only `config/service_contract.json`, `config/claude_team_roles.json`, the docs_fix records and `.claude/` shared files differ from HEAD. Every code change after this is team work.
- Existing shared helpers the signers/verifiers must reuse: canonicalization `pycore/pyutils/common/relay_contract.py` (`canonical_path`, `canonical_query`), Laravel `RelayContract::canonicalPath/canonicalRawQuery`; secret store readers `pycore/pyfoundations/secret_manager.py`, `poly_apps/laravel_main/app/Utils/SecretStore.php`, `ncore/foundation/common/secret_manager.js`.

## Verdicts issued
| Task | Role | Findings | Verdict | Notes |
|---|---|---|---|---|
| vortex-1 | vortex | FU-033 fixed | approved | non-blocking: HistoricTrade.time writers still zh-CN strings → vortex-3 |
| vortex-2 | vortex | FU-038 fixed | approved | |
| codemart-1 | codemart | FU-010, FU-013, FU-014 fixed | approved | |
| codemart-2 | codemart | FU-015 fixed | approved | non-blocking: account switch with failed load keeps old bootstrap |
| codemart-3 | codemart | FU-017, FU-022 fixed | approved | |
| laravel-manager-1 | laravel-manager | FU-003, FU-002 fixed | approved | non-blocking: RequestCoordinator stores ttl-0 values (B2, sent to orchestrator) |
| laravel-manager-2 | laravel-manager | FU-030 (client), FU-039 fixed | approved | server restore lock → laravel |
| laravel-manager-3 | laravel-manager | FU-005, FU-006, FU-012 fixed | approved | |
| laravel-manager-4 | laravel-manager | FU-016, FU-035 fixed | approved | |
| codemart-5 | codemart | FU-026 (codemart part) fixed | approved | non-blocking: api/index.ts CRLF→LF; no-currency public amounts now whole units |
| vortex-4 | vortex | reveal_credentials (UI side) fixed | approved | vortex-3 waits for the vx namespace in shell-i18n; pycore to confirm the server route is gone |
| wordnew-2 | wordnew | FU-008, FU-009, FU-023 fixed | approved | |
| wordnew-3 | wordnew | FU-019, FU-032, FU-042 (wordnew) fixed | approved | FU-031 edits in the same files → wordnew-1 |
| laravel-T1 | laravel | LB-001, LB-002, LB-003, LB-005, LB-006, LB-007, LB-015, LB-028, LB-032, RV-003 fixed | approved | vectors reproduced with the PHP verifier; non-blocking: bare CORE_NODE_CLIENT_KEY accepted, getPathInfo root assumption, LB-007 sync regenerate |
| shell-1 | shell | K2, IS-008, IS-010 fixed | approved (on resubmit) | Step5 now uses the stdin runner |
| vortex-3 | vortex | FU-042 (vortex) fixed | approved | |
| codemart-6 | codemart | reuse of BaseAPI transport | approved | |
| shell-2 | shell | IS-001, IS-002, IS-003, IS-004, IS-012 fixed | approved (on resubmit) | dropcluster only at exactly 0 user DBs; follow-up: password mirror 0644 |
| flutter-1 | flutter | — | no verdict | user directive: won't fix, dropped |
| laravel-T2 | laravel | LB-004, LB-008, LB-009, LB-019 (partial), LB-020, LB-024, LB-025 fixed | approved (on resubmit) | DingDuoDuo admin group now dashboard.auth admin |
| laravel-T3 | laravel | LB-010, LB-016, LB-017, LB-018, LB-021, LB-022, LB-023 fixed | approved | timer tick now carries heavy work (LB-012 in T4) |
| wordnew-1 | wordnew | FU-031 fixed | approved (on resubmit) | duplicate Idempotency-Key constant removed |
| mcp-chrome-2 | mcp-chrome | FU-001 fixed | approved | on ncore local_rpc_guard, extension origins only |
| pycore-manager-1 | pycore-manager | FU-004, FU-018, FU-024 (pc), FU-025 (named parts) fixed | approved | FU-025 sweep remainder: 11 files (recorded) |
| pycore-manager-2 | pycore-manager | FU-011, FU-036, FU-037, FU-040 fixed | approved | |
| pycore-manager-3 | pycore-manager | FU-026 (pc) fixed | approved | |
| pycore-manager-4 | pycore-manager | FU-020, FU-027 fixed | approved | FU-027 together with the laravel-manager BaseAPI setSharedBaseURL hunk |
| mcp-chrome-3 | mcp-chrome | FU-007, FU-021, FU-034, FU-041 fixed | approved | |
| mcp-chrome-4 | mcp-chrome | FU-042 (ext) fixed, worker names refuted_ok; RV-004 (ext) fixed | approved | |
| laravel-manager-5 | laravel-manager | FU-024 (lm), FU-042 (lm) fixed | approved | LmBaseAPI and related → laravel-manager-6 |
| wordnew-4 | wordnew | route-table adaptation | approved | |
| wordnew-5 | wordnew | pre-existing runtime and tsc errors | approved | |
| ncore-1 | ncore | NC-001, NC-005, NC-007, NC-013, NC-020, NC-028, NC-038, NC-039 fixed | approved | vectors reproduced with ncore client_key_auth.js; ncore_backend_main.py duplicates the K7 decision (non-blocking) |
| ncore-2 | ncore | NC-002, NC-024, NC-033 fixed | approved | user must rotate the listed secrets; old ENC: global_var files remain on hosts |
| mcp-chrome-1 | mcp-chrome | K3/K6 host signing | approved | non-blocking: restrict the CLIENT_KEY_SIGN relay to extension pages |
| laravel-manager-6 | laravel-manager | route-table adaptation | approved | |
| laravel-manager-7 | laravel-manager | shared contract adapters | approved | data-root literals re-declared in vite.config (non-blocking) |
| laravel-manager-9 | laravel-manager | FU-027 (BaseAPI part) fixed | approved | |
| shell-3 | shell | IS-005, IS-006, IS-007, IS-009, IS-011, IS-013 fixed | approved (on resubmit) | ark generator uses the shared masking helpers |
| pycore-1 | pycore | K3, PR-014, PR-003 fixed | approved | vectors reproduced (stubbed copy); 35 files CRLF→LF churn to restore |
| pycore-2 | pycore | PR-001, PR-021, PR-030, PR-031, PR-037, AT-006, AT-029 fixed; okx reveal refuted_ok | approved | non-blocking: gate websocket scopes, cap non-loopback body |
| mcp-chrome-5 | mcp-chrome | extension ids from contract; sign-relay sender check | approved | mcp-chrome-1/-2 verdicts updated for the resubmission |
| laravel-T4 | laravel | LB-011..LB-014, LB-026, LB-027, LB-029..LB-031, RV-001, RV-002, RV-004, RV-007 (partial), RV-011 fixed; LB-033, X4 deferred (disputed) | approved | LB-033/X4 need rulings |
| laravel-T5 | laravel | FU-030 server lock + idempotency, toggle target, FU-031 dedupe | approved | cross-end: laravel-manager still posts {} to toggle-autostart (422 until laravel-manager-10) |
| laravel-manager-8 | laravel-manager | FU-025/FU-026 remainders + type/runtime fixes | approved | |
| ncore-3 | ncore | NC-003, NC-004, NC-012, NC-017, NC-018, NC-019, NC-029, NC-031, NC-032 fixed | approved | non-blocking: array commands still joined into shell strings |
| shell-4 | shell | IS-014..IS-021, IS-023..IS-030 fixed (IS-020 log move refuted_ok) | approved | |
| shell-5 | shell | PR-034 script half; requirements §2 follow-ups | approved | non-blocking: extend fs_perm_target_safety system-path list |
| pycore-3 | pycore | 23 PR fixed; PR-024, PR-027, PR-034 partial (deferrals recorded) | approved | non-blocking: user_data.json 0666 holds rpcLanBind; Windows shims in list commands |
| ncore-4 | ncore | NC-006, NC-009, NC-010, NC-014, NC-025, NC-027, NC-037 (HTTP) fixed | approved | |
| laravel-T6 | laravel | LB-034 fixed (audited set); remainder recorded (10 + 173 + 737) | approved | en/zh key parity verified |
| laravel-manager-10 | laravel-manager | adaptation to T5 (idempotency keys, setAutoStart {enabled}) | approved | closes the toggle-autostart cross-end mismatch |
| laravel-manager-11 | laravel-manager | type errors 36 → 0 (root causes) | approved | |
| laravel-manager-12 | laravel-manager | LaravelRealtime symbolic event names | approved | |
| codemart-7 | codemart | reuse BaseAPI.createIdempotencyKey | approved | |
| shell-6 | shell | IS-022 fixed (3 intentional sites) | approved | |
| shell-8 | shell | K7a pyservice loopback default | approved | |
| codemart-4 | codemart | UI side of LB-008/009/019/020/024/025; route table | approved | laravel-side CodeMart hunks (escrow refund endpoint, bootstrap flags) still unreviewed → laravel-T7 |
| ncore-5 | ncore | NC-008 (extension side), NC-011, NC-015, NC-016, NC-021, NC-022, NC-023, NC-026, NC-030, NC-037 fixed | approved | NC-008 laravel half + contract public key open |
| pycore-manager-5 | pycore-manager | K6/K7/K7a + route table | approved | origin mirror matches pycore allowed_origins |
| pycore-manager-6 | pycore-manager | FU-025/FU-026 remainder sweep | approved | |
| laravel-T7 | laravel | LB-008 admin refund, LB-019 optional phone, LB-020 policy, LB-035 recorded | approved | the CodeMart hunks codemart-4 consumes |
| laravel-T8 | laravel | verifier: indexed keys only, base-path-safe signed path | approved | |
| laravel-T9 | laravel | LB-033, RV-007, RV-004, LB-007 queued, X4 fields, T5 idempotency note | approved | |
| laravel-T10 | laravel | NC-008 Laravel half (DDK2 mint/verify, master codes retired) | approved | cross-end mint→extension verify checked in scratchpad |
| shell-7 | shell | IS-005 class sweep over all launchers; codex Windows child argv (IS-010 class) | approved | regenerated launchers include the pending provisioning section |
| pycore-manager-7 | pycore-manager | dead PNA exports, LaravelRequest 401/403, one shell key | approved | |
| shell-9 | shell | postgres password mirror reader-owned 0600; extended system-path guard | approved | closes the shell-2/shell-5 follow-ups |
| vortex-5 | vortex | shared classifyPycoreAccess + Vortex pycore notice | approved | non-blocking: select local_rpc codes by suffix |
| pycore-manager-8 | pycore-manager | PcRpcAccessBanner on classifyPycoreAccess | approved | |
| ncore-6 | ncore | NC-034/035/036/040/041 fixed; readRawSecret, execCmd argv, ncore_backend_main LocalRpcGuardMiddleware reuse | approved (resubmit) | example override nit fixed |
| ncore-7 | ncore | config/index.js SECRET: migration, NC-026/011 twins, NC-008 contract pickup, K7 alignment (DNS-rebinding fix) | approved (resubmit) | guard re-run over hostile Host/Origin/peer cases; mcp-chrome native server covered |
| vortex-5 (rev) | vortex | keyed local_rpc error-code lookup | approved | position-based note closed |
| laravel-T11 | laravel | D1 public/home 500: shared additive column reconcile + unnamed-index equivalence in SafeMigrationHelper | approved | local re-check: escrow columns numeric(15,2) NOT NULL default 0, in-process GET 200, rerun diff empty; 5 non-blocking notes; server steps pending laravel-remote |
| pycore-4 | pycore | AT-001..AT-050, X2/X6/X8, RV-001/002/006/008/009/010 | changes_requested | 53 fixed, 2 already fixed, AT-015 withdrawn, 3 valid deferrals; line-ending gate passes (0 flipped lines over 154 files); blockers below |
| pycore-4 (r2) | pycore | r1: AT-034 path, NVIDIA_SMI_TIMEOUT_SECONDS single source, AT-025/X6/AT-008/AT-014/AT-031/AT-039 notes | approved (round 2, 16:04) | both blockers fixed. Retained audio is named from uuid op/item ids; format allow-listed wav/mp3 at the RPC entry and in _run; resolved-parent guard. The constant lives only in network_constants. Reviewed against `74e7770`, because commit f4f2234 captured the tree. EOL gate re-run: 0 flipped lines over 163 entries. Non-blocking: memory_gate._gpu_query nvidia-smi has no timeout (report overclaims); a small re-submit race before start_item |
| shell-windows-2 | shell-windows | D12a desktop icon organizer (token matcher, undo manifest, menu entry, real run) | approved (round 2, 16:02) | both blockers fixed (UndoneAt only on 0 errors; Join-Path prefix); collision/newer-only rules and IconExtractor -LiteralPath also fixed. Re-verified read-only: one manifest (15:36:32), no displaced/undone dir, 78 shortcuts, desktops and category folders unchanged since the first run. Non-blocking: preview labels for multi-item groups. SPW-001..003 pending-linux, align task shell-linux-2 exists (TASKS.md:82) |
| shell-linux-2 | shell-linux | D12a Linux align: SPW-001 organizer, SPW-002 undo manifest, SPW-003 menu/CLI/154 hint; root runs act as each user | approved (round 1, 17:13) | The keyword table was re-diffed against Windows: 1084 pairs, identical. Collision, placement, preview, undo and idempotency rules traced and match Windows. bash -n passes, LF, ASCII. Ledger SPW-001..003 aligned; SPW-004/005 platform-only. Non-blocking: remove still uses root rm on filed paths (:553-568); root is detected by name, so a second uid-0 account recurses (:1429/:1470); a reformatted manifest parses to 0 entries and closes (:1324-1388); GNOME launch from category folders is unverified; the keyword table is duplicated across the platforms (centralize) |
| shell-windows-1 | shell-windows | D10/D11/D13 Windows launchers, team_gate.mjs, SPW-018..030 | changes_requested (round 1, 17:18) | Spec §1-§6 items are present. The parser reports 0 errors in 5 files, and node --check passes. Hand-recomputed layouts meet lead >= 100x30 and roles >= 60x15 at 1K/2K/4K, with every role placed once. 6 blockers, listed below. The owner's notice #4 (Linux PID name) is refuted. |
| shell-linux-1 | shell-linux | D10/D11/D13 Linux launchers, claude_team_install, SPL-101..112 | changes_requested (round 1, 17:19) | Spec §1-§6 items are present. bash -n passes on 6 files, all LF; shellcheck is not installed. Hand-recomputed packing: 213x52 gives 4 tabs, 227x57 gives 3, 284x72 gives 2. Lead >= 100x30 and roles >= 60x15 everywhere, every enabled role is placed once, and laravel-remote runs only as its ssh-loop pane. No settings/hooks/catalog/agents edits. 7 blockers, listed below. |
| pycore-ai-D7 | pycore-ai | PRAO-07 prompt_derive source defaults use the central ai_sources ids | approved (round 1) | inspect.signature re-run: the defaults equal AI_SOURCE_PROMPT_DERIVE and AI_SOURCE_PROMPT_REWRITE. py_compile passes, and numstat is 3/2 both plain and with EOL ignored (LF only). The literal-grep hits at :31/:45 are the CONFIG_KEY_* template keys, so they are kept correctly. Non-blocking: derive is not in OPENROUTER_ATTEMPT_SOURCES (R3; pycore-assist if the panel should list it); a sideways pyctl/ai to agent_history import (required by the item); out of scope, pyutils/common/queue_center_contract.py has working-tree EOL churn (47/15 plain against 40/8 with EOL ignored), which belongs to its owner. |

## Open blockers
- shell-windows-1 (owner shell-windows), round 1. Full notes are in `reviews/shell-windows-1.json`.
  - Re-checked at 17:27 against DESIGN §3.1/§3.2 (17:24). The code is unchanged, so the verdict is still changes_requested. §3.2 supersedes my pending-linux request for the one-lead rule: Linux aligns it in SPL-110, so no align task is needed. §3.1 makes blocker 5 binding: switch to max area, column fill and lead-top.
  1. The idle pane shell counts as running forever: `ClaudeTeamCommon.ps1:1541`, `claudeteam.ps1:161-170`, and the `--name` map, which includes the shells. SPW-023 is also mislabeled "aligned" for the idle respawn.
  2. Only one hardcoded `session_env.lead` name is removed (`:1557-1560`).
  3. Standalone `claudeteam --agent <role>` runs as a lead (`claudeteam.ps1:138-145`).
  4. The `--name` scan has no current-user filter (`:44`/`:1265`).
  5. The grid rule differs from Linux `claude_team_tab_grid`, but both ledgers say aligned.
  6. Duplicate constants: `claudeteam.ps1:41` `$teammateMode`, and `ClaudeTeamInstallCommon.ps1:24/:38`.
- For shell-linux: SPL-110 (`linux.md:32`) is stale, because Windows has the `--name` check. Set it to aligned; no align task is needed.
- For the orchestrator:
  - paste the shell-windows-1 report section without notice #4;
  - (superseded by DESIGN §3.2) no `[shell-linux] align` task is needed for the one-lead rule.
- shell-linux-1 (owner shell-linux), round 1. Full notes are in `reviews/shell-linux-1.json`.
  1. No one-lead rule (`claude_team_common.sh:904-942`). Add an `other-lead` state for the lead when the other launcher's lead is live, and add it to SPL-110. This round covers it, so no separate align task is needed.
  2. SPL-110 (`linux.md:32`) is stale pending-windows. Set it to aligned, and do not create `[shell-windows] align: SPL-110`.
  3. The summary table has no MODEL/EFFORT columns (`:1755-1764`).
  4. The `--name` scan does not accept `-n` (`:802-803`).
  5. The frontmatter parser needs `utf-8-sig` (`:406`), and on a duplicate name the first should win with a WARN (`:418`).
  6. Add the lead-top fallback. The shared rule is max area, column fill and lead-top (`:1133-1136`, `:1196-1283`), recorded in SPL-107. The orchestrator routes SPW-025 (switch to max area and column fill) to shell-windows.
  7. The catalog path constant is duplicated (`claude_code_install.sh:40` vs `claude_team_common.sh:28`).
  - Non-blocking:
    - the settings.json temp-file replace resets the file mode;
    - the plain-standalone `--teammate-mode` difference goes into SPL-104/105;
    - the regrid should treat untagged ad-hoc teammate panes separately;
    - hooks fire during a re-run build;
    - the PID wait is 10 s against 60 s on Windows;
    - the session_env '-' placeholder.
- (closed 16:04, pycore-4 round 2 approved) pycore-4 (owner pycore): (1) `pycore/pyctl/tts/qwen/operation_service.py:127` (AT-034) builds the retained audio path from the RPC params `item_key` and `format`, which allows path traversal. Fix: use server-side ids or a safe name, allow-list the format, and check the resolved parent. (2) `NVIDIA_SMI_TIMEOUT_SECONDS` is declared three times (memory_gate.py:46, qwen3tts_gpu.py:12, chattts_api_server.py:59); move it into network_constants. Re-review only these two hunks plus any new churn.
- (closed 16:02, shell-windows-2 approved) For the orchestrator: shell-linux-2 must cover SPW-001..003. A shell-windows follow-up is still needed to centralize the `%LOCALAPPDATA%\core_node` state base (declared 3 times) and to point CommonFunc's category link at the shared helper. The concurrent Dual Boot and Disk Repair edits (WindowsManagementManager.ps1 16:00, DiskRepairManager.ps1, DualBootReadinessManager.ps1, DiskReadinessCommon.ps1, Step2, WinScriptsInstaller.ps1) are still unreviewed and need their own task id.

- (open follow-ups, non-blocking, from shell-linux-2) shell-linux:
  - run `remove_desktop_shortcut_...` per-user deletes as the user;
  - detect root by uid, not by name, in the organize/undo dispatch;
  - refuse to close a manifest that parses to 0 entries.

  Orchestrator:
  - one shared desktop-category keyword data file for both shells;
  - an optional shell-windows follow-up: its preview says "Nothing to move" while Organize recreates a missing `<Category>.lnk`.

## Cross-end mismatches
- (resolved by ncore-7 resubmit) ncore K7 Host/Origin test is exact-match like pycore's; mcp-chrome inherits the fix through its native server.
- (resolved) NC-008 closed on every end (ncore-5, contract key, laravel-T10).
- (resolved by laravel-manager-10) toggle-autostart {enabled}.
- (resolved by shell-8) pyservice_entry.sh loopback default.
- (resolved by codemart-4) CodeMart wallet reads deposit_payment_methods.
- (resolved) laravel-T5 honours Idempotency-Key on the wordnew replay routes.

## Watch items (check when the owning task arrives)
- (satisfied at pycore-4, 15:4x, and again at round 2, 16:04) pycore line-ending directive: numstat is identical with and without `--ignore-space-at-eol` (only commander.py differs, by trailing spaces), and a difflib scan finds 0 unchanged lines with a flipped EOL. Since commit f4f2234 captured the working tree, scan against the base `74e7770` and compare raw blob bytes. Keep checking on later pycore tasks.
- pycore follow-up (non-blocking from pycore-4 r2): `pycore/pyutils/tts/memory_gate.py:147` `_gpu_query` should pass `timeout=NVIDIA_SMI_TIMEOUT_SECONDS`, and `_torch_cuda.py:132` uses a literal 15. Check this when pycore next touches memory_gate.
- (done in pycore-4) X4/RV-007: pycore no longer recomputes the word md5 (a missing md5 is an error; the three transitional ledger fallbacks are the §8.0 D7 item). Cover/poster heads are keyed by the contract `realtime.head_keys` paths, with no synthetic heads.
- (done) local_rpc_guard reads the error codes from the contract `client_key_auth.local_rpc.error_codes`.
- (done in laravel-T7/T9) LB-033 and the CodeMart laravel hunks.
- (done) laravel-T10.
- laravel-T11 follow-up: when laravel next touches SafeMigrationHelper, check the shared normalizeIndexColumns() extraction, the partial-index skip in findEquivalentIndex, and 'morphs' removed from COMPOSITE_COLUMN_TYPES. laravel-remote's server run must show `CodeMartV1: OK` and no `Added missing column` on the second sys:init.
- IS-030: permission_mode already removed from config/claude_team_roles.json (orchestrator).
- Route table vs browser pump: checked 03:58. `UI/` calls only `worker/register` and `worker/tasks/{t}/accept` (`core/integrations/laravel/LaravelAPI.ts:353-356`), both `client.key_or_dashboard`. No UI caller of `pull|result|release`. No mismatch. The orchestrator confirmed this.
- laravel-manager `ServerManagerAPI.ts:481-516`: `claimAssistRequests`, `submitAssistRequest` and `releaseAssistRequests` call `assist/requests/*`, which is now `client.key`. They have no callers (dead code). The orchestrator asked laravel-manager to delete them. When that task comes in, verify they are deleted and still have no callers.
