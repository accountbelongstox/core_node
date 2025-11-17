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

# Quick Deploy Script - Simple wrapper for deploy.sh
# Usage: bash quick-deploy.sh [production|development]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/deploy.sh"

echo "Laravel Main Quick Deploy"
echo "========================"
echo ""

if [ ! -f "$DEPLOY_SCRIPT" ]; then
    echo "ERROR: deploy.sh not found at $DEPLOY_SCRIPT" >&2
    exit 1
fi

# Determine deployment mode from argument or default
MODE="${1:-development}"

case "$MODE" in
    production)
        echo "Mode: PRODUCTION"
        export DEPLOY_MODE="production"
        ;;
    development)
        echo "Mode: DEVELOPMENT"
        export DEPLOY_MODE="development"
        ;;
    *)
        echo "ERROR: Invalid mode '$MODE'. Use 'production' or 'development'" >&2
        exit 1
        ;;
esac

echo ""
echo "Starting deployment with mode: $DEPLOY_MODE"
echo ""

# Run deployment script
bash "$DEPLOY_SCRIPT"
