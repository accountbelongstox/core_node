#!/bin/bash
# AI SPECIAL ATTENTION RULES START
# 1. All information output by scripts must be in English only.
# 2. Do not modify AI SPECIAL ATTENTION RULES.
# 3. Variables must be declared at the top of the script file.
# AI SPECIAL ATTENTION RULES END
#
# 79_install_docker.sh - Docker Engine / CLI / Buildx / Compose ensure.
# Route: the official Docker APT stable repository (deb822 .sources + signed-by
# keyring), per https://docs.docker.com/engine/install/debian/ and
# https://docs.docker.com/engine/install/ubuntu/ . Snap is never used.
#
# Idempotency is implemented PER MINIMAL OPERATION (plan step 16), not as a
# single top-level gate:
#   prereq packages -> keyring dir -> keyring file -> apt source -> apt update
#   -> each docker package -> daemon enable -> daemon start -> readiness probe
#   -> compose-plugin probe
# Each stage converges its own resource and no-ops when already satisfied, so
# re-runs are cheap and a mid-run failure only repeats the unfinished stages.
#
# START_DOCKER=false  -> report a plain skip and do nothing; a user's existing
#                        Docker is NEVER stopped/disabled/killed by this script.
# START_DOCKER=true   -> converge every component below.
# Conflicting user-owned apt sources are reported (owner kept), never deleted.
# An equivalent legacy docker.list is reused instead of duplicated.
#
# Actions:
#   (default) / --ensure   converge missing components only
#   --update               explicit user-requested upgrade of installed components
#
# Merged from 81_set_docker_daemon.sh: after the daemon is up, the DNS/registry
# mirror configuration (update_docker_dns_mirror.js) is applied and Docker is
# restarted only when the config actually changed (validated first, so a bad
# daemon.json can never take dockerd down).

SCRIPT_INDEX="79"
export DEBIAN_FRONTEND=noninteractive
export APT_LISTCHANGES_FRONTEND=none
export DPKG_USE_PAGER=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/../../common/common_functions.sh"
. "$SCRIPT_DIR/../../common/gvar_common.sh"

ACTION="ensure"
START_DOCKER="$(get_var "START_DOCKER" "false")"

# --- Resolved at runtime (declared at top per AI rules) ---
OS_ID=""
OS_ID_LIKE=""
OS_CODENAME=""
REPO_ID=""
REPO_BASELINE_NOTE=""
ARCH=""
KEYRING_DIR="/etc/apt/keyrings"
KEYRING_FILE="$KEYRING_DIR/docker.asc"
SOURCES_FILE="/etc/apt/sources.list.d/docker.sources"
LEGACY_LIST="/etc/apt/sources.list.d/docker.list"
SOURCE_CHANGED=0
APT_UPDATED=0
PKG_MISSING=()
PKG_INSTALLED=()
PKG_UPGRADED=()
DOCKER_PROVIDER_NOTE=""
DAEMON_READY="false"
SELECTED_REGION=""
CLOUD_PROVIDER=""
NODE_CMD=""
SHELLS_SCRIPTS_DIR="$(cd "$SCRIPT_DIR/../../../scripts" 2>/dev/null && pwd || echo "")"

DOCKER_PACKAGES=(docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin)
PREREQ_PACKAGES=(ca-certificates curl)

while [[ $# -gt 0 ]]; do
    case "$1" in
        --update) ACTION="update"; shift ;;
        --ensure) ACTION="ensure"; shift ;;
        *) shift ;;
    esac
done

print_banner() {
    echo ""
    echo "============================================================"
    echo " [$SCRIPT_INDEX] Docker Engine / CLI / Buildx / Compose ensure"
    echo "============================================================"
}

