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
