#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
CONF_DIR="$SCRIPT_DIR/shells"
DEPLOY_DIR="$CONF_DIR"
SHELLS_DIR="$DEPLOY_DIR/shells"
script_symlink_path="/usr/bin/dd.sh"
script_path="$(readlink -f "$0")"

check_and_install_sudo() {
    if ! command -v sudo > /dev/null 2>&1; then
        echo "sudo not found. Attempting to install..."
        if install_package "sudo"; then
            echo "sudo installed successfully."
        else
            echo "Failed to install sudo. Commands will be run without sudo."
            sudo=""
            return
        fi
    fi

    if command -v sudo > /dev/null 2>&1; then
        sudo="sudo"
        echo "sudo is available and will be used."
    else
        sudo=""
        echo "sudo is not available. Commands will be run without sudo."
    fi
}

check_and_install_sudo

# Create global variable directory and store script directory path
GLOBAL_VAR_DIR="/usr/script_global_var"
if [ ! -d "$GLOBAL_VAR_DIR" ]; then
    $sudo mkdir -p "$GLOBAL_VAR_DIR"
    echo "Created global variable directory: $GLOBAL_VAR_DIR"
fi

# Store script directory path in global variables
echo "$SCRIPT_DIR" | $sudo tee "$GLOBAL_VAR_DIR/SCRIPT_ROOT_DIR" > /dev/null
echo "Stored script root directory path in global variables"

# Store common script directories
COMMON_SHELLS_DIR="$CONF_DIR/shells/common"
COMMON_SCRIPTS_DIR="$CONF_DIR/shells/scripts"

# Store common shells directory path
if [ -d "$COMMON_SHELLS_DIR" ]; then
    echo "$COMMON_SHELLS_DIR" | $sudo tee "$GLOBAL_VAR_DIR/COMMON_SHELLS_DIR" > /dev/null
    echo "Stored common shells directory path in global variables"
else
    echo "Warning: Common shells directory not found at $COMMON_SHELLS_DIR"
fi

# Store common scripts directory path
if [ -d "$COMMON_SCRIPTS_DIR" ]; then
    echo "$COMMON_SCRIPTS_DIR" | $sudo tee "$GLOBAL_VAR_DIR/COMMON_SCRIPTS_DIR" > /dev/null
    echo "Stored common scripts directory path in global variables"
else
    echo "Warning: Common scripts directory not found at $COMMON_SCRIPTS_DIR"
fi


make_sh_executable() {
    if [ -z "$SCRIPT_DIR" ]; then
        echo "SCRIPT_DIR is not specified."
        return 1
    fi
    find "$SCRIPT_DIR" -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} \;
    if [ -d "$DEPLOY_DIR" ]; then
        find "$DEPLOY_DIR" -type f -name "*.sh" -exec chmod +x {} \;
    else
        echo "Directory $DEPLOY_DIR does not exist."
    fi
}

echo "Script is executed from: $SCRIPT_DIR"
make_sh_executable

if [ -L "$0" ] && [ "$0" -ef "$script_symlink_path" ]; then
  original_source="$(readlink -f "$script_path")"
  SCRIPT_DIR="$(dirname "$original_source")"
  echo "Updating SCRIPT_DIR to: $SCRIPT_DIR"
fi

install_package() {
    local package_name="$1"
    echo "Attempting to install $package_name..."
    if command -v apt-get &> /dev/null; then
        $sudo apt-get update && $sudo apt-get install -y "$package_name"
    elif command -v yum &> /dev/null; then
        $sudo yum install -y "$package_name"
    elif command -v dnf &> /dev/null; then
        $sudo dnf install -y "$package_name"
    else
        echo "Unable to install $package_name. No supported package manager found."
        return 1
    fi
    return 0
}
check_and_install_dos2unix() {
    if ! command -v dos2unix &> /dev/null; then
        echo "dos2unix is not installed, attempting to install..."
        if install_package "dos2unix"; then
            echo "dos2unix installed successfully."
        else
            echo "Failed to install dos2unix. Please install it manually and try again."
            return 1
        fi
    fi
    return 0
}

