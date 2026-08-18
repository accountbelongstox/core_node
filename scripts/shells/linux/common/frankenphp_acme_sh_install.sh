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
    git -C "$ACME_INSTALL_REPO_DIR" fetch --all --tags >/dev/null 2>&1 || true
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
    # Keep installation idempotent to the configured path; no fixed user home.
    if ! sh "$installer" --install --home "$ACME_INSTALL_HOME_DIR" --config-home "$ACME_INSTALL_CONFIG_DIR" --accountemail "$account_email" >/dev/null 2>&1; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh bootstrap command reported issues; continue"
    fi

    if [ ! -x "$ACME_INSTALL_BIN" ]; then
        return 1
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

# Issue (or keep) the DNSPod DNS-01 certificate for one apex domain: apex +
# wildcard via the acme.sh dns_dp provider, installed into the shared cert
# dir the Caddyfile file-cert gate (fm_acme_cert_dir_for_host) reads.
# acme.sh rc 2 means "Domains not changed" - treated as success.
acme_sh_ensure_certificate() {
    local apex_domain="$1"
    local token_value=""
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
    dp_id="${token_value%%,*}"
    dp_key="${token_value#*,}"
    cert_dir="${FRANKENPHP_ACME_CERT_DIR}/${apex_domain}"
    mkdir -p "$cert_dir"

    DP_Id="$dp_id" DP_Key="$dp_key" "$acme_bin" --issue --dns dns_dp \
        -d "$apex_domain" -d "*.${apex_domain}" \
        --server letsencrypt --keylength ec-256 >/dev/null 2>&1
    rc=$?
    if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ]; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh issue failed (rc=$rc) for ${apex_domain}"
        return 1
    fi

    if ! DP_Id="$dp_id" DP_Key="$dp_key" "$acme_bin" --install-cert -d "$apex_domain" --ecc \
        --fullchain-file "${cert_dir}/fullchain.pem" \
        --key-file "${cert_dir}/key.pem" >/dev/null 2>&1; then
        echo "[$FRANKENPHP_ACME_INSTALL_INDEX] [WARN] acme.sh install-cert failed for ${apex_domain}"
        return 1
    fi
    chmod 600 "${cert_dir}/key.pem" 2>/dev/null || true
    echo "[$FRANKENPHP_ACME_INSTALL_INDEX] DNS-01 certificate ready: ${cert_dir} (${apex_domain}, *.${apex_domain})"
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

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    acme_sh_ensure_install "$@"
fi
