#!/bin/bash
# GitHub520 hosts refresh. Replaces only the marked block in hosts file.
# Markers: # GitHub520 Host Start ... # GitHub520 Host End
# Ref: https://github.com/521xueweihan/GitHub520

GITHUB520_HOSTS_URL="https://raw.hellogithub.com/hosts"
GITHUB520_MARKER_START="# GitHub520 Host Start"
GITHUB520_MARKER_END="# GitHub520 Host End"

HOSTS_PATH=""
DOWNLOAD_FILE=""
NEW_CONTENT=""
FETCHED_COUNT="0"
REPLACED_COUNT="0"
REFRESH_SUCCESS="0"
WITHOUT_BLOCK=""
TO_WRITE=""
count="0"
inside="0"
ip=""

get_github_hosts_file_path() {
    if [ -f "/etc/hosts" ]; then
        HOSTS_PATH="/etc/hosts"
    else
        HOSTS_PATH=""
    fi
}

install_curl_if_missing() {
    if command -v curl >/dev/null 2>&1; then
        return
    fi
    if [ "$(uname -s)" = "Darwin" ]; then
        command -v brew >/dev/null 2>&1 && brew install curl 2>/dev/null
        return
    fi
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq 2>/dev/null
        sudo apt-get install -y curl 2>/dev/null
        return
    fi
    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y curl 2>/dev/null
        return
    fi
    if command -v yum >/dev/null 2>&1; then
        sudo yum install -y curl 2>/dev/null
        return
    fi
    if command -v apk >/dev/null 2>&1; then
        sudo apk add --no-cache curl 2>/dev/null
        return
    fi
}

count_host_entries() {
    echo "$1" | while IFS= read -r line || [ -n "$line" ]; do
        t=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        [ -z "$t" ] && continue
        case "$t" in \#*) continue ;; esac
        echo "$t" | grep -qE '^[0-9.]+[[:space:]]+[^[:space:]]+' && echo 1
    done | wc -l | tr -d ' '
}

count_github520_block_lines() {
    count=0
    inside=0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            *"$GITHUB520_MARKER_START"*) inside=1; count=$((count+1)) ;;
            *"$GITHUB520_MARKER_END"*)   inside=0; count=$((count+1)) ;;
            *)
                [ "$inside" -eq 1 ] && count=$((count+1))
                ;;
        esac
    done
    echo "$count"
}

remove_github520_block() {
    inside=0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            *"$GITHUB520_MARKER_START"*) inside=1 ;;
            *"$GITHUB520_MARKER_END"*)   inside=0 ;;
            *)
                [ "$inside" -eq 0 ] 2>/dev/null && printf '%s\n' "$line"
                ;;
        esac
    done
}

