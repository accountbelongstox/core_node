#!/bin/bash

# Step 1: Enter the Docker container named 'node18'
container_name="node18"

# Function to check if the container is running
is_container_running() {
  sudo docker inspect -f '{{.State.Running}}' $container_name 2>/dev/null
}

# Function to check if the container is restarting
is_container_restarting() {
  sudo docker inspect -f '{{.State.Restarting}}' $container_name 2>/dev/null
}

# Check if the container is running
container_status=$(is_container_running)

if [ "$container_status" != "true" ]; then
  echo "Container $container_name is not running. Starting it now..."
  echo "Executing command: sudo docker start $container_name"
  sudo docker start $container_name
fi

# Wait until the container is running or restarting
while [ "$(is_container_running)" != "true" ] && [ "$(is_container_restarting)" == "true" ]; do
  echo "Waiting for the container $container_name to be fully up and running..."
  sleep 5
done

echo "Container $container_name is running."

# Step 2: Check if npm is set to the Huawei source
huawei_registry="https://mirrors.huaweicloud.com/repository/npm/"

# Check npm registry
echo "Executing command: sudo docker exec -it $container_name npm config get registry | tr -d '\r'"
current_registry=$(sudo docker exec -it $container_name npm config get registry | tr -d '\r')

if [ "$current_registry" != "$huawei_registry" ]; then
  echo "Npm is not set to Huawei registry. Setting it now."
  echo "Executing command: sudo docker exec -it $container_name npm config set registry $huawei_registry"
  sudo docker exec -it $container_name npm config set registry $huawei_registry
else
  echo "Npm is already set to Huawei registry."
fi

# Step 3: Globally install the required packages
packages="cnpm yarn pnpm electron strapi pm2"

echo "Installing $packages globally..."
echo "Executing command: sudo docker exec -it $container_name npm install -g $packages"
sudo docker exec -it $container_name npm install -g $packages

echo "All packages installed successfully."
