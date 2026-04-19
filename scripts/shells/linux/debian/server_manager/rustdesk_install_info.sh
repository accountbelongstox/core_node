#!/bin/bash
# Display RustDesk Server OSS installation info (Key, ports, IPs).
# Reads from 128 script saved config and hbbs data dir.
# Usage: [sudo] ./rustdesk_install_info.sh
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# ### AI SPECIAL ATTENTION RULES END ###

USE_SUDO=""
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
fi

RUSTDESK_SERVER_CONFIG_FILE="/var/_core_node/rustdesk_server/server.conf"
RUSTDESK_SERVER_KEY_BACKUP="/var/_core_node/rustdesk_server/id_ed25519.pub"

echo ""
echo "=========================================="
echo "RustDesk Server Install Info"
echo "=========================================="
echo ""

if [[ -f "$RUSTDESK_SERVER_CONFIG_FILE" ]]; then
    DATA_DIR=""
    PUBLIC_KEY=""
    PUBLIC_IP=""
    LOCAL_IPS=""
    HBBS_PORT=""
    HBBS_NAT_PORT=""
    HBBS_WEB_PORT=""
    HBBR_PORT=""
    RELAY_PORT=""
    SERVER_VERSION=""
    while IFS= read -r line; do
        [[ "$line" =~ ^#.*$ ]] && continue
        case "$line" in
            DATA_DIR=*)     DATA_DIR="${line#DATA_DIR=}" ;;
            PUBLIC_KEY=*)  PUBLIC_KEY="${line#PUBLIC_KEY=}" ;;
            PUBLIC_IP=*)    PUBLIC_IP="${line#PUBLIC_IP=}" ;;
            LOCAL_IPS=*)    LOCAL_IPS="${line#LOCAL_IPS=}" ;;
            HBBS_PORT=*)   HBBS_PORT="${line#HBBS_PORT=}" ;;
            HBBS_NAT_PORT=*) HBBS_NAT_PORT="${line#HBBS_NAT_PORT=}" ;;
            HBBS_WEB_PORT=*) HBBS_WEB_PORT="${line#HBBS_WEB_PORT=}" ;;
            HBBR_PORT=*)   HBBR_PORT="${line#HBBR_PORT=}" ;;
            RELAY_PORT=*)  RELAY_PORT="${line#RELAY_PORT=}" ;;
            SERVER_VERSION=*) SERVER_VERSION="${line#SERVER_VERSION=}" ;;
        esac
    done < "$RUSTDESK_SERVER_CONFIG_FILE"

    if [[ -z "$PUBLIC_KEY" ]] && [[ -f "$RUSTDESK_SERVER_KEY_BACKUP" ]]; then
        PUBLIC_KEY=$($USE_SUDO cat "$RUSTDESK_SERVER_KEY_BACKUP" 2>/dev/null || true)
    fi
    if [[ -z "$PUBLIC_KEY" ]] && [[ -n "$DATA_DIR" ]] && [[ -f "$DATA_DIR/id_ed25519.pub" ]]; then
        PUBLIC_KEY=$($USE_SUDO cat "$DATA_DIR/id_ed25519.pub" 2>/dev/null || true)
    fi

    echo "Key (for client Settings > Network):"
    if [[ -n "$PUBLIC_KEY" ]]; then
        echo "  $PUBLIC_KEY"
    else
        echo "  (not found; check $RUSTDESK_SERVER_CONFIG_FILE or data dir)"
    fi
    echo ""

    echo "Ports:"
    echo "  HBBS (ID/Rendezvous): $HBBS_PORT"
    echo "  HBBS NAT test:        $HBBS_NAT_PORT (TCP/UDP)"
    echo "  HBBS Web:             $HBBS_WEB_PORT"
    echo "  HBBR Relay:           $HBBR_PORT"
    echo "  Relay:                 $RELAY_PORT"
    echo ""

    echo "Public IP (for client ID Server): $PUBLIC_IP"
    echo "Local IPs: $LOCAL_IPS"
    echo ""

    if [[ -n "$SERVER_VERSION" ]]; then
        echo "Server version: $SERVER_VERSION"
        echo ""
    fi

    if systemctl list-unit-files 2>/dev/null | grep -q "rustdesk-hbbs.service"; then
        echo "Service status:"
        $USE_SUDO systemctl is-active rustdesk-hbbs 2>/dev/null && echo "  rustdesk-hbbs: active" || echo "  rustdesk-hbbs: inactive"
        $USE_SUDO systemctl is-active rustdesk-hbbr 2>/dev/null && echo "  rustdesk-hbbr: active" || echo "  rustdesk-hbbr: inactive"
    else
        echo "RustDesk systemd services not found (not installed or different install path)."
    fi
else
    DATA_DIR=""
    if systemctl list-unit-files 2>/dev/null | grep -q "rustdesk-hbbs.service"; then
        DATA_DIR=$($USE_SUDO systemctl show rustdesk-hbbs --property=WorkingDirectory --value 2>/dev/null || true)
    fi
    [[ -z "$DATA_DIR" ]] && [[ -d /var/lib/rustdesk ]] && DATA_DIR="/var/lib/rustdesk"

    if [[ -n "$DATA_DIR" ]] && [[ -f "$DATA_DIR/id_ed25519.pub" ]]; then
        echo "Key (for client Settings > Network):"
        echo "  $($USE_SUDO cat "$DATA_DIR/id_ed25519.pub" 2>/dev/null)"
        echo ""
        echo "Config file not found: $RUSTDESK_SERVER_CONFIG_FILE"
        echo "Ports and IPs: see script 128 or run install/repair to save config."
        echo ""
        echo "Service status:"
        $USE_SUDO systemctl is-active rustdesk-hbbs 2>/dev/null && echo "  rustdesk-hbbs: active" || echo "  rustdesk-hbbs: inactive"
        $USE_SUDO systemctl is-active rustdesk-hbbr 2>/dev/null && echo "  rustdesk-hbbr: active" || echo "  rustdesk-hbbr: inactive"
    else
        echo "RustDesk Server config not found."
        echo "Config path: $RUSTDESK_SERVER_CONFIG_FILE"
        echo "Install with: scripts/shells/linux/debian/install_shells/128_install_rustdesk_server_*.sh"
    fi
fi

echo ""
echo "=========================================="
