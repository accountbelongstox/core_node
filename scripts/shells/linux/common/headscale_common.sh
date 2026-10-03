#!/bin/bash

# =============================================================================
# headscale_common.sh - Headscale branch of the mesh VPN provider.
#
# The node side keeps using the official Tailscale client; Headscale only swaps
# the control plane (--login-server, pre-auth key, admin text, certificates).
# Everything here is selected by `if [ "$(mesh_vpn_provider)" = "headscale" ]`
# at the Tailscale call sites. Design: docs_fix/DESIGN_SHELL_HOSTS.md 6.5.
#
# Client branch:
#   headscale_login_server_arg      - --login-server=<url>
#   headscale_authkey_read          - HEADSCALE_AUTHKEY_1 secret value (never echo it)
#   headscale_authkey_masked        - masked form for logs
#   headscale_extract_login_url     - first login/register URL of the Headscale server on stdin
#   headscale_print_admin_info      - admin text (no SaaS console; server CLI/menu)
#   headscale_print_register_hint   - how an admin approves an interactive login
#   headscale_tls_dns01_ready       - yes|no: Caddy dnspod module + token available
#   headscale_lan_tls_directive     - Caddy tls line for a tailnet site
#   headscale_lan_cert_machine      - <machine>.<base> certificate branch (DNS-01 / mkcert fallback)
# Server branch (step 98 and menu_itemshells/headscale_menu.sh):
#   headscale_cli, headscale_server_installed, headscale_service_state,
#   headscale_user_ensure, headscale_preauthkey_create, headscale_authkey_store,
#   headscale_extra_records_sync, headscale_server_route_ensure, list helpers.
# =============================================================================

if [ "${HEADSCALE_COMMON_LOADED:-false}" = "true" ]; then
    return 0 2>/dev/null || exit 0
fi
HEADSCALE_COMMON_LOADED="true"

HEADSCALE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HEADSCALE_COMMON_DIR/mesh_common.sh"
# shellcheck source=/dev/null
source "$HEADSCALE_COMMON_DIR/file_ops_common.sh"

HEADSCALE_REPO_ROOT="$(cd "$HEADSCALE_COMMON_DIR/../../../.." && pwd)"
HEADSCALE_SECRET_RAW_DIR="$HEADSCALE_REPO_ROOT/.secret_keys/.secret_ignore"
HEADSCALE_ROUTE_MARKER="managed-by: headscale_common"
HEADSCALE_PREAUTH_EXPIRATION="87600h"
HEADSCALE_DNS_NAMESERVERS_GLOBAL="1.1.1.1 8.8.8.8"
HEADSCALE_DNS_NAMESERVERS_CHINA="223.5.5.5 119.29.29.29"

headscale_contract_value() {
    sc_get "access.mesh.headscale.$1"
}

headscale_service_name() {
    local name=""
    name="$(headscale_contract_value service)"
    printf '%s' "${name:-headscale}"
}

headscale_config_dir() {
    local dir=""
    dir="$(headscale_contract_value config_dir)"
    printf '%s' "${dir:-/etc/headscale}"
}

headscale_data_dir() {
    local dir=""
    dir="$(headscale_contract_value data_dir)"
    printf '%s' "${dir:-/var/lib/headscale}"
}

headscale_user_name() {
    local name=""
    name="$(headscale_contract_value user)"
    printf '%s' "${name:-core}"
}

headscale_authkey_secret_name() {
    local name=""
    name="$(headscale_contract_value authkey_secret)"
    printf '%s' "${name:-HEADSCALE_AUTHKEY_1}"
}

# ---- client branch ----------------------------------------------------------

headscale_login_server_arg() {
    local url=""
    url="$(mesh_login_server_url)"
    [ -n "$url" ] && printf -- '--login-server=%s' "$url"
}

headscale_authkey_read() {
    if ! declare -F get_secret_key_from_common_functions >/dev/null 2>&1; then
        # shellcheck source=/dev/null
        source "$HEADSCALE_COMMON_DIR/common_functions.sh"
    fi
    get_secret_key_from_common_functions "$(headscale_authkey_secret_name)" 2>/dev/null
}

