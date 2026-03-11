#!/bin/bash
# App Manager - Application scanner (Linux SH)
# Scans apps/, pyapps/, poly_apps/ under ROOT_DIR; fills global arrays.

has_entry_point() {
    local app_path="$1"
    local e
    for e in $ENTRY_POINTS; do
        [[ -f "$app_path/$e" ]] && return 0
    done
    return 1
}

get_framework() {
    local app_path="$1"
    if [[ -f "$app_path/package.json" ]] && { [[ -d "$app_path/android" ]] || [[ -d "$app_path/ios" ]]; }; then
        grep -q 'react-native' "$app_path/package.json" 2>/dev/null && echo "reactNativeStart" && return
    fi
    [[ -f "$app_path/nuxt.config.ts" ]] && echo "nuxtStart" && return
    [[ -f "$app_path/nuxt.config.js" ]] && echo "nuxtStart" && return
    if [[ -f "$app_path/package.json" ]]; then
        local c
        c=$(cat "$app_path/package.json" 2>/dev/null)
        [[ "$c" == *react* && "$c" != *react-native* && "$c" != *nuxt* ]] && echo "reactStart" && return
        [[ "$c" == *vue* && "$c" != *nuxt* ]] && echo "vueStart" && return
    fi
    [[ -f "$app_path/composer.json" ]] && echo "laravelStart" && return
    [[ -f "$app_path/pubspec.yaml" ]] && echo "flutterStart" && return
    [[ -f "$app_path/build.gradle.kts" || -f "$app_path/build.gradle" ]] && echo "kotlinMultiPlatformStart" && return
    [[ -f "$app_path/index.php" ]] && echo "phpStart" && return
    [[ -f "$app_path/main.py" ]] && echo "pyStart" && return
    echo "polyLauncher"
}

is_debug_mode() {
    local app_path="$1"
    local framework="$2"
    local f
    for f in .env .env.local .env.development; do
        [[ -f "$app_path/$f" ]] || continue
        grep -qE 'APP_ENV=local|NODE_ENV=development|APP_DEBUG=true' "$app_path/$f" 2>/dev/null && return 0
    done
    [[ "$framework" == *react* || "$framework" == *vue* || "$framework" == *nuxt* ]] && \
        { [[ -f "$app_path/vite.config.js" ]] || [[ -f "$app_path/vite.config.ts" ]]; } && return 0
    local count=0
    [[ -d "$app_path/node_modules" ]] && ((count++))
    [[ -d "$app_path/src" ]] && ((count++))
    [[ -d "$app_path/lib" ]] && ((count++))
    (( count >= 2 )) && return 0
    [[ "$app_path" == *poly_apps* || "$app_path" == *dev* || "$app_path" == *development* ]] && return 0
    return 1
}

# Global arrays (must be set before scan)
# APP_NAMES APP_PATHS APP_TYPES APP_FRAMEWORKS APP_PORTS APP_DEBUGS APP_COMMANDS (filled by command_generator)
# APP_COUNT
scan_applications() {
    local root_dir="${1:-$ROOT_DIR}"
    [[ -z "$root_dir" || ! -d "$root_dir" ]] && APP_COUNT=0 && return

    local tmpdir
    tmpdir=$(mktemp -d)
    local list="$tmpdir/list"
    : > "$list"

    local dir type
    for dir in "$root_dir/apps" "$root_dir/pyapps" "$root_dir/poly_apps"; do
        case "$dir" in
            *poly_apps) type="polyApp" ;;
            *pyapps)    type="pycoreApp" ;;
            *apps)      type="ncoreApp" ;;
            *)          type="polyApp" ;;
        esac
        [[ ! -d "$dir" ]] && continue
        local name
        for name in "$dir"/*; do
            [[ -d "$name" ]] || continue
            [[ "$(basename "$name")" == .* ]] && continue
            has_entry_point "$name" || continue
            local fw debug
            fw=$(get_framework "$name")
            is_debug_mode "$name" "$fw" && debug="true" || debug="false"
            echo "$(basename "$name")|$name|$type|$fw|0|$debug" >> "$list"
        done
    done

    sort -t'|' -k1,1 -f "$list" > "$list.sorted"
    APP_NAMES=()
    APP_PATHS=()
    APP_TYPES=()
    APP_FRAMEWORKS=()
    APP_PORTS=()
    APP_DEBUGS=()
    APP_COMMANDS=()
    local i=0
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local n p t f port d
        n="${line%%|*}"; line="${line#*|}"
        p="${line%%|*}"; line="${line#*|}"
        t="${line%%|*}"; line="${line#*|}"
        f="${line%%|*}"; line="${line#*|}"
        port="${line%%|*}"; d="${line#*|}"
        APP_NAMES+=("$n")
        APP_PATHS+=("$p")
        APP_TYPES+=("$t")
        APP_FRAMEWORKS+=("$f")
        APP_PORTS+=($((BASE_PORT + i)))
        APP_DEBUGS+=("$d")
        APP_COMMANDS+=("")
        ((i++))
    done < "$list.sorted"
    APP_COUNT=$i
    rm -rf "$tmpdir"
}
