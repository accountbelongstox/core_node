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

# ACME helper script for FrankenPHP prebuilt installs.
# It installs acme.sh under COMPILE_DIR and ensures a stable binary link in
# /usr/local/bin, while keeping each step idempotent.

FRANKENPHP_ACME_INSTALL_INDEX="acme-sh-install"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACME_COMMON_NAMESPACE="acme_sh_install"
ACME_INSTALL_REPO="https://github.com/acmesh-official/acme.sh"
ACME_INSTALL_LINK="/usr/local/bin/acme.sh"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/common_functions.sh"
source "$SCRIPT_CURRENT_DIR/step_state.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

# Unified path family (builder single source): acme.sh lives under the same
# persistent FrankenPHP build root as the sources and the prebuilt cache.
ACME_INSTALL_DIR="${FRANKENPHP_ACME_DIR}"
ACME_INSTALL_REPO_DIR="${ACME_INSTALL_DIR}/repo"
ACME_INSTALL_HOME_DIR="${ACME_INSTALL_DIR}/home"
ACME_INSTALL_CONFIG_DIR="${ACME_INSTALL_HOME_DIR}/.acme.sh"
ACME_INSTALL_BIN="${ACME_INSTALL_HOME_DIR}/acme.sh"

ACME_INSTALL_FINGERPRINT="prebuilt-v1"
ACME_SH_FLOCK_FILE="/run/lock/core_node_acme_sh.lock"
ACME_SH_INSTALL_LOG="${ACME_INSTALL_CONFIG_DIR}/install.log"
ACME_SH_SERVICE_NAME="ncore-acme-cert"
ACME_SH_SERVICE_UNIT="/etc/systemd/system/${ACME_SH_SERVICE_NAME}.service"
ACME_SH_TIMER_UNIT="/etc/systemd/system/${ACME_SH_SERVICE_NAME}.timer"

acme_install_fingerprint() {
    local repo_state=""
    local home_state=""
    local link_state=""
    local version_state=""

    if [ -d "$ACME_INSTALL_REPO_DIR/.git" ]; then
        repo_state="repo"
    else
        repo_state="norepo"
    fi
    if [ -x "$ACME_INSTALL_BIN" ]; then
        version_state="$(stat -c '%s_%Y' "$ACME_INSTALL_BIN" 2>/dev/null || echo no-stat)"
    else
        version_state="no-bin"
    fi
    if [ -x "$ACME_INSTALL_LINK" ]; then
        link_state="link"
    else
        link_state="no-link"
    fi
    if [ -d "$ACME_INSTALL_HOME_DIR" ]; then
        home_state="home"
    else
        home_state="no-home"
    fi
    echo "${ACME_INSTALL_FINGERPRINT}-${repo_state}-${home_state}-${version_state}-${link_state}"
}

acme_install_ensure_repo() {
    if [ ! -d "$ACME_INSTALL_REPO_DIR/.git" ]; then
        $USE_SUDO rm -rf "$ACME_INSTALL_REPO_DIR" 2>/dev/null || rm -rf "$ACME_INSTALL_REPO_DIR" 2>/dev/null || true
        mkdir -p "$ACME_INSTALL_REPO_DIR"
        if ! git clone "$ACME_INSTALL_REPO" "$ACME_INSTALL_REPO_DIR" >/dev/null 2>&1; then
            echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] clone failed: $ACME_INSTALL_REPO"
            return 1
        fi
    fi

    if [ ! -f "$ACME_INSTALL_REPO_DIR/acme.sh" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh not present after clone"
        return 1
    fi

    git -C "$ACME_INSTALL_REPO_DIR" remote get-url origin >/dev/null 2>&1 || return 1
    timeout 60 git -C "$ACME_INSTALL_REPO_DIR" fetch --all --tags >/dev/null 2>&1 || true
    return 0
}

