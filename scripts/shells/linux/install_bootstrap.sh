#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###
#
# =============================================================================
# INSTALL BOOTSTRAP - Bootstrap / launcher script (organizes logic, reuses project libs)
# =============================================================================
#
# This file is a bootstrap/launcher: it is downloaded by the temporary dd.sh and then
# receives full control. It organizes the install/repair flow and reuses project
# libraries as much as possible instead of reimplementing logic.
#
# INSTALLED DETECTION (for dd.sh, not this file):
#   dd.sh must not consider "already installed" just because some temporary libraries
#   exist. Installation is detected by (1) correct location and (2) project
#   characteristics. If dd.sh is a symlink, the check uses the RESOLVED (real) path
#   of the script (readlink -f), not the link location. Installed = real directory
#   contains scripts/ AND package.json AND main.js.
#
# FLOW (extended):
#
#   0. LAUNCHER ROOT
#      The temporary dd.sh and this bootstrap live in the same directory (launcher root).
#      All downloaded project libraries are placed under this directory in the SAME
#      relative paths as in the real repo (e.g. scripts/shells/linux/common/gvar_common.sh).
#      This allows reusing project scripts without change (they source by relative path).
#
#   1. PRE-REQUISITES
#      Install if missing: curl (or wget), ca-certificates, sudo (when root), git.
#
#   2. REPO BASE URL (deployment stage only)
#      Global = GitHub, China (Cn) = Gitee. Choice is saved to cache (e.g. ~/.core_node/SELECTED_REGION).
#      Next run: prompt "Modify region? (N/y)" — N or Enter = use cached; y = show region menu and update cache.
#
#   3. DOWNLOAD REQUIRED PROJECT LIBRARIES (first priority)
#      Download to launcher root subpaths (same layout as repo). Required libs:
#        - scripts/shells/linux/common/gvar_common.sh
#        - scripts/shells/linux/debian/install_shells/2_setting_base.sh
#      Maximize reuse: source and run these instead of duplicating logic.
#
#   4. RESOLVE PROJECT ROOT (map path)
#      Source gvar_common.sh from launcher root path to get get_base_data_directory(),
#      map_web_path(), CORE_NODE_PROJECT_ROOT. This is the correct target directory.
#
#   5. BASE SYSTEM SETUP (optional)
#      Run 2_setting_base.sh from launcher root path (disk detection, mount). It
#      sources gvar_common via its own relative path; reuses the same downloaded lib.
#
#   6. ENSURE PROJECT CLONED
#      If CORE_NODE_PROJECT_ROOT is missing or incomplete (no package.json, main.js),
#      ensure directory is empty then git clone the full project. Reuse project
#      validator logic if available (8_project_validator.sh) or inline clone steps.
#
#   7. HAND OFF TO PROJECT
#      chmod +x and exec dd.sh from CORE_NODE_PROJECT_ROOT. From then on the project
#      dd.sh runs in the real location with full project tree; installed detection
#      will see scripts/, package.json, main.js and not re-enter installation mode.
#
# Tools ensured by bootstrap (install if missing):
#   - curl or wget, ca-certificates  (HTTPS downloads)
#   - sudo                           (when root: install for system; when non-root: must exist)
#   - git                            (clone full project)
# Other tools (bash, readlink, mkdir, blkid, findmnt, etc.) from base system.
# =============================================================================

set -e

# Variable declarations
BOOTSTRAP_SCRIPT_PATH=""
BOOTSTRAP_SCRIPT_DIR=""
LAUNCHER_ROOT=""
REPO_BASE_URL=""
GVAR_RELATIVE="scripts/shells/linux/common/gvar_common.sh"
MOUNT_COMMON_RELATIVE="scripts/shells/linux/common/mount_common.sh"
PERMISSION_HELPER_RELATIVE="scripts/shells/linux/common/fs_perm_helpers.sh"
SETTING_BASE_RELATIVE="scripts/shells/linux/debian/install_shells/2_setting_base.sh"
GITHUB_RAW="https://raw.githubusercontent.com/accountbelongstox/core_node/refs/heads/main"
GITEE_RAW="https://gitee.com/accountbelongstox/core_node/raw/main"
GITHUB_REPO="https://github.com/accountbelongstox/core_node.git"
GITEE_REPO="https://gitee.com/accountbelongstox/core_node.git"
USE_SUDO=""
CORE_NODE_PROJECT_ROOT=""
REGION_CACHE_DIR=""
REGION_CACHE_FILE=""

