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

# Nuxt Framework Launcher
# Launches Nuxt applications with pnpm support

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

# Check for Nuxt config
NUXT_CONFIG_TS="$APP_PATH/nuxt.config.ts"
NUXT_CONFIG_JS="$APP_PATH/nuxt.config.js"
PACKAGE_JSON="$APP_PATH/package.json"

if [ ! -f "$NUXT_CONFIG_TS" ] && [ ! -f "$NUXT_CONFIG_JS" ]; then
    echo "ERROR: Nuxt config file not found in: $APP_PATH"
    exit 1
fi

if [ ! -f "$PACKAGE_JSON" ]; then
    echo "ERROR: package.json not found in: $APP_PATH"
    exit 1
fi

echo "=== Nuxt Framework Launcher ==="
echo "App: $APP_NAME"
echo "Path: $APP_PATH"
echo "Action: $ACTION"
echo ""

# Change to app directory
cd "$APP_PATH"

case "$ACTION" in
    "install")
        echo "Installing dependencies with pnpm..."
        pnpm install
        ;;
    "start"|"dev")
        echo "Starting Nuxt development server..."
        pnpm run dev
        ;;
    "build")
        echo "Building Nuxt application..."
        pnpm run build
        ;;
    "generate")
        echo "Generating static site..."
        pnpm run generate
        ;;
    "preview")
        echo "Previewing built application..."
        pnpm run preview
        ;;
    "test")
        echo "Running tests..."
        if grep -q '"test"' "$PACKAGE_JSON" 2>/dev/null; then
            pnpm test
        else
            echo "No test script found in package.json"
        fi
        ;;
    "clean")
        echo "Cleaning dependencies and .nuxt directory..."
        rm -rf node_modules package-lock.json .nuxt .output
        pnpm install
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Available actions: install, start, dev, build, generate, preview, test, clean"
        exit 1
        ;;
esac

echo ""
echo "Nuxt launcher finished."