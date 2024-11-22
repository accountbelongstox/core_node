
#!/bin/bash

#!/bin/bash
# Variables
DOCKER_DATA=$(cat /usr/local/.pcore_local/deploy/.DOCKER_DATA)
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

# Setup aapanel container
AAPANEL_CONTAINER_NAME="aapanel-pre"
AAPANEL_DIR="$DOCKER_DATA/aapanel"
AAPANEL_WWWROOT="$AAPANEL_DIR/www/wwwroot"
if [ -z "$(ls -A "$AAPANEL_DIR" 2>/dev/null)" ]; then
    sudo mkdir -p "$AAPANEL_DIR"
    echo "Creating pre-container for aapanel ..."
    sudo docker run -itd --net=host --name "$AAPANEL_CONTAINER_NAME" aapanel/aapanel:lib
    sudo docker cp "$AAPANEL_CONTAINER_NAME:/www" "$AAPANEL_DIR"
    sudo docker stop "$AAPANEL_CONTAINER_NAME" && docker rm "$AAPANEL_CONTAINER_NAME"
    mount_give "$WEB_DIR" "$AAPANEL_WWWROOT"
    echo "aapanel pre-container created and data copied."
else
    echo "aapanel $AAPANEL_DIR already exists. Skipping pre-container creation."
fi