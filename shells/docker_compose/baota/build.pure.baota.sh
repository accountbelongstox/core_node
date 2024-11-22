#!/bin/bash

# Define variables
IMAGE_NAME="baota_pure"
REMOTE_REGISTRY="cy00000000x"
LOCAL_REGISTRY="192.168.100.6:15000"

# Define the remote and local image names
REMOTE_IMAGE_NAME="${REMOTE_REGISTRY}/${IMAGE_NAME}:latest"
LOCAL_IMAGE_NAME="${LOCAL_REGISTRY}/${IMAGE_NAME}:latest"

# Check if a container named "baota_pure" exists and remove it
if [ "$(docker ps -aq -f name=baota_pure)" ]; then
    echo "Found existing baota_pure container, removing it..."
    docker stop baota_pure
    docker rm baota_pure
else
    echo "No baota_pure container found, no need to remove."
fi

# Check if an image named "baota_pure" exists and remove it
if [ "$(docker images -q $IMAGE_NAME)" ]; then
    echo "Found existing baota_pure image, removing it..."
    docker image rm -f $IMAGE_NAME
else
    echo "No baota_pure image found, no need to remove."
fi

# Optionally clean up unused Docker resources (commented out)
echo "Cleaning up unused Docker resources..."
# docker system prune -af
# docker volume prune -f

# Build the baota_pure image from the specified Dockerfile
echo "Building baota_pure image..."
docker build -f Dockerfile.pure.baota -t $IMAGE_NAME .

# Tag the image for local registry
echo "Tagging the image for the local registry..."
docker tag $IMAGE_NAME ${LOCAL_IMAGE_NAME}

# Push the image to the local registry
echo "Pushing the image to the local registry..."
docker push ${LOCAL_IMAGE_NAME}

# Tag the image for remote registry
echo "Tagging the image for the remote registry..."
docker tag $IMAGE_NAME ${REMOTE_IMAGE_NAME}

# Push the image to the remote registry
echo "Pushing the image to the remote registry..."
docker push ${REMOTE_IMAGE_NAME}

# Start the baota_pure container
echo "Starting baota_pure container..."
docker run --name baota_pure \
    --restart unless-stopped \
    -v /home/www:/www \
    -p 8888:8888 \
    -p 80:80 \
    -p 889:889 \
    -p 443:443 \
    -p 888:888 \
    $IMAGE_NAME

# List all containers
docker ps -a
