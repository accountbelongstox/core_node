#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
SCRIPT_INDEX="47"
START_DOCKER=""

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Initialize variables
SCRIPT_INDEX="47"
START_DOCKER=$(get_var "START_DOCKER" "false")

echo "[$SCRIPT_INDEX] Docker Management Script"
echo "[$SCRIPT_INDEX] START_DOCKER: $START_DOCKER"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Docker service is running
is_docker_running() {
    # Check standard docker service
    if command_exists systemctl; then
        if systemctl is-active --quiet docker 2>/dev/null; then
            return 0
        fi
        # Check snap docker service
        if systemctl is-active --quiet snap.docker.dockerd 2>/dev/null; then
            return 0
        fi
    elif command_exists service; then
        if service docker status >/dev/null 2>&1; then
            return 0
        fi
    fi

    # Check if dockerd process is running
    if pgrep -x dockerd >/dev/null 2>&1; then
        return 0
    fi

    return 1
}

# Function to disable Docker services
disable_docker_services() {
    echo "[$SCRIPT_INDEX] Disabling Docker services..."

    # Stop Docker service if running
    if is_docker_running; then
        echo "[$SCRIPT_INDEX] Stopping Docker service..."

        # Try to stop standard docker service
        if systemctl is-active --quiet docker 2>/dev/null; then
            echo "[$SCRIPT_INDEX] Stopping standard docker service..."
            $USE_SUDO systemctl stop docker 2>/dev/null
        fi

        # Try to stop snap docker service
        if systemctl is-active --quiet snap.docker.dockerd 2>/dev/null; then
            echo "[$SCRIPT_INDEX] Stopping snap docker service..."
            $USE_SUDO systemctl stop snap.docker.dockerd 2>/dev/null
            $USE_SUDO snap stop docker 2>/dev/null || true
        fi

        # Kill any remaining dockerd processes
        if pgrep -x dockerd >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] Killing remaining dockerd processes..."
            $USE_SUDO pkill -TERM dockerd 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if pgrep -x dockerd >/dev/null 2>&1; then
                $USE_SUDO pkill -9 dockerd 2>/dev/null || true
            fi
        fi

        # Kill containerd processes
        if pgrep -x containerd >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] Killing containerd processes..."
            $USE_SUDO pkill -TERM containerd 2>/dev/null || true
            sleep 1
            if pgrep -x containerd >/dev/null 2>&1; then
                $USE_SUDO pkill -9 containerd 2>/dev/null || true
            fi
        fi

        sleep 1

        if is_docker_running; then
            echo "[$SCRIPT_INDEX] Warning: Failed to stop Docker service"
        else
            echo "[$SCRIPT_INDEX] Docker service stopped successfully"
        fi
    else
        echo "[$SCRIPT_INDEX] Docker service is not running"
    fi

    # Disable Docker service from auto-start
    echo "[$SCRIPT_INDEX] Disabling Docker service from auto-start..."

    # Disable standard docker
    $USE_SUDO systemctl disable docker 2>/dev/null || true

    # Disable snap docker
    if command -v snap >/dev/null 2>&1; then
        if snap list 2>/dev/null | grep -q "^docker "; then
            echo "[$SCRIPT_INDEX] Disabling snap docker from auto-start..."
            $USE_SUDO systemctl disable snap.docker.dockerd 2>/dev/null || true
        fi
    fi

    # Disable Docker Compose service if exists
    if command_exists systemctl; then
        if systemctl list-unit-files | grep -q docker-compose; then
            echo "[$SCRIPT_INDEX] Disabling Docker Compose service..."
            $USE_SUDO systemctl stop docker-compose 2>/dev/null || true
            $USE_SUDO systemctl disable docker-compose 2>/dev/null || true
        fi
    fi

    echo "[$SCRIPT_INDEX] Docker services disabled successfully"
}

# Function to enable Docker services
enable_docker_services() {
    echo "[$SCRIPT_INDEX] Enabling Docker services..."
    
    # Enable Docker service for auto-start
    echo "[$SCRIPT_INDEX] Enabling Docker service for auto-start..."
    $USE_SUDO systemctl enable docker 2>/dev/null || $USE_SUDO update-rc.d docker enable 2>/dev/null
    
    # Start Docker service
    echo "[$SCRIPT_INDEX] Starting Docker service..."
    $USE_SUDO systemctl start docker 2>/dev/null || $USE_SUDO service docker start 2>/dev/null
    
    # Wait a moment for service to start
    sleep 2
    
    if is_docker_running; then
        echo "[$SCRIPT_INDEX] Docker service started successfully"
    else
        echo "[$SCRIPT_INDEX] Warning: Docker service may not have started properly"
    fi
}

