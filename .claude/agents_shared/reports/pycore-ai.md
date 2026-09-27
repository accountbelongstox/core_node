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

## pycore-ai-D7P2-fix

Diff base: `74e7770`. Status: all 4 items implemented and verified in-process (no service restart, no test/build run - static + import-time checks only); left in progress until the reviewer writes `.claude/agents_shared/reviews/pycore-ai-D7P2-fix.json` with `"verdict": "approved"`.

### pycore-ai-D7P2-B1 — md5 required only for Laravel-sourced word_audio tasks

- Status: done.
- Files: `pycore/pyctl/tts/laravel_audio_worker_state.py` (`_normalize`, word branch, lines ~565-593).
- Change: added `is_local = bool(info.get("_local_source"))` right after reading `md5`, and changed the validation to `elif not md5 and not is_local: info["error"] = "word_audio payload carried no md5"`. A Laravel-sourced task (no `_local_source`, e.g. a real `global_tasks` row) is unaffected - still errors without md5. A local task (`build_local_task` in `audio_queue_center.py`, any `_local_source`: orchestration/manual/full_sync) now proceeds with `md5 == ""`; downstream (`kokoro_batch`, `save_to_cache`, `audio_resource_ledger.resource_key`) already fall back to the `<lang>:text:<cleaned_word>` key format (X4/D7 work), so no other file needed a change for this item.
- Verification:
  - `py_compile` + `ast.parse`: OK.
  - Runtime import of `pycore.pyctl.tts.laravel_audio_worker_state`: OK, no import errors.
  - Behavioral check (scratch script, `LaravelAudioWorkerStateMixin._normalize` on a real `Worker` subclass): a `build_local_task("word_audio", "en", "hello", LOCAL_SOURCE_ORCHESTRATION)` task normalizes with `info["md5"] == ""` and no `info["error"]` (previously `"word_audio payload carried no md5"`); a plain Laravel-shaped task (`task_type="word_audio"`, no `_local_source`, no `payload.md5`) still normalizes with `info["error"] == "word_audio payload carried no md5"` (unchanged, confirms no over-widening of the exemption).
  - EOL check: file stays 100% CRLF (`grep -c $'\r$'` == total line count), matching the pre-existing file.
