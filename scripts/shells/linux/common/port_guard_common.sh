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

# Shared port-guard library - the single source of truth for keeping the nginx
# edge ports (80/TCP, 443/TCP, 443/UDP for QUIC) free of foreign occupiers.
# Replaces the former ad-hoc port freeing in nginx_manager.sh (nm_port_clear)
# and the docker-publisher handling in 132_laravel_main_start.sh.
#
# Fine-grained idempotent design - every sub-step self-detects and no-ops when
# the state is already correct; one step's outcome never blocks a later
# independent step:
#   1. detect    - ss socket scan (tcp + udp); nginx's own sockets are NEVER
#                  classified as occupiers (binary-identity detection)
#   2. identify  - /proc exe/cmdline, owning systemd unit, owning apt/snap
#                  package (dpkg queries the binary file on disk directly),
#                  publishing docker container
#   3. stop      - systemd stop+disable / docker stop+restart=no / TERM->KILL,
#                  verified by re-detection, never by exit-code inference
#   4. uninstall - interactive y/N (default No) removal of the occupier:
#                  apt purge / snap remove / docker rm / manual unit+binary
#   5. verify    - fresh ss re-scan publishes PG_PORTS_FREE=yes|no
# Results are published in PG_* state variables and [OK]/[FAIL] lines; nothing
# here communicates through exit-code contracts.
#
# Load-time side effect free: safe to source from dd.sh installers
# (gvar_common.sh loaded) and from plain app start scripts.

PORT_GUARD_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Canonical lazy sudo (shared with nginx_common.sh / domain_setup_common.sh).
# shellcheck source=/dev/null
source "$PORT_GUARD_COMMON_DIR/file_ops_common.sh"

PG_DEFAULT_PORTS="80 443"
PG_PORTS_FREE="yes"
PG_HOLDERS=""
PG_HOLDER_PID=""
PG_HOLDER_COMM=""
PG_HOLDER_EXE=""
PG_HOLDER_CMDLINE=""
PG_HOLDER_UNIT=""
PG_HOLDER_PACKAGE=""
PG_HOLDER_CONTAINER_ID=""
PG_HOLDER_CONTAINER_NAME=""

# y/N prompt that DEFAULTS TO NO on the controlling TTY; non-interactive
# shells answer No automatically (policy: never uninstall unattended).
# Override with PORT_GUARD_AUTO_UNINSTALL=yes (pre-confirm) or =no (force No).
# The prompt reads/writes /dev/tty DIRECTLY and never inspects stdin: callers
# iterate holders inside a herestring loop where stdin is not the terminal,
# so a -t 0 guard would silently suppress the question.
pg_ask_default_no() {
    local msg="$1"
    local reply=""
    case "${PORT_GUARD_AUTO_UNINSTALL:-}" in [Yy]*) return 0 ;; [Nn]*) return 1 ;; esac
    if [ -r /dev/tty ] && [ -w /dev/tty ]; then
        printf '%s [y/N] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# Detect foreign listeners on the given ports (tcp AND udp) via ss. nginx's
# own sockets are skipped by process identity - they are the legitimate
# owners. Publishes PG_HOLDERS as newline-separated "proto port pid comm".
# Usage: pg_holders_detect [port ...]   (default: 80 443)
pg_holders_detect() {
    local ports="${*:-$PG_DEFAULT_PORTS}"
    local sudo_cmd
    local port=""
    local proto=""
    local opt=""
    local line=""
    local pid=""
    local comm=""
    sudo_cmd=$(lazy_sudo)

    PG_HOLDERS=""
    command -v ss >/dev/null 2>&1 || return 0

    for port in $ports; do
        for proto in tcp udp; do
            opt="-lntHp"
            [ "$proto" = "udp" ] && opt="-lnuHp"
            while IFS= read -r line; do
                pid=$(printf '%s' "$line" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
                comm=$(printf '%s' "$line" | grep -oE '"[^"]+"' | head -1 | tr -d '"')
                [ -z "$pid" ] && continue
                # nginx is the legitimate owner of the edge ports.
                [ "$comm" = "nginx" ] && continue
                case "$PG_HOLDERS" in *" $pid "*) continue ;; esac
                PG_HOLDERS="${PG_HOLDERS}${proto} ${port} ${pid} ${comm:-unknown}
"
            done < <($sudo_cmd ss "$opt" 2>/dev/null | grep -E "[:.]${port}[[:space:]]")
        done
    done
    return 0
}

