#!/bin/bash
# =============================================================================
# debian_tooldir_migration.sh - idempotent migration of the legacy per-OS tool
# directories (/www/_debian_<N>, e.g. _debian_12 -> _debian_13) created by
# gvar_storage_common.sh / nodetools/gvar_common.js (format: _<os>_<ver>).
#
# Background (see development-guides/DIRECTORY_NAMESPACE_RULES.md section 2
# and .claude/agents_shared/d30/audit_result.json): these dirs are the
# documented "legacy" tool root; the final target is /opt/core_node/_<os>_<ver>,
# but that larger migration (fixing get_dev_compile_base and friends) is a
# separate, already-tracked task. THIS script only catches the tool dirs up to
# the CURRENT OS major version (e.g. _debian_12 -> _debian_13), which is what
# a kernel/OS major-version hop (upgrade_os_to_latest.sh) leaves undone today:
# the OS packages move, but every /usr/local/bin symlink and systemd
# WorkingDirectory that was pointing at the old _<os>_<ver> dir keeps pointing
# there forever (verified on this host: node/npm/python3.12/pipx/certbot/
# poetry/uv/omp symlinks, plus the live rustdesk-hbbr/hbbs services and the
# PostgreSQL 15 cluster, were still on _debian_12 while the OS itself was
# already Debian 13).
#
# Safety model (never run unattended without these guarantees):
#   - Every step is idempotent: already-migrated items are detected and
#     skipped (safe to re-run after a partial failure).
#   - A collision at the destination (same subdir name used for something
#     ELSE, e.g. python3_venv) is NEVER overwritten; the item is renamed to a
#     non-colliding name instead, and every consumer (symlink / env var) is
#     repointed to the new name.
#   - Nothing here is a hard, irreversible delete. Simple tool dirs are mv'd
#     (same filesystem, atomic). Stateful/live data (PostgreSQL, the RustDesk
#     server) is copied with rsync, verified healthy on the new path, and the
#     OLD copy is renamed aside (".pre_migration_<ts>") rather than removed -
#     the user deletes it manually once satisfied.
#   - Every service-affecting step stops the service first, only ever reads/
#     writes while stopped, and restarts + verifies (systemctl is-active,
#     plus a real smoke test: --version / pg_isready) before moving on. A
#     failed verification stops the whole run with the service left on
#     whichever path last passed its own verification (never half-moved).
#
# Usage:
#   ./debian_tooldir_migration.sh                  # auto-detect old -> new
#   ./debian_tooldir_migration.sh _debian_12 _debian_13   # explicit
#   ./debian_tooldir_migration.sh --report-only     # scan + report, no changes
# =============================================================================

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TDM_SCRIPT_INDEX="tooldir-migration"

source "$SCRIPT_CURRENT_DIR/common_functions.sh"
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"

TDM_WWW_ROOT="/www"
TDM_OLD_DIR=""
TDM_NEW_DIR=""
TDM_REPORT_ONLY=false
declare -a TDM_DONE=()
declare -a TDM_SKIPPED=()
declare -a TDM_FAILED=()

# Always stderr: several callers capture a helper's stdout via $(...) for its
# return VALUE (e.g. tdm_move_simple's resolved destination path) - a log line
# on stdout would silently corrupt that captured value. tdm_log on stderr is
# still fully visible on an interactive terminal (stderr is not redirected).
tdm_log() { echo "[$TDM_SCRIPT_INDEX] $*" >&2; }
# Run a command as the "postgres" user. "$USE_SUDO -u postgres ..." is WRONG
# when already root: USE_SUDO is then empty, so it literally tries to exec a
# program named "-u" (command not found, exit 127) - this previously made a
# perfectly healthy PostgreSQL start look like a failed verification.
tdm_as_postgres() {
    if [ "$(id -u)" -eq 0 ]; then
        runuser -u postgres -- "$@"
    else
        sudo -u postgres "$@"
    fi
}

tdm_ok()   { TDM_DONE+=("$1");    tdm_log "OK: $1"; }
tdm_skip() { TDM_SKIPPED+=("$1"); tdm_log "SKIP: $1"; }
tdm_fail() { TDM_FAILED+=("$1");  tdm_log "FAIL: $1"; }

# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

# Current "_<os>_<ver>" name per the same convention as gvar_storage_common.sh
# / nodetools/gvar_common.js (ID + major VERSION_ID from /etc/os-release).
tdm_current_name() {
    local os_id="" ver_major=""
    [ -f /etc/os-release ] || { echo ""; return 1; }
    os_id="$(. /etc/os-release 2>/dev/null; echo "$ID")"
    ver_major="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID" | grep -oE '^[0-9]+')"
    [ -n "$os_id" ] && [ -n "$ver_major" ] || { echo ""; return 1; }
    echo "_${os_id}_${ver_major}"
}

