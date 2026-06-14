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

# Variables declaration
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
PARENT_DIR_LEVEL_4="$(dirname "$PARENT_DIR_LEVEL_3")"
PARENT_DIR_LEVEL_5="$(dirname "$PARENT_DIR_LEVEL_4")"
PROJECT_ROOT="$PARENT_DIR_LEVEL_5"
STEP_NUMBER=19
TIMEOUT_SECONDS=120
SSH_PUB_PATH=""
SSH_KEY_PATH=""
NODE_PATH=""

# Source common functions and variables FIRST
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Use global temporary directory structure (AFTER sourcing common functions)
SCRIPT_TEMP_DIR=$(create_script_temp_dir "20_install_git_ssh")

# Local SSH key files (using corrected PROJECT_ROOT)
LOCAL_SSH_PUB_JS="$PROJECT_ROOT/scripts/git/git.ssh.id.ed.pub.js"
LOCAL_SSH_KEY_JS="$PROJECT_ROOT/scripts/git/git.ssh.id.ed.js"

# Multiple SSH installation locations (deduplicated)
SSH_LOCATIONS=(
    "$HOME/.ssh"
    "/etc/ssh/keys"
)

# Add /root/.ssh only if different from $HOME/.ssh
if [[ "$HOME/.ssh" != "/root/.ssh" && -d "/root" ]]; then
    SSH_LOCATIONS+=("/root/.ssh")
fi

# SSH key filenames
SSH_KEY_NAME="id_ed25519"
SSH_PUB_NAME="id_ed25519.pub"

# Function to find Node.js executable
find_node_executable() {
    if command -v node >/dev/null 2>&1; then
        NODE_PATH=$(command -v node)
        return 0
    elif command -v nodejs >/dev/null 2>&1; then
        NODE_PATH=$(command -v nodejs)
        return 0
    else
        print_error_from_common_functions "Node.js not found. Please install Node.js first."
        return 1
    fi
}

# Function to setup git environment - simplified version without dangerous path modifications
setup_git_environment() {
    print_step_from_common_functions "Setting up Git environment..."
    
    # Find git executable
    local git_path=""
    if command -v git >/dev/null 2>&1; then
        git_path=$(command -v git)
        print_success_from_common_functions "Found Git at: $git_path"
        return 0
    else
        print_error_from_common_functions "Git not found. Installing Git..."
        
        # Install git if not found
        if $USE_SUDO apt-get update && $USE_SUDO apt-get install -y git; then
            git_path=$(command -v git)
            print_success_from_common_functions "Git installed successfully at: $git_path"
            return 0
        else
            print_error_from_common_functions "Failed to install Git"
            return 1
        fi
    fi
}

# Function to validate SSH key file content
validate_ssh_key_content() {
    local pub_file="$1"
    local priv_file="$2"
    local location="$3"

    print_step_from_common_functions "Validating SSH keys in $location:"

    # Check public key
    print_step_from_common_functions "  Public key: $pub_file"
    if [[ ! -f "$pub_file" ]]; then
        print_error_from_common_functions "    �?File does not exist"
        return 1
    fi

    if [[ ! -s "$pub_file" ]]; then
        print_error_from_common_functions "    �?File is empty"
        return 1
    fi

    local pub_content=$(head -n 1 "$pub_file" 2>/dev/null)
    if [[ "$pub_content" =~ ^ssh-(rsa|dss|ed25519|ecdsa) ]]; then
        local key_type=$(echo "$pub_content" | awk '{print $1}')
        local key_comment=$(echo "$pub_content" | awk '{print $3}')
        print_success_from_common_functions "    �?Valid format: $key_type"
        if [[ -n "$key_comment" ]]; then
            print_step_from_common_functions "    Comment: $key_comment"
        fi
        print_step_from_common_functions "    Preview: ${pub_content:0:50}..."
    else
        print_error_from_common_functions "    �?Invalid SSH public key format"
        return 1
    fi

    # Check private key
    print_step_from_common_functions "  Private key: $priv_file"
    if [[ ! -f "$priv_file" ]]; then
        print_error_from_common_functions "    �?File does not exist"
        return 1
    fi

    if [[ ! -s "$priv_file" ]]; then
        print_error_from_common_functions "    �?File is empty"
        return 1
    fi

    local priv_header=$(head -n 1 "$priv_file" 2>/dev/null)
    if [[ "$priv_header" =~ ^-----BEGIN.*PRIVATE\ KEY----- ]]; then
        print_success_from_common_functions "    �?Valid format: $priv_header"
    else
        print_error_from_common_functions "    �?Invalid private key format"
        print_step_from_common_functions "    Header: $priv_header"
        return 1
    fi

    # Check permissions
    local pub_perms=$(stat -c "%a" "$pub_file" 2>/dev/null)
    local priv_perms=$(stat -c "%a" "$priv_file" 2>/dev/null)

    print_step_from_common_functions "  Permissions:"
    print_step_from_common_functions "    Public key: $pub_perms (should be 644 or 600)"
    print_step_from_common_functions "    Private key: $priv_perms (should be 600)"

    if [[ "$priv_perms" != "600" && "$priv_perms" != "400" ]]; then
        print_error_from_common_functions "    �?Private key permissions too open (should be 600)"
    fi

    return 0
}

