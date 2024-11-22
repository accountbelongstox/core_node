#!/bin/bash

# Define variables
IMAGE_NAME="debian"
REMOTE_REGISTRY="cy00000000x"
LOCAL_REGISTRY="192.168.100.6:15000"

# Define the remote and local image names
REMOTE_IMAGE_NAME="${REMOTE_REGISTRY}/${IMAGE_NAME}:12"
LOCAL_IMAGE_NAME="${LOCAL_REGISTRY}/${IMAGE_NAME}:12"

# Check if the image debian12 already exists
if [ "$(docker images -q $IMAGE_NAME)" ]; then
    echo "Found existing image $IMAGE_NAME, removing it..."
    docker image rm -f $IMAGE_NAME
else
    echo "No existing image $IMAGE_NAME found."
fi

# Build a new image from Dockerfile.pure.debian
echo "Building the image from Dockerfile.pure.debian..."
docker build -f Dockerfile.pure.debian -t $IMAGE_NAME .

# Check if the build succeeded
if [ $? -ne 0 ]; then
    echo "Image build failed, aborting."
    exit 1
fi

# Tag the image for the local registry
echo "Tagging the image for the local registry..."
docker tag $IMAGE_NAME $LOCAL_IMAGE_NAME

# Push the image to the local registry
echo "Pushing the image to the local registry..."
docker push $LOCAL_IMAGE_NAME

# Check if the push to the local registry succeeded
if [ $? -ne 0 ]; then
    echo "Failed to push the image to the local registry."
    exit 1
else
    echo "Image successfully pushed to $LOCAL_IMAGE_NAME."
fi

# Tag the image for the remote registry
echo "Tagging the image for the remote registry..."
docker tag $IMAGE_NAME $REMOTE_IMAGE_NAME

# Push the image to the remote repository
echo "Pushing the image to the remote registry..."
docker push $REMOTE_IMAGE_NAME

# Check if the push to the remote registry succeeded
if [ $? -ne 0 ]; then
    echo "Failed to push the image to the remote registry."
    exit 1
else
    echo "Image successfully pushed to $REMOTE_IMAGE_NAME."
fi
