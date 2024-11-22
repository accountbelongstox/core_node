
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
SCRIPT_ROOT_DIR=$(dirname "$DEPLOY_DIR")

main_script="$SCRIPT_ROOT_DIR/main.py"

OS_NAME=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
OS_VERSION=$(awk -F= '/^VERSION_ID=/ { print $2 }' /etc/os-release | tr -d '"')
PYTHON_VENV_DIR="venv_linux_${OS_NAME}_${OS_VERSION}"
PYTHON_INTERPRET="$PYTHON_VENV_DIR"
python_interpreter="$SCRIPT_ROOT_DIR/$PYTHON_INTERPRET/bin/python3"
sudo "$python_interpreter" "$main_script" deploy install

# Define the target folder
TARGET_DIR="$CURRENT_DIR/docker_compose_finish"

# Check if the target folder exists
if [ ! -d "$TARGET_DIR" ]; then
  echo "Directory $TARGET_DIR does not exist."
  exit 1
fi

# Function to sort files: first by numeric prefix, then by lexicographic order
sort_files() {
  # Separate files with numeric prefix and others
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

  # Sort numeric files by their numeric prefix
  IFS=$'\n' sorted_numeric_files=($(sort -t_ -k1,1n <<<"${numeric_files[*]}"))
  unset IFS

  # Sort other files lexicographically
  IFS=$'\n' sorted_other_files=($(sort <<<"${other_files[*]}"))
  unset IFS

  # Combine sorted arrays
  sorted_files=("${sorted_numeric_files[@]}" "${sorted_other_files[@]}")

  echo "${sorted_files[@]}"
}

# Get sorted files
sorted_files=$(sort_files)

# Iterate over sorted script files and execute them one by one
for script in $sorted_files; do
  if [ -f "$script" ] && [ -x "$script" ]; then
    echo "Executing script: $script"
    "$script"
  else
    echo "Skipping file: $script (not an executable file)"
  fi
done
