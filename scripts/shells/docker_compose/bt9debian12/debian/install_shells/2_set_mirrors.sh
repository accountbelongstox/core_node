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
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"
if [ -f /etc/environment ]; then
    set -a
    source /etc/environment
    set +a
fi

if [ -n "$ENV_LOCAL" ]; then
    ENV_LOCAL="$ENV_LOCAL"
else
    ENV_LOCAL=$(get_var "ENV_LOCAL")
    if [ -z "$ENV_LOCAL" ]; then
        ENV_LOCAL="cn"
    fi
fi
CLOUD_PROVIDER=${CLOUD_PROVIDER:-$(get_var "CLOUD_PROVIDER")}
# Path to the sources.list file
TARGET_SOURCES_LIST="/etc/apt/sources.list"

# Determine if a custom mirror will be set
SET_MIRROR=false

# Print current environment variables
echo "CLOUD_PROVIDER: $CLOUD_PROVIDER"
echo "ENV_LOCAL: $ENV_LOCAL"

echo -n "Mirror to be set: "
if [ "$CLOUD_PROVIDER" = "tencent" ]; then
    SET_MIRROR=true
    echo "Tencent Cloud"
    cat >"$TARGET_SOURCES_LIST" <<EOF
deb http://mirrors.tencent.com/debian bookworm main contrib non-free non-free-firmware
#deb-src http://mirrors.tencent.com/debian bookworm main contrib non-free non-free-firmware
deb http://mirrors.tencent.com/debian bookworm-updates main contrib non-free non-free-firmware
#deb-src http://mirrors.tencent.com/debian bookworm-updates main contrib non-free non-free-firmware
deb http://mirrors.tencent.com/debian-security bookworm-security main contrib non-free non-free-firmware
#deb-src http://mirrors.tencent.com/debian-security bookworm-security main contrib non-free non-free-firmware
#deb http://mirrors.tencent.com/debian bookworm-backports main contrib non-free non-free-firmware
#deb-src http://mirrors.tencent.com/debian bookworm-backports main contrib non-free non-free-firmware
#deb http://mirrors.tencent.com/debian bookworm-proposed-updates main contrib non-free non-free-firmware
#deb-src http://mirrors.tencent.com/debian bookworm-proposed-updates main contrib non-free non-free-firmware
EOF
    echo "Tencent Cloud Debian 12 mirrors set."

elif [ "$CLOUD_PROVIDER" = "huawei" ]; then
    SET_MIRROR=true
    echo "Huawei Cloud"
    cat >"$TARGET_SOURCES_LIST" <<EOF
deb http://mirrors.huaweicloud.com/debian bookworm main contrib non-free non-free-firmware
#deb-src http://mirrors.huaweicloud.com/debian bookworm main contrib non-free non-free-firmware
deb http://mirrors.huaweicloud.com/debian bookworm-updates main contrib non-free non-free-firmware
#deb-src http://mirrors.huaweicloud.com/debian bookworm-updates main contrib non-free non-free-firmware
deb http://mirrors.huaweicloud.com/debian-security bookworm-security main contrib non-free non-free-firmware
#deb-src http://mirrors.huaweicloud.com/debian-security bookworm-security main contrib non-free non-free-firmware
EOF

elif [ "$CLOUD_PROVIDER" = "aliyun" ]; then
    SET_MIRROR=true
    echo "Aliyun Cloud"
    cat >"$TARGET_SOURCES_LIST" <<EOF
deb https://mirrors.aliyun.com/debian/ bookworm main non-free contrib
deb-src https://mirrors.aliyun.com/debian/ bookworm main non-free contrib
deb https://mirrors.aliyun.com/debian-security/ bookworm-security main
deb-src https://mirrors.aliyun.com/debian-security/ bookworm-security main
deb https://mirrors.aliyun.com/debian/ bookworm-updates main non-free contrib
deb-src https://mirrors.aliyun.com/debian/ bookworm-updates main non-free contrib
deb https://mirrors.aliyun.com/debian/ bookworm-backports main non-free contrib
deb-src https://mirrors.aliyun.com/debian/ bookworm-backports main non-free contrib
EOF
    echo "Aliyun Debian 12 mirrors set."

elif { [ -z "$CLOUD_PROVIDER" ] || [[ ! "$CLOUD_PROVIDER" =~ ^(tencent|huawei|aliyun)$ ]]; } && [ "$ENV_LOCAL" = "cn" ]; then
    SET_MIRROR=true
    echo "TUNA (Tsinghua University)"
    cat >"$TARGET_SOURCES_LIST" <<EOF
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free non-free-firmware
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free non-free-firmware
deb https://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware
#deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-backports main contrib non-free non-free-firmware
EOF
    echo "TUNA (Tsinghua University) Debian 12 mirrors set."
else
    echo "Default (no change)"
fi

# Only remove sources.list.d files if a custom mirror was set
if [ "$SET_MIRROR" = true ]; then
    apt-get install -y apt-transport-https ca-certificates
    rm -rf /etc/apt/sources.list.d/debian.sources \
        /etc/apt/sources.list.d/debian-security.sources \
        /etc/apt/sources.list.d/debian-backports.sources
    echo "Removed additional sources files."
fi

# Function to clean apt cache and update/upgrade
apt_clean_update_upgrade() {
    echo "Cleaning apt cache and updating/upgrading packages..."
    apt clean && apt update && apt upgrade -y
}

# Call the function
apt_clean_update_upgrade
