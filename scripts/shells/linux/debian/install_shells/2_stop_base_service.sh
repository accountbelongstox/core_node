#!/bin/bash
n# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

if systemctl list-units --full -all | grep -Fq "exim4.service"; then
    echo "exim4.service exists, stopping the service..."
    $USE_SUDO systemctl stop exim4.service
else
    echo "exim4.service does not exist, skipping."
fi

if systemctl list-units --full -all | grep -Fq "postfix.service"; then
    echo "postfix.service exists, stopping the service..."
    $USE_SUDO systemctl stop postfix.service
else
    echo "postfix.service does not exist, skipping."
fi

if systemctl list-units --full -all | grep -Fq "exim4.service"; then
    echo "exim4.service exists, disabling the service..."
    $USE_SUDO systemctl disable exim4.service
else
    echo "exim4.service does not exist, skipping."
fi

if systemctl list-units --full -all | grep -Fq "postfix.service"; then
    echo "postfix.service exists, disabling the service..."
    $USE_SUDO systemctl disable postfix.service
else
    echo "postfix.service does not exist, skipping."
fi

if [ -x "$(command -v service)" ]; then
    if [ -f "/etc/init.d/exim4" ]; then
        echo "exim4.service exists, stopping the service..."
        service exim4 stop
    else
        echo "exim4.service does not exist, skipping."
    fi
else
    echo "The 'service' command is not available. Please use alternative methods suitable for your container."
fi

if [ -x "$(command -v service)" ]; then
    if [ -f "/etc/init.d/postfix" ]; then
        echo "postfix.service exists, stopping the service..."
        service postfix stop
    else
        echo "postfix.service does not exist, skipping."
    fi
else
    echo "The 'service' command is not available. Please use alternative methods suitable for your container."
fi