resolve_os_repo() {
    # Map /etc/os-release to the official Docker repo identity. Unknown
    # distributions/codenames are reported and refused - never silently mapped
    # to an older suite.
    local id="" id_like="" codename="" ubuntu_codename=""
    if [[ -r /etc/os-release ]]; then
        id="$(. /etc/os-release && echo "${ID:-}")"
        id_like="$(. /etc/os-release && echo "${ID_LIKE:-}")"
        codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
        ubuntu_codename="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-}")"
    fi
    OS_ID="$id"; OS_ID_LIKE="$id_like"
    case "$id" in
        debian)
            REPO_ID="debian"; OS_CODENAME="$codename" ;;
        ubuntu)
            REPO_ID="ubuntu"; OS_CODENAME="${ubuntu_codename:-$codename}" ;;
        kali)
            # Kali is a Debian-testing derivative with no own Docker repo; the
            # community-supported baseline is the current stable Debian suite.
            REPO_ID="debian"; OS_CODENAME="trixie"
            REPO_BASELINE_NOTE="Kali has no dedicated Docker repo; using the Debian 'trixie' baseline (community support level)."
            ;;
        *)
            echo "[$SCRIPT_INDEX][!] Unsupported distro '$id' (ID_LIKE='$id_like')."
            echo "[$SCRIPT_INDEX][!] Official Docker repos exist only for debian/ubuntu:"
            echo "[$SCRIPT_INDEX][!]   https://download.docker.com/linux/<debian|ubuntu>/dists/"
            return 1
            ;;
    esac
    case "$REPO_ID:$OS_CODENAME" in
        debian:trixie|debian:bookworm) ;;
        ubuntu:resolute|ubuntu:questing|ubuntu:plucky|ubuntu:noble|ubuntu:jammy) ;;
        *)
            echo "[$SCRIPT_INDEX][!] No official Docker repo suite '$OS_CODENAME' for $REPO_ID."
            echo "[$SCRIPT_INDEX][!] Verified suites (2026-09): debian trixie bookworm; ubuntu resolute questing plucky noble jammy."
            echo "[$SCRIPT_INDEX][!] Check https://download.docker.com/linux/$REPO_ID/dists/ - this script will not guess a fallback."
            return 1
            ;;
    esac
    ARCH="$(dpkg --print-architecture 2>/dev/null || echo "")"
    case "$ARCH" in
        amd64|arm64|armhf|ppc64le|s390x) ;;
        *)
            echo "[$SCRIPT_INDEX][!] Unsupported architecture '$ARCH' for the official Docker APT repo."
            return 1
            ;;
    esac
    return 0
}

ensure_prereq_packages() {
    local pkg missing=()
    for pkg in "${PREREQ_PACKAGES[@]}"; do
        dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        echo "[$SCRIPT_INDEX] Prereq packages present: ${PREREQ_PACKAGES[*]} (nothing to do)"
        return 0
    fi
    echo "[$SCRIPT_INDEX] Installing prereq packages: ${missing[*]}"
    apt-get update -qq
    apt-get install -y --no-install-recommends "${missing[@]}"
}

ensure_keyring() {
    local tmp=""
    install -m 0755 -d "$KEYRING_DIR"
    if [[ -s "$KEYRING_FILE" ]] && gpg --show-keys "$KEYRING_FILE" >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Keyring present and parseable: $KEYRING_FILE (nothing to do)"
        return 0
    fi
    [[ -e "$KEYRING_FILE" ]] && echo "[$SCRIPT_INDEX] Keyring corrupt/unparseable; repairing: $KEYRING_FILE"
    echo "[$SCRIPT_INDEX] Downloading Docker GPG key -> $KEYRING_FILE"
    tmp="$(mktemp)"
    curl -fsSL "https://download.docker.com/linux/$REPO_ID/gpg" -o "$tmp"
    if ! gpg --show-keys "$tmp" >/dev/null 2>&1; then
        rm -f "$tmp"
        echo "[$SCRIPT_INDEX][!] Downloaded key failed gpg validation; not installed."
        return 1
    fi
    mv -f "$tmp" "$KEYRING_FILE"
    chmod a+r "$KEYRING_FILE"
    SOURCE_CHANGED=1
}

expected_sources_content() {
    cat <<EOF
Types: deb
URIs: https://download.docker.com/linux/$REPO_ID
Suites: $OS_CODENAME
Components: stable
Architectures: $ARCH
Signed-By: $KEYRING_FILE
EOF
}