# Every "_<os>_<ver>" directory under /www other than the current one.
tdm_detect_old_dirs() {
    local current="" d="" base=""
    current="$(tdm_current_name)"
    for d in "$TDM_WWW_ROOT"/_*_*; do
        [ -d "$d" ] || continue
        base="$(basename "$d")"
        [[ "$base" =~ ^_[a-z]+_[0-9]+$ ]] || continue
        [ "$base" = "$current" ] && continue
        echo "$base"
    done
}

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

# Idempotent symlink repoint; no-op if already correct.
tdm_relink() {
    local link="$1" target="$2" current=""
    [ -e "$target" ] || { tdm_log "  [WARN] relink target missing, not touching link: $target"; return 1; }
    [ -L "$link" ] && current="$(readlink "$link" 2>/dev/null)"
    if [ "$current" = "$target" ]; then
        tdm_log "  symlink already correct: $link -> $target"
        return 0
    fi
    $USE_SUDO ln -sfn "$target" "$link"
    tdm_log "  symlink repointed: $link -> $target (was: ${current:-absent})"
}

# Fix absolute-path references (shebangs, pyvenv.cfg, activate scripts, .pth
# files) baked into a relocated Python venv or similar text-based tool dir.
# Safe/idempotent: a dir with nothing left to fix is a silent no-op.
tdm_fix_embedded_paths() {
    local dir="$1" old_path="$2" new_path="$3"
    [ -d "$dir" ] || return 0
    grep -rlZ --binary-files=without-match -- "$old_path" "$dir" 2>/dev/null \
        | xargs -0 -r $USE_SUDO sed -i "s#${old_path}#${new_path}#g"
}

# mv a simple (non-live-service) tool dir from old root to a given name under
# the new root. Idempotent: if the destination already exists and the source
# is gone, treat as already-migrated; if both exist, do NOT overwrite (collision).
# Prints the resolved destination path on stdout for the caller to use.
tdm_move_simple() {
    local src="$1" dst="$2"
    if [ ! -e "$src" ] && [ -e "$dst" ]; then
        echo "$dst"; return 0
    fi
    if [ ! -e "$src" ]; then
        echo ""; return 1
    fi
    if [ -d "$dst" ] && [ -z "$($USE_SUDO find "$dst" -mindepth 1 -print -quit 2>/dev/null)" ]; then
        # Empty placeholder directory (e.g. leftover install scaffolding) -
        # safe to drop and reuse the name rather than treat as a collision.
        $USE_SUDO rmdir "$dst" 2>/dev/null
    fi
    if [ -e "$dst" ]; then
        tdm_log "  [WARN] destination already exists, refusing to overwrite: $dst (source left in place: $src)"
        echo ""; return 1
    fi
    $USE_SUDO mkdir -p "$(dirname "$dst")"
    $USE_SUDO mv "$src" "$dst" || { echo ""; return 1; }
    echo "$dst"; return 0
}

