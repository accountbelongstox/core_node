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

# Ncore/Pycore/Installer - Unified Installer for ncoreApp and pycoreApp
# This script handles complete installation and initialization
# Usage: ./ncore_pycore_installer.sh <AppName> <AppType> <StartCommand> <WorkingDir> [RootDir]

# Variable Declarations
APP_NAME="$1"
APP_TYPE="$2"
START_COMMAND="$3"
WORKING_DIR="$4"
ROOT_DIR="${5:-}"

# Get script directory and root directory
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
if [ -z "$ROOT_DIR" ]; then
    ROOT_DIR="$(cd "$SCRIPT_PATH/../.." && pwd)"
fi

# Validate parameters
if [ -z "$APP_NAME" ] || [ -z "$APP_TYPE" ] || [ -z "$START_COMMAND" ] || [ -z "$WORKING_DIR" ]; then
    echo "Error: Missing required parameters"
    echo "Usage: $0 <AppName> <AppType> <StartCommand> <WorkingDir> [RootDir]"
    exit 1
fi

if [ "$APP_TYPE" != "ncoreApp" ] && [ "$APP_TYPE" != "pycoreApp" ]; then
    echo "Error: AppType must be 'ncoreApp' or 'pycoreApp'"
    exit 1
fi

# Display banner
echo -e "\033[36m========================================\033[0m"
echo -e "\033[36mNcore/Pycore/Installer - Unified Installation\033[0m"
echo -e "\033[36m========================================\033[0m"
echo -e "\033[37mApp Name: $APP_NAME\033[0m"
echo -e "\033[37mApp Type: $APP_TYPE\033[0m"
echo -e "\033[90mRoot Dir: $ROOT_DIR\033[0m"
echo ""

# Read build_config.ini if exists
READ_CONFIG_SCRIPT="$ROOT_DIR/read_build_config.py"
CONFIG_EXISTS=false
APP_DIR=""
SKIP_PNPM_INSTALL=false
SKIP_PYCORE_INIT=false
CREATE_DESKTOP_SHORTCUT=true

if [ "$APP_TYPE" = "pycoreApp" ]; then
    APP_DIR="$ROOT_DIR/pyapps/$APP_NAME"
elif [ "$APP_TYPE" = "ncoreApp" ]; then
    APP_DIR="$ROOT_DIR/apps/$APP_NAME"
fi

echo -e "\033[90mChecking for build_config.ini...\033[0m"
if [ -f "$READ_CONFIG_SCRIPT" ]; then
    CONFIG_EXISTS_OUTPUT=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "exists" 2>/dev/null)
    if [ "$CONFIG_EXISTS_OUTPUT" = "true" ]; then
        CONFIG_EXISTS=true
        echo -e "\033[32mFound build_config.ini, loading configuration...\033[0m"

        # Read display name and info
        DISPLAY_NAME_CHINESE=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "display_name_chinese" 2>/dev/null)
        DISPLAY_NAME_ENGLISH=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "display_name_english" 2>/dev/null)
        DESCRIPTION=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "description" 2>/dev/null)
        VERSION=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "version" 2>/dev/null)

        # Display config info
        if [ -n "$DISPLAY_NAME_CHINESE" ] && [ -n "$DISPLAY_NAME_ENGLISH" ]; then
            echo -e "\033[36m  Display Name: $DISPLAY_NAME_CHINESE ($DISPLAY_NAME_ENGLISH)\033[0m"
        elif [ -n "$DISPLAY_NAME_ENGLISH" ]; then
            echo -e "\033[36m  Display Name: $DISPLAY_NAME_ENGLISH\033[0m"
        fi
        if [ -n "$DESCRIPTION" ]; then
            echo -e "\033[90m  Description: $DESCRIPTION\033[0m"
        fi
        if [ -n "$VERSION" ]; then
            echo -e "\033[90m  Version: $VERSION\033[0m"
        fi

        # Read installation settings
        SKIP_PNPM_INSTALL=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "skip_pnpm_install" 2>/dev/null)
        SKIP_PYCORE_INIT=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "skip_pycore_init" 2>/dev/null)
        CREATE_DESKTOP_SHORTCUT=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "create_desktop_shortcut" 2>/dev/null)

        # Execute pre-install commands if specified
        PRE_INSTALL_COMMANDS=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "pre_install_commands" 2>/dev/null)
        if [ -n "$PRE_INSTALL_COMMANDS" ]; then
            echo ""
            echo -e "\033[36mExecuting pre-install commands...\033[0m"
            IFS=';' read -ra COMMANDS <<< "$PRE_INSTALL_COMMANDS"
            for cmd in "${COMMANDS[@]}"; do
                cmd=$(echo "$cmd" | xargs)
                if [ -n "$cmd" ]; then
                    echo -e "\033[90m  Running: $cmd\033[0m"
                    eval "$cmd" || echo -e "\033[33m  Warning: Command failed\033[0m"
                fi
            done
            echo -e "\033[32mPre-install commands completed\033[0m"
        fi
    else
        echo -e "\033[33mNo build_config.ini found\033[0m"
        echo -e "\033[33m  Tip: Create build_config.ini in app directory for advanced configuration\033[0m"
        echo -e "\033[33m       You can customize dependencies, startup commands, and more!\033[0m"
    fi
