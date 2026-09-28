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
# Linux namespace + drive-layout roots (contract paths.drive_layout,
# DIRECTORY_NAMESPACE_RULES.md #1). Single definition: read here and reused by
# gvar_storage_common.sh / mount_common.sh instead of re-deriving them -- this
# file loads earliest in both call paths (gvar_common.sh, via
# gvar_system_common.sh; and pyservice_entry.sh, which sources it directly).
CN_LINUX_NAMESPACE_ROOT=""
CN_TOOL_ROOT=""
CN_CACHE_ROOT=""
CN_CACHE_SUBDIR_NAMES=()
CN_TREES_ROOT=""
CN_TREES_MOUNT=""
CN_TREES_MOUNT_PARENT=""
CN_TOOLCHAIN_ENV_FILE=""
__scc_sc_common=""
__scc_tool_root_raw=""
__scc_subdir=""
__scc_var=""
# NOTE: BUN_INSTALL_CACHE_DIR / npm_config_cache / UV_CACHE_DIR /
# COMPOSER_CACHE_DIR / COREPACK_HOME are intentionally NOT pre-declared here --
# same pattern as HF_HOME/TORCH_HOME/XDG_CACHE_HOME further below. The
# "${VAR:=...}" wiring in __scc_wire_tool_cache must see a caller's already-
# exported value, if any; a "VAR=\"\"" declaration here would reset it to
# empty first and make ":=" always overwrite it, silently defeating an
# explicit override (e.g. UV_CACHE_DIR=/fast/uv ./dd.sh).

if [ -z "${IS_HEADLESS_SERVER+x}" ] || [ -z "${CORE_NODE_DATA_DIR:-}" ] || [ -z "${CORE_NODE_WWW_BASE:-}" ]; then
    source "$SHARED_CACHE_RUNTIME_ENV"
fi

# ---- Linux namespace + tool/cache/trees roots (contract paths.drive_layout) --
# DIRECTORY_NAMESPACE_RULES.md #1: every directory this project creates on
# ext4 lives under the ONE namespace root namespaces.linux_ext4
# (/opt/core_node); on the NTFS share, only the single empty trees mount point
# under namespaces.linux_ntfs_trees_mount_parent is ever created
# (LINUX_SHELL_RULES.md #2). Toolchain caches (bun/npm/uv/composer/corepack)
# and per-project heavy dirs (node_modules/vendor/.venv via trees_root /
# trees_mount_linux) are DECOUPLED from each other and from tool_root: each is
# read from its own contract leaf below, never re-derived from another or from
# a live disk-fstype scan (the old tree_root.linux/tree_root.linux_backing
# design this replaces did that; those keys no longer exist in the contract).
if ! command -v sc_get >/dev/null 2>&1; then
    __scc_sc_common="$SHARED_CACHE_ENV_DIR/service_contract_common.sh"
    [ -f "$__scc_sc_common" ] && source "$__scc_sc_common"
fi
if command -v sc_get >/dev/null 2>&1; then
    # `|| VAR=""` on every sc_get read: sc_get can return non-zero (node
    # throwing on a malformed/mid-edit contract, or neither node nor php
    # resolvable yet on a fresh machine), and a bare "VAR=$(sc_get ...)" here
    # would otherwise silently abort every `set -e` caller (dd.sh,
    # 3_setting_base.sh, 7_project_validator.sh) while sourcing this hub.
    CN_LINUX_NAMESPACE_ROOT="$(sc_get paths.drive_layout.namespaces.linux_ext4)" || CN_LINUX_NAMESPACE_ROOT=""
    __scc_tool_root_raw="$(sc_get paths.drive_layout.tool_root.linux)" || __scc_tool_root_raw=""
    CN_CACHE_ROOT="$(sc_get paths.drive_layout.cache_root.linux)" || CN_CACHE_ROOT=""
    CN_TREES_ROOT="$(sc_get paths.drive_layout.trees_root.linux)" || CN_TREES_ROOT=""
    CN_TREES_MOUNT="$(sc_get paths.drive_layout.trees_mount_linux)" || CN_TREES_MOUNT=""
    CN_TREES_MOUNT_PARENT="$(sc_get paths.drive_layout.namespaces.linux_ntfs_trees_mount_parent)" || CN_TREES_MOUNT_PARENT=""
    CN_TOOLCHAIN_ENV_FILE="$(sc_get paths.drive_layout.toolchain_env_file.linux)" || CN_TOOLCHAIN_ENV_FILE=""
    CN_CACHE_SUBDIR_NAMES=($(sc_list paths.drive_layout.cache_subdirs)) || CN_CACHE_SUBDIR_NAMES=()
