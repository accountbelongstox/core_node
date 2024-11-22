#!/bin/bash
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")


python_interpreter=$(sudo cat "/usr/local/.pcore_local/deploy/.PY_VENV_DIR")
main_script="$SCRIPT_ROOT_DIR/main.py"

echo sudo "$python_interpreter" "$main_script" deploy monitor
sudo "$python_interpreter" "$main_script" deploy monitor

 从ubuntu转为centos7的脚本，注意是centos7，不是centos9,支持的软件也要降为合适centos7的对应版本，以免出错。