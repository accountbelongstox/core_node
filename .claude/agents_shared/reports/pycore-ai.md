# pycore-ai report

## pycore-ai-D7

Batch 1/1. Status: implemented and statically verified; left in progress until the reviewer writes `.claude/agents_shared/reviews/pycore-ai-D7.json` with `"verdict": "approved"`.

### PRAO-07 — central AI source ids as prompt_derive defaults

- Status: done (awaiting review).
- Files: `pycore/pyctl/ai/prompt_derive.py` (3 added, 2 removed; LF file, per-line endings kept: `git diff --numstat` equals `--ignore-space-at-eol`, both `3 2`).
- Change: `derive_prompt_en(source=AI_SOURCE_PROMPT_DERIVE)` and `rewrite_prompt_en(source=AI_SOURCE_PROMPT_REWRITE)`, imported from `pycore/pyctl/agent_history/ai_sources.py` (read-only for this role). The old defaults `"prompt_derive_en"` / `"prompt_rewrite_en"` recorded usage under ids no surface lists.
- Choice: kept a default instead of making `source` required. The item's verify step checks the defaults, and both current callers (`prompt_derive_service.py`, `prompt_rewrite_service.py`) already pass the same constants. Import cycle: none; `ai_sources.py` has no imports and `agent_history/__init__.py` is an empty package marker.
- Verification:
  - `py_compile` on prompt_derive.py: OK.
  - `grep -nE 'source[^=]*=\s*"'`: no source string literal left.
  - `grep '"prompt_derive_en"\|"prompt_rewrite_en"'` still matches lines 31 and 45. These are `CONFIG_KEY_PROMPT_DERIVE_EN` / `CONFIG_KEY_PROMPT_REWRITE_EN`, the single definitions of the user-editable template config keys (imported by `agent_history/ui_service.py`), not source ids, so they stay.
  - `inspect.signature` check: derive default `agent_history_prompt_derive` == `AI_SOURCE_PROMPT_DERIVE`, rewrite default `agent_history_prompt_rewrite` == `AI_SOURCE_PROMPT_REWRITE`: OK.
  - `import prompt_derive_service, prompt_rewrite_service`: OK.
- Deferrals: none.
- Cross-scope note (pycore-assist, `pycore/pyctl/agent_history/ai_sources.py`): `OPENROUTER_ATTEMPT_SOURCES` lists article, translate and prompt_rewrite, but not `AI_SOURCE_PROMPT_DERIVE`. That follows R3 in `docs_fix/REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md`, which asks for three panel sources. Derive calls now land under the same central id as the derive service. No change requested unless the orchestrator wants derive attempts shown in the panel; if it does, pycore-assist adds the id to that tuple.
- Services: no restart needed for review. The running pycore picks the change up on its next start.

Changed files: `pycore/pyctl/ai/prompt_derive.py`. Blockers: none. Next owner: reviewer.