# Ensure dos2unix is installed
if ! command -v dos2unix &> /dev/null; then
    check_and_install_dos2unix
fi

# Convert .sh files to Linux format, skipping node_modules and hidden folders

# Set executable permissions

if [ -e "$script_symlink_path" ]; then
  if [ ! -L "$script_symlink_path" ] || [ "$(readlink -f "$script_symlink_path")" != "$script_path" ]; then
    echo "Removing existing $script_symlink_path as it is not a symlink to the current script."
    $sudo rm -f "$script_symlink_path"
  fi
fi

if [ ! -e "$script_symlink_path" ]; then
  ln -s "$script_path" "$script_symlink_path"
  echo "Symbolic link created: $script_symlink_path -> $script_path"
  chmod +x "$script_symlink_path"
fi

echo "SCRIPT_DIR: $SCRIPT_DIR"

detect_system_version() {
    if [ -f /.dockerenv ]; then
        echo "Running inside Docker container"
        SYSTEM_VERSION="Docker"
    elif [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu)
                SYSTEM_VERSION="ubuntu_$(echo $VERSION_ID | cut -d. -f1)"
                ;;
            debian)
                SYSTEM_VERSION="debian_$(echo $VERSION_ID | cut -d. -f1)"
                ;;
            *)
                SYSTEM_VERSION="$ID_$VERSION_ID"
                ;;
        esac
    else
        SYSTEM_VERSION="Unknown"
    fi
}


get_git(){
  cd "$SCRIPT_DIR" || exit
  $sudo git stash && $sudo git fetch --all && $sudo git reset --hard origin/main && $sudo git pull --force
  make_sh_executable
}
restart_pm2() {
  $sudo docker exec -it pm2_nginx pm2_nginx list
  while true; do
    echo "Select an option:"
    echo "1. Show PM2 logs"
    echo "2. Restart PM2 processes"
    echo "3. Real-time pm2 DEBUG information"
    echo "4. Restart pm2 docker"
    echo "0. Exit"
    read -p "Enter your choice: " choice
    case $choice in
      1)
        while true; do
          $sudo docker exec -it pm2_nginx pm2_nginx list
          read -p "Enter the number ID to log (press Enter to skip, 0 to exit): " pm2_id
          if [ -z "$pm2_id" ]; then
            break
          elif [ "$pm2_id" = "0" ]; then
            echo "Exiting without logs."
            exit 0
          else
            $sudo docker exec -it pm2_nginx pm2_nginx logs "$pm2_id"
          fi
        done
        ;;
      2)
        while true; do
          $sudo docker exec -it pm2_nginx pm2_nginx list
          read -p "Enter the number ID to restart (press Enter to skip, 0 to exit): " pm2_id
          if [ -z "$pm2_id" ]; then
            break
          elif [ "$pm2_id" = "0" ]; then
            echo "Exiting without restarting."
            exit 0
          else
            $sudo docker exec -it pm2_nginx pm2_nginx restart "$pm2_id"
            $sudo docker exec -it pm2_nginx pm2_nginx logs
          fi
        done
        ;;
      3)
        $sudo docker exec -it pm2_nginx pm2_nginx logs
        ;;
      4)
        $sudo docker restart pm2_nginx
        $sudo docker exec -it pm2_nginx pm2_nginx list
        ;;
      0)
        echo "Exiting."
        exit 0
        ;;
      *)
        echo "Invalid option. Please try again."
        ;;
    esac
  done
}