ensure_apt_source() {
    # Legacy docker.list handling: an equivalent user-owned source is reused;
    # a conflicting one is reported with its owner kept (never auto-deleted).
    if [[ -f "$LEGACY_LIST" ]]; then
        if grep -q "download.docker.com/linux/$REPO_ID" "$LEGACY_LIST" && grep -q "$OS_CODENAME" "$LEGACY_LIST"; then
            echo "[$SCRIPT_INDEX] Legacy $LEGACY_LIST already provides the identical repo; reusing it (no duplicate source written)."
            return 0
        fi
        echo "[$SCRIPT_INDEX][!] $LEGACY_LIST exists but points elsewhere (user-owned; kept as-is):"
        sed 's/^/    | /' "$LEGACY_LIST" 2>/dev/null || true
        echo "[$SCRIPT_INDEX][!] Writing the official deb822 source alongside; resolve the duplicate manually if apt warns."
    fi
    local expected tmp
    expected="$(expected_sources_content)"
    if [[ -f "$SOURCES_FILE" ]] && [[ "$(cat "$SOURCES_FILE")" == "$expected" ]]; then
        echo "[$SCRIPT_INDEX] APT source already converged: $SOURCES_FILE (nothing to do)"
        return 0
    fi
    echo "[$SCRIPT_INDEX] Writing official deb822 source: $SOURCES_FILE (repo=$REPO_ID suite=$OS_CODENAME arch=$ARCH)"
    tmp="$(mktemp)"
    printf '%s\n' "$expected" > "$tmp"
    mv -f "$tmp" "$SOURCES_FILE"
    chmod a+r "$SOURCES_FILE"
    SOURCE_CHANGED=1
}

apt_update_if_changed() {
    if [[ $SOURCE_CHANGED -eq 0 && $APT_UPDATED -eq 0 ]]; then
        echo "[$SCRIPT_INDEX] Keyring/source unchanged; skipping apt update (idempotent)."
        return 0
    fi
    echo "[$SCRIPT_INDEX] Repo metadata changed; running apt update."
    apt-get update -qq
    APT_UPDATED=1
}