# Function to test if SSH key pair exists and is valid in any location
# Matches PowerShell Test-SSHKeyPairExists logic
test_ssh_key_pair_exists() {
    local found_valid_pair=false

    # Check all SSH locations
    for ssh_location in "${SSH_LOCATIONS[@]}"; do
        if [[ ! -d "$ssh_location" ]]; then
            continue
        fi

        # Find all .pub files in the directory
        local pub_files=($(find "$ssh_location" -maxdepth 1 -name "*.pub" -type f 2>/dev/null))

        for pub_file in "${pub_files[@]}"; do
            # Get the private key path by removing .pub extension
            local priv_file="${pub_file%.pub}"

            # Check if both files exist and are not empty
            if [[ -f "$priv_file" && -s "$pub_file" && -s "$priv_file" ]]; then
                # Validate that the .pub file contains valid SSH key format
                if grep -q "^ssh-" "$pub_file" 2>/dev/null; then
                    local pub_name=$(basename "$pub_file")
                    local priv_name=$(basename "$priv_file")
                    print_success_from_common_functions "Found SSH key pair: $pub_name / $priv_name in $ssh_location"

                    # Validate and show key content
                    validate_ssh_key_content "$pub_file" "$priv_file" "$ssh_location"

                    found_valid_pair=true
                fi
            fi
        done
    done

    if [[ "$found_valid_pair" == true ]]; then
        return 0
    else
        return 1
    fi
}

# Function to verify local SSH key files exist
verify_local_ssh_files() {
    print_step_from_common_functions "Verifying local SSH key files..."
    
    # Debug information
    print_step_from_common_functions "Debug Path Information:"
    print_step_from_common_functions "  SCRIPT_CURRENT_DIR: $SCRIPT_CURRENT_DIR"
    print_step_from_common_functions "  PARENT_DIR_LEVEL_1: $PARENT_DIR_LEVEL_1"
    print_step_from_common_functions "  PARENT_DIR_LEVEL_2: $PARENT_DIR_LEVEL_2"
    print_step_from_common_functions "  PARENT_DIR_LEVEL_3: $PARENT_DIR_LEVEL_3"
    print_step_from_common_functions "  PARENT_DIR_LEVEL_4: $PARENT_DIR_LEVEL_4"
    print_step_from_common_functions "  PARENT_DIR_LEVEL_5: $PARENT_DIR_LEVEL_5"
    print_step_from_common_functions "  PROJECT_ROOT: $PROJECT_ROOT"
    print_step_from_common_functions "  LOCAL_SSH_PUB_JS: $LOCAL_SSH_PUB_JS"
    print_step_from_common_functions "  LOCAL_SSH_KEY_JS: $LOCAL_SSH_KEY_JS"
    
    # Check if PROJECT_ROOT directory exists
    if [[ ! -d "$PROJECT_ROOT" ]]; then
        print_error_from_common_functions "PROJECT_ROOT directory not found: $PROJECT_ROOT"
        return 1
    fi
    
    # Check if scripts/git directory exists
    local git_scripts_dir="$PROJECT_ROOT/scripts/git"
    if [[ ! -d "$git_scripts_dir" ]]; then
        print_error_from_common_functions "Git scripts directory not found: $git_scripts_dir"
        # List available directories for debugging
        print_step_from_common_functions "Available directories in PROJECT_ROOT:"
        if [[ -d "$PROJECT_ROOT" ]]; then
            ls -la "$PROJECT_ROOT" 2>/dev/null || print_error_from_common_functions "Cannot list PROJECT_ROOT contents"
        fi
        return 1
    fi

    if [[ ! -f "$LOCAL_SSH_PUB_JS" ]]; then
        print_error_from_common_functions "Local public key file not found: $LOCAL_SSH_PUB_JS"
        # List available files for debugging
        print_step_from_common_functions "Available files in git scripts directory:"
        ls -la "$git_scripts_dir" 2>/dev/null || print_error_from_common_functions "Cannot list git scripts directory"
        return 1
    fi

    if [[ ! -f "$LOCAL_SSH_KEY_JS" ]]; then
        print_error_from_common_functions "Local private key file not found: $LOCAL_SSH_KEY_JS"
        return 1
    fi

    print_success_from_common_functions "Local SSH key files verified"
    return 0
}

