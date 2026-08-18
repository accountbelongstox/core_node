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
# the dd.sh AI & MCP Management menu and the install_shells 129 step. Source this
# file, then call claude_code_install. The workflow:
#   1. Install Claude Code via the OFFICIAL NATIVE installer (idempotent: skipped if
#      claude already works).
#   2. Make claude usable by EVERY user (regular users + root): the native build is a
#      single self-contained ELF and per-user homes are mode 700, so a /usr/local/bin
#      symlink would be unreachable by other users. When the resolved binary is not
#      world-reachable the self-contained binary is COPIED into /usr/local/bin (0755)
#      so all users can run it; when it IS reachable it is symlinked (so native
#      auto-updates track).
#   3. Link the claudeteam launcher (scripts/linuxenvs/claudeteam.sh, the Linux
#      mirror of scripts/winenvs/claudeteam.ps1) into /usr/local/bin too.
#      claudeteam launches Claude Code with multiple roles (experimental agent
#      teams) and ultracode enabled by default.
#
# Privilege model:
#   - root / writable bin dir : link directly (root is already in sudo mode).
#   - regular user            : use sudo for the /usr/local/bin writes.

# scripts/ai_shtools/claude_code_install.sh -> core_node root is two levels up.
CCI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCI_CORE_NODE_DIR="$(cd "$CCI_SCRIPT_DIR/../.." && pwd)"
CCI_LINUXENVS_DIR="$CCI_CORE_NODE_DIR/scripts/linuxenvs"
CCI_BIN_DIR="/usr/local/bin"
CCI_EXEC="claude"
CCI_NATIVE_INSTALL_URL="https://claude.ai/install.sh"
CCI_TEAM_SRC="$CCI_LINUXENVS_DIR/claudeteam.sh"

# Fallback print_color when run standalone (the main menu provides the real one).
if ! command -v print_color >/dev/null 2>&1; then
    print_color() {
        # Args: message [level]; level is informational only in the fallback.
        printf '%s\n' "$1"
    }
fi

