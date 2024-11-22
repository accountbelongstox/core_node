#!/bin/bash
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")

OS_NAME=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
OS_VERSION=$(awk -F= '/^VERSION_ID=/ { print $2 }' /etc/os-release | tr -d '"')

PYTHON_VENV_DIR="venv_linux_${OS_NAME}_${OS_VERSION}"
VENV_DIR="$SCRIPT_ROOT_DIR/$PYTHON_VENV_DIR"
python_interpreter="$VENV_DIR/bin/python3"
main_script="$SCRIPT_ROOT_DIR/main.py"

echo sudo "$python_interpreter" "$main_script" deploy monitor
sudo "$python_interpreter" "$main_script" deploy monitor
