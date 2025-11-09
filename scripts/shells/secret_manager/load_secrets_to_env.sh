#!/usr/bin/env bash

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of functions.
# 6. For Shell (*.sh) scripts: Always use absolute paths, avoid relative paths like "../".
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#=============================================================================
# Load Secrets to Environment Variables
#
# This script loads all secrets from .secret_keys/.secret_ignore/ directory
# and exports them as environment variables
#
# Usage:
#   source scripts/shells/secret_manager/load_secrets_to_env.sh
#   OR
#   . scripts/shells/secret_manager/load_secrets_to_env.sh
#
# Note: Must use 'source' or '.' to export variables to current shell
#=============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SECRET_IGNORE_DIR="$CORE_NODE_DIR/.secret_keys/.secret_ignore"

if [ ! -d "$SECRET_IGNORE_DIR" ]; then
    echo "[LOAD_SECRETS] ERROR: Secret directory not found: $SECRET_IGNORE_DIR" >&2
    return 1
fi

# Count secrets loaded
SECRET_COUNT=0

# Load all secret files as environment variables
while IFS= read -r -d '' secret_file; do
    # Get key name from filename
    KEY_NAME=$(basename "$secret_file")

    # Skip hidden files
    if [[ "$KEY_NAME" == .* ]]; then
        continue
    fi

    # Read secret value (trim whitespace)
    SECRET_VALUE=$(cat "$secret_file" 2>/dev/null | tr -d '\0' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    if [ -n "$SECRET_VALUE" ]; then
        # Export as environment variable
        export "$KEY_NAME=$SECRET_VALUE"
        ((SECRET_COUNT++))
        echo "[LOAD_SECRETS] Loaded: $KEY_NAME" >&2
    fi
done < <(find "$SECRET_IGNORE_DIR" -maxdepth 1 -type f -print0 2>/dev/null)

echo "[LOAD_SECRETS] Successfully loaded $SECRET_COUNT secrets to environment" >&2
return 0
