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
# virtual environment built by 13_install_default_python.sh.
#
# Single source of truth for the venv location: "$COMPILE_DIR/python3_venv",
# where COMPILE_DIR is exported by common/gvar_common.sh (source that FIRST).
#
# Design contract (see 13_install_default_python.sh):
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


# Resolve the interpreter a consumer should use: the venv python if it exists,
# otherwise fall back to whatever python3/python is on PATH (first run, before
# 13_install_default_python.sh has built the venv).
venv_python_from_common() {
    if [ -x "$VENV_PYTHON3" ]; then
        echo "$VENV_PYTHON3"
        return 0
    fi
    if [ -x "$VENV_PYTHON" ]; then
        echo "$VENV_PYTHON"
        return 0
    fi
    # PATH fallback: /usr/local/bin/python3 may be a SYMLINK into the project
    # venv. Invoking the symlink does not activate the venv, but resolving ALL
    # hops (readlink -f) jumps past it (venv bin/python3 -> base interpreter).
    # Walk one hop at a time and return the FIRST path that carries pyvenv.cfg.
    local py_fallback=""
    local py_dir=""
    local guard=0
    py_fallback="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"
    if [ -z "$py_fallback" ]; then
        return 0
    fi
    local py_walk="$py_fallback"
    while [ $guard -lt 10 ] && [ -L "$py_walk" ]; do
        guard=$((guard + 1))
        py_dir="$(dirname "$py_walk")"
        py_walk="$(readlink "$py_walk")"
        case "$py_walk" in
            /*) ;;
            *) py_walk="$py_dir/$py_walk" ;;
        esac
        if [ -f "$(dirname "$py_walk")/../pyvenv.cfg" ]; then
            echo "$py_walk"
            return 0
        fi
    done
    echo "$py_fallback"
}

# True when the given interpreter belongs to a venv (has a pyvenv.cfg one level
# up from its bin/ directory). Symlinks are resolved ONE HOP AT A TIME, stopping
# at the first location that carries pyvenv.cfg: /usr/local/bin/python3 may link
# into the project venv (whose bin/python3 itself links to the base interpreter),
# and full `readlink -f` would jump PAST the venv to the system python. Used to
# decide whether PEP 668 escape flags are needed (required ONLY for an
# externally-managed system python).
venv_is_venv_from_common() {
    local py="$1"
    local py_dir=""
    local guard=0
    [ -n "$py" ] || return 1
    while [ $guard -lt 10 ]; do
        guard=$((guard + 1))
        py_dir="$(dirname "$py")"
        if [ -f "$py_dir/../pyvenv.cfg" ]; then
            return 0
        fi
        if [ -L "$py" ]; then
            py="$(readlink "$py")"
            case "$py" in
                /*) ;;
                *) py="$py_dir/$py" ;;
            esac
        else
            break
        fi
    done
    return 1
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

# SINGLE SOURCE OF TRUTH for the runtime Python environment (where pip installs land and
# which site the worker imports from). Every entry point that launches or installs for the
# pycore worker - pyservice.sh, iniscripts/prepare.sh, the 150/152 installers - MUST call
# this with the resolved interpreter so they all produce an IDENTICAL environment; a
# divergence here is what let a stale /usr/local torch shadow the worker's real install.
#
#   VENV interpreter -> PIP_USER=0 only. A venv is self-contained: pip targets the venv
#                       itself, never a user site. Do NOT export PYTHONUSERBASE for a venv -
#                       that redirects the venv's user-site to an empty shared dir and makes
#                       `import torch` fall through to /usr/local (the re-download-loop bug);
#                       and PIP_USER=1 here makes pip refuse to UPGRADE a venv-resident
#                       package ("lacks sys.path precedence").
#   NON-venv (system) -> the all-users shared base PYCORE_PYUSERBASE (default
#                       /opt/_core_node/pyuserbase, a SYSTEM path NOT under the repo, created
#                       1777 sticky+world-writable) + PIP_USER=1 + PIP_BREAK_SYSTEM_PACKAGES=1,
#                       so any user's installs are visible to the service.
# Pass the interpreter explicitly: pycore_export_python_env_from_common "$PY"
pycore_export_python_env_from_common() {
    local py="${1:-}"
    [ -n "$py" ] || py="$(venv_python_from_common)"
    if venv_is_venv_from_common "$py"; then
        export PIP_USER=0
        # Clear any non-venv leftovers from an earlier classification in the same
        # process: PYTHONUSERBASE would redirect the venv's user-site, and
        # PIP_BREAK_SYSTEM_PACKAGES is meaningless (and noisy) inside a venv.
        unset PYTHONUSERBASE PIP_BREAK_SYSTEM_PACKAGES
        return 0
    fi
    [ "$(uname -s)" = "Linux" ] || return 0
    : "${PYCORE_PYUSERBASE:=/opt/_core_node/pyuserbase}"
    umask 0000
    mkdir -p "$PYCORE_PYUSERBASE" 2>/dev/null || true
    if [ ! -w "$PYCORE_PYUSERBASE" ] && command -v sudo >/dev/null 2>&1; then
        sudo -n mkdir -p "$PYCORE_PYUSERBASE" 2>/dev/null || true
        sudo -n chmod 1777 "$PYCORE_PYUSERBASE" 2>/dev/null || true
    fi
    if [ -w "$PYCORE_PYUSERBASE" ]; then
        chmod 1777 "$PYCORE_PYUSERBASE" 2>/dev/null || true
        export PYCORE_PYUSERBASE
        export PYTHONUSERBASE="$PYCORE_PYUSERBASE"
        export PIP_USER=1
        export PIP_BREAK_SYSTEM_PACKAGES=1
    fi
    return 0
}