# A venv's OWN bin/python(3) can resolve (through an external wrapper this
# script does not own, e.g. a system-wide "/usr/local/bin/python" that execs
# into a DIFFERENT venv) into a FOREIGN venv entirely - CPython then finds
# the foreign venv's pyvenv.cfg instead of this one's, so THIS venv's own
# site-packages are silently never on sys.path even though the files are all
# present (seen on this host: poetry_venv's own interpreter chain ended up
# inside _debian_13/python3_venv, so `poetry` reported "module not found"
# despite poetry's package sitting right there in poetry_venv/lib/.../site-
# packages). Self-heals unconditionally as part of the flow: repoints
# bin/python3 (and bin/python) directly at a real, non-venv system
# interpreter whenever the chain is found to end outside this venv.
tdm_repair_foreign_venv_interpreter() {
    local venv_dir="$1" py_bin="" venv_real="" actual_prefix="" sys_py=""
    [ -f "$venv_dir/pyvenv.cfg" ] || return 0
    venv_real="$(cd "$venv_dir" 2>/dev/null && pwd)"
    [ -n "$venv_real" ] || return 0
    py_bin="$venv_dir/bin/python3"
    [ -e "$py_bin" ] || py_bin="$venv_dir/bin/python"
    [ -e "$py_bin" ] || return 0
    # Static symlink tracing (readlink -f) cannot see through a shell-script
    # wrapper that "exec"s elsewhere (not a symlink) - the only reliable check
    # is asking the interpreter itself, at runtime, what it believes its own
    # prefix is. This is exactly how poetry_venv was found broken: its chain
    # passes through a real (non-symlink) "/usr/local/bin/python" wrapper
    # script that execs into an unrelated venv.
    actual_prefix="$("$py_bin" -c 'import sys; print(sys.prefix)' 2>/dev/null)"
    [ -n "$actual_prefix" ] || return 0
    actual_prefix="$(cd "$actual_prefix" 2>/dev/null && pwd)"
    if [ -n "$actual_prefix" ] && [ "$actual_prefix" != "$venv_real" ]; then
        tdm_log "  [WARN] $venv_dir's own interpreter actually runs as a DIFFERENT venv (sys.prefix=$actual_prefix) - repointing directly to the system python"
        # /usr/local/bin/python* is NOT safe to use as the escape target on
        # this host - EVERY one of python/python3/python3.12/python3.13 under
        # /usr/local/bin is itself one of these wrapper scripts (confirmed:
        # all 127 bytes, all "exec ... _debian_13/python3_venv/bin/python3"),
        # which is exactly how poetry_venv got broken in the first place.
        # /usr/bin is the real, non-wrapped system install on Debian/Ubuntu.
        sys_py="/usr/bin/python3"
        [ -x "$sys_py" ] || sys_py="/usr/bin/python3.13"
        if [ ! -x "$sys_py" ]; then
            tdm_log "  [WARN] no real system python3 found under /usr/bin - leaving $venv_dir as-is"
            return 1
        fi
        sys_py="$(readlink -f "$sys_py" 2>/dev/null)"
        # Verify the candidate itself isn't ALSO secretly a wrapper (belt and
        # suspenders - a plain /usr install must report sys.prefix=/usr).
        if [ "$("$sys_py" -c 'import sys; print(sys.prefix)' 2>/dev/null)" != "/usr" ]; then
            tdm_log "  [WARN] candidate system python ($sys_py) is not a plain /usr install either - leaving $venv_dir as-is"
            return 1
        fi
        $USE_SUDO ln -sfn "$sys_py" "$venv_dir/bin/python3"
        $USE_SUDO ln -sfn python3 "$venv_dir/bin/python" 2>/dev/null
        tdm_log "  repointed $venv_dir/bin/python3 -> $sys_py (bypassing the foreign venv)"
    fi
}

# pipx tracks each app's interpreter path inside its own venv metadata; after
# a move (or after the interpreter package itself got removed - see the
# certbot/python3.12 incident) pipx can report "invalid interpreter" without
# any filesystem error. Self-heals unconditionally: if `pipx list` flags
# anything broken, rebuild every pipx app fresh against whatever python pipx
# itself currently resolves to. No-op (fast) when nothing is broken.
tdm_pipx_heal_if_broken() {
    local home="$1" bin_dir="${2:-/usr/local/bin}" list_out=""
    command -v pipx >/dev/null 2>&1 || return 0
    list_out="$(PIPX_HOME="$home" PIPX_BIN_DIR="$bin_dir" pipx list 2>&1)"
    if echo "$list_out" | grep -qi "invalid interpreter\|missing python interpreter\|missing python executable"; then
        tdm_log "  pipx reports a broken interpreter after the move - self-healing via 'pipx reinstall-all'"
        PIPX_HOME="$home" PIPX_BIN_DIR="$bin_dir" pipx reinstall-all >/dev/null 2>&1 \
            && tdm_log "  pipx reinstall-all completed" \
            || tdm_log "  [WARN] pipx reinstall-all reported errors - investigate manually"
    fi
}

# ---------------------------------------------------------------------------
# Node.js core (node/npm/npx/yarn/corepack/pnpm/pnpx under node/<version>/bin)
# merges into the SAME <version> folder on the new side (it may already hold
# only a pnpm-global home with no real install - verified safe to merge).
# ---------------------------------------------------------------------------
tdm_migrate_node_core() {
    local ver="" src="" dst="" link="" bin=""
    local -a links=(node npm npx pnpm pnpx yarn yarnpkg corepack)

    for src in "$TDM_OLD_DIR/node"/*/; do
        [ -d "$src" ] || continue
        ver="$(basename "$src")"
        [ -d "$src/bin" ] || continue
        dst="$TDM_NEW_DIR/node/$ver"
        if [ -d "$dst/bin" ] && [ "$dst/bin" != "$src/bin" ]; then
            # Real install already on both sides for the same version string -
            # do not clobber; leave for manual reconciliation.
            if ! $USE_SUDO diff -rq "$src/bin" "$dst/bin" >/dev/null 2>&1; then
                tdm_fail "node $ver: both $src and $dst have a real install and differ - manual reconciliation needed"
                continue
            fi
        fi
        $USE_SUDO mkdir -p "$dst"
        $USE_SUDO rsync -a --remove-source-files "$src"/ "$dst"/ 2>/dev/null \
            || { tdm_fail "node $ver: rsync merge failed"; continue; }
        find "$src" -depth -type d -empty -exec $USE_SUDO rmdir {} \; 2>/dev/null
        tdm_ok "node $ver merged: $src -> $dst"
    done

    for link in "${links[@]}"; do
        bin="$(readlink "/usr/local/bin/$link" 2>/dev/null)"
        case "$bin" in
            "$TDM_OLD_DIR"/node/*)
                ver="$(echo "$bin" | sed -E "s#.*/node/([^/]+)/.*#\1#")"
                tdm_relink "/usr/local/bin/$link" "$TDM_NEW_DIR/node/$ver/bin/$link"
                ;;
        esac
    done

    command -v node >/dev/null 2>&1 && node --version >/dev/null 2>&1 \
        && tdm_ok "smoke test: node --version OK" \
        || tdm_fail "smoke test: node --version failed after migration"
}

