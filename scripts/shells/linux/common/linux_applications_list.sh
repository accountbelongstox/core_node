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

# Linux Desktop Applications Configuration
# This file defines applications that can be installed via snap, apt, or other package managers
# Architecture inspired by Windows ApplicationsList.ps1

# Application categories for organization
readonly CATEGORY_BROWSERS="Browsers"
readonly CATEGORY_DEVELOPMENT_TOOLS="Development Tools"  
readonly CATEGORY_TEXT_EDITORS="Text Editors"
readonly CATEGORY_OFFICE_TOOLS="Office Tools"
readonly CATEGORY_COMMUNICATION="Communication"
readonly CATEGORY_MEDIA_TOOLS="Media Tools"
readonly CATEGORY_SYSTEM_UTILITIES="System Utilities"
readonly CATEGORY_DATABASE_TOOLS="Database Tools"
readonly CATEGORY_API_TOOLS="API Tools"
readonly CATEGORY_AI_TOOLS="AI Tools"
readonly CATEGORY_MCP_SERVICES="MCP Services"
readonly CATEGORY_DESIGN_TOOLS="Design Tools"
readonly CATEGORY_GAMING="Gaming"

# Installation methods supported
readonly METHOD_APT="apt"
readonly METHOD_SNAP="snap"
readonly METHOD_FLATPAK="flatpak"
readonly METHOD_WEB="web"
readonly METHOD_NPM="npm"
readonly METHOD_PIPX="pipx"
readonly METHOD_UV_TOOL="uv_tool"
readonly METHOD_CURL="curl"
readonly METHOD_MICROSOFT_APT="microsoft_apt"
readonly METHOD_APPIMAGE="appimage"

# Snap confinement modes
readonly SNAP_CONFINEMENT_STRICT="strict"
readonly SNAP_CONFINEMENT_CLASSIC="classic"

# Repository type for special repositories
readonly REPO_TYPE_MICROSOFT="microsoft"
readonly REPO_TYPE_UBUNTU_PPA="ubuntu_ppa"

# Installation groups - controls which applications are installed based on use case
readonly GROUP_ESSENTIAL="essential"        # Essential desktop applications
readonly GROUP_DEVELOPMENT="development"   # Development tools and IDEs
readonly GROUP_OFFICE="office"            # Office and productivity tools
readonly GROUP_MULTIMEDIA="multimedia"    # Media and design tools
readonly GROUP_COMMUNICATION="communication" # Chat and communication apps
readonly GROUP_MCP_SERVICES="mcp_services"   # MCP services and tools
readonly GROUP_ALL="all"                  # All applications

