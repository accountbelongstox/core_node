#!/bin/bash
# Include common functions
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

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
if [ -f /etc/environment ]; then
    set -a
    source /etc/environment
    set +a
fi

# Journal cleanup cron job
JOURNAL_CLEAN_CRON="0 3 * * * /usr/bin/journalctl --vacuum-size=100M"

echo "Setting up automatic journal cleanup..."

# Check if the cron job already exists in sudo crontab
if sudo crontab -l 2>/dev/null | grep -q "journalctl --vacuum-size=100M"; then
    echo "Journal cleanup cron job already exists in sudo crontab. Skipping..."
    echo "Status: Already configured"
else
    echo "Adding journal cleanup cron job to sudo crontab..."
    
    # Get current sudo crontab content
    CURRENT_CRONTAB=$(sudo crontab -l 2>/dev/null || echo "")
    
    # Add the new cron job
    if [ -n "$CURRENT_CRONTAB" ]; then
        # Append to existing crontab
        (echo "$CURRENT_CRONTAB"; echo "$JOURNAL_CLEAN_CRON") | sudo crontab -
    else
        # Create new crontab with only this job
        echo "$JOURNAL_CLEAN_CRON" | sudo crontab -
    fi
    
    echo "Journal cleanup cron job added successfully."
    echo "Status: Configured"
fi

# Verify the cron job is active
echo ""
echo "Verifying cron job configuration..."
if sudo crontab -l 2>/dev/null | grep -q "journalctl --vacuum-size=100M"; then
    echo "[OK] Journal cleanup cron job is active"
    echo "  Schedule: Daily at 3:00 AM"
    echo "  Action: Clean journal logs to 100M size limit"
    echo "  Command: /usr/bin/journalctl --vacuum-size=100M"
else
    echo "[ERROR] Journal cleanup cron job is not active"
    echo "Status: Failed to configure"
    exit 1
fi

echo ""
echo "Journal cleanup setup completed successfully."
