#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Certbot installation (idempotent, step-granular) - pipx-isolated per PEP 668.
#
# Architecture note (bottom-up, no patches): the apt certbot runs on the SYSTEM
# Python, which collides with the many install scripts that pip-install with
# --break-system-packages (e.g. selenium needs urllib3>=2.5 while the apt
# certbot needs urllib3<2). The specification-compliant fix is isolation:
# certbot + all plugins live in their own pipx venv (official certbot docs:
# pip/pipx in a virtual environment is the supported non-snap route). Every
# legacy certbot channel (apt packages, system-pip packages, snap) is
# idempotently replaced; /etc/letsencrypt (accounts, certificates, renewals)
# is preserved. Certificates themselves are managed by Laravel ServerManager;
# this script provisions the tooling only.
#
# Conventions: pipx is referenced by the ABSOLUTE path owned by the
# prerequisite installer 17_enable_pipx.sh ($COMPILE_DIR/pipx_venv/bin/pipx);
# binaries are detected by existence tests (-x), never by command output;
# functions do not communicate results via exit codes - every step self-detects
# its own prerequisites and no-ops when they are unmet, so one step's state
# never blocks a later independent step.
#
# SYNC CONTRACT: see common/nginx_manager.sh - the certificate flow is shared
# with poly_apps/laravel_main ServerManagerV1CertificateManager. Change both
# ends together.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="27"
CERTBOT_STEP_NAMESPACE="27_install_certbot"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/step_state.sh"

SSL_CONFIG_DIR=$(map_web_path "shared-data" "ssl")
SSL_CONFIG_FILE="$SSL_CONFIG_DIR/ssl_config.json"
LEGACY_SSL_CONFIG_DIR="$CORE_NODE_DIR/.secret_keys/.secret_ignore"
LEGACY_SSL_CONFIG_FILE="$LEGACY_SSL_CONFIG_DIR/SSL_CONFIG_JSON"
RENEWAL_SCRIPT="/usr/local/bin/certbot-renewal.sh"
RENEWAL_TIMER_NAME="certbot-renewal"
RENEWAL_SERVICE_FILE="/etc/systemd/system/certbot-renewal.service"
RENEWAL_TIMER_FILE="/etc/systemd/system/certbot-renewal.timer"
CERTBOT_BIN_LINK="/usr/local/bin/certbot"
CERTBOT_UPDATE_STAMP="/usr/local/etc/.certbot_pipx_update_stamp"
PIPX_ENSURE_SCRIPT="$SCRIPT_CURRENT_DIR/17_enable_pipx.sh"
# Absolute paths owned by the prerequisite installer (17_enable_pipx.sh).
PIPX_BIN="$COMPILE_DIR/pipx_venv/bin/pipx"
PIPX_HOME_DIR="$COMPILE_DIR/pipx_home"
PIPX_BIN_DIR="/usr/local/bin"
CERTBOT_PIPX_VENV="$PIPX_HOME_DIR/venvs/certbot"
CERTBOT_VENV_BIN="$CERTBOT_PIPX_VENV/bin/certbot"
CERTBOT_PLUGINS="certbot-nginx certbot-dns-dnspod certbot-dns-cloudflare certbot-dns-route53"
LEGACY_APT_PACKAGES="certbot python3-certbot python3-certbot-nginx python3-certbot-dns-cloudflare python3-certbot-dns-route53"

echo "[$SCRIPT_INDEX] Certbot Installation Script (pipx-isolated, idempotent, step-granular)"

# Certbot requires the nginx binary (binary-existence detection).
if [ ! -x /usr/local/bin/nginx ] && ! command -v nginx >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] Skipping Certbot installation - nginx is not installed"
    exit 0
fi

check_and_install_sudo