# Function: Remove docker.list if exists
remove_docker_list_file() {
    local docker_list="/etc/apt/sources.list.d/docker.list"
    if [ -f "$docker_list" ]; then
        echo "[$SCRIPT_INDEX] Found $docker_list, removing..."
        $USE_SUDO rm -f "$docker_list"
        if [ ! -f "$docker_list" ]; then
            echo "[$SCRIPT_INDEX] Successfully removed $docker_list"
        else
            echo "[$SCRIPT_INDEX] Failed to remove $docker_list"
        fi
    else
        echo "[$SCRIPT_INDEX] $docker_list does not exist, nothing to remove."
    fi
}

# Check if snap is installed
check_snap() {
    if command -v snap &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# If docker is not installed, try to install with snap. If already installed, print version.
install_docker_with_snap_if_needed() {
    if ! command -v docker &>/dev/null; then
        echo "[$SCRIPT_INDEX] Docker is not installed, trying to install with snap..."
        if check_snap; then
            $USE_SUDO snap install docker
            if command -v docker &>/dev/null; then
                echo "[$SCRIPT_INDEX] Docker was successfully installed via snap. Version: $(docker --version)"
            else
                echo "[$SCRIPT_INDEX] Failed to install docker with snap."
            fi
        else
            echo "[$SCRIPT_INDEX] Snap is not installed. Please install snapd to use snap for docker installation."
        fi
    else
        echo "[$SCRIPT_INDEX] Docker is already installed. Version: $(docker --version)"
    fi
}

# If docker-compose is not installed, try to install with snap. If already installed, print version.
install_docker_compose_with_snap_if_needed() {
    if ! command -v docker-compose &>/dev/null; then
        echo "[$SCRIPT_INDEX] Docker Compose is not installed, trying to install with snap..."
        if check_snap; then
            $USE_SUDO snap install docker
            # snap's docker-compose may be at /snap/bin/docker-compose
            if command -v docker-compose &>/dev/null || [ -x "/snap/bin/docker-compose" ]; then
                if command -v docker-compose &>/dev/null; then
                    echo "[$SCRIPT_INDEX] Docker Compose was successfully installed via snap. Version: $(docker-compose --version)"
                else
                    echo "[$SCRIPT_INDEX] Docker Compose was installed at /snap/bin/docker-compose. Version: $(/snap/bin/docker-compose --version)"
                fi
            else
                echo "[$SCRIPT_INDEX] Failed to install docker-compose with snap."
            fi
        else
            echo "[$SCRIPT_INDEX] Snap is not installed. Please install snapd to use snap for docker-compose installation."
        fi
    else
        echo "[$SCRIPT_INDEX] Docker Compose is already installed. Version: $(docker-compose --version)"
    fi
}

# Main execution logic
echo "[$SCRIPT_INDEX] === Docker Management ==="

# Remove docker.list file regardless of installation status
remove_docker_list_file

# Configure based on START_DOCKER variable
if [ "$START_DOCKER" = "true" ]; then
    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] START_DOCKER is true - Installing and starting Docker..."
    echo "[$SCRIPT_INDEX] ============================================"

    # Install Docker if not present
    install_docker_with_snap_if_needed
    install_docker_compose_with_snap_if_needed

    # Enable and start services
    enable_docker_services

    # Set global variables
    set_var "DOCKER_AVAILABLE" "true"
    set_var "DOCKER_ENABLED" "true"

    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] Docker is installed and running"
    echo "[$SCRIPT_INDEX] ============================================"
else
    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] START_DOCKER is false - Skipping Docker installation"
    echo "[$SCRIPT_INDEX] ============================================"

    # If Docker is already installed, stop and disable it
    if command_exists docker; then
        echo "[$SCRIPT_INDEX] Docker is already installed, stopping and disabling services..."
        disable_docker_services

        # Set global variables
        set_var "DOCKER_AVAILABLE" "true"
        set_var "DOCKER_ENABLED" "false"

        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] Docker is installed but stopped and disabled"
        echo "[$SCRIPT_INDEX] ============================================"
    else
        echo "[$SCRIPT_INDEX] Docker is not installed and will not be installed"

        # Set global variables
        set_var "DOCKER_AVAILABLE" "false"
        set_var "DOCKER_ENABLED" "false"

        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] Docker skipped"
        echo "[$SCRIPT_INDEX] ============================================"
    fi
fi

echo "[$SCRIPT_INDEX] Docker configuration completed"

echo "[$SCRIPT_INDEX] Docker Management Script completed"

