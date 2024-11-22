#!/bin/bash

# Set the image name
IMAGE_NAME="baota"

# Define the registries
REMOTE_REGISTRY="cy00000000x"
LOCAL_REGISTRY="192.168.100.6:15000"

# Tag the image for the remote registry
REMOTE_IMAGE_NAME="${REMOTE_REGISTRY}/${IMAGE_NAME}:latest"
LOCAL_IMAGE_NAME="${LOCAL_REGISTRY}/${IMAGE_NAME}:latest"

# Function to export and replace the existing image
export_and_replace_image() {
    echo "Exporting the current running container to a new image..."
    CONTAINER_NAME="baota" 

    # Commit the container to a new image
    if docker commit "$CONTAINER_NAME" "$IMAGE_NAME:latest"; then
        echo "Container exported as ${IMAGE_NAME}:latest."
    else
        echo "Failed to export container."
        exit 1
    fi
}

# Get user input for the action
echo "Choose an option:"
echo "0 - Push existing Baota image directly."
echo "1 - Export current Baota container, replace existing image, and then push."
read -p "Enter your choice (default is 0): " choice

# Default to option 0 if no input
choice=${choice:-0}

if [ "$choice" -eq 1 ]; then
    export_and_replace_image
fi

# Tag the image for the remote registry
echo "Tagging image as ${REMOTE_IMAGE_NAME} ..."
docker tag "$IMAGE_NAME:latest" "$REMOTE_IMAGE_NAME"

# Tag the image for the local registry
echo "Tagging image as ${LOCAL_IMAGE_NAME} ..."
docker tag "$IMAGE_NAME:latest" "$LOCAL_IMAGE_NAME"

# Push to the local registry first
echo "Pushing image to ${LOCAL_IMAGE_NAME} ..."
if docker push "$LOCAL_IMAGE_NAME"; then
    echo "Successfully pushed to ${LOCAL_IMAGE_NAME}"
else
    echo "Failed to push to ${LOCAL_IMAGE_NAME}. Please check your daemon.json configuration."
    echo "If you're pushing to a local registry, make sure to add the following line to your daemon.json:"
    echo '"insecure-registries": ["192.168.100.6:15000"]'
    echo "Then restart Docker with: sudo systemctl restart docker"
    exit 1
fi

# Push to the remote registry
echo "Pushing image to ${REMOTE_IMAGE_NAME} ..."
if docker push "$REMOTE_IMAGE_NAME"; then
    echo "Successfully pushed to ${REMOTE_IMAGE_NAME}"
else
    echo "Failed to push to ${REMOTE_IMAGE_NAME}. Please check your configuration."
    exit 1
fi
