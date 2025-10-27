#!/bin/bash
# Super Launch Helper Library
# Provides utilities for managing super launch scripts and symlinks
#
# Super launch allows applications to run with special parameters (e.g., --no-sandbox for VSCode)
# This library manages the setup of /usr/local/super_bin and /usr/local/super_scripts

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

# Ensure super directories exist
ensure_super_directories() {
    local super_bin_dir="/usr/local/super_bin"
    local super_scripts_dir="/usr/local/super_scripts"

    if [ ! -d "$super_bin_dir" ]; then
        $USE_SUDO mkdir -p "$super_bin_dir"
        $USE_SUDO chmod 755 "$super_bin_dir"
    fi

    if [ ! -d "$super_scripts_dir" ]; then
        $USE_SUDO mkdir -p "$super_scripts_dir"
        $USE_SUDO chmod 755 "$super_scripts_dir"
    fi

    echo "$super_bin_dir:$super_scripts_dir"
}

# Find executable in system PATH
find_executable() {
    local exec_name="$1"
    local found_path=""

    # First check if it's already in super_bin (from previous run)
    if [ -f "/usr/local/super_bin/$exec_name" ]; then
        echo "/usr/local/super_bin/$exec_name"
        return 0
    fi

    # Check common system paths
    local search_paths=(
        "/usr/local/bin/$exec_name"
        "/usr/bin/$exec_name"
        "/bin/$exec_name"
        "/usr/local/sbin/$exec_name"
        "/usr/sbin/$exec_name"
        "/sbin/$exec_name"
    )

    for path in "${search_paths[@]}"; do
        if [ -f "$path" ] && [ -x "$path" ]; then
            # Check if it's a symlink created by us (pointing to super_scripts)
            if [ ! -L "$path" ] || [ ! -L "$path" ]; then
                # If it's not a symlink, or it's a symlink but not pointing to super_scripts
                local link_target=$(readlink -f "$path" 2>/dev/null)
                if [ ! -z "$link_target" ] && [[ "$link_target" != */super_scripts/* ]]; then
                    # This is either a real file or a symlink not created by us
                    found_path="$path"
                    break
                elif [ ! -L "$path" ]; then
                    # It's a real file (not a symlink)
                    found_path="$path"
                    break
                fi
            fi
        fi
    done

    echo "$found_path"
}

# Check if path is a symlink and get its target
is_symlink_to() {
    local path="$1"
    local target="$2"

    if [ -L "$path" ]; then
        local link_target=$(readlink -f "$path")
        if [ "$link_target" = "$target" ] || [ "$link_target" = "$(readlink -f "$target")" ]; then
            return 0
        fi
    fi

    return 1
}

# Move executable to super_bin directory (idempotent - handles already moved files)
move_to_super_bin() {
    local exec_path="$1"
    local exec_name=$(basename "$exec_path")
    local super_bin_dir="/usr/local/super_bin"
    local super_bin_path="$super_bin_dir/$exec_name"

    # If file is already in super_bin, it's already moved
    if [ "$exec_path" = "$super_bin_path" ] && [ -f "$super_bin_path" ]; then
        echo "$super_bin_path"
        return 0
    fi

    if [ ! -f "$exec_path" ]; then
        return 1
    fi

    ensure_super_directories > /dev/null

    # Remove existing file in super_bin if it exists (for update case)
    if [ -f "$super_bin_path" ]; then
        $USE_SUDO rm -f "$super_bin_path"
    fi

    # Move the executable to super_bin
    $USE_SUDO mv "$exec_path" "$super_bin_path"
    $USE_SUDO chmod 755 "$super_bin_path"

    echo "$super_bin_path"
}

# Generate default super launch command
generate_default_super_command() {
    local exec_name="$1"
    echo "sudo $exec_name"
}

# Create super launch script (idempotent - updates on config change)
create_super_launch_script() {
    local exec_name="$1"
    local super_command="$2"
    local super_scripts_dir="/usr/local/super_scripts"

    if [ -z "$super_command" ] || [ "$super_command" = "true" ]; then
        super_command=$(generate_default_super_command "$exec_name")
    fi

    ensure_super_directories > /dev/null

    local script_path="$super_scripts_dir/${exec_name}.sh"

    # Check if script already exists
    if [ -f "$script_path" ]; then
        # Read existing script content (skip shebang line)
        local existing_command=$(tail -n +2 "$script_path")

        # If command hasn't changed, don't update
        if [ "$existing_command" = "$super_command" ]; then
            echo "$script_path"
            return 0
        fi
    fi

    # Create the super launch script
    cat > "/tmp/${exec_name}_super.sh" << 'EOF'
#!/bin/bash
SUPER_COMMAND_PLACEHOLDER
EOF

    # Replace placeholder with actual command
    sed -i "s|SUPER_COMMAND_PLACEHOLDER|$super_command|g" "/tmp/${exec_name}_super.sh"

    # Move to super_scripts directory
    $USE_SUDO mv "/tmp/${exec_name}_super.sh" "$script_path"
    $USE_SUDO chmod 755 "$script_path"

    echo "$script_path"
}

# Create symlink from /usr/local/bin to super script (idempotent)
create_super_symlink() {
    local exec_name="$1"
    local super_scripts_dir="/usr/local/super_scripts"
    local bin_path="/usr/local/bin/$exec_name"
    local script_path="$super_scripts_dir/${exec_name}.sh"

    if [ ! -f "$script_path" ]; then
        return 1
    fi

    # Remove existing symlink/binary if it exists
    if [ -e "$bin_path" ] || [ -L "$bin_path" ]; then
        $USE_SUDO rm -f "$bin_path"
    fi

    # Create symlink from bin to super script
    $USE_SUDO ln -sf "$script_path" "$bin_path"

    return 0
}

# Setup super launch for an executable (idempotent - safe to run multiple times)
setup_super_launch() {
    local exec_name="$1"
    local super_command="$2"
    local log_message_func="${3:-echo}"

    $log_message_func "Setting up super launch for: $exec_name"

    # Find existing executable (checks super_bin first, then system paths)
    local exec_path=$(find_executable "$exec_name")

    if [ -z "$exec_path" ]; then
        $log_message_func "Warning: Executable not found for: $exec_name"
        return 1
    fi

    $log_message_func "Found executable at: $exec_path"

    # Move to super_bin (idempotent - handles already moved files)
    local super_bin_path=$(move_to_super_bin "$exec_path")
    if [ -z "$super_bin_path" ]; then
        $log_message_func "Error: Failed to move $exec_name to super_bin"
        return 1
    fi

    # If already in super_bin, just log it
    if [ "$exec_path" != "$super_bin_path" ]; then
        $log_message_func "Moved to super_bin: $super_bin_path"
    else
        $log_message_func "Already in super_bin: $super_bin_path"
    fi

    # Create super launch script (idempotent - updates if config changed)
    local script_path=$(create_super_launch_script "$exec_name" "$super_command")
    if [ -z "$script_path" ]; then
        $log_message_func "Error: Failed to create super launch script for $exec_name"
        return 1
    fi

    $log_message_func "Created/Updated super launch script: $script_path"

    # Create symlink (idempotent - recreates if needed)
    if ! create_super_symlink "$exec_name"; then
        $log_message_func "Error: Failed to create symlink for $exec_name"
        return 1
    fi

    $log_message_func "Created/Updated symlink: /usr/local/bin/$exec_name -> $script_path"

    return 0
}

# Export functions for use by other scripts
export -f ensure_super_directories
export -f find_executable
export -f is_symlink_to
export -f move_to_super_bin
export -f generate_default_super_command
export -f create_super_launch_script
export -f create_super_symlink
export -f setup_super_launch
