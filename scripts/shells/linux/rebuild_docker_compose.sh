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

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
SCRIPT_ROOT_DIR=$(dirname "$DEPLOY_DIR")

main_script="$SCRIPT_ROOT_DIR/main.py"

python_interpreter=$(sudo cat "/usr/local/.pcore_local/deploy/.PY_VENV_DIR")
echo sudo "$python_interpreter" "$main_script" deploy install
sudo "$python_interpreter" "$main_script" deploy install
TARGET_DIR="$CURRENT_DIR/docker_compose_finish"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Directory $TARGET_DIR does not exist."
  exit 1
fi

sort_files() {
  numeric_files=()
  other_files=()

  for script in "$TARGET_DIR"/*; do
    if [[ -f "$script" ]]; then
      filename=$(basename "$script")
      if [[ $filename =~ ^[0-9]+_ ]]; then
        numeric_files+=("$script")
      else
        other_files+=("$script")
      fi
    fi
  done

  IFS=$'\n' sorted_numeric_files=($(sort -t_ -k1,1n <<<"${numeric_files[*]}"))
  unset IFS

  IFS=$'\n' sorted_other_files=($(sort <<<"${other_files[*]}"))
  unset IFS

  sorted_files=("${sorted_numeric_files[@]}" "${sorted_other_files[@]}")

  echo "${sorted_files[@]}"
}

sorted_files=$(sort_files)

for script in $sorted_files; do
  if [ -f "$script" ] && [ -x "$script" ]; then
    echo "Executing script: $script"
    sudo "$script"
  else
    echo "Skipping file: $script (not an executable file)"
  fi
done
