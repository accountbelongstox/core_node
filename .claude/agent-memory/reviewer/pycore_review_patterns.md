---
name: pycore-review-patterns
description: Recurring defect patterns in pycore audio/TTS fixes (file names from RPC params, constants duplicated into TTS servers, "complete"/"every call" claims that are not) and safe scratch-run practice
metadata:
  type: feedback
---

Recurring pycore defects found in review (pycore-2 AT-006, pycore-4 AT-034 and AT-036):

- **File names built from RPC input.** When a fix stores a new file, trace every part of the file name back to its route handler. `item_key` or `format` from the params in a path means path traversal. Require server-side ids or a safe-name helper, a format allow-list, and a resolved-parent check. The accepted fix (pycore-4 r2) uses operation_service uuid ids, an allow-list at the RPC entry and in the worker, and a parent check.
- **Constants copied into the standalone TTS servers.** The servers under `pycore/tts_install_assets/` load `pycore/pyfoundations/network_constants.py` by path, through `tts_server_common.load_network_constants()` (cached in sys.modules), so that file is the single source. A new constant (for example a timeout) goes there, and the servers read it with getattr plus a fallback.
- **"Complete" or "every call" claims that are not.** Check the transitive imports of any module list the owner calls complete (the qwen3tts code identity missed service_contract). Grep every call site when the owner claims "every X in pycore": after r2, memory_gate._gpu_query still ran nvidia-smi without a timeout, although the report said every call was bounded.

**Why:** these patterns passed the owner's static checks (AST, import resolution), and only reading the data flow catches them. The pycore audit flagged the same file-name class once (AT-006), and it came back in a later fix.

**How to apply:**
- For every "fixed" id that adds file writes, subprocesses or constants, grep the source of each input and each literal, and grep all sibling call sites.
- Run pure-function checks with `python -B` from the scratchpad. Running python inside `pycore/tts_install_assets/` rewrites its gitignored `__pycache__`.

Related: [[pycore-line-ending-gate]], [[client-key-review-checklist]].
