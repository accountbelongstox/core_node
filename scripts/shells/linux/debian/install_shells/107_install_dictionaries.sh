#!/bin/bash
# Offline word-dictionary prerequisite (Linux) — auto-run by prepare_pycore_prerequisites.sh
# (pyservice), which passes the resolved Python path. Provides the FREE, offline
# word-translation data the pycore translator uses ALONGSIDE Google:
#
#   ECDICT  : skywind3000/ECDICT SQLite (stardict.db, 770k+ EN<->ZH entries with
#             translation/phonetic/definition/frequency/exam tags). Placed at
#             <pycore_db>/dictionaries/stardict.db — exactly where
#             pycore.pyutils.translator.dictionary looks.
#   WordNet : NLTK corpus (wordnet + omw-1.4) for English glosses/synonyms.
#
# Idempotent + resumable: skips a step whose data is already present (unless
# --force). Never fails the sweep fatally — a download hiccup leaves pycore on
# Google-only translation (the dictionary degrades gracefully).
#
# Invocation (prepare_pycore_prerequisites.sh):  install_dictionaries.sh --python <py> [--force]
# Env overrides: ECDICT_SQLITE_URL (mirror), ECDICT_DB_PATH (final db path).
set -uo pipefail

PYTHON="python3"
FORCE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1; shift ;;
        *) shift ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Resolve the repo root (for PYTHONPATH) and the pycore_db path --------------
REPO_ROOT="$SCRIPT_DIR"
while [[ "$REPO_ROOT" != "/" && ! -d "$REPO_ROOT/pycore" ]]; do
    REPO_ROOT="$(dirname "$REPO_ROOT")"
done
if [[ -d "$REPO_ROOT/pycore" ]]; then
    export PYTHONPATH="$REPO_ROOT${PYTHONPATH:+:$PYTHONPATH}"
fi

# Final DB path: env override wins, else the same map_web_path('pycore_db') the
# dictionary module reads, else a sane fallback under the repo's www tree.
DB_PATH="${ECDICT_DB_PATH:-}"
if [[ -z "$DB_PATH" ]]; then
    PYCORE_DB="$("$PYTHON" -c "from pycore.pyfoundations.system_paths import map_web_path; print(map_web_path('pycore_db'))" 2>/dev/null || true)"
    if [[ -z "$PYCORE_DB" ]]; then
        PYCORE_DB="$REPO_ROOT/www/wwwroot/pycore_db"
    fi
    DB_PATH="$PYCORE_DB/dictionaries/stardict.db"
fi
DICT_DIR="$(dirname "$DB_PATH")"

# skywind3000/ECDICT prebuilt SQLite release (the stardict.db).
ECDICT_URL="${ECDICT_SQLITE_URL:-https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip}"
ARCHIVE="$DICT_DIR/ecdict-sqlite.zip"

echo "[dictionaries] target db: $DB_PATH"
mkdir -p "$DICT_DIR"

# --- helper: verify the db has the stardict table --------------------------------
verify_db() {
    "$PYTHON" - "$1" <<'PY' 2>/dev/null
import sqlite3, sys
try:
    c = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
    n = c.execute("SELECT COUNT(*) FROM stardict").fetchone()[0]
    c.close()
    sys.exit(0 if n > 1000 else 1)
except Exception:
    sys.exit(1)
PY
}

# --- ECDICT --------------------------------------------------------------------
if [[ "$FORCE" -eq 0 ]] && verify_db "$DB_PATH"; then
    echo "[dictionaries] ECDICT already installed (skip; --force to re-download)"
else
    echo "[dictionaries] downloading ECDICT SQLite from: $ECDICT_URL"
    rm -f "$ARCHIVE"
    if command -v curl >/dev/null 2>&1; then
        curl -fL --retry 3 -C - -o "$ARCHIVE" "$ECDICT_URL" || curl -fL -o "$ARCHIVE" "$ECDICT_URL" || true
    elif command -v wget >/dev/null 2>&1; then
        wget -c -O "$ARCHIVE" "$ECDICT_URL" || true
    else
        echo "[dictionaries] ERROR: neither curl nor wget available"
    fi

    if [[ -f "$ARCHIVE" ]]; then
        echo "[dictionaries] extracting…"
        TMP_EXTRACT="$DICT_DIR/.ecdict_extract"
        rm -rf "$TMP_EXTRACT"; mkdir -p "$TMP_EXTRACT"
        if command -v unzip >/dev/null 2>&1; then
            unzip -o -q "$ARCHIVE" -d "$TMP_EXTRACT" || true
        else
            "$PYTHON" -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$ARCHIVE" "$TMP_EXTRACT" || true
        fi
        # Move the first *.db found to the final path.
        FOUND_DB="$(find "$TMP_EXTRACT" -name '*.db' -type f | head -1)"
        if [[ -n "$FOUND_DB" ]]; then
            mv -f "$FOUND_DB" "$DB_PATH"
        fi
        rm -rf "$TMP_EXTRACT" "$ARCHIVE"
    fi

    if verify_db "$DB_PATH"; then
        echo "[dictionaries] ECDICT installed OK -> $DB_PATH"
    else
        echo "[dictionaries] WARN: ECDICT db missing/invalid — pycore will use Google-only word translation."
        echo "[dictionaries]       set ECDICT_SQLITE_URL to a reachable mirror and re-run with --force."
    fi
fi

# --- WordNet (NLTK corpus) ------------------------------------------------------
# nltk.downloader is idempotent (skips already-present packages). The 'nltk'
# package itself is ensured by pyfoundations/third_party.py at worker import.
if "$PYTHON" -c "import nltk" >/dev/null 2>&1; then
    echo "[dictionaries] ensuring WordNet corpus (wordnet + omw-1.4)…"
    "$PYTHON" -m nltk.downloader wordnet omw-1.4 >/dev/null 2>&1 \
        && echo "[dictionaries] WordNet corpus ready" \
        || echo "[dictionaries] WARN: WordNet download failed (English defs/synonyms disabled; ECDICT still works)."
else
    echo "[dictionaries] nltk not importable yet — WordNet skipped (third_party will install nltk on first worker import)."
fi

echo "[dictionaries] done."
exit 0
