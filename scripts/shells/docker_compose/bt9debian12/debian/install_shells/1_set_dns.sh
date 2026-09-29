#!/bin/bash
SCRIPT_INDEX="1"

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"

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
