#!/bin/bash

# Detect and fix repository configuration issues
detect_and_fix_repository_issues_from_apt_repository_manager() {
    echo "Detecting repository configuration issues..."
    
    local issues_found=0
    
    # Check for duplicate sources
    if [ -f "$APT_SOURCES_LIST" ] && [ -d "$APT_SOURCES_LIST_D" ]; then
        local sources_list_count=$(grep -c "^deb " "$APT_SOURCES_LIST" 2>/dev/null || echo "0")
        local sources_list_d_count=$(find "$APT_SOURCES_LIST_D" -name "*.list" -exec grep -c "^deb " {} \; 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
        
        # Ensure variables are numeric (remove any whitespace and non-numeric characters)
        sources_list_count=$(echo "$sources_list_count" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
        sources_list_d_count=$(echo "$sources_list_d_count" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
        
        # Validate and compare numeric values
        if [ -n "$sources_list_count" ] && [ -n "$sources_list_d_count" ]; then
            if [ "$sources_list_count" -gt 0 ] 2>/dev/null && [ "$sources_list_d_count" -gt 0 ] 2>/dev/null; then
                echo "WARNING: Found potential duplicate sources (sources.list and sources.list.d both have entries)"
                issues_found=$((issues_found + 1))
            fi
        fi
    fi
    
    # Check for broken GPG keys
    local broken_keys=0
    for key_file in "$APT_KEYRINGS_DIR"/*.gpg "$APT_TRUSTED_KEYS_DIR"/*.gpg; do
        if [ -f "$key_file" ] && ! gpg --no-default-keyring --keyring "$key_file" --list-keys >/dev/null 2>&1; then
            broken_keys=$((broken_keys + 1))
        fi
    done
    
    if [ "$broken_keys" -gt 0 ]; then
        echo "WARNING: Found $broken_keys broken GPG key(s)"
        issues_found=$((issues_found + 1))
    fi
    
    # Check for missing repository files referenced in sources
    local missing_refs=0
    while IFS= read -r repo_line; do
        if echo "$repo_line" | grep -q "signed-by="; then
            local key_path=$(echo "$repo_line" | sed -n 's/.*signed-by=\([^]]*\).*/\1/p')
            if [ -n "$key_path" ] && [ ! -f "$key_path" ]; then
                missing_refs=$((missing_refs + 1))
            fi
        fi
    done < <(find "$APT_SOURCES_LIST_D" -name "*.list" -exec cat {} \; 2>/dev/null)
    
    if [ "$missing_refs" -gt 0 ]; then
        echo "WARNING: Found $missing_refs missing GPG key reference(s)"
        issues_found=$((issues_found + 1))
    fi
    
    if [ "$issues_found" -eq 0 ]; then
        echo "No repository issues detected"
        return 0
    else
        echo "Found $issues_found type(s) of repository issues"
        return 1
    fi
}

# Return 0 if the given 40-hex key fingerprint is present in ANY keyring apt's
# verifier (sqv/gpgv) consults: /etc/apt/trusted.gpg.d, /usr/share/keyrings, and
# /etc/apt/keyrings. Used to decide (idempotently) whether a repair is needed.
_apt_key_present_from_apt_repository_manager() {
    local fpr="$1" k
    command -v gpg >/dev/null 2>&1 || return 1
    for k in /etc/apt/trusted.gpg.d/*.gpg /etc/apt/trusted.gpg.d/*.asc /etc/apt/trusted.gpg.d/*.pgp \
             /usr/share/keyrings/*.gpg /usr/share/keyrings/*.pgp \
             /etc/apt/keyrings/*; do
        [ -f "$k" ] || continue
        if gpg --show-keys --with-colons "$k" 2>/dev/null | awk -F: '/^fpr:/{print $10}' | grep -qx "$fpr"; then
            return 0
        fi
    done
    return 1
}

# Restore the Kali archive signing key. Kali is rolling and periodically rotates
# its archive key (the 2025 rotation moved to fingerprint
# 827C8569F2518CC677FECA1AED65462EC8D5E4C5); when the kali-archive-keyring file is
# missing/stale (here: a dangling /etc/apt/trusted.gpg.d symlink), apt fails with
# "Missing key ..., which is needed to verify signature" and NOTHING installs.
# Fetches the OFFICIAL keyring (archive.kali.org), installs it ONLY after
# verifying it actually carries the expected fingerprint, and heals the
# trusted.gpg.d symlink. Idempotent; never fatal (runs under set +e).
_ensure_kali_archive_keyring_from_apt_repository_manager() {
    local needed_fpr="827C8569F2518CC677FECA1AED65462EC8D5E4C5"
    local keyring="/usr/share/keyrings/kali-archive-keyring.gpg"
    local trusted_link="/etc/apt/trusted.gpg.d/kali-archive-keyring.gpg"
    local url="https://archive.kali.org/archive-keyring.gpg"
    local tmp=""

    if _apt_key_present_from_apt_repository_manager "$needed_fpr"; then
        echo "[keyring] Kali archive key already trusted; skipping."
        # Heal a dangling trusted.gpg.d symlink (file exists, link broken/absent).
        if [ -f "$keyring" ] && [ ! -e "$trusted_link" ]; then
            $USE_SUDO ln -sf "$keyring" "$trusted_link" 2>/dev/null || true
        fi
        return 0
    fi

    echo "[keyring] Kali archive signing key ($needed_fpr) not trusted; restoring from $url ..."
    if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
        echo "[keyring] WARNING: neither curl nor wget available; cannot fetch keyring." >&2
        return 0
    fi
    if ! command -v gpg >/dev/null 2>&1; then
        echo "[keyring] WARNING: gpg not available; cannot verify keyring." >&2
        return 0
    fi

    tmp="$(mktemp 2>/dev/null)" || tmp="/tmp/kali-archive-keyring.$$.gpg"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$tmp" 2>/dev/null || { echo "[keyring] WARNING: download failed ($url)." >&2; rm -f "$tmp"; return 0; }
    else
        wget -qO "$tmp" "$url" 2>/dev/null || { echo "[keyring] WARNING: download failed ($url)." >&2; rm -f "$tmp"; return 0; }
    fi

    # SECURITY: install only if the downloaded keyring really carries the exact key
    # apt is asking for (guards against a tampered/empty/HTML-error download).
    if ! gpg --show-keys --with-colons "$tmp" 2>/dev/null | awk -F: '/^fpr:/{print $10}' | grep -qx "$needed_fpr"; then
        echo "[keyring] WARNING: downloaded keyring lacks $needed_fpr; refusing to install." >&2
        rm -f "$tmp"
        return 0
    fi

    if $USE_SUDO install -m 0644 "$tmp" "$keyring" 2>/dev/null; then
        :
    else
        $USE_SUDO mkdir -p /usr/share/keyrings 2>/dev/null || true
        $USE_SUDO cp "$tmp" "$keyring" 2>/dev/null && $USE_SUDO chmod 0644 "$keyring" 2>/dev/null || true
    fi
    rm -f "$tmp"

    # apt's verifier reads /etc/apt/trusted.gpg.d/*; keep the conventional symlink.
    if [ ! -e "$trusted_link" ]; then
        $USE_SUDO ln -sf "$keyring" "$trusted_link" 2>/dev/null || true
    fi

    if _apt_key_present_from_apt_repository_manager "$needed_fpr"; then
        echo "[keyring] Kali archive signing key restored at $keyring."
    else
        echo "[keyring] WARNING: key still not detected after install." >&2
    fi
    return 0
}

# Best-effort safety net for Debian/Ubuntu: only when the keyring FILE is actually
# missing (mirrors the Kali failure), reinstall the distro keyring package. Debian/
# Ubuntu archive keys do not rotate like Kali's, so this is normally a no-op (keeps
# the call idempotent -- it never re-runs apt when the keyring is already present).
_reinstall_keyring_pkg_from_apt_repository_manager() {
    local pkg="$1" probe="$2"
    if [ -n "$probe" ] && [ -e "$probe" ]; then
        return 0
    fi
    if dpkg -s "$pkg" >/dev/null 2>&1; then
        echo "[keyring] $pkg keyring file missing; reinstalling $pkg ..."
        $USE_SUDO apt-get install --reinstall -y "$pkg" >/dev/null 2>&1 || true
    fi
    return 0
}

# Ensure the distro's OWN archive signing key is present where apt looks, BEFORE
# any apt update. Distro-aware (kali/debian/ubuntu, including derivatives via
# ID_LIKE). Idempotent and never fatal. This is the fix for the rolling-Kali
# "Missing key ..., which is needed to verify signature" breakage.
ensure_distro_archive_keyring_from_apt_repository_manager() {
    local os_id="" id_like=""
    if [ -r /etc/os-release ]; then
        os_id="$(. /etc/os-release 2>/dev/null; printf '%s' "${ID:-}")"
        id_like="$(. /etc/os-release 2>/dev/null; printf '%s' "${ID_LIKE:-}")"
    fi
    os_id="$(printf '%s' "$os_id" | tr '[:upper:]' '[:lower:]')"
    id_like="$(printf '%s' "$id_like" | tr '[:upper:]' '[:lower:]')"

    case "$os_id" in
        kali)   _ensure_kali_archive_keyring_from_apt_repository_manager ;;
        debian) _reinstall_keyring_pkg_from_apt_repository_manager debian-archive-keyring /usr/share/keyrings/debian-archive-keyring.gpg ;;
        ubuntu) _reinstall_keyring_pkg_from_apt_repository_manager ubuntu-keyring /usr/share/keyrings/ubuntu-archive-keyring.gpg ;;
        *)
            case " $id_like " in
                *kali*)   _ensure_kali_archive_keyring_from_apt_repository_manager ;;
                *ubuntu*) _reinstall_keyring_pkg_from_apt_repository_manager ubuntu-keyring /usr/share/keyrings/ubuntu-archive-keyring.gpg ;;
                *debian*) _reinstall_keyring_pkg_from_apt_repository_manager debian-archive-keyring /usr/share/keyrings/debian-archive-keyring.gpg ;;
                *)        echo "[keyring] Unknown distro '$os_id'; skipping archive-keyring check." ;;
            esac
            ;;
    esac
    return 0
}

# Comprehensive repository repair function
repair_repositories_from_apt_repository_manager() {
    echo "Starting comprehensive repository repair..."
    # Step 0: ensure the distro archive signing key is present so every apt step
    # below (fix-broken, update) can verify signatures. Idempotent; see function.
    ensure_distro_archive_keyring_from_apt_repository_manager
    
    # Initialize backup directory
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "WARNING: Failed to initialize backup directory, continuing anyway..." >&2
    fi
    
    # Backup current state before repair
    local repair_backup_id="repair_$(date +%Y%m%d_%H%M%S)"
    if ! backup_apt_sources_from_apt_repository_manager "$repair_backup_id"; then
        echo "WARNING: Failed to backup before repair, continuing anyway..." >&2
    else
        echo "Backup created: $repair_backup_id"
    fi
    
    # Step 1: Clean up problematic repositories
    echo "Step 1: Cleaning up problematic repositories..."
    cleanup_all_custom_repositories_from_apt_repository_manager
    
    # Step 2: Restore to original if available, otherwise create clean state
    echo "Step 2: Restoring to clean state..."
    if [ -d "$APT_ORIGINAL_BACKUP_DIR" ]; then
        restore_to_original_from_apt_repository_manager
    else
        echo "No original backup found, creating clean state..."
        # Create minimal clean sources.list
        if [ ! -f "$APT_SOURCES_LIST" ] || [ ! -s "$APT_SOURCES_LIST" ]; then
            # Detect OS and create appropriate sources
            local os_id=""
            local os_codename=""
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                os_id="$ID"
                os_codename="$VERSION_CODENAME"
            fi
            
            # Write a minimal sources.list ONLY for the distro this machine ACTUALLY is --
            # NEVER another distro's repositories. Writing Ubuntu repos on Debian/Kali (or any
            # cross-distro mix) is exactly the pollution this must avoid. Only reached when
            # sources.list is missing/empty (gated above), so a populated native sources.list
            # is left untouched. An unknown distro is left alone rather than guessed.
            case "$os_id" in
                ubuntu|debian)
                    if [ -n "$os_codename" ]; then
                        apt_sources_restore_render_oneline "$os_id" "$os_codename" "$(apt_sources_restore_version_id)" \
                            | $USE_SUDO tee "$APT_SOURCES_LIST" > /dev/null
                        echo "Created clean ${os_id} sources.list (official one-line template)"
                    fi
                    ;;
                kali)
                    # Kali is rolling: the suite is always 'kali-rolling' (VERSION_CODENAME too).
                    apt_sources_restore_render_oneline "kali" "kali-rolling" "$(apt_sources_restore_version_id)" \
                        | $USE_SUDO tee "$APT_SOURCES_LIST" > /dev/null
                    echo "Created clean Kali sources.list (official one-line template)"
                    ;;
                *)
                    echo "Unknown distro '$os_id'; leaving sources.list untouched (refusing to write a foreign distro's repositories)"
                    ;;
            esac
        fi
    fi
    
    # Step 3: Fix APT configuration
    echo "Step 3: Fixing APT configuration..."
    $USE_SUDO mkdir -p /etc/apt/apt.conf.d 2>/dev/null || true
    
    # Create apt configuration to handle temporary issues
    $USE_SUDO tee /etc/apt/apt.conf.d/99repository-manager > /dev/null << 'EOF'
# Repository Manager Configuration
Acquire::gpgv::Options { "--ignore-time-conflict"; };
Acquire::Check-Valid-Until "false";
Dir::Cache::archives "/var/cache/apt/archives/";
Dir::State::lists "/var/lib/apt/lists/";
Dir::Log "/var/log/apt/";
EOF
    
    # Step 4: Fix package manager state
    echo "Step 4: Fixing package manager state..."
    $USE_SUDO dpkg --configure -a 2>/dev/null || true
    $USE_SUDO apt --fix-broken install -y 2>/dev/null || true
    
    # Step 5: Update package lists
    echo "Step 5: Updating package lists..."
    $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || {
        echo "WARNING: Package list update had issues, but continuing..." >&2
    }
    
    # Bound backup growth: every repair makes a timestamped backup dir, so on a box
    # re-run repeatedly these accumulate under $APT_BACKUP_BASE_DIR. Keep the newest
    # 10 (plus the protected "original"). Idempotent and non-fatal.
    clean_old_apt_backups_from_apt_repository_manager 10 2>/dev/null || true

    # Step 6: Verify repair
    echo "Step 6: Verifying repair..."
    if detect_and_fix_repository_issues_from_apt_repository_manager; then
        echo "Repository repair completed successfully"
        return 0
    else
        echo "WARNING: Some repository issues may remain" >&2
        return 1
    fi
}

# Verify repository health and functionality
verify_repository_health_from_apt_repository_manager() {
    echo "Verifying repository health..."
    
    local health_score=0
    local max_score=4
    
    # Test 1: APT update functionality
    echo "Test 1: APT update functionality..."
    if $USE_SUDO apt update --allow-unauthenticated >/dev/null 2>&1; then
        echo "  [OK] APT update works"
        health_score=$((health_score + 1))
    else
        echo "  [FAIL] APT update failed"
    fi
    
    # Test 2: Package search functionality
    echo "Test 2: Package search functionality..."
    # Note: the search command's exit status must be evaluated, not piped after a
    # redirect (`... >/dev/null 2>&1 | head` only tested `head`, always passing).
    if apt-cache search --names-only '^python3$' 2>/dev/null | grep -q .; then
        echo "  [OK] Package search works"
        health_score=$((health_score + 1))
    else
        echo "  [FAIL] Package search failed"
    fi
    
    # Test 3: Repository configuration integrity
    echo "Test 3: Repository configuration integrity..."
    if detect_and_fix_repository_issues_from_apt_repository_manager >/dev/null 2>&1; then
        echo "  [OK] Repository configuration is clean"
        health_score=$((health_score + 1))
    else
        echo "  [WARN] Repository configuration has issues"
    fi
    
    # Test 4: GPG key validity
    echo "Test 4: GPG key validity..."
    local valid_keys=0
    local total_keys=0
    for key_file in "$APT_KEYRINGS_DIR"/*.gpg "$APT_TRUSTED_KEYS_DIR"/*.gpg; do
        if [ -f "$key_file" ]; then
            total_keys=$((total_keys + 1))
            if gpg --no-default-keyring --keyring "$key_file" --list-keys >/dev/null 2>&1; then
                valid_keys=$((valid_keys + 1))
            fi
        fi
    done
    
    if [ "$total_keys" -eq 0 ] || [ "$valid_keys" -eq "$total_keys" ]; then
        echo "  [OK] All GPG keys are valid ($valid_keys/$total_keys)"
        health_score=$((health_score + 1))
    else
        echo "  [WARN] Some GPG keys are invalid ($valid_keys/$total_keys valid)"
    fi
    
    # Report health score
    local health_percentage=$((health_score * 100 / max_score))
    echo "Repository health score: $health_score/$max_score ($health_percentage%)"
    
    if [ "$health_score" -eq "$max_score" ]; then
        echo "Repository system is healthy"
        return 0
    elif [ "$health_score" -ge 2 ]; then
        echo "Repository system is mostly healthy with minor issues"
        return 0
    else
        echo "Repository system has significant issues"
        return 1
    fi
}

