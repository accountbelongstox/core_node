#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. For Bash scripts: Use absolute paths resolved from script location
# 7. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# Enable UFW (Uncomplicated Firewall) and block known abusive sources by IP.
# Blacklist model: no "allow only these IPs"; SSH stays open to the world except listed deny rules.
#
# Official references (Ubuntu / netfilter frontend):
#   https://help.ubuntu.com/community/UFW
#   https://manpages.ubuntu.com/manpages/noble/en/man8/ufw.8.html
# Deny syntax: "ufw deny from <address>" - see DESCRIPTION and EXAMPLES in man ufw(8).
# Rule order: first matching rule wins - insert deny rules before generic "allow OpenSSH".

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "$0")"

DRY_RUN="0"
LIST_ONLY="0"
DENIES_ONLY="0"
BLACKLIST_FILE=""
SSH_PORT_SPEC=""

# Default deny list built from recent sshd abuse (IPv4). Extend via file or edit array.
DEFAULT_BLACKLIST_IPS=(
    "2.57.122.192"
    "2.57.121.118"
    "2.57.122.196"
    "2.57.122.194"
    "80.66.66.70"
    "91.202.233.33"
    "185.226.197.12"
    "194.187.178.222"
    "195.178.110.15"
    "45.227.254.170"
    "45.33.12.214"
    "206.189.157.111"
)

# Never add these to blacklist (comma-separated CIDR or exact IPs). Your admin client.
PROTECTED_IPS="8.3.127.172"

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [options]

  Blacklist-only UFW setup: default deny incoming, allow SSH for everyone except denied IPs.

Options:
  --dry-run       Print ufw commands only; do not execute.
  --list-only     Print merged IPv4 deny list and exit.
  --denies-only   Only insert deny rules; UFW must already be active (keeps your allows).
  --file PATH     Extra IPv4 addresses/CIDRs, one per line (# comments ok).
  --ssh-port N    Use 'allow N/tcp' instead of application profile OpenSSH.

Environment:
  UFW_SSH_BLACKLIST_FILE   Same as --file if set and --file not given.
  UFW_SSH_PROTECTED_IPS    Comma-separated IPs never blacklisted (default: 8.3.127.172).

Requires root (or sudo) for ufw/apt.

Docs: https://help.ubuntu.com/community/UFW
      https://manpages.ubuntu.com/manpages/noble/en/man8/ufw.8.html
EOF
}

log_info() { echo "[INFO] $*"; }
log_warn() { echo "[WARN] $*" >&2; }
log_err() { echo "[ERR ] $*" >&2; }

is_ipv4() {
    local s="$1"
    [[ "$s" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?$ ]]
}

ip_in_protected() {
    local ip="$1"
    local p base
    base="${ip%%/*}"
    IFS=',' read -ra _prot <<<"$PROTECTED_IPS"
    for p in "${_prot[@]}"; do
        p="${p// /}"
        [[ -z "$p" ]] && continue
        p="${p%%/*}"
        if [[ "$base" == "$p" ]]; then
            return 0
        fi
    done
    return 1
}

merge_blacklist() {
    local -a out=()
    local line ip
    for ip in "${DEFAULT_BLACKLIST_IPS[@]}"; do
        out+=("$ip")
    done
    if [[ -n "$BLACKLIST_FILE" && -f "$BLACKLIST_FILE" ]]; then
        while IFS= read -r line || [[ -n "$line" ]]; do
            line="${line%%#*}"
            line="${line//[$'\t\r\n']/}"
            [[ -z "$line" ]] && continue
            if is_ipv4 "$line"; then
                out+=("$line")
            else
                log_warn "Skipping invalid line in blacklist file: $line"
            fi
        done <"$BLACKLIST_FILE"
    fi
    printf '%s\n' "${out[@]}" | awk '!seen[$0]++'
}

ufw_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        echo "+ ufw $*"
        return 0
    fi
    ufw "$@"
}

ensure_root() {
    if [[ "$(id -u)" -ne 0 ]]; then
        log_err "Run as root: sudo $0 ..."
        exit 1
    fi
}

ensure_ufw_installed() {
    if command -v ufw >/dev/null 2>&1; then
        return 0
    fi
    log_info "Installing ufw (apt)..."
    if [[ "$DRY_RUN" == "1" ]]; then
        echo "+ apt-get update && apt-get install -y ufw"
        return 0
    fi
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq && apt-get install -y ufw
}