# Resolve script path; launcher root = directory of temporary dd.sh and this bootstrap (resolve symlinks)
BOOTSTRAP_SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
BOOTSTRAP_SCRIPT_DIR="$(dirname "$BOOTSTRAP_SCRIPT_PATH")"
LAUNCHER_ROOT="$BOOTSTRAP_SCRIPT_DIR"

# Region cache (deployment stage only): persist Global/China so next run prompts "Modify region? (N/y)"
REGION_CACHE_DIR="${HOME}/.core_node"
REGION_CACHE_FILE="$REGION_CACHE_DIR/SELECTED_REGION"
[ "$(id -u)" -eq 0 ] && REGION_CACHE_DIR="/var/_core_node" && REGION_CACHE_FILE="$REGION_CACHE_DIR/SELECTED_REGION"

# Use repo base URL from environment if set (passed by dd.sh after region selection)
REPO_BASE_URL="${REPO_BASE_URL:-}"

log_info() { echo -e "\033[36m[BOOTSTRAP] $1\033[0m"; }
log_ok() { echo -e "\033[32m[BOOTSTRAP] $1\033[0m"; }
log_warn() { echo -e "\033[33m[BOOTSTRAP] $1\033[0m"; }
log_err() { echo -e "\033[31m[BOOTSTRAP] $1\033[0m"; }

# Step 0: Ensure repo base URL (region). Cache choice; next run prompt "Modify region? (N/y)" (deployment stage only).
ensure_repo_base_url() {
    if [ -n "$REPO_BASE_URL" ]; then
        log_ok "Using repo base URL: $REPO_BASE_URL"
        return 0
    fi

    local cached_region=""
    if [ -s "$REGION_CACHE_FILE" ]; then
        cached_region=$(cat "$REGION_CACHE_FILE" 2>/dev/null | head -n1 | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    fi

    if [ -n "$cached_region" ] && { [ "$cached_region" = "Global" ] || [ "$cached_region" = "China" ]; }; then
        echo ""
        echo -n "Modify region? (N/y) [current: $cached_region]: "
        read -r modify_region
        if [ "$modify_region" = "y" ] || [ "$modify_region" = "Y" ]; then
            cached_region=""
        fi
    else
        cached_region=""
    fi

    if [ -z "$cached_region" ]; then
        echo ""
        echo "Select download region:"
        echo "  1) Global (GitHub)"
        echo "  2) China (Gitee)"
        echo -n "Choice (1 or 2) [1]: "
        read -r choice
        case "${choice:-1}" in
            2) cached_region="China"; REPO_BASE_URL="$GITEE_RAW"; log_ok "Region: Gitee (China)"; ;;
            *) cached_region="Global"; REPO_BASE_URL="$GITHUB_RAW"; log_ok "Region: GitHub (Global)"; ;;
        esac
        mkdir -p "$REGION_CACHE_DIR"
        echo "$cached_region" > "$REGION_CACHE_FILE" 2>/dev/null || true
    else
        if [ "$cached_region" = "China" ]; then
            REPO_BASE_URL="$GITEE_RAW"
            log_ok "Using cached region: China (Gitee)"
        else
            REPO_BASE_URL="$GITHUB_RAW"
            log_ok "Using cached region: Global (GitHub)"
        fi
    fi
}

