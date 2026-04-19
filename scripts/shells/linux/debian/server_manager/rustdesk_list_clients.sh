#!/bin/bash
# List RustDesk OSS client IDs by scanning hbbs/hbbr logs and optional data dir.
# OSS has no Web Console or API; this is the only way to see which client IDs used the server.
# Usage: [sudo] ./rustdesk_list_clients.sh [--since "7 days ago"] [--data-dir /path] [--no-journal] [--no-db]
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# ### AI SPECIAL ATTENTION RULES END ###

set -e

USE_SUDO=""
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
fi

RUSTDESK_SERVER_CONFIG_FILE="/var/_core_node/rustdesk_server/server.conf"
JOURNAL_SINCE=""
DATA_DIR=""
SKIP_JOURNAL=""
SKIP_DB=""
MIN_ID=100000000
MAX_ID=4294967295

while [[ $# -gt 0 ]]; do
    case "$1" in
        --since)
            JOURNAL_SINCE="$2"
            shift 2
            ;;
        --data-dir)
            DATA_DIR="$2"
            shift 2
            ;;
        --no-journal)
            SKIP_JOURNAL=1
            shift
            ;;
        --no-db)
            SKIP_DB=1
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--since \"7 days ago\"] [--data-dir /path] [--no-journal] [--no-db]"
            echo "  --since    journalctl time range (e.g. \"1 day ago\", \"7 days ago\")"
            echo "  --data-dir hbbs data directory (default: from config or systemd)"
            echo "  --no-journal  only scan data dir / db"
            echo "  --no-db       only scan journal logs"
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

if [[ -z "$DATA_DIR" ]] && [[ -f "$RUSTDESK_SERVER_CONFIG_FILE" ]]; then
    if grep -q "^DATA_DIR=" "$RUSTDESK_SERVER_CONFIG_FILE" 2>/dev/null; then
        DATA_DIR=$(grep "^DATA_DIR=" "$RUSTDESK_SERVER_CONFIG_FILE" | cut -d= -f2-)
    fi
fi

if [[ -z "$DATA_DIR" ]]; then
    if systemctl list-unit-files 2>/dev/null | grep -q "rustdesk-hbbs.service"; then
        DATA_DIR=$($USE_SUDO systemctl show rustdesk-hbbs --property=WorkingDirectory --value 2>/dev/null || true)
    fi
fi
if [[ -z "$DATA_DIR" ]] && [[ -d /var/lib/rustdesk ]]; then
    DATA_DIR="/var/lib/rustdesk"
fi

extract_ids_from_line() {
    grep -oE '[0-9]{8,11}' | while read -r n; do
        if [[ "$n" =~ ^[0-9]+$ ]]; then
            if [[ "$n" -ge "$MIN_ID" ]] && [[ "$n" -le "$MAX_ID" ]]; then
                echo "$n"
            fi
        fi
    done
}

OUTPUT_TMP=$(mktemp)
trap 'rm -f "$OUTPUT_TMP"' EXIT

if [[ -z "$SKIP_JOURNAL" ]]; then
    JARGS=(-u rustdesk-hbbs -u rustdesk-hbbr --no-pager)
    if [[ -n "$JOURNAL_SINCE" ]]; then
        JARGS+=(--since "$JOURNAL_SINCE")
    else
        JARGS+=(-n 5000)
    fi
    $USE_SUDO journalctl "${JARGS[@]}" 2>/dev/null | extract_ids_from_line >> "$OUTPUT_TMP" || true
fi

if [[ -z "$SKIP_DB" ]] && [[ -n "$DATA_DIR" ]] && [[ -d "$DATA_DIR" ]]; then
    for db in "$DATA_DIR"/*.db "$DATA_DIR"/*.sqlite3 "$DATA_DIR"/*.sqlite; do
        [[ -e "$db" ]] || continue
        if command -v sqlite3 >/dev/null 2>&1; then
            TABLES=$($USE_SUDO sqlite3 "$db" ".tables" 2>/dev/null || true)
            for t in peer peers device devices machine machines id ids; do
                if echo "$TABLES" | grep -qE "\b${t}\b"; then
                    COLS=$($USE_SUDO sqlite3 "$db" "PRAGMA table_info($t);" 2>/dev/null || true)
                    if echo "$COLS" | grep -qiE "id|peer|device|client"; then
                        $USE_SUDO sqlite3 "$db" "SELECT * FROM $t;" 2>/dev/null | tr '|' '\n' | extract_ids_from_line >> "$OUTPUT_TMP"
                    fi
                fi
            done
        fi
    done
fi

sort -n -u "$OUTPUT_TMP"
