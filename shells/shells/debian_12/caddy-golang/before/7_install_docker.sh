#!/bin/bash

# Automatically determine the LSB release codename from the system
LSB_RELEASE=$(lsb_release -c | awk '{print $2}')

# Function to install Docker Compose directly from GitHub
install_docker_compose() {
  COMPOSE_REMOTE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"
  COMPOSE_MIRROR_URL="https://ghproxy.com/https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"

  # Try downloading Docker Compose from the remote URL
  sudo curl -k -L "$COMPOSE_REMOTE_URL" -o /usr/bin/docker-compose && sudo chmod +x /usr/bin/docker-compose

  # If the download fails, try using the GitHub mirror
  if [ $? -ne 0 ]; then
    echo "Error: Failed to download Docker Compose from $COMPOSE_REMOTE_URL. Trying the GitHub mirror."
    sudo curl -k -L "$COMPOSE_MIRROR_URL" -o /usr/bin/docker-compose && sudo chmod +x /usr/bin/docker-compose
  fi

  # Check if the download was successful
  if [ $? -eq 0 ]; then
    echo "Docker Compose downloaded and installed successfully."
  else
    echo "Error: Docker Compose installation failed from both the primary and mirror sources."
  fi
}

# Function to install Docker
install_docker() {
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg lsb-release

  sudo mkdir -p /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --yes --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    $LSB_RELEASE stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  sudo apt list -a docker-ce
}

# Check if Docker is installed
if ! which docker &> /dev/null; then
    echo "Docker is not installed."
    install_docker
else
    echo "Docker is already installed."
fi

# Check if Docker Compose is installed
if ! sudo which docker-compose &> /dev/null; then
    echo "Docker Compose is not installed."
    install_docker_compose
else
    echo "Docker Compose is already installed."
fi