acme_install_linked_binary() {
    if [ -x "$ACME_INSTALL_LINK" ]; then
        echo "$ACME_INSTALL_LINK"
        return 0
    fi
    if [ -x "$ACME_INSTALL_BIN" ]; then
        $USE_SUDO ln -sfn "$ACME_INSTALL_BIN" "$ACME_INSTALL_LINK"
        $USE_SUDO chmod 777 "$ACME_INSTALL_LINK" 2>/dev/null || true
        echo "$ACME_INSTALL_LINK"
        return 0
    fi
    echo ""
    return 0
}

acme_install_bootstrap() {
    local installer=""
    local account_email=""
    local install_status="0"

    if [ -x "$ACME_INSTALL_BIN" ] && [ -x "$ACME_INSTALL_LINK" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [SKIP] acme.sh already has an installed script at $ACME_INSTALL_BIN"
        return 0
    fi

    installer="${ACME_INSTALL_REPO_DIR}/acme.sh"
    if [ ! -x "$installer" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] acme.sh installer script missing in repository: $ACME_INSTALL_REPO_DIR"
        return 1
    fi

    mkdir -p "$ACME_INSTALL_HOME_DIR"
    mkdir -p "$ACME_INSTALL_CONFIG_DIR"
    account_email="${ACME_INSTALL_EMAIL:-admin@example.com}"
    # The upstream installer copies its own entry by the RELATIVE name
    # "acme.sh" (PROJECT_ENTRY), so it MUST run with the repository as the
    # working directory - a foreign CWD is the classic silent bootstrap
    # failure ("cp: cannot stat 'acme.sh'"). Full output goes to a log file;
    # the tail is printed only on failure for diagnosis. --nocron: renewal
    # runs through the dedicated systemd timer (acme_sh_service_ensure)
    # instead of the installer's daily cron entry (official wiki pattern
    # "Using systemd units instead of cron").
    if ! (
        cd "$ACME_INSTALL_REPO_DIR" \
            && sh ./acme.sh --install \
                --home "$ACME_INSTALL_HOME_DIR" \
                --config-home "$ACME_INSTALL_CONFIG_DIR" \
                --accountemail "$account_email" \
                --nocron \
                >"$ACME_SH_INSTALL_LOG" 2>&1
    ); then
        install_status="1"
    fi

    if [ ! -x "$ACME_INSTALL_BIN" ]; then
        install_status="1"
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh bootstrap failed; installer log tail:"
        tail -n 20 "$ACME_SH_INSTALL_LOG" 2>/dev/null \
            || echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] no installer log at $ACME_SH_INSTALL_LOG"
        return 1
    fi
    if [ "$install_status" != "0" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh bootstrap reported issues (binary present); log: $ACME_SH_INSTALL_LOG"
    fi
    return 0
}

acme_install_paths() {
    mkdir -p "$ACME_INSTALL_HOME_DIR"
    mkdir -p "$ACME_INSTALL_CONFIG_DIR"
    mkdir -p "$(dirname "$ACME_INSTALL_LINK")"
    return 0
}

acme_install_verify() {
    if [ ! -x "$ACME_INSTALL_LINK" ] && [ ! -x "$ACME_INSTALL_BIN" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh is not executable at $ACME_INSTALL_LINK or $ACME_INSTALL_BIN"
        return 1
    fi
    echo "[$FRANKENPHP_ACME_INSTALL_INDEX] acme.sh ready: ${ACME_INSTALL_LINK} -> ${ACME_INSTALL_BIN}"
    return 0
}

acme_sh_ensure_install() {
    local linked_path=""
    local current_fingerprint=""

    current_fingerprint="$(acme_install_fingerprint)"
    step_run "$ACME_COMMON_NAMESPACE" "acme-repo" "$current_fingerprint" acme_install_ensure_repo
    current_fingerprint="$(acme_install_fingerprint)"
    step_run "$ACME_COMMON_NAMESPACE" "acme-paths" "$current_fingerprint" acme_install_paths
    current_fingerprint="$(acme_install_fingerprint)"
    step_run "$ACME_COMMON_NAMESPACE" "acme-install" "$current_fingerprint" acme_install_bootstrap
    acme_install_linked_binary
    linked_path="$(acme_install_linked_binary)"
    if [ -n "$linked_path" ]; then
        current_fingerprint="$(acme_install_fingerprint)"
        step_run "$ACME_COMMON_NAMESPACE" "acme-verify" "$current_fingerprint" acme_install_verify
    else
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh link missing; manual retry may be required"
    fi
}

# Issue (or keep) the DNSPod DNS-01 certificate for one apex domain via the
# acme.sh dns_dp provider, installed into the shared cert dir the Caddyfile
# file-cert gate (fm_acme_cert_dir_for_host) reads. SANs: apex, *.apex and
# (when the api region prefix resolves) *.<prefix>.<apex> - the wildcard
# apex cert alone does NOT cover the two-label api.<prefix>.<apex> host.
# acme.sh rc 2 means "Domains not changed" - treated as success. The
# optional second argument is a --reloadcmd baked into the renewal conf
# (service contexts pass a caddy admin /load poke so renewed certs go live
# without a service restart; the installer path leaves it empty).
acme_sh_ensure_certificate() {
    local apex_domain="$1"
    local reload_cmd="${2:-}"
    local token_value=""
    local account_email=""
    local prefix=""
    local dp_id=""
    local dp_key=""
    local cert_dir=""
    local acme_bin=""
    local rc="0"

    [ -n "$apex_domain" ] || return 1
    acme_bin="$(acme_install_linked_binary)"
    if [ -z "$acme_bin" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh not usable yet; certificate deferred for ${apex_domain}"
        return 1
    fi
    token_value="$(get_secret_key_from_common_functions "$FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY")"
    if [ -z "$token_value" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] ${FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY} absent; certificate deferred for ${apex_domain}"
        return 1
    fi
    account_email="$(get_secret_key_from_common_functions "$FRANKENPHP_DNSPOD_EMAIL_SECRET_KEY" 2>/dev/null)"
    if [ -n "$account_email" ]; then
        "$acme_bin" --register-account -m "$account_email" >/dev/null 2>&1 || true
    fi
    prefix="${DOMAIN_API_PREFIX:-}"
    if [ -z "$prefix" ]; then
        prefix="$(get_global_var "DOMAIN_API_REGION_PREFIX" "")"
    fi
    dp_id="${token_value%%,*}"
    dp_key="${token_value#*,}"
    cert_dir="${FRANKENPHP_ACME_CERT_DIR}/${apex_domain}"
    issue_log="${ACME_INSTALL_CONFIG_DIR}/issue-${apex_domain}.log"
    mkdir -p "$cert_dir"

    ACME_SH_SAN_ARGS=(-d "$apex_domain" -d "*.${apex_domain}")
    if [ -n "$prefix" ]; then
        ACME_SH_SAN_ARGS+=(-d "*.${prefix}.${apex_domain}")
    fi

    # dns_dp adds all TXT records then sleeps the default 120s before
    # verification; a transient propagation miss at the CA's resolvers can
    # still fail one SAN (observed: "No TXT record found" on the deepest
    # wildcard seconds after the API accepted the record). One immediate
    # retry resolves it - the zone has already settled by then.
    acme_sh_issue_attempt() {
        DP_Id="$dp_id" DP_Key="$dp_key" "$acme_bin" --issue --dns dns_dp \
            "${ACME_SH_SAN_ARGS[@]}" \
            --server letsencrypt --keylength ec-256 >"$issue_log" 2>&1
        return $?
    }
    acme_sh_issue_attempt
    rc=$?
    if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh issue failed (rc=$rc) for ${apex_domain}, retrying once"
        acme_sh_issue_attempt
        rc=$?
    fi
    if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh issue failed (rc=$rc) for ${apex_domain}; tail of ${issue_log}:"
        tail -n 15 "$issue_log" 2>/dev/null \
            || echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] no issue log at $issue_log"
        return 1
    fi

    ACME_SH_INSTALL_ARGS=(--install-cert -d "$apex_domain" --ecc \
        --fullchain-file "${cert_dir}/fullchain.pem" \
        --key-file "${cert_dir}/key.pem")
    if [ -n "$reload_cmd" ]; then
        ACME_SH_INSTALL_ARGS+=(--reloadcmd "$reload_cmd")
    fi
    if ! DP_Id="$dp_id" DP_Key="$dp_key" "$acme_bin" "${ACME_SH_INSTALL_ARGS[@]}" >/dev/null 2>&1; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh install-cert failed for ${apex_domain}"
        return 1
    fi
    chmod 600 "${cert_dir}/key.pem" 2>/dev/null || true
    echo "[$FRANKENPHP_ACME_INSTALL_INDEX] DNS-01 certificate ready: ${cert_dir} (${apex_domain}, *.${apex_domain}$(if [ -n "$prefix" ]; then printf ', *.%s.%s' "$prefix" "$apex_domain"; fi))"
    return 0
}

# Iterate the configured DOMAIN_DOMAINS_LIST (no-op when unset/empty); a
# failing domain defers that certificate without aborting the install flow.
acme_sh_ensure_domains() {
    local apex_domain=""

    if [ -z "${DOMAIN_DOMAINS_LIST:-}" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] no DOMAIN_DOMAINS_LIST configured; certificate issuance skipped"
        return 0
    fi
    while IFS= read -r apex_domain; do
        [ -n "$apex_domain" ] || continue
        acme_sh_ensure_certificate "$apex_domain" || true
    done <<EOF
$(printf '%s\n' "$DOMAIN_DOMAINS_LIST")
EOF
    return 0
}

# Persistent renewal service (official acme.sh wiki pattern "Using
# systemd units instead of cron"): a oneshot service running the acme.sh
# daily cron equivalent (`--cron`) plus a persistent 6h timer. Renewals
# re-run the Le_ReloadCmd baked into each renewal conf (the caddy admin
# /load poke), so renewed certificates go live without a service restart.
# DNSPod credentials are NOT needed here: DP_Id/DP_Key are persisted in
# the acme.sh account.conf by the first issuance and reused automatically.
acme_sh_service_ensure() {
    local acme_bin=""
    local service_content=""
    local timer_content=""

    if ! command -v systemctl >/dev/null 2>&1 \
        || [ ! -d /run/systemd/system ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] systemd not active; acme.sh renewal timer not registered"
        return 0
    fi
    acme_bin="$(acme_install_linked_binary)"
    if [ -z "$acme_bin" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh not usable; renewal timer not registered"
        return 0
    fi

    service_content="[Unit]
Description=Renew Let's Encrypt certificates using acme.sh (core_node)
After=network-online.target nss-lookup.target
Wants=network-online.target

[Service]
Type=oneshot
SyslogIdentifier=${ACME_SH_SERVICE_NAME}
ExecStart=${acme_bin} --cron --home ${ACME_INSTALL_HOME_DIR} --config-home ${ACME_INSTALL_CONFIG_DIR}
"
    timer_content="[Unit]
Description=Renewal of Let's Encrypt certificates (core_node acme.sh)

[Timer]
OnCalendar=0/6:00:00
RandomizedOffsetSec=6h
FixedRandomDelay=true
Persistent=true

[Install]
WantedBy=timers.target
"

    if [ "$(cat "$ACME_SH_SERVICE_UNIT" 2>/dev/null || true)" != "$service_content" ]; then
        printf '%s\n' "$service_content" > "$ACME_SH_SERVICE_UNIT"
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] renewal service unit written: $ACME_SH_SERVICE_UNIT"
    fi
    if [ "$(cat "$ACME_SH_TIMER_UNIT" 2>/dev/null || true)" != "$timer_content" ]; then
        printf '%s\n' "$timer_content" > "$ACME_SH_TIMER_UNIT"
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] renewal timer unit written: $ACME_SH_TIMER_UNIT"
    fi
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable --now "${ACME_SH_SERVICE_NAME}.timer" >/dev/null 2>&1 || true
    if [ "$(systemctl is-active "${ACME_SH_SERVICE_NAME}.timer" 2>/dev/null || true)" = "active" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] renewal timer active: ${ACME_SH_SERVICE_NAME}.timer (next: $(systemctl list-timers "${ACME_SH_SERVICE_NAME}.timer" --no-pager 2>/dev/null | awk 'NR==2 {print $1, $2, $3}' | tr -d '\n'))"
    else
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] renewal timer not active; check: systemctl status ${ACME_SH_SERVICE_NAME}.timer"
    fi
    return 0
}