else
    echo -e "\033[33mWarning: read_build_config.py not found, skipping config\033[0m"
fi
echo ""

# Step 0: Check and install Node.js and Python if needed
echo -e "\033[33m[0/5] Checking runtime dependencies...\033[0m"

# Get install scripts paths (relative to script location)
INSTALL_SHELLS_DIR="$SCRIPT_PATH/../linux/debian/install_shells"
PYTHON_INSTALL_SCRIPT="$INSTALL_SHELLS_DIR/13_ensure_python.sh"
NODE_INSTALL_SCRIPT="$INSTALL_SHELLS_DIR/14_install_node_22.sh"

# Check Node.js
NODE_INSTALLED=false
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>/dev/null)
    echo -e "\033[32mNode.js is installed: $NODE_VERSION\033[0m"
    NODE_INSTALLED=true
else
    echo -e "\033[33mNode.js not found\033[0m"
fi

# Check Python
PYTHON_INSTALLED=false
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>/dev/null)
    echo -e "\033[32mPython is installed: $PYTHON_VERSION\033[0m"
    PYTHON_INSTALLED=true
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>/dev/null)
    echo -e "\033[32mPython is installed: $PYTHON_VERSION\033[0m"
    PYTHON_INSTALLED=true
else
    echo -e "\033[33mPython not found\033[0m"
fi

# Install missing runtimes
if [ "$NODE_INSTALLED" = false ] || [ "$PYTHON_INSTALLED" = false ]; then
    echo ""
    echo -e "\033[33mInstalling missing runtimes...\033[0m"

    if [ "$PYTHON_INSTALLED" = false ]; then
        echo -e "\033[90mInstalling Python...\033[0m"
        if [ -f "$PYTHON_INSTALL_SCRIPT" ]; then
            bash "$PYTHON_INSTALL_SCRIPT"
            if [ $? -eq 0 ]; then
                echo -e "\033[32mPython installed successfully\033[0m"
            else
                echo -e "\033[31mWARNING: Python installation failed or incomplete\033[0m"
            fi
        else
            echo -e "\033[31mERROR: Python install script not found: $PYTHON_INSTALL_SCRIPT\033[0m"
            echo -e "\033[33mPlease install Python manually: apt install python3 python3-pip\033[0m"
        fi
    fi

    if [ "$NODE_INSTALLED" = false ]; then
        echo -e "\033[90mInstalling Node.js...\033[0m"
        if [ -f "$NODE_INSTALL_SCRIPT" ]; then
            bash "$NODE_INSTALL_SCRIPT"
            if [ $? -eq 0 ]; then
                echo -e "\033[32mNode.js installed successfully\033[0m"
            else
                echo -e "\033[31mWARNING: Node.js installation failed or incomplete\033[0m"
            fi
        else
            echo -e "\033[31mERROR: Node.js install script not found: $NODE_INSTALL_SCRIPT\033[0m"
            echo -e "\033[33mPlease install Node.js manually: https://nodejs.org/\033[0m"
        fi
    fi

    echo -e "\033[32mRuntime installation complete\033[0m"