# Run pipx with the canonical isolated home/bin layout (root-safe).
pipx_run() {
    $USE_SUDO env PIPX_HOME="$PIPX_HOME_DIR" PIPX_BIN_DIR="$PIPX_BIN_DIR" PIPX_ALLOW_GLOBAL=1 "$PIPX_BIN" "$@"
}

# STEP: ensure pipx itself at the prerequisite script's absolute path
# (delegates to 17_enable_pipx.sh when the binary is absent, then trusts the
# resolved path).
ensure_pipx() {
    if [ -x "$PIPX_BIN" ]; then
        echo "[$SCRIPT_INDEX] [SKIP] pipx already present: $PIPX_BIN"
        return 0
    fi
    echo "[$SCRIPT_INDEX] pipx missing; invoking $PIPX_ENSURE_SCRIPT"
    if [ -f "$PIPX_ENSURE_SCRIPT" ]; then
        bash "$PIPX_ENSURE_SCRIPT" || echo "[$SCRIPT_INDEX] [WARN] pipx installer reported issues"
    fi
    if [ -x "$PIPX_BIN" ]; then
        echo "[$SCRIPT_INDEX] [OK] pipx available: $PIPX_BIN"
    else
        echo "[$SCRIPT_INDEX] [WARN] pipx still absent at $PIPX_BIN; pipx steps below self-detect and no-op"
    fi
    return 0
}

# STEP: preflight environment conflict scan. Reports (a) other install scripts
# that pollute the system Python via --break-system-packages (the conflict
# source for apt-certbot), and (b) certbot packages currently installed into
# the system Python by pip. Informational - isolation makes them harmless to
# certbot, but the operator should know where the conflicts live.
preflight_conflict_scan() {
    local conflict_scripts
    local sys_pip_certbot

    conflict_scripts=$(grep -rl "break-system-packages" "$SCRIPT_CURRENT_DIR" 2>/dev/null | xargs -r -n1 basename | sort -u | tr '\n' ' ')
    echo "[$SCRIPT_INDEX] [PREFLIGHT] Scripts writing to the system Python (--break-system-packages):"
    echo "[$SCRIPT_INDEX] [PREFLIGHT]   ${conflict_scripts:-none}"
    echo "[$SCRIPT_INDEX] [PREFLIGHT] Isolated pipx certbot is unaffected by these."

    sys_pip_certbot=$(pip3 list --format=freeze 2>/dev/null | grep -i '^certbot' || true)
    if [ -n "$sys_pip_certbot" ]; then
        echo "[$SCRIPT_INDEX] [PREFLIGHT] certbot packages in system Python (will be removed):"
        echo "$sys_pip_certbot" | while IFS= read -r line; do echo "[$SCRIPT_INDEX] [PREFLIGHT]   $line"; done
    else
        echo "[$SCRIPT_INDEX] [PREFLIGHT] No certbot packages in system Python"
    fi
    return 0
}

# STEP: purge legacy apt certbot packages (old packaging; /etc/letsencrypt is
# data and is NOT touched by the purge). Per-package idempotent.
purge_legacy_apt_certbot() {
    local pkg
    for pkg in $LEGACY_APT_PACKAGES; do
        if dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
            echo "[$SCRIPT_INDEX] Purging legacy apt package: $pkg"
            $USE_SUDO apt remove --purge -y "$pkg" || echo "[$SCRIPT_INDEX] [WARN] Failed to purge $pkg"
        else
            echo "[$SCRIPT_INDEX] [SKIP] apt package not installed: $pkg"
        fi
    done
    $USE_SUDO apt autoremove -y 2>/dev/null || true
    return 0
}