headscale_authkey_masked() {
    local key="$1"
    if [ -z "$key" ]; then
        printf '(none)'
        return 0
    fi
    printf '%s...(%s chars)' "${key:0:4}" "${#key}"
}

# stdin: command output. Prints the first https URL on the Headscale server.
headscale_extract_login_url() {
    local url=""
    url="$(mesh_login_server_url)"
    [ -n "$url" ] || return 0
    grep -oE "${url//./\\.}/[^[:space:]]*" | head -n1
}

headscale_print_admin_info() {
    local url=""
    url="$(mesh_login_server_url)"
    echo "Headscale control server: ${url:-unknown}"
    echo "  There is no SaaS admin console. Manage nodes on the server host:"
    echo "  dd.sh > Linux Management > Linux System Tools > [T] Mesh VPN > Headscale server menu"
    echo "  or: sudo headscale nodes list | users list | preauthkeys create --reusable"
}

headscale_print_register_hint() {
    echo "  An interactive login prints a register URL; approve it on the server with:"
    echo "  sudo headscale nodes register --user $(headscale_user_name) --key <key from the URL>"
    echo "  Or put a reusable pre-auth key in the secret $(headscale_authkey_secret_name) and rerun the installer."
}

# yes when this Caddy build can solve DNS-01 through DNSPod and a token exists.
# Needs the frankenphp manager helpers; no: otherwise (nginx plane / not loaded).
headscale_tls_dns01_ready() {
    if declare -F fm_has_module >/dev/null 2>&1 && declare -F fm_dnspod_token_value >/dev/null 2>&1 \
        && [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] \
        && [ -n "$(fm_dnspod_token_value)" ]; then
        printf 'yes'
        return 0
    fi
    printf 'no'
}

# Caddy tls line(s) for one tailnet site. Args: cert key. DNS-01 (DNSPod) when
# DOMAIN_LAN_TS_DNS01=yes, else the pinned certificate files.
headscale_lan_tls_directive() {
    if [ "${DOMAIN_LAN_TS_DNS01:-no}" = "yes" ]; then
        printf '\ttls {\n\t\tdns dnspod {env.%s}\n\t}' "$FRANKENPHP_DNSPOD_TOKEN_KEY"
        return 0
    fi
    printf '\ttls %s %s' "$1" "$2"
}

# Refresh DOMAIN_LAN_TS_DNS01 (called from the LAN path refresh).
headscale_lan_dns01_refresh() {
    DOMAIN_LAN_TS_DNS01="no"
    if [ -n "$DOMAIN_TS_DNSNAME" ]; then
        DOMAIN_LAN_TS_DNS01="$(headscale_tls_dns01_ready)"
    fi
}

# acme.sh DNS-01 (DNSPod) certificate dir of this machine's MagicDNS name:
# SANs <machine>.<domain> + *.<machine>.<domain> cover the UI/API/pycore
# site and api.<machine>.<domain>. Empty when the dir is unknown.
headscale_lan_acme_cert_dir() {
    [ -n "$DOMAIN_TS_DNSNAME" ] && [ -n "${FRANKENPHP_ACME_CERT_DIR:-}" ] || return 0
    printf '%s/%s' "$FRANKENPHP_ACME_CERT_DIR" "$DOMAIN_TS_DNSNAME"
}

# Prefer the publicly trusted acme.sh certificate for both tailnet names
# (called from domain_setup_lan_cert_paths_refresh after the mkcert lookups).
headscale_lan_acme_cert_paths() {
    local cert_dir=""

    cert_dir="$(headscale_lan_acme_cert_dir)"
    [ -n "$cert_dir" ] && [ -s "$cert_dir/fullchain.pem" ] && [ -s "$cert_dir/key.pem" ] || return 0
    DOMAIN_LAN_TS_CERT="$cert_dir/fullchain.pem"
    DOMAIN_LAN_TS_KEY="$cert_dir/key.pem"
    DOMAIN_LAN_TS_API_CERT="$cert_dir/fullchain.pem"
    DOMAIN_LAN_TS_API_KEY="$cert_dir/key.pem"
}

