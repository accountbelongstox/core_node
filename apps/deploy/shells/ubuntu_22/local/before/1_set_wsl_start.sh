#!/bin/bash

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$(dirname "$CURRENT_DIR")"

EXECUTE_COMMAND="sudo $PARENT_DIR/started/started.sh"
START_CRON="sudo service cron start"

ROOT_PROFILE="/root/.profile"

check_and_add_command() {
  local profile_file=$1
  local command_to_add=$2

  if ! grep -Fxq "$command_to_add" "$profile_file"; then
    echo "Adding command to $profile_file"
    echo -e "\n$command_to_add" >> "$profile_file"
    echo "Executing command in $profile_file"
    source "$profile_file"
  else
    echo "Command already present in $profile_file"
  fi
}

check_and_add_command "$ROOT_PROFILE" "$EXECUTE_COMMAND"
check_and_add_command "$ROOT_PROFILE" "$START_CRON"

echo "Setup completed."
