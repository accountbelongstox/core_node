#!/usr/bin/env bash
#
# shared_cache_env.sh - export the ONE shared, all-users cache location.
#
# Sourced by gvar_common.sh (every numbered install_shells/<NN>_*.sh), by the Pycore
# prerequisite orchestrator prepare.sh (every install_*.sh iniscript) and by pyservice.sh
# (the running service) so that EVERY model / pip / torch / HuggingFace download - no
# matter WHICH user runs the install - lands in ONE shared tree that is readable by all
# regular users, instead of the installing user's home (~/.cache, ~/.core_node, and the
# /root/.core_node seen when installing as root).
#
# Cross-OS (Windows <-> Linux dual-boot): when the web data disk ROOT is mounted
# at /www (NTFS), /www == D:\ and the shared cache is /www/www/cache -- the SAME
# tree Windows uses (D:\www\cache, ONE EXTRA LEVEL on Linux) -- so both OSes
# reuse one copy of every model. Otherwise the native shared root is the legacy
# /var/_core_node (pinned there ON PURPOSE so pyservice model paths never move);
# cache under /var/_core_node/cache, created 1777 (sticky + world-writable, like
# /tmp) so any user can read/write it. IDEMPOTENT and best-effort: it never fails
# the caller, and it respects any value the caller already exported (so an
# explicit override still wins). On a locked-down host where the shared tree
# cannot be made writable it leaves the caller's per-user defaults untouched.

# ---- variable declarations (rule 5) ----
SHARED_CACHE_DATA_ROOT=""
SHARED_CACHE_DIR=""
SHARED_CACHE_CROSS_OS=false
SHARED_WWW_BASE=""
SHARED_WWW_PATH_VAR=""
SHARED_CACHE_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_CACHE_RUNTIME_ENV="$SHARED_CACHE_ENV_DIR/runtime_environment.sh"
__scc_d=""
__scc_candidate=""
CN_TREE_MNT=""
CN_TREE_BACKING=""
CN_TREE_CACHE_ROOT=""
BUN_INSTALL_CACHE_DIR=""
npm_config_cache=""
UV_CACHE_DIR=""
COMPOSER_CACHE_DIR=""
COREPACK_HOME=""
__scc_sc_common=""
__scc_tree_fstype=""

if [ -z "${IS_HEADLESS_SERVER+x}" ] || [ -z "${CORE_NODE_DATA_DIR:-}" ] || [ -z "${CORE_NODE_WWW_BASE:-}" ]; then
    source "$SHARED_CACHE_RUNTIME_ENV"
fi

# ---- dual-boot tree root + toolchain caches (contract paths.drive_layout) --
# CN_TREE_MNT / CN_TREE_BACKING are the ONE definition of the project tree
# root for every Linux consumer: this file loads earliest in both call paths
# (gvar_common.sh, via gvar_system_common.sh; and pyservice_entry.sh, which
# sources it directly), so gvar_common.sh and mount_common.sh simply reuse
# these exported values instead of re-deriving them. The cache root resolves
# to CN_TREE_MNT/cache ONLY when CN_TREE_MNT is itself a mounted ext4
# filesystem (the bind mount_common.sh's ensure_tree_root_bind_mount sets up
# under the /www NTFS share); otherwise CN_TREE_BACKING/cache -- the ext4
# backing store under /opt -- is used directly, NEVER the NTFS share itself.
#
# Toolchain install-family caches (bun, npm, uv, composer, corepack) are
# pinned under that ext4 cache root so they never hard-link a cache tree onto
# NTFS (the D: dirty-volume root cause in
# docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md section 2). These
# explicit vars OUTRANK each tool's own XDG_CACHE_HOME-derived default;
# XDG_CACHE_HOME itself is intentionally left UNCHANGED here (Whisper/model
# data still keys off it -- decoupling that is a pycore follow-up, not this
# file's job). The pnpm store location is intentionally NOT touched here: it
# already lives on ext4 inside the Node tree, and moving it would break
# existing installs (ERR_PNPM_UNEXPECTED_STORE); P3 (wrap-type toolchains)
# revisits it.
if ! command -v sc_get >/dev/null 2>&1; then
    __scc_sc_common="$SHARED_CACHE_ENV_DIR/service_contract_common.sh"
    [ -f "$__scc_sc_common" ] && source "$__scc_sc_common"
