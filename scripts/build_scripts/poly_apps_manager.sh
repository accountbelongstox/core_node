#!/usr/bin/env bash

# Locate poly_apps, assign ports, call the Python helper, and execute the selected command.

KEY_REPO_ROOT="repo_root"
KEY_POLY_ROOT="poly_root"
KEY_BASE_PORT="base_port"
KEY_TIMESTAMP="generated_at"
KEY_PROJECT_COUNT="project_count"
KEY_PROJECT_NAME="project_name"
KEY_PROJECT_PATH="project_path"
KEY_PROJECT_PORT="project_port"
KEY_PROJECT_TYPE="project_type"
KEY_SELECTION_INDEX="selection_index"
KEY_DISPLAY_LINE="display_line"
KEY_BUILD_MODE_LABEL="build_mode_label"
KEY_PLATFORM_LABEL="platform_label"
KEY_COMMAND_UNIX="command_unix"
KEY_ENV_COUNT="env_var_count"
KEY_ENV_NAME="env_var_name"
KEY_ENV_VALUE="env_var_value"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

resolve_poly_apps() {
  local start_dir="$1"
  local current="$start_dir"
  while true; do
    if [ -d "$current/poly_apps" ]; then
      printf "%s/poly_apps" "$current"
      return 0
    fi
    local parent
    parent="$(dirname "$current")"
    if [ "$parent" = "$current" ]; then
      break
    fi
    current="$parent"
  done
  printf ""
  return 1
}

POLY_APPS_ROOT="$(resolve_poly_apps "$SCRIPT_DIR")"
if [ -z "$POLY_APPS_ROOT" ]; then
  echo "Unable to locate poly_apps relative to $SCRIPT_DIR"
  exit 1
fi

REPO_ROOT="$(dirname "$POLY_APPS_ROOT")"
CACHE_DIR="$SCRIPT_DIR/build_py_tools"
STATE_FILE="$CACHE_DIR/poly_apps_state.txt"
SELECTION_FILE="$CACHE_DIR/poly_apps_selection.txt"

mkdir -p "$CACHE_DIR"
> "$STATE_FILE"

BASE_PORT=10000
printf "%s\t%s\n" "$KEY_REPO_ROOT" "$REPO_ROOT" >> "$STATE_FILE"
printf "%s\t%s\n" "$KEY_POLY_ROOT" "$POLY_APPS_ROOT" >> "$STATE_FILE"
printf "%s\t%s\n" "$KEY_BASE_PORT" "$BASE_PORT" >> "$STATE_FILE"
printf "%s\t%s\n" "$KEY_TIMESTAMP" "$(date -Is)" >> "$STATE_FILE"

mapfile -d '' PROJECT_DIRS < <(find "$POLY_APPS_ROOT" -mindepth 1 -maxdepth 1 -type d -printf "%f\0" | sort -z)
PROJECT_COUNT="${#PROJECT_DIRS[@]}"
printf "%s\t%s\n" "$KEY_PROJECT_COUNT" "$PROJECT_COUNT" >> "$STATE_FILE"

port_counter=$BASE_PORT
for idx in "${!PROJECT_DIRS[@]}"; do
  dir_name="${PROJECT_DIRS[$idx]}"
  full_path="$POLY_APPS_ROOT/$dir_name"
  printf "%s_%s\t%s\n" "$KEY_PROJECT_NAME" "$idx" "$dir_name" >> "$STATE_FILE"
  printf "%s_%s\t%s\n" "$KEY_PROJECT_PATH" "$idx" "$full_path" >> "$STATE_FILE"
  printf "%s_%s\t%s\n" "$KEY_PROJECT_PORT" "$idx" "$port_counter" >> "$STATE_FILE"
  printf "%s_%s\t\n" "$KEY_PROJECT_TYPE" "$idx" >> "$STATE_FILE"
  port_counter=$((port_counter + 1))
done

PYTHON_BIN=""
if command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "Python executable not found on PATH."
  exit 1
fi

echo "State cached to $STATE_FILE. Launching Python helper..."
rm -f "$SELECTION_FILE"
"$PYTHON_BIN" "$CACHE_DIR/poly_apps_helper.py"

if [ ! -f "$SELECTION_FILE" ]; then
  echo "Python helper did not create selection file."
  exit 1
fi

declare -A selection
while IFS=$'\t' read -r key value; do
  if [ -n "$key" ]; then
    selection["$key"]="$value"
  fi
done < "$SELECTION_FILE"

selected_path="${selection[$KEY_PROJECT_PATH]}"
if [ -z "$selected_path" ]; then
  echo "Selection missing project path."
  exit 1
fi

echo "Selection stored at $SELECTION_FILE"
echo "Switching directory to $selected_path"
cd "$selected_path" || exit 1

if [ -n "${selection[$KEY_DISPLAY_LINE]}" ]; then
  echo "Selected -> ${selection[$KEY_DISPLAY_LINE]}"
fi

if [ -n "${selection[$KEY_PROJECT_TYPE]}" ]; then
  echo "Project type: ${selection[$KEY_PROJECT_TYPE]}"
fi

if [ -n "${selection[$KEY_PROJECT_PORT]}" ]; then
  echo "Port assignment: ${selection[$KEY_PROJECT_PORT]}"
fi

if [ -n "${selection[$KEY_BUILD_MODE_LABEL]}" ]; then
  echo "Build mode: ${selection[$KEY_BUILD_MODE_LABEL]}"
fi
if [ -n "${selection[$KEY_PLATFORM_LABEL]}" ]; then
  echo "Platform: ${selection[$KEY_PLATFORM_LABEL]}"
fi

env_count="${selection[$KEY_ENV_COUNT]:-0}"
if [ -n "$env_count" ]; then
  for ((idx = 0; idx < env_count; idx++)); do
    name_key="${KEY_ENV_NAME}_${idx}"
    value_key="${KEY_ENV_VALUE}_${idx}"
    env_name="${selection[$name_key]}"
    env_value="${selection[$value_key]}"
    if [ -n "$env_name" ]; then
      echo "Exporting $env_name=$env_value"
      export "$env_name"="$env_value"
    }
  done
fi

command_to_run="${selection[$KEY_COMMAND_UNIX]}"
if [ -n "$command_to_run" ]; then
  echo "Executing command: $command_to_run"
  eval "$command_to_run"
else
  echo "Selection did not provide a command to run."
fi
