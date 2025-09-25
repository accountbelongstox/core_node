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
    # Firefox Browser
    ["firefox_name"]="Firefox"
    ["firefox_exec"]="firefox"
    ["firefox_package_id"]="firefox"
    ["firefox_install_method"]="$METHOD_SNAP"
    ["firefox_category"]="$CATEGORY_BROWSERS"
    ["firefox_groups"]="$GROUP_ESSENTIAL $GROUP_ALL"
    ["firefox_description"]="Mozilla Firefox web browser"
    ["firefox_verify_command"]="--version"
    ["firefox_launch_command"]="which firefox && $USE_SUDO firefox"

    # Chrome Browser
    ["chrome_name"]="Google Chrome"
    ["chrome_exec"]="google-chrome"
    ["chrome_package_id"]="google-chrome-stable"
    ["chrome_install_method"]="$METHOD_APT"
    ["chrome_category"]="$CATEGORY_BROWSERS"
    ["chrome_groups"]="$GROUP_ESSENTIAL $GROUP_ALL"
    ["chrome_description"]="Google Chrome web browser"
    ["chrome_verify_command"]="--version"
    ["chrome_launch_command"]="which google-chrome && $USE_SUDO google-chrome --no-sandbox"

    # Vim Editor
    ["vim_name"]="Vim"
    ["vim_exec"]="vim"
    ["vim_package_id"]="vim"
    ["vim_install_method"]="$METHOD_APT"
    ["vim_category"]="$CATEGORY_TEXT_EDITORS"
    ["vim_groups"]="$GROUP_ESSENTIAL $GROUP_DEVELOPMENT $GROUP_ALL"
    ["vim_description"]="Vi IMproved text editor"
    ["vim_verify_command"]="--version"
    ["vim_launch_command"]=""

    # RustDesk Remote Desktop
    ["rustdesk_name"]="RustDesk"
    ["rustdesk_exec"]="rustdesk"
    ["rustdesk_package_id"]="rustdesk"
    ["rustdesk_install_method"]="$METHOD_SNAP"
    ["rustdesk_category"]="$CATEGORY_SYSTEM_UTILITIES"
    ["rustdesk_groups"]="$GROUP_ESSENTIAL $GROUP_ALL"
    ["rustdesk_description"]="Remote desktop application"
    ["rustdesk_verify_command"]="--version"
    ["rustdesk_launch_command"]="which rustdesk && $USE_SUDO rustdesk"


)

