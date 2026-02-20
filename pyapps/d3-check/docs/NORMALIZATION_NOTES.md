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

## Unreasonable or follow-up (need architecture / product decision)

1. **Lazy imports (§6.1)**  
   Many modules use function-level `from X import Y` to avoid circular imports. PROJECT_STANDARDS §6.1 requires resolving cycles by architecture (split module, dependency injection, shared layer), not by lazy import.  
   **Reasonable exception**: `share/asia_credentials.py` imports `d3utils.i18n_manager` only when the dialog is shown, so share does not depend on d3utils at load time; this is an intentional boundary.  
   **Others** (e.g. d3utils/history/compat.py, history_info_organizer_approach5.py, controller/d4func/exp_farming.py, d4_scaled_template_matcher.py, timers/one_shot_tasks.py, share/values/config_change_hub.py, lifecycle/thread_registry.py, ocr_helper.py, i18n_manager.py CONFIG lazy load): Fixing would require dependency inversion or module splits. Recommend tracking in a separate refactor and not blocking normalization.

2. **traceback / datetime / time inside functions**  
   Some files `import traceback` or `import time`/`datetime` inside except blocks or helpers. §6.1 allows optional third-party at module level; standard library is usually at top. These are minor and can be moved to top in a cleanup.

3. **Scripts section names**  
   `scripts/test_history_organizer_poll.py` uses Chinese section names (e.g. "思路2对比") in output. Could be moved to i18n or English in a later pass if scripts are considered part of the product surface.

4. **Filename "登陆后的战网元素.json"**  
   `battlenet_region_judge.py` references this path; it is a resource filename. Renaming would require updating any docs or config that refer to it; left as-is.

## Reference

- Canonical: **docs/PROJECT_STANDARDS.md** (§11 code language and i18n, §6.1 imports, §4.1 flow and sleep).