- Deferrals: none.
- Cross-scope note: the orchestration Part1 fill this item's evidence names (`pycore/pyctl/audio_orchestration/orch_promote.py:57`) is pycore-runtime's `audio_orchestration/` path - read for context only, not touched (it already calls `build_local_task` without a `md5` argument, which is what triggered the bug; no change needed there since the fix lives entirely in the consumer's validation).

### pycore-ai-D7P2-B2 — md5-less word upload rejection is terminal, not retry-poison

- Status: done.
- Files: `pycore/pyctl/tts/audio_resource_delivery.py`, `pycore/pyctl/tts/laravel_audio_delivery.py`.
- Change:
  - `audio_resource_delivery.py`: added ONE shared rule `is_terminal_delivery_rejection(detail="", status_code=None)` (module-level, exported) plus two constants: `WORD_NOT_FOUND_REJECTION_CODE = "WORD_NOT_FOUND"` (the contract's `word_identity.fallback_when_md5_absent.rejection_code`, `config/queue_center_contract.json` - read-only reference, not edited: that file is a cross-end contract, orchestrator-owned) and `RETRYABLE_4XX_HTTP_STATUSES = (408, 409, 425, 429)`. The rule accepts either a failure-string `detail` (the existing domain-report vocabulary: `"server validation rejected: ..."`, `"unknown task on server (404)"`, `"HTTP 4xx: ..."`) or a raw `status_code` (needed here because `word_audio_service.upload_word_audio`'s LDRI-11 rejection body, `"md5, lang and audio_base64 are required"`, carries no such prefix - only `receipt["http_status"]`).
  - `_deliver_resource` (word branch, single upload): on a rejected upload (`not receipt.get("success")` or bad `receipt_status`), when the word is md5-less (`not clip_md5`) and `is_terminal_delivery_rejection(detail=error, status_code=receipt.get("http_status"))` is true, it now logs and returns `{"status": OUTCOME_DONE, "skipped": WORD_NOT_FOUND_REJECTION_CODE}` instead of `raise RuntimeError(error)`. A word WITH md5 (`clip_md5` truthy) is unaffected - any rejection for it still raises (retries), as before; only the already-genuinely-terminal `receipt_status == "not_found"` case was special-cased before this fix.
  - `laravel_audio_delivery.py`: `AudioLaneDelivery._terminal_report_error` now delegates to the shared rule (`return is_terminal_delivery_rejection(detail=detail)`) instead of duplicating the same three checks - removes the duplicate implementation per AGENTS.md/PYTHON_PYCORE.md centralization. No circular import: `laravel_audio_delivery.py` already imported `audio_resource_delivery` one-directionally; `audio_resource_delivery.py` has no import back.
- Verification:
  - `py_compile` + `ast.parse`: OK.
  - Runtime import of both modules: OK.
  - Behavioral check (scratch script): `is_terminal_delivery_rejection(detail="md5, lang and audio_base64 are required", status_code=400)` -> `True` (the exact LDRI-11 body); `status_code` in `(408, 409, 425, 429)` -> `False` (stays retryable); a status-code-less transient string (`"proxy error: timeout"`) -> `False`. `AudioLaneDelivery._terminal_report_error` reproduces its pre-refactor truth table unchanged (`"server validation rejected: ..."` / `"unknown task on server (404)"` / `"HTTP 400: ..."` -> True; `"HTTP 429: ..."` / `"connection reset"` -> False) - confirms the refactor is behavior-preserving at that call site while fixing the new one.
  - EOL check: both files stay 100% CRLF (unchanged from base).
- Deferrals: none. LDRI-11 itself (Laravel resolving `word/audio/upload` by `lang + cleaned_word` when md5 is absent) stays open and is wordnew-laravel's item (`.claude/agents_shared/d22/items_wordnew.json`, `LDRI-11`) - this fix only stops the retry-poison on the pycore side while that lands; once LDRI-11 ships, the same code path keeps working (successful uploads still return `stored`/`exists`, handled above this branch).
- Cross-scope note: none beyond the LDRI-11 dependency above (Laravel-side, `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1WordQurey/AppQyV1WordMediaController.php`, read for context only).

### pycore-ai-D7P2-B3 — word cache index: no false misses while a language is still loading

- Status: done.
- Files: `pycore/pyutils/tts/word_audio_cache.py` (`WordAudioCacheIndex`: `__init__`, `_install`, `_finish_load`, `note_stored`).
- Change: added `self._pending: Dict[str, Dict[str, Tuple[int, str]]]` and `self._load_finished: bool` (persistent - `load_all` runs once at boot, never reset). `note_stored` now writes to the live `self._index[safe_lang]` only when `self._load_finished` is already true OR that language is already installed (`safe_lang in self._index`); otherwise it writes into `self._pending[safe_lang]` instead, so `_lookup`'s `self._index.get(safe_lang) is None` check keeps returning None (not-loaded -> caller falls back to the directory scan) for a language `_install` has not published yet. `_install` now pops and merges that language's pending map into the scan result (newest wins) before publishing it live. `_finish_load` folds any leftover pending languages (a directory that appeared mid-scan, never in the boot snapshot) into `_index` before setting `_load_finished = True`, since every store after that point goes live directly. Per the item, the live/pending decision is based on `_load_finished` + per-language install state, not on the transient `_loading` flag (`_loading` still only guards re-entrant `load_all` calls).
- Verification:
  - `py_compile` + `ast.parse`: OK.
  - Runtime import of `pycore.pyutils.tts.word_audio_cache`: OK.
  - Behavioral check (scratch script, real `WordAudioCacheIndex` instance, no filesystem): (1) `note_stored` for language `en` before any scan/install of `en` -> `_lookup("en", ["cat"])` returns `None` (previously: a partial `{}`-shaped live mapping, reproducing the AOQSD-16 regression where "cat" would report as a definite miss). (2) `_install("en", {"cat": ...})` (simulating the real scan finding "cat") merges the pending "hello" store in; `_lookup("en", ["cat", "hello"])` returns both. (3) after `_finish_load()`, `note_stored` for a brand-new language `fr` goes live immediately and `_lookup("fr", [...])` reflects it right away (the "directory created after boot" case, unchanged from before this fix).
  - EOL check: file stays 100% CRLF (unchanged from base).
- Deferrals: none.
- Cross-scope note: none - the whole fix is contained in this one library file, which nothing else in the fix set needed to change.

### pycore-ai-D7P2-B4 — one definition of the audio-lane restore-wait timeout

- Status: done.
- Files: `pycore/pyutils/tts/audio_queue_center.py`, `pycore/pyctl/assist/capability_sync.py`, `pycore/pyctl/tts/audio_lane_full_sync.py`.
- Change: added `AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS = 180.0` to `audio_queue_center.py` next to the restore-signal constants (just above `wait_for_restore`'s section), and made it that method's default `timeout` value. `capability_sync.py` and `audio_lane_full_sync.py` now import it instead of each declaring its own `180.0` copy (`_AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS` / `RESTORE_WAIT_TIMEOUT_SECONDS` removed as local literals; `audio_lane_full_sync.AudioLaneFullSync.RESTORE_WAIT_TIMEOUT_SECONDS` is kept as a class attribute but now just aliases the shared constant, since it's part of that class's public surface). Both call sites (`capability_sync.py:_start_audio_lane_after_restore`, `audio_lane_full_sync.py:run_full_sync`) now capture `wait_for_restore`'s return value and log a `ColorPrint.yellow` warning naming the lane and the timeout when it is `False` (previously the return value was discarded, so a stuck restore signaled nothing before the lane started anyway).
- Verification:
  - `py_compile` + `ast.parse`: OK.
  - Runtime import of all three modules: OK.
  - Behavioral check: `audio_queue_center.AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS == capability_sync.AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS == audio_lane_full_sync.AUDIO_LANE_RESTORE_WAIT_TIMEOUT_SECONDS == 180.0`, and `inspect.signature(AudioQueueCenter.wait_for_restore).parameters["timeout"].default == 180.0`.
  - `grep` for the old constant names across `pycore/` and `pyapps/`: no remaining references.
  - EOL check: all three files stay 100% CRLF (unchanged from base).
- Deferrals: none.
- Cross-scope note: none - all three files are pycore-ai scope (`pyctl/{assist,tts}/`, `pyutils/tts/`).

### Verification method note (all 4 items)

No service restart and no pytest/build run: these are pure-Python library/logic fixes with no config or template changes, verified with `py_compile`/`ast.parse`, real module imports (`pycore.pyctl.tts.*`, `pycore.pyutils.tts.*` import cleanly, confirming no new circular imports), and small scratch scripts exercising the actual classes/functions in-process (no filesystem, no network, no long-lived threads left running - each script's process exited and `tasklist` confirmed no leftover `python.exe`). Free RAM was checked (~3.1 GB) before running these in-process checks, per the resource guard.

Changed files (this task): `pycore/pyctl/tts/laravel_audio_worker_state.py`, `pycore/pyctl/tts/audio_resource_delivery.py`, `pycore/pyctl/tts/laravel_audio_delivery.py`, `pycore/pyutils/tts/word_audio_cache.py`, `pycore/pyutils/tts/audio_queue_center.py`, `pycore/pyctl/assist/capability_sync.py`, `pycore/pyctl/tts/audio_lane_full_sync.py`. Blockers: none. Next owner: reviewer (pycore-lead / reviewer service, per the task's leader rules).
