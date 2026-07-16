#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Codex CLI Environment Variables Menu Module
# Provides menu functions for managing Codex CLI (OpenAI) environment variables

# Configuration

get_codex_config() {
    ENVIRONMENT_CONFIGS_Codex_CLI_Title="Codex CLI Environment Variables"
    ENVIRONMENT_CONFIGS_Codex_CLI_Description="Set up Codex CLI environment variables for API access"
    ENVIRONMENT_CONFIGS_Codex_CLI_Common="codex"
    ENVIRONMENT_CONFIGS_Codex_CLI_CommandPrefix="codex"
    ENVIRONMENT_CONFIGS_Codex_CLI_DisplayName="Codex CLI"
    ENVIRONMENT_CONFIGS_Codex_CLI_SmartRecognition_Enabled="true"
    ENVIRONMENT_CONFIGS_Codex_CLI_SmartRecognition_AllowedTypes="token url"

    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_Count=2

    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_0_Name="OPENAI_API_KEY"
    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_0_DisplayName="OPENAI_API_KEY"
    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_0_Description="OpenAI API key for Codex CLI"
    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_0_IsSecret="true"
    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_0_InputType="Token"

    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_1_Name="OPENAI_BASE_URL"
    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_1_DisplayName="OPENAI_BASE_URL"
    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_1_Description="OpenAI-compatible API base URL (proxy/relay, leave empty for api.openai.com)"
    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_1_IsSecret="false"
    ENVIRONMENT_CONFIGS_Codex_CLI_Variables_1_InputType="Url"
}

# Backward-compatible alias
get_openai_config() { get_codex_config; }

# Menu Functions

show_codex_submenu() {
    get_codex_config

    local config_display_name="$ENVIRONMENT_CONFIGS_Codex_CLI_DisplayName"

    local -a menu_items=(
        "addcommand:Add $config_display_name Global Command"
        "viewscripts:View $config_display_name Scripts"
        "restore:Restore from Configuration"
        "back:Back to Main Menu"
    )

    local selected_index=0

    while true; do
        clear
        print_color "$config_display_name Menu" "Info"
        print_color "Use Up/Down arrows to navigate, Enter to select" "Info"
        print_color "=" "Info"

        for i in "${!menu_items[@]}"; do
            IFS=':' read -r action text <<< "${menu_items[$i]}"
            if [ $i -eq $selected_index ]; then
                echo -e "\033[33m> $text\033[0m"
            else
                echo "  $text"
            fi
        done

        read -rsn1 key
        case "$key" in
            $'\x1b')
                read -rsn2 key
                case "$key" in
                    '[A') ((selected_index--)); [ $selected_index -lt 0 ] && selected_index=$((${#menu_items[@]} - 1)) ;;
                    '[B') ((selected_index++)); [ $selected_index -ge ${#menu_items[@]} ] && selected_index=0 ;;
                esac
                ;;
            '')
                IFS=':' read -r action text <<< "${menu_items[$selected_index]}"

                case "$action" in
                    'addcommand')
                        local config_name="Codex CLI"
                        if [ -z "${ENVIRONMENT_CONFIGS_Codex_CLI_Title:-}" ]; then
                            get_codex_config
                        fi

                        show_existing_files_menu "$config_name"
                        generate_global_command "$config_name"
                        print_color "Press any key to continue..." "Info"
                        read -n 1 -s
                        ;;
                    'viewscripts')
                        local config_name="Codex CLI"
                        if [ -z "${ENVIRONMENT_CONFIGS_Codex_CLI_Title:-}" ]; then
                            get_codex_config
                        fi
                        show_list_scripts "$config_name"
                        ;;
                    'restore')
                        local config_name="Codex CLI"
                        if [ -z "${ENVIRONMENT_CONFIGS_Codex_CLI_Title:-}" ]; then
                            get_codex_config
                        fi
                        show_restore_configuration_menu "$config_name"
                        ;;
                    'back')
                        return 0
                        ;;
                esac
                ;;
        esac
    done
}