fi
echo ""

# Step 1: Update pnpm itself
echo -e "\033[33m[1/5] Updating pnpm globally...\033[0m"
echo -e "\033[90mRunning: pnpm add -g pnpm\033[0m"
pnpm add -g pnpm
if [ $? -eq 0 ]; then
    echo -e "\033[32mpnpm updated successfully\033[0m"
else
    echo -e "\033[33mWarning: Failed to update pnpm (exit code: $?), continuing...\033[0m"
fi
echo ""

# Step 2: Check if node_modules exists
echo -e "\033[33m[2/5] Checking Node.js dependencies...\033[0m"

# Check if pnpm install should be skipped from config
if [ "$SKIP_PNPM_INSTALL" = "true" ]; then
    echo -e "\033[33mSkipping pnpm install (configured in build_config.ini)\033[0m"
    echo ""
else
    NODE_MODULES_PATH="$ROOT_DIR/node_modules"
    if [ -d "$NODE_MODULES_PATH" ]; then
        echo -e "\033[32mnode_modules exists, skipping pnpm install\033[0m"
        echo ""
    else
        # Step 3: Install Node.js dependencies
        echo -e "\033[90mnode_modules not found, installing...\033[0m"
        echo -e "\033[90mRunning: pnpm install\033[0m"
        cd "$ROOT_DIR"
        pnpm install
        if [ $? -ne 0 ]; then
            echo ""
            echo -e "\033[31mNode.js installation failed! Check the error messages above.\033[0m"
            echo ""
            read -p "Press Enter to exit..."
            exit 1
        fi
        echo -e "\033[32mNode.js dependencies installed successfully\033[0m"
        echo ""
    fi
fi

# Step 4: Initialize pycore (Python dependencies)
echo -e "\033[33m[3/5] Initializing pycore (Python dependencies)...\033[0m"

# Check if pycore init should be skipped from config
if [ "$SKIP_PYCORE_INIT" = "true" ]; then
    echo -e "\033[33mSkipping pycore initialization (configured in build_config.ini)\033[0m"
    echo ""
else
    PYCORE_INIT_SCRIPT="$ROOT_DIR/pycore_init.py"
    echo -e "\033[90mRunning: python \"$PYCORE_INIT_SCRIPT\"\033[0m"
    echo ""
    python "$PYCORE_INIT_SCRIPT"
    EXIT_CODE=$?
    echo ""
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "\033[32mpycore initialized successfully\033[0m"
    else
        echo -e "\033[33mWarning: pycore initialization completed with warnings (exit code: $EXIT_CODE)\033[0m"
    fi
    echo ""
fi

# Step 5: Create desktop shortcut
echo -e "\033[33m[4/5] Creating desktop shortcut...\033[0m"

# Check if desktop shortcut should be created from config
if [ "$CREATE_DESKTOP_SHORTCUT" = "false" ]; then
    echo -e "\033[33mSkipping desktop shortcut creation (configured in build_config.ini)\033[0m"
    echo ""
else
    DESKTOP_DIR="$HOME/Desktop"
    if [ ! -d "$DESKTOP_DIR" ]; then
        DESKTOP_DIR="$HOME/Bureau"  # French desktop name
    fi

    if [ -d "$DESKTOP_DIR" ]; then
        # Use display name from config if available
        SHORTCUT_NAME="$APP_NAME"
        if [ -n "$DISPLAY_NAME_CHINESE" ]; then
            SHORTCUT_NAME="$DISPLAY_NAME_CHINESE"
        fi

        # Use description from config if available
        SHORTCUT_DESC="Launch $APP_NAME via Ncore/Pycore/Installer"
        if [ -n "$DESCRIPTION" ]; then
            SHORTCUT_DESC="$DESCRIPTION"
        fi

        SHORTCUT_PATH="$DESKTOP_DIR/$SHORTCUT_NAME.desktop"
        cat > "$SHORTCUT_PATH" << EOF
