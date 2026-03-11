#!/bin/bash
# App Manager - Command generator (Linux SH)
# Fills APP_COMMANDS[] using config templates. ROOT_DIR must be set.

fill_commands() {
    local root_dir="${1:-$ROOT_DIR}"
    local i
    for (( i=0; i < APP_COUNT; i++ )); do
        local key="${APP_FRAMEWORKS[$i]}"
        key="${key%Start}"
        key="${key/MultiPlatform/}"
        key="${key/reactNative/reactnative}"
        key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
        local is_dev="${APP_DEBUGS[$i]}"
        local cmd_key="${key}_dev"
        if [[ "$is_dev" != "true" ]]; then
            case "$key" in
                react|reactnative|vue|nuxt|laravel|flutter) cmd_key="${key}_build" ;;
            esac
        fi
        local tpl
        tpl=$(get_command_tpl "$cmd_key")
        [[ -z "$tpl" ]] && tpl=$(get_command_tpl "${key}_dev")
        if [[ -z "$tpl" ]]; then
            case "${APP_TYPES[$i]}" in
                ncoreApp) cmd_key="ncore_dev" ;;
                pycoreApp) cmd_key="pycore_dev" ;;
                *) cmd_key="polyLauncher" ;;
            esac
            tpl=$(get_command_tpl "$cmd_key")
        fi
        local app_path="${APP_PATHS[$i]}" app_name="${APP_NAMES[$i]}" port="${APP_PORTS[$i]}"
        tpl="${tpl//\$\{app_path\}/$app_path}"
        tpl="${tpl//\$\{app_name\}/$app_name}"
        tpl="${tpl//\$\{port\}/$port}"
        tpl="${tpl//\$\{root_dir\}/$root_dir}"
        APP_COMMANDS[$i]="$tpl"
    done
}
