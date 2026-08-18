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
# shared_cache_env.sh - export the ONE shared, all-users cache location.
#
# Sourced by gvar_common.sh (every numbered install_shells/<NN>_*.sh), by the Pycore
# prerequisite orchestrator prepare.sh (every install_*.sh iniscript) and by pyservice.sh
# (the running service) so that EVERY model / pip / torch / HuggingFace download - no
# matter WHICH user runs the install - lands in ONE shared tree that is readable by all
# regular users, instead of the installing user's home (~/.cache, ~/.core_node, and the
# /root/.core_node seen when installing as root).
#
# Shared root: /var/_core_node (matches pycore get_system_cache_dir()); cache under
# /var/_core_node/cache, created 1777 (sticky + world-writable, like /tmp) so any user can
# read/write it. IDEMPOTENT and best-effort: it never fails the caller, and it respects any
# value the caller already exported (so an explicit override still wins). On a locked-down
# host where the shared tree cannot be made writable it leaves the caller's per-user
# defaults untouched.

# ---- variable declarations (rule 5) ----
SHARED_CACHE_DATA_ROOT=""
SHARED_CACHE_DIR=""
__scc_d=""

# Resolve the shared data root (gvar_common.sh usually already sets CORE_NODE_DATA_DIR).
: "${CORE_NODE_DATA_DIR:=/var/_core_node}"
SHARED_CACHE_DATA_ROOT="$CORE_NODE_DATA_DIR"
SHARED_CACHE_DIR="$SHARED_CACHE_DATA_ROOT/cache"

# Create the shared tree 1777 (best-effort; use sudo -n only when not writable + available).
for __scc_d in "$SHARED_CACHE_DATA_ROOT" "$SHARED_CACHE_DIR" \
               "$SHARED_CACHE_DIR/huggingface/hub" "$SHARED_CACHE_DIR/torch" \
               "$SHARED_CACHE_DIR/pip" "$SHARED_CACHE_DIR/xdg" \
               "$SHARED_CACHE_DIR/stt" "$SHARED_CACHE_DIR/tts" "$SHARED_CACHE_DIR/ocr" \
               "$SHARED_CACHE_DIR/pycore"; do
    [ -d "$__scc_d" ] && continue
    mkdir -p "$__scc_d" 2>/dev/null \
        || { command -v sudo >/dev/null 2>&1 && sudo -n mkdir -p "$__scc_d" 2>/dev/null; } || true
done
chmod 1777 "$SHARED_CACHE_DATA_ROOT" "$SHARED_CACHE_DIR" 2>/dev/null \
    || { command -v sudo >/dev/null 2>&1 && sudo -n chmod 1777 "$SHARED_CACHE_DATA_ROOT" "$SHARED_CACHE_DIR" 2>/dev/null; } || true

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

    # PyTorch hub weights, pip wheel cache, and the generic XDG cache (openai-whisper
    # stores its models under $XDG_CACHE_HOME/whisper).
    : "${TORCH_HOME:=$SHARED_CACHE_DIR/torch}";  export TORCH_HOME
    : "${PIP_CACHE_DIR:=$SHARED_CACHE_DIR/pip}"; export PIP_CACHE_DIR
    : "${XDG_CACHE_HOME:=$SHARED_CACHE_DIR/xdg}"; export XDG_CACHE_HOME
    : "${PYCORE_LOCAL_DATA_DIR:=$SHARED_CACHE_DIR/pycore}"; export PYCORE_LOCAL_DATA_DIR
fi

unset __scc_d 2>/dev/null || true
