#!/bin/bash

CONTAINER_NAME="subconv"
PROJECT_DIR="/app/clash_subscribe"
GIT_REPO_URL="http://git.local.12gm.com:5021/adminroot/clash_subscribe.git"

echo "Checking if git is installed in the Docker container $CONTAINER_NAME..."

# Detect OS type
OS_TYPE=$(sudo docker exec -i $CONTAINER_NAME sh -c 'if [ -f /etc/os-release ]; then . /etc/os-release && echo $ID; fi')

# Check if git is installed
GIT_CHECK=$(sudo docker exec -i $CONTAINER_NAME sh -c 'if command -v git >/dev/null 2>&1; then echo "installed"; else echo "not_installed"; fi')

if [ "$GIT_CHECK" == "installed" ]; then
    echo "Git is already installed in the container."
else
    echo "Git is not installed. Installing git for $OS_TYPE..."

    case "$OS_TYPE" in
        debian|ubuntu)
            sudo docker exec -i $CONTAINER_NAME sh -c 'apt-get update && apt-get install -y git'
            ;;
        alpine)
            sudo docker exec -i $CONTAINER_NAME sh -c 'apk update && apk add git'
            ;;
        centos|fedora|rhel)
            sudo docker exec -i $CONTAINER_NAME sh -c 'yum install -y git'
            ;;
        *)
            echo "Unknown or unsupported OS type: $OS_TYPE. Please install git manually."
            exit 1
            ;;
    esac

    # Verify Git installation
    GIT_CHECK_AFTER_INSTALL=$(sudo docker exec -i $CONTAINER_NAME sh -c 'if command -v git >/dev/null 2>&1; then echo "installed"; else echo "not_installed"; fi')
    
    if [ "$GIT_CHECK_AFTER_INSTALL" == "installed" ]; then
        echo "Git installed successfully."
    else
        echo "Failed to install Git. Please check the container configuration."
        exit 1
    fi
fi

# Check if the project directory exists
echo "Checking if project directory exists in the container..."
PROJECT_CHECK=$(sudo docker exec -i $CONTAINER_NAME sh -c "if [ -d '$PROJECT_DIR' ]; then echo 'exists'; else echo 'not_exists'; fi")

if [ "$PROJECT_CHECK" == "exists" ]; then
    echo "Project directory '$PROJECT_DIR' already exists."
else
    echo "Project directory does not exist. Cloning repository from $GIT_REPO_URL..."
    sudo docker exec -i $CONTAINER_NAME sh -c "git clone $GIT_REPO_URL $PROJECT_DIR"
    
    if [ $? -ne 0 ]; then
        echo "Failed to clone repository. Exiting."
        exit 1
    fi
fi

# Enter the project directory and run the Python project
echo "Entering the project directory and starting the Python project..."
sudo docker exec -i $CONTAINER_NAME sh -c "cd $PROJECT_DIR && python3 main.py"

if [ $? -ne 0 ]; then
    echo "Failed to start the Python project. Please check the container logs for more information."
    exit 1
else
    echo "Python project started successfully."
fi
