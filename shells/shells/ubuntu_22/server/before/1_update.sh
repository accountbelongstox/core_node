#!/bin/bash

THU_MIRROR="https://mirrors.tuna.tsinghua.edu.cn/ubuntu/"
UBUNTU_VERSION="jammy"

check_thu_mirror() {
    sudo grep -q "^deb $THU_MIRROR $UBUNTU_VERSION" /etc/apt/sources.list
}

backup_sources() {
    sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak
}

config_thu_mirror() {
    echo "Configuring Tsinghua University mirror..."
    sudo tee /etc/apt/sources.list >/dev/null <<EOF
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy main restricted universe multiverse
# deb-src https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-updates main restricted universe multiverse
# deb-src https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-backports main restricted universe multiverse
# deb-src https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-backports main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-security main restricted universe multiverse
# deb-src https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-security main restricted universe multiverse
EOF
    sudo apt update
    echo "Tsinghua University mirror configured."
}

install_packages_and_configure_git() {
    echo "Installing essential packages..."
    sudo apt install -y lsof cron curl vim git build-essential rsync htop \
    nano wget openssl libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
    xz-utils tk-dev libffi-dev liblzma-dev make software-properties-common cron dnsutils libvips-dev

    sudo git config http.sslVerify "false"

    echo "Essential packages installed."
}

# 主逻辑
if check_thu_mirror; then
    echo "Tsinghua University mirror already configured. Skipping."
else
    backup_sources
    config_thu_mirror
fi

# 更新软件包列表
sudo apt update

# 安装软件包和设置Git配置
install_packages_and_configure_git

echo "Setup completed."
