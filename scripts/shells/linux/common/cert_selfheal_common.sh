#!/bin/bash
# Certificate self-heal (certbot renewal automation), shared by
# 27_install_certbot.sh (provisioning) and 132_laravel_main_start.sh (startup
# check). Design follows the official certbot renewal contract
# (eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates):
#   - `certbot renew` renews ONLY near-expiry certificates (certbot >= 4.0:
#     less than 1/3 of the lifetime left) and exits 0 when nothing is due, so
#     it is safe to run at every startup and twice daily from a timer.
#   - Post-renewal actions belong in a DEPLOY hook
#     (<config-dir>/renewal-hooks/deploy/): it fires only when a certificate
#     was actually renewed -> nginx reloads exactly when needed.
#   - The issuance-time plugin/options recorded in renewal/<name>.conf are
#     reused at renewal; the DNS credentials file is persistent (Laravel
#     ServerManagerV1CertificateCommand owns it), so dns-01 renewals run
#     unattended.
# Fine-grained idempotent: every primitive self-detects its target state and
# no-ops when reached; outcomes are verified by direct file detection and
# published via state variables, never via exit codes.
#
# Load-time side effect free; paths resolve lazily so the library works with
# or without gvar_common.sh sourced.

CERT_SELFHEAL_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$CERT_SELFHEAL_COMMON_DIR/nginx_common.sh"
# Shared idempotent-replace writer + canonical lazy sudo (single source of
# truth, shared with common_functions.sh / domain_setup_common.sh).
# shellcheck source=/dev/null
source "$CERT_SELFHEAL_COMMON_DIR/file_ops_common.sh"

CERT_SELFHEAL_CERTBOT_BIN="$CERTBOT_BIN_LINK"
CERT_SELFHEAL_SERVICE_NAME="certbot-renewal"
CERT_SELFHEAL_WRAPPER="/usr/local/bin/certbot-renewal.sh"
CERT_SELFHEAL_FLOCK_LOCK="/run/lock/core_node_certbot.lock"
CERT_SELFHEAL_LE_DIRS=()
CERT_SELFHEAL_READY="no"

# Serialize every certbot invocation WE issue (timer, startup pass, artisan
# renewal) through one canonical flock: concurrent runs queue instead of
# aborting with "Another instance of Certbot is already running". Foreign
# certbot processes are still covered by the config-dir lock-file waits.
cert_selfheal_flock() {
    if [ -x /usr/bin/flock ]; then
        flock -w 180 "$CERT_SELFHEAL_FLOCK_LOCK" "$@"
    else
        "$@"
    fi
}

# Resolve every certbot config dir that actually holds managed certificates.
# Single source of truth: nginx_common.sh's nginx_le_config_dirs_resolve
# (sourced above) — the same resolution the vhost renders use, so renewal and
# rendering can never drift apart again.
cert_selfheal_resolve_le_dirs() {
    nginx_le_config_dirs_resolve
    CERT_SELFHEAL_LE_DIRS=("${NGINX_LE_CONFIG_DIRS[@]}")
}

# Ensure the deploy hook that reloads nginx ONLY after an actual renewal, in
# every detected config dir. Content-hash idempotent per file.
cert_selfheal_ensure_deploy_hooks() {
    local sudo_cmd
    local le_dir=""
    local hook_file=""

    sudo_cmd=$(lazy_sudo)
    for le_dir in "${CERT_SELFHEAL_LE_DIRS[@]}"; do
        hook_file="$le_dir/renewal-hooks/deploy/core_node_nginx_reload.sh"
        $sudo_cmd mkdir -p "$(dirname "$hook_file")"
        write_file_if_changed "$hook_file" <<'EOF'
#!/bin/bash
# core_node deploy hook: runs only after an actual certificate renewal
# (certbot renewal-hooks/deploy contract). Reload nginx with the new cert.
nginx -t && systemctl reload nginx
EOF
        $sudo_cmd chmod 755 "$hook_file" 2>/dev/null || true
    done
}

