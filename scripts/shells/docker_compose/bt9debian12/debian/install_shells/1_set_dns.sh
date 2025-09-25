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

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$COMMON_SHELLS_DIR/gvar_common.sh"

echo "CLOUD_PROVIDER: $CLOUD_PROVIDER"
echo "ENV_LOCAL: $ENV_LOCAL"

RESOLV_CONF="/etc/resolv.conf"

# Determine desired DNS content
if [ "$CLOUD_PROVIDER" = "tencent" ]; then
    echo "Target DNS: Tencent Cloud (119.29.29.29)"
    DESIRED_DNS="nameserver 119.29.29.29"
elif [ "$CLOUD_PROVIDER" = "aliyun" ]; then
    echo "Target DNS: Aliyun (223.5.5.5, 223.6.6.6)"
    DESIRED_DNS="nameserver 223.5.5.5\nnameserver 223.6.6.6"
elif [ "$ENV_LOCAL" = "cn" ]; then
    echo "Target DNS: China Mainland (180.76.76.76, 114.114.114.114)"
    DESIRED_DNS="nameserver 180.76.76.76\nnameserver 114.114.114.114"
else
    echo "Target DNS: International (8.8.8.8, 8.8.4.4, 1.1.1.1)"
    DESIRED_DNS="nameserver 8.8.8.8\nnameserver 8.8.4.4\nnameserver 1.1.1.1"
fi

# Check if resolv.conf already matches desired DNS
if [ -f "$RESOLV_CONF" ] && diff <(echo -e "$DESIRED_DNS") "$RESOLV_CONF" >/dev/null; then
    echo "DNS already set as desired. Skipping update."
else
    echo "Updating $RESOLV_CONF with new DNS settings."
    ${USE_SUDO} rm -f "$RESOLV_CONF"
    echo -e "$DESIRED_DNS" | ${USE_SUDO} tee "$RESOLV_CONF" >/dev/null
    echo "DNS updated."
fi

echo "Current DNS settings in $RESOLV_CONF:"
cat "$RESOLV_CONF"
