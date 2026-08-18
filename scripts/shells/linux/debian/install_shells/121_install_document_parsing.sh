#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_document_parsing.sh - Prerequisite installer for the Books / document
# ingest pipeline (Linux/Mac/Debian side).
#
# Invoked sequentially by prepare_pycore_prerequisites.sh (pyservice; scripts never call siblings).
# Sets up the libraries pycore uses to extract
# plain text from arbitrary document formats for the Books "sentence source"
# feature (pycore.callmodule.services.processors.book_processor):
#
#     pdfplumber     -> .pdf          (pip)
#     python-docx    -> .docx         (pip)
#     beautifulsoup4 -> .html/.htm/.epub  (pip; lxml speeds it up)
#     ebooklib       -> .epub         (pip; optional, stdlib zip fallback exists)
#     striprtf       -> .rtf          (pip; optional, regex fallback exists)
#     antiword/catdoc-> .doc (legacy) (apt system binaries; optional)
#
# Python packages come from the central policy and are installed before startup. The
# book processor degrades gracefully when a backend is absent, so this script is
# NON-FATAL: a missing optional package just disables that one format.
#
# IDEMPOTENT: each Python package is skipped when pip metadata exists; each apt
# binary is skipped when already on PATH.
#
# Usage:
#   ./install_document_parsing.sh --python /usr/bin/python3
#   ./install_document_parsing.sh --python python3 --force
# ---------------------------------------------------------------------------
set -uo pipefail

PYTHON="python3"
FORCE=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/../../common"
SUDO=""

source "$COMMON_DIR/pycore_package_policy_install.sh"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) shift ;;   # ignore unknown args (prepare_pycore_prerequisites.sh may pass extras)
    esac
done

echo "============================================================"
echo " Installing document-parsing libraries (Books ingest)"
echo "============================================================"
echo "  python : $PYTHON"

install_pycore_package_policy "$PYTHON" "[document-parsing]" document

# --- legacy .doc (binary Word) via apt system tools (Debian side) --------- #
# No reliable pure-python reader for the old .doc format; antiword/catdoc are the
# standard CLI extractors. Only attempt on Debian/Ubuntu with apt + sudo present.
if command -v apt-get >/dev/null 2>&1; then
    if command -v antiword >/dev/null 2>&1 || command -v catdoc >/dev/null 2>&1; then
        echo "[OK] legacy .doc extractor (antiword/catdoc) already present."
    else
        if [[ "$(id -u)" -ne 0 ]]; then
            command -v sudo >/dev/null 2>&1 && SUDO="sudo"
        fi
        echo "[..] apt-get install antiword (for legacy .doc) ..."
        if $SUDO apt-get install -y antiword >/dev/null 2>&1; then
            echo "[OK] antiword installed."
        else
            echo "[!] antiword install skipped/failed (optional); .doc files will be skipped."
        fi
    fi
else
    echo "[i] apt-get not found; skipping legacy .doc binary (only .doc files are affected)."
fi

# Non-fatal by design: a degraded format set still lets the service run.
echo "[OK] document-parsing prerequisites complete."