# STEP: purge system-pip certbot packages (they shadow plugins and fight the
# system urllib3; the pipx venv is separate and unaffected). Idempotent.
purge_legacy_pip_certbot() {
    local pkg
    local installed
    installed=$(pip3 list --format=freeze 2>/dev/null | grep -i '^certbot' | cut -d= -f1 || true)
    if [ -z "$installed" ]; then
        echo "[$SCRIPT_INDEX] [SKIP] No system-pip certbot packages"
        return 0
    fi
    for pkg in $installed; do
        echo "[$SCRIPT_INDEX] Removing system-pip package: $pkg"
        $USE_SUDO pip3 uninstall -y --break-system-packages "$pkg" 2>/dev/null || \
            $USE_SUDO pip3 uninstall -y "$pkg" 2>/dev/null || true
    done
    return 0
}

# STEP: purge a legacy snap certbot (classic confinement uses /etc/letsencrypt
# directly, so the purge preserves accounts and certificates). Idempotent.
purge_legacy_snap_certbot() {
    if ! command -v snap >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [SKIP] snap not present"
        return 0
    fi
    if snap list certbot >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Removing legacy snap certbot"
        $USE_SUDO snap remove --purge certbot || echo "[$SCRIPT_INDEX] [WARN] snap certbot removal reported issues"
    else
        echo "[$SCRIPT_INDEX] [SKIP] No snap certbot"
    fi
    return 0
}

# STEP: install certbot into the pipx venv (weekly idempotent refresh via
# stamp file). Self-detects: no-ops when pipx is absent.
pipx_install_certbot() {
    if [ ! -x "$PIPX_BIN" ]; then
        echo "[$SCRIPT_INDEX] [WARN] pipx absent; skipping certbot venv install"
        return 0
    fi
    if [ -x "$CERTBOT_VENV_BIN" ]; then
        local current_week
        current_week="$(date +%G-W%V)"
        if [ "$(cat "$CERTBOT_UPDATE_STAMP" 2>/dev/null)" != "$current_week" ]; then
            echo "[$SCRIPT_INDEX] Refreshing pipx certbot (weekly, idempotent)..."
            if pipx_run upgrade certbot; then
                echo "$current_week" | $USE_SUDO tee "$CERTBOT_UPDATE_STAMP" >/dev/null
                $USE_SUDO chmod 777 "$CERTBOT_UPDATE_STAMP" 2>/dev/null || true
            else
                echo "[$SCRIPT_INDEX] [WARN] certbot upgrade failed; keeping the installed version"
            fi
        else
            echo "[$SCRIPT_INDEX] [SKIP] pipx certbot already refreshed this week"
        fi
        return 0
    fi
    echo "[$SCRIPT_INDEX] Installing certbot via pipx (isolated venv)..."
    pipx_run install certbot || echo "[$SCRIPT_INDEX] [WARN] pipx certbot install reported issues"
    return 0
}

# STEP: inject the DNS + nginx plugins into the certbot venv. Per-plugin
# idempotent: inject only when the plugin is absent from the venv.
pipx_inject_plugins() {
    if [ ! -x "$CERTBOT_VENV_BIN" ]; then
        echo "[$SCRIPT_INDEX] [WARN] certbot venv absent; skipping plugin injection"
        return 0
    fi
    local plugin
    local installed_list
    installed_list=$(pipx_run list 2>/dev/null || true)
    for plugin in $CERTBOT_PLUGINS; do
        if echo "$installed_list" | grep -q "$plugin"; then
            echo "[$SCRIPT_INDEX] [SKIP] plugin already injected: $plugin"
        else
            echo "[$SCRIPT_INDEX] Injecting plugin: $plugin"
            pipx_run inject certbot "$plugin" || echo "[$SCRIPT_INDEX] [WARN] Failed to inject $plugin"
        fi
    done
    return 0
}

