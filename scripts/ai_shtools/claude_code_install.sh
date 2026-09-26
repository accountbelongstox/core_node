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

# Canonical Claude Code install workflow (Linux). Single source of truth shared by
# the dd.sh AI & MCP Management menu, the install_shells 171 step and every claude*
# launcher (via ai_cli_provision). Source this file, then call claude_code_install:
#   1. Idempotently install missing prerequisites, then Claude Code itself through the
#      OFFICIAL NATIVE installer, run as the real user (get_real_user) so the per-user
#      install lands in that user's home. claude.ai/install.sh is tried first; its
#      official CDN target (downloads.claude.ai bootstrap.sh) is the fallback when the
#      claude.ai front door refuses the request (e.g. HTTP 403).
#   2. Make claude usable by EVERY user through /usr/local/bin: symlink when the newest
#      working binary is world-reachable, otherwise copy the self-contained binary (0755).
#   3. Link the claudeteam launcher into /usr/local/bin.
# "Installed" means a claude binary that actually answers --version (dangling launcher
# symlinks left behind by pruned native versions do not count).

# scripts/ai_shtools/claude_code_install.sh -> core_node root is two levels up.
CCI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCI_CORE_NODE_DIR="$(cd "$CCI_SCRIPT_DIR/../.." && pwd)"
CCI_LINUXENVS_DIR="$CCI_CORE_NODE_DIR/scripts/linuxenvs"
CCI_REAL_USER_LIB="$CCI_CORE_NODE_DIR/scripts/shells/linux/common/get_real_user.sh"
CCI_BIN_DIR="/usr/local/bin"
CCI_EXEC="claude"
CCI_INSTALLER_URLS=(
    "https://claude.ai/install.sh"
    "https://downloads.claude.ai/claude-code-releases/bootstrap.sh"
)
CCI_VERSION_TIMEOUT_SECONDS="10"
CCI_TEAM_SRC="$CCI_LINUXENVS_DIR/claudeteam.sh"
CCI_REAL_USER=""
CCI_REAL_HOME=""

# Fallback print_color when run standalone (the main menu provides the real one).
if ! command -v print_color >/dev/null 2>&1; then
    print_color() {
        # Args: message [level]; level is informational only in the fallback.
        printf '%s\n' "$1"
    }
fi

# Run a privileged command directly as root, otherwise through sudo.
cci_sudo() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo "$@"
    else
        "$@"
    fi
}

# Run a /usr/local/bin write with sudo only when the bin dir is not writable.
cci_bin_sudo() {
    if [ -w "$CCI_BIN_DIR" ]; then
        "$@"
    else
        cci_sudo "$@"
    fi
}

# Resolve the real (interactive) user through the shared get_real_user helper when
# running as root; a regular user installs for themselves.
cci_resolve_real_user() {
    if [ -n "$CCI_REAL_USER" ]; then
        return 0
    fi
    if [ "$(id -u)" -eq 0 ]; then
        . "$CCI_REAL_USER_LIB" >/dev/null 2>&1
        CCI_REAL_USER="$(get_real_user 2>/dev/null | tail -n 1)"
        CCI_REAL_HOME="$(get_real_user_home 2>/dev/null | tail -n 1)"
    fi
    if [ -z "$CCI_REAL_USER" ] || [ -z "$CCI_REAL_HOME" ] || [ ! -d "$CCI_REAL_HOME" ]; then
        CCI_REAL_USER="$(id -un)"
        CCI_REAL_HOME="$HOME"
    fi
}

# Run a command as the real user (root -> regular user), otherwise as the current
# user. Root installing for itself is allowed explicitly by the official installer.
cci_run_as_real_user() {
    if [ "$(id -u)" -eq 0 ] && [ "$CCI_REAL_USER" != "root" ] && [ "$CCI_REAL_USER" != "$(id -un)" ]; then
        if command -v runuser >/dev/null 2>&1; then
            runuser -u "$CCI_REAL_USER" -- env HOME="$CCI_REAL_HOME" USER="$CCI_REAL_USER" LOGNAME="$CCI_REAL_USER" "$@"
        else
            su -s /bin/bash "$CCI_REAL_USER" -c "$(printf '%q ' env HOME="$CCI_REAL_HOME" USER="$CCI_REAL_USER" LOGNAME="$CCI_REAL_USER" "$@")"
        fi
    else
        env CLAUDE_INSTALL_ALLOW_SUDO=1 "$@"
    fi
}

# Install packages with whichever system package manager is present.
cci_pkg_install() {
    if command -v apt-get >/dev/null 2>&1; then
        cci_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" || {
            cci_sudo apt-get update -y
            cci_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
        }
    elif command -v dnf >/dev/null 2>&1; then
        cci_sudo dnf install -y "$@"
    elif command -v yum >/dev/null 2>&1; then
        cci_sudo yum install -y "$@"
    elif command -v apk >/dev/null 2>&1; then
        cci_sudo apk add --no-cache "$@"
    elif command -v pacman >/dev/null 2>&1; then
        cci_sudo pacman -S --noconfirm --needed "$@"
    elif command -v zypper >/dev/null 2>&1; then
        cci_sudo zypper --non-interactive install "$@"
    else
        echo "[WARN] No supported package manager found to install: $*"
        return 1
    fi
}