# Step 1a: Pre-requisites - install curl and/or wget (needed for downloading bootstrap files)
install_curl_wget_if_missing() {
    if command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1; then
        log_ok "curl or wget is available"
        return 0
    fi
    log_info "Installing curl (required for downloads)..."
    if [ "$(id -u)" -eq 0 ]; then
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update -qq && apt-get install -y curl ca-certificates
        elif command -v yum >/dev/null 2>&1; then
            yum install -y curl ca-certificates
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y curl ca-certificates
        elif command -v apk >/dev/null 2>&1; then
            apk add --no-cache curl ca-certificates
        else
            log_err "No supported package manager. Install curl or wget manually."
            return 1
        fi
    else
        if command -v sudo >/dev/null 2>&1; then
            USE_SUDO="sudo"
            if command -v apt-get >/dev/null 2>&1; then
                $USE_SUDO apt-get update -qq && $USE_SUDO apt-get install -y curl ca-certificates
            elif command -v yum >/dev/null 2>&1; then
                $USE_SUDO yum install -y curl ca-certificates
            elif command -v dnf >/dev/null 2>&1; then
                $USE_SUDO dnf install -y curl ca-certificates
            elif command -v apk >/dev/null 2>&1; then
                $USE_SUDO apk add --no-cache curl ca-certificates
            else
                log_err "No supported package manager. Install curl or wget manually."
                return 1
            fi
        else
            log_err "curl/wget not found and sudo not available. Install curl or wget manually."
            return 1
        fi
    fi
    if command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1; then
        log_ok "curl or wget installed successfully"
        return 0
    fi
    log_err "Failed to install curl or wget"
    return 1
}

# Step 1b: Pre-requisites - install sudo if missing (when root, install for system; when non-root, need sudo for clone/chown)
install_sudo_if_missing() {
    if command -v sudo >/dev/null 2>&1; then
        log_ok "sudo is available"
        return 0
    fi
    if [ "$(id -u)" -ne 0 ]; then
        log_warn "sudo not found and not running as root. Install sudo or run this script as root."
        return 0
    fi
    log_info "Installing sudo..."
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq && apt-get install -y sudo
    elif command -v yum >/dev/null 2>&1; then
        yum install -y sudo
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y sudo
    elif command -v apk >/dev/null 2>&1; then
        apk add --no-cache sudo
    else
        log_warn "Could not install sudo (no supported package manager)."
        return 0
    fi
    if command -v sudo >/dev/null 2>&1; then
        log_ok "sudo installed successfully"
    else
        log_warn "sudo installation failed"
    fi
    return 0
}

# Step 1c: Pre-requisites - install git (needed for cloning project)
install_git_if_missing() {
    if command -v git >/dev/null 2>&1; then
        log_ok "Git is already installed"
        return 0
    fi
    log_info "Installing git..."
    if [ "$(id -u)" -eq 0 ]; then
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update -qq && apt-get install -y git
        elif command -v yum >/dev/null 2>&1; then
            yum install -y git
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y git
        elif command -v apk >/dev/null 2>&1; then
            apk add --no-cache git
        else
            log_err "No supported package manager (apt/yum/dnf/apk). Install git manually."
            return 1
        fi
    else
        if command -v sudo >/dev/null 2>&1; then
            USE_SUDO="sudo"
            if command -v apt-get >/dev/null 2>&1; then
                $USE_SUDO apt-get update -qq && $USE_SUDO apt-get install -y git
            elif command -v yum >/dev/null 2>&1; then
                $USE_SUDO yum install -y git
            elif command -v dnf >/dev/null 2>&1; then
                $USE_SUDO dnf install -y git
            elif command -v apk >/dev/null 2>&1; then
                $USE_SUDO apk add --no-cache git
            else
                log_err "No supported package manager. Install git manually."
                return 1
            fi
        else
            log_err "Git not found and sudo not available. Install git manually."
            return 1
        fi
    fi
    if command -v git >/dev/null 2>&1; then
        log_ok "Git installed successfully"
        return 0
    fi
    log_err "Git installation failed"
    return 1
}

