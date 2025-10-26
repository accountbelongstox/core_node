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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare variables
CURRENT_USER=${USER:-$(whoami)}
DISTRO=$(lsb_release -is 2>/dev/null || echo "Unknown")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "11_install_sudo")
LOG_FILE="$SCRIPT_TEMP_DIR/sudo_install_$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="$SCRIPT_TEMP_DIR/sudo_backup_$(date +%Y%m%d_%H%M%S)"

# Logging function
log_message() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

print_step_from_common_functions "Installing sudo for $DISTRO..."
log_message "Starting sudo installation for $DISTRO..."

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    print_error_from_common_functions "This script must be run as root to install sudo!"
    echo "Please run: su - root"
    echo "Then execute this script again."
    exit 1
fi

# Check if sudo is already installed
if command -v sudo >/dev/null 2>&1; then
    print_success_from_common_functions "sudo is already installed."
else
    print_step_from_common_functions "Installing sudo package..."
    $USE_SUDO apt-get update
    if $USE_SUDO apt-get install -y sudo; then
        print_success_from_common_functions "sudo installed successfully."
    else
        print_error_from_common_functions "Failed to install sudo package."
        exit 1
    fi
fi

# Ensure sudo group exists
if ! getent group sudo >/dev/null 2>&1; then
    print_step_from_common_functions "Creating sudo group..."
    $USE_SUDO groupadd sudo
fi

# Add user to sudo group if not already a member
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
    if id -nG "$CURRENT_USER" | grep -qw "sudo"; then
        print_success_from_common_functions "User $CURRENT_USER is already in the sudo group."
    else
        print_step_from_common_functions "Adding user $CURRENT_USER to sudo group..."
        if $USE_SUDO usermod -aG sudo "$CURRENT_USER"; then
            print_success_from_common_functions "User $CURRENT_USER added to sudo group successfully."
            print_info_from_common_functions "Please log out and log back in for changes to take effect."
        else
            print_error_from_common_functions "Failed to add user $CURRENT_USER to sudo group."
            exit 1
        fi
    fi
else
    print_info_from_common_functions "Running as root user, no need to add to sudo group."
fi

# Create backup before modifications
create_backup() {
    log_message "Creating backup directory: $BACKUP_DIR"
    $USE_SUDO mkdir -p "$BACKUP_DIR"

    # Backup current sudo binary permissions
    if [ -f "/usr/bin/sudo" ]; then
        $USE_SUDO ls -la /usr/bin/sudo > "$BACKUP_DIR/sudo_permissions_before.txt"
        log_message "Backed up sudo permissions to $BACKUP_DIR/sudo_permissions_before.txt"
    fi

    # Backup /usr/local/bin contents
    if [ -d "/usr/local/bin" ]; then
        $USE_SUDO ls -la /usr/local/bin > "$BACKUP_DIR/usr_local_bin_before.txt"
        log_message "Backed up /usr/local/bin contents to $BACKUP_DIR/usr_local_bin_before.txt"
    fi
}

