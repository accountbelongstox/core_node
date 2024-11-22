##!/bin/bash
#CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
#SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")
#PYTHON_BIN="/usr/local/bin/python3.9"
#PIP_BIN="/usr/local/bin/pip3.9"
#if [[ ! -x "$PYTHON_BIN" ]] || [[ ! -x "$PIP_BIN" ]]; then
#    echo "Python 3.9 or Pip is not installed. Installing pyenv and Python 3.9.6..."
#    sudo rm -rf /root/.pyenv
#    sudo rm -rf /usr/local/.pyenv
#    curl https://pyenv.run | bash
#
#    sudo mv ~/.pyenv /usr/local/.pyenv
#
#    export PYENV_ROOT="/usr/local/.pyenv"
#    export PATH="$PYENV_ROOT/bin:$PATH"
#    eval "$(pyenv init --path)"
#    eval "$(pyenv init -)"
#    eval "$(pyenv virtualenv-init -)"
#
#    pyenv install 3.9.6
##    pyenv global 3.9.6
#    sudo rm -rf $PYTHON_BIN
#    sudo rm -rf $PIP_BIN
#    ln -s "$PYENV_ROOT/versions/3.9.6/bin/python3.9" "$PYTHON_BIN"
#    ln -s "$PYENV_ROOT/versions/3.9.6/bin/pip3.9" "$PIP_BIN"
#    current_python_version=$("$PYTHON_BIN" --version 2>&1)
#    current_pip_version=$("$PIP_BIN" --version 2>&1)
#    echo "New Python version: $current_python_version"
#    echo "New Pip version: $current_pip_version"
#else
#    echo "Python 3.9 and Pip are already installed."
#fi
#
## Get OS details
#OS_NAME=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
#OS_VERSION=$(awk -F= '/^VERSION_ID=/ { print $2 }' /etc/os-release | tr -d '"')
#
## Set virtual environment directory
#PYTHON_VENV_DIR="venv_linux_${OS_NAME}_${OS_VERSION}"
#VENV_DIR="$SCRIPT_ROOT_DIR/$PYTHON_VENV_DIR"
#python_interpreter="$VENV_DIR/bin/python3"
#main_script="$SCRIPT_ROOT_DIR/main.py"
#
## Save virtual environment directory path
#echo "Venv_Dir: $VENV_DIR"
#
## Create virtual environment if it does not exist
#if [ ! -d "$VENV_DIR" ]; then
#    echo "$PYTHON_VENV_DIR directory does not exist. Creating..."
#    cd "$SCRIPT_ROOT_DIR" || exit
#    "$PYTHON_BIN" -m venv "$VENV_DIR"
#    echo -e "\e[91m Venv-Python: $VENV_DIR/bin/python3.9\e[0m"
#else
#    echo -e "\e[91m Venv-Python: $VENV_DIR/bin/python3.9\e[0m"
#    echo "$VENV_DIR directory already exists."
#fi
#
## Check Python and Pip versions in the virtual environment
#sudo "$python_interpreter" --version
#sudo "$python_interpreter" -m pip --version
#
## Execute the main script
#echo Executing sudo "$python_interpreter" "$main_script" deploy init_info
#sudo "$python_interpreter" "$main_script" deploy set_pip_source
#sudo "$python_interpreter" "$main_script" deploy init_info
#
#