# Common download with progress (same behavior as dd.sh download_with_progress)
download_with_progress() {
    local url="$1"
    local dest_path="$2"
    local dir_dest
    dir_dest="$(dirname "$dest_path")"
    mkdir -p "$dir_dest"
    if command -v curl >/dev/null 2>&1; then
        curl -# -f -L -o "$dest_path" "$url" && [ -s "$dest_path" ] && return 0
    fi
    if command -v wget >/dev/null 2>&1; then
        wget --progress=bar:force -O "$dest_path" "$url" && [ -s "$dest_path" ] && return 0
    fi
    return 1
}

# Download a single file from REPO_BASE_URL to destination path; show progress
download_to() {
    local rel_path="$1"
    local dest_path="$2"
    local url="$REPO_BASE_URL/$rel_path"
    log_info "Downloading $rel_path ..."
    if download_with_progress "$url" "$dest_path"; then
        return 0
    fi
    return 1
}

# Step 3: Download all required project libraries to launcher root subpaths (first priority; maximize reuse)
download_required_libraries() {
    log_info "Downloading required project libraries to launcher root (same paths as repo)..."
    local gvar_path="$LAUNCHER_ROOT/$GVAR_RELATIVE"
    local setting_path="$LAUNCHER_ROOT/$SETTING_BASE_RELATIVE"
    if ! download_to "$GVAR_RELATIVE" "$gvar_path"; then
        log_err "Failed to download gvar_common.sh"
        return 1
    fi
    log_ok "gvar_common.sh"
    local mount_path="$LAUNCHER_ROOT/$MOUNT_COMMON_RELATIVE"
    if ! download_to "$MOUNT_COMMON_RELATIVE" "$mount_path"; then
        log_err "Failed to download mount_common.sh"
        return 1
    fi
    log_ok "mount_common.sh"
    if ! download_to "$SETTING_BASE_RELATIVE" "$setting_path"; then
        log_warn "Could not download 2_setting_base.sh (optional)"
    else
        log_ok "2_setting_base.sh"
    fi
    return 0
}

# Step 4: Source gvar_common from launcher path, get CORE_NODE_PROJECT_ROOT (map path)
resolve_project_root() {
    local gvar_path="$LAUNCHER_ROOT/$GVAR_RELATIVE"
    if [ ! -s "$gvar_path" ]; then
        log_err "gvar_common.sh not found at $gvar_path (run download_required_libraries first)"
        return 1
    fi
    log_info "Sourcing gvar_common.sh to get map path and CORE_NODE_PROJECT_ROOT..."
    # shellcheck source=scripts/shells/linux/common/gvar_common.sh
    source "$gvar_path"
    if [ -z "${CORE_NODE_PROJECT_ROOT:-}" ]; then
        CORE_NODE_PROJECT_ROOT="$(get_base_data_directory)/programing/core_node"
    fi
    persist_base_data_directory "${CORE_NODE_PROJECT_ROOT%/programing/core_node}"
    log_ok "Project directory (map path): $CORE_NODE_PROJECT_ROOT"
    return 0
}

# Step 5: Run 2_setting_base.sh from launcher path (reuse downloaded project library)
run_setting_base_if_desired() {
    local setting_path="$LAUNCHER_ROOT/$SETTING_BASE_RELATIVE"
    if [ ! -s "$setting_path" ]; then
        log_warn "2_setting_base.sh not found; skipping disk setup"
        return 0
    fi
    log_info "Running base system setup (disk detection, mount) via project library..."
    bash "$setting_path" || true
    local gvar_path="$LAUNCHER_ROOT/$GVAR_RELATIVE"
    if [ -s "$gvar_path" ]; then
        source "$gvar_path"
        if [ -z "${CORE_NODE_PROJECT_ROOT:-}" ]; then
            CORE_NODE_PROJECT_ROOT="$(get_base_data_directory)/programing/core_node"
        fi
        persist_base_data_directory "${CORE_NODE_PROJECT_ROOT%/programing/core_node}"
        log_ok "Project directory after base setup: $CORE_NODE_PROJECT_ROOT"
    fi
    return 0
}