run_install_script() {
    local SCRIPT_NAME="$1"  # Accept the script name as an argument

    if [[ -z "$SCRIPT_NAME" ]]; then
        echo "Error: No script name provided."
        return
    fi

    if [[ -f /etc/os-release ]]; then
        . /etc/os-release

        case "$ID" in
            centos|fedora|debian|ubuntu|ezopwrt)
                # Keep only the major version number
                VERSION=$(echo "$VERSION_ID" | cut -d. -f1)
                SCRIPT_VERSION="${ID}_${VERSION}"
                ;;
            *)
                echo "Unknown Linux Distribution $ID"
                return
                ;;
        esac

        INSTALL_SCRIPT="$SHELLS_DIR/$SCRIPT_VERSION/$SCRIPT_NAME"

        if [[ -f "$INSTALL_SCRIPT" ]]; then
            echo "Running install script: $INSTALL_SCRIPT"
            bash "$INSTALL_SCRIPT"
        else
            echo "Error: Install script not found for $SCRIPT_VERSION: $SCRIPT_NAME ( $INSTALL_SCRIPT )."
        fi
    elif [[ -f /etc/redhat-release ]]; then
        # For older CentOS versions
        if grep -q "CentOS" /etc/redhat-release; then
            VERSION=$(awk '{print $3}' /etc/redhat-release | cut -d. -f1)
            SCRIPT_VERSION="centos_$VERSION"
            SCRIPT_DIR="$PWD/apps/deploy/shells"
            INSTALL_SCRIPT="$SCRIPT_DIR/$SCRIPT_VERSION/$SCRIPT_NAME"

            if [[ -f "$INSTALL_SCRIPT" ]]; then
                echo "Running install script: $INSTALL_SCRIPT"
                bash "$INSTALL_SCRIPT"
            else
                echo "Error: Install script not found for $SCRIPT_VERSION: $SCRIPT_NAME."
            fi
        fi
    elif [[ -f /etc/lsb-release ]]; then
        . /etc/lsb-release
        VERSION=$(echo "$DISTRIB_RELEASE" | cut -d. -f1)
        SCRIPT_VERSION="ubuntu_$VERSION"
        SCRIPT_DIR="$PWD/apps/deploy/shells"
        INSTALL_SCRIPT="$SCRIPT_DIR/$SCRIPT_VERSION/$SCRIPT_NAME"

        if [[ -f "$INSTALL_SCRIPT" ]]; then
            echo "Running install script: $INSTALL_SCRIPT"
            bash "$INSTALL_SCRIPT"
        else
            echo "Error: Install script not found for $SCRIPT_VERSION: $SCRIPT_NAME."
        fi
    else
        echo "Unsupported or unknown Linux distribution."
    fi
}


migrate_server(){
  while true; do
    echo "Select an option:"
    echo "1. BT migrate to docker nginx"
    echo "0. Exit"
    read -p "Enter your choice: " choice
    case $choice in
      1)
        ;;
      2)
        ;;
      3)
        ;;
      4)
        ;;
      0)
        echo "Exiting."
        exit 0
        ;;
      *)
        echo "Invalid option. Please try again."
        ;;
    esac
  done
}

while true; do
    detect_system_version
    echo "Current system: $SYSTEM_VERSION"
    echo "Select a function:"
    echo "1. Install the server"
    echo "2. Rebuild docker-compose"
    echo "3. Migrate server"
    echo "4. Restart/Print pm2 service"
    echo "5. Get the latest git version"
    echo "6. Enable local sharing on LAN"
    echo "7. Display global variables"
    echo "0. Exit"
    read -p "Please enter your choice: " choice
    case $choice in
        0)
            echo "Exiting the script."
            exit ;;
        1)
            run_install_script "install.sh" ;;
        2)
            run_install_script "rebuild_docker.sh" ;;
        3)
            migrate_server ;;
        4)
            restart_pm2 ;;
        5)
            get_git ;;
        6)
            run_install_script "enable_local_sharing.sh" ;;
        7)
            echo "Global Variables in $GLOBAL_VAR_DIR:"
            if [ -d "$GLOBAL_VAR_DIR" ] && [ "$(ls -A $GLOBAL_VAR_DIR)" ]; then
                for file in "$GLOBAL_VAR_DIR"/*; do
                    if [ -f "$file" ]; then
                        filename=$(basename "$file")
                        value=$(cat "$file")
                        echo "$filename = $value"
                    fi
                done
            else
                echo "No global variables found."
            fi
            echo "Press Enter to continue..."
            read
            ;;
        *)
            echo "Invalid selection. Please enter a number between 0 and 7." ;;
    esac
done
