---
name: dd-sh-source-in-function-scoping
description: dd.sh sources its helper files from inside load_dd_helpers()/load_dd_menu_helpers() — any declare -A/-a at a sourced file's top level must use declare -g or it silently vanishes after the loader returns.
metadata:
  type: project
---

`dd.sh` never sources its `DD_CORE_FILES`/`DD_HELPER_FILES`/`DD_MENU_FILES` at the script's own top level — it sources them via `source_file_with_dos2unix` called from inside the functions `load_dd_helpers()` / `load_dd_menu_helpers()`. In bash, a plain `declare -A`/`declare -a` (no `-g`) executed while inside a function call chain is scoped LOCAL to that enclosing function, even though the `declare` line physically lives in a different, sourced file. The array gets populated correctly by any code that also runs during that same sourcing pass (e.g. registration calls in the same file), then silently disappears the moment the outer loader function returns — code at dd.sh's true top level (e.g. the final `if [ $# -eq 0 ]; then main; else dd_dispatch_arguments "$@"; fi` dispatch) then sees an empty/undeclared array and any lookup against it just falls through as if nothing were registered, with no error.

Found this the hard way in `scripts/shells/linux/dd_helper/main_execution.sh`: `DD_PARAM_HANDLERS`/`DD_PARAM_SUMMARIES`/`DD_PARAM_EXAMPLES`/`DD_PARAM_ORDER` (the D20 `dd.sh help`/`syncgit` dispatch table) were declared without `-g`, so `dd.sh help` silently fell through to the generic "each argument is a shell command" mode and ran bash's builtin `help` instead of printing the parameter table. `bash -n` passes on this kind of bug every time — it is a runtime scoping issue, not a syntax error.

**Why:** any future dd.sh state that must survive past `load_dd_helpers`/`load_dd_menu_helpers` returning (dispatch tables, registries, caches) needs `declare -g`, and the only reliable way to catch a missing `-g` here is to actually invoke `dd.sh` live (see [[wsl-verification-recipe]]) and check the observed behavior, not just `bash -n` or a static trace of the sourced files.

**How to apply:** when adding or reviewing any `declare -A`/`declare -a`/`declare -i` etc. at the top level of a file that dd.sh sources through `DD_CORE_FILES`/`DD_HELPER_FILES`/`DD_MENU_FILES`, use `declare -g` if that state needs to outlive the sourcing call (which it almost always does for anything read outside the file that declared it). When verifying a dd.sh dispatch/argument change, run the real `dd.sh <args>` in WSL Debian (stub `git` on PATH if it must not write) rather than trusting `bash -n` alone.