ensure_docker_packages() {
    local pkg
    PKG_MISSING=(); PKG_INSTALLED=()
    for pkg in "${DOCKER_PACKAGES[@]}"; do
        if dpkg -s "$pkg" >/dev/null 2>&1; then
            PKG_INSTALLED+=("$pkg")
        else
            PKG_MISSING+=("$pkg")
        fi
    done

    # A docker binary provided by a non-docker-ce package (e.g. distro docker.io)
    # is the user's choice: report it and do not fight the package manager.
    if [[ ${#PKG_MISSING[@]} -gt 0 ]] && command -v docker >/dev/null 2>&1 && ! dpkg -s docker-ce >/dev/null 2>&1; then
        DOCKER_PROVIDER_NOTE="$(dpkg -S "$(command -v docker)" 2>/dev/null | cut -d: -f1 || echo unknown)"
        echo "[$SCRIPT_INDEX][i] docker binary already provided by package '$DOCKER_PROVIDER_NOTE' (not docker-ce); keeping the user package and skipping docker-ce installation."
    fi

    if [[ ${#PKG_MISSING[@]} -gt 0 && -z "$DOCKER_PROVIDER_NOTE" ]]; then
        echo "[$SCRIPT_INDEX] Installing missing docker components: ${PKG_MISSING[*]}"
        apt-get install -y "${PKG_MISSING[@]}" || {
            echo "[$SCRIPT_INDEX][!] apt failed to install: ${PKG_MISSING[*]}"
            return 1
        }
        APT_UPDATED=1
    else
        echo "[$SCRIPT_INDEX] Docker components already installed: ${PKG_INSTALLED[*]:-none via docker-ce}"
    fi

    if [[ "$ACTION" == "update" && ${#PKG_INSTALLED[@]} -gt 0 ]]; then
        # Explicit user action only: --ensure never upgrades existing packages.
        echo "[$SCRIPT_INDEX] --update requested; upgrading installed components: ${PKG_INSTALLED[*]}"
        apt-get update -qq
        apt-get install -y --only-upgrade "${PKG_INSTALLED[@]}"
        PKG_UPGRADED=("${PKG_INSTALLED[@]}")
    fi

    echo "[$SCRIPT_INDEX] Component versions:"
    for pkg in "${DOCKER_PACKAGES[@]}"; do
        dpkg-query -W -f='    ${Package} ${Version}\n' "$pkg" 2>/dev/null || true
    done
    return 0
}

ensure_daemon_running() {
    if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
        systemctl is-enabled docker >/dev/null 2>&1 || { echo "[$SCRIPT_INDEX] Enabling docker service."; systemctl enable docker; }
        systemctl is-active  docker >/dev/null 2>&1 || { echo "[$SCRIPT_INDEX] Starting docker service."; systemctl start docker; }
        # containerd has its own unit; ensure it only when the unit exists.
        if systemctl list-unit-files containerd.service >/dev/null 2>&1; then
            systemctl is-active containerd >/dev/null 2>&1 || systemctl start containerd || true
        fi
    elif command -v service >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] systemd not running (WSL/container?); trying 'service docker start'."
        service docker start || true
    fi
    if timeout 15 docker info >/dev/null 2>&1; then
        DAEMON_READY="true"
        echo "[$SCRIPT_INDEX] Docker daemon is responding (docker info OK)."
    else
        DAEMON_READY="false"
        echo "[$SCRIPT_INDEX][!] Docker daemon is not responding."
        echo "[$SCRIPT_INDEX][!] On WSL, enable systemd (/etc/wsl.conf: [boot] systemd=true) or start dockerd manually, then re-run."
        return 1
    fi
    return 0
}

verify_compose_plugin() {
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        set_var "DOCKER_COMPOSE_AVAILABLE" "true"
        echo "[$SCRIPT_INDEX] Compose plugin available: $(docker compose version --short 2>/dev/null || echo unknown)"
        return 0
    fi
    set_var "DOCKER_COMPOSE_AVAILABLE" "false"
    echo "[$SCRIPT_INDEX][!] Compose plugin missing; expected package docker-compose-plugin (provides 'docker compose')."
    return 1
}

# DNS / registry mirror configuration (merged from 81_set_docker_daemon.sh).
# Idempotent: the node helper rewrites /etc/docker/daemon.json only when the
# desired mirror set differs and exits 2 on change, 0 on no-op. Docker is
# restarted only on a validated change.
configure_docker_dns_mirror() {
    # Source /etc/environment for CLOUD_PROVIDER
    if [ -f /etc/environment ]; then
        set -a
        . /etc/environment
        set +a
    fi
    SELECTED_REGION="$(get_var "SELECTED_REGION")"
    CLOUD_PROVIDER="${CLOUD_PROVIDER:-$(get_var "CLOUD_PROVIDER")}"

    if ! systemctl is-active --quiet docker.service 2>/dev/null && ! systemctl is-enabled --quiet docker.service 2>/dev/null; then
        echo "[$SCRIPT_INDEX] Docker service is not available. Skipping Docker daemon DNS mirror configuration."
        return 0
    fi

    echo "[$SCRIPT_INDEX] Calling update_docker_dns_mirror.js with CLOUD_PROVIDER='$CLOUD_PROVIDER' SELECTED_REGION='$SELECTED_REGION'..."
    # Absolute path first: install-time shells may run with a minimal PATH.
    NODE_CMD="$(resolve_tool_bin node 2>/dev/null || true)"
    if [ -z "$NODE_CMD" ]; then
        echo "[$SCRIPT_INDEX] node not found. Run 17_install_node_toolchain_26.sh first. Skipping Docker DNS mirror update."
        return 0
    fi
    "$NODE_CMD" "$SHELLS_SCRIPTS_DIR/update_docker_dns_mirror.js" "$CLOUD_PROVIDER" "$SELECTED_REGION"
    local result=$?

    if [ $result -eq 2 ]; then
        echo -e "\033[33m[$SCRIPT_INDEX] Docker configuration updated. Docker needs to be restarted.\033[0m"
        # Validate BEFORE restarting: an invalid daemon.json (e.g. an unknown key
        # like the legacy uppercase "DNS") makes dockerd fail to start at all.
        if command -v dockerd >/dev/null 2>&1 && ! timeout 30 dockerd --validate >/dev/null 2>&1; then
            echo -e "\033[31m[$SCRIPT_INDEX] dockerd --validate rejected /etc/docker/daemon.json; NOT restarting. Fix the config and re-run.\033[0m"
            timeout 30 dockerd --validate 2>&1 || true
            return 1
        fi
        # reset-failed first: repeated failures put the unit in "start request
        # repeated too quickly", which makes a plain restart fail immediately.
        systemctl reset-failed docker.service 2>/dev/null || true
        if systemctl restart docker && systemctl is-active --quiet docker.service; then
            echo -e "\033[32m[$SCRIPT_INDEX] Docker restarted and active.\033[0m"
        else
            echo -e "\033[31m[$SCRIPT_INDEX] Docker restart failed or service is not active. See: journalctl -xeu docker.service\033[0m"
            return 1
        fi
    elif [ $result -eq 0 ]; then
        echo -e "\033[32m[$SCRIPT_INDEX] No Docker configuration changes needed.\033[0m"
    else
        echo -e "\033[31m[$SCRIPT_INDEX] An error occurred while updating Docker configuration.\033[0m"
    fi
    return 0
}

print_banner
echo "[$SCRIPT_INDEX] START_DOCKER=$START_DOCKER (toggle: [^] Start Docker After Installation)"
echo "[$SCRIPT_INDEX] action=$ACTION"

if [[ "$START_DOCKER" != "true" ]]; then
    echo "[$SCRIPT_INDEX] Docker disabled via START_DOCKER -> skip. An existing Docker installation is left untouched (never stopped/disabled by this script)."
    if command -v docker >/dev/null 2>&1; then
        set_var "DOCKER_AVAILABLE" "true"
    else
        set_var "DOCKER_AVAILABLE" "false"
    fi
    set_var "DOCKER_ENABLED" "false"
    exit 0
fi

if [[ $EUID -ne 0 ]]; then
    echo "[$SCRIPT_INDEX][!] Root privileges required to ensure docker components."
    exit 1
fi

resolve_os_repo || exit 1
[[ -n "$REPO_BASELINE_NOTE" ]] && echo "[$SCRIPT_INDEX][i] $REPO_BASELINE_NOTE"
echo "[$SCRIPT_INDEX] repo=$REPO_ID suite=$OS_CODENAME arch=$ARCH"

ensure_prereq_packages || exit 1
ensure_keyring         || exit 1
ensure_apt_source      || exit 1
apt_update_if_changed  || exit 1
ensure_docker_packages || exit 1
ensure_daemon_running  || exit 1
configure_docker_dns_mirror || exit 1

# State is per-component and additive; never written before its phase passed.
if command -v docker >/dev/null 2>&1; then
    set_var "DOCKER_AVAILABLE" "true"
else
    set_var "DOCKER_AVAILABLE" "false"
fi
if [[ "$DAEMON_READY" == "true" ]]; then
    set_var "DOCKER_ENABLED" "true"
else
    set_var "DOCKER_ENABLED" "false"
fi
verify_compose_plugin || true

echo ""
echo "[$SCRIPT_INDEX] Docker ensure complete."
echo "  - repo        : https://download.docker.com/linux/$REPO_ID (suite $OS_CODENAME)"
[[ -n "$DOCKER_PROVIDER_NOTE" ]] && echo "  - provider    : user package '$DOCKER_PROVIDER_NOTE' (kept)"
echo "  - daemon ready: $DAEMON_READY"
echo "  - compose     : $(get_var "DOCKER_COMPOSE_AVAILABLE" "false")"
echo "  - update mode : $ACTION"
exit 0
