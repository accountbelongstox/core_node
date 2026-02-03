#!/bin/bash
# Gitee hosts refresh. Replaces only the marked block. Tries IP library, caches working IP.
# Markers: # Gitee Host Start ... # Gitee Host End

GITEE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
. "$GITEE_SCRIPT_DIR/hosts_common.sh"

GITEE_MARKER_START="# Gitee Host Start"
GITEE_MARKER_END="# Gitee Host End"
GITEE_DOMAINS="gitee.com www.gitee.com api.gitee.com"
GITEE_TEST_URL="https://gitee.com/"
GITEE_TEST_TIMEOUT="5"
GITEE_IP_LIBRARY="180.76.198.225 180.76.199.13 180.76.198.77"
if [ -n "$HOME" ]; then
    GITEE_CACHE_DIR="${HOME}/.core_node"
else
    GITEE_CACHE_DIR="/var/_node_core"
fi
GITEE_CACHE_FILE="$GITEE_CACHE_DIR/gitee_host_cache.txt"

CHOSEN_IP=""
BLOCK_CONTENT=""
REPLACED_COUNT="0"
CACHED_IP=""
CANDIDATES=""
WITHOUT_BLOCK=""
TO_WRITE=""

get_gitee_cache_ip() {
    CACHED_IP=""
    [ -f "$GITEE_CACHE_FILE" ] || return
    CACHED_IP=$(cat "$GITEE_CACHE_FILE" 2>/dev/null | tr -d '\r\n' | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
}

set_gitee_cache_ip() {
    [ -n "$1" ] || return
    mkdir -p "$(dirname "$GITEE_CACHE_FILE")"
    printf '%s' "$1" > "$GITEE_CACHE_FILE"
}

test_gitee_ip_ping() {
    ip="$1"
    [ -z "$ip" ] && return 1
    ping -c 1 -W "$GITEE_TEST_TIMEOUT" "$ip" >/dev/null 2>&1
}

get_gitee_block_content() {
    ip="$1"
    [ -z "$ip" ] && return
    echo "$GITEE_MARKER_START"
    for d in $GITEE_DOMAINS; do
        echo "$ip	$d"
    done
    echo "# Cached working IP for Gitee"
    echo "$GITEE_MARKER_END"
}

remove_gitee_block() {
    inside=0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            *"$GITEE_MARKER_START"*) inside=1 ;;
            *"$GITEE_MARKER_END"*)   inside=0 ;;
            *)
                [ "$inside" -eq 0 ] 2>/dev/null && printf '%s\n' "$line"
                ;;
        esac
    done
}

count_gitee_block_lines() {
    count=0
    inside=0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            *"$GITEE_MARKER_START"*) inside=1; count=$((count+1)) ;;
            *"$GITEE_MARKER_END"*)   inside=0; count=$((count+1)) ;;
            *) [ "$inside" -eq 1 ] && count=$((count+1)) ;;
        esac
    done
    echo "$count"
}

invoke_gitee_host_refresh() {
    write_color_text="$1"
    [ -z "$write_color_text" ] && write_color_text="echo"
    echo_cmd() { $write_color_text "> $1" "DarkGray" >&2; }

    get_hosts_path
    CHOSEN_IP=""
    BLOCK_CONTENT=""
    REPLACED_COUNT="0"

    $write_color_text "Hosts file: $HOSTS_PATH" "Cyan"
    if [ -z "$HOSTS_PATH" ] || [ ! -r "$HOSTS_PATH" ]; then
        echo "WARNING: Hosts file not found or not readable." >&2
        return
    fi

    get_gitee_cache_ip
    CANDIDATES="$CACHED_IP"
    for ip in $GITEE_IP_LIBRARY; do
        case " $CANDIDATES " in
            *" $ip "*) ;;
            *) CANDIDATES="$CANDIDATES $ip" ;;
        esac
    done
    CANDIDATES=$(echo "$CANDIDATES" | tr -s ' ' | sed 's/^ //')

    $write_color_text "Gitee IP candidates (cached first, then library): $CANDIDATES" "Cyan"
    for ip in $CANDIDATES; do
        [ -z "$ip" ] && continue
        $write_color_text "Testing IP: $ip ..." "Cyan"
        echo_cmd "ping -c 1 -W $GITEE_TEST_TIMEOUT $ip"
        if test_gitee_ip_ping "$ip"; then
            CHOSEN_IP="$ip"
            $write_color_text "IP $ip responds OK (ping)." "Green"
            break
        fi
        $write_color_text "IP $ip failed, try next." "Yellow"
    done

    if [ -z "$CHOSEN_IP" ]; then
        echo "WARNING: No Gitee IP responded. Hosts not updated." >&2
        for ip in $CANDIDATES; do
            [ -z "$ip" ] && continue
            $write_color_text "  ping -c 1 -W $GITEE_TEST_TIMEOUT $ip" "DarkGray"
        done
        speed_test_url="https://tool.chinaz.com/speedworld/www.gitee.com"
        $write_color_text "Opening in browser: $speed_test_url" "Cyan"
        if [ "$(uname -s)" = "Darwin" ]; then
            open "$speed_test_url" 2>/dev/null || true
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$speed_test_url" 2>/dev/null || true
        else
            echo "Open manually: $speed_test_url" >&2
        fi
        return
    fi

    set_gitee_cache_ip "$CHOSEN_IP"
    BLOCK_CONTENT=$(get_gitee_block_content "$CHOSEN_IP")
    $write_color_text "Gitee block content:" "Cyan"
    $write_color_text "$BLOCK_CONTENT" "DarkGray"

    REPLACED_COUNT=$(count_gitee_block_lines < "$HOSTS_PATH")
    $write_color_text "Replaced (old block lines): $REPLACED_COUNT" "Cyan"

    WITHOUT_BLOCK=$(remove_gitee_block < "$HOSTS_PATH")
    TO_WRITE=$(printf '%s\n\n%s\n' "$WITHOUT_BLOCK" "$BLOCK_CONTENT")

    echo_cmd "Write to \"$HOSTS_PATH\""
    if [ -w "$HOSTS_PATH" ]; then
        printf '%s\n' "$TO_WRITE" > "$HOSTS_PATH"
    else
        if command -v sudo >/dev/null 2>&1; then
            printf '%s\n' "$TO_WRITE" | sudo tee "$HOSTS_PATH" >/dev/null
        else
            echo "WARNING: Cannot write to $HOSTS_PATH." >&2
            return
        fi
    fi

    echo_cmd "flush_dns"
    flush_dns

    $write_color_text "Gitee HOST refresh succeeded. Using IP: $CHOSEN_IP" "Green"
    $write_color_text "Verifying: resolving gitee.com..." "DarkGray"
    ip=""
    if command -v getent >/dev/null 2>&1; then
        echo_cmd "getent hosts gitee.com"
        ip=$(getent hosts gitee.com 2>/dev/null | awk '{print $1}')
    elif command -v host >/dev/null 2>&1; then
        echo_cmd "host gitee.com"
        ip=$(host gitee.com 2>/dev/null | grep "has address" | head -1 | awk '{print $NF}')
    else
        echo_cmd "ping -c 1 gitee.com"
        ip=$(ping -c 1 -W 2 gitee.com 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    fi
    if [ -n "$ip" ]; then
        $write_color_text "Test OK: gitee.com -> $ip" "Green"
    else
        $write_color_text "Test: could not resolve gitee.com (may still work via hosts)." "Yellow"
    fi
}
