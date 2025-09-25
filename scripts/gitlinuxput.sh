#!/bin/bash
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