# Scan and fix dangerous symlinks in /usr/local/bin
fix_dangerous_symlinks() {
    log_message "=== Scanning for dangerous symlinks in /usr/local/bin ==="
    
    if [ ! -d "/usr/local/bin" ]; then
        log_message "/usr/local/bin directory does not exist"
        return 0
    fi
    
    local dangerous_count=0
    local fixed_count=0
    
    # Protected system binaries that should never be symlinked in /usr/local/bin
    local protected_binaries=(
        "sudo"
        "su"
        "passwd"
        "chown"
        "chmod"
        "chroot"
        "mount"
        "umount"
        "init"
        "systemctl"
        "service"
    )
    
    for file in /usr/local/bin/*; do
        if [ -L "$file" ]; then
            local link_name=$(basename "$file")
            local target=$(readlink -f "$file" 2>/dev/null)
            
            # Check if this is a protected binary
            for protected in "${protected_binaries[@]}"; do
                if [ "$link_name" = "$protected" ]; then
                    log_message "DANGEROUS: Found protected binary symlink: $file -> $target"
                    dangerous_count=$((dangerous_count + 1))

                    # Remove the dangerous symlink
                    if $USE_SUDO rm -f "$file"; then
                        log_message "  [REMOVED] Dangerous symlink removed: $file"
                        fixed_count=$((fixed_count + 1))
                    else
                        log_message "  [FAIL] Failed to remove dangerous symlink: $file"
                    fi
                    break
                fi
            done
            
            # Check if target points to system directories
            if [[ "$target" == /usr/bin/* ]] || [[ "$target" == /bin/* ]] || [[ "$target" == /sbin/* ]] || [[ "$target" == /usr/sbin/* ]]; then
                local target_name=$(basename "$target")
                for protected in "${protected_binaries[@]}"; do
                    if [ "$target_name" = "$protected" ]; then
                        log_message "DANGEROUS: Found symlink to protected system binary: $file -> $target"
                        dangerous_count=$((dangerous_count + 1))

                        # Remove the dangerous symlink
                        if $USE_SUDO rm -f "$file"; then
                            log_message "  [REMOVED] Dangerous symlink removed: $file"
                            fixed_count=$((fixed_count + 1))
                        else
                            log_message "  [FAIL] Failed to remove dangerous symlink: $file"
                        fi
                        break
                    fi
                done
            fi
        fi
    done
    
    log_message "Found $dangerous_count dangerous symlinks, removed $fixed_count"
}

# Function to repair sudo permissions with enhanced logging
repair_sudo_permissions() {
    log_message "=== Fixing sudo binary permissions ==="
    
    local sudo_locations=(
        "/usr/bin/sudo"
        "/bin/sudo"
        "/sbin/sudo"
        "/usr/sbin/sudo"
    )
    
    local fixed_count=0
    
    for sudo_path in "${sudo_locations[@]}"; do
        if [ -f "$sudo_path" ]; then
            log_message "Processing sudo binary: $sudo_path"
            
            # Get current permissions
            local current_perms=$(stat -c "%a" "$sudo_path" 2>/dev/null)
            local current_owner=$(stat -c "%U:%G" "$sudo_path" 2>/dev/null)
            
            log_message "  Current permissions: $current_perms"
            log_message "  Current owner: $current_owner"

            # Fix ownership
            if $USE_SUDO chown root:root "$sudo_path"; then
                log_message "  [OK] Fixed ownership to root:root"
            else
                log_message "  [FAIL] Failed to fix ownership"
                continue
            fi

            # Fix permissions (4755 = setuid + rwxr-xr-x)
            if $USE_SUDO chmod 4755 "$sudo_path"; then
                log_message "  [OK] Fixed permissions to 4755 (setuid enabled)"
                fixed_count=$((fixed_count + 1))
            else
                log_message "  [FAIL] Failed to fix permissions"
            fi
            
            # Verify fix
            local new_perms=$(stat -c "%a" "$sudo_path" 2>/dev/null)
            local new_owner=$(stat -c "%U:%G" "$sudo_path" 2>/dev/null)
            log_message "  New permissions: $new_perms"
            log_message "  New owner: $new_owner"
            
        else
            log_message "Sudo binary not found at: $sudo_path"
        fi
    done
    
    log_message "Fixed $fixed_count sudo binaries"
}

# Function to repair /usr/local/bin permissions
repair_usr_local_bin_permissions() {
    print_step_from_common_functions "Repairing /usr/local/bin permissions..."

    if [ ! -d "/usr/local/bin" ]; then
        print_warning_from_common_functions "/usr/local/bin directory does not exist, creating it..."
        $USE_SUDO mkdir -p /usr/local/bin
        $USE_SUDO chmod 755 /usr/local/bin
        return 0
    fi

    print_step_from_common_functions "Scanning /usr/local/bin for permission issues..."
    local fixed_count=0
    local total_count=0

    # Process all files in /usr/local/bin
    for file in /usr/local/bin/*; do
        if [ -f "$file" ] || [ -L "$file" ]; then
            total_count=$((total_count + 1))
            local filename=$(basename "$file")
            local current_perms=$(stat -c "%a" "$file" 2>/dev/null)

            # Skip system critical files that should have special permissions
            if [[ "$filename" == "sudo" || "$filename" == "su" || "$filename" == "passwd" ]]; then
                print_info_from_common_functions "Skipping system critical file: $filename"
                continue
            fi

            # Check if permissions are not 755
            if [ "$current_perms" != "755" ]; then
                print_step_from_common_functions "Fixing permissions for $filename (was $current_perms, setting to 755)"
                $USE_SUDO chmod 755 "$file"

                # Verify the change
                local new_perms=$(stat -c "%a" "$file" 2>/dev/null)
                if [ "$new_perms" = "755" ]; then
                    fixed_count=$((fixed_count + 1))
                    log_message "  [OK] Fixed: $filename"
                else
                    log_message "  [FAIL] Failed to fix: $filename"
                fi
            else
                log_message "  [OK] Already correct: $filename ($current_perms)"
            fi
        fi
    done

    print_success_from_common_functions "Permission repair completed: $fixed_count/$total_count files fixed"
}

# Test sudo functionality with comprehensive checks
test_sudo_functionality() {
    log_message "=== Testing sudo functionality ==="

    # Test if sudo command exists
    if ! command -v sudo >/dev/null 2>&1; then
        log_message "[FAIL] sudo command not found in PATH"
        return 1
    fi

    log_message "[OK] sudo command found in PATH"

    # Test sudo version
    if sudo --version >/dev/null 2>&1; then
        local sudo_version=$(sudo --version | head -n1)
        log_message "[OK] sudo version: $sudo_version"
    else
        log_message "[FAIL] sudo --version failed"
        return 1
    fi

    # Test sudo permissions (this will work since we're root)
    if sudo -n true 2>/dev/null; then
        log_message "[OK] sudo permissions test passed"
    else
        log_message "[INFO] sudo requires password (normal for non-root users)"
    fi

    return 0
}

# Function to check and repair system integrity
check_system_integrity() {
    log_message "=== Checking system integrity ==="
    
    # Check if sudo command works
    if command -v sudo >/dev/null 2>&1; then
        log_message "[OK] sudo command is available"
        
        # Test sudo functionality (this will only work if we're root)
        if sudo -n true 2>/dev/null; then
            log_message "[OK] sudo is working correctly"
        else
            log_message "! sudo may require password or have permission issues"
        fi
    else
        log_message "[FAIL] sudo command not found"
        return 1
    fi
    
    # Check critical system directories
    local critical_dirs=(
        "/usr/bin"
        "/usr/local/bin"
        "/bin"
        "/sbin"
    )
    
    for dir in "${critical_dirs[@]}"; do
        if [ -d "$dir" ]; then
            local dir_perms=$(stat -c "%a" "$dir" 2>/dev/null)
            log_message "[OK] $dir exists (permissions: $dir_perms)"
        else
            log_message "[FAIL] $dir missing"
        fi
    done
}

# Generate comprehensive post-installation/repair report
generate_comprehensive_report() {
    log_message "=== Generating comprehensive report ==="

    local report_file="$BACKUP_DIR/sudo_installation_report.txt"

    {
        echo "Sudo Installation and Repair Report - $(date)"
        echo "=============================================="
        echo ""
        echo "Log file: $LOG_FILE"
        echo "Backup directory: $BACKUP_DIR"
        echo ""
        echo "Current sudo status:"
        ls -la /usr/bin/sudo 2>/dev/null || echo "sudo not found in /usr/bin"
        echo ""
        echo "All sudo locations:"
        for location in "/usr/bin/sudo" "/bin/sudo" "/sbin/sudo" "/usr/sbin/sudo"; do
            if [ -f "$location" ]; then
                ls -la "$location"
            fi
        done
        echo ""
        echo "Current /usr/local/bin contents:"
        ls -la /usr/local/bin/ 2>/dev/null || echo "/usr/local/bin not accessible"
        echo ""
        echo "PATH environment:"
        echo "$PATH"
        echo ""
        echo "Current user: $(whoami)"
        echo "User groups: $(groups 2>/dev/null || echo "groups command failed")"
        echo ""
        echo "Sudo test:"
        if sudo --version >/dev/null 2>&1; then
            sudo --version | head -n1
            echo "Status: Working"
        else
            echo "Status: Failed"
        fi
        echo ""
        echo "System directories status:"
        for dir in "/usr/bin" "/usr/local/bin" "/bin" "/sbin"; do
            if [ -d "$dir" ]; then
                echo "$dir: EXISTS ($(stat -c "%a" "$dir" 2>/dev/null))"
            else
                echo "$dir: MISSING"
            fi
        done
    } > "$report_file"

    log_message "Comprehensive report saved to: $report_file"
}

# Function to create system repair report (legacy compatibility)
create_repair_report() {
    generate_comprehensive_report
}

# Enhanced main repair function
perform_system_repair() {
    log_message "=========================================="
    log_message "Starting Enhanced System Permission Repair"
    log_message "=========================================="
    
    # Create backup before changes
    create_backup
    
    # Fix dangerous symlinks first (critical security fix)
    fix_dangerous_symlinks
    
    # Repair sudo permissions
    repair_sudo_permissions
    
    # Repair /usr/local/bin permissions
    repair_usr_local_bin_permissions
    
    # Test sudo functionality
    test_sudo_functionality
    
    # Check system integrity
    check_system_integrity
    
    # Generate comprehensive report
    generate_comprehensive_report
    
    log_message "=========================================="
    log_message "Enhanced System Permission Repair Completed"
    log_message "Log file: $LOG_FILE"
    log_message "Backup directory: $BACKUP_DIR"
    log_message "=========================================="

    echo ""
    print_success_from_common_functions "System repair completed successfully!"
    print_info_from_common_functions "NEXT STEPS:"
    echo "1. Test sudo with a non-root user: su - username"
    echo "2. Then try: sudo whoami"
    echo "3. If still having issues, check the log: cat $LOG_FILE"
    echo "4. Report available at: $BACKUP_DIR/sudo_installation_report.txt"
    echo ""
}

# Execute repair if requested
if [ "$1" = "repair" ] || [ "$1" = "--repair" ]; then
    perform_system_repair
fi

log_message "Sudo installation and configuration completed."
print_success_from_common_functions "Sudo installation and configuration completed."
echo ""
print_info_from_common_functions "Available options:"
echo "  $0         - Install sudo and configure user permissions"
echo "  $0 repair  - Run comprehensive system repair (includes dangerous symlink removal)"
echo ""
echo "Log file: $LOG_FILE"
if [ -d "$BACKUP_DIR" ]; then
    echo "Backup directory: $BACKUP_DIR"
fi
