#!/usr/bin/env bash
# setuptools_guard.sh -- restore pkg_resources when setuptools>=81 removed it.
# The ONE shell-side source of truth (mirrored by setuptools_guard.ps1).
#
# setuptools 81 dropped the bundled `pkg_resources`. Legacy packages still import it
# at load time (e.g. librosa 0.9.1 via MeloTTS does
# `from pkg_resources import resource_filename`) -> ModuleNotFoundError. setuptools>=81
# also violates torch (needs setuptools<82) and faradaysec (needs setuptools<81,>=61).
# Pin setuptools<81 (last line that ships pkg_resources, resolves to 80.10.2) to fix all
# three; it is the remedy the deprecation warning itself recommends ("pin to Setuptools<81").
#
# Idempotent: only pins when pkg_resources is actually missing (healthy env = no-op).
# Usage:  . setuptools_guard.sh ; ensure_pkg_resources "$PYTHON"
ensure_pkg_resources() {
    local py="${1:-python3}"
    if "$py" -c "import pkg_resources" >/dev/null 2>&1; then return 0; fi
    echo "[setuptools-guard] pkg_resources missing (setuptools>=81 removed it) -> pinning setuptools<81 ..."
    "$py" -m pip install --break-system-packages --upgrade 'setuptools<81' 2>/dev/null \
        || "$py" -m pip install --upgrade 'setuptools<81' || true
    if "$py" -c "import pkg_resources" >/dev/null 2>&1; then
        echo "[setuptools-guard] [OK] pkg_resources restored (setuptools<81)."
        return 0
    fi
    echo "[setuptools-guard] [!] pkg_resources still unavailable after pinning setuptools<81."
    return 1
}
