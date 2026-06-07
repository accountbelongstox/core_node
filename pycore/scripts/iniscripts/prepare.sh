#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prepare.sh - Prerequisite-install orchestrator for the Pycore service
#              (Linux / macOS / Git-Bash / WSL).
#
# This directory (pycore/scripts/iniscripts) holds the shell-managed prerequisite
# installers that run BEFORE pycore_module_caller.py launches. Their job is to set
# up the heavy / awkward third-party packages that are more convenient to install
# from a shell than from Python's import-time auto-installer
# (pycore/pyfoundations/third_party.py). third_party.py still fast-detects and
# installs the lighter packages; these scripts cover the rest (e.g. whisper).
#
# prepare.sh AUTO-DISCOVERS every install_*.sh next to it and runs each one,
# passing the resolved Python path. To add a new prerequisite, drop an
# install_<name>.sh here - no edit to this orchestrator is needed. Each installer
# MUST be idempotent (detect "already installed" and skip).
#
# Usage:
#   ./prepare.sh --python /usr/bin/python3
#   ./prepare.sh --include whisper --whisper-model base
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"

PYTHON="python3"
INCLUDE=()
WHISPER_MODEL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)        PYTHON="$2";        shift 2 ;;
        --include)       INCLUDE+=("$2");     shift 2 ;;
        --whisper-model) WHISPER_MODEL="$2";  shift 2 ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

echo "------------------------------------------------------"
echo " Pycore prerequisites (iniscripts)"
echo "------------------------------------------------------"

# in_include <name> -> 0 if name is selected (or no -include filter given)
in_include() {
    [[ ${#INCLUDE[@]} -eq 0 ]] && return 0
    local n
    for n in "${INCLUDE[@]}"; do [[ "$n" == "$1" ]] && return 0; done
    return 1
}

shopt -s nullglob
installers=("$SCRIPT_DIR"/install_*.sh)
shopt -u nullglob

if [[ ${#installers[@]} -eq 0 ]]; then
    echo "[i] No install_*.sh prerequisite scripts found."
    exit 0
fi

failed=()
for installer in "${installers[@]}"; do
    base="$(basename "$installer" .sh)"   # install_whisper
    name="${base#install_}"               # whisper

    if ! in_include "$name"; then
        echo "[skip] $name (not in --include)"
        continue
    fi

    echo "[..] Prerequisite: $name"

    args=(--python "$PYTHON")
    if [[ "$name" == "whisper" && -n "$WHISPER_MODEL" ]]; then
        args+=(--model "$WHISPER_MODEL")
    fi

    if ! bash "$installer" "${args[@]}"; then
        echo "[!] $name did not complete cleanly."
        failed+=("$name")
    fi
done

if [[ ${#failed[@]} -gt 0 ]]; then
    echo "[!] Some prerequisites did not complete cleanly: ${failed[*]}"
    # Non-fatal: the service can still start; affected features may be degraded.
    exit 0
fi

echo "[OK] All prerequisites complete."
exit 0
