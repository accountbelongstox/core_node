#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# apache_block_guard.sh - Permanently block & remove Apache (Linux). Idempotent.
#
# THE PROBLEM: Apache is never wanted in this stack (nginx is the web server), yet
# /usr/lib/apache2 keeps appearing. No script installs it directly - it sneaks in
# as a TRANSITIVE dependency, chiefly libapache2-mod-php* (a Recommends of the
# `php` meta-package), which pulls apache2-bin. The repo already removes it in
# several places (26_install_nginx.sh, 32_ensure_php85_intelligent.sh, 63_install_upsc.sh), but a
# later apt operation can drag it back in.
#
# THE GUARD - make it impossible to install ANYWHERE: write an apt preferences pin
# (Pin-Priority -1) for the apache packages so apt refuses to install them even to
# satisfy a dependency; then stop/disable/purge any apache already present and drop
# /usr/lib/apache2 + /etc/apache2. Idempotent, safe to call on every run.
#
# Safe to SOURCE (use abg_* functions) or RUN directly. Introduced at key points:
#   - scripts/shells/linux/debian/install_shells/26_install_nginx.sh (web-server install)
#   - dd.sh Linux Management submenu ("Block & Remove Apache")
#
# Usage:  bash apache_block_guard.sh           # pin + purge now
#         source apache_block_guard.sh; abg_block_apache
# ---------------------------------------------------------------------------

ABG_PREF_FILE="/etc/apt/preferences.d/no-apache.pref"

abg_sudo() { if [ "$(id -u 2>/dev/null)" = "0" ]; then "$@"; else sudo "$@"; fi; }

# Write the apt pin that forbids apache from EVER being installed (even as a dep).
abg_write_apt_pin() {
    local tmp
    tmp="$(mktemp 2>/dev/null || echo "/tmp/no-apache.pref.$$")"
    cat > "$tmp" <<'EOF'
# Managed by apache_block_guard.sh - never install Apache (nginx is the web server).
# Apache is only ever pulled as a transitive dep (libapache2-mod-php <- php meta).
# Pin-Priority -1 makes apt REFUSE to install these, even to satisfy a dependency.
Package: apache2
Pin: release *
Pin-Priority: -1

Package: apache2-*
Pin: release *
Pin-Priority: -1

Package: libapache2-mod-php*
Pin: release *
Pin-Priority: -1
EOF
    abg_sudo mkdir -p /etc/apt/preferences.d 2>/dev/null || true
    abg_sudo cp "$tmp" "$ABG_PREF_FILE" 2>/dev/null || true
    rm -f "$tmp" 2>/dev/null || true
    echo "[apache-guard] apt pin written: $ABG_PREF_FILE (apache pinned to -1; apt will never install it)."
}

# Stop/disable/mask + purge any apache already on the box, and drop its dirs.
abg_purge_apache() {
    if command -v systemctl >/dev/null 2>&1; then
        abg_sudo systemctl stop apache2 2>/dev/null || true
        abg_sudo systemctl disable apache2 2>/dev/null || true
        abg_sudo systemctl mask apache2 2>/dev/null || true
    fi
    if command -v dpkg >/dev/null 2>&1 && dpkg -l 2>/dev/null | grep -q "^ii.*apache2"; then
        echo "[apache-guard] Purging installed apache2 / libapache2-mod-php packages..."
        abg_sudo apt-get remove --purge -y apache2* libapache2-mod-php* 2>/dev/null || true
        abg_sudo apt-get autoremove --purge -y 2>/dev/null || true
    fi
    abg_sudo rm -rf /usr/lib/apache2 /etc/apache2 2>/dev/null || true
}

# THE idempotent block routine: pin (so it never returns) + purge (remove if present).
abg_block_apache() {
    abg_write_apt_pin
    # apt-mark hold as belt-and-suspenders; the pin above is the real enforcement.
    if command -v apt-mark >/dev/null 2>&1; then
        abg_sudo apt-mark hold apache2 apache2-bin apache2-data apache2-utils 2>/dev/null || true
    fi
    abg_purge_apache
    echo "[apache-guard] Apache blocked (pinned -1) and removed."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    abg_block_apache
fi
