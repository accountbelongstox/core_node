#!/bin/bash

# Define the container and image names
CONTAINER_NAME="baota_pure"
IMAGE_NAME="baota_advanced"
REMOTE_REGISTRY="cy00000000x"
LOCAL_REGISTRY="192.168.100.6:15000"

# Define the remote and local image names
REMOTE_IMAGE_NAME="${REMOTE_REGISTRY}/${IMAGE_NAME}:latase"
LOCAL_IMAGE_NAME="${LOCAL_REGISTRY}/${IMAGE_NAME}:latase"

# Function to stop the container
stop_container() {
    echo "Stopping container: $CONTAINER_NAME..."
    docker stop "$CONTAINER_NAME"
}

# Function to delete the image
delete_image() {
    echo "Deleting image: $IMAGE_NAME..."
    docker rmi "$IMAGE_NAME"
}

# Function to export the container
export_container() {
    echo "Exporting container: $CONTAINER_NAME..."
    docker export "$CONTAINER_NAME" -o "${CONTAINER_NAME}.tar"
}

# Function to import the container as an image
import_container_as_image() {
    echo "Importing container as image..."
    docker import "${CONTAINER_NAME}.tar" "$IMAGE_NAME"
}

# Function to push the image to the local registry
push_local() {
    echo "Tagging image for local registry..."
    docker tag "$IMAGE_NAME" "$LOCAL_IMAGE_NAME"
    echo "Pushing image to local registry: $LOCAL_IMAGE_NAME..."
    docker push "$LOCAL_IMAGE_NAME"
}

# Function to push the image to the remote registry
push_remote() {
    echo "Tagging image for remote registry..."
    docker tag "$IMAGE_NAME" "$REMOTE_IMAGE_NAME"
    echo "Pushing image to remote registry: $REMOTE_IMAGE_NAME..."
    docker push "$REMOTE_IMAGE_NAME"
}

# Main script execution
stop_container
delete_image
export_container
import_container_as_image
push_local
push_remote

echo "All operations completed successfully!"