# STEP: /usr/local/bin/certbot link + mode 777 (house policy). Replaces any
# stale link left by the apt/snap era (binary-existence detection).
ensure_certbot_link() {
    if [ ! -x "$CERTBOT_VENV_BIN" ]; then
        echo "[$SCRIPT_INDEX] [WARN] pipx venv certbot binary missing: $CERTBOT_VENV_BIN"
        return 0
    fi
    if [ ! -L "$CERTBOT_BIN_LINK" ] || [ "$(readlink -f "$CERTBOT_BIN_LINK")" != "$(readlink -f "$CERTBOT_VENV_BIN")" ]; then
        $USE_SUDO rm -f "$CERTBOT_BIN_LINK"
        $USE_SUDO ln -sfn "$CERTBOT_VENV_BIN" "$CERTBOT_BIN_LINK"
        echo "[$SCRIPT_INDEX] [OK] Linked $CERTBOT_BIN_LINK -> $CERTBOT_VENV_BIN"
    else
        echo "[$SCRIPT_INDEX] [SKIP] certbot link already correct"
    fi
    $USE_SUDO chmod 777 "$CERTBOT_BIN_LINK" 2>/dev/null || true
    return 0
}

# Create the mapped directory layout consumed by Laravel ServerManager.
ensure_servermanager_dirs() {
    local dirs=(
        "$(map_web_path 'nginxconfig' 'sites-available')"
        "$(map_web_path 'nginxconfig' 'sites-enabled')"
        "$(map_web_path 'nginxconfig' 'ssl')"
        "$(map_web_path 'backup' 'nginx-configs')"
        "$(map_web_path 'wwwroot')"
        "$(map_web_path 'shared-data' 'ssl')"
        "$(map_web_path 'shared-data' 'domains')"
        "$(map_web_path 'shared-data' 'dns-providers')"
        "$(map_web_path 'shared-data' 'certificates')"
        "/etc/letsencrypt"
        "/var/lib/letsencrypt"
        "/var/log/letsencrypt"
    )
    local dir

    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            $USE_SUDO mkdir -p "$dir"
            echo "[$SCRIPT_INDEX] Created directory: $dir"
        fi
    done
}

# Bootstrap the ServerManager SSL configuration (never overwrite user edits).
ensure_ssl_config() {
    if [ -f "$SSL_CONFIG_FILE" ]; then
        echo "[$SCRIPT_INDEX] [SKIP] SSL config already exists at $SSL_CONFIG_FILE"
    else
        $USE_SUDO mkdir -p "$SSL_CONFIG_DIR"
        write_file_if_changed "$SSL_CONFIG_FILE" <<EOF
{
    "ssl_config": {
        "default_provider": "letsencrypt",
        "default_email": "admin@example.com",
        "staging": false,
        "providers": {
            "letsencrypt": {
                "enabled": true,
                "challenge_type": "http-01",
                "description": "Let's Encrypt HTTP Challenge"
            },
            "letsencrypt-dns": {
                "enabled": true,
                "challenge_type": "dns-01",
                "description": "Let's Encrypt DNS Challenge"
            },
            "cloudflare": {
                "enabled": false,
                "challenge_type": "dns-01",
                "api_token": "",
                "description": "Cloudflare DNS Challenge"
            },
            "dnspod": {
                "enabled": false,
                "challenge_type": "dns-01",
                "api_id": "",
                "api_token": "",
                "description": "DNSPod DNS Challenge"
            }
        }
    },
    "deployment_config": {
        "default_php_version": "8.4",
        "default_web_root": "$(map_web_path 'wwwroot')",
        "auto_ssl": true,
        "auto_backup": true,
        "nginx_config_path": "$(map_web_path 'nginxconfig' 'sites-available')",
        "nginx_enabled_path": "$(map_web_path 'nginxconfig' 'sites-enabled')",
        "backup_path": "$(map_web_path 'backup' 'nginx-configs')"
    },
    "security_config": {
        "max_deployments_per_hour": 10,
        "require_confirmation": false,
        "allowed_domains": [],
        "blocked_domains": []
    }
}
EOF
    fi

    $USE_SUDO mkdir -p "$LEGACY_SSL_CONFIG_DIR"
    $USE_SUDO ln -sfn "$SSL_CONFIG_FILE" "$LEGACY_SSL_CONFIG_FILE"
}

