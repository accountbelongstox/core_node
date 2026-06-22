# Normalization notes (per PROJECT_STANDARDS)

Summary of normalization applied and items left for architecture or explicitly excluded.

## Completed in this pass

- **§11 Code language**: Comments, docstrings, and log messages in controller, d3utils, d4utils, ui, share, and selected scripts converted to English.
- **§11 User-facing i18n**: ROSBOT KEY message and Asia credentials dialog use i18n (rosbot.need_key_message, credentials.*). REGION_LABELS fallback set to English.
- **§11 Constants unchanged**: providor/constants (common, d3, d4), providor_index window-title literals, pathfinding "附魔", strategy "禁用", browser_login_ocr_flow EULA/button substrings, battlenet_region_judge/battlenet_operation/rosbot_ui_structure matching literals, d4 "寻找" for Find Team — all left as-is per §11.
- **§4.1 time.sleep**: flow_e_rosbot_run.run_e2_sleep documented as non-tick thread (extension thread) exception for process/UI stability.
- **Scripts**: analyze_approach61_diff.py, test_left30_match.py — comments and docstrings translated to English.

## Explicitly excluded (no change)

- **cursor_AI_道歉目录** and **gen_apology*.py** / **append_*apology*.py** / **append_reflection_1000.py**: Left as-is (apology/reflection content).
- **providor/constants/** and **providor_index.py** window-title lists: Matching/config literals per §11.
- **utils/_obsolete_***, **state/_obsolete_***: Obsolete code, not normalized.

## i18n_manager and reference UI JSON (done)

- **i18n_manager**: Single place **providor/i18n_manager.py**; init once on first import. All call sites use `from providor.i18n_manager import i18n_manager`. `d3utils/i18n_manager.py` is re-export only.
- **share/asia_credentials.py**: Top-level import from providor; no lazy import.
- **Reference UI JSON**: Docs reference JSON (e.g. Battle.net UI snapshot) is **not loaded at runtime**. **battlenet_region_judge** uses only hardcoded constants from `providor.constants.d3` (D3_TAB_*, START_GAME_* for Asia); no file reference.

## Unreasonable or follow-up (need architecture / product decision)

1. **Lazy imports (§6.1)**  
   Many modules still use function-level `from X import Y` to avoid circular imports.  
   **Others** (e.g. d3utils/history/compat.py, controller/d4func/exp_farming.py, d4_scaled_template_matcher.py, timers/one_shot_tasks.py, share/values/config_change_hub.py, lifecycle/thread_registry.py, ocr_helper.py, providor.i18n_manager CONFIG lazy load): Fixing would require dependency inversion or module splits. Recommend tracking in a separate refactor.

2. **traceback / datetime / time inside functions**  
   Some files `import traceback` or `import time`/`datetime` inside except blocks or helpers. §6.1 allows optional third-party at module level; standard library is usually at top. These are minor and can be moved to top in a cleanup.

3. **Scripts section names**  
   `scripts/test_history_organizer_poll.py` uses Chinese section names (e.g. "思路2对比") in output. Could be moved to i18n or English in a later pass if scripts are considered part of the product surface.

## Reference

- Canonical: **docs/PROJECT_STANDARDS.md** (§11 code language and i18n, §6.1 imports, §4.1 flow and sleep).
