# Task board: client key authentication and audit fixes

The TaskCreate/TaskUpdate tools are not available in this build. Each role keeps its own task ids of the form `<role>-<n>`. The reviewer writes `.claude/agents_shared/reviews/<role>-<n>.json`. A task is done only with `"verdict": "approved"`.

Each role lists its tasks here or in its report (`.claude/agents_shared/reports/<role>.md`). The orchestrator mirrors the ids below.

| Id | Subject | Status |
|---|---|---|
| shell-1 | [shell] K2 client key lifecycle Linux+Windows, IS-008, IS-010 | approved |
| shell-2 | [shell] critical/high data loss: IS-001 (+IS-012), IS-002, IS-003, IS-004 | approved |
| shell-3 | [shell] medium: IS-005, IS-006, IS-007, IS-009, IS-011, IS-013 | approved |
| shell-4 | [shell] low: IS-014..IS-021, IS-023..IS-030 | approved |
| shell-5 | [shell] PR-034 script order; requirements §2 follow-ups | approved |
| shell-6 | [shell] IS-022 sweep (GlobalVars.ps1 first) | approved |
| pycore-manager-1 | [pycore-manager] i18n: FU-004, FU-018, FU-024 (pc common.close), FU-025 (pycore-manager parts) | approved |
| pycore-manager-2 | [pycore-manager] stale state and races: FU-011, FU-036, FU-037, FU-040 | approved |
| pycore-manager-3 | [pycore-manager] reuse: FU-026 pycore-manager parts (humanBytes copies) | approved |
| pycore-manager-4 | [pycore-manager] shared-layer writer: FU-020, FU-027 | approved |
| pycore-manager-5 | [pycore-manager] K7/K7a adaptation (pycoreTarget.ts, PycoreClient.ts error codes) + Laravel route-table adaptation | approved |
| vortex-1 | [vortex] FU-033 simulated account math | approved |
| vortex-2 | [vortex] FU-038 stale candles | approved |
| vortex-3 | [vortex] FU-042 vx namespace i18n (shell-i18n 'vx' added) | approved |
| vortex-4 | [vortex] okx reveal_credentials UI (masked only) | approved (server route refuted by pycore: not in this checkout) |
| codemart-1 | [codemart] stale responses and effect lifecycle: FU-010, FU-013, FU-014 | approved |
| codemart-2 | [codemart] bootstrap refresh keeps the last good state: FU-015 | approved |
| codemart-3 | [codemart] calendar dates and estimate inputs: FU-017, FU-022 | approved |
| codemart-4 | [codemart] adapt UI to the laravel CodeMart money fixes (LB-008/009/019/020/024/025) | approved |
| codemart-5 | [codemart] FU-026 CodeMart parts (formatting centralized, cmPublicFormat.ts deleted, dead getPublicHome removed) | approved |
| codemart-6 | [codemart] drop the local IDEMPOTENCY_HEADER and clearCoordinatedRequests override (redundant with BaseAPI) | approved |
| laravel-T1 | [laravel] K3 verifier + route gating: LB-001/002/003/005/006/007/015/028/032, RV-003 | approved |
| laravel-T2 | [laravel] money: LB-004/008/009/019/020/024/025 (+ LB-035 admin gate) | approved |
| laravel-T3 | [laravel] data sync: LB-010/016/017/018/021/022/023 (heavy work to a background lane with T4) | approved |
| laravel-T4 | [laravel] remaining LB fixes (per laravel report) | approved |
| laravel-T5 | [laravel] incl. Idempotency-Key on wordnew replay routes + FU-030 server | approved |
| laravel-T6 | [laravel] LB-034 i18n (+ lang/ pinning, ApplyRequestLocale) | approved (remainder deferred to D5) |
| flutter-1 | [flutter] adapt Laravel calls to the route table (tts/generate → dashboard.auth:user) | won't fix (user, stopped); review dropped |
| flutter-2 | [flutter] F-FL-1 repoint /api/dict/v1/* to laravel_main routes; F-FL-2 i18n fallbacks; F-FL-3 dead constants | won't fix (user) |
| D5+D7 (queued) | [orchestrator] after all D1 tasks are approved: Workflow long task: audit/implement/verify the 2026-09-26/27 docs, then long-run audio orchestration (prompt rewrite → audio; all Laravel books) until it works and audio is generated (requirements §8) | queued |
| laravel-manager-1 | [laravel-manager] FU-003, FU-002 (BaseAPI) | approved |
| laravel-manager-2 | [laravel-manager] FU-030, FU-039 | approved |
| laravel-manager-3 | [laravel-manager] FU-005, FU-006, FU-012 | approved |
| laravel-manager-4 | [laravel-manager] FU-016, FU-035 | approved |
| laravel-manager-5 | [laravel-manager] FU-024 lm + FU-042 lm i18n | approved |
| laravel-manager-6 | [laravel-manager] route table adaptation (LmBaseAPI 401/403, AuthGuard, dead assist wrappers, AppQyV1 import fix) | approved |
| laravel-manager-7 | [laravel-manager] shared contract adapters (data dir, LOCAL_RPC_LOOPBACK_HOSTS, QueueCenterContract types, RequestCoordinator ttl<=0) | approved |
| wordnew-1 | [wordnew] FU-031 offline queue owner scope, logout clear, Idempotency-Key; legacy entries without owner dropped | approved |
| wordnew-2 | [wordnew] FU-008, FU-009, FU-023 | approved |
| wordnew-3 | [wordnew] FU-019, FU-032, FU-042 wordnew part | approved |
| wordnew-4 | [wordnew] route table adaptation (admin 403 handling, central i18n error helper) | approved |
| wordnew-5 | [wordnew] pre-existing runtime ReferenceErrors in platform capabilities + WfNewBookReader PlayBar props (+ WfNewAppChrome.tsx:96) | approved (wordnew tsc 22 → 0) |
| mcp-chrome-1 | [mcp-chrome] K3 native-host signing for extension Laravel calls (single LaravelTransport; extension id from contract) | approved |
| mcp-chrome-2 | [mcp-chrome] FU-001 native server K7 (on ncore local_rpc_guard, extension-only origin) | approved |
| mcp-chrome-3 | [mcp-chrome] FU-007, FU-021, FU-034, FU-041 | approved |
| mcp-chrome-4 | [mcp-chrome] FU-042 extension part (worker names refuted), RV-004 extension part | approved |
| D9 (queued after D5+D7) | [orchestrator] Workflow long task: CodeMart AI icons, calibrate and use all features, refine rough pages, continue earlier progress, backend Redis, 175 deploy script (requirements §9) | queued |
| laravel-manager-8 | [laravel-manager] FU-025/FU-026 laravel-manager remainders (LibrariesTab literals, VocabularyLearning mock tasks, HtmlErrorModal formatBytes) | approved |
| ncore-1 | [ncore] K3 signer/verifier + K7 local RPC guard: NC-001/005/007/013/020/028, new NC-038/039 | approved |
| ncore-2 | [ncore] secrets from the shared store: NC-002, NC-024, NC-033 (+ config/index.js migration) | approved (config/index.js migration pending) |
| ncore-3 | [ncore] exec layer: NC-003/004/012/017/018/019/029/031/032 | approved |
| ncore-4 | [ncore] HTTP stack and lifecycle: NC-006/009/010 (= PR-025)/014/025/027 | approved |
| ncore-5 | [ncore] platform, data, protocol: NC-008/011/015/016/021/022/023/026/030/037 | approved |
| ncore-6 | [ncore] rules: NC-034, NC-035, NC-036 | approved |
| pycore-manager-6 | [pycore-manager] FU-025 remainder i18n sweep (10 files, 374 labels) | approved |
| laravel-manager-9 | [laravel-manager] FU-027 BaseAPI part (no implicit persistSharedBaseURL) | approved |
| laravel-manager-10 | [laravel-manager] adapt to laravel FU-030 server changes (toggle-autostart target, backup/restore idempotency) | approved |
| laravel-manager-11 | [laravel-manager] remaining 36 pre-existing tsc errors (TaskCenter auto-refresh props first) | approved |
| pycore-1 | [pycore] K3 signer, PR-014, PR-003 (CodeSync signing) | approved |
| pycore-2 | [pycore] K7/K7a RPC server, PR-001/021/030/031/037, AT-006/029 | approved |
| pycore-3 | [pycore] 23 PR findings (PR-024/027/034 partial, deferrals recorded) | approved |
| pycore-4..N | [pycore] AT-*, X2/X6/X8, RV pycore side, ruling items (RV-007, X4, RV-004), IS-010 secret_manager, PR-034 escape, PR-024 remainder (user_data.json perms), CRLF restore | split in the D10 session into pycore-4/5/6 below |
| pycore-4 | [pycore] audio/TTS and queue fixes: AT-001..AT-050 (AT-015 withdrawn), X2, X6, X8, RV-001/002/006/008/009/010 | review r1 changes_requested (53/59 fixed, AT-006/029 already fixed, AT-049/RV-009/RV-010 deferrals valid, EOL gate passes). Blocking: AT-034 path traversal in pyctl/tts/qwen/operation_service.py:127 (item_key/format from params; safe-name + wav/mp3 allow-list + parent check); NVIDIA_SMI_TIMEOUT_SECONDS declared 3x -> network_constants. Fix round r1 runs automatically |
| pycore-5 | [pycore] rulings: RV-007 (heads keyed by contract realtime.head_keys, synthetic heads dropped), X4 (consume Laravel word_identity md5 fields; fallback removal stays D7), RV-004 (drop GLOBAL_TASK_STREAM_EVENTS_BY_ROLE) | D10 workflow W2 |
| pycore-6 | [pycore] IS-010 secret_manager (no secrets on argv), PR-034 escape, PR-024 remainder (user_data.json mode, B9 option recorded), CRLF restore on every pycore file changed in pycore-1..6 | D10 workflow W2 |
| laravel-remote-1 | [laravel-remote] D9/D7 server inventory, read-only (checkout drift, migrations, workers/scheduler, Redis, key presence, 175 script vs server state, health) | sent by message about 13:3x |
| D10-shell | [shell] claudeagents/claudeteamup: start all enabled roles in team mode; enable the verified Windows official features idempotently; D11 default model claude-opus-5-5 from the catalog (lead, roles, remote role); Linux parity | split by D12c into shell-windows-1 / shell-linux-1 |
| D12-orch | [orchestrator] split shell into shell-linux / shell-windows (agents, catalog, memory, reviewer parity check) | done (requirements §11.1) |
| shell-windows-1 | [shell-windows] D10/D11/D13 Windows launchers: every role window at start (official mechanism), 1K/2K/4K DPI-correct placement, official config (settings/agents vs catalog), models per role (latest only), prerequisites + all new interaction/messaging features idempotent, remote role command | after both docs checks (§10.2, §12) |
| shell-linux-1 | [shell-linux] align: D10/D11/D13 Linux launchers (claudeagents.sh, claudeteam.sh, claudeteamup.sh, claude_team_common.sh, claude_team_install) on Debian 13 / Ubuntu 26.04 | with shell-windows-1 |
| D13-orch | [orchestrator] official config migration (catalog -> settings.json/agents frontmatter where official), per-role model/effort frontmatter (opus-5-5 thinking, sonnet-5 coding), guide §2/§3/§5/§7/§10 update | frontmatter model/effort done (22 files); catalog schema 6 done; spec .claude/agents_shared/d13/DESIGN.md; guide update + grid removal after shell-*-1 approved |
| D14-orch | [orchestrator] guide edits allowed (B12); guide §8 shell split, B6, B11 applied | done |
| shell-windows-2 | [shell-windows] D12a desktop icon organizer: scan this machine, upgrade, run (move only, undo manifest) | D12 workflow |
| shell-linux-2 | [shell-linux] align: D12a desktop shortcut organization features that apply on Linux | D12 workflow, after shell-windows-2 |
| shell-linux-3 | [shell-linux] D12b Debian 13 WSL2 Docker prerequisites + runners for the Docker-recommended model steps; sequential tests | D12 workflow |
| shell-windows-3 | [shell-windows] D12b Windows model steps delegate to the Debian WSL2 runners (WSL2 + Debian 13 idempotent) | D12 workflow |
| laravel-T11 | [laravel] D1 regression: codemart_v1_escrows lacks released_amount/refunded_amount on tables created before the money fix (server public/home 500). Make sys:init reconcile missing columns on existing tables idempotently (shared initializer path), verify locally (D8) | approved (SafeMigrationHelper addMissingColumns + findEquivalentIndex; 175:657 runs sys:init; local public/home 200). 5 non-blocking notes -> laravel-T12 |
| laravel-T12 | [laravel] T11 non-blocking notes: duplicated normalization helper, partial-index blind spot, 'morphs' in COMPOSITE_COLUMN_TYPES, residue list (projects, code_reviews), whitespace churn | after the laravel D7 lane |
| shell-linux-4 | [shell-linux] 175_laravel_main_start.sh:657 must stop (or warn loudly) when sys:init fails, like start.ps1:641-643; shell-windows parity check of Step175 | fold into the shell-linux D7 lane if the merge put §9 item 6 there; else after it |
| laravel-remote-3 | [laravel-remote] after code sync: run the T11 server steps (pending orch_audio migrations first, then sys:init), re-check public/home 200 | waits for the code sync |
| laravel-remote-2 | [laravel-remote] read-only diagnostics: syslog missing errors, scheduler overlap, PG17 data-dir cause, orch_audio migration safety, phpredis for FrankenPHP | sent about 15:4x |
| <role>-D7[.n] | [<role>] D5/D7/D9 lane items for laravel, ui-pycore-manager, ui-wordnew, ui-laravel-manager, ui-codemart, ui-vortex, mcp-chrome, ncore, shell-linux, shell-windows | workflow d5-d7-d9-all-roles-lanes (verdicts in reviews/<role>-D7*.json) |
| pycore-D7 | [pycore] pycore D7 lane + audio long run (D7 §8.2 step 5, D8 endpoint) | split by D16: pycore-ai/-runtime/-assist/-architect/pycore lanes run now for files not in flight; phase 2 (in-flight files, audio long run) after pycore-4/5/6 approved |
| D16-orch | [orchestrator] role families: laravel -> laravel + laravel-qyapp + laravel-codemart + laravel-api; pycore -> pycore + pycore-ai + pycore-runtime + pycore-architect + pycore-assist (agents, catalog, memory, guide §8/B13) | done |
| <role>-D7 (D16) | [<role>] lanes now also for laravel-qyapp, laravel-codemart, laravel-api, pycore, pycore-ai, pycore-runtime, pycore-architect (arch-audit), pycore-assist, flutter (read-only consumer check); srv-01..04 and T12 folded in | workflow d5-d7-d9-all-roles-lanes (resumed) |
| srv-03 | [shell-linux] URGENT: 777 walkers prune PostgreSQL data dirs (live PG15 at risk) | in the shell-linux lane |
| user-1 | [user] decide PG17 17/main on the server (points at a PG15 data dir): disable or re-point | user |
| user-2 | [user] code sync to the server, then relay "run sys:init/migrate on the server" so laravel-remote-3 can run | user |
| D11-orch | [orchestrator] catalog model key; agent frontmatter model per the docs check; restart the non-Opus workflow (done: docs check rerun on Opus); restart laravel-remote after D10-shell | in progress |
| mcp-chrome-5 | [mcp-chrome] Firefox extension id from the contract (B9) (+ CLIENT_KEY_SIGN only from extension pages) | approved |
| laravel-manager-12 | [laravel-manager] LaravelRealtime.ts payload map keyed by symbolic event names (shared layer) | approved |
| shell-7 | [shell] mask secret prints in other launchers (claudevolc/zhipu/alibaba/deepseek, piark/piyolo generator, codex/openai, kimi, ssh1-3) | approved |
| shell-8 | [shell] K7a: pyservice_entry.sh BIND_HOST default 127.0.0.1 + help text | approved |
| codemart-7 | [codemart] useCmIdempotencyKey → BaseAPI.createIdempotencyKey (drop local createKey) | approved |
| shell-9 | [shell] postgres password mirror file 0644 → 0640/0600 (+ .core_node_secrets pruned from 777 walks; 777-helper guard refuses system dirs) | approved |
| pycore-manager-7 | [pycore-manager] shared layer: index.ts dead exports; LaravelRequest.ts 401 → shared login, 403 i18n | approved |
| laravel-T7 | [laravel] CodeMart contract follow-ups + DingDuoDuo admin gate (LB-008 refund, LB-019 optional phone, LB-020 deposit methods, LB-035) | approved |
| laravel-T8 | [laravel] verifier follow-ups (indexed keys only, base-path signing) | approved |
| laravel-T9 | [laravel] rulings on T4 deferrals (LB-033, X4 fields, RV-007 keys, RV-004, LB-007 queue-only; idempotent 409/429) | approved |
| laravel-T10 | [laravel] NC-008 server half: DDK2 minting with DINGDUODUO_SUPER_CODE_SIGNING_KEY_1, remove master codes/SUPER_SALT/FNV, reject master codes as member tokens | approved |
| vortex-5 | [vortex] shared classifyPycoreAccess (ServiceContract error-code exports, pycoreAccess.ts) + VortexPycoreNotice | approved |
| pycore-manager-8 | [pycore-manager] PcRpcAccessBanner → shared classifyPycoreAccess (after vortex-5) | approved |
| ncore-7 | [ncore] config/index.js ENC → SECRET migration (+ NC-026/NC-011 twins); Node K7 guard 403 local_rpc codes aligned with pycore | approved (DNS-rebinding fix verified) |