# Service-start certificate pre-flight: ensure the acme.sh DNS-01 prebuilt
# certificates exist BEFORE the server renders its Caddyfile and binds the
# HTTPS port (the Caddyfile prebuilt-tls gate pins them; the embedded
# dnspod module stays a fallback). The apex set = the site host apex +
# every managed route-file apex + the populated DOMAIN_DOMAINS_LIST, all
# de-duplicated. Issuance failures only warn - the renderers keep their
# fallback gates and the server still starts. The optional third argument
# is the --reloadcmd baked into the renewal conf (caddy admin /load poke).
acme_sh_preflight_for_service() {
    local site_host="$1"
    local routes_dir="$2"
    local reload_cmd="${3:-}"
    local prefix=""
    local apex=""
    local route_file=""
    local apex_list=""
    local acme_bin=""

    acme_sh_ensure_install

    [ -n "$site_host" ] || site_host="localhost"
    prefix="${DOMAIN_API_PREFIX:-}"
    if [ -z "$prefix" ]; then
        prefix="$(get_global_var "DOMAIN_API_REGION_PREFIX" "")"
    fi

    apex_list=" "
    if [ "$site_host" != "localhost" ]; then
        apex="${site_host#api.${prefix}.}"
        if [ -n "$apex" ] && [ "$apex" != "localhost" ]; then
            apex_list="${apex_list}${apex} "
        fi
    fi
    if [ -n "$routes_dir" ] && [ -d "$routes_dir" ]; then
        for route_file in "$routes_dir"/*.caddy; do
            [ -f "$route_file" ] || continue
            apex="$(basename "$route_file" .caddy)"
            case "$apex_list" in *" $apex "*) continue ;; esac
            apex_list="${apex_list}${apex} "
        done
    fi
    if [ -n "${DOMAIN_DOMAINS_LIST:-}" ]; then
        while IFS= read -r apex; do
            [ -n "$apex" ] || continue
            case "$apex_list" in *" $apex "*) continue ;; esac
            apex_list="${apex_list}${apex} "
        done <<EOF
$(printf '%s\n' "$DOMAIN_DOMAINS_LIST")
EOF
    fi

    if [ "$apex_list" = " " ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] pre-flight: no domains configured; certificate issuance skipped"
        return 0
    fi

    echo "[$FRANKENPHP_ACME_INSTALL_INDEX] pre-flight: ensuring DNS-01 certificates for:${apex_list}"
    # Serialize concurrent pre-flights (service restart loop vs installer)
    # through one flock: queued, never aborted.
    if [ -x /usr/bin/flock ]; then
        exec 9>"$ACME_SH_FLOCK_FILE"
        flock -w 600 9 || true
    fi
    for apex in $apex_list; do
        acme_sh_ensure_certificate "$apex" "$reload_cmd" || true
    done
    if [ -x /usr/bin/flock ]; then
        flock -u 9 2>/dev/null || true
        exec 9>&- 2>/dev/null || true
    fi

    # Post-flight detail (diagnosis): managed certificates as acme.sh sees
    # them, plus the persistent renewal timer. Nothing secret is printed.
    acme_bin="$(acme_install_linked_binary)"
    if [ -n "$acme_bin" ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] acme.sh managed certificates:"
        "$acme_bin" --list --home "$ACME_INSTALL_HOME_DIR" --config-home "$ACME_INSTALL_CONFIG_DIR" 2>/dev/null \
            | awk 'NR==1 || /^(Main_Domain|[a-zA-Z0-9.-]+\.)[a-zA-Z]/ {print}' \
            || echo "[$FRANKENPHP_ACME_INSTALL_INDEX] (no certificates issued yet)"
    fi
    acme_sh_service_ensure
    return 0
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    acme_sh_ensure_install "$@"
fi