# SAFETY GUARD (mandatory): authorise deletion of a core_node directory ONLY after
# explicit TRIPLE confirmation, each defaulting to NO. Hard-refuses outright when the
# target is a system path OR a git working tree (it may be the live, locally-modified
# project being run -- which is exactly how a re-clone once wiped real work). A
# non-interactive run (no TTY) ALWAYS refuses. Returns 0 only when deletion is
# explicitly authorised three times. See development-guides/CORE_NODE_DELETION_SAFETY.md.
confirm_core_node_deletion() {
    local target="$1"
    local i ans
    case "$target" in
        ""|"/"|"/usr"|"/usr/"*|"/etc"|"/etc/"*|"/bin"|"/bin/"*|"/sbin"|"/sbin/"*|"/lib"|"/lib/"*|"/var"|"/var/"*|"/home"|"/root"|"/opt"|"/mnt"|"/www"|"/www/"*)
            log_err "[DELETE-GUARD] Refusing to delete a system/critical path: '$target'"
            return 1 ;;
    esac
    if [ -e "$target/.git" ]; then
        log_err "[DELETE-GUARD] '$target' is a git repository (a working tree, possibly with"
        log_err "[DELETE-GUARD] uncommitted changes). REFUSING to delete it automatically."
        log_err "[DELETE-GUARD] If you must replace it, move/rename it MANUALLY, then re-run."
        return 1
    fi
    if [ ! -t 0 ] || [ ! -r /dev/tty ]; then
        log_err "[DELETE-GUARD] No interactive terminal; refusing to delete '$target' (default = NO)."
        return 1
    fi
    log_warn "[DELETE-GUARD] About to DELETE the core_node directory: $target"
    log_warn "[DELETE-GUARD] This is IRREVERSIBLE and destroys any local changes there."
    for i in 1 2 3; do
        printf '[DELETE-GUARD] Confirmation %d of 3 - permanently delete "%s"? [N/y]: ' "$i" "$target" > /dev/tty
        read -r ans < /dev/tty || ans=""
        case "$ans" in
            [Yy]) : ;;
            *) log_info "[DELETE-GUARD] Deletion cancelled at step $i (default No). Nothing was removed."; return 1 ;;
        esac
    done
    log_warn "[DELETE-GUARD] All three confirmations received; proceeding to delete $target"
    return 0
}