# Run a /usr/local/bin write with sudo only when the bin dir is not writable.
cci_bin_sudo() {
    if [ -w "$CCI_BIN_DIR" ]; then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo "$@"
    else
        "$@"
    fi
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
    cci_bin_sudo ln -sf "$src" "$dest"
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

# Locate the claude binary on this machine. PATH first, then EVERY user's native
# per-user install location (root AND all regular users), then the shared /usr/local/bin
# copy LAST. Searching other users' homes is essential when 129 runs as root but claude
# was installed by a regular user under /home/<user>/.local/bin — otherwise the install is
# not detected (re-runs the installer) and there is no source to sync to all users.
cci_find_claude() {
    local c candidate
    c="$(command -v claude 2>/dev/null)"
    if [ -n "$c" ]; then
        printf '%s' "$c"
        return 0
    fi
    for candidate in \
        "$HOME/.local/bin/claude" \
        "$HOME/.claude/local/claude" \
        "/root/.local/bin/claude" \
        "/root/.claude/local/claude" \
        /home/*/.local/bin/claude \
        /home/*/.claude/local/claude \
        "$CCI_BIN_DIR/$CCI_EXEC"; do
        if [ -x "$candidate" ]; then
            printf '%s' "$candidate"
            return 0
        fi
    done
    return 1
}

# Run the official native installer, unless claude already works (idempotent). "Installed"
# means a working claude found ANYWHERE (current PATH, the shared bin, or ANY user's native
# home) — not just the running user's PATH; otherwise running as root re-installs even when
# a regular user already has it. When skipped, the caller still syncs the bin to all users.
cci_install_native() {
    local existing
    existing="$(cci_find_claude 2>/dev/null || true)"
    if [ -n "$existing" ] && timeout 10 "$existing" --version >/dev/null 2>&1; then
        echo "[SKIP] claude already installed ($existing); skipping native install (bin still synced to all users below)."
        return 0
    fi
    echo "[INSTALL] Running official native installer: $CCI_NATIVE_INSTALL_URL"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$CCI_NATIVE_INSTALL_URL" | bash
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$CCI_NATIVE_INSTALL_URL" | bash
    else
        echo "[ERROR] Neither curl nor wget is available to fetch the installer."
        return 1
    fi
}

# Make claude usable by EVERY user (regular users + root), fixing the common
# permission problem: the native installer is per-user (~/.local/...) and the
# resolved binary lives under a mode-700 home (/root or /home/<user>), so a
# /usr/local/bin symlink is unreachable by anyone but the owner.
#
# The modern native build is a single self-contained executable, so when the
# resolved target is not world-reachable we COPY it into /usr/local/bin (0755) --
# that works for all users without exposing the owner's home. When the target IS
# already world-reachable we keep a symlink so native auto-updates are tracked.
# Idempotent: skips when the shared copy is already identical.
cci_install_claude_all_users() {
    local src="$1"
    local resolved=""
    local dest="$CCI_BIN_DIR/$CCI_EXEC"

    resolved="$(readlink -f "$src" 2>/dev/null || echo "$src")"

    if cci_others_can_access "$resolved"; then
        # Reachable by everyone: symlink to the stable launcher (tracks updates).
        cci_link_into_bin "$src" "$CCI_EXEC" "keep"
        echo "[OK] claude reachable by all users via symlink: $dest -> $resolved"
        return 0
    fi

    echo "[FIX] claude lives under a non-world-readable home ($resolved);"
    echo "      installing a shared copy in $CCI_BIN_DIR so every user can run it."
    if [ ! -f "$resolved" ]; then
        echo "[WARN] Resolved claude is not a regular file; linking instead (may be owner-only)."
        cci_link_into_bin "$src" "$CCI_EXEC" "keep"
        return 1
    fi

    # Idempotent: nothing to do when the shared binary already matches.
    if [ -f "$dest" ] && [ ! -L "$dest" ] && cmp -s "$resolved" "$dest"; then
        echo "[OK] Shared claude already up to date: $dest"
        return 0
    fi

    cci_bin_sudo mkdir -p "$CCI_BIN_DIR"
    cci_bin_sudo rm -f "$dest"
    if cci_bin_sudo cp -f "$resolved" "$dest" && cci_bin_sudo chmod 0755 "$dest"; then
        echo "[COPY] Installed shared claude for all users: $dest"
        echo "       (self-contained native binary; re-run this installer to refresh after updates)"
        return 0
    fi
    echo "[ERROR] Failed to install shared claude at $dest"
    return 1
}

# Link the claudeteam launcher (and its .sh alias) for all users.
cci_setup_claudeteam() {
    if [ -s "$CCI_TEAM_SRC" ]; then
        cci_link_into_bin "$CCI_TEAM_SRC" "claudeteam"
        cci_link_into_bin "$CCI_TEAM_SRC" "claudeteam.sh"
    else
        echo "[WARN] claudeteam.sh not found at: $CCI_TEAM_SRC"
        return 1
    fi
}

# Main entry: install (native, idempotent) -> make claude usable by all users -> link claudeteam.
claude_code_install() {
    local bin_path=""

    # Step 1: official native install (idempotent).
    print_color "[STEP 1/3] Install Claude Code (official native installer)" "Info"
    cci_install_native
    echo ""

    # Step 2: make claude usable by all users (regular users + root), fixing
    # permissions / mode-700 home issues by copying the self-contained binary
    # into the shared bin when a symlink would not be reachable.
    print_color "[STEP 2/3] Install claude into $CCI_BIN_DIR for all users" "Info"
    bin_path="$(cci_find_claude || true)"
    if [ -z "$bin_path" ]; then
        echo "[ERROR] Could not locate the claude binary after installation."
    else
        echo "[FOUND] claude binary: $bin_path"
        # Link to the stable launcher path (keep), so native updates are tracked.
        cci_link_into_bin "$bin_path" "$CCI_EXEC" "keep"
        # The native installer is per-user (~/.local/bin). When run as root that
        # is /root/.local (mode 700) -> unreachable by other users, so the
        # "all users" link would silently fail for everyone but the owner.
        if cci_others_can_access "$bin_path"; then
            echo "[OK] $bin_path is reachable and executable by all users."
        else
            echo "[WARNING] $bin_path is NOT traversable/executable by other users"
            echo "          (likely under a mode-700 home such as /root/.local/bin)."
            echo "          A plain symlink in $CCI_BIN_DIR would not resolve that path."
            echo "          For true all-user access, install claude into a shared prefix"
            echo "          (e.g. 'npm install -g @anthropic-ai/claude-code') or deliberately"
            echo "          relax the path permissions."
        fi
        cci_install_claude_all_users "$bin_path"
    fi
    echo ""

    # Step 3: link the claudeteam launcher for all users.
    print_color "[STEP 3/3] Link claudeteam launcher into $CCI_BIN_DIR (all users)" "Info"
    cci_setup_claudeteam
    echo ""

    if timeout 10 "$CCI_BIN_DIR/$CCI_EXEC" --version >/dev/null 2>&1; then
        echo "[OK] claude is installed and runnable from $CCI_BIN_DIR/$CCI_EXEC."
    else
        echo "[WARN] claude did not report a version from $CCI_BIN_DIR/$CCI_EXEC."
    fi
}

# Allow direct execution (./claude_code_install.sh) in addition to sourcing.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    claude_code_install "$@"
fi
