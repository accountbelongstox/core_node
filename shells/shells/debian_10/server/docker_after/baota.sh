#!/bin/bash

# Variables
DOCKER_DATA=$(cat /usr/local/.pcore_local/deploy/.DOCKER_DATA)
BT_IMAGE=$(cat /usr/local/.pcore_local/deploy/.BT_IMAGE)
BT_USER=$(cat /usr/local/.pcore_local/deploy/.BT_USER)
BT_PWD=$(cat /usr/local/.pcore_local/deploy/.BT_PWD)
WEB_DIR=$(cat /usr/local/.pcore_local/deploy/.WEB_DIR)

# Function for mounting
mount_give() {
    src_dir=$1
    target_dir=$2
    if [ ! -d "$target_dir" ]; then
        echo "Target directory $target_dir does not exist, creating it..."
        sudo mkdir -p "$target_dir"
    fi
    if mount | grep -q "$target_dir"; then
        echo "Target directory $target_dir is already mounted"
    else
        echo "Binding $src_dir contents to $target_dir"
        sudo mount --bind "$src_dir" "$target_dir"
    fi
    echo "Source directory contents: $src_dir"
    echo "Target directory: $target_dir"
    fstab_entry="$src_dir $target_dir none bind 0 0"
    if grep -q "$src_dir" /etc/fstab; then
        echo "Mount entry already exists in /etc/fstab"
    else
        echo $fstab_entry | sudo tee -a /etc/fstab
        echo "Mount entry added to /etc/fstab"
    fi
}

# Setup Baota container
BAOTA_CONTAINER_NAME="baota-pre"
BAOTA_PORT=26756
BAOTA_DIR="$DOCKER_DATA/baota"
BAOTA_WWWROOT="$BAOTA_DIR/www/wwwroot"
if [ ! -d "$BAOTA_DIR" ] || [ -z "$(ls -A "$BAOTA_DIR")" ]; then
    sudo mkdir -p "$BAOTA_DIR"
    echo "Creating pre-container for Baota..."
    docker_run_command="sudo docker run -itd --net=host --name $BAOTA_CONTAINER_NAME $BT_IMAGE -port $BAOTA_PORT -username $BT_USER -password $BT_PWD"
    echo "Running command: $docker_run_command"
    $docker_run_command
    echo "Baota pre-container created."
    echo "Copying data from Baota container..."
    sudo docker cp "$BAOTA_CONTAINER_NAME:/www" "$BAOTA_DIR"
    echo "Data copied from Baota container."
    echo "Stopping and removing Baota container..."
    sudo docker stop "$BAOTA_CONTAINER_NAME" && docker rm "$BAOTA_CONTAINER_NAME"
    echo "Baota container stopped and removed."
    echo "Mounting directories..."
    mount_give "$WEB_DIR" "$BAOTA_WWWROOT"
    echo "Directories mounted."
    echo "Baota pre-container created and data copied."
else
    echo "Baota $BAOTA_DIR already exists. Skipping pre-container creation."
fi