#!/usr/bin/env bash
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
LEGACY_NATIVE_CACHE="/var/_core_node/cache"
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
type ensure_shared_dir >/dev/null 2>&1 || source "$SCRIPT_DIR/fs_perm_helpers.sh"
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
    ensure_shared_dir 1777 "$SHARED_ROOT"
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
# privileged retry (fs_perm_run_privileged) only if a direct write is not permitted. Counts copies/skips for the summary.
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
    fs_perm_run_privileged mkdir -p "$d" || true

    if [ "$COPY_TOOL" = "rsync" ]; then
        fs_perm_run_privileged rsync -a --ignore-existing "$s/" "$d/"
        rc=$?
    else
        # cp -an: archive + no-clobber (do not overwrite existing). Copy contents.
        fs_perm_run_privileged cp -an "$s/." "$d/"
        rc=$?
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

# ---- legacy: the NATIVE Linux shared root /var/_core_node/cache -----------------
# When the shared root moved onto the cross-OS NTFS/data web disk (Windows
# D:\www\cache == Linux /www/www/cache, ONE EXTRA LEVEL because /www == D:\
# root), reclaim what an earlier Linux-only run already downloaded into the
# native tree. copy_merge's same-path guard makes this a no-op when the shared
# root IS the native tree (Linux-only machine).
copy_merge "$LEGACY_NATIVE_CACHE" "$SHARED_ROOT"

# ---- shared tree: central ownership policy (root) / own entries readable (user) ----
if [ "$DRY_RUN" -eq 0 ]; then
    if [ "${EUID:-$(id -u)}" -eq 0 ]; then
        repair_owned_tree_777 "$SHARED_ROOT" || true
    else
        chmod -R a+rX "$SHARED_ROOT" 2>/dev/null || true
    fi
fi

# ---- summary ----
echo "------------------------------------------------------"
if [ "$DRY_RUN" -eq 1 ]; then
    echo "[i] DRY-RUN complete: $COPIED_COUNT source(s) would be copy-merged into $SHARED_ROOT."
else
    echo "[i] Done: $COPIED_COUNT source(s) copied, $SKIPPED_COUNT skipped. Shared cache: $SHARED_ROOT"
fi
exit 0
