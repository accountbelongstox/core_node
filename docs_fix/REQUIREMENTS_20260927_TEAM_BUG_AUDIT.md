# Team Bug Audit — Report Only

Date: 2026-09-27
Status: binding (user directive: "让各个角色报告代码的BUG，注意先不要修改代码")
Board: `docs_fix/TASK_20260927_CLAUDE_TEAM_BOARD.md` rows L5, P5, A6, B6, U5, S4, R4.
Shared dir: `.claude/agents_shared/bug_audit_20260927/`.

## 1. Rules

- R1 Report only. No role edits code, config, docs or tests. The single file a
  role writes is its own findings file. Fixes wait for a later user directive.
- R2 No tests, builds, services, installs or git. Static checks that write
  nothing are allowed (`bash -n`, `php -l`, `node --check`, `ast.parse`).
- R3 Each role audits only its write scope. Boundary defects go in a
  Cross-scope section naming the owner.
- R4 Coverage order:
  1. `focus_<role>.txt` (files modified since 2026-09-20, newest first);
  2. code behind the role's open/wip board tasks and their REQUIREMENTS docs;
  3. the rest of the scope.
  Each report lists what was read and what was not. No silent caps.
- R5 A bug is a defect with a concrete failure: wrong result, crash, data
  loss, race, leak, security hole, Windows/Linux breakage, contract mismatch,
  or feature-breaking dead code. AGENTS.md violations (hardcoded UI strings,
  duplicate implementations) are reported as category `rule`. Style nits are
  not reported.
- R6 Other user sessions keep editing the tree during the audit, and the audit
  does not stop them. Examples: the W4 delivery layer, the Laravel diff/Redis
  index, CodeMart pages, the agent roles V2.
  - Before writing its report, a role re-reads every file modified after 02:10.
    A finding in such a file is kept only if it still holds, and it is tagged
    `[in-flight, last read HH:MM]`.
  - Mid-edit breakage that is gone at the re-read goes under
    `## In-flight observations`, not in the findings.
  - The reviewer marks a defect fixed since the report as
    `REFUTED (fixed in-flight)`.

## 2. Scopes and ID prefixes

| Role | Scope | Prefix |
|---|---|---|
| pycore-runtime | `pycore/` (minus audio-tts paths), `pymain.py`, `pyservice.*` | PR |
| ncore (V2 type; split off pycore-runtime after its pass 1 left ncore unread) | `ncore/`, root `main.js`, `ncore_module_caller.js`, `apps/` except `apps/mcp-chrome/` | NC |
| audio-tts | `pycore/pyutils/tts/`, `pycore/pyctl/tts/`, `pycore/pyctl/audio_orchestration/`, `pycore/pyctl/queue_center/audio_lane*`, `pycore/tts_install_assets/` | AT |
| laravel-backend | `poly_apps/laravel_main/` (no `vendor/`) | LB |
| frontend-ui | `poly_apps/pycore_laravel_wordnew_ui/`, `apps/mcp-chrome/` (no `node_modules/`, `dist/`, `build_output/`) | FU |
| infra-shell | `scripts/` (no third-party trees such as `nvm_node/`), `dd.sh`, `dd.cmd` | IS |
| reviewer | `config/*_contract.json` vs code on all ends; verification of every report | RV |

## 3. Finding format

File: `.claude/agents_shared/bug_audit_20260927/<role>.md`.

Each finding:
- ID, severity (`critical`/`high`/`medium`/`low`), category;
- `file:line`;
- summary (one sentence);
- failure scenario (concrete input or state → wrong outcome);
- evidence (call chain, line refs);
- confidence (`confirmed` = traced end to end; `likely`; `suspect`);
- suggested fix (one line, not applied);
- owner, if cross-scope.

Then a Cross-scope section and a Coverage section.

## 4. Verification

- `reviewer` verifies every finding: CONFIRMED, PLAUSIBLE or REFUTED, with a
  reason. Critical and high findings go first. Any finding left unverified is
  listed by ID.
- `lead` merges the verified results into §5. Refuted findings are listed
  separately.

## 5. Consolidated report

The user halted the audit at about 02:52 ("先输出现在发现的问题到docs fix然后停下").
- Findings so far: `docs_fix/FIX_20260927_0252_TEAM_BUG_AUDIT.md`. It holds 235 findings: 8 critical, 33 high, 78 medium, 116 low. That includes the pass-2 findings written as the halt arrived, and the ncore report, which ncore kept writing after the stop until 03:06.
- Full reports and the reviewer verdicts: `docs_fix/bug_audit_20260927/`.
- Only audio-tts AT-001..AT-040 are verified: 32 CONFIRMED, 8 PLAUSIBLE, 0 REFUTED.
- The audit resumes only on a new user directive.