fi
# Contract-unreadable fallback: the literal shape of each key today, built
# from the ONE namespace-root literal instead of repeating "/opt/core_node" in
# every fallback (the same idiom this file already used for the old
# tree_cache_root template).
[ -n "$CN_LINUX_NAMESPACE_ROOT" ] || CN_LINUX_NAMESPACE_ROOT="/opt/core_node"
[ -n "$__scc_tool_root_raw" ] || __scc_tool_root_raw="$CN_LINUX_NAMESPACE_ROOT/_<os>_<ver>"
[ -n "$CN_CACHE_ROOT" ] || CN_CACHE_ROOT="$CN_LINUX_NAMESPACE_ROOT/cache"
[ -n "$CN_TREES_ROOT" ] || CN_TREES_ROOT="$CN_LINUX_NAMESPACE_ROOT/trees"
[ -n "$CN_TREES_MOUNT_PARENT" ] || CN_TREES_MOUNT_PARENT="/www/core_node_compiler"
[ -n "$CN_TREES_MOUNT" ] || CN_TREES_MOUNT="$CN_TREES_MOUNT_PARENT/trees"
[ -n "$CN_TOOLCHAIN_ENV_FILE" ] || CN_TOOLCHAIN_ENV_FILE="$CN_LINUX_NAMESPACE_ROOT/toolchain.env"
[ "${#CN_CACHE_SUBDIR_NAMES[@]}" -gt 0 ] || CN_CACHE_SUBDIR_NAMES=(pnpm-store bun npm composer uv corepack)

# tool_root.linux is the ONLY drive_layout template with placeholders on Linux
# ("_<os>_<ver>"); resolve them with SYS_DIR, gvar_system_common.sh's single
# OS/major-version derivation ("_${SYSTEM_NAME}_${major}") -- the exact same
# shape, so one substring substitution is exact, never a second OS-detection.
# SYS_DIR is already set by the time this file loads through the normal
# gvar_common.sh chain (gvar_system_common.sh computes SYS_DIR, then sources
# this file at its own end); left empty when this file is sourced standalone
# before SYS_DIR exists (pyservice_entry.sh, which never needs the tool root,
# only the toolchain caches wired below) instead of exporting a literal
# "<os>_<ver>" path.
if [ -n "${SYS_DIR:-}" ]; then
    CN_TOOL_ROOT="${__scc_tool_root_raw//_<os>_<ver>/$SYS_DIR}"
else
    CN_TOOL_ROOT=""
fi

export CN_LINUX_NAMESPACE_ROOT
export CN_TOOL_ROOT
export CN_CACHE_ROOT
export CN_TREES_ROOT
export CN_TREES_MOUNT
export CN_TREES_MOUNT_PARENT
export CN_TOOLCHAIN_ENV_FILE
unset __scc_sc_common __scc_tool_root_raw

# Wire one toolchain cache var ($1) to its subdir name ($2). Prefers the
# shared ext4 cache root (CN_CACHE_ROOT, contract cache_root.linux -- always
# under the ext4 namespace root, never re-derived by disk selection) when that
# subdir exists (or can be created) and is writable by the CURRENT euid;
# otherwise falls back to a per-user ext4 path under $HOME -- NEVER an unset
# var, because an unset var lets the tool fall through to its own
# XDG_CACHE_HOME-derived default, which the cross-OS block further below may
# point at the NTFS tree, reintroducing the exact D: dirty-volume root cause
# this file exists to remove (see
# docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md section 2). The
# ":=" only assigns when the var is unset/empty, so a caller's own exported
# override always wins. Both branches resolve to ext4 (CN_CACHE_ROOT under the
# /opt namespace, or $HOME, never the NTFS share), so there is no live fstype
# check to duplicate here.
__scc_wire_tool_cache() {
    local __var="$1" __subdir="$2" __shared="" __fallback=""
    local -n __ref="$__var"
    if [ -n "$CN_CACHE_ROOT" ]; then
        __shared="$CN_CACHE_ROOT/$__subdir"
        if [ ! -d "$__shared" ]; then
            mkdir -p "$__shared" 2>/dev/null \
                || { command -v sudo >/dev/null 2>&1 && sudo -n mkdir -p "$__shared" 2>/dev/null; } || true
        fi
        if [ -d "$__shared" ]; then
            chmod 1777 "$__shared" 2>/dev/null \
                || { command -v sudo >/dev/null 2>&1 && sudo -n chmod 1777 "$__shared" 2>/dev/null; } || true
        fi
        if [ -d "$__shared" ] && [ -w "$__shared" ]; then
            : "${__ref:=$__shared}"
            export "$__var"
            return 0
        fi
    fi
    __fallback="${HOME:-/root}/.cache/core_node/$__subdir"
    mkdir -p "$__fallback" 2>/dev/null || true
    : "${__ref:=$__fallback}"
    export "$__var"
}

