# CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
# SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")
# current_python_version=$(python3.9 --version 2>&1)
# current_pip_version=$(pip3.9 --version 2>&1)

# echo "Current Python version: $current_python_version"
# echo "Current Pip version: $current_pip_version"

# if [[ $current_python_version != Python\ 3.9* ]] || [[ $current_pip_version != pip* ]]; then
#     echo "Python 3.9 or Pip 21 is not the default version. Installing Python 3.9 and Pip 21..."

#     sudo apt update && sudo apt upgrade -y
#     sudo apt install -y wget build-essential libreadline-dev libncursesw5-dev \
#         libssl-dev libsqlite3-dev tk-dev libgdbm-dev libc6-dev libbz2-dev \
#         libffi-dev zlib1g-dev openssl libssl-dev libbz2-dev libreadline-dev \
#         libsqlite3-dev llvm libncurses5-dev xz-utils tk-dev

#     sudo apt-get -y install libncurses5-dev libncursesw5-dev

#     if [ ! -f /tmp/Python-3.9.16.tgz ]; then
#         sudo wget --no-check-certificate -P /tmp https://www.python.org/ftp/python/3.9.16/Python-3.9.16.tgz
#     else
#         echo "/tmp/Python-3.9.16.tgz exists, skipping download."
#     fi

#     if [ ! -d /tmp/Python-3.9.16 ]; then
#         sudo tar xzf /tmp/Python-3.9.16.tgz -C /tmp
#     else
#         echo "/tmp/Python-3.9.16 exists."
#     fi

#     sudo apt-get install openssl
#     sudo apt-get install libssl-dev

#     cd /tmp/Python-3.9.16
#     sudo ./configure --enable-optimizations
#     sudo make
#     sudo make altinstall

#     BIN_DIR="/usr/local/bin"
#     USR_BIN="/usr/bin"

#     for cmd in python3.9 pip3.9; do
#         if [ -L $USR_BIN/$cmd ]; then
#             sudo rm $USR_BIN/$cmd
#         fi
#         sudo ln -s $BIN_DIR/$cmd $USR_BIN/$cmd
#         sudo chmod +x $BIN_DIR/$cmd
#     done

#     echo "Python 3.9 installed successfully."
# else
#     echo "Python 3.9 is already installed."
# fi


# main_script="$SCRIPT_ROOT_DIR/main.py"
# sys_python_interpreter="$BIN_DIR/python3.9"
# sudo $sys_python_interpreter --version
# sudo $sys_python_interpreter -m pip --version
# echo "Executing sudo $sys_python_interpreter $main_script init"
# sudo $sys_python_interpreter "$main_script" init

# echo "Venv_Dir:$VENV_DIR"

# if ! command -v python3.9 &>/dev/null; then
#     echo -e "\e[91mError: python3.9 is not installed or not found in PATH.\e[0m"
# fi

# if ! command -v pip3.9 &>/dev/null; then
#     echo -e "\e[91mError: pip3.9 is not installed or not found in PATH.\e[0m"
# fi