# Base Packages - Essential system tools and basic applications
declare -gA BASE_PACKAGES=(
    # Chrome Browser
    ["chrome_name"]="Google Chrome"
    ["chrome_exec"]="google-chrome"
    ["chrome_package_id"]="google-chrome-stable"
    ["chrome_install_method"]="$METHOD_APT"
    ["chrome_category"]="$CATEGORY_BROWSERS"
    ["chrome_groups"]="$GROUP_ESSENTIAL $GROUP_ALL"
    ["chrome_description"]="Google Chrome web browser"
    ["chrome_verify_command"]="--version"
    ["chrome_itemkey"]="--no-sandbox"

    # Vim Editor
    ["vim_name"]="Vim"
    ["vim_exec"]="vim"
    ["vim_package_id"]="vim"
    ["vim_install_method"]="$METHOD_APT"
    ["vim_category"]="$CATEGORY_TEXT_EDITORS"
    ["vim_groups"]="$GROUP_ESSENTIAL $GROUP_DEVELOPMENT $GROUP_ALL"
    ["vim_description"]="Vi IMproved text editor"
    ["vim_verify_command"]="--version"

    # CMake Build System
    ["cmake_name"]="CMake"
    ["cmake_exec"]="cmake"
    ["cmake_package_id"]="cmake"
    ["cmake_install_method"]="$METHOD_APT"
    ["cmake_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["cmake_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["cmake_description"]="Cross-platform build system"
    ["cmake_verify_command"]="--version"
)

# Development Tools - Programming environments and development utilities
declare -gA DEV_PACKAGES=(
    # PowerShell
    ["powershell_name"]="PowerShell"
    ["powershell_exec"]="pwsh"
    ["powershell_package_id"]="powershell"
    ["powershell_install_method"]="$METHOD_SNAP"
    ["powershell_snap_confinement"]="$SNAP_CONFINEMENT_CLASSIC"
    ["powershell_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["powershell_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["powershell_description"]="PowerShell cross-platform shell and scripting language"
    ["powershell_verify_command"]="--version"

    # Postman API Testing
    ["postman_name"]="Postman"
    ["postman_exec"]="postman"
    ["postman_package_id"]="postman"
    ["postman_install_method"]="$METHOD_SNAP"
    ["postman_category"]="$CATEGORY_API_TOOLS"
    ["postman_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["postman_description"]="API development and testing tool"
    ["postman_verify_command"]=""
    ["postman_super"]="true"
    
    # Termius SSH Client
    ["termius_name"]="Termius"
    ["termius_exec"]="termius-app"
    ["termius_package_id"]="termius-app"
    ["termius_install_method"]="$METHOD_SNAP"
    ["termius_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["termius_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["termius_description"]="SSH client and terminal"
    ["termius_verify_command"]=""
    ["termius_super"]="true"

    # Android Studio
    ["android_studio_name"]="Android Studio"
    ["android_studio_exec"]="android-studio"
    ["android_studio_package_id"]="android-studio"
    ["android_studio_install_method"]="$METHOD_SNAP"
    ["android_studio_snap_confinement"]="$SNAP_CONFINEMENT_CLASSIC"
    ["android_studio_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["android_studio_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["android_studio_description"]="Android development IDE"
    ["android_studio_verify_command"]=""
    ["android_studio_super"]="true"

    # IntelliJ IDEA Community
    ["intellij_name"]="IntelliJ IDEA Community"
    ["intellij_exec"]="intellij-idea-community"
    ["intellij_package_id"]="intellij-idea-community"
    ["intellij_install_method"]="$METHOD_SNAP"
    ["intellij_snap_confinement"]="$SNAP_CONFINEMENT_CLASSIC"
    ["intellij_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["intellij_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["intellij_description"]="Java IDE by JetBrains"
    ["intellij_verify_command"]=""
    ["intellij_super"]="true"
    
    # PyCharm Community
    ["pycharm_name"]="PyCharm Community"
    ["pycharm_exec"]="pycharm-community"
    ["pycharm_package_id"]="pycharm-community"
    ["pycharm_install_method"]="$METHOD_SNAP"
    ["pycharm_snap_confinement"]="$SNAP_CONFINEMENT_CLASSIC"
    ["pycharm_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["pycharm_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["pycharm_description"]="Python IDE by JetBrains"
    ["pycharm_verify_command"]=""
    ["pycharm_super"]="true"

    # CLion C++ IDE
    ["clion_name"]="CLion"
    ["clion_exec"]="clion"
    ["clion_package_id"]="clion"
    ["clion_install_method"]="$METHOD_SNAP"
    ["clion_snap_confinement"]="$SNAP_CONFINEMENT_CLASSIC"
    ["clion_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["clion_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["clion_description"]="C/C++ IDE by JetBrains"
    ["clion_verify_command"]=""
    ["clion_super"]="true"

    # Sublime Text
    ["sublime_name"]="Sublime Text"
    ["sublime_exec"]="subl"
    ["sublime_package_id"]="sublime-text"
    ["sublime_install_method"]="$METHOD_SNAP"
    ["sublime_snap_confinement"]="$SNAP_CONFINEMENT_CLASSIC"
    ["sublime_category"]="$CATEGORY_TEXT_EDITORS"
    ["sublime_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["sublime_description"]="Sophisticated text editor"
    ["sublime_verify_command"]="--version"
    ["sublime_super"]="true"
    
    # Insomnia API Client
    ["insomnia_name"]="Insomnia"
    ["insomnia_exec"]="insomnia"
    ["insomnia_package_id"]="insomnia"
    ["insomnia_install_method"]="$METHOD_SNAP"
    ["insomnia_category"]="$CATEGORY_API_TOOLS"
    ["insomnia_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["insomnia_description"]="REST API testing tool"
    ["insomnia_verify_command"]=""
    ["insomnia_super"]="true"

    # Beekeeper Studio Database Manager
    ["beekeeper_name"]="Beekeeper Studio"
    ["beekeeper_exec"]="beekeeper-studio"
    ["beekeeper_package_id"]="beekeeper-studio"
    ["beekeeper_install_method"]="$METHOD_SNAP"
    ["beekeeper_category"]="$CATEGORY_DATABASE_TOOLS"
    ["beekeeper_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["beekeeper_description"]="SQL editor and database manager"
    ["beekeeper_verify_command"]=""
    ["beekeeper_super"]="true"

    # Text Editor (generic)
    ["text_editor_name"]="Text Editor"
    ["text_editor_exec"]="gedit"
    ["text_editor_package_id"]="gedit"
    ["text_editor_install_method"]="$METHOD_APT"
    ["text_editor_category"]="$CATEGORY_TEXT_EDITORS"
    ["text_editor_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["text_editor_description"]="Simple text editor"
    ["text_editor_verify_command"]="--version"
    ["text_editor_super"]="true"
)

# Application Software - End-user applications (can be skipped via variable)
declare -gA APP_PACKAGES=(
    # RustDesk Remote Desktop
    ["rustdesk_name"]="RustDesk"
    ["rustdesk_exec"]="rustdesk"
    ["rustdesk_package_id"]="rustdesk"
    ["rustdesk_install_method"]="$METHOD_FLATPAK"
    ["rustdesk_category"]="$CATEGORY_SYSTEM_UTILITIES"
    ["rustdesk_groups"]="$GROUP_ESSENTIAL $GROUP_ALL"
    ["rustdesk_description"]="Remote desktop application"
    ["rustdesk_verify_command"]="--version"
    ["rustdesk_requires_desktop"]="true"

    # Firefox Browser
    ["firefox_name"]="Firefox"
    ["firefox_exec"]="firefox"
    ["firefox_package_id"]="firefox"
    ["firefox_install_method"]="$METHOD_SNAP"
    ["firefox_category"]="$CATEGORY_BROWSERS"
    ["firefox_groups"]="$GROUP_ESSENTIAL $GROUP_ALL"
    ["firefox_description"]="Mozilla Firefox web browser"
    ["firefox_verify_command"]="--version"

    # LibreOffice Office Suite
    ["libreoffice_name"]="LibreOffice"
    ["libreoffice_exec"]="libreoffice"
    ["libreoffice_package_id"]="libreoffice"
    ["libreoffice_install_method"]="$METHOD_APT"
    ["libreoffice_category"]="$CATEGORY_OFFICE_TOOLS"
    ["libreoffice_groups"]="$GROUP_OFFICE $GROUP_ALL"
    ["libreoffice_description"]="Free office suite"
    ["libreoffice_verify_command"]="--version"

    # Opera Browser
    ["opera_name"]="Opera"
    ["opera_exec"]="opera"
    ["opera_package_id"]="opera-browser-stable"
    ["opera_install_method"]="$METHOD_SNAP"
    ["opera_category"]="$CATEGORY_BROWSERS"
    ["opera_groups"]="$GROUP_ALL"
    ["opera_description"]="Opera web browser"
    ["opera_verify_command"]="--version"
    ["opera_itemkey"]="--no-sandbox"


    # Hey Mail
    ["hey_mail_name"]="Hey Mail"
    ["hey_mail_exec"]="hey"
    ["hey_mail_package_id"]="https://download.hey.com/Hey-latest-amd64.deb"
    ["hey_mail_install_method"]="$METHOD_WEB"
    ["hey_mail_category"]="$CATEGORY_COMMUNICATION"
    ["hey_mail_groups"]="$GROUP_COMMUNICATION $GROUP_ALL"
    ["hey_mail_description"]="Hey email client"
    ["hey_mail_verify_command"]=""

    # Gemini Desktop
    ["gemini_desktop_name"]="Gemini Desktop"
    ["gemini_desktop_exec"]="gemini"
    ["gemini_desktop_package_id"]="https://gemini.google.com/desktop"
    ["gemini_desktop_install_method"]="$METHOD_WEB"
    ["gemini_desktop_category"]="$CATEGORY_AI_TOOLS"
    ["gemini_desktop_groups"]="$GROUP_ALL"
    ["gemini_desktop_description"]="Google Gemini AI desktop app"
    ["gemini_desktop_verify_command"]=""

)

# AI Tools definitions (moved from 36_install_ai_tools.sh)
declare -gA AI_PACKAGES=(
    # Gemini CLI
    ["gemini_name"]="Google Gemini CLI"
    ["gemini_exec"]="gemini"
    ["gemini_package_id"]="@google/gemini-cli"
    ["gemini_install_method"]="$METHOD_NPM"
    ["gemini_category"]="$CATEGORY_AI_TOOLS"
    ["gemini_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["gemini_description"]="Google Gemini CLI - Advanced AI assistant with multimodal capabilities"
    ["gemini_verify_command"]="--version"

    # Claude Code
    ["claude_name"]="Anthropic Claude Code"
    ["claude_exec"]="claude"
    ["claude_package_id"]="@anthropic-ai/claude-code"
    ["claude_install_method"]="$METHOD_NPM"
    ["claude_category"]="$CATEGORY_AI_TOOLS"
    ["claude_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["claude_description"]="Anthropic Claude Code - AI-powered coding assistant with advanced reasoning"
    ["claude_verify_command"]="--version"

    # OpenAI Codex
    ["codex_name"]="OpenAI Codex"
    ["codex_exec"]="codex"
    ["codex_package_id"]="@openai/codex"
    ["codex_install_method"]="$METHOD_NPM"
    ["codex_category"]="$CATEGORY_AI_TOOLS"
    ["codex_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["codex_description"]="OpenAI Codex - AI system that translates natural language to code"
    ["codex_verify_command"]="--version"
    ["codex_itemkey"]="--yolo"

    # Cursor Agent
    ["cursor_agent_name"]="Cursor Agent"
    ["cursor_agent_exec"]="cursor"
    ["cursor_agent_package_id"]="https://cursor.com/install"
    ["cursor_agent_install_method"]="$METHOD_CURL"
    ["cursor_agent_category"]="$CATEGORY_AI_TOOLS"
    ["cursor_agent_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["cursor_agent_description"]="Cursor Agent - AI-first code editor with intelligent code completion"
    ["cursor_agent_verify_command"]="--version"

    # SuperClaude
    ["superclaude_name"]="SuperClaude Framework"
    ["superclaude_exec"]="superclaude"
    ["superclaude_package_id"]="SuperClaude"
    ["superclaude_install_method"]="$METHOD_UV_TOOL"
    ["superclaude_category"]="$CATEGORY_AI_TOOLS"
    ["superclaude_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["superclaude_description"]="SuperClaude Framework - Extended Claude Code with specialized commands and personas"
    ["superclaude_verify_command"]="--version"

    # OpenCode AI
    ["opencode_name"]="OpenCode AI"
    ["opencode_exec"]="opencode"
    ["opencode_package_id"]="https://opencode.ai/install"
    ["opencode_install_method"]="$METHOD_CURL"
    ["opencode_category"]="$CATEGORY_AI_TOOLS"
    ["opencode_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["opencode_description"]="OpenCode AI - AI-powered code generation and development assistant"
    ["opencode_verify_command"]="--version"

    # Auggie CLI
    ["auggie_name"]="Augment Code Auggie"
    ["auggie_exec"]="auggie"
    ["auggie_package_id"]="@augmentcode/auggie"
    ["auggie_install_method"]="$METHOD_NPM"
    ["auggie_category"]="$CATEGORY_AI_TOOLS"
    ["auggie_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["auggie_description"]="Augment Code Auggie - AI-powered code enhancement and development assistant"
    ["auggie_verify_command"]="--version"

    # Droid AI Assistant
    ["droid_name"]="Droid AI Assistant"
    ["droid_exec"]="droid"
    ["droid_package_id"]="https://app.factory.ai/cli"
    ["droid_install_method"]="$METHOD_CURL"
    ["droid_category"]="$CATEGORY_AI_TOOLS"
    ["droid_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["droid_description"]="Droid AI Assistant - AI-powered development assistant from Factory.ai"
    ["droid_verify_command"]="--version"
)

# MCP Services - Model Context Protocol services and tools
declare -gA MCP_PACKAGES=(
)

# Package group lists for iteration
BASE_PACKAGE_LIST=(
    "chrome" "vim" "cmake"
)

DEV_PACKAGE_LIST=(
    "powershell" "postman" "termius" "android_studio"
    "intellij" "pycharm" "clion" "sublime" "insomnia" "beekeeper"
    "text_editor"
)

APP_PACKAGE_LIST=(
    "firefox" "libreoffice" "opera" "hey_mail" "gemini_desktop" "rustdesk"
)

AI_PACKAGE_LIST=(
    "gemini" "claude" "codex" "cursor_agent" "superclaude" "opencode" "auggie" "droid"
)

MCP_PACKAGE_LIST=(
)



# Function to get application property from specific package group
get_package_property() {
    local package_group="$1"
    local app_name="$2"
    local property="$3"
    local key="${app_name}_${property}"
    
    case "$package_group" in
        "BASE")
            echo "${BASE_PACKAGES[$key]}"
            ;;
        "DEV")
            echo "${DEV_PACKAGES[$key]}"
            ;;
        "APP")
            echo "${APP_PACKAGES[$key]}"
            ;;
        "AI")
            echo "${AI_PACKAGES[$key]}"
            ;;
        "MCP")
            echo "${MCP_PACKAGES[$key]}"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to get application property (searches all groups)
get_app_property() {
    local app_name="$1"
    local property="$2"
    
    # Try BASE packages first
    local result=$(get_package_property "BASE" "$app_name" "$property")
    if [ -n "$result" ]; then
        echo "$result"
        return 0
    fi
    
    # Try DEV packages
    result=$(get_package_property "DEV" "$app_name" "$property")
    if [ -n "$result" ]; then
        echo "$result"
        return 0
    fi
    
    # Try APP packages
    result=$(get_package_property "APP" "$app_name" "$property")
    if [ -n "$result" ]; then
        echo "$result"
        return 0
    fi

    # Try AI packages
    result=$(get_package_property "AI" "$app_name" "$property")
    if [ -n "$result" ]; then
        echo "$result"
        return 0
    fi

    # Try MCP packages
    result=$(get_package_property "MCP" "$app_name" "$property")
    if [ -n "$result" ]; then
        echo "$result"
        return 0
    fi

    echo ""
}

# Function to get AI tool property
get_ai_property() {
    local tool_name="$1"
    local property="$2"
    get_package_property "AI" "$tool_name" "$property"
}

# Function to get MCP service property
get_mcp_property() {
    local service_name="$1"
    local property="$2"
    get_package_property "MCP" "$service_name" "$property"
}

# Function to check if application belongs to group
app_in_group() {
    local app_name="$1"
    local target_group="$2"
    local groups=$(get_app_property "$app_name" "groups")
    [[ " $groups " =~ " $target_group " ]]
}

# Function to check if MCP service belongs to group
mcp_in_group() {
    local service_name="$1"
    local target_group="$2"
    local groups=$(get_mcp_property "$service_name" "groups")
    [[ " $groups " =~ " $target_group " ]]
}

# Function to get applications by package group
get_apps_by_package_group() {
    local package_group="$1"
    
    case "$package_group" in
        "BASE")
            printf '%s\n' "${BASE_PACKAGE_LIST[@]}"
            ;;
        "DEV")
            printf '%s\n' "${DEV_PACKAGE_LIST[@]}"
            ;;
        "APP")
            printf '%s\n' "${APP_PACKAGE_LIST[@]}"
            ;;
        "AI")
            printf '%s\n' "${AI_PACKAGE_LIST[@]}"
            ;;
        "MCP")
            for service in "${MCP_PACKAGE_LIST[@]}"; do
                echo "mcp_$service"
            done
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to get applications by group (legacy compatibility)
get_apps_by_group() {
    local target_group="$1"
    local apps=()
    
    # Check BASE packages
    for app in "${BASE_PACKAGE_LIST[@]}"; do
        if app_in_group "$app" "$target_group"; then
            apps+=("$app")
        fi
    done
    
    # Check DEV packages
    for app in "${DEV_PACKAGE_LIST[@]}"; do
        if app_in_group "$app" "$target_group"; then
            apps+=("$app")
        fi
    done
    
    # Check APP packages
    for app in "${APP_PACKAGE_LIST[@]}"; do
        if app_in_group "$app" "$target_group"; then
            apps+=("$app")
        fi
    done

    # Check AI packages
    for ai_tool in "${AI_PACKAGE_LIST[@]}"; do
        if app_in_group "$ai_tool" "$target_group"; then
            apps+=("$ai_tool")
        fi
    done

    # Check MCP services
    for service in "${MCP_PACKAGE_LIST[@]}"; do
        if mcp_in_group "$service" "$target_group"; then
            apps+=("mcp_$service")
        fi
    done
    
    printf '%s\n' "${apps[@]}"
}

# Function to get installation method for an application
get_install_method() {
    local app_name="$1"
    get_app_property "$app_name" "install_method"
}

# Function to get package ID for an application
get_package_id() {
    local app_name="$1"
    get_app_property "$app_name" "package_id"
}

# Function to check if application needs super (sudo) privileges
get_super() {
    local app_name="$1"
    local super=$(get_app_property "$app_name" "super")
    if [ "$super" = "false" ]; then
        echo ""
    else
        echo "$USE_SUDO"
    fi
}

# Function to get itemkey for an application (optional command argument)
get_itemkey() {
    local app_name="$1"
    get_app_property "$app_name" "itemkey"
}

# Function to create symlink in /usr/local/bin
create_launch_script() {
    local app_name="$1"
    local link_name="$app_name"
    local link_path="/usr/local/bin/$link_name"

    local install_method=$(get_install_method "$app_name")
    local exec_name=$(get_app_property "$app_name" "exec")

    if [ -z "$exec_name" ]; then
        return 0
    fi

    local target_path=""

    case "$install_method" in
        "$METHOD_NPM")
            local npm_bin=$(npm config get prefix 2>/dev/null)/bin
            if [ -n "$npm_bin" ] && [ -d "$npm_bin" ]; then
                target_path="$npm_bin/$exec_name"
            else
                # Fallback to which if npm bin not available
                target_path=$(which "$exec_name" 2>/dev/null)
            fi
            ;;
        "$METHOD_SNAP")
            target_path="/snap/bin/$exec_name"
            if [ ! -e "$target_path" ]; then
                target_path=$(which "$exec_name" 2>/dev/null)
            fi
            ;;
        "$METHOD_APT"|"$METHOD_FLATPAK"|"$METHOD_PIPX"|"$METHOD_UV_TOOL"|"$METHOD_CURL"|"$METHOD_WEB"|"$METHOD_APPIMAGE"|"$METHOD_MICROSOFT_APT")
            target_path=$(which "$exec_name" 2>/dev/null)
            ;;
        *)
            return 0
            ;;
    esac

    if [ -z "$target_path" ] || [ ! -e "$target_path" ]; then
        return 0
    fi

    # Check if link already points to correct target
    if [ -L "$link_path" ]; then
        local current_target=$(readlink -f "$link_path")
        local real_target=$(readlink -f "$target_path")
        
        if [ "$current_target" = "$real_target" ]; then
            return 0
        fi
    fi

    # Remove existing link/file
    if [ -e "$link_path" ] || [ -L "$link_path" ]; then
        $USE_SUDO rm -f "$link_path"
    fi

    # Create symlink
    $USE_SUDO ln -sf "$target_path" "$link_path"
}

# Function to get snap confinement mode for an application
get_snap_confinement() {
    local app_name="$1"
    get_app_property "$app_name" "snap_confinement"
}

# Function to check if snap fallback is enabled for an application
is_snap_fallback_enabled() {
    local app_name="$1"
    local fallback=$(get_app_property "$app_name" "snap_fallback")
    if [ "$fallback" = "true" ]; then
        return 0
    else
        return 1
    fi
}

# Function to get repository type for an application (microsoft, ubuntu_ppa, etc.)
get_repo_type() {
    local app_name="$1"
    get_app_property "$app_name" "repo_type"
}

# Function to check if application has special repository requirements
has_special_repo() {
    local app_name="$1"
    local repo_type=$(get_repo_type "$app_name")
    if [ -n "$repo_type" ] && [ "$repo_type" != "" ]; then
        return 0
    else
        return 1
    fi
}

# Export functions for use by installer scripts
export -f get_package_property get_app_property get_mcp_property
export -f app_in_group mcp_in_group get_apps_by_package_group
export -f get_apps_by_group get_install_method get_package_id
export -f get_itemkey get_super create_launch_script
export -f get_snap_confinement is_snap_fallback_enabled get_repo_type has_special_repo