# Renewal via systemd timer (replaces the legacy root cron entry). The renewal
# script calls the pipx-isolated certbot through the /usr/local/bin link and
# reloads nginx on change.
ensure_renewal_timer() {
    write_file_if_changed "$RENEWAL_SCRIPT" <<'EOF'
#!/bin/bash
# Certbot renewal hook: renew certificates and reload nginx on change.
/usr/local/bin/certbot renew --quiet
if [ $? -eq 0 ]; then
    /usr/local/bin/certbot renew --quiet --deploy-hook 'systemctl reload nginx' 2>/dev/null || systemctl reload nginx
fi
EOF

    write_file_if_changed "$RENEWAL_SERVICE_FILE" <<EOF
[Unit]
Description=Certbot renewal run

[Service]
Type=oneshot
ExecStart=$RENEWAL_SCRIPT
EOF

    write_file_if_changed "$RENEWAL_TIMER_FILE" <<EOF
[Unit]
Description=Run certbot renewal twice daily

[Timer]
OnCalendar=*-*-* 06:17:00
OnCalendar=*-*-* 18:17:00
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

    $USE_SUDO systemctl daemon-reload
    $USE_SUDO systemctl enable --now "$RENEWAL_TIMER_NAME.timer"

    # Remove the legacy cron entry superseded by the timer.
    if $USE_SUDO crontab -l 2>/dev/null | grep -q "certbot-renewal"; then
        $USE_SUDO crontab -l 2>/dev/null | grep -v "certbot-renewal" | $USE_SUDO crontab - 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Removed legacy cron renewal entry"
    fi
}

