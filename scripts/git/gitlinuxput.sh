#!/bin/bash

# Get the current directory of the script
current_dir="$(dirname "$(readlink -f "$0")")"
echo $current_dir
cd $current_dir
set_executable() {
    find "$1" -type f -name "*.sh" -exec chmod +x {} \;
}
GIT_SCRIPT_DIR="$current_dir/git"
GIT_PUT_SCRIPTS=()
GIT_PUT_SCRIPTS+=("$GIT_SCRIPT_DIR/linuxgitee.sh")
GIT_PUT_SCRIPTS+=("$GIT_SCRIPT_DIR/linux_github.sh")
GIT_PUT_SCRIPTS+=("$GIT_SCRIPT_DIR/linux_local.sh")
for script in "${GIT_PUT_SCRIPTS[@]}"; do
    sudo chmod +x "$script"
    echo "$script"
    "$script"
done

set_executable "./scripts"   # For all subdirectories in ./scripts
set_executable "./apps"      # For all subdirectories in ./apps
find ./ -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} \;
echo "All .sh scripts have been set as executable."
# Echo a completion message
echo "All shell scripts have been executed."
