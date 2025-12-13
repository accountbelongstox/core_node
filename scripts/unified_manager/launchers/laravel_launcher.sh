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

# Laravel Framework Launcher
# Launches Laravel applications with composer and PHP

# Variable Declarations
APP_PATH="$1"
APP_NAME="$2"
ACTION="${3:-start}"

# Check parameters
if [ -z "$APP_PATH" ] || [ -z "$APP_NAME" ]; then
    echo "Usage: $0 <app_path> <app_name> [action]"
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_PATH" ]; then
    echo "ERROR: App directory not found: $APP_PATH"
    exit 1
fi

# Check for Laravel files
COMPOSER_JSON="$APP_PATH/composer.json"
ARTISAN="$APP_PATH/artisan"
PUBLIC_INDEX="$APP_PATH/public/index.php"

if [ ! -f "$COMPOSER_JSON" ]; then
    echo "ERROR: composer.json not found in: $APP_PATH"
    exit 1
fi

if [ ! -f "$ARTISAN" ]; then
    echo "ERROR: artisan file not found in: $APP_PATH"
    exit 1
fi

if [ ! -f "$PUBLIC_INDEX" ]; then
    echo "ERROR: public/index.php not found in: $APP_PATH"
    exit 1
fi

echo "=== Laravel Framework Launcher ==="
echo "App: $APP_NAME"
echo "Path: $APP_PATH"
echo "Action: $ACTION"
echo ""

# Change to app directory
cd "$APP_PATH"

case "$ACTION" in
    "install")
        echo "Installing dependencies with composer..."
        composer install
        # Also install npm dependencies if package.json exists
        if [ -f "package.json" ]; then
            echo "Installing frontend dependencies with pnpm..."
            pnpm install
        fi
        ;;
    "start"|"serve")
        echo "Starting Laravel development server..."
        php artisan serve
        ;;
    "build")
        echo "Building Laravel application..."
        # Install composer dependencies
        composer install --optimize-autoloader --no-dev
        # Build frontend assets if package.json exists
        if [ -f "package.json" ]; then
            pnpm install
            pnpm run build
        fi
        ;;
    "migrate")
        echo "Running Laravel migrations..."
        php artisan migrate
        ;;
    "seed")
        echo "Running database seeders..."
        php artisan db:seed
        ;;
    "fresh")
        echo "Fresh migration with seeding..."
        php artisan migrate:fresh --seed
        ;;
    "test")
        echo "Running Laravel tests..."
        php artisan test
        ;;
    "clean")
        echo "Cleaning Laravel cache and dependencies..."
        php artisan cache:clear
        php artisan config:clear
        php artisan route:clear
        php artisan view:clear
        rm -rf vendor node_modules
        composer install
        if [ -f "package.json" ]; then
            pnpm install
        fi
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Available actions: install, start, serve, build, migrate, seed, fresh, test, clean"
        exit 1
        ;;
esac

echo ""
echo "Laravel launcher finished."