# Idempotently install only the tools the official native installer needs and lacks
# (downloader, sha256sum, CA bundle; Alpine additionally needs libgcc/libstdc++/ripgrep).
cci_ensure_prereqs() {
    local missing=()
    if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
        missing+=(curl)
    fi
    command -v sha256sum >/dev/null 2>&1 || missing+=(coreutils)
    if [ ! -s /etc/ssl/certs/ca-certificates.crt ] && [ ! -s /etc/pki/tls/certs/ca-bundle.crt ]; then
        missing+=(ca-certificates)
    fi
    if [ -f /etc/alpine-release ]; then
        command -v rg >/dev/null 2>&1 || missing+=(ripgrep)
        [ -e /usr/lib/libstdc++.so.6 ] || missing+=(libstdc++ libgcc)
    fi
    if [ "${#missing[@]}" -eq 0 ]; then
        return 0
    fi
    echo "[PREREQ] Installing missing tools: ${missing[*]}"
    cci_pkg_install "${missing[@]}" || true
}

# Download a URL to a file with curl or wget.
cci_download() {
    local url="$1" dest="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --retry 2 -o "$dest" "$url"
    else
        wget -q -O "$dest" "$url"
    fi
}

# Print the "x.y.z" version a claude binary reports, or nothing when it does not run.
cci_claude_version() {
    timeout "$CCI_VERSION_TIMEOUT_SECONDS" "$1" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1
}

# Symlink a source script/binary into /usr/local/bin as <name> (and make it
# executable). Mode "keep" leaves an existing identical symlink untouched.
cci_link_into_bin() {
    local src="$1" name="$2" mode="$3"
    local dest="$CCI_BIN_DIR/$name"
    if [ ! -e "$src" ]; then
        echo "[WARN] Link source not found: $src"
        return 1
    fi
    # Never self-link: when the source resolves to the destination (e.g. claude was located
    # as the already-shared /usr/local/bin/claude), a symlink-to-self would break the binary.
    if [ -e "$dest" ] && \
       [ "$(readlink -f "$src" 2>/dev/null)" = "$(readlink -f "$dest" 2>/dev/null)" ]; then
        return 0
    fi
    # Idempotent: nothing to do when the symlink already points at src.
    if [ "$mode" = "keep" ] && [ -L "$dest" ] && \
       [ "$(readlink "$dest" 2>/dev/null)" = "$src" ]; then
        return 0
    fi
    cci_bin_sudo mkdir -p "$CCI_BIN_DIR"
    cci_bin_sudo chmod +x "$src" 2>/dev/null || true
    cci_bin_sudo ln -sfn "$src" "$dest"
    echo "[LINK] $name -> $src"
}

# True when every user can traverse to and execute the given path (i.e. it is not
# trapped under a mode-700 home such as /root or /home/<user>). Walks each parent
# directory checking the world-execute bit, then the world-execute bit on the file.
cci_others_can_access() {
    local path="$1"
    local p
    p="$(readlink -f "$path" 2>/dev/null || echo "$path")"
    [ -e "$p" ] || return 1
    # Every ancestor directory must be world-executable (traversable).
    local dir="$p"
    while [ "$dir" != "/" ] && [ -n "$dir" ]; do
        dir="$(dirname "$dir")"
        if [ -d "$dir" ]; then
            local perms
            perms="$(stat -c '%A' "$dir" 2>/dev/null || echo "")"
            case "$perms" in
                ?????????x*) ;;          # world-execute set
                "")          ;;          # stat failed; don't block on it
                *) return 1 ;;
            esac
        fi
        [ "$dir" = "/" ] && break
    done
    # The target itself must be world-executable.
    local fperms
    fperms="$(stat -c '%A' "$p" 2>/dev/null || echo "")"
    case "$fperms" in
        ????????x*|?????????x) return 0 ;;
        "")                    return 0 ;;
        *)                     return 1 ;;
    esac
}

