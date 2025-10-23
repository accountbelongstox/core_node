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

# Deployment Verification Script
# Verifies that deployment was successful

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_TOOLS_DIR="$SCRIPT_DIR/deploy_tools"

# Load safety checker module
if [ -f "$DEPLOY_TOOLS_DIR/safety_checker.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/safety_checker.sh"
else
    echo "ERROR: safety_checker module not found" >&2
    exit 1
fi

# Load environment checker module
if [ -f "$DEPLOY_TOOLS_DIR/environment_checker.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/environment_checker.sh"
else
    echo "ERROR: environment_checker module not found" >&2
    exit 1
fi

# Change to app directory
cd "$APP_DIR" || {
    echo "ERROR: Failed to change to app directory: $APP_DIR" >&2
    exit 1
}

echo "Deployment Verification"
echo "======================="
echo ""

# Run pre-deployment checks
echo "Running pre-deployment checks..."
echo ""

if pre_deployment_check; then
    echo "Pre-deployment checks: PASSED"
else
    echo "Pre-deployment checks: FAILED (some issues found)"
fi

echo ""

# Verify Laravel structure
echo "Verifying Laravel structure..."
echo ""

if verify_laravel_structure; then
    echo "Laravel structure verification: PASSED"
else
    echo "Laravel structure verification: FAILED"
    exit 1
fi

echo ""

# Check disk space
echo "Checking disk space..."
echo ""

if check_disk_space "." 100; then
    echo "Disk space check: PASSED"
else
    echo "Disk space check: WARNING (low disk space)"
fi

echo ""

# Verify critical files and directories
echo "Verifying critical files and directories..."
echo ""

VERIFICATION_ERRORS=0

# Check artisan
if [ -f "artisan" ] && [ -x "artisan" ]; then
    echo "  [OK] artisan file exists and is executable"
else
    echo "  [ERROR] artisan file missing or not executable"
    ((VERIFICATION_ERRORS++))
fi

# Check .env file
if [ -f ".env" ]; then
    echo "  [OK] .env file exists"
else
    echo "  [ERROR] .env file missing"
    ((VERIFICATION_ERRORS++))
fi

# Check vendor directory
if [ -d "vendor" ]; then
    echo "  [OK] vendor directory exists"
else
    echo "  [WARNING] vendor directory missing (dependencies not installed?)"
fi

# Check storage directory
if [ -d "storage" ] && [ -w "storage" ]; then
    echo "  [OK] storage directory exists and is writable"
else
    echo "  [ERROR] storage directory missing or not writable"
    ((VERIFICATION_ERRORS++))
fi

# Check bootstrap/cache directory
if [ -d "bootstrap/cache" ] && [ -w "bootstrap/cache" ]; then
    echo "  [OK] bootstrap/cache directory exists and is writable"
else
    echo "  [ERROR] bootstrap/cache directory missing or not writable"
    ((VERIFICATION_ERRORS++))
fi

# Check initialization marker
if [ -f ".laravel_initialized" ]; then
    echo "  [OK] Initialization marker file found"
else
    echo "  [WARNING] Initialization marker file not found"
fi

echo ""

# Check environment variables
echo "Checking environment variables..."
echo ""

if [ -f ".env" ]; then
    APP_ENV=$(grep "^APP_ENV=" .env 2>/dev/null | cut -d'=' -f2 || echo "not set")
    APP_DEBUG=$(grep "^APP_DEBUG=" .env 2>/dev/null | cut -d'=' -f2 || echo "not set")
    APP_KEY=$(grep "^APP_KEY=" .env 2>/dev/null | cut -d'=' -f2 | cut -c1-20)

    echo "  APP_ENV: $APP_ENV"
    echo "  APP_DEBUG: $APP_DEBUG"
    echo "  APP_KEY: ${APP_KEY}... (truncated)"

    if [ "$APP_ENV" != "not set" ] && [ "$APP_DEBUG" != "not set" ]; then
        echo "  [OK] Environment variables properly configured"
    else
        echo "  [WARNING] Some environment variables not set"
    fi
else
    echo "  [ERROR] .env file not found"
    ((VERIFICATION_ERRORS++))
fi

echo ""

# Final summary
echo "Deployment Verification Summary"
echo "==============================="
echo ""

if [ $VERIFICATION_ERRORS -eq 0 ]; then
    echo "Status: PASSED"
    echo "All critical checks completed successfully."
    echo ""
    echo "Next steps:"
    echo "1. Review the .env file and adjust settings as needed"
    echo "2. For development: Run 'bash quick-deploy.sh development'"
    echo "3. For production: Run 'bash quick-deploy.sh production'"
    exit 0
else
    echo "Status: FAILED"
    echo "Found $VERIFICATION_ERRORS critical issues that need to be resolved."
    echo ""
    echo "Please fix the above issues and try deployment again."
    exit 1
fi