[Desktop Entry]
Type=Application
Name=$SHORTCUT_NAME
Comment=$SHORTCUT_DESC
Exec=bash "$SCRIPT_PATH/ncore_pycore_installer.sh" "$APP_NAME" "$APP_TYPE" "$START_COMMAND" "$WORKING_DIR" "$ROOT_DIR"
Path=$WORKING_DIR
Terminal=true
Categories=Development;
EOF
        chmod +x "$SHORTCUT_PATH"
        echo -e "\033[32mDesktop shortcut created: $SHORTCUT_PATH\033[0m"
    else
        echo -e "\033[33mWarning: Desktop directory not found, skipping shortcut creation\033[0m"
    fi
    echo ""
fi

# Execute post-install commands if specified
if [ "$CONFIG_EXISTS" = true ]; then
    POST_INSTALL_COMMANDS=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "post_install_commands" 2>/dev/null)
    if [ -n "$POST_INSTALL_COMMANDS" ]; then
        echo -e "\033[36mExecuting post-install commands...\033[0m"
        IFS=';' read -ra COMMANDS <<< "$POST_INSTALL_COMMANDS"
        for cmd in "${COMMANDS[@]}"; do
            cmd=$(echo "$cmd" | xargs)
            if [ -n "$cmd" ]; then
                echo -e "\033[90m  Running: $cmd\033[0m"
                eval "$cmd" || echo -e "\033[33m  Warning: Command failed\033[0m"
            fi
        done
        echo -e "\033[32mPost-install commands completed\033[0m"
        echo ""
    fi
fi

# Display installation complete
echo -e "\033[32m========================================\033[0m"
echo -e "\033[32mInstallation Complete!\033[0m"
echo -e "\033[32m========================================\033[0m"
echo ""

# Step 6: Start application
echo -e "\033[33m[5/5] Starting $APP_NAME...\033[0m"
echo -e "\033[36m========================================\033[0m"

# Check for custom startup command and working directory from config
FINAL_START_COMMAND="$START_COMMAND"
FINAL_WORKING_DIR="$WORKING_DIR"

if [ "$CONFIG_EXISTS" = true ]; then
    # Check for custom startup command
    CUSTOM_COMMAND=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "startup_command" 2>/dev/null)
    if [ -n "$CUSTOM_COMMAND" ]; then
        FINAL_START_COMMAND="$CUSTOM_COMMAND"
        echo -e "\033[36mUsing custom startup command from config\033[0m"
    fi

    # Check for custom working directory (Note: requires reading JSON, simplified here)
    # For bash, we'll just use the default unless explicitly set in a simple field

    # Set environment variables from config
    # Read environment section from JSON (simplified - reads key=value pairs)
    ENV_VARS=$(python "$READ_CONFIG_SCRIPT" "$APP_DIR" "all" 2>/dev/null | python -c "
import sys, json
try:
    data = json.load(sys.stdin)
    env_vars = data.get('startup', {}).get('environment', {})
    for key, value in env_vars.items():
        print(f'{key}={value}')
except:
    pass
" 2>/dev/null)

    if [ -n "$ENV_VARS" ]; then
        echo -e "\033[36mSetting environment variables from config...\033[0m"
        while IFS='=' read -r key value; do
            if [ -n "$key" ] && [ -n "$value" ]; then
                export "$key=$value"
                echo -e "\033[90m  $key = $value\033[0m"
            fi
        done <<< "$ENV_VARS"
    fi
fi

echo -e "\033[90mWorking Directory: $FINAL_WORKING_DIR\033[0m"
echo -e "\033[90mCommand: $FINAL_START_COMMAND\033[0m"
echo ""

cd "$FINAL_WORKING_DIR"
eval "$FINAL_START_COMMAND"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -ne 0 ]; then
    echo -e "\033[31mApplication exited with error code: $EXIT_CODE\033[0m"
    echo ""
fi

read -p "Press Enter to exit..."
