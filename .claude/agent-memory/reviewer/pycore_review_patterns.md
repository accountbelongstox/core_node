---
name: pycore-review-patterns
description: Recurring defect patterns in pycore audio/TTS fixes (file names from RPC params, constants duplicated into standalone TTS servers, "complete" identity lists) and safe scratch-run practice
metadata:
  type: feedback
---

Recurring pycore defects found in review (pycore-2 AT-006 and pycore-4 AT-034):

- **File names built from RPC input.** When a fix stores a new file, trace every part of the file name back to its route handler. `item_key` or `format` from the params in a path means path traversal. Require server-side ids or a safe-name helper, a format allow-list, and a resolved-parent check.
- **Constants copied into the standalone TTS servers.** The servers under `pycore/tts_install_assets/` load `pycore/pyfoundations/network_constants.py` by path, so that file is the single source. A new constant (for example a timeout) should go there, and the servers read it with getattr plus a fallback. It should not be declared again in each server.
- **"Complete" lists that are not.** Check the transitive imports of any module list the owner calls complete, such as the qwen3tts code identity. network_constants imports service_contract.

**Why:** these patterns passed the owner's static checks (AST, import resolution), and only reading the data flow catches them. The pycore audit flagged the same file-name class once (AT-006), and it came back in a later fix.

**How to apply:**
- For every "fixed" id that adds file writes, subprocesses or constants, grep the source of each input and each literal.
- Run pure-function checks with `python -B` from the scratchpad. Running python inside `pycore/tts_install_assets/` rewrites its gitignored `__pycache__`.

Related: [[pycore-line-ending-gate]], [[client-key-review-checklist]].