fi
if command -v sc_get >/dev/null 2>&1; then
    CN_TREE_MNT="$(sc_get paths.drive_layout.tree_root.linux)"
    CN_TREE_BACKING="$(sc_get paths.drive_layout.tree_root.linux_backing)"
fi
if [ -z "$CN_TREE_MNT" ] || [ -z "$CN_TREE_BACKING" ]; then
    echo "[shared-cache-env] Service contract unreadable for paths.drive_layout.tree_root (no node/php yet?); toolchain cache roots stay at their per-tool defaults." >&2
else
    if [ -d "$CN_TREE_MNT" ] && command -v findmnt >/dev/null 2>&1; then
        __scc_tree_fstype="$(findmnt -no FSTYPE -M "$CN_TREE_MNT" 2>/dev/null)"
    fi
    case "$__scc_tree_fstype" in
        ext2|ext3|ext4) CN_TREE_CACHE_ROOT="$CN_TREE_MNT/cache" ;;
        *)              CN_TREE_CACHE_ROOT="$CN_TREE_BACKING/cache" ;;
    esac

    for __scc_d in "$CN_TREE_CACHE_ROOT" "$CN_TREE_CACHE_ROOT/bun" "$CN_TREE_CACHE_ROOT/npm" \
                   "$CN_TREE_CACHE_ROOT/uv" "$CN_TREE_CACHE_ROOT/composer" "$CN_TREE_CACHE_ROOT/corepack"; do
        [ -d "$__scc_d" ] && continue
        mkdir -p "$__scc_d" 2>/dev/null \
            || { command -v sudo >/dev/null 2>&1 && sudo -n mkdir -p "$__scc_d" 2>/dev/null; } || true
    done

    : "${BUN_INSTALL_CACHE_DIR:=$CN_TREE_CACHE_ROOT/bun}";   export BUN_INSTALL_CACHE_DIR
    : "${npm_config_cache:=$CN_TREE_CACHE_ROOT/npm}";        export npm_config_cache
    : "${UV_CACHE_DIR:=$CN_TREE_CACHE_ROOT/uv}";             export UV_CACHE_DIR
    : "${COMPOSER_CACHE_DIR:=$CN_TREE_CACHE_ROOT/composer}"; export COMPOSER_CACHE_DIR
    : "${COREPACK_HOME:=$CN_TREE_CACHE_ROOT/corepack}";      export COREPACK_HOME
fi
export CN_TREE_MNT
export CN_TREE_BACKING
export CN_TREE_CACHE_ROOT
unset __scc_sc_common __scc_tree_fstype

# Native shared MODEL-cache root. Pinned to the legacy native base
# /var/_core_node ON PURPOSE: the unified runtime data root moved to
# <www>/core_node (runtime_environment.sh CORE_NODE_DATA_DIR), but the model
# cache must NOT move with it -- pyservice model paths stay valid and no
# multi-GB re-download happens. Cache created 1777 (sticky + world-writable,
# like /tmp) so any user can read/write it.
SHARED_CACHE_DATA_ROOT="${LEGACY_CORE_NODE_DATA_DIR:-/var/_core_node}"
SHARED_CACHE_DIR="$SHARED_CACHE_DATA_ROOT/cache"
SHARED_CACHE_CROSS_OS=false

