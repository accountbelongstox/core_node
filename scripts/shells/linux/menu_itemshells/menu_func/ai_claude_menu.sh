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

# Claude AI Environment Variables Menu Module
# Provides menu functions for managing Claude AI environment variables

# Configuration

get_claude_config() {
    ENVIRONMENT_CONFIGS_Claude_AI_Title="Claude AI Environment Variables"
    ENVIRONMENT_CONFIGS_Claude_AI_Description="Set up Claude AI environment variables for API access"
    ENVIRONMENT_CONFIGS_Claude_AI_Common="claude"
    ENVIRONMENT_CONFIGS_Claude_AI_CommandPrefix="claude"
    ENVIRONMENT_CONFIGS_Claude_AI_DisplayName="Claude AI"
    ENVIRONMENT_CONFIGS_Claude_AI_SmartRecognition_Enabled="true"
    ENVIRONMENT_CONFIGS_Claude_AI_SmartRecognition_AllowedTypes="token url"

    ENVIRONMENT_CONFIGS_Claude_AI_Variables_Count=3

    ENVIRONMENT_CONFIGS_Claude_AI_Variables_0_Name="ANTHROPIC_BASE_URL"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_0_DisplayName="ANTHROPIC_BASE_URL"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_0_Description="Claude AI API base URL"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_0_IsSecret="false"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_0_InputType="Url"

    ENVIRONMENT_CONFIGS_Claude_AI_Variables_1_Name="ANTHROPIC_AUTH_TOKEN"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_1_DisplayName="ANTHROPIC_AUTH_TOKEN"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_1_Description="Claude AI authentication token"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_1_IsSecret="true"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_1_InputType="Token"

    ENVIRONMENT_CONFIGS_Claude_AI_Variables_2_Name="ANTHROPIC_API_KEY"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_2_DisplayName="ANTHROPIC_API_KEY"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_2_Description="Claude AI API key (alternative to ANTHROPIC_AUTH_TOKEN)"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_2_IsSecret="true"
    ENVIRONMENT_CONFIGS_Claude_AI_Variables_2_InputType="Token"
}

# Menu Functions

show_claude_submenu() {
    get_claude_config

    local config_display_name="$ENVIRONMENT_CONFIGS_Claude_AI_DisplayName"

    local -a menu_items=(
        "addcommand:Add $config_display_name Global Command"
        "viewscripts:View $config_display_name Scripts"
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
                        local config_name="Claude_AI"
                        if [ -z "${ENVIRONMENT_CONFIGS_Claude_AI_Title:-}" ]; then
                            get_claude_config
                        fi

                        show_existing_files_menu "$config_name"
                        generate_global_command "$config_name"
                        print_color "Press any key to continue..." "Info"
                        read -n 1 -s
                        ;;
                    'viewscripts')
                        local config_name="Claude_AI"
                        if [ -z "${ENVIRONMENT_CONFIGS_Claude_AI_Title:-}" ]; then
                            get_claude_config
                        fi
                        show_list_scripts "$config_name"
                        ;;
                    'back')
                        return 0
                        ;;
                esac
                ;;
        esac
    done
}