# Issue/keep the acme.sh certificate (idempotent: acme_sh_ensure_certificate
# keeps a ready one). Runs in a subshell: the acme library reassigns
# SCRIPT_CURRENT_DIR. Renewals reload Caddy through the admin /load hook.
headscale_lan_acme_cert_ensure() {
    [ -n "$DOMAIN_TS_DNSNAME" ] || return 0
    (
        # shellcheck source=/dev/null
        source "$HEADSCALE_COMMON_DIR/frankenphp_acme_sh_install.sh" >/dev/null 2>&1
        acme_sh_ensure_install >/dev/null 2>&1 || true
        acme_sh_ensure_certificate "$DOMAIN_TS_DNSNAME" "$(acme_sh_caddy_reload_cmd "$FM_DOMAIN_CADDYFILE")" "-"
    ) | while IFS= read -r line; do echo "[domain]   $line"; done
}

# Headscale replacement for domain_setup_lan_cert_tailscale: no `tailscale
# cert`. <machine>.<base> is served by Caddy DNS-01 (DNSPod); without the
# module/token a mkcert certificate (local CA) is pinned instead.
headscale_lan_cert_machine() {
    local ts_bin=""
    local mkcert_bin=""
    local login_arg=""

    ts_bin="$(command -v tailscale 2>/dev/null || true)"
    login_arg="$(headscale_login_server_arg)"
    domain_setup_resolve_lan_cert_dir
    mkdir -p "$DOMAIN_LAN_CERT_DIR" 2>/dev/null || true
    domain_setup_load_tailscale_domain

    if [ -z "$ts_bin" ]; then
        echo "[domain] [MANUAL] tailscale client not installed; install it and join Headscale:"
        echo "[domain]   sudo tailscale up $login_arg --authkey=<$(headscale_authkey_secret_name)>"
        return 1
    fi
    if ! "$ts_bin" status >/dev/null 2>&1; then
        echo "[domain] [MANUAL] tailscale is installed but not connected; run: sudo tailscale up $login_arg"
        return 1
    fi
    DOMAIN_TS_DNSNAME="$(domain_setup_tailscale_dnsname)"
    if [ -z "$DOMAIN_TS_DNSNAME" ]; then
        echo "[domain] [MANUAL] Could not resolve this machine's MagicDNS name under $(mesh_domain); check 'tailscale status'"
        return 1
    fi
    headscale_lan_dns01_refresh
    if [ "$DOMAIN_LAN_TS_DNS01" = "yes" ]; then
        echo "[domain] [OK] $DOMAIN_TS_DNSNAME: Caddy DNS-01 (DNSPod) issues the certificate; no tailscale cert"
        return 0
    fi
    headscale_lan_acme_cert_ensure
    domain_setup_lan_cert_paths_refresh
    if [ "$DOMAIN_LAN_TS_CERT" = "$(headscale_lan_acme_cert_dir)/fullchain.pem" ]; then
        echo "[domain] [OK] $DOMAIN_TS_DNSNAME + *.$DOMAIN_TS_DNSNAME: acme.sh DNS-01 (DNSPod) certificate"
        return 0
    fi
    mkcert_bin="$(command -v mkcert 2>/dev/null || true)"
    if [ -z "$mkcert_bin" ]; then
        domain_setup_mkcert_install || true
        hash -r 2>/dev/null
        mkcert_bin="$(command -v mkcert 2>/dev/null || true)"
    fi
    if [ -z "$mkcert_bin" ]; then
        echo "[domain] [MANUAL] No DNSPod token/module and no mkcert; cannot certify $DOMAIN_TS_DNSNAME"
        return 1
    fi
    # Idempotent: keep a certificate that already covers the name for 30+ days.
    if [ -f "$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.crt" ] && [ -f "$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.key" ] \
        && openssl x509 -in "$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.crt" -noout -checkend 2592000 >/dev/null 2>&1 \
        && openssl x509 -in "$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.crt" -noout -ext subjectAltName 2>/dev/null | grep -qF "DNS:$DOMAIN_TS_DNSNAME"; then
        echo "[domain] [OK] mkcert (local CA) certificate for $DOMAIN_TS_DNSNAME still valid; kept"
        domain_setup_lan_cert_paths_refresh
        [ -n "$DOMAIN_LAN_TS_CERT" ] && return 0
    fi
    echo "[domain] [WARN] No DNSPod token/module for DNS-01; using a mkcert (local CA) certificate for $DOMAIN_TS_DNSNAME"
    (cd "$DOMAIN_LAN_CERT_DIR" && "$mkcert_bin" -cert-file "$DOMAIN_TS_DNSNAME.crt" -key-file "$DOMAIN_TS_DNSNAME.key" "$DOMAIN_TS_DNSNAME" 2>&1) \
        | while IFS= read -r DOMAIN_LAN_OUTPUT; do echo "[domain]   $DOMAIN_LAN_OUTPUT"; done
    domain_setup_lan_cert_paths_refresh
    [ -n "$DOMAIN_LAN_TS_CERT" ] && return 0
    return 1
}

