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

# Single source of truth for the edge-tts prerequisite (DEFAULT text-to-speech
# engine for the pycore voice-subtitle pipeline) on Linux/macOS. Prefix 21 sorts
# AFTER 13_ensure_python.sh in install.sh's numeric-ordered run, so pip is ready.
# Also invoked directly by pycore/scripts/iniscripts/install_edge_tts.sh (the
# pyservice prerequisite reference) to keep one copy of the logic.
#
# LATEST VERSION (>= 7.2.4): the NoAudioReceived "fix" of pinning 7.2.1 was a
# 7.2.3 server-outage workaround (issue #443); the real fix shipped in 7.2.4.
# Pinning an OLD version is now harmful — a stale Sec-MS-GEC handshake gets 403
# (issues #290/#458). So install the LATEST, upgrading only when < 7.2.4. A 403
# on the latest is rate-limit / regional blocking — set EDGE_TTS_PROXY.
#
# Invocation contracts:
#   - install.sh flow:  21_install_edge_tts.sh             (no args; resolves python)
#   - pyservice flow:   21_install_edge_tts.sh --python <py> [--force]
set -uo pipefail

# Declare all variables at the beginning
PYTHON="python3"
FORCE=0
MIN_VERSION="7.2.4"
CURRENT_VERSION=""
PIP_ARGS=()

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
    if [[ -n "$preferred" ]] && command -v "$preferred" >/dev/null 2>&1; then
        if "$preferred" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
            command -v "$preferred"; return 0
        fi
    fi
    local name
    for name in python3 python; do
        if command -v "$name" >/dev/null 2>&1; then
            if "$name" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
                command -v "$name"; return 0
            fi
        fi
    done
    return 1
}

# Installed edge_tts version, or empty when not importable.
edge_tts_version() {
    "$PYTHON" -c "import edge_tts,sys; sys.stdout.write(getattr(edge_tts,'__version__',''))" 2>/dev/null
}

echo "============================================================"
echo " Installing edge-tts (text-to-speech, latest >= ${MIN_VERSION})"
echo "============================================================"

# --- 0) resolve python (13_ensure_python.sh has already run in install flow) --- #
if ! PYTHON="$(resolve_python "$PYTHON")"; then
    echo "[X] Python 3 was NOT found. Run 13_ensure_python.sh first, or pass --python <path>." >&2
    exit 1
fi
echo "  python : $PYTHON"

# True if dotted $1 >= dotted $2 (numeric-aware, via sort -V).
ver_ge() {
    [[ "$1" == "$2" ]] && return 0
    [[ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1)" == "$2" ]]
}

# --- 1) edge-tts latest install (idempotent) ----------------------------- #
CURRENT_VERSION="$(edge_tts_version)"
if [[ -n "$CURRENT_VERSION" && "$FORCE" -eq 0 ]] && ver_ge "$CURRENT_VERSION" "$MIN_VERSION"; then
    echo "[OK] edge-tts ${CURRENT_VERSION} is current (>= ${MIN_VERSION}); skipping pip."
    exit 0
fi

if [[ -n "$CURRENT_VERSION" ]]; then
    echo "[!] edge-tts ${CURRENT_VERSION} is too old (< ${MIN_VERSION}); upgrading to latest (old versions 403 on a stale handshake)."
fi
echo "[..] pip install --upgrade edge-tts ..."
PIP_ARGS=(--upgrade edge-tts)
[[ "$FORCE" -eq 1 ]] && PIP_ARGS+=(--force-reinstall)
if [[ "$(uname -s)" != "Darwin" ]]; then PIP_ARGS=(--break-system-packages "${PIP_ARGS[@]}"); fi
if ! "$PYTHON" -m pip install "${PIP_ARGS[@]}"; then
    if ! "$PYTHON" -m pip install --upgrade edge-tts; then
        echo "[!] edge-tts install did not complete cleanly; pycore will install it at import time."
        exit 0
    fi
fi

CURRENT_VERSION="$(edge_tts_version)"
echo "[OK] edge-tts ${CURRENT_VERSION} installed."

exit 0
