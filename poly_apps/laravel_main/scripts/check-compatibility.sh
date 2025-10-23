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

# Quick Compatibility Check Script - Entry Point for Laravel 12 Compatibility Verification

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_TOOLS_DIR="$SCRIPT_DIR/deploy_tools"

# Load compatibility checker module
if [ -f "$DEPLOY_TOOLS_DIR/compatibility_checker.sh" ]; then
    source "$DEPLOY_TOOLS_DIR/compatibility_checker.sh"
else
    echo "ERROR: compatibility_checker module not found" >&2
    exit 1
fi

# Change to application directory
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR" || {
    echo "ERROR: Failed to change to app directory: $APP_DIR" >&2
    exit 1
}

echo "Laravel 12 Compatibility Check"
echo "=============================="
echo ""
echo "Checking system compatibility with Laravel 12..."
echo "This will verify PHP, Nginx, and project structure."
echo ""

# Run full compatibility check
perform_full_compatibility_check