# --- Cross-OS shared model cache (Windows <-> Linux dual-boot) --------------
# When the web data disk's ROOT is mounted at /www (NTFS dual-boot disk, bound
# by 3_setting_base.sh), /www == Windows D:\ and the SAME logical tree gains
# ONE EXTRA LEVEL on Linux:  Windows D:\www\cache  ==  Linux /www/www/cache.
# Windows already downloads every model into D:\www\cache (SharedCacheEnv.ps1),
# so pointing the Linux cache at the SAME tree lets both OSes share ONE copy of
# every model (HF hub, whisper, vosk, sherpa/kokoro, pycore staging, pip) --
# no duplicate 100GB+ downloads when the same machine switches OS. Model
# weights are device-agnostic: the same tree serves GPU (CUDA) and CPU runs on
# unchanged hardware; only framework wheels differ and those live in venvs,
# never in this cache. HF hub snapshot symlinks are relative, so the
# Windows-created tree resolves correctly under Linux ntfs3.
# When /www is NOT an NTFS/data disk root (Linux-only machine), the native
# /var/_core_node/cache below is used instead.
# The persisted WWW_PATH var-center value (single central variable, written by
# 3_setting_base.sh) is the primary signal; the single-definition
# CORE_NODE_WWW_BASE from runtime_environment.sh is the fallback for a fresh
# machine whose var center is not initialized yet.
SHARED_WWW_BASE=""
# Var center moved to $CORE_NODE_DATA_DIR/global_var; the legacy
# /var/_core_node/global_var remains as read-fallback for pre-migration installs.
SHARED_WWW_PATH_VAR="$(head -n1 "$CORE_NODE_DATA_DIR/global_var/WWW_PATH" 2>/dev/null | tr -d '\r')"
if [ -z "$SHARED_WWW_PATH_VAR" ]; then
    SHARED_WWW_PATH_VAR="$(head -n1 "$SHARED_CACHE_DATA_ROOT/global_var/WWW_PATH" 2>/dev/null | tr -d '\r')"
fi
if [ -n "$SHARED_WWW_PATH_VAR" ] && [ "$SHARED_WWW_PATH_VAR" != "/www" ] && [ -d "$SHARED_WWW_PATH_VAR" ]; then
    SHARED_WWW_BASE="$SHARED_WWW_PATH_VAR"
elif [ "${CORE_NODE_WWW_BASE:-/www}" = "/www/www" ]; then
    # Single-definition NTFS www base from runtime_environment.sh (fallback for
    # a fresh machine whose var center is not initialized yet).
    SHARED_WWW_BASE="/www/www"
fi
if [ -n "$SHARED_WWW_BASE" ]; then
    __scc_candidate="$SHARED_WWW_BASE/cache"
    if [ ! -d "$__scc_candidate" ]; then
        mkdir -p "$__scc_candidate" 2>/dev/null \
            || { command -v sudo >/dev/null 2>&1 && sudo -n mkdir -p "$__scc_candidate" 2>/dev/null; } || true
    fi
    if [ -d "$__scc_candidate" ] && [ -w "$__scc_candidate" ]; then
        SHARED_CACHE_DIR="$__scc_candidate"
        SHARED_CACHE_CROSS_OS=true
    fi
fi

# Create the shared tree 1777 (best-effort; use sudo -n only when not writable + available).
# On the cross-OS NTFS tree chmod/chown are unsupported no-ops (ntfs3 has fixed
# uid/gid/fmask from the mount options); every call is already failure-tolerant.
for __scc_d in "$SHARED_CACHE_DATA_ROOT" "$SHARED_CACHE_DIR" \
               "$SHARED_CACHE_DIR/huggingface/hub" "$SHARED_CACHE_DIR/torch" \
               "$SHARED_CACHE_DIR/pip" "$SHARED_CACHE_DIR/xdg" \
               "$SHARED_CACHE_DIR/whisper" \
               "$SHARED_CACHE_DIR/stt" "$SHARED_CACHE_DIR/tts" "$SHARED_CACHE_DIR/ocr"; do
    [ -d "$__scc_d" ] && continue
    mkdir -p "$__scc_d" 2>/dev/null \
        || { command -v sudo >/dev/null 2>&1 && sudo -n mkdir -p "$__scc_d" 2>/dev/null; } || true
done
chmod 1777 "$SHARED_CACHE_DATA_ROOT" "$SHARED_CACHE_DIR" 2>/dev/null \
    || { command -v sudo >/dev/null 2>&1 && sudo -n chmod 1777 "$SHARED_CACHE_DATA_ROOT" "$SHARED_CACHE_DIR" 2>/dev/null; } || true