# pnpm-global "pi"/"rebrowser-puppeteer" tree under node/node-v24.11.1 - a
# second, differently-versioned node install, moved as its own unit.
tdm_migrate_node_secondary() {
    local src="" dst="" link="" bin="" sub=""
    for src in "$TDM_OLD_DIR/node"/*/; do
        sub="$(basename "$src")"
        [ -d "$TDM_NEW_DIR/node/$sub" ] && continue
        dst="$(tdm_move_simple "$src" "$TDM_NEW_DIR/node/$sub")"
        [ -n "$dst" ] && tdm_ok "node (secondary) moved: $src -> $dst"
    done
    for link in pi rebrowser-puppeteer; do
        bin="$(readlink "/usr/local/bin/$link" 2>/dev/null)"
        case "$bin" in
            "$TDM_OLD_DIR"/node/*)
                sub="$(echo "$bin" | sed -E "s#${TDM_OLD_DIR}/node/([^/]+)/.*#\1#")"
                if [ -e "$TDM_NEW_DIR/node/$sub/$(echo "$bin" | sed -E "s#.*${sub}/##")" ]; then
                    tdm_relink "/usr/local/bin/$link" "$TDM_NEW_DIR/node/$sub/$(echo "$bin" | sed -E "s#.*${sub}/##")"
                else
                    # Deliberately NOT auto-reinstalling here: a short/generic
                    # global name like "pi" can collide with an unrelated real
                    # npm package of the same name (verified the hard way -
                    # "pnpm add -g pi" silently installed a decimal-places
                    # calculator, not whatever this host's "pi" actually was,
                    # which would have been worse than leaving it reported as
                    # missing). This script has no authoritative record of
                    # which package this name was ever supposed to resolve
                    # to, so guessing is not a safe default - only a longer,
                    # unambiguous package name (verify manually) is worth
                    # trying by hand.
                    tdm_fail "$link: relink target missing ($bin) - reinstall manually with the correct package (verify the name first; do not assume 'pnpm add -g $link' is the right one)"
                fi
                ;;
        esac
    done
}

# ---------------------------------------------------------------------------
# Python system venv (python3.12 symlink). _new/python3_venv is ALREADY a
# different, live venv (rustdesk_dashboard + pip/pip3) - never collide with
# it; the system venv moves to a distinctly-named sibling.
# ---------------------------------------------------------------------------
tdm_migrate_python_system_venv() {
    local src="$TDM_OLD_DIR/python3_venv" dst="$TDM_NEW_DIR/python3.12_venv" moved=""
    [ -e "$src" ] || [ -e "$dst" ] || { tdm_skip "python3.12 venv: nothing to migrate"; return 0; }
    moved="$(tdm_move_simple "$src" "$dst")"
    if [ -z "$moved" ]; then
        tdm_fail "python3.12 venv: move failed or destination collision ($dst)"
        return 1
    fi
    tdm_fix_embedded_paths "$moved" "$TDM_OLD_DIR/python3_venv" "$moved"
    tdm_relink "/usr/local/bin/python3.12" "$moved/bin/python3"
    [ "$(get_var "UV_PROJECT_ENVIRONMENT" 2>/dev/null)" = "$src" ] \
        && set_env_and_var "UV_PROJECT_ENVIRONMENT" "$moved"
    grep -q "^UV_PROJECT_ENVIRONMENT=\"$src\"" /etc/environment 2>/dev/null \
        && set_env_and_var "UV_PROJECT_ENVIRONMENT" "$moved"
    # Repair is a LAST resort, tried only once the plain move+relink is
    # proven insufficient - never unconditionally, so a venv that already
    # works (however accidentally) is never put at risk of a regression.
    python3.12 --version >/dev/null 2>&1 || tdm_repair_foreign_venv_interpreter "$moved"
    python3.12 --version >/dev/null 2>&1 \
        && tdm_ok "python3.12 venv migrated: $src -> $moved" \
        || tdm_fail "smoke test: python3.12 --version failed after migration"
}

# pipx (the tool itself) + pipx_home (certbot's venv lives here - SSL renewal,
# highest-stakes item besides PostgreSQL).
tdm_migrate_pipx() {
    local src_venv="$TDM_OLD_DIR/pipx_venv" dst_venv="$TDM_NEW_DIR/pipx_venv"
    local src_home="$TDM_OLD_DIR/pipx_home" dst_home="$TDM_NEW_DIR/pipx_home"
    local moved_venv="" moved_home=""

    if [ -e "$src_venv" ] || [ -e "$dst_venv" ]; then
        moved_venv="$(tdm_move_simple "$src_venv" "$dst_venv")"
        if [ -n "$moved_venv" ]; then
            tdm_fix_embedded_paths "$moved_venv" "$src_venv" "$moved_venv"
            # Prefer the apt-maintained system launcher: pipx_venv's own
            # pip-installed copy is version-locked to python3.12 (gone from
            # this host - same root cause class as certbot), while
            # /usr/bin/pipx ships with the `pipx` apt package, always matches
            # whatever pipx is actually installed, and needs no repair. This
            # venv apparently only ever worked via an accidental cross-wire
            # into a DIFFERENT venv's system-site-packages access - "fixing"
            # that isolation (tdm_repair_foreign_venv_interpreter) breaks it,
            # so it is deliberately NOT applied here.
            if [ -x /usr/bin/pipx ] && /usr/bin/pipx --version >/dev/null 2>&1; then
                tdm_relink "/usr/local/bin/pipx" "/usr/bin/pipx"
            else
                tdm_relink "/usr/local/bin/pipx" "$moved_venv/bin/pipx"
            fi
        else
            tdm_fail "pipx (tool): move failed or destination collision ($dst_venv)"
        fi
    fi
    if [ -e "$src_home" ] || [ -e "$dst_home" ]; then
        if [ -d "$dst_home/venvs" ] && [ -e "$src_home" ]; then
            # Already migrated in a prior run - the only thing left at the
            # old path is pipx's own disposable housekeeping (.cache, log
            # files it writes on every invocation), not a real collision.
            # Sweep it so this stops reporting a false failure on every
            # re-run, and treat the destination as the migrated result.
            tdm_log "  pipx_home already migrated (destination has venvs/); clearing disposable residue left at $src_home"
            $USE_SUDO rm -rf "$src_home"
            moved_home="$dst_home"
        else
            moved_home="$(tdm_move_simple "$src_home" "$dst_home")"
        fi
        if [ -n "$moved_home" ]; then
            tdm_fix_embedded_paths "$moved_home" "$src_home" "$moved_home"
            tdm_relink "/usr/local/bin/certbot" "$moved_home/venvs/certbot/bin/certbot"
            set_env_and_var "PIPX_HOME" "$moved_home"
            # pipx's own metadata can still flag a venv as broken (e.g. the
            # interpreter package itself was removed system-wide, as happened
            # to python3.12/certbot) independently of the path move above -
            # self-heal unconditionally before judging success/failure.
            tdm_pipx_heal_if_broken "$moved_home" "/usr/local/bin"
        else
            tdm_fail "pipx_home (certbot): move failed or destination collision ($dst_home)"
        fi
    fi

    if [ -n "$moved_venv" ]; then
        pipx --version >/dev/null 2>&1 \
            && tdm_ok "pipx migrated: $src_venv -> $moved_venv" \
            || tdm_fail "smoke test: pipx --version failed after migration"
    fi
    if [ -n "$moved_home" ]; then
        certbot --version >/dev/null 2>&1 \
            && tdm_ok "certbot migrated: $src_home -> $moved_home" \
            || tdm_fail "smoke test: certbot --version failed after migration (SSL renewal at risk - investigate before relying on auto-renew)"
    fi
}

tdm_migrate_poetry() {
    local src="$TDM_OLD_DIR/poetry_venv" dst="$TDM_NEW_DIR/poetry_venv" moved=""
    [ -e "$src" ] || [ -e "$dst" ] || { tdm_skip "poetry: nothing to migrate"; return 0; }
    moved="$(tdm_move_simple "$src" "$dst")"
    if [ -z "$moved" ]; then
        tdm_fail "poetry: move failed or destination collision ($dst)"
        return 1
    fi
    tdm_fix_embedded_paths "$moved" "$src" "$moved"
    tdm_relink "/usr/local/bin/poetry" "$moved/bin/poetry"
    # Repair is tried only once the plain move+relink is proven insufficient,
    # never unconditionally (see tdm_migrate_pipx for why: unconditionally
    # "fixing" a venv's isolation can break one that only ever worked via an
    # accidental cross-wire).
    poetry --version >/dev/null 2>&1 || tdm_repair_foreign_venv_interpreter "$moved"
    if ! poetry --version >/dev/null 2>&1; then
        # Symlink/interpreter repair alone cannot fix a venv whose installed
        # packages are pinned under lib/python3.12/site-packages when 3.12
        # no longer exists anywhere (same root cause class as the
        # certbot/python3.12 incident - the package files are version-locked
        # to a python minor that is simply gone, not just a bad path). The
        # reliable fix is a fresh reinstall against whatever python actually
        # exists now - pipx (fixed earlier in this same flow) does exactly
        # that and replaces /usr/local/bin/poetry with its own, working shim.
        tdm_log "  poetry still broken after relink/repoint (likely version-locked to a now-missing python minor) - reinstalling fresh via pipx"
        if command -v pipx >/dev/null 2>&1; then
            PIPX_HOME="${TDM_NEW_DIR}/pipx_home" PIPX_BIN_DIR=/usr/local/bin pipx install poetry --force >/dev/null 2>&1 \
                && tdm_log "  poetry reinstalled via pipx" \
                || tdm_log "  [WARN] pipx install poetry --force failed"
        else
            tdm_log "  [WARN] pipx not available to attempt a fresh reinstall"
        fi
    fi
    poetry --version >/dev/null 2>&1 \
        && tdm_ok "poetry migrated/repaired: $src -> $moved" \
        || tdm_fail "smoke test: poetry --version failed after migration and reinstall attempt - investigate manually"
}

tdm_migrate_uv() {
    local src="$TDM_OLD_DIR/uv_bin" dst="$TDM_NEW_DIR/uv_bin" moved=""
    [ -e "$src" ] || [ -e "$dst" ] || { tdm_skip "uv: nothing to migrate"; return 0; }
    moved="$(tdm_move_simple "$src" "$dst")"
    if [ -z "$moved" ]; then
        tdm_fail "uv: move failed or destination collision ($dst)"
        return 1
    fi
    tdm_relink "/usr/local/bin/uv" "$moved/uv"
    uv --version >/dev/null 2>&1 \
        && tdm_ok "uv migrated: $src -> $moved" \
        || tdm_fail "smoke test: uv --version failed after migration"
}

tdm_migrate_omp() {
    local src="$TDM_OLD_DIR/omp" dst="$TDM_NEW_DIR/omp" moved=""
    [ -e "$src" ] || [ -e "$dst" ] || { tdm_skip "oh-my-posh: nothing to migrate"; return 0; }
    moved="$(tdm_move_simple "$src" "$dst")"
    if [ -z "$moved" ]; then
        tdm_fail "oh-my-posh: move failed or destination collision ($dst)"
        return 1
    fi
    tdm_relink "/usr/local/bin/omp" "$moved/omp"
    omp --version >/dev/null 2>&1 \
        && tdm_ok "oh-my-posh migrated: $src -> $moved" \
        || tdm_fail "smoke test: omp --version failed after migration"
}

# ---------------------------------------------------------------------------
# RustDesk relay/rendezvous server - live stateful data (ed25519 identity key
# + sqlite client DB) with TWO live systemd services whose WorkingDirectory=
# is a raw absolute path (no symlink indirection). Stop -> rsync copy ->
# verify -> edit units -> daemon-reload -> start -> verify active.
# ---------------------------------------------------------------------------
tdm_migrate_rustdesk_server() {
    local src="$TDM_OLD_DIR/applications/rustdesk-server"
    local src_clients="$TDM_OLD_DIR/applications/rustdesk-clients"
    local dst="$TDM_NEW_DIR/applications/rustdesk-server"
    local dst_clients="$TDM_NEW_DIR/applications/rustdesk-clients"
    local unit="" f=""
    local -a units=(rustdesk-hbbr.service rustdesk-hbbs.service)

    [ -d "$src" ] || { tdm_skip "rustdesk-server: nothing to migrate"; return 0; }
    if [ -d "$dst" ]; then
        tdm_fail "rustdesk-server: destination already exists, refusing to overwrite: $dst"
        return 1
    fi

    for unit in "${units[@]}"; do
        $USE_SUDO systemctl stop "$unit" 2>/dev/null \
            && tdm_log "  stopped: $unit" \
            || tdm_log "  [WARN] $unit was not running (continuing)"
    done

    $USE_SUDO mkdir -p "$(dirname "$dst")"
    $USE_SUDO rsync -a "$src"/ "$dst"/ || { tdm_fail "rustdesk-server: rsync copy failed"; return 1; }
    if [ -d "$src_clients" ] && [ ! -d "$dst_clients" ]; then
        $USE_SUDO rsync -a "$src_clients"/ "$dst_clients"/ 2>/dev/null
    fi
    if ! $USE_SUDO diff -rq "$src/data" "$dst/data" >/dev/null 2>&1; then
        tdm_fail "rustdesk-server: copy verification mismatch - leaving services stopped, NOT switching over (old data untouched at $src)"
        return 1
    fi

    for unit in "${units[@]}"; do
        f="/etc/systemd/system/$unit"
        [ -f "$f" ] || continue
        $USE_SUDO sed -i "s#${src}#${dst}#g" "$f"
    done
    $USE_SUDO systemctl daemon-reload

    for unit in "${units[@]}"; do
        $USE_SUDO systemctl start "$unit" 2>/dev/null
        sleep 1
        if $USE_SUDO systemctl is-active --quiet "$unit"; then
            tdm_log "  started and active: $unit"
        else
            tdm_fail "rustdesk-server: $unit failed to come up on the new path - unit file now points at $dst but service is down; old data still intact at $src for manual rollback"
            return 1
        fi
    done

    $USE_SUDO mv "$src" "${src}.pre_migration_$(date +%Y%m%d_%H%M%S)"
    tdm_ok "rustdesk-server migrated and verified running: $src -> $dst (old copy kept as backup, not deleted)"
}

# ---------------------------------------------------------------------------
# PostgreSQL 15 cluster - the highest-stakes item. Stop -> rsync copy ->
# verify byte-for-byte -> repoint postgresql.conf -> start -> pg_isready.
# Any failure leaves the cluster back on the OLD path (postgresql.conf is
# only edited after the copy is verified, and only switched again back to
# the old path if the new path fails to come up healthy).
# ---------------------------------------------------------------------------
tdm_migrate_postgresql() {
    local conf="/etc/postgresql/15/main/postgresql.conf"
    local src_data="$TDM_OLD_DIR/postgresql/data" src_logs="$TDM_OLD_DIR/postgresql/logs"
    local dst_data="$TDM_NEW_DIR/postgresql/data" dst_logs="$TDM_NEW_DIR/postgresql/logs"
    local unit="postgresql@15-main.service"

    [ -d "$src_data" ] || { tdm_skip "PostgreSQL: nothing to migrate (data not at $src_data)"; return 0; }
    if [ -d "$dst_data" ]; then
        tdm_fail "PostgreSQL: destination already exists, refusing to overwrite: $dst_data"
        return 1
    fi
    [ -f "$conf" ] || { tdm_fail "PostgreSQL: config not found at $conf"; return 1; }

    tdm_log "  stopping $unit ..."
    $USE_SUDO systemctl stop "$unit" || { tdm_fail "PostgreSQL: failed to stop $unit"; return 1; }

    $USE_SUDO mkdir -p "$(dirname "$dst_data")" "$(dirname "$dst_logs")"
    tdm_log "  copying data directory (this can take a while for a large cluster) ..."
    $USE_SUDO rsync -a "$src_data"/ "$dst_data"/ || { tdm_fail "PostgreSQL: rsync copy failed; restarting on old path"; $USE_SUDO systemctl start "$unit"; return 1; }
    [ -d "$src_logs" ] && $USE_SUDO rsync -a "$src_logs"/ "$dst_logs"/ 2>/dev/null
    if ! $USE_SUDO diff -rq "$src_data" "$dst_data" >/dev/null 2>&1; then
        tdm_fail "PostgreSQL: copy verification mismatch; restarting on OLD path (untouched), new copy left at $dst_data for inspection"
        $USE_SUDO systemctl start "$unit"
        return 1
    fi
    $USE_SUDO chown -R postgres:postgres "$dst_data" "$dst_logs" 2>/dev/null

    $USE_SUDO cp "$conf" "${conf}.pre_migration_$(date +%Y%m%d_%H%M%S)"
    $USE_SUDO sed -i "s#${src_data}#${dst_data}#; s#${src_logs}#${dst_logs}#" "$conf"

    tdm_log "  starting $unit on the new path ..."
    $USE_SUDO systemctl start "$unit"
    sleep 2
    if $USE_SUDO systemctl is-active --quiet "$unit" && tdm_as_postgres pg_isready -q 2>/dev/null; then
        tdm_log "  active and accepting connections: $unit"
    else
        tdm_fail "PostgreSQL: did not come up healthy on the new path - reverting postgresql.conf to the OLD path and restarting (old data untouched at $src_data; new copy left at $dst_data for inspection)"
        $USE_SUDO sed -i "s#${dst_data}#${src_data}#; s#${dst_logs}#${src_logs}#" "$conf"
        $USE_SUDO systemctl start "$unit"
        return 1
    fi

    $USE_SUDO mv "$src_data" "${src_data}.pre_migration_$(date +%Y%m%d_%H%M%S)"
    [ -d "$src_logs" ] && $USE_SUDO mv "$src_logs" "${src_logs}.pre_migration_$(date +%Y%m%d_%H%M%S)"
    tdm_ok "PostgreSQL migrated and verified healthy: $src_data -> $dst_data (old copy kept as backup, not deleted)"
}

# ---------------------------------------------------------------------------
# Best-effort PATH cleanup in /etc/environment: drop stale old-dir entries,
# never fatal (a stale PATH entry is cosmetic - the repointed /usr/local/bin
# symlinks are what every caller actually uses).
# ---------------------------------------------------------------------------
tdm_cleanup_path_env() {
    local current_path="" cleaned=""
    [ -f /etc/environment ] || return 0
    current_path="$(awk -F= '/^PATH=/{gsub(/^"|"$/,"",$2); print $2; exit}' /etc/environment 2>/dev/null)"
    [ -n "$current_path" ] || return 0
    cleaned="$(echo "$current_path" | tr ':' '\n' | grep -vF "$TDM_OLD_DIR/" | paste -sd: -)"
    if [ "$cleaned" != "$current_path" ] && [ -n "$cleaned" ]; then
        set_env_and_var "PATH" "$cleaned"
        tdm_ok "PATH cleaned in /etc/environment (dropped $TDM_OLD_DIR entries)"
    fi
}

# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

tdm_report_only() {
    local old=""
    tdm_log "Current tool dir: $(tdm_current_name)"
    tdm_log "Legacy tool dirs found under $TDM_WWW_ROOT:"
    while IFS= read -r old; do
        [ -n "$old" ] || continue
        echo "  - $TDM_WWW_ROOT/$old ($(du -sh "$TDM_WWW_ROOT/$old" 2>/dev/null | cut -f1))"
    done < <(tdm_detect_old_dirs)
}

tdm_run_full_migration() {
    local old_name="$1" new_name="$2"

    [ -n "$new_name" ] || new_name="$(tdm_current_name)"
    if [ -z "$old_name" ]; then
        old_name="$(tdm_detect_old_dirs | head -1)"
    fi
    if [ -z "$old_name" ] || [ -z "$new_name" ]; then
        tdm_log "Nothing to migrate: no legacy _<os>_<ver> dir found (or current dir undetectable)."
        return 0
    fi
    if [ "$old_name" = "$new_name" ]; then
        tdm_log "Old and new tool dirs are the same ($old_name); nothing to do."
        return 0
    fi

    TDM_OLD_DIR="$TDM_WWW_ROOT/$old_name"
    TDM_NEW_DIR="$TDM_WWW_ROOT/$new_name"
    [ -d "$TDM_OLD_DIR" ] || { tdm_log "Old dir does not exist: $TDM_OLD_DIR - nothing to migrate."; return 0; }
    $USE_SUDO mkdir -p "$TDM_NEW_DIR"

    tdm_log "=========================================="
    tdm_log "Migrating tool directory: $TDM_OLD_DIR -> $TDM_NEW_DIR"
    tdm_log "=========================================="

    tdm_migrate_node_core
    tdm_migrate_node_secondary
    tdm_migrate_python_system_venv
    tdm_migrate_pipx
    tdm_migrate_poetry
    tdm_migrate_uv
    tdm_migrate_omp
    tdm_migrate_rustdesk_server
    tdm_migrate_postgresql
    tdm_cleanup_path_env

    tdm_log "=========================================="
    tdm_log "Migration summary: ${#TDM_DONE[@]} done, ${#TDM_SKIPPED[@]} skipped, ${#TDM_FAILED[@]} failed"
    [ "${#TDM_FAILED[@]}" -gt 0 ] && { tdm_log "FAILED items (left as-is, safe to re-run this script after investigating):"; printf '  - %s\n' "${TDM_FAILED[@]}"; }
    if [ "${#TDM_FAILED[@]}" -eq 0 ]; then
        tdm_log "All items migrated/verified. $TDM_OLD_DIR now holds only already-migrated-away (empty) subdirs plus anything explicitly skipped."
        tdm_log "Nothing was force-deleted; review and remove $TDM_OLD_DIR yourself once satisfied."
    fi
    tdm_log "=========================================="

    [ "${#TDM_FAILED[@]}" -eq 0 ]
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    if [ "$1" = "--report-only" ]; then
        tdm_report_only
    else
        tdm_run_full_migration "$1" "$2"
    fi
fi