invoke_github_host_refresh() {
    write_color_text="$1"
    [ -z "$write_color_text" ] && write_color_text="echo"
    echo_cmd() { $write_color_text "> $1" "DarkGray" >&2; }

    get_github_hosts_file_path
    REFRESH_SUCCESS="0"
    NEW_CONTENT=""
    FETCHED_COUNT="0"
    REPLACED_COUNT="0"

    $write_color_text "Hosts file: $HOSTS_PATH" "Cyan"
    if [ -z "$HOSTS_PATH" ] || [ ! -r "$HOSTS_PATH" ]; then
        echo "WARNING: Hosts file not found or not readable: $HOSTS_PATH" >&2
        return
    fi

    $write_color_text "Fetching GitHub520 hosts..." "Cyan"
    if ! command -v curl >/dev/null 2>&1; then
        echo "WARNING: curl not found. Attempting to install..." >&2
        install_curl_if_missing
    fi
    if ! command -v curl >/dev/null 2>&1; then
        echo "WARNING: Could not find or install curl." >&2
        return
    fi

    DOWNLOAD_FILE=$(mktemp 2>/dev/null || echo "/tmp/github520_hosts_$$")
    echo_cmd "curl -sL --connect-timeout 15 --max-time 30 -o \"$DOWNLOAD_FILE\" \"$GITHUB520_HOSTS_URL\""
    curl -sL --connect-timeout 15 --max-time 30 -o "$DOWNLOAD_FILE" "$GITHUB520_HOSTS_URL" 2>/dev/null

    if [ ! -f "$DOWNLOAD_FILE" ]; then
        echo "WARNING: Download failed: temp file does not exist." >&2
        return
    fi
    if [ ! -s "$DOWNLOAD_FILE" ]; then
        echo "WARNING: Download failed: file is empty." >&2
        [ -e "$DOWNLOAD_FILE" ] && rm "$DOWNLOAD_FILE"
        return
    fi

    NEW_CONTENT=$(cat "$DOWNLOAD_FILE")
    [ -e "$DOWNLOAD_FILE" ] && rm "$DOWNLOAD_FILE"
    DOWNLOAD_FILE=""

    if [ -z "$NEW_CONTENT" ] || ! echo "$NEW_CONTENT" | grep -qF "$GITHUB520_MARKER_START" || ! echo "$NEW_CONTENT" | grep -qF "$GITHUB520_MARKER_END"; then
        echo "WARNING: Downloaded content missing expected markers (Start/End)." >&2
        return
    fi

    $write_color_text "Downloaded content (GitHub520 block):" "Cyan"
    $write_color_text "$NEW_CONTENT" "DarkGray"
    FETCHED_COUNT=$(count_host_entries "$NEW_CONTENT")
    $write_color_text "Fetched entries: $FETCHED_COUNT" "Cyan"

    REPLACED_COUNT=$(count_github520_block_lines < "$HOSTS_PATH")
    $write_color_text "Replaced (old block lines): $REPLACED_COUNT" "Cyan"

    WITHOUT_BLOCK=$(remove_github520_block < "$HOSTS_PATH")
    TO_WRITE=$(printf '%s\n\n%s\n' "$WITHOUT_BLOCK" "$NEW_CONTENT")

    echo_cmd "Write to \"$HOSTS_PATH\""
    if [ -w "$HOSTS_PATH" ]; then
        printf '%s\n' "$TO_WRITE" > "$HOSTS_PATH"
    else
        if command -v sudo >/dev/null 2>&1; then
            printf '%s\n' "$TO_WRITE" | sudo tee "$HOSTS_PATH" >/dev/null
        else
            echo "WARNING: Cannot write to $HOSTS_PATH and sudo not available." >&2
            return
        fi
    fi

    case "$(uname -s)" in
        Darwin)
            echo_cmd "sudo killall -HUP mDNSResponder"
            sudo killall -HUP mDNSResponder 2>/dev/null || true
            ;;
        Linux)
            if command -v nscd >/dev/null 2>&1; then
                echo_cmd "sudo nscd restart"
                sudo nscd restart 2>/dev/null || sudo /etc/init.d/nscd restart 2>/dev/null || true
            fi
            if command -v resolvectl >/dev/null 2>&1; then
                echo_cmd "sudo resolvectl flush-caches"
                sudo resolvectl flush-caches 2>/dev/null || true
            fi
            if command -v systemctl >/dev/null 2>&1 && systemctl is-active systemd-resolved >/dev/null 2>&1; then
                echo_cmd "sudo systemctl restart systemd-resolved"
                sudo systemctl restart systemd-resolved 2>/dev/null || true
            fi
            ;;
        *)
            if command -v nscd >/dev/null 2>&1; then
                echo_cmd "sudo nscd restart"
                sudo nscd restart 2>/dev/null || true
            fi
            ;;
    esac

    REFRESH_SUCCESS="1"
    $write_color_text "Refresh succeeded. Hosts file updated and DNS cache flushed." "Green"
    $write_color_text "Verifying: resolving github.com..." "DarkGray"
    ip=""
    if command -v getent >/dev/null 2>&1; then
        echo_cmd "getent hosts github.com"
        ip=$(getent hosts github.com 2>/dev/null | awk '{print $1}')
    elif command -v host >/dev/null 2>&1; then
        echo_cmd "host github.com"
        ip=$(host github.com 2>/dev/null | grep "has address" | head -1 | awk '{print $NF}')
    else
        echo_cmd "ping -c 1 github.com"
        ip=$(ping -c 1 -W 2 github.com 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    fi
    if [ -n "$ip" ]; then
        $write_color_text "Test OK: github.com -> $ip" "Green"
    else
        $write_color_text "Test: could not resolve github.com (may still work via hosts)." "Yellow"
    fi
}