ufw_has_rule() {
    local needle="$1"
    if [[ "$DRY_RUN" == "1" ]]; then
        return 1
    fi
    ufw status numbered 2>/dev/null | grep -Fq "$needle"
}

apply_base_policy() {
    # Blacklist-oriented service policy: block everything inbound except what we allow;
    # do NOT restrict SSH to a fixed allowlist of client IPs.
    ufw_cmd default deny incoming
    ufw_cmd default allow outgoing
    if [[ -n "$SSH_PORT_SPEC" ]]; then
        if ! ufw_has_rule "${SSH_PORT_SPEC}/tcp"; then
            ufw_cmd allow "${SSH_PORT_SPEC}/tcp" comment 'SSH'
        else
            log_info "SSH port allow rule already present (${SSH_PORT_SPEC}/tcp)."
        fi
    else
        if ! ufw_has_rule "OpenSSH" && ! ufw_has_rule "22/tcp"; then
            ufw_cmd allow OpenSSH
        else
            log_info "OpenSSH (or 22/tcp) allow rule already present; skipping duplicate."
        fi
    fi
}

insert_denies() {
    local ip
    while IFS= read -r ip; do
        [[ -z "$ip" ]] && continue
        if ip_in_protected "$ip"; then
            log_warn "Refusing to blacklist protected IP: $ip"
            continue
        fi
        if [[ "$DRY_RUN" == "1" ]]; then
            echo "+ ufw insert 1 deny from $ip comment ssh-abuse-blacklist"
            continue
        fi
        if ufw status 2>/dev/null | grep -F "$ip" | grep -q DENY; then
            log_info "Deny rule for $ip already present; skip."
            continue
        fi
        ufw insert 1 deny from "$ip" comment 'ssh-abuse-blacklist'
    done
}

main() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) DRY_RUN="1"; shift ;;
            --list-only) LIST_ONLY="1"; shift ;;
            --denies-only) DENIES_ONLY="1"; shift ;;
            --file)
                BLACKLIST_FILE="$2"
                shift 2
                ;;
            --ssh-port)
                SSH_PORT_SPEC="$2"
                shift 2
                ;;
            -h|--help) usage; exit 0 ;;
            *) log_err "Unknown option: $1"; usage; exit 2 ;;
        esac
    done

    if [[ -z "$BLACKLIST_FILE" && -n "${UFW_SSH_BLACKLIST_FILE:-}" ]]; then
        BLACKLIST_FILE="$UFW_SSH_BLACKLIST_FILE"
    fi
    if [[ -n "${UFW_SSH_PROTECTED_IPS:-}" ]]; then
        PROTECTED_IPS="$UFW_SSH_PROTECTED_IPS"
    fi

    local merged
    merged="$(merge_blacklist)"

    if [[ "$LIST_ONLY" == "1" ]]; then
        echo "$merged"
        exit 0
    fi

    ensure_root
    ensure_ufw_installed

    if [[ "$DRY_RUN" != "1" ]] && ! command -v ufw >/dev/null 2>&1; then
        log_err "ufw not available after install attempt."
        exit 1
    fi

    if [[ "$DENIES_ONLY" == "1" ]]; then
        if [[ "$DRY_RUN" != "1" ]] && ! ufw status 2>/dev/null | grep -qi '^Status: active'; then
            log_err "UFW is not active. Run once without --denies-only to set defaults, or enable UFW first."
            exit 1
        fi
        log_info "Denies-only: inserting deny-from rules (first match wins; see man ufw(8))."
        echo "$merged" | insert_denies
        if [[ "$DRY_RUN" == "1" ]]; then
            echo "+ ufw reload"
            exit 0
        fi
        ufw reload
        ufw status verbose
        exit 0
    fi

    log_info "Script path: $SCRIPT_CURRENT_DIR/$SCRIPT_NAME"
    log_info "Applying base UFW policy (blacklist model; not IP-whitelist). Inbound: only OpenSSH unless you add more allows."
    log_warn "If this host serves HTTP/HTTPS or other ports, add rules before closing SSH (e.g. ufw allow 80/tcp)."
    apply_base_policy

    log_info "Inserting deny-from rules at top (first match wins; see man ufw(8))."
    echo "$merged" | insert_denies

    if [[ "$DRY_RUN" == "1" ]]; then
        echo "+ ufw --force enable"
        log_info "Dry run complete."
        exit 0
    fi

    ufw --force enable
    log_info "UFW enabled. Status:"
    ufw status verbose

    log_warn "Confirm you still have SSH access before closing this session."
}

main "$@"