# pip disables its cache (with a warning) when the cache dir is owned by a
# different uid than the caller (pyservice sweeps run as root via sudo while
# the tree may have been created by a regular user). Align ownership with the
# current euid so the shared pip cache stays enabled; best-effort, idempotent.
if [ -d "$SHARED_CACHE_DIR/pip" ] && [ "$(stat -c %u "$SHARED_CACHE_DIR/pip" 2>/dev/null)" != "$(id -u)" ]; then
    chown -R "$(id -u):$(id -g)" "$SHARED_CACHE_DIR/pip" 2>/dev/null \
        || { command -v sudo >/dev/null 2>&1 && sudo -n chown -R "$(id -u):$(id -g)" "$SHARED_CACHE_DIR/pip" 2>/dev/null; } || true
fi

# Only wire the shared cache when the tree is writable; otherwise keep per-user defaults.
if [ -w "$SHARED_CACHE_DIR" ]; then
    export CORE_NODE_CACHE_DIR="$SHARED_CACHE_DIR"

    # HuggingFace Hub (transformers / faster-whisper / MeloTTS / GPT-SoVITS / deepseek /
    # qwen / nllb all cache models here). HF_HOME is the single knob (transformers v5).
    : "${HF_HOME:=$SHARED_CACHE_DIR/huggingface}";                export HF_HOME
    : "${HF_HUB_CACHE:=$SHARED_CACHE_DIR/huggingface/hub}";       export HF_HUB_CACHE
    : "${HUGGINGFACE_HUB_CACHE:=$SHARED_CACHE_DIR/huggingface/hub}"; export HUGGINGFACE_HUB_CACHE
    if [ "${TRANSFORMERS_CACHE:-}" = "$SHARED_CACHE_DIR/huggingface/hub" ]; then
        unset TRANSFORMERS_CACHE
    fi

    # PyTorch hub weights, pip wheel cache, whisper .pt models, and the generic
    # XDG cache. On the cross-OS NTFS tree XDG_CACHE_HOME is the cache ROOT
    # itself -- mirroring SharedCacheEnv.ps1 (XDG_CACHE_HOME = D:\www\cache) --
    # so openai-whisper finds the SAME $CACHE/whisper/*.pt files Windows
    # downloaded. On the native Linux tree the historical xdg/ subdir is kept.
    : "${TORCH_HOME:=$SHARED_CACHE_DIR/torch}";  export TORCH_HOME
    : "${PIP_CACHE_DIR:=$SHARED_CACHE_DIR/pip}"; export PIP_CACHE_DIR
    : "${WHISPER_CACHE_DIR:=$SHARED_CACHE_DIR/whisper}"; export WHISPER_CACHE_DIR
    if [ "$SHARED_CACHE_CROSS_OS" = true ]; then
        : "${XDG_CACHE_HOME:=$SHARED_CACHE_DIR}"; export XDG_CACHE_HOME
        # Official HF guidance for a hub cache SHARED ACROSS OPERATING SYSTEMS
        # (HF_HUB_DISABLE_SYMLINKS, huggingface_hub environment_variables docs):
        # symlinks created on Linux are not always traversable on Windows, so a
        # cross-OS cache must store plain files instead of snapshot symlinks
        # (cost: no blob dedup across revisions). Windows-created RELATIVE
        # symlinks already in the tree keep resolving fine under Linux ntfs3.
        : "${HF_HUB_DISABLE_SYMLINKS:=1}"; export HF_HUB_DISABLE_SYMLINKS
    else
        : "${XDG_CACHE_HOME:=$SHARED_CACHE_DIR/xdg}"; export XDG_CACHE_HOME
    fi
    if [ "$IS_HEADLESS_SERVER" = true ]; then
        unset PYCORE_LOCAL_DATA_DIR
    else
        if [ ! -d "$SHARED_CACHE_DIR/pycore" ]; then
            mkdir -p "$SHARED_CACHE_DIR/pycore" 2>/dev/null \
                || { command -v sudo >/dev/null 2>&1 && sudo -n mkdir -p "$SHARED_CACHE_DIR/pycore" 2>/dev/null; } || true
        fi
        : "${PYCORE_LOCAL_DATA_DIR:=$SHARED_CACHE_DIR/pycore}"; export PYCORE_LOCAL_DATA_DIR
    fi
fi

unset __scc_d __scc_src_www __scc_src_root __scc_candidate 2>/dev/null || true
