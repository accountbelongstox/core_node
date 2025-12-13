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

# PHP Framework Launcher
# Launches standalone PHP applications

# Variable Declarations
APP_PATH="$1"
APP_NAME="$2"
ACTION="${3:-start}"
PORT="${4:-8000}"

# Load network utils
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
source "$SCRIPT_DIR/../utils/network_utils.sh"

# Check parameters
if [ -z "$APP_PATH" ] || [ -z "$APP_NAME" ]; then
    echo "Usage: $0 <app_path> <app_name> [action] [port]"
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_PATH" ]; then
    echo "ERROR: App directory not found: $APP_PATH"
    exit 1
fi

# Check for PHP files
INDEX_PHP="$APP_PATH/index.php"

if [ ! -f "$INDEX_PHP" ]; then
    echo "ERROR: index.php not found in: $APP_PATH"
    exit 1
fi

echo "=== PHP Framework Launcher ==="
echo "App: $APP_NAME"
echo "Path: $APP_PATH"
echo "Action: $ACTION"
echo "Port: $PORT"
echo ""

# Change to app directory
cd "$APP_PATH"

case "$ACTION" in
    "install")
        echo "Installing PHP dependencies..."
        if [ -f "composer.json" ]; then
            composer install
        else
            echo "No composer.json found, skipping dependency installation"
        fi
        ;;
    "start"|"serve")
        echo "Starting PHP development server..."

        # Check if composer dependencies exist, install if not
        if [ -f "composer.json" ] && [ ! -d "vendor" ]; then
            echo "vendor directory not found. Installing dependencies..."
            composer install
            if [ $? -ne 0 ]; then
                echo "Failed to install composer dependencies"
                exit 1
            fi
        fi

        echo "Launching PHP server on 0.0.0.0:$PORT..."
        php -S 0.0.0.0:$PORT -t .

        # Show network addresses after launch attempt
        get_all_ips "$PORT"
        ;;
    "test")
        echo "Running PHP tests..."
        if [ -f "phpunit.xml" ] || [ -f "phpunit.xml.dist" ]; then
            ./vendor/bin/phpunit
        elif command -v phpunit &> /dev/null; then
            phpunit
        else
            echo "No PHPUnit configuration found"
        fi
        ;;
    "lint")
        echo "Linting PHP code..."
        find . -name "*.php" -exec php -l {} \;
        ;;
    "clean")
        echo "Cleaning PHP project..."
        if [ -d "vendor" ]; then
            rm -rf vendor
        fi
        if [ -f "composer.json" ]; then
            composer install
        fi
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Available actions: install, start, serve, test, lint, clean"
        echo "Usage: $0 <app_path> <app_name> [action] [port]"
        exit 1
        ;;
esac

echo ""
echo "PHP launcher finished."