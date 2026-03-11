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

# DEPRECATED: This entry and the Python-based Unified App Manager are deprecated.
# Use the native multi-file implementations instead:
#   Linux:  scripts/app_manager/linux_sh/app_manager.sh
#   Windows: scripts/app_manager/windows_ps1/app_manager.ps1
# dd.sh and dd.ps1 already point to the new scripts; this file is kept for backward compatibility.

# Unified App Manager - Cross-Platform Entry Point
# Detects platform and launches appropriate implementation

# Variable declarations
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
LINUX_SCRIPT="$SCRIPT_PATH/unified_manager_linux.sh"
WINDOWS_SCRIPT="$SCRIPT_PATH/unified_manager_windows.ps1"

# Detect platform
detect_platform() {
    case "$(uname -s)" in
        Linux*)
            echo "linux"
            ;;
        MINGW*|CYGWIN*|MSYS*)
            echo "windows"
            ;;
        Darwin*)
            echo "macos"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Main execution
main() {
    local platform=$(detect_platform)

    echo "Unified App Manager >16 (Python Core)"
    echo "Platform detected: $platform"
    echo ""

    case "$platform" in
        "linux")
            if [[ -f "$LINUX_SCRIPT" ]]; then
                chmod +x "$LINUX_SCRIPT"
                exec "$LINUX_SCRIPT" "$@"
            else
                echo "Error: Linux script not found: $LINUX_SCRIPT"
                exit 1
            fi
            ;;

        "windows")
            if [[ -f "$WINDOWS_SCRIPT" ]]; then
                if command -v powershell >/dev/null 2>&1; then
                    exec powershell -ExecutionPolicy Bypass -File "$WINDOWS_SCRIPT" "$@"
                elif command -v pwsh >/dev/null 2>&1; then
                    exec pwsh -ExecutionPolicy Bypass -File "$WINDOWS_SCRIPT" "$@"
                else
                    echo "Error: PowerShell not found"
                    exit 1
                fi
            else
                echo "Error: Windows script not found: $WINDOWS_SCRIPT"
                exit 1
            fi
            ;;

        "macos")
            echo "macOS support coming soon - using Linux implementation for now"
            if [[ -f "$LINUX_SCRIPT" ]]; then
                chmod +x "$LINUX_SCRIPT"
                exec "$LINUX_SCRIPT" "$@"
            else
                echo "Error: Linux script not found: $LINUX_SCRIPT"
                exit 1
            fi
            ;;

        *)
            echo "Error: Unsupported platform: $platform"
            echo "Supported platforms: Linux, Windows, macOS"
            exit 1
            ;;
    esac
}

# Start program
main "$@"