# Step 6: Check if project exists at CORE_NODE_PROJECT_ROOT; if not or incomplete, clone full project
ensure_project_cloned() {
    local repo_url="$GITHUB_REPO"
    [ "$REPO_BASE_URL" = "$GITEE_RAW" ] && repo_url="$GITEE_REPO"

    # ADOPT an existing project as authoritative. A git working tree OR a tree with
    # package.json is real work and must NEVER be deleted/re-cloned (a "partial
    # clone" verdict must adopt-or-abort). This is broader than the old
    # package.json+main.js gate so a transiently-incomplete checkout is not wiped.
    if [ -d "$CORE_NODE_PROJECT_ROOT" ] && { [ -e "$CORE_NODE_PROJECT_ROOT/.git" ] || [ -f "$CORE_NODE_PROJECT_ROOT/package.json" ]; }; then
        log_ok "Adopting existing core_node project at: $CORE_NODE_PROJECT_ROOT (not re-cloning)"
        return 0
    fi

    # The web data base is forced onto a POSIX fs (e.g. /www), but the SOURCE tree
    # may be checked out elsewhere (e.g. the large /mnt data disk). Before cloning a
    # duplicate, discover an existing checkout and adopt its location so we align
    # with where the user actually works instead of re-cloning over /www.
    local _discovered=""
    local _cand=""
    for _cand in \
        "$(get_base_data_directory 2>/dev/null)/programing/core_node" \
        "${BASE_DATA_DIR_FILE:+$(head -n1 "$BASE_DATA_DIR_FILE" 2>/dev/null)/programing/core_node}" \
        /mnt/*/programing/core_node \
        /www/programing/core_node; do
        [ -n "$_cand" ] || continue
        if [ -d "$_cand" ] && { [ -e "$_cand/.git" ] || [ -f "$_cand/package.json" ]; }; then
            _discovered="$_cand"
            break
        fi
    done
    if [ -n "$_discovered" ] && [ "$_discovered" != "$CORE_NODE_PROJECT_ROOT" ]; then
        log_ok "Found an existing core_node checkout; adopting it instead of re-cloning: $_discovered"
        CORE_NODE_PROJECT_ROOT="$_discovered"
        return 0
    fi

    log_info "Project missing or incomplete at $CORE_NODE_PROJECT_ROOT"

    if [ -d "$CORE_NODE_PROJECT_ROOT" ]; then
        if [ -n "$(ls -A "$CORE_NODE_PROJECT_ROOT" 2>/dev/null)" ]; then
            # NEVER silently wipe a populated core_node dir: it may be the live,
            # locally-modified working tree. Require the triple-confirm guard, which
            # also hard-refuses git repos and non-interactive runs.
            if ! confirm_core_node_deletion "$CORE_NODE_PROJECT_ROOT"; then
                log_err "Aborted: not deleting $CORE_NODE_PROJECT_ROOT."
                log_err "Back up/move it, or clone into an empty directory, then run again."
                return 1
            fi
            log_info "Removing $CORE_NODE_PROJECT_ROOT"
            echo "  $USE_SUDO rm -rf $CORE_NODE_PROJECT_ROOT"
            $USE_SUDO rm -rf "$CORE_NODE_PROJECT_ROOT"
        fi
    fi

    echo "  $USE_SUDO mkdir -p $(dirname "$CORE_NODE_PROJECT_ROOT")"
    $USE_SUDO mkdir -p "$(dirname "$CORE_NODE_PROJECT_ROOT")"
    log_info "Cloning full project from $repo_url into $CORE_NODE_PROJECT_ROOT"
    echo "  $USE_SUDO git clone $repo_url $CORE_NODE_PROJECT_ROOT"
    if $USE_SUDO git clone "$repo_url" "$CORE_NODE_PROJECT_ROOT"; then
        log_ok "Project cloned successfully"
    else
        log_err "Git clone failed"
        return 1
    fi

    return 0
}

# Step 7: Exec project dd.sh (hand off to project; installed detection will see full tree)
exec_project_dd() {
    local dd_sh="$CORE_NODE_PROJECT_ROOT/dd.sh"
    local permission_helper="$CORE_NODE_PROJECT_ROOT/$PERMISSION_HELPER_RELATIVE"

    # shellcheck source=/dev/null
    source "$permission_helper"
    repair_owned_tree_777 "$CORE_NODE_PROJECT_ROOT"

    if [ ! -s "$dd_sh" ]; then
        log_err "Project dd.sh not found at $dd_sh"
        return 1
    fi
    echo "  $USE_SUDO chmod +x $dd_sh"
    $USE_SUDO chmod +x "$dd_sh"
    log_ok "Handing off to project dd.sh at $dd_sh"
    exec bash "$dd_sh"
}

# Main bootstrap flow
main_bootstrap() {
    log_info "Install bootstrap started (dd.sh has handed off all control to this script)."
    if [ "$(id -u)" -eq 0 ]; then
        USE_SUDO=""
    else
        command -v sudo >/dev/null 2>&1 && USE_SUDO="sudo" || USE_SUDO=""
    fi
    install_curl_wget_if_missing || exit 1
    install_sudo_if_missing
    ensure_repo_base_url
    install_git_if_missing || exit 1
    download_required_libraries || exit 1
    resolve_project_root || exit 1
    run_setting_base_if_desired
    ensure_project_cloned || exit 1
    exec_project_dd
}

main_bootstrap "$@"