# ---- server branch ----------------------------------------------------------

headscale_server_installed() {
    command -v headscale >/dev/null 2>&1
}

headscale_service_state() {
    systemctl is-active "$(headscale_service_name)" 2>/dev/null
}

headscale_cli() {
    local sudo_cmd=""
    sudo_cmd="$(lazy_sudo)"
    $sudo_cmd headscale --config "$(headscale_config_dir)/config.yaml" "$@"
}

# JSON field helper: stdin JSON, args: python expression over `data`.
headscale_json_eval() {
    command -v python3 >/dev/null 2>&1 || return 0
    python3 -c 'import sys, json
try:
    data = json.load(sys.stdin)
    expr = sys.argv[1]
    print(eval(expr))
except Exception:
    pass' "$1" 2>/dev/null
}

headscale_user_id() {
    local user=""
    user="$(headscale_user_name)"
    headscale_cli users list -o json 2>/dev/null \
        | headscale_json_eval "next((u.get('id') for u in data if u.get('name') == '$user'), '')"
}

headscale_user_ensure() {
    local user=""
    user="$(headscale_user_name)"
    if [ -n "$(headscale_user_id)" ]; then
        return 0
    fi
    headscale_cli users create "$user" >/dev/null 2>&1 || true
}

# Prints a new reusable pre-auth key on stdout; callers must store it, never echo it.
headscale_preauthkey_create() {
    local user_ref=""
    local out=""

    user_ref="$(headscale_user_id)"
    [ -n "$user_ref" ] || user_ref="$(headscale_user_name)"
    out="$(headscale_cli preauthkeys create --user "$user_ref" --reusable --expiration "$HEADSCALE_PREAUTH_EXPIRATION" -o json 2>/dev/null)"
    printf '%s' "$out" | headscale_json_eval "data.get('key', '')"
}

# Writes the key into the raw secret store (mode 600, replaces the old value).
headscale_authkey_store() {
    local value="$1"
    local name=""
    local tmp_file=""

    [ -n "$value" ] || return 0
    name="$(headscale_authkey_secret_name)"
    mkdir -p -m 700 "$HEADSCALE_SECRET_RAW_DIR" 2>/dev/null
    tmp_file="$(mktemp "$HEADSCALE_SECRET_RAW_DIR/.$name.XXXXXX")" || return 0
    printf '%s' "$value" > "$tmp_file"
    chmod 600 "$tmp_file"
    mv -f "$tmp_file" "$HEADSCALE_SECRET_RAW_DIR/$name"
}

# dns.extra_records_path JSON: api.<machine>.<base> -> node IPv4 for every node.
headscale_extra_records_file() {
    printf '%s/extra-records.json' "$(headscale_data_dir)"
}