# Echo "id name" of the docker container PUBLISHING <port> (empty when none).
# Detection helper shared with app start scripts (e.g. 132 port-9000 guard).
pg_docker_publisher_container() {
    local port="$1"
    local sudo_cmd
    local row=""
    sudo_cmd=$(lazy_sudo)

    command -v docker >/dev/null 2>&1 || return 0
    row=$(docker ps --filter "publish=${port}" --format '{{.ID}} {{.Names}}' 2>/dev/null | head -1)
    [ -n "$row" ] || row=$($sudo_cmd docker ps --filter "publish=${port}" --format '{{.ID}} {{.Names}}' 2>/dev/null | head -1)
    [ -n "$row" ] && printf '%s\n' "$row"
    return 0
}

# Stop a docker container and disable its restart policy (the "stop" half of
# the guard; container REMOVAL stays behind the interactive uninstall offer).
pg_docker_container_stop() {
    local cid="$1"
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    docker stop "$cid" >/dev/null 2>&1 || $sudo_cmd docker stop "$cid" >/dev/null 2>&1 || true
    docker update --restart=no "$cid" >/dev/null 2>&1 || $sudo_cmd docker update --restart=no "$cid" >/dev/null 2>&1 || true
    return 0
}

# Identify the holder referenced by PG_HOLDER_PID: exe (binary file on disk),
# cmdline, owning systemd unit, owning apt/snap package (dpkg/snap ownership
# of the binary file itself), and the publishing docker container for
# docker-proxy holders. Usage: pg_holder_identify <pid> [port]
pg_holder_identify() {
    local pid="$1"
    local port="${2:-}"
    local pkg=""
    local snap_name=""
    local row=""

    PG_HOLDER_PID="$pid"
    PG_HOLDER_COMM=$(ps -p "$pid" -o comm= 2>/dev/null | tr -d ' ')
    PG_HOLDER_EXE=$(readlink "/proc/$pid/exe" 2>/dev/null || true)
    PG_HOLDER_EXE="${PG_HOLDER_EXE% (deleted)}"
    PG_HOLDER_CMDLINE=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | sed 's/[[:space:]]*$//')
    PG_HOLDER_UNIT=""
    PG_HOLDER_PACKAGE=""
    PG_HOLDER_CONTAINER_ID=""
    PG_HOLDER_CONTAINER_NAME=""

    PG_HOLDER_UNIT=$(grep -oE '[a-zA-Z0-9_.@-]+\.service' "/proc/$pid/cgroup" 2>/dev/null | head -1)

    # Package ownership: dpkg queries the binary FILE on disk directly.
    if [ -n "$PG_HOLDER_EXE" ] && [ -e "$PG_HOLDER_EXE" ] && command -v dpkg-query >/dev/null 2>&1; then
        pkg=$(dpkg-query -S "$PG_HOLDER_EXE" 2>/dev/null | head -1 | cut -d: -f1)
        [ -n "$pkg" ] && PG_HOLDER_PACKAGE="apt:$pkg"
    fi
    if [ -z "$PG_HOLDER_PACKAGE" ] && [[ "$PG_HOLDER_EXE" == /snap/* ]]; then
        snap_name=$(printf '%s' "$PG_HOLDER_EXE" | cut -d/ -f3)
        [ -n "$snap_name" ] && PG_HOLDER_PACKAGE="snap:$snap_name"
    fi

    # A docker-proxy holder surfaces a PUBLISHED container; identify it by the
    # published port so the container (not the proxy) is stopped.
    if [[ "$PG_HOLDER_COMM" == *docker-proxy* ]] && [ -n "$port" ]; then
        row=$(pg_docker_publisher_container "$port")
        if [ -n "$row" ]; then
            PG_HOLDER_CONTAINER_ID=$(printf '%s' "$row" | awk '{print $1}')
            PG_HOLDER_CONTAINER_NAME=$(printf '%s' "$row" | awk '{print $2}')
        fi
    fi
    return 0
}

# Stop the identified holder (idempotent; the outcome is verified by the
# caller's re-detection, never inferred from an exit code).
pg_holder_stop() {
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    if [ -n "$PG_HOLDER_CONTAINER_ID" ]; then
        echo "[port-guard] Stopping docker container ${PG_HOLDER_CONTAINER_NAME:-$PG_HOLDER_CONTAINER_ID} (publishes the port)..."
        pg_docker_container_stop "$PG_HOLDER_CONTAINER_ID"
        return 0
    fi

    if [ -n "$PG_HOLDER_UNIT" ]; then
        echo "[port-guard] Stopping and disabling systemd unit: $PG_HOLDER_UNIT"
        $sudo_cmd systemctl stop "$PG_HOLDER_UNIT" 2>/dev/null || true
        $sudo_cmd systemctl disable "$PG_HOLDER_UNIT" 2>/dev/null || true
        sleep 1
    fi

    if [ -d "/proc/$PG_HOLDER_PID" ]; then
        echo "[port-guard] Terminating PID $PG_HOLDER_PID ($PG_HOLDER_COMM)..."
        $sudo_cmd kill "$PG_HOLDER_PID" 2>/dev/null || true
        sleep 2
        if [ -d "/proc/$PG_HOLDER_PID" ]; then
            $sudo_cmd kill -9 "$PG_HOLDER_PID" 2>/dev/null || true
            sleep 1
        fi
    fi
    return 0
}

# Offer the interactive y/N (default No) UNINSTALL of the identified holder.
# Channel-aware: apt purge / snap remove / docker rm / manual unit+binary.
pg_holder_uninstall_offer() {
    local sudo_cmd
    local pkg=""
    local name=""
    local unit_file=""
    sudo_cmd=$(lazy_sudo)

    case "$PG_HOLDER_PACKAGE" in
        apt:*)
            pkg="${PG_HOLDER_PACKAGE#apt:}"
            if pg_ask_default_no "[port-guard] Uninstall package '$pkg' (apt purge) so it cannot re-take the port?"; then
                $sudo_cmd apt-get remove --purge -y "$pkg" 2>/dev/null || true
                $sudo_cmd apt-get autoremove --purge -y 2>/dev/null || true
                echo "[port-guard] [OK] Package purged: $pkg"
            else
                echo "[port-guard] [SKIP] Package kept: $pkg (stopped and disabled only)"
            fi
            return 0
            ;;
        snap:*)
            name="${PG_HOLDER_PACKAGE#snap:}"
            if pg_ask_default_no "[port-guard] Uninstall snap '$name' so it cannot re-take the port?"; then
                $sudo_cmd snap remove --purge "$name" 2>/dev/null || true
                echo "[port-guard] [OK] Snap removed: $name"
            else
                echo "[port-guard] [SKIP] Snap kept: $name (stopped and disabled only)"
            fi
            return 0
            ;;
    esac

    if [ -n "$PG_HOLDER_CONTAINER_ID" ]; then
        if pg_ask_default_no "[port-guard] Remove docker container ${PG_HOLDER_CONTAINER_NAME:-$PG_HOLDER_CONTAINER_ID} (docker rm) so it cannot re-take the port?"; then
            docker rm "$PG_HOLDER_CONTAINER_ID" >/dev/null 2>&1 || $sudo_cmd docker rm "$PG_HOLDER_CONTAINER_ID" >/dev/null 2>&1 || true
            echo "[port-guard] [OK] Container removed: ${PG_HOLDER_CONTAINER_NAME:-$PG_HOLDER_CONTAINER_ID}"
        else
            echo "[port-guard] [SKIP] Container kept: ${PG_HOLDER_CONTAINER_NAME:-$PG_HOLDER_CONTAINER_ID} (stopped, restart policy disabled)"
        fi
        return 0
    fi

    # Manually installed program (no package, no container): remove the systemd
    # unit file and the binary so a reboot cannot resurrect the conflict.
    if [ -n "$PG_HOLDER_UNIT" ] || [ -n "$PG_HOLDER_EXE" ]; then
        if pg_ask_default_no "[port-guard] Uninstall '$PG_HOLDER_COMM' (remove ${PG_HOLDER_UNIT:+unit $PG_HOLDER_UNIT }${PG_HOLDER_EXE:+binary $PG_HOLDER_EXE})?"; then
            if [ -n "$PG_HOLDER_UNIT" ]; then
                for unit_file in "/etc/systemd/system/$PG_HOLDER_UNIT" "/usr/lib/systemd/system/$PG_HOLDER_UNIT" "/lib/systemd/system/$PG_HOLDER_UNIT"; do
                    if [ -f "$unit_file" ]; then
                        $sudo_cmd rm -f "$unit_file"
                        echo "[port-guard] Removed unit file: $unit_file"
                    fi
                done
                $sudo_cmd systemctl daemon-reload 2>/dev/null || true
            fi
            if [ -n "$PG_HOLDER_EXE" ] && [ -f "$PG_HOLDER_EXE" ] && [ -z "$PG_HOLDER_PACKAGE" ]; then
                $sudo_cmd rm -f "$PG_HOLDER_EXE"
                echo "[port-guard] Removed binary: $PG_HOLDER_EXE"
            fi
            echo "[port-guard] [OK] Manual program uninstalled: $PG_HOLDER_COMM"
        else
            echo "[port-guard] [SKIP] Program kept: $PG_HOLDER_COMM (stopped and disabled only)"
        fi
    fi
    return 0
}

# Compose the full guard over the given ports (default 80 443, tcp + udp):
# detect -> identify -> stop -> y/N uninstall -> re-detect. Publishes
# PG_PORTS_FREE=yes|no from a FRESH ss scan at the end.
# Usage: pg_ports_ensure_free [port ...]
pg_ports_ensure_free() {
    local ports="${*:-$PG_DEFAULT_PORTS}"
    local holder=""
    local proto=""
    local port=""
    local pid=""
    local comm=""
    local stopped_pids=" "

    pg_holders_detect $ports
    if [ -z "$PG_HOLDERS" ]; then
        PG_PORTS_FREE="yes"
        echo "[port-guard] [OK] Ports $(echo $ports | tr ' ' ',') free of foreign occupiers (tcp+udp)"
        return 0
    fi

    echo "[port-guard] Foreign occupiers on nginx edge ports:"
    while IFS= read -r holder; do
        [ -z "$holder" ] && continue
        proto=$(printf '%s' "$holder" | awk '{print $1}')
        port=$(printf '%s' "$holder" | awk '{print $2}')
        pid=$(printf '%s' "$holder" | awk '{print $3}')
        comm=$(printf '%s' "$holder" | awk '{print $4}')

        pg_holder_identify "$pid" "$port"
        echo "[port-guard]   $proto/$port held by PID $pid ($PG_HOLDER_COMM): $PG_HOLDER_CMDLINE"
        [ -n "$PG_HOLDER_EXE" ] && echo "[port-guard]     binary: $PG_HOLDER_EXE"
        [ -n "$PG_HOLDER_UNIT" ] && echo "[port-guard]     unit: $PG_HOLDER_UNIT"
        [ -n "$PG_HOLDER_PACKAGE" ] && echo "[port-guard]     package: $PG_HOLDER_PACKAGE"
        [ -n "$PG_HOLDER_CONTAINER_ID" ] && echo "[port-guard]     container: ${PG_HOLDER_CONTAINER_NAME:-$PG_HOLDER_CONTAINER_ID}"

        if [ "${IS_WSL:-false}" = "true" ] || grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
            echo "[port-guard]     WSL note: if the holder is Windows IIS/HTTP.sys, disable it in an elevated Windows PowerShell:"
            echo "[port-guard]       Stop-Service -Name W3SVC -Force; Set-Service -Name W3SVC -StartupType Disabled"
        fi

        # One stop + one uninstall offer per process, even when it holds
        # several of the guarded sockets (e.g. 443 tcp AND udp).
        case "$stopped_pids" in
            *" $pid "*) continue ;;
        esac
        stopped_pids="${stopped_pids}${pid} "

        pg_holder_stop
        pg_holder_uninstall_offer
    done <<< "$PG_HOLDERS"

    # Verify by a FRESH socket scan (state detection, not exit-code inference).
    pg_holders_detect $ports
    if [ -z "$PG_HOLDERS" ]; then
        PG_PORTS_FREE="yes"
        echo "[port-guard] [OK] Ports $(echo $ports | tr ' ' ',') now free of foreign occupiers"
    else
        PG_PORTS_FREE="no"
        echo "[port-guard] [FAIL] Ports still occupied after the guard pass:"
        printf '%s' "$PG_HOLDERS" | while IFS= read -r holder; do
            [ -n "$holder" ] && echo "[port-guard]   $holder"
        done
    fi
    return 0
}