# Function to read password with asterisk display
read_password_with_asterisks() {
    local prompt="$1"
    local password=""
    local char=""

    printf "%s" "$prompt"

    # Disable echo and enable raw mode
    stty -echo

    while IFS= read -r -n 1 char; do
        # Handle Enter key
        if [[ -z "$char" ]]; then
            break
        fi

        # Handle Backspace (both Delete and Backspace keys)
        if [[ "$char" == $'\x7f' ]] || [[ "$char" == $'\x08' ]]; then
            if [ ${#password} -gt 0 ]; then
                password="${password%?}"
                printf "\b \b"
            fi
        else
            password+="$char"
            printf "*"
        fi
    done

    # Restore terminal settings
    stty echo
    echo

    # Return password via echo (to be captured by caller)
    echo "$password"
}

# Function to decrypt SSH keys with timeout
decrypt_ssh_keys() {
    local ask_msg="[Step $STEP_NUMBER] Do you have a password for the SSH key files? (y/n, default n, ${TIMEOUT_SECONDS}s timeout): "
    print_step_from_common_functions "$ask_msg"

    local has_password=false
    local user_input=""

    # Use read with timeout
    if read -t "$TIMEOUT_SECONDS" -n 1 user_input; then
        echo  # Add newline after input
        if [[ "$user_input" == "y" || "$user_input" == "Y" ]]; then
            has_password=true
        fi
    else
        echo  # Add newline after timeout
        print_step_from_common_functions "Timeout reached, defaulting to 'n'"
    fi

    if [[ "$has_password" == false ]]; then
        print_step_from_common_functions "Skipping password input and decryption."
        return 0
    fi

    print_step_from_common_functions "Please enter the password for the SSH key files:"
    local password=""
    local confirm_password=""

    printf "Password: "
    read -r password

    printf "Confirm Password: "
    read -r confirm_password
    
    if [[ "$password" != "$confirm_password" ]]; then
        print_error_from_common_functions "Passwords do not match. Please try again."
        return 1
    fi
    
    print_step_from_common_functions "Decrypting SSH key files to all locations..."

    # Decrypt to each SSH location
    for ssh_location in "${SSH_LOCATIONS[@]}"; do
        print_step_from_common_functions "Installing to: $ssh_location"

        # Create directory if it doesn't exist
        if [[ ! -d "$ssh_location" ]]; then
            if ! $USE_SUDO mkdir -p "$ssh_location"; then
                print_error_from_common_functions "Failed to create directory: $ssh_location"
                continue
            fi
            $USE_SUDO chmod 700 "$ssh_location"
        fi

        # Decrypt public key
        if ! $USE_SUDO "$NODE_PATH" "$LOCAL_SSH_PUB_JS" pwd "$password" "$ssh_location"; then
            print_error_from_common_functions "Failed to decrypt public key to $ssh_location"
            continue
        fi

        # Decrypt private key
        if ! $USE_SUDO "$NODE_PATH" "$LOCAL_SSH_KEY_JS" pwd "$password" "$ssh_location"; then
            print_error_from_common_functions "Failed to decrypt private key to $ssh_location"
            continue
        fi

        # Set correct ownership for system directories
        if [[ "$ssh_location" == "/root/.ssh" ]]; then
            $USE_SUDO chown -R root:root "$ssh_location"
        elif [[ "$ssh_location" == "/etc/ssh/keys" ]]; then
            $USE_SUDO chown -R root:root "$ssh_location"
        fi

        print_success_from_common_functions "SSH keys installed to: $ssh_location"
    done
    
    # Clear password variables
    password=""
    confirm_password=""
    
    return 0
}

# Function to set SSH key permissions for all locations
set_ssh_key_permissions() {
    print_step_from_common_functions "Setting file permissions for all SSH locations..."

    for ssh_location in "${SSH_LOCATIONS[@]}"; do
        if [[ -d "$ssh_location" ]]; then
            print_step_from_common_functions "Setting permissions for: $ssh_location"

            # Set permissions for SSH directory
            if ! $USE_SUDO chmod 700 "$ssh_location"; then
                print_error_from_common_functions "Failed to set SSH directory permissions: $ssh_location"
                continue
            fi

            # Set permissions for private key files (600 - owner read/write only)
            for key_file in "$ssh_location"/*; do
                if [[ -f "$key_file" && ! "$key_file" == *.pub && ! "$key_file" == *.js ]]; then
                    if ! $USE_SUDO chmod 600 "$key_file"; then
                        print_error_from_common_functions "Failed to set permissions for $key_file"
                    fi
                fi
            done

            # Set permissions for public key files (644 - owner read/write, others read)
            for pub_file in "$ssh_location"/*.pub; do
                if [[ -f "$pub_file" ]]; then
                    if ! $USE_SUDO chmod 644 "$pub_file"; then
                        print_error_from_common_functions "Failed to set permissions for $pub_file"
                    fi
                fi
            done

            print_success_from_common_functions "Permissions set for: $ssh_location"
        fi
    done

    return 0
}

# Function to update authorized_keys files
update_authorized_keys() {
    print_step_from_common_functions "Updating authorized_keys files..."

    for ssh_location in "${SSH_LOCATIONS[@]}"; do
        if [[ -d "$ssh_location" ]]; then
            local pub_file="$ssh_location/$SSH_PUB_NAME"
            local auth_keys="$ssh_location/authorized_keys"

            if [[ -f "$pub_file" ]]; then
                local pub_content=$(cat "$pub_file" 2>/dev/null)

                if [[ -n "$pub_content" ]]; then
                    # Check if the key is already in authorized_keys
                    if [[ -f "$auth_keys" ]] && grep -Fq "$pub_content" "$auth_keys" 2>/dev/null; then
                        print_step_from_common_functions "Public key already in $auth_keys"
                    else
                        # Add the public key to authorized_keys
                        echo "$pub_content" | $USE_SUDO tee -a "$auth_keys" > /dev/null
                        $USE_SUDO chmod 600 "$auth_keys"
                        print_success_from_common_functions "Added public key to $auth_keys"
                    fi
                fi
            fi
        fi
    done

    return 0
}

# Function to remove all SSH keys from all locations
remove_all_ssh_keys() {
    print_step_from_common_functions "Removing all SSH keys from all locations..."

    for ssh_location in "${SSH_LOCATIONS[@]}"; do
        if [[ -d "$ssh_location" ]]; then
            print_step_from_common_functions "Cleaning SSH keys in: $ssh_location"

            # Remove all key files
            for pub_file in "$ssh_location"/*.pub; do
                if [[ -f "$pub_file" ]]; then
                    $USE_SUDO rm -f "$pub_file"
                    print_step_from_common_functions "  Removed: $pub_file"
                fi
            done

            # Remove private keys (files without extension or with known key extensions)
            for key_file in "$ssh_location"/id_*; do
                if [[ -f "$key_file" && ! "$key_file" == *.pub && ! "$key_file" == *.js ]]; then
                    $USE_SUDO rm -f "$key_file"
                    print_step_from_common_functions "  Removed: $key_file"
                fi
            done

            # Also remove authorized_keys
            if [[ -f "$ssh_location/authorized_keys" ]]; then
                $USE_SUDO rm -f "$ssh_location/authorized_keys"
                print_step_from_common_functions "  Removed: $ssh_location/authorized_keys"
            fi
        fi
    done

    print_success_from_common_functions "All SSH keys removed successfully"
    return 0
}

# Function to clean temporary files (if any)
clean_temporary_files() {
    # Since we use local files directly, no cleanup needed
    # This function is kept for consistency with the original design
    print_step_from_common_functions "No temporary files to clean up"
}

# Function to find alternative SSH key locations
find_alternative_ssh_keys() {
    print_step_from_common_functions "Searching for SSH keys in alternative locations..."
    
    # Common alternative locations
    local alt_locations=(
        "/mnt/c/programing/core_node/scripts/git"
        "/mnt/d/programing/core_node/scripts/git"
        "/home/*/core_node/scripts/git"
        "/opt/core_node/scripts/git"
        "/var/core_node/scripts/git"
    )
    
    for alt_location in "${alt_locations[@]}"; do
        local alt_pub_js="$alt_location/git.ssh.id.ed.pub.js"
        local alt_key_js="$alt_location/git.ssh.id.ed.js"
        
        if [[ -f "$alt_pub_js" && -f "$alt_key_js" ]]; then
            print_success_from_common_functions "Found SSH keys in alternative location: $alt_location"
            LOCAL_SSH_PUB_JS="$alt_pub_js"
            LOCAL_SSH_KEY_JS="$alt_key_js"
            return 0
        fi
    done
    
    print_error_from_common_functions "No SSH key files found in any alternative locations"
    return 1
}

# Main function for Step 19: Install Git SSH Keys
step20_install_git_ssh() {
    print_header_from_common_functions "Step 19: Installing Git SSH Keys"
    print_step_from_common_functions "This step will install SSH keys for Git authentication."

    # Setup Git environment first
    if ! setup_git_environment; then
        print_error_from_common_functions "Failed to setup Git environment"
        return 1
    fi

    # Check if SSH key pair already exists and is valid
    if test_ssh_key_pair_exists; then
        print_success_from_common_functions "Valid SSH key pair already exists."

        # Ask if user wants to reinstall
        local ask_msg="Do you want to reinstall and clear all existing SSH keys? (y/N, default N, ${TIMEOUT_SECONDS}s timeout): "
        print_step_from_common_functions "$ask_msg"

        local should_reinstall=false
        local user_input=""

        # Use read with timeout
        if read -t "$TIMEOUT_SECONDS" -n 1 user_input; then
            echo  # Add newline after input
            if [[ "$user_input" == "y" || "$user_input" == "Y" ]]; then
                should_reinstall=true
            fi
        else
            echo  # Add newline after timeout
            print_step_from_common_functions "Timeout reached, defaulting to 'N' (skip reinstallation)"
        fi

        if [[ "$should_reinstall" == false ]]; then
            print_step_from_common_functions "Skipping reinstallation, keeping existing SSH keys."
            return 0
        fi

        # User chose to reinstall - remove all existing keys
        print_step_from_common_functions "User chose to reinstall - removing all existing SSH keys..."
        if ! remove_all_ssh_keys; then
            print_error_from_common_functions "Failed to remove existing SSH keys"
            return 1
        fi

        print_step_from_common_functions "Proceeding with fresh installation..."
    fi
    
    # Find Node.js executable
    if ! find_node_executable; then
        return 1
    fi

    # Verify local SSH key files exist
    if ! verify_local_ssh_files; then
        print_step_from_common_functions "Primary SSH key location failed, trying alternatives..."
        if ! find_alternative_ssh_keys; then
            print_error_from_common_functions "Cannot find SSH key files in any location"
            return 1
        fi
    fi
    
    # Decrypt SSH keys (with timeout)
    if ! decrypt_ssh_keys; then
        return 1
    fi
    
    # Set proper permissions
    if ! set_ssh_key_permissions; then
        return 1
    fi

    # Update authorized_keys files
    update_authorized_keys

    print_success_from_common_functions "SSH key installation completed successfully!"
    print_step_from_common_functions "SSH keys are now available at:"

    # Show all installed SSH key locations
    for ssh_location in "${SSH_LOCATIONS[@]}"; do
        if [[ -d "$ssh_location" ]]; then
            # Find all .pub files in the directory
            local pub_files=($(find "$ssh_location" -maxdepth 1 -name "*.pub" -type f 2>/dev/null))

            for pub_file in "${pub_files[@]}"; do
                local priv_file="${pub_file%.pub}"
                if [[ -f "$priv_file" ]]; then
                    print_step_from_common_functions "  Location: $ssh_location"
                    print_step_from_common_functions "    Public key: $pub_file"
                    print_step_from_common_functions "    Private key: $priv_file"
                fi
            done
        fi
    done

    return 0
}

# Execute main function
step20_install_git_ssh

# Clean up temporary files
clean_temporary_files
