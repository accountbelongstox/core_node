#!/bin/bash

# Automatically set LOCAL_REPO_PATH to the directory where the script is located
LOCAL_REPO_PATH="$( cd "$( dirname "$0" )" && pwd )"

# Define the git commands to be executed
GIT_COMMANDS=(
    "git stash"
    "git fetch --all"
    "git reset --hard origin/main"
    "git pull --force"
)

# Check if sudo is required (for Linux/MacOS) and if it exists
USE_SUDO=""
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "cygwin" ]]; then
    if command -v sudo &> /dev/null; then
        USE_SUDO="sudo"
    else
        echo "sudo is not installed. Commands will be executed without sudo."
    fi
fi

# Execute the git commands
for cmd in "${GIT_COMMANDS[@]}"; do
    # Add sudo if required
    full_command="$USE_SUDO $cmd"

    echo "Executing command: $full_command"

    # Run the command
    $full_command
    if [ $? -ne 0 ]; then
        echo "Error: Command '$full_command' failed."
        exit 1  # Exit the script if a command fails
    fi
done

# Set the directory and .sh script file to 777
echo "Setting permissions for the directory and .sh script..."

# Change the permissions of the directory to 777
$USE_SUDO chmod 777 "$LOCAL_REPO_PATH"

# Make the current .sh file executable
$USE_SUDO chmod +x "$LOCAL_REPO_PATH/$(basename "$0")"

# Recursively find all .sh files and set permissions to 777
echo "Recursively setting permissions to 777 for all .sh files in the directory..."
find "$LOCAL_REPO_PATH" -type f -name "*.sh" -exec $USE_SUDO chmod 777 {} \;

echo "Permissions successfully set to 777 for all .sh files."

echo "Repository successfully updated."
