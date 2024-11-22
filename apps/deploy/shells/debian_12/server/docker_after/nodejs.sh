#!/bin/bash
container_name="$1"

# Function to copy pm2 config
copy_pm2_config() {
    ecosystem_config="${PARENT_DIR}/template/pm2/ecosystem.config.js"
    if [ -f "$ecosystem_config" ]; then
        echo "Ecosystem configuration file found: $ecosystem_config"
        if [ -d "$WEB_DIR" ]; then
            target_config="$WEB_DIR/ecosystem.config.js"
            if [ ! -f "$target_config" ]; then
                sudo cp "$ecosystem_config" "$target_config"
                echo "Ecosystem configuration copied to $WEB_DIR"
            else
                echo "Ecosystem configuration already exists in $WEB_DIR"
            fi
        else
            echo "Web directory does not exist: $WEB_DIR"
        fi
    else
        echo "Ecosystem configuration file not found: $ecosystem_config"
    fi
}

# Step 1: Enter the Docker container named 'node18'

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

packages="cnpm yarn pnpm electron strapi pm2"
echo "$container_name found. Installing $packages..."
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

echo "Installing $packages globally..."
echo "Executing command: sudo docker exec -it $container_name npm install -g $packages"
sudo docker exec -it $container_name npm install -g $packages

echo "All packages installed successfully."




