#!/bin/bash
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")


python_interpreter=$(sudo cat "/usr/local/.pcore_local/deploy/.PY_VENV_DIR")
main_script="$SCRIPT_ROOT_DIR/main.py"

echo sudo "$python_interpreter" "$main_script" deploy monitor
sudo "$python_interpreter" "$main_script" deploy monitor
