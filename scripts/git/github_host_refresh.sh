#!/bin/bash
# GitHub520 hosts refresh: replace only the marked block in hosts file.
# Markers: # GitHub520 Host Start ... # GitHub520 Host End

GITHUB520_HOSTS_URL="https://raw.hellogithub.com/hosts"
GITHUB520_MARKER_START="# GitHub520 Host Start"
GITHUB520_MARKER_END="# GitHub520 Host End"

get_github_hosts_file_path() {
    if [ -f "/etc/hosts" ]; then
        echo "/etc/hosts"
    else
        echo ""
    fi
}

install_curl_if_missing() {
    if command -v curl >/dev/null 2>&1; then
        return 0
    fi
    if [ "$(uname -s)" = "Darwin" ]; then
        if command -v brew >/dev/null 2>&1; then
            brew install curl 2>/dev/null && return 0
        fi
        return 1
    fi
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq 2>/dev/null && sudo apt-get install -y curl 2>/dev/null && return 0
    fi
    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y curl 2>/dev/null && return 0
    fi
    if command -v yum >/dev/null 2>&1; then
        sudo yum install -y curl 2>/dev/null && return 0
    fi
    if command -v apk >/dev/null 2>&1; then
        sudo apk add --no-cache curl 2>/dev/null && return 0
    fi
    return 1
}

fetch_github_hosts_content() {
    local echo_cmd="$1"
    if [ -n "$echo_cmd" ]; then
        $echo_cmd "> curl -sL --connect-timeout 15 --max-time 30 \"$GITHUB520_HOSTS_URL\""
    fi
    if ! command -v curl >/dev/null 2>&1; then
        install_curl_if_missing || return 1
    fi
    local content
    content=$(curl -sL --connect-timeout 15 --max-time 30 "$GITHUB520_HOSTS_URL" 2>/dev/null)
    if [ -n "$content" ] && echo "$content" | grep -qF "$GITHUB520_MARKER_START" && echo "$content" | grep -qF "$GITHUB520_MARKER_END"; then
        echo "$content"
        return 0
    fi
    return 1
}

count_host_entries() {
    echo "$1" | while IFS= read -r line || [ -n "$line" ]; do
        local t
        t=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        [ -z "$t" ] && continue
        case "$t" in \#*) continue ;; esac
        echo "$t" | grep -qE '^[0-9.]+[[:space:]]+[^[:space:]]+' && echo 1
    done | wc -l
}

count_github520_block_lines() {
    local inside=0
    local count=0
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
    local inside=0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            *"$GITHUB520_MARKER_START"*) inside=1 ;;
            *"$GITHUB520_MARKER_END"*)   inside=0 ;;
            *)
                [ "$inside" -eq 0 ] && printf '%s\n' "$line"
                ;;
        esac
    done
}

update_github_hosts_file() {
    local echo_cmd="$1"
    local hosts_path
    hosts_path=$(get_github_hosts_file_path)
    [ -z "$hosts_path" ] && return 1
    [ ! -r "$hosts_path" ] && return 1

    local new_content
    new_content=$(fetch_github_hosts_content "$echo_cmd")
    [ -z "$new_content" ] && return 1

    local fetched_count replaced_count
    fetched_count=$(count_host_entries "$new_content")
    replaced_count=$(count_github520_block_lines < "$hosts_path")

    local without_block
    without_block=$(remove_github520_block < "$hosts_path")

    local to_write
    to_write=$(printf '%s\n\n%s\n' "$without_block" "$new_content")
    if [ -n "$echo_cmd" ]; then
        $echo_cmd "> Write to \"$hosts_path\" (GitHub520 block)"
    fi
    if [ -w "$hosts_path" ]; then
        printf '%s\n' "$to_write" > "$hosts_path"
    else
        if command -v sudo >/dev/null 2>&1; then
            printf '%s\n' "$to_write" | sudo tee "$hosts_path" >/dev/null
        else
            return 1
        fi
    fi

    case "$(uname -s)" in
        Darwin)
            [ -n "$echo_cmd" ] && $echo_cmd "> sudo killall -HUP mDNSResponder"
            sudo killall -HUP mDNSResponder 2>/dev/null || true
            ;;
        Linux)
            if command -v nscd >/dev/null 2>&1; then
                [ -n "$echo_cmd" ] && $echo_cmd "> sudo nscd restart"
                sudo nscd restart 2>/dev/null || sudo /etc/init.d/nscd restart 2>/dev/null || true
            fi
            if command -v resolvectl >/dev/null 2>&1; then
                [ -n "$echo_cmd" ] && $echo_cmd "> sudo resolvectl flush-caches"
                sudo resolvectl flush-caches 2>/dev/null || true
            fi
            if command -v systemctl >/dev/null 2>&1 && systemctl is-active systemd-resolved >/dev/null 2>&1; then
                [ -n "$echo_cmd" ] && $echo_cmd "> sudo systemctl restart systemd-resolved"
                sudo systemctl restart systemd-resolved 2>/dev/null || true
            fi
            ;;
        *)
            if command -v nscd >/dev/null 2>&1; then
                [ -n "$echo_cmd" ] && $echo_cmd "> sudo nscd restart"
                sudo nscd restart 2>/dev/null || true
            fi
            ;;
    esac
    echo "FETCHED_COUNT=$fetched_count"
    echo "REPLACED_COUNT=$replaced_count"
    return 0
}

invoke_github_host_refresh() {
    local write_color_text="$1"
    if [ -z "$write_color_text" ]; then
        write_color_text="echo"
    fi
    echo_cmd() { $write_color_text "> $1" "DarkGray" >&2; }
    $write_color_text "Fetching GitHub520 hosts..." "Cyan"
    local update_out
    update_out=$(update_github_hosts_file "echo_cmd")
    local rc=$?
    local fetched_count replaced_count
    fetched_count=$(echo "$update_out" | sed -n 's/^FETCHED_COUNT=//p')
    replaced_count=$(echo "$update_out" | sed -n 's/^REPLACED_COUNT=//p')
    [ -n "$fetched_count" ] && $write_color_text "Fetched entries: $fetched_count | Replaced (old block lines): $replaced_count" "Cyan"
    if [ $rc -eq 0 ] && [ -n "$update_out" ]; then
        $write_color_text "Refresh succeeded. Hosts file updated and DNS cache flushed." "Green"
        $write_color_text "Verifying: resolving github.com..." "DarkGray"
        if command -v getent >/dev/null 2>&1; then
            $write_color_text "> getent hosts github.com" "DarkGray"
            local ip
            ip=$(getent hosts github.com 2>/dev/null | awk '{print $1}')
        elif command -v host >/dev/null 2>&1; then
            $write_color_text "> host github.com" "DarkGray"
            local ip
            ip=$(host github.com 2>/dev/null | grep "has address" | head -1 | awk '{print $NF}')
        else
            $write_color_text "> ping -c 1 github.com" "DarkGray"
            ip=$(ping -c 1 -W 2 github.com 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        fi
        if [ -n "$ip" ]; then
            $write_color_text "Test OK: github.com -> $ip" "Green"
        else
            $write_color_text "Test: could not resolve github.com (may still work via hosts)." "Yellow"
        fi
        return 0
    fi
    $write_color_text "Refresh failed or skipped." "Yellow"
    return 1
}
