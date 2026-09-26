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

## 2. Scopes and ID prefixes

| Role | Scope | Prefix |
|---|---|---|
| pycore-runtime | `pycore/` (minus audio-tts paths), `ncore/`, `pymain.py`, `pyservice.*` | PR |
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

Pending.
