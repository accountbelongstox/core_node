#!/bin/bash
TMP_INFO_DIR="/usr/local/.pcore_local/deploy"
LSB_RELEASE=$(cat "$TMP_INFO_DIR/.LSB_RELEASE")
DEPLOY_DIR=$(cat "$TMP_INFO_DIR/.DEPLOY_DIR")

install_docker_compose() {
  COMPOSE_REMOTE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"
  COMPOSE_LOCAL_PATH="$DEPLOY_DIR/library/docker/docker-compose-linux-x86_64"
  sudo curl -k -L "$COMPOSE_REMOTE_URL" -o /usr/bin/docker-compose && sudo chmod +x /usr/bin/docker-compose
  if [ $? -eq 0 ]; then
    echo "Docker Compose downloaded from $COMPOSE_REMOTE_URL."
  else
    if [ -e "$COMPOSE_LOCAL_PATH" ]; then
      echo "Downloading from $COMPOSE_REMOTE_URL failed. Installing from $COMPOSE_LOCAL_PATH..."
      sudo cp "$COMPOSE_LOCAL_PATH" /usr/bin/docker-compose
      sudo chmod +x /usr/bin/docker-compose
      docker-compose --version
    else
      echo "Error: Docker Compose download failed and binary not found at $COMPOSE_LOCAL_PATH. Unable to install."
    fi
  fi
}

install_docker() {
    echo "Docker is not installed. Installing..."

    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release

    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    sudo apt list -a docker-ce
}

if ! command -v docker &> /dev/null; then
    echo "Docker is not installed."
    install_docker
else
    echo "Docker is already installed."
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed."
    install_docker_compose
else
    echo "Docker Compose is already installed."
fi
