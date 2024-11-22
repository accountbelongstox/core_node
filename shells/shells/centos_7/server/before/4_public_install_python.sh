#!/bin/bash

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")
BIN_DIR="/usr/local/bin"
USR_BIN="/usr/bin"
PYTHON_BIN="$BIN_DIR/python3.9"
TMP_INFO_DIR="/usr/local/.pcore_local/deploy"
PY_VENV_FILE="$TMP_INFO_DIR/.PY_VENV_DIR"

if [ ! -d "$TMP_INFO_DIR" ]; then
  sudo mkdir -p "$TMP_INFO_DIR"
  echo "Directory $TMP_INFO_DIR created."
fi

# Check current versions of Python and pip
current_python_version=$($PYTHON_BIN --version 2>&1)
current_pip_version=$($PYTHON_BIN -m pip --version 2>&1)

echo "Current Python version: $current_python_version"
echo "Current Pip version: $current_pip_version"

if [[ $current_python_version != Python\ 3.9* ]] || [[ $current_pip_version != pip* ]]; then
    echo "Python 3.9 or Pip is not the default version. Installing Python 3.9 and Pip..."

    # Install required packages for building Python
    sudo yum groupinstall -y "Development Tools"
    sudo yum install -y wget openssl-devel bzip2-devel libffi-devel

    # Download Python source code
    if [ ! -f /tmp/Python-3.9.16.tgz ]; then
        sudo wget --no-check-certificate -P /tmp https://www.python.org/ftp/python/3.9.16/Python-3.9.16.tgz
    fi

    if [ ! -d /tmp/Python-3.9.16 ]; then
        sudo tar xzf /tmp/Python-3.9.16.tgz -C /tmp
    fi

    cd /tmp/Python-3.9.16
    sudo ./configure --enable-optimizations
    sudo make altinstall

    # Create symlinks for python3.9 and pip3.9
    for cmd in python3.9 pip3.9; do
        if [ -L $USR_BIN/$cmd ]; then
            sudo rm $USR_BIN/$cmd
        fi
        sudo ln -s $BIN_DIR/$cmd $USR_BIN/$cmd
        sudo chmod +x $BIN_DIR/$cmd
    done

    echo "Python 3.9 installed successfully."
else
    echo "Python 3.9 is already installed."
fi

main_script="$SCRIPT_ROOT_DIR/main.py"
sys_python_interpreter="$BIN_DIR/python3.9"
sudo $sys_python_interpreter --version
sudo $sys_python_interpreter -m pip --version

get_system_info() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu)
                SYS_INFO="ubuntu_$VERSION_ID"
                ;;
            debian)
                SYS_INFO="debian_$VERSION_ID"
                ;;
            centos)
                SYS_INFO="centos_$VERSION_ID"
                ;;
            *)
                echo "Unsupported OS: $ID"
                exit 1
                ;;
        esac
    else
        echo "Unsupported OS"
        exit 1
    fi
}

get_python_version() {
    local python_bin=$1
    PYTHON_VERSION=$($python_bin --version 2>&1 | awk '{print $2}')
}

generate_formatted_string() {
    local python_bin=$1
    get_system_info
    get_python_version "$python_bin"
    FORMATTED_STRING="venv_linux_${SYS_INFO}_python_${PYTHON_VERSION}"
    echo "$FORMATTED_STRING"
}

create_virtual_env() {
    local script_root_dir=$1
    local venv_dir=$2
    local python_bin=$3

    if [ ! -d "$venv_dir" ]; then
        echo "Directory $venv_dir does not exist."
        echo "Switching to $script_root_dir directory and creating virtual environment..."
        cd "$script_root_dir" || exit
        sudo $python_bin -m venv "$venv_dir"
        if [ $? -eq 0 ]; then
            echo "Virtual environment created successfully."
        else
            echo "Failed to create virtual environment."
            exit 1
        fi
    else
        echo "Directory $venv_dir already exists."
    fi

    VENV_PYTHON="$venv_dir/bin/python3.9"
    if [ -x "$VENV_PYTHON" ]; then
        echo "Virtual environment Python: $VENV_PYTHON"
    else
        echo "Python executable not found in virtual environment."
        exit 1
    fi
}

VENV_DIR=$(generate_formatted_string "$PYTHON_BIN")
VENV_FULL_DIR="$SCRIPT_ROOT_DIR/$VENV_DIR"
echo "Venv_Dir: $VENV_DIR"
create_virtual_env "$SCRIPT_ROOT_DIR" "$VENV_FULL_DIR" "$PYTHON_BIN"

# Update or create .PY_VENV_DIR with the new VENV_PYTHON path
echo "$VENV_FULL_DIR/bin/python3.9" | sudo tee "$PY_VENV_FILE" > /dev/null

# Print the updated .PY_VENV_DIR content
echo "Updated Venv_Dir:"
sudo cat "$PY_VENV_FILE"

# Use the updated Python binary path to print version information
VENV_PYTHON_BIN=$(sudo cat "$PY_VENV_FILE")
$VENV_PYTHON_BIN --version
$VENV_PYTHON_BIN -m pip --version

if ! command -v python3.9 &>/dev/null; then
    echo -e "\e[91mError: python3.9 is not installed or not found in PATH.\e[0m"
fi

if ! command -v pip3.9 &>/dev/null; then
    echo -e "\e[91mError: pip3.9 is not installed or not found in PATH.\e[0m"
fi
