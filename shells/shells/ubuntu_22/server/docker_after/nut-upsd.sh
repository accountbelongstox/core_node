#!/bin/bash

# Get the current directory of the script
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Get parent directory and higher-level directories
PARENT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")

# Set template and docker-compose template directories
TEMPLATE_DIR="$DEPLOY_DIR/template"
DOCKER_COMPOSE_TEMPLATE_DIR="$TEMPLATE_DIR/docker_compose"

# Set temporary info directory and UPS_API_PORT file
TMP_INFO_DIR="/usr/local/.pcore_local/deploy"
UPS_API_PORT_FILE="$TMP_INFO_DIR/.UPS_API_PORT"

# Read UPS_API_PORT from temporary info directory
#UPS_API_PORT=$(cat "$UPS_API_PORT_FILE")

# Define variables for paths
MONITOR_DIR="/home/monitor"
MONITOR_SCRIPT="main.py"
REMOTE_MONITOR_FILE="$MONITOR_DIR/$MONITOR_SCRIPT"

SOURCE_CHECK="sudo docker exec nut-upsd grep -q 'mirrors.tuna.tsinghua.edu.cn/alpine' /etc/apk/repositories"
if ! eval $SOURCE_CHECK &> /dev/null; then
    echo "Tuna source not found in /etc/apk/repositories. Adding sources..."
    # Commands to add the Tuna source to /etc/apk/repositories
    sudo docker exec nut-upsd sh -c "echo 'https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.12/main' >> /etc/apk/repositories"
    sudo docker exec nut-upsd sh -c "echo 'https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.12/community' >> /etc/apk/repositories"
    echo "Tuna sources added to /etc/apk/repositories."
else
    echo "Tuna sources are already set in /etc/apk/repositories."
fi

ENTRYPOINT_CHECK="sudo docker exec nut-upsd grep -q 'set-docker-entrypoint' /usr/local/bin/docker-entrypoint"
if ! eval $ENTRYPOINT_CHECK &> /dev/null; then
    echo "set-docker-entrypoint not found in docker-entrypoint. Adding script..."
    # Define the new script content to be added
    NEW_ENTRYPOINT_CONTENT="
# set-docker-entrypoint
if ! grep -q 'mirrors.tuna.tsinghua.edu.cn/alpine' /etc/apk/repositories; then
    mv /etc/apk/repositories /etc/apk/repositories.bak
    echo 'Tuna sources not found, adding them...'
    echo 'https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.12/main' >> /etc/apk/repositories
    echo 'https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.12/community' >> /etc/apk/repositories
fi

# Update and install Python3 and OpenRC if not already installed
if ! command -v python3 > /dev/null; then
    apk update
    apk add python3
fi

if ! command -v rc-service > /dev/null; then
    apk update
    apk add openrc
fi
chmod +x $REMOTE_MONITOR_FILE
python3 $REMOTE_MONITOR_FILE
"
    # Add the new content to the entrypoint script
    echo "$NEW_ENTRYPOINT_CONTENT" | sudo docker exec -i nut-upsd sh -c 'cat >> /usr/local/bin/docker-entrypoint'
    # Ensure the entrypoint script is executable
    sudo docker exec nut-upsd chmod +x /usr/local/bin/docker-entrypoint
    echo "docker-entrypoint updated."
else
    echo "set-docker-entrypoint already set in docker-entrypoint."
fi


# Check if Python3 is installed in nut-upsd container
PYTHON_CHECK="sudo docker exec -it nut-upsd sh -c 'which python3'"
if ! eval $PYTHON_CHECK &> /dev/null; then
    echo "Python3 is not installed in nut-upsd. Installing..."
    sudo docker exec -it nut-upsd apk add python3
else
    echo "Python3 is already installed in nut-upsd."
fi

# Check if monitor directory exists in nut-upsd container
DIR_CHECK="sudo docker exec -it nut-upsd sh -c 'test -d $MONITOR_DIR'"
if ! eval $DIR_CHECK &> /dev/null; then
    echo "Creating $MONITOR_DIR directory in nut-upsd..."
    sudo docker exec -it nut-upsd mkdir -p "$MONITOR_DIR"
else
    echo "$MONITOR_DIR already exists in nut-upsd."
fi

# Check if main.py file exists in nut-upsd container
MONITOR_CHECK="sudo docker exec -it nut-upsd sh -c 'test -f $REMOTE_MONITOR_FILE'"
if ! eval $MONITOR_CHECK &> /dev/null; then
    sudo docker exec -it nut-upsd sh -c "echo '$REMOTE_MONITOR_FILE &' >> /etc/rc.local"
    sudo docker exec -it nut-upsd chmod +x /etc/rc.local
    echo "$MONITOR_SCRIPT configured to run on startup."
else
    echo "$MONITOR_SCRIPT already exists in $MONITOR_DIR."
fi

# Copy main.py to /home/monitor if it doesn't exist
echo "Copying $MONITOR_SCRIPT to $MONITOR_DIR/..."
sudo docker cp "$DOCKER_COMPOSE_TEMPLATE_DIR/nut-upsd/src/$MONITOR_SCRIPT" "nut-upsd:$REMOTE_MONITOR_FILE"
sudo docker exec -it nut-upsd chmod +x "$REMOTE_MONITOR_FILE"

# Check if the specified port is available
PORT_CHECK="sudo docker exec -it nut-upsd sh -c 'netstat -tuln | grep :1005'"
if ! eval $PORT_CHECK &> /dev/null; then
    echo "Port 1005 is available. Starting $MONITOR_SCRIPT..."
    # Start main.py in the background
    sudo docker exec -d nut-upsd sh -c "python3 $REMOTE_MONITOR_FILE"
    echo "$MONITOR_SCRIPT started."
else
    echo "Port 1005 is already in use. Cannot start $MONITOR_SCRIPT."

    # Restart the Docker image here and prompt
    echo "Restarting the nut-upsd Docker image..."
    # Replace with actual command to restart the Docker image
    sudo docker restart nut-upsd
    echo "nut-upsd Docker image restarted."
fi