# Locate the newest WORKING claude binary on this machine: the real user's and the
# current user's native launchers, root and every /home user, the PATH hit, the shared
# /usr/local/bin copy and the apt/dnf package. Candidates that fail --version (e.g. a
# launcher whose version directory was pruned) are ignored.
cci_find_claude() {
    local candidate="" version="" best="" best_version=""
    cci_resolve_real_user
    for candidate in \
        "$CCI_REAL_HOME/.local/bin/claude" \
        "$HOME/.local/bin/claude" \
        "/root/.local/bin/claude" \
        /home/*/.local/bin/claude \
        "$(command -v claude 2>/dev/null)" \
        "$CCI_BIN_DIR/$CCI_EXEC" \
        "/usr/bin/claude" \
        "$CCI_REAL_HOME/.claude/local/claude" \
        "$HOME/.claude/local/claude"; do
        [ -n "$candidate" ] && [ -x "$candidate" ] || continue
        version="$(cci_claude_version "$candidate")"
        [ -n "$version" ] || continue
        if [ -z "$best" ] || [ "$(printf '%s\n%s\n' "$best_version" "$version" | sort -V | tail -n 1)" != "$best_version" ]; then
            best="$candidate"
            best_version="$version"
        fi
    done
    if [ -n "$best" ]; then
        printf '%s' "$best"
        return 0
    fi
    return 1
}

# Run the official native installer as the real user, unless a working claude already
# exists anywhere (idempotent). Falls back to the official CDN bootstrap URL when the
# claude.ai front door fails; the installer is saved to a file first so an HTTP error
# never pipes an empty or HTML body into bash.
cci_install_native() {
    local existing="" installer="" url="" rc=1
    existing="$(cci_find_claude 2>/dev/null || true)"
    if [ -n "$existing" ]; then
        echo "[SKIP] claude already installed ($existing); skipping native install (bin still synced to all users below)."
        return 0
    fi
    cci_ensure_prereqs
    installer="$(mktemp)"
    for url in "${CCI_INSTALLER_URLS[@]}"; do
        echo "[INSTALL] Fetching official native installer: $url"
        if cci_download "$url" "$installer" && head -n 1 "$installer" | grep -q '^#!'; then
            chmod 0644 "$installer"
            echo "[INSTALL] Running official native installer as $CCI_REAL_USER ($CCI_REAL_HOME)"
            if cci_run_as_real_user bash -c 'cd "$HOME" && bash "$1"' _ "$installer"; then
                rc=0
                break
            fi
        fi
        echo "[WARN] Official native installer failed from $url"
    done
    rm -f "$installer"
    return "$rc"
}

# Make claude usable by EVERY user (regular users + root). Per-user native installs
# live under mode-700 homes, so a /usr/local/bin symlink would be unreachable by
# anyone but the owner. The native build is a single self-contained executable, so
# when the resolved target is not world-reachable it is COPIED into /usr/local/bin
# (0755); when it IS world-reachable a symlink is kept so native updates are tracked.
# Idempotent: skips when the shared copy is already identical.
cci_install_claude_all_users() {
    local src="$1"
    local resolved=""
    local dest="$CCI_BIN_DIR/$CCI_EXEC"

    resolved="$(readlink -f "$src" 2>/dev/null || echo "$src")"

    if cci_others_can_access "$resolved"; then
        cci_link_into_bin "$src" "$CCI_EXEC" "keep"
        echo "[OK] claude reachable by all users via: $dest -> $resolved"
        return 0
    fi

    if [ ! -f "$resolved" ]; then
        echo "[ERROR] Resolved claude is not a regular file: $resolved"
        return 1
    fi

    if [ -f "$dest" ] && [ ! -L "$dest" ] && cmp -s "$resolved" "$dest"; then
        echo "[OK] Shared claude already up to date: $dest"
        return 0
    fi

    echo "[FIX] $resolved is under a non-world-readable home; copying it into $CCI_BIN_DIR for all users."
    cci_bin_sudo mkdir -p "$CCI_BIN_DIR"
    cci_bin_sudo rm -f "$dest"
    if cci_bin_sudo cp -f "$resolved" "$dest" && cci_bin_sudo chmod 0755 "$dest"; then
        echo "[COPY] Installed shared claude for all users: $dest"
        return 0
    fi
    echo "[ERROR] Failed to install shared claude at $dest"
    return 1
}

# Link the claudeteam launcher (and its .sh alias) for all users.
cci_setup_claudeteam() {
    cci_link_into_bin "$CCI_TEAM_SRC" "claudeteam"
    cci_link_into_bin "$CCI_TEAM_SRC" "claudeteam.sh"
}

# Main entry: install (native, idempotent) -> make claude usable by all users -> link
# claudeteam. Returns non-zero when the shared claude is still not runnable.
claude_code_install() {
    local bin_path=""

    cci_resolve_real_user

    print_color "[STEP 1/3] Install Claude Code (official native installer, user: $CCI_REAL_USER)" "Info"
    cci_install_native || echo "[ERROR] Every official native installer source failed."
    echo ""

    print_color "[STEP 2/3] Install claude into $CCI_BIN_DIR for all users" "Info"
    bin_path="$(cci_find_claude || true)"
    if [ -z "$bin_path" ]; then
        echo "[ERROR] Could not locate a working claude binary after installation."
    else
        echo "[FOUND] claude binary: $bin_path"
        cci_install_claude_all_users "$bin_path" || true
    fi
    echo ""

    print_color "[STEP 3/3] Link claudeteam launcher into $CCI_BIN_DIR (all users)" "Info"
    cci_setup_claudeteam || true
    echo ""

    hash -r 2>/dev/null || true
    if [ -n "$(cci_claude_version "$CCI_BIN_DIR/$CCI_EXEC")" ]; then
        echo "[OK] claude is installed and runnable from $CCI_BIN_DIR/$CCI_EXEC."
        return 0
    fi
    echo "[WARN] claude did not report a version from $CCI_BIN_DIR/$CCI_EXEC."
    return 1
}

# Allow direct execution (./claude_code_install.sh) in addition to sourcing.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    claude_code_install "$@"
fi
