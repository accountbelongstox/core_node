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

fetch_github_hosts_content() {
    local content
    if command -v curl >/dev/null 2>&1; then
        content=$(curl -sL --connect-timeout 15 "$GITHUB520_HOSTS_URL" 2>/dev/null)
    elif command -v wget >/dev/null 2>&1; then
        content=$(wget -qO- --timeout=15 "$GITHUB520_HOSTS_URL" 2>/dev/null)
    else
        return 1
    fi
    if [ -n "$content" ] && echo "$content" | grep -qF "$GITHUB520_MARKER_START" && echo "$content" | grep -qF "$GITHUB520_MARKER_END"; then
        echo "$content"
        return 0
    fi
    return 1
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
    local hosts_path
    hosts_path=$(get_github_hosts_file_path)
    [ -z "$hosts_path" ] && return 1
    [ ! -r "$hosts_path" ] && return 1

    local new_content
    new_content=$(fetch_github_hosts_content)
    [ -z "$new_content" ] && return 1

    local without_block
    without_block=$(remove_github520_block < "$hosts_path")

    local to_write
    to_write=$(printf '%s\n\n%s\n' "$without_block" "$new_content")
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
            sudo killall -HUP mDNSResponder 2>/dev/null || true
            ;;
        Linux)
            if command -v nscd >/dev/null 2>&1; then
                sudo nscd restart 2>/dev/null || sudo /etc/init.d/nscd restart 2>/dev/null || true
            fi
            if command -v resolvectl >/dev/null 2>&1; then
                sudo resolvectl flush-caches 2>/dev/null || true
            fi
            if command -v systemctl >/dev/null 2>&1 && systemctl is-active systemd-resolved >/dev/null 2>&1; then
                sudo systemctl restart systemd-resolved 2>/dev/null || true
            fi
            ;;
        *)
            if command -v nscd >/dev/null 2>&1; then
                sudo nscd restart 2>/dev/null || true
            fi
            ;;
    esac
    return 0
}

invoke_github_host_refresh() {
    local write_color_text="$1"
    if [ -z "$write_color_text" ]; then
        write_color_text="echo"
    fi
    $write_color_text "Fetching GitHub520 hosts..." "Cyan"
    if update_github_hosts_file; then
        $write_color_text "GitHub HOST updated and DNS flushed." "Green"
        return 0
    fi
    $write_color_text "GitHub HOST refresh failed or skipped." "Yellow"
    return 1
}
