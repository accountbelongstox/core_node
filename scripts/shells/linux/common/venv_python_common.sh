#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###
#
# ============================================================================
# Shared Python-venv resolution for every install script that consumes the
# virtual environment built by 13_ensure_python.sh.
#
# Single source of truth for the venv location: "$COMPILE_DIR/python3_venv",
# where COMPILE_DIR is exported by common/gvar_common.sh (source that FIRST).
#
# Design contract (see 13_ensure_python.sh):
#   - The venv at $COMPILE_DIR/python3_venv is THE project interpreter.
#   - python / python3 / python3.<minor> all resolve to that venv (via
#     /usr/local/bin, which precedes /usr/bin on PATH); the original system
#     interpreter is preserved as 'pythonorigin'.
#   - Downstream scripts must install INTO this venv, never into the system
#     (externally-managed) python, to avoid ~/.local scatter and dpkg/PEP 668
#     collisions on Debian/Ubuntu/Kali.
#
# Source order in a consumer script:
#   source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
#   source "$PARENT_DIR_LEVEL_2/common/venv_python_common.sh"
# ============================================================================

# Declare module-level variables at the beginning.
VENV_PYTHON_COMMON_DIR=""
VENV_DIR="${VENV_DIR:-}"
VENV_PYTHON3="${VENV_PYTHON3:-}"
VENV_PYTHON="${VENV_PYTHON:-}"
VENV_PIP3="${VENV_PIP3:-}"
VENV_PIP="${VENV_PIP:-}"

# Derive the venv paths from COMPILE_DIR (set/exported by gvar_common.sh). Guard
# against an unset COMPILE_DIR so sourcing this file never aborts under `set -u`.
if [ -n "${COMPILE_DIR:-}" ]; then
    VENV_DIR="$COMPILE_DIR/python3_venv"
    VENV_PYTHON3="$VENV_DIR/bin/python3"
    VENV_PYTHON="$VENV_DIR/bin/python"
    VENV_PIP3="$VENV_DIR/bin/pip3"
    VENV_PIP="$VENV_DIR/bin/pip"
fi

# Resolve the interpreter a consumer should use: the venv python if it exists,
# otherwise fall back to whatever python3/python is on PATH (first run, before
# 13_ensure_python.sh has built the venv).
venv_python_from_common() {
    if [ -x "$VENV_PYTHON3" ]; then
        echo "$VENV_PYTHON3"
        return 0
    fi
    if [ -x "$VENV_PYTHON" ]; then
        echo "$VENV_PYTHON"
        return 0
    fi
    command -v python3 2>/dev/null || command -v python 2>/dev/null
}

# True when the given interpreter belongs to a venv (has a pyvenv.cfg one level
# up from its bin/ directory). Used to decide whether PEP 668 escape flags are
# needed (they are required ONLY for an externally-managed system python).
venv_is_venv_from_common() {
    local py="$1"
    [ -n "$py" ] || return 1
    [ -f "$(dirname "$py")/../pyvenv.cfg" ]
}

# Print the exact command-string FIRST (copy-pasteable, for traceability), then
# run it. Use for python / pip / any meaningful command so every invocation is
# logged before it runs. The command line is ALSO printed to STDERR so it stays
# visible even inside a $( ... ) capture (the trace shows on the terminal but
# never pollutes captured stdout).
#   print_and_run_from_common "$VENV_PYTHON3" -m pip install foo
#   ver="$(print_and_run_from_common "$VENV_PYTHON3" -c 'import sys;print(sys.version)')"  # safe
print_and_run_from_common() {
    echo "[run] $*" >&2
    "$@"
}

# Convenience: run the resolved VENV interpreter with the given args, printing
# the command-string first (to stderr, so it is safe inside $( ... ) capture).
#   venv_run_from_common -m pip install foo       # echoes then runs: <venv python> -m pip install foo
#   venv_run_from_common some_script.py --flag
venv_run_from_common() {
    local py
    py="$(venv_python_from_common)"
    echo "[run] $py $*" >&2
    "$py" "$@"
}

# pip-install into the resolved interpreter, printing the command-string first.
# Adds the PEP 668 escape flags (--break-system-packages --no-user) ONLY when the
# target is NOT a venv (i.e. an externally-managed system python); inside a venv
# they are unnecessary and harmful.
#   venv_pip_install_from_common --upgrade faster-whisper
venv_pip_install_from_common() {
    local py
    py="$(venv_python_from_common)"
    local pep668=()
    if ! venv_is_venv_from_common "$py"; then
        pep668=(--break-system-packages --no-user)
    fi
    echo "[run] $py -m pip install ${pep668[*]} $*" >&2
    "$py" -m pip install "${pep668[@]}" "$@"
}
