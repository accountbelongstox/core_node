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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables (COMPILE_DIR) then the shared venv resolver, so package
# installs land in the project venv ("$COMPILE_DIR/python3_venv") built by
# 13_ensure_python.sh instead of the externally-managed system python.
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/venv_python_common.sh"

# Single source of truth for the edge-tts prerequisite (DEFAULT text-to-speech
# engine for the pycore voice-subtitle pipeline) on Linux/macOS. Prefix 21 sorts
# AFTER 13_ensure_python.sh in install.sh's numeric-ordered run, so pip is ready.
# Also invoked by prepare_pycore_prerequisites.sh (pyservice).
# pyservice prerequisite reference) to keep one copy of the logic.
#
# Invocation contracts:
#   - install.sh flow:  22_install_edge_tts.sh             (no args; resolves python)
#   - pyservice flow:   22_install_edge_tts.sh --python <py> [--force]
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"

# Serialize pip into the shared venv.
PIPLOCK_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"

# Declare all variables at the beginning
# Default to the shared project venv interpreter (13_ensure_python.sh); --python
# overrides it for the pyservice flow. venv_python_from_common falls back to
# /usr/local/bin/python then system python3 when the venv is not yet built.
PYTHON="$(venv_python_from_common)"
RESOLVED_PYTHON=""
FORCE=0
EDGE_TTS_METADATA=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# Resolve a real Python 3 interpreter (prefer the one passed in, else PATH).
resolve_python() {
    local preferred="$1"
    local name=""
    local resolved=""
    if [[ -n "$preferred" ]] && command -v "$preferred" >/dev/null 2>&1; then
        resolved="$(command -v "$preferred")"
    else
        for name in python3 python; do
            if [[ -z "$resolved" ]] && command -v "$name" >/dev/null 2>&1; then
                resolved="$(command -v "$name")"
            fi
        done
    fi
    printf '%s' "$resolved"
}

echo "============================================================"
echo " Installing edge-tts (text-to-speech)"
echo "============================================================"

# --- 0) resolve python (13_ensure_python.sh has already run in install flow) --- #
RESOLVED_PYTHON="$(resolve_python "$PYTHON")"
if [[ -z "$RESOLVED_PYTHON" ]]; then
    echo "[X] Python 3 was NOT found. Run 13_ensure_python.sh first, or pass --python <path>." >&2
else
    PYTHON="$RESOLVED_PYTHON"
    echo "  python : $PYTHON"

    # --- 1) edge-tts install (pip metadata idempotency) ------------------ #
    EDGE_TTS_METADATA="$("$PYTHON" -m pip show edge-tts 2>/dev/null || true)"
    if [[ "$EDGE_TTS_METADATA" == *"Name:"* ]]; then
        echo "[OK] edge-tts metadata is present; preserving the installed package."
    else
        echo "[..] pip install edge-tts ..."
        vpip "$PYTHON" -m pip install edge-tts || true
        EDGE_TTS_METADATA="$("$PYTHON" -m pip show edge-tts 2>/dev/null || true)"
        if [[ "$EDGE_TTS_METADATA" == *"Name:"* ]]; then
            echo "[OK] edge-tts installed."
        else
            echo "[!] edge-tts metadata is still missing; retrying next run."
        fi
    fi
fi
