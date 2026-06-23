#!/usr/bin/env bash
# pip_lock.sh — serialize pip installs into the ONE shared venv.
#
# Concurrent `pip install` into a single environment corrupts site-packages /
# *.dist-info (pip has no install-time locking), and several voice engines pull the
# SAME heavy dep (torch). When installers may run in PARALLEL — e.g. the
# tts_parallel_install.sh driver streaming each engine in its own terminal/pane —
# their pip steps must still serialize even though their downloads run concurrently.
#
# Usage: source this, then call:   vpip "$PYTHON" -m pip install <args...>
# flock returns the wrapped command's exit status, so `|| true`, `&&` and a trailing
# `2>/dev/null` on the call site keep working. One shared lock (1777 dir, 0666 file)
# lets parallel runs — even different users — serialize. flock BLOCKS (no timeout):
# waiting is correct; corrupting the venv is not. If flock is absent (non-util-linux),
# vpip runs pip unserialized (best effort). Override the lock path via PIP_LOCK_FILE.

if [ -z "${PIP_LOCK_FILE:-}" ]; then
    _plk_dir="${CORE_NODE_DATA_DIR:-/var/_core_node}/locks"
    if ! mkdir -p "$_plk_dir" 2>/dev/null; then
        _plk_dir="${TMPDIR:-/tmp}/core_node_locks"
        mkdir -p "$_plk_dir" 2>/dev/null || true
    fi
    # World-writable shared dir so any user's installer takes the SAME lock.
    chmod 1777 "$_plk_dir" 2>/dev/null || true
    PIP_LOCK_FILE="$_plk_dir/pip.lock"
    [ -e "$PIP_LOCK_FILE" ] || : > "$PIP_LOCK_FILE" 2>/dev/null || true
    chmod 0666 "$PIP_LOCK_FILE" 2>/dev/null || true
fi

# Run a command under the shared pip lock (exclusive). Falls back to running the
# command directly when flock or the lock file is unavailable.
vpip() {
    if command -v flock >/dev/null 2>&1 && [ -e "$PIP_LOCK_FILE" ]; then
        flock "$PIP_LOCK_FILE" "$@"
    else
        "$@"
    fi
}
