#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_document_parsing.sh - Prerequisite installer for the Books / document
# ingest pipeline (Linux/Mac/Debian side).
#
# Auto-discovered & run by prepare.sh (it runs every install_*.sh next to it,
# passing --python <interpreter>). Sets up the libraries pycore uses to extract
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
# Python libs are also auto-installable lazily via third_party.py, but installing
# them explicitly here means the FIRST analyze/sync does not stall on pip. The
# book processor degrades gracefully when a backend is absent, so this script is
# NON-FATAL: a missing optional package just disables that one format.
#
# IDEMPOTENT: each python package is skipped when it already imports; each apt
# binary is skipped when already on PATH.
#
# Usage:
#   ./install_document_parsing.sh --python /usr/bin/python3
#   ./install_document_parsing.sh --python python3 --force
# ---------------------------------------------------------------------------
set -uo pipefail

PYTHON="python3"
FORCE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) shift ;;   # ignore unknown args (prepare.sh may pass extras)
    esac
done

py_has_module() {
    "$PYTHON" -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$1') else 1)" 2>/dev/null
}

pip_install() {
    # Tolerant pip install: PEP 668 externally-managed envs need
    # --break-system-packages; fall back to a plain install otherwise.
    "$PYTHON" -m pip install --break-system-packages "$@" 2>/dev/null \
        || "$PYTHON" -m pip install "$@"
}

# import_name : pip_package  (import name may differ from the PyPI name)
PY_PACKAGES=(
    "pdfplumber:pdfplumber"
    "docx:python-docx"
    "bs4:beautifulsoup4"
    "lxml:lxml"
    "ebooklib:ebooklib"
    "striprtf:striprtf"
    "multipart:python-multipart"
)

echo "============================================================"
echo " Installing document-parsing libraries (Books ingest)"
echo "============================================================"
echo "  python : $PYTHON"

for pair in "${PY_PACKAGES[@]}"; do
    mod="${pair%%:*}"
    pkg="${pair##*:}"
    if py_has_module "$mod" && [[ "$FORCE" -eq 0 ]]; then
        echo "[OK] $pkg already installed; skipping."
        continue
    fi
    echo "[..] pip install $pkg ..."
    if pip_install "$pkg" && py_has_module "$mod"; then
        echo "[OK] $pkg installed."
    else
        echo "[!] $pkg install failed (optional); that format degrades to a fallback."
    fi
done

# --- legacy .doc (binary Word) via apt system tools (Debian side) --------- #
# No reliable pure-python reader for the old .doc format; antiword/catdoc are the
# standard CLI extractors. Only attempt on Debian/Ubuntu with apt + sudo present.
if command -v apt-get >/dev/null 2>&1; then
    if command -v antiword >/dev/null 2>&1 || command -v catdoc >/dev/null 2>&1; then
        echo "[OK] legacy .doc extractor (antiword/catdoc) already present."
    else
        SUDO=""
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
exit 0