# Contract subdir name -> toolchain env var, the ONE mapping table (this maps
# names to var names; it is not itself a contract value, so it is not a
# second definition of anything the contract declares). "pnpm-store" is
# intentionally skipped: the pnpm store already lives on ext4 inside the Node
# tree, and moving it now breaks existing installs (ERR_PNPM_UNEXPECTED_STORE);
# P3 (wrap-type toolchains) revisits it. A future cache_subdirs entry with no
# mapping here is skipped the same way, never left to guess a var name.
__scc_cache_var_for_subdir() {
    case "$1" in
        bun) echo BUN_INSTALL_CACHE_DIR ;;
        npm) echo npm_config_cache ;;
        uv) echo UV_CACHE_DIR ;;
        composer) echo COMPOSER_CACHE_DIR ;;
        corepack) echo COREPACK_HOME ;;
        *) echo "" ;;
    esac
}
for __scc_subdir in "${CN_CACHE_SUBDIR_NAMES[@]}"; do
    __scc_var="$(__scc_cache_var_for_subdir "$__scc_subdir")"
    [ -n "$__scc_var" ] || continue
    __scc_wire_tool_cache "$__scc_var" "$__scc_subdir"
done
unset -f __scc_wire_tool_cache __scc_cache_var_for_subdir
unset __scc_subdir __scc_var

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
# /var/_core_node/cache below is used instead. This SHARED_CACHE_DIR tree
# (native or the NTFS share) is model/user-cache data (D26: shared data both
# OSes read, allowed on the NTFS share); it is NOT the toolchain package-cache
# tree above, which is pinned to ext4 unconditionally.
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
    # These are the "explicit shared-data variables" D26 asks for: a consumer
    # that reads HF_HOME/HF_HUB_CACHE/HUGGINGFACE_HUB_CACHE/TORCH_HOME directly
    # (instead of only XDG_CACHE_HOME) always lands on the shared tree, whether
    # or not it happens to be the cross-OS NTFS share.
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
    # WHISPER_CACHE_DIR is this project's own explicit variable (no consumer
    # reads it today -- see the XDG_CACHE_HOME note below); exported anyway so
    # a future whisper_provider.py/stt_orchestrator.py fix (pass
    # download_root=$WHISPER_CACHE_DIR, or read it before falling back to
    # XDG_CACHE_HOME) has a ready-made shared-tree value to use.
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
    # D26 asks to stop pointing XDG_CACHE_HOME at the NTFS share (it also
    # carries Linux-only desktop/tool caches), UNLESS grep finds a consumer
    # that only understands XDG_CACHE_HOME for SHARED model data -- then it
    # stays, reported here for the owning lane to fix:
    #   - pycore/pyutils/whisper_stt/whisper_provider.py:170
    #     `self._model = whisper.load_model(self._model_name)`
    #   - pycore/pyutils/stt/stt_orchestrator.py:318
    #     `model = whisper.load_model(model_name)`
    #   Both call openai-whisper's load_model() with no download_root, so
    #   openai-whisper's own default (os.getenv("XDG_CACHE_HOME", ...) + "/whisper")
    #   is the ONLY thing that puts its multi-GB weights on the shared tree
    #   instead of re-downloading into $HOME/.cache every time the running
    #   user changes. Follow-up for pycore: pass
    #   download_root=os.environ.get("WHISPER_CACHE_DIR") (exported above) at
    #   both call sites, then XDG_CACHE_HOME can move to ext4 unconditionally.
    #   scripts/pytools/pybackup/python_env/backup_python_env.py:194-201 reads
    #   XDG_CACHE_HOME the same way for its own whisper-cache backup target;
    #   same follow-up applies there.
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
