#!/usr/bin/env bash
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
# scan_shared_cache.sh - reclaim already-downloaded models into the ONE shared cache.
#
# Models, HuggingFace hubs, torch / whisper weights and pip wheels are heavy and slow
# to download. When the shared cache (CORE_NODE_CACHE_DIR, default /var/_core_node/cache,
# wired by shared_cache_env.sh) was switched on AFTER some user already downloaded into
# their per-user location (~/.core_node/cache, ~/.cache/huggingface, ~/.cache/whisper,
# ~/.cache/torch, ~/.cache/pip - for any home, including /root), those artifacts would be
# re-downloaded into the shared tree. This script finds every such per-user artifact and
# COPY-MERGES it (non-destructively) into the matching shared subdir so it is reused.
#
# It is IDEMPOTENT and NON-DESTRUCTIVE: it only COPIES (never moves/deletes the per-user
# originals), never overwrites a newer/identical file in the shared tree (rsync
# --ignore-existing, or cp -an), and re-running it is safe. After copying it makes the
# shared tree world-readable (chmod -R a+rX) so every user benefits. Use --dry-run to
# print what WOULD be copied without writing anything.
#
# Usage:
#   ./scan_shared_cache.sh            # copy-merge per-user caches into the shared tree
#   ./scan_shared_cache.sh --dry-run  # only print what would be copied

set -uo pipefail

# ---- variable declarations (rule 5) ----
DRY_RUN=0
SCRIPT_DIR=""
SHARED_CACHE_ENV=""
CORE_NODE_CACHE_DIR="${CORE_NODE_CACHE_DIR:-}"
SHARED_ROOT=""
COPIED_COUNT=0
SKIPPED_COUNT=0
COPY_TOOL=""
home_dir=""
src=""
dest=""
__d=""
arg=""

# ---- parse args ----
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            echo "Usage: $0 [--dry-run]"
            echo "  Copy-merge per-user model/cache artifacts into the shared cache tree."
            exit 0
            ;;
        *) echo "[!] Unknown argument: $arg" >&2 ;;
    esac
done

# ---- resolve the shared cache root (prefer the backbone helper) ----
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
SHARED_CACHE_ENV="$SCRIPT_DIR/shared_cache_env.sh"
if [ -z "$CORE_NODE_CACHE_DIR" ] && [ -f "$SHARED_CACHE_ENV" ]; then
    # shellcheck disable=SC1090
    source "$SHARED_CACHE_ENV"
fi
SHARED_ROOT="${CORE_NODE_CACHE_DIR:-/var/_core_node/cache}"

echo "[i] Shared cache root: $SHARED_ROOT"
[ "$DRY_RUN" -eq 1 ] && echo "[i] DRY-RUN: no files will be written."

# ---- ensure the shared root exists 1777 (best-effort; skip writes on dry-run) ----
if [ "$DRY_RUN" -eq 0 ]; then
    if [ ! -d "$SHARED_ROOT" ]; then
        mkdir -p "$SHARED_ROOT" 2>/dev/null \
            || { command -v sudo >/dev/null 2>&1 && sudo -n mkdir -p "$SHARED_ROOT" 2>/dev/null; } || true
    fi
    chmod 1777 "$SHARED_ROOT" 2>/dev/null \
        || { command -v sudo >/dev/null 2>&1 && sudo -n chmod 1777 "$SHARED_ROOT" 2>/dev/null; } || true
fi

# ---- choose the copy tool: rsync --ignore-existing, else cp -an ----
if command -v rsync >/dev/null 2>&1; then
    COPY_TOOL="rsync"
else
    COPY_TOOL="cp"
fi
echo "[i] Copy tool: $COPY_TOOL (non-destructive, never overwrites existing)"

# copy_merge <source_dir> <dest_dir>
# Copy-merge contents of source into dest WITHOUT overwriting existing files. Uses
# sudo -n only if a direct write is not permitted. Counts copies/skips for the summary.
copy_merge() {
    local s="$1" d="$2" rc=0
    [ -d "$s" ] || return 0
    # Skip when source and dest resolve to the same path (e.g. /root home == shared).
    if [ "$(readlink -f "$s" 2>/dev/null || echo "$s")" = "$(readlink -f "$d" 2>/dev/null || echo "$d")" ]; then
        return 0
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
        echo "[dry] would copy-merge: $s  ->  $d"
        COPIED_COUNT=$((COPIED_COUNT + 1))
        return 0
    fi

    # Make sure the destination parent exists.
    mkdir -p "$d" 2>/dev/null \
        || { command -v sudo >/dev/null 2>&1 && sudo -n mkdir -p "$d" 2>/dev/null; } || true

    if [ "$COPY_TOOL" = "rsync" ]; then
        rsync -a --ignore-existing "$s/" "$d/" 2>/dev/null
        rc=$?
        if [ "$rc" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
            sudo -n rsync -a --ignore-existing "$s/" "$d/" 2>/dev/null
            rc=$?
        fi
    else
        # cp -an: archive + no-clobber (do not overwrite existing). Copy contents.
        cp -an "$s/." "$d/" 2>/dev/null
        rc=$?
        if [ "$rc" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
            sudo -n cp -an "$s/." "$d/" 2>/dev/null
            rc=$?
        fi
    fi

    if [ "$rc" -eq 0 ]; then
        echo "[ok]  copied: $s  ->  $d"
        COPIED_COUNT=$((COPIED_COUNT + 1))
    else
        echo "[skip] could not copy (permission?): $s  ->  $d"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
}

# ---- enumerate source homes: /root plus every /home/* (covers any installing user) ----
for home_dir in /root /home/*; do
    [ -d "$home_dir" ] || continue

    # .core_node/cache/* -> $SHARED_ROOT/* (preserve the per-engine subtree layout).
    src="$home_dir/.core_node/cache"
    if [ -d "$src" ]; then
        copy_merge "$src" "$SHARED_ROOT"
    fi

    # HuggingFace hub -> $SHARED_ROOT/huggingface
    copy_merge "$home_dir/.cache/huggingface" "$SHARED_ROOT/huggingface"

    # openai-whisper weights -> $SHARED_ROOT/xdg/whisper (XDG_CACHE_HOME=.../xdg)
    copy_merge "$home_dir/.cache/whisper" "$SHARED_ROOT/xdg/whisper"

    # torch hub weights -> $SHARED_ROOT/torch
    copy_merge "$home_dir/.cache/torch" "$SHARED_ROOT/torch"

    # pip wheel cache -> $SHARED_ROOT/pip
    copy_merge "$home_dir/.cache/pip" "$SHARED_ROOT/pip"
done

# ---- legacy: the caller's own $HOME/.core_node/cache (covers non-/home homes) ----
if [ -n "${HOME:-}" ] && [ -d "$HOME/.core_node/cache" ]; then
    copy_merge "$HOME/.core_node/cache" "$SHARED_ROOT"
fi

# ---- make the shared tree readable by all users ----
if [ "$DRY_RUN" -eq 0 ]; then
    chmod -R a+rX "$SHARED_ROOT" 2>/dev/null \
        || { command -v sudo >/dev/null 2>&1 && sudo -n chmod -R a+rX "$SHARED_ROOT" 2>/dev/null; } || true
fi

# ---- summary ----
echo "------------------------------------------------------"
if [ "$DRY_RUN" -eq 1 ]; then
    echo "[i] DRY-RUN complete: $COPIED_COUNT source(s) would be copy-merged into $SHARED_ROOT."
else
    echo "[i] Done: $COPIED_COUNT source(s) copied, $SKIPPED_COUNT skipped. Shared cache: $SHARED_ROOT"
fi
exit 0