# Render the renewal wrapper executed by the systemd timer and the startup
# check. One `certbot renew` per config dir that holds renewals; certbot
# gates on near-expiry, the deploy hooks reload nginx after actual renewals.
cert_selfheal_ensure_wrapper() {
    local sudo_cmd
    local le_dir=""
    local renew_blocks=""

    sudo_cmd=$(lazy_sudo)
    for le_dir in "${CERT_SELFHEAL_LE_DIRS[@]}"; do
        renew_blocks="${renew_blocks}if [ -d \"$le_dir/renewal\" ]; then
    # A concurrent certbot (e.g. the timer's Persistent catch-up right after
    # enable) holds the config-dir lock; wait briefly (direct file detection),
    # then let certbot's own near-expiry gate decide. Our own invocations
    # (timer + startup pass) serialize through one canonical flock so they
    # queue instead of aborting on \"Another instance of Certbot\".
    _lock_wait=0
    while [ -e \"$le_dir/.certbot.lock\" ] && [ \$_lock_wait -lt 24 ]; do
        sleep 5
        _lock_wait=\$((_lock_wait + 1))
    done
    if [ -x /usr/bin/flock ]; then
        flock -w 180 \"$CERT_SELFHEAL_FLOCK_LOCK\" \"$CERT_SELFHEAL_CERTBOT_BIN\" renew --config-dir \"$le_dir\" --work-dir \"$le_dir/work\" --logs-dir \"$le_dir/logs\" --quiet
    else
        \"$CERT_SELFHEAL_CERTBOT_BIN\" renew --config-dir \"$le_dir\" --work-dir \"$le_dir/work\" --logs-dir \"$le_dir/logs\" --quiet
    fi
fi
"
    done

    write_file_if_changed "$CERT_SELFHEAL_WRAPPER" <<EOF
#!/bin/bash
# core_node certificate self-heal: renew near-expiry certificates (certbot
# decides per certificate; exits 0 when nothing is due). Deploy hooks under
# each config dir's renewal-hooks/deploy reload nginx after actual renewals.
$renew_blocks
EOF
    $sudo_cmd chmod 755 "$CERT_SELFHEAL_WRAPPER" 2>/dev/null || true
}

# Ensure the twice-daily renewal timer via debian_service_manager's oneshot +
# timer primitives (official cadence guidance; RandomizedDelaySec spreads the
# CA load; Persistent catches up after downtime). Self-detects systemd and
# skips with guidance when unavailable; each unit is content-hash idempotent.
cert_selfheal_ensure_timer() {
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    if [ ! -d /run/systemd/system ] || ! command -v systemctl >/dev/null 2>&1; then
        echo "[cert-selfheal] systemd unavailable; renewal timer skipped (startup check still covers renewals)"
        return 0
    fi

    if [ "$(id -u)" -eq 0 ]; then
        (
            # shellcheck disable=SC1090
            source "$CERT_SELFHEAL_COMMON_DIR/debian_service_manager.sh"
            create_systemd_oneshot_service "$CERT_SELFHEAL_SERVICE_NAME" "core_node certificate renewal run" "$CERT_SELFHEAL_WRAPPER" "/"
            create_systemd_timer "$CERT_SELFHEAL_SERVICE_NAME" "core_node certificate renewal (twice daily; certbot self-gates near-expiry)" \
                "*-*-* 06:17:00" "*-*-* 18:17:00" "RandomizedDelaySec=1h"
        ) || echo "[cert-selfheal] [WARN] timer registration reported issues (continuing)"
    elif command -v sudo >/dev/null 2>&1; then
        sudo bash -c '
            source "$1"
            create_systemd_oneshot_service "$2" "core_node certificate renewal run" "$3" "/"
            create_systemd_timer "$2" "core_node certificate renewal (twice daily; certbot self-gates near-expiry)" "*-*-* 06:17:00" "*-*-* 18:17:00" "RandomizedDelaySec=1h"
        ' _ "$CERT_SELFHEAL_COMMON_DIR/debian_service_manager.sh" "$CERT_SELFHEAL_SERVICE_NAME" "$CERT_SELFHEAL_WRAPPER" \
            || echo "[cert-selfheal] [WARN] timer registration reported issues (continuing)"
    else
        echo "[cert-selfheal] [WARN] need root (or sudo) to register the renewal timer; re-run as root"
    fi

    # Remove the legacy cron entry superseded by the timer.
    if $sudo_cmd crontab -l 2>/dev/null | grep -q "certbot-renewal"; then
        $sudo_cmd crontab -l 2>/dev/null | grep -v "certbot-renewal" | $sudo_cmd crontab - 2>/dev/null || true
        echo "[cert-selfheal] Removed legacy cron renewal entry"
    fi
    return 0
}

# Startup self-heal: ONE linear chain per trigger — ensure deploy hooks +
# wrapper + timer, then (when the Laravel directory is passed) the artisan
# reconcile step (stale-credential reconfigure + broken-lineage repair, NO
# renewal), then a single `certbot renew` via the wrapper (certbot self-gates
# near-expiry; deploy hooks reload nginx only after an actual renewal).
# Long-running hosts are covered by the same wrapper through the timer, so
# renewal logic exists exactly once. Result in CERT_SELFHEAL_READY.
# Usage: cert_selfheal_run_once [laravel_dir]
cert_selfheal_run_once() {
    local laravel_dir="${1:-}"
    local le_dir=""
    local has_renewals="no"
    local php_bin=""
    local _lock_wait=0
    local _locked="no"

    CERT_SELFHEAL_READY="no"

    if [ ! -x "$CERT_SELFHEAL_CERTBOT_BIN" ]; then
        echo "[cert-selfheal] certbot not installed ($CERT_SELFHEAL_CERTBOT_BIN); skipping"
        return 0
    fi

    cert_selfheal_resolve_le_dirs
    cert_selfheal_ensure_deploy_hooks
    cert_selfheal_ensure_wrapper
    cert_selfheal_ensure_timer

    for le_dir in "${CERT_SELFHEAL_LE_DIRS[@]}"; do
        if [ -d "$le_dir/renewal" ]; then
            has_renewals="yes"
        fi
    done

    if [ "$has_renewals" = "yes" ]; then
        # PHP binary by direct file detection, PATH lookup as last resort.
        if [ -x /usr/local/bin/php ]; then
            php_bin="/usr/local/bin/php"
        elif [ -x /usr/bin/php ]; then
            php_bin="/usr/bin/php"
        else
            php_bin="$(command -v php 2>/dev/null || true)"
        fi

        if [ -n "$laravel_dir" ] && [ -f "$laravel_dir/artisan" ] && [ -n "$php_bin" ]; then
            # A concurrent certbot (e.g. the timer's Persistent catch-up right
            # after enable) holds the config-dir lock; wait briefly (direct
            # file detection) before the artisan renewal pass starts its own.
            _lock_wait=0
            while [ "$_lock_wait" -lt 24 ]; do
                _locked="no"
                for le_dir in "${CERT_SELFHEAL_LE_DIRS[@]}"; do
                    if [ -e "$le_dir/.certbot.lock" ]; then
                        _locked="yes"
                    fi
                done
                if [ "$_locked" = "no" ]; then
                    break
                fi
                sleep 5
                _lock_wait=$((_lock_wait + 1))
            done
            echo "[cert-selfheal] startup reconcile via ServerManager (credentials + lineage repair, no renew)..."
            (cd "$laravel_dir" && cert_selfheal_flock "$php_bin" artisan servermanager:certificate reconcile) \
                || echo "[cert-selfheal] [WARN] artisan reconcile reported issues (continuing)"
        fi

        echo "[cert-selfheal] startup renewal pass (near-expiry only)..."
        bash "$CERT_SELFHEAL_WRAPPER"
        CERT_SELFHEAL_READY="yes"
    else
        echo "[cert-selfheal] no managed certificates yet; hook + timer armed for the first issuance"
        CERT_SELFHEAL_READY="yes"
    fi
    return 0
}