headscale_extra_records_sync() {
    local api_label=""
    local base=""
    local records=""
    local target=""

    command -v python3 >/dev/null 2>&1 || return 0
    api_label="$(sc_get access.tailnet.api_label)"
    base="$(mesh_domain)"
    [ -n "$api_label" ] && [ -n "$base" ] || return 0
    target="$(headscale_extra_records_file)"
    records="$(headscale_cli nodes list -o json 2>/dev/null | python3 -c '
import sys, json
label, base = sys.argv[1], sys.argv[2]
out = []
try:
    for node in json.load(sys.stdin) or []:
        name = node.get("given_name") or node.get("name") or ""
        ips = [ip for ip in (node.get("ip_addresses") or []) if ":" not in ip]
        if name and ips:
            out.append({"name": "%s.%s.%s" % (label, name, base), "type": "A", "value": ips[0]})
except Exception:
    pass
print(json.dumps(out, indent=2))' "$api_label" "$base" 2>/dev/null)"
    [ -n "$records" ] || return 0
    printf '%s\n' "$records" | write_file_if_changed "$target" "" 640 headscale headscale >/dev/null
}

headscale_nodes_list() {
    headscale_cli nodes list
}

headscale_users_list() {
    headscale_cli users list
}

headscale_routes_list() {
    headscale_cli nodes list-routes 2>/dev/null || headscale_cli routes list
}

headscale_routes_approve() {
    local node_id="$1"
    local routes="$2"
    headscale_cli nodes approve-routes --identifier "$node_id" --routes "$routes" 2>/dev/null \
        || headscale_cli routes enable --route "$routes"
}

headscale_service_restart() {
    local sudo_cmd=""
    sudo_cmd="$(lazy_sudo)"
    $sudo_cmd systemctl restart "$(headscale_service_name)"
    echo "Service active state: $(headscale_service_state)"
}

headscale_dns_nameservers() {
    local region=""
    if declare -F get_var >/dev/null 2>&1; then
        region="$(get_var SELECTED_REGION "" 2>/dev/null)"
    fi
    if [ "$region" = "China" ]; then
        printf '%s' "$HEADSCALE_DNS_NAMESERVERS_CHINA"
    else
        printf '%s' "$HEADSCALE_DNS_NAMESERVERS_GLOBAL"
    fi
}

# Render the Caddy site for the control server. Plain reverse proxy (Caddy
# upgrades the ts2021/DERP connections). The tls line comes from the shared
# gate fm_domain_tls_directive_for_host (prebuilt acme.sh certificate, else
# DNS-01 dnspod stanza, else none); step 98 issues no certificate itself.
headscale_server_route_render() {
    local host="$1"
    local https_port="$2"
    local http_port="$3"
    local upstream="http://127.0.0.1:$(sc_get ports.headscale)"
    local tls_directive=""

    # hs.<region>.<root> sits under the root domain's *.<region>.<root>
    # wildcard: resolve the certificate through the same-root API host.
    tls_directive="$(fm_domain_tls_directive_for_host "api.$(mesh_region_prefix).$(mesh_root_domain)")"
    if [ -n "$tls_directive" ]; then
        tls_directive="${tls_directive}
"
    fi
    cat <<EOF
# ${HEADSCALE_ROUTE_MARKER} host=${host}

${host}:${https_port} {
${tls_directive}	reverse_proxy ${upstream}
}

http://${host}:${http_port} {
	redir https://{host}{uri} permanent
}
EOF
}

headscale_server_route_ensure() {
    local host=""
    local route_file=""
    local rendered=""

    host="$(mesh_headscale_server_host)"
    [ -n "$host" ] || return 0
    if ! declare -F fm_domain_ensure_routes_dir >/dev/null 2>&1; then
        # shellcheck source=/dev/null
        source "$HEADSCALE_COMMON_DIR/frankenphp_domain_common.sh"
    fi
    fm_domain_ensure_routes_dir
    if [ "$FM_DOMAIN_ROUTES_READY" != "yes" ]; then
        echo "[headscale] [WARN] routes directory unavailable; control server site deferred"
        return 0
    fi
    route_file="${FM_DOMAIN_ROUTES_DIR}/${host}.caddy"
    rendered="$(headscale_server_route_render "$host" "$FM_DOMAIN_HTTPS_PORT" "$FM_DOMAIN_HTTP_PORT")"
    write_file_if_changed "$route_file" >/dev/null < <(printf '%s\n' "$rendered")
    HEADSCALE_ROUTE_CHANGED="$WRITE_FILE_CHANGED"
    echo "[headscale] [OK] Route file: $route_file (https://${host} -> 127.0.0.1:$(sc_get ports.headscale))"
}