# Persist facts for downstream consumers (strict regex version parse - never
# trust raw field cutting on polluted output).
store_certbot_info() {
    local certbot_version=""
    if [ -x "$CERTBOT_BIN_LINK" ]; then
        certbot_version=$($USE_SUDO "$CERTBOT_BIN_LINK" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    fi

    set_global_var "CERTBOT_BIN" "$CERTBOT_BIN_LINK"
    set_global_var "CERTBOT_VERSION" "$certbot_version"
    set_global_var "CERTBOT_MANAGED_BY" "laravel_servermanager"
    set_global_var "CERTBOT_INSTALL_MODE" "pipx"
    set_global_var "CERTBOT_PIPX_VENV" "$CERTBOT_PIPX_VENV"
    set_global_var "CERTBOT_CONFIG_DIR" "/etc/letsencrypt"
    set_global_var "CERTBOT_WORK_DIR" "/var/lib/letsencrypt"
    set_global_var "CERTBOT_LOG_DIR" "/var/log/letsencrypt"
}

# Verify the tooling end to end. Informational: prints a per-check report; the
# outcome is detectable from state (binary, plugins listing, timer), not from
# this function's exit code.
verify_certbot() {
    local failures=0
    local plugins_output=""

    if [ -x "$CERTBOT_BIN_LINK" ]; then
        echo "[$SCRIPT_INDEX] [OK] certbot $($USE_SUDO "$CERTBOT_BIN_LINK" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1) at $CERTBOT_BIN_LINK"
        plugins_output=$($USE_SUDO "$CERTBOT_BIN_LINK" plugins 2>/dev/null)
    else
        echo "[$SCRIPT_INDEX] [FAIL] certbot binary not found at $CERTBOT_BIN_LINK"
        failures=$((failures + 1))
    fi

    if [ -n "$plugins_output" ]; then
        if echo "$plugins_output" | grep -q "dns-dnspod"; then
            echo "[$SCRIPT_INDEX] [OK] dns-dnspod plugin present"
        else
            echo "[$SCRIPT_INDEX] [FAIL] dns-dnspod plugin missing from the isolated venv"
            failures=$((failures + 1))
        fi
        if echo "$plugins_output" | grep -q "\* nginx"; then
            echo "[$SCRIPT_INDEX] [OK] nginx plugin present"
        else
            echo "[$SCRIPT_INDEX] [WARN] nginx plugin missing from the isolated venv"
        fi
    elif [ -x "$CERTBOT_BIN_LINK" ]; then
        echo "[$SCRIPT_INDEX] [FAIL] certbot plugins command produced no output"
        failures=$((failures + 1))
    fi

    if systemctl is-enabled --quiet "$RENEWAL_TIMER_NAME.timer" 2>/dev/null; then
        echo "[$SCRIPT_INDEX] [OK] renewal timer enabled"
    else
        echo "[$SCRIPT_INDEX] [FAIL] renewal timer not enabled"
        failures=$((failures + 1))
    fi

    if [ $failures -eq 0 ]; then
        echo "[$SCRIPT_INDEX] [OK] All certbot verification checks passed"
    else
        echo "[$SCRIPT_INDEX] [WARN] $failures certbot verification check(s) failed (see above)"
    fi
    return 0
}

echo "[$SCRIPT_INDEX] ================================="
echo "[$SCRIPT_INDEX] CERTBOT INSTALLATION (pipx-isolated, idempotent)"
echo "[$SCRIPT_INDEX] ================================="

# STEP 1: pipx itself (absolute path owned by 17_enable_pipx.sh)
step_run "$CERTBOT_STEP_NAMESPACE" "pipx-present" "v1" ensure_pipx

# STEP 2: preflight conflict scan (informational, always runs)
preflight_conflict_scan

# STEP 3: purge legacy apt certbot packages (certificates preserved)
step_run "$CERTBOT_STEP_NAMESPACE" "purge-apt-legacy" "v1" purge_legacy_apt_certbot

# STEP 4: purge system-pip certbot packages (isolation boundary)
step_run "$CERTBOT_STEP_NAMESPACE" "purge-pip-legacy" "v1" purge_legacy_pip_certbot

# STEP 5: purge legacy snap certbot (certificates preserved)
step_run "$CERTBOT_STEP_NAMESPACE" "purge-snap-legacy" "v1" purge_legacy_snap_certbot

# STEP 6: pipx certbot install (weekly idempotent refresh; self-detecting)
pipx_install_certbot

# STEP 7: plugin injection (per-plugin idempotent; self-detecting)
pipx_inject_plugins

# STEP 8: /usr/local/bin/certbot link + mode 777
step_run "$CERTBOT_STEP_NAMESPACE" "bin-link" "$CERTBOT_PIPX_VENV" ensure_certbot_link

# STEP 9: Laravel ServerManager directory layout
step_run "$CERTBOT_STEP_NAMESPACE" "servermanager-dirs" "v2" ensure_servermanager_dirs

# STEP 10: SSL config bootstrap
step_run "$CERTBOT_STEP_NAMESPACE" "ssl-config" "v2" ensure_ssl_config

# STEP 11: systemd renewal timer (replaces cron)
step_run "$CERTBOT_STEP_NAMESPACE" "renewal-timer" "systemd-v3-pipx" ensure_renewal_timer

# STEP 12: persist state
store_certbot_info

# STEP 13: verification (informational)
verify_certbot

echo "[$SCRIPT_INDEX] ================================="
echo "[$SCRIPT_INDEX] CERTBOT READY (pipx venv: $CERTBOT_PIPX_VENV)"
echo "[$SCRIPT_INDEX] Certificates are managed by Laravel ServerManager:"
echo "[$SCRIPT_INDEX]   SSL config: $SSL_CONFIG_FILE"
echo "[$SCRIPT_INDEX]   php artisan servermanager:certificate add example.com --provider=dnspod"
echo "[$SCRIPT_INDEX]   php artisan servermanager:website add example.com --type=html --ssl=auto"
echo "[$SCRIPT_INDEX] ================================="

exit 0
