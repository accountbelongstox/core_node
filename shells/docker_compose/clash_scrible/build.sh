#!/bin/bash
# 1. Initialize variables
DOCKER_USERNAME="cy00000000x"
FROM_IMAGE_NAME="docker.io/cy00000000x/nodebase:20"
CONTAINER_NAME="clash_subscribe"
IMAGE_NAME="${CONTAINER_NAME}_image"
SUBCONVERTER_IMAGE="tindy2013/subconverter:latest"
PORT_MAPPING="-p 18100:18100 -p 18200:18200"
DATA_CACHE_DIR="/home/clash_subscribe_data/.data_cache"
DATA_VOLUME_MAPPING="${DATA_CACHE_DIR}:/usr/src/app/.data_cache"
LOCAL_REGISTRY="192.168.100.6:15000"

echo "Pulling the latest version of $FROM_IMAGE_NAME..."
docker pull "$FROM_IMAGE_NAME"

# Ensure the data cache directory exists
if [ ! -d "$DATA_CACHE_DIR" ]; then
    echo "Creating directory: $DATA_CACHE_DIR"
    mkdir -p "$DATA_CACHE_DIR"
else
    echo "Directory already exists: $DATA_CACHE_DIR"
fi


# 2. System detection and preparation
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS=$(uname -s)
fi

if [ "$OS" == "openwrt" ]; then
    modprobe iptable_nat
    modprobe nf_conntrack
    modprobe nf_nat
    iptables -t nat -L
    echo "Ensure Docker and necessary packages are properly installed on OpenWRT."
fi

# 3. Check Python environment
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Neither python3 nor python is available. Please install Python and try again."
    exit 1
fi
# 4. Execute Python script
$PYTHON_CMD ./build_tool.py set_registry

# 5. Set permissions
find . -type f -name "*.sh" -exec chmod 777 {} \;

# 6. Manage subconverter container
if [ ! "$(docker ps -q -f name=subconverter)" ]; then
    docker run -d --restart=always --name subconverter -p 25500:25500 $SUBCONVERTER_IMAGE
elif [ "$(docker inspect -f '{{.State.Status}}' subconverter 2>/dev/null)" != "running" ]; then
    docker restart subconverter
fi

# 7. Build and run main container
if [ "$(docker images -q $IMAGE_NAME 2> /dev/null)" ]; then
    docker rmi -f "$IMAGE_NAME"
fi

docker build -t "$IMAGE_NAME" .

if [ $? -ne 0 ]; then
    echo "Failed to build the Docker image!"
    exit 1
fi

if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    docker stop "$CONTAINER_NAME"
    docker rm -f "$CONTAINER_NAME"
fi

docker run -d --name "$CONTAINER_NAME" --restart unless-stopped -u root $PORT_MAPPING -v $DATA_VOLUME_MAPPING "$IMAGE_NAME"

# 8. Display container status
docker ps -aq

# 9. Tag and push image (with confirmation and login check)
read -p "Do you want to tag and push the image? (Y/n): " confirm
if [[ $confirm == [yY] || $confirm == [yY][eE][sS] || $confirm == "" ]]; then
    echo "Tagging and pushing the image..."
    
    # Tag for local registry
    docker tag "$IMAGE_NAME" "${LOCAL_REGISTRY}/${CONTAINER_NAME}:latest"
    
    # Tag for Docker Hub
    docker tag "$IMAGE_NAME" "${DOCKER_USERNAME}/${CONTAINER_NAME}:latest"
    
    push_image_local() {
        docker push "${LOCAL_REGISTRY}/${CONTAINER_NAME}:latest"
    }
    
    push_image_dockerhub() {
        docker push "${DOCKER_USERNAME}/${CONTAINER_NAME}:latest"
    }
    
    # Push to local registry
    echo "Pushing to local registry..."
    push_image_local
    if [ $? -ne 0 ]; then
        echo "Push to local registry failed. Please check your local registry configuration."
    else
        echo "Image pushed to local registry successfully."
    fi
    
    # Push to Docker Hub
    echo "Pushing to Docker Hub..."
    push_image_dockerhub
    if [ $? -ne 0 ]; then
        echo "Push to Docker Hub failed. Attempting to log in to Docker Hub..."
        docker login
        if [ $? -eq 0 ]; then
            echo "Login successful. Retrying push..."
            push_image_dockerhub
            if [ $? -eq 0 ]; then
                echo "Image pushed to Docker Hub successfully."
            else
                echo "Failed to push to Docker Hub after login."
            fi
        else
            echo "Login failed. Unable to push the image to Docker Hub."
        fi
    else
        echo "Image pushed to Docker Hub successfully."
    fi
else
    echo "Skipping tag and push operations."
fi