# Development Tools - Programming environments and development utilities
declare -gA DEV_PACKAGES=(
    # VSCode
    ["vscode_name"]="Visual Studio Code"
    ["vscode_exec"]="code"
    ["vscode_package_id"]="code"
    ["vscode_install_method"]="$METHOD_MICROSOFT_APT"
    ["vscode_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["vscode_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["vscode_description"]="Popular code editor by Microsoft"
    ["vscode_verify_command"]="--version"
    ["vscode_launch_command"]="which code && $USE_SUDO code --no-sandbox --user-data-dir"

    # Cursor AI Editor
    ["cursor_name"]="Cursor AI Editor"
    ["cursor_exec"]="cursor"
    ["cursor_package_id"]="cursor"
    ["cursor_install_method"]="$METHOD_SNAP"
    ["cursor_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["cursor_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["cursor_description"]="AI-powered code editor"
    ["cursor_verify_command"]="--version"
    ["cursor_launch_command"]="which cursor && $USE_SUDO cursor --no-sandbox"

    # Postman API Testing
    ["postman_name"]="Postman"
    ["postman_exec"]="postman"
    ["postman_package_id"]="postman"
    ["postman_install_method"]="$METHOD_SNAP"
    ["postman_category"]="$CATEGORY_API_TOOLS"
    ["postman_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["postman_description"]="API development and testing tool"
    ["postman_verify_command"]=""
    ["postman_launch_command"]="which postman && $USE_SUDO postman"
    
    # Termius SSH Client
    ["termius_name"]="Termius"
    ["termius_exec"]="termius-app"
    ["termius_package_id"]="termius-app"
    ["termius_install_method"]="$METHOD_SNAP"
    ["termius_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["termius_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["termius_description"]="SSH client and terminal"
    ["termius_verify_command"]=""
    ["termius_launch_command"]="which termius-app && $USE_SUDO termius-app"

    # Android Studio
    ["android_studio_name"]="Android Studio"
    ["android_studio_exec"]="android-studio"
    ["android_studio_package_id"]="android-studio"
    ["android_studio_install_method"]="$METHOD_SNAP"
    ["android_studio_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["android_studio_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["android_studio_description"]="Android development IDE"
    ["android_studio_verify_command"]=""
    ["android_studio_launch_command"]="which android-studio && $USE_SUDO android-studio"

    # IntelliJ IDEA Community
    ["intellij_name"]="IntelliJ IDEA Community"
    ["intellij_exec"]="intellij-idea-community"
    ["intellij_package_id"]="intellij-idea-community"
    ["intellij_install_method"]="$METHOD_SNAP"
    ["intellij_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["intellij_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["intellij_description"]="Java IDE by JetBrains"
    ["intellij_verify_command"]=""
    ["intellij_launch_command"]="which intellij-idea-community && $USE_SUDO intellij-idea-community"
    
    # PyCharm Community
    ["pycharm_name"]="PyCharm Community"
    ["pycharm_exec"]="pycharm-community"
    ["pycharm_package_id"]="pycharm-community"
    ["pycharm_install_method"]="$METHOD_SNAP"
    ["pycharm_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["pycharm_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["pycharm_description"]="Python IDE by JetBrains"
    ["pycharm_verify_command"]=""
    ["pycharm_launch_command"]="which pycharm-community && $USE_SUDO pycharm-community"

    # CLion C++ IDE
    ["clion_name"]="CLion"
    ["clion_exec"]="clion"
    ["clion_package_id"]="clion"
    ["clion_install_method"]="$METHOD_SNAP"
    ["clion_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["clion_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["clion_description"]="C/C++ IDE by JetBrains"
    ["clion_verify_command"]=""
    ["clion_launch_command"]="which clion && $USE_SUDO clion"

    # Sublime Text
    ["sublime_name"]="Sublime Text"
    ["sublime_exec"]="subl"
    ["sublime_package_id"]="sublime-text"
    ["sublime_install_method"]="$METHOD_SNAP"
    ["sublime_category"]="$CATEGORY_TEXT_EDITORS"
    ["sublime_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["sublime_description"]="Sophisticated text editor"
    ["sublime_verify_command"]="--version"
    ["sublime_launch_command"]="which subl && $USE_SUDO subl"
    
    # Insomnia API Client
    ["insomnia_name"]="Insomnia"
    ["insomnia_exec"]="insomnia"
    ["insomnia_package_id"]="insomnia"
    ["insomnia_install_method"]="$METHOD_SNAP"
    ["insomnia_category"]="$CATEGORY_API_TOOLS"
    ["insomnia_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["insomnia_description"]="REST API testing tool"
    ["insomnia_verify_command"]=""
    ["insomnia_launch_command"]="which insomnia && $USE_SUDO insomnia"

    # Beekeeper Studio Database Manager
    ["beekeeper_name"]="Beekeeper Studio"
    ["beekeeper_exec"]="beekeeper-studio"
    ["beekeeper_package_id"]="beekeeper-studio"
    ["beekeeper_install_method"]="$METHOD_SNAP"
    ["beekeeper_category"]="$CATEGORY_DATABASE_TOOLS"
    ["beekeeper_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["beekeeper_description"]="SQL editor and database manager"
    ["beekeeper_verify_command"]=""
    ["beekeeper_launch_command"]="which beekeeper-studio && $USE_SUDO beekeeper-studio"

    # CMake Build System
    ["cmake_name"]="CMake"
    ["cmake_exec"]="cmake"
    ["cmake_package_id"]="cmake"
    ["cmake_install_method"]="$METHOD_APT"
    ["cmake_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["cmake_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["cmake_description"]="Cross-platform build system"
    ["cmake_verify_command"]="--version"
    ["cmake_launch_command"]=""

    # VSCode Insiders
    ["code_insiders_name"]="Visual Studio Code Insiders"
    ["code_insiders_exec"]="code-insiders"
    ["code_insiders_package_id"]="code-insiders"
    ["code_insiders_install_method"]="$METHOD_SNAP"
    ["code_insiders_category"]="$CATEGORY_DEVELOPMENT_TOOLS"
    ["code_insiders_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["code_insiders_description"]="VSCode Insiders preview version"
    ["code_insiders_verify_command"]="--version"
    ["code_insiders_launch_command"]="which code-insiders && $USE_SUDO code-insiders --no-sandbox --user-data-dir"

    # Text Editor (generic)
    ["text_editor_name"]="Text Editor"
    ["text_editor_exec"]="gedit"
    ["text_editor_package_id"]="gedit"
    ["text_editor_install_method"]="$METHOD_APT"
    ["text_editor_category"]="$CATEGORY_TEXT_EDITORS"
    ["text_editor_groups"]="$GROUP_DEVELOPMENT $GROUP_ALL"
    ["text_editor_description"]="Simple text editor"
    ["text_editor_verify_command"]="--version"
    ["text_editor_launch_command"]="which gedit && $USE_SUDO gedit"
)

# Application Software - End-user applications (can be skipped via variable)
declare -gA APP_PACKAGES=(
    # LibreOffice Office Suite
    ["libreoffice_name"]="LibreOffice"
    ["libreoffice_exec"]="libreoffice"
    ["libreoffice_package_id"]="libreoffice"
    ["libreoffice_install_method"]="$METHOD_APT"
    ["libreoffice_category"]="$CATEGORY_OFFICE_TOOLS"
    ["libreoffice_groups"]="$GROUP_OFFICE $GROUP_ALL"
    ["libreoffice_description"]="Free office suite"
    ["libreoffice_verify_command"]="--version"
    ["libreoffice_launch_command"]="which libreoffice && $USE_SUDO libreoffice"

    # Opera Browser
    ["opera_name"]="Opera"
    ["opera_exec"]="opera"
    ["opera_package_id"]="opera-stable"
    ["opera_install_method"]="$METHOD_APT"
    ["opera_category"]="$CATEGORY_BROWSERS"
    ["opera_groups"]="$GROUP_ALL"
    ["opera_description"]="Opera web browser"
    ["opera_verify_command"]="--version"
    ["opera_launch_command"]="which opera && $USE_SUDO opera --no-sandbox"

    # WhatsApp Messaging
    ["whatsapp_name"]="WhatsApp"
    ["whatsapp_exec"]="whatsapp-for-linux"
    ["whatsapp_package_id"]="whatsapp-for-linux"
    ["whatsapp_install_method"]="$METHOD_SNAP"
    ["whatsapp_category"]="$CATEGORY_COMMUNICATION"
    ["whatsapp_groups"]="$GROUP_COMMUNICATION $GROUP_ALL"
    ["whatsapp_description"]="WhatsApp messaging"
    ["whatsapp_verify_command"]=""
    ["whatsapp_launch_command"]="which whatsapp-for-linux && $USE_SUDO whatsapp-for-linux"
    
    # WeChat Messaging
    ["wechat_name"]="WeChat"
    ["wechat_exec"]="wechat"
    ["wechat_package_id"]="wechat-uos"
    ["wechat_install_method"]="$METHOD_SNAP"
    ["wechat_category"]="$CATEGORY_COMMUNICATION"
    ["wechat_groups"]="$GROUP_COMMUNICATION $GROUP_ALL"
    ["wechat_description"]="WeChat messaging"
    ["wechat_verify_command"]=""
    ["wechat_launch_command"]="which wechat && $USE_SUDO wechat"

    # Hey Mail
    ["hey_mail_name"]="Hey Mail"
    ["hey_mail_exec"]="hey"
    ["hey_mail_package_id"]="https://hey.com/download"
    ["hey_mail_install_method"]="$METHOD_WEB"
    ["hey_mail_category"]="$CATEGORY_COMMUNICATION"
    ["hey_mail_groups"]="$GROUP_COMMUNICATION $GROUP_ALL"
    ["hey_mail_description"]="Hey email client"
    ["hey_mail_verify_command"]=""
    ["hey_mail_launch_command"]="which hey && $USE_SUDO hey"

    # Gemini Desktop
    ["gemini_desktop_name"]="Gemini Desktop"
    ["gemini_desktop_exec"]="gemini"
    ["gemini_desktop_package_id"]="https://gemini.google.com/desktop"
    ["gemini_desktop_install_method"]="$METHOD_WEB"
    ["gemini_desktop_category"]="$CATEGORY_AI_TOOLS"
    ["gemini_desktop_groups"]="$GROUP_ALL"
    ["gemini_desktop_description"]="Google Gemini AI desktop app"
    ["gemini_desktop_verify_command"]=""
    ["gemini_desktop_launch_command"]="which gemini && $USE_SUDO gemini"

    # Copilot Desktop
    ["copilot_desktop_name"]="GitHub Copilot Desktop"
    ["copilot_desktop_exec"]="copilot"
    ["copilot_desktop_package_id"]=""
    ["copilot_desktop_install_method"]=""
    ["copilot_desktop_category"]="$CATEGORY_AI_TOOLS"
    ["copilot_desktop_groups"]="$GROUP_ALL"
    ["copilot_desktop_description"]="GitHub Copilot desktop app"
    ["copilot_desktop_verify_command"]=""
    ["copilot_desktop_launch_command"]=""

    # DeepSeek Desktop
    ["deepseek_desktop_name"]="DeepSeek Desktop"
    ["deepseek_desktop_exec"]="deepseek"
    ["deepseek_desktop_package_id"]=""
    ["deepseek_desktop_install_method"]=""
    ["deepseek_desktop_category"]="$CATEGORY_AI_TOOLS"
    ["deepseek_desktop_groups"]="$GROUP_ALL"
    ["deepseek_desktop_description"]="DeepSeek AI desktop app"
    ["deepseek_desktop_verify_command"]=""
    ["deepseek_desktop_launch_command"]=""
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
    ["gemini_launch_command"]="which gemini && $USE_SUDO gemini"

    # Claude Code
    ["claude_name"]="Anthropic Claude Code"
    ["claude_exec"]="claude"
    ["claude_package_id"]="@anthropic-ai/claude-code"
    ["claude_install_method"]="$METHOD_NPM"
    ["claude_category"]="$CATEGORY_AI_TOOLS"
    ["claude_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["claude_description"]="Anthropic Claude Code - AI-powered coding assistant with advanced reasoning"
    ["claude_verify_command"]="--version"
    ["claude_launch_command"]="which claude && $USE_SUDO claude"

    # OpenAI Codex
    ["codex_name"]="OpenAI Codex"
    ["codex_exec"]="codex"
    ["codex_package_id"]="@openai/codex"
    ["codex_install_method"]="$METHOD_NPM"
    ["codex_category"]="$CATEGORY_AI_TOOLS"
    ["codex_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["codex_description"]="OpenAI Codex - AI system that translates natural language to code"
    ["codex_verify_command"]="--version"
    ["codex_launch_command"]="which codex && $USE_SUDO codex"

    # Cursor Agent
    ["cursor_agent_name"]="Cursor Agent"
    ["cursor_agent_exec"]="cursor"
    ["cursor_agent_package_id"]="https://cursor.com/install"
    ["cursor_agent_install_method"]="$METHOD_CURL"
    ["cursor_agent_category"]="$CATEGORY_AI_TOOLS"
    ["cursor_agent_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["cursor_agent_description"]="Cursor Agent - AI-first code editor with intelligent code completion"
    ["cursor_agent_verify_command"]="--version"
    ["cursor_agent_launch_command"]="which cursor && $USE_SUDO cursor"

    # LangChain CLI
    ["langchain_name"]="LangChain CLI"
    ["langchain_exec"]="langchain"
    ["langchain_package_id"]="langchain-cli"
    ["langchain_install_method"]="$METHOD_PIPX"
    ["langchain_category"]="$CATEGORY_AI_TOOLS"
    ["langchain_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["langchain_description"]="LangChain CLI - Framework for developing applications with language models"
    ["langchain_verify_command"]="--version"
    ["langchain_launch_command"]="which langchain && $USE_SUDO langchain"

    # SuperClaude
    ["superclaude_name"]="SuperClaude Framework"
    ["superclaude_exec"]="superclaude"
    ["superclaude_package_id"]="SuperClaude"
    ["superclaude_install_method"]="$METHOD_UV_TOOL"
    ["superclaude_category"]="$CATEGORY_AI_TOOLS"
    ["superclaude_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["superclaude_description"]="SuperClaude Framework - Extended Claude Code with specialized commands and personas"
    ["superclaude_verify_command"]="--version"
    ["superclaude_launch_command"]="which superclaude && $USE_SUDO superclaude"

    # OpenCode AI
    ["opencode_name"]="OpenCode AI"
    ["opencode_exec"]="opencode"
    ["opencode_package_id"]="https://opencode.ai/install"
    ["opencode_install_method"]="$METHOD_CURL"
    ["opencode_category"]="$CATEGORY_AI_TOOLS"
    ["opencode_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["opencode_description"]="OpenCode AI - AI-powered code generation and development assistant"
    ["opencode_verify_command"]="--version"
    ["opencode_launch_command"]="which opencode && $USE_SUDO opencode"

    # Auggie CLI
    ["auggie_name"]="Augment Code Auggie"
    ["auggie_exec"]="auggie"
    ["auggie_package_id"]="@augmentcode/auggie"
    ["auggie_install_method"]="$METHOD_NPM"
    ["auggie_category"]="$CATEGORY_AI_TOOLS"
    ["auggie_groups"]="$GROUP_MCP_SERVICES $GROUP_ALL"
    ["auggie_description"]="Augment Code Auggie - AI-powered code enhancement and development assistant"
    ["auggie_verify_command"]="--version"
    ["auggie_launch_command"]="which auggie && $USE_SUDO auggie"
)

# Package group lists for iteration
BASE_PACKAGE_LIST=(
    "firefox" "chrome" "vim" "rustdesk" "rust" "ruby" "go" "dotnet" "powershell"
)

DEV_PACKAGE_LIST=(
    "vscode" "cursor" "postman" "termius" "android_studio"
    "intellij" "pycharm" "clion" "sublime" "insomnia" "beekeeper"
    "flutter" "cmake" "code_insiders" "text_editor"
)

APP_PACKAGE_LIST=(
    "libreoffice" "opera" "whatsapp" "wechat" "hey_mail"
    "gemini_desktop" "copilot_desktop" "deepseek_desktop"
)

AI_PACKAGE_LIST=(
    "gemini" "claude" "codex" "cursor_agent" "langchain" "superclaude" "opencode" "auggie"
)

MCP_PACKAGE_LIST=(
    "cunzhi" "alibaba_dataworks" "feedback_enhanced"
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

# Function to get launch command for an application
get_launch_command() {
    local app_name="$1"
    get_app_property "$app_name" "launch_command"
}

# Function to create launch script in /usr/local/bin
create_launch_script() {
    local app_name="$1"
    local launch_command=$(get_launch_command "$app_name")
    local script_name="$app_name"
    local script_path="/usr/local/bin/$script_name"

    # Skip if no launch command
    if [ -z "$launch_command" ]; then
        return 0
    fi

    # Create the launch script
    cat > "/tmp/$script_name" << EOF
#!/bin/bash
# Auto-generated launch script for $app_name
# Generated by linux_applications_list.sh

$launch_command
EOF

    # Move to /usr/local/bin and make executable
    $USE_SUDO mv "/tmp/$script_name" "$script_path"
    $USE_SUDO chmod +x "$script_path"

    echo "Created launch script: $script_path"
}

# Export functions for use by installer scripts
export -f get_package_property get_app_property get_mcp_property
export -f app_in_group mcp_in_group get_apps_by_package_group
export -f get_apps_by_group get_install_method get_package_id
export -f get_launch_command create_launch_script
