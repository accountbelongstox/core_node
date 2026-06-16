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

# ============================================================================
# AI DIRECT CALL INTERFACE - READ THIS FIRST 
# ============================================================================
# 
# This script provides a service manager for creating and managing systemd
# services with ncore-* naming convention. AI can directly call functions
# or use the command-line interface WITHOUT modifying the code.
#
# USAGE METHODS:
# --------------
#
# METHOD 1: Source and Call Functions Directly (Recommended for AI)
#   source /path/to/debian_service_manager.sh
#   create_ncore_service "/path/to/script.sh" "service_name" "Description" "20%" "200M"
#   remove_ncore_service "service_name"
#   check_service_status "service_name"
#   list_ncore_services
#   update_service_resources "service_name"
#
# METHOD 2: Execute as Command-Line Script
#   bash debian_service_manager.sh create /path/to/script.sh
#   bash debian_service_manager.sh create /path/to/script.sh myapp "My App" "50%" "1G"
#   bash debian_service_manager.sh remove myapp
#   bash debian_service_manager.sh status myapp
#   bash debian_service_manager.sh list
#   bash debian_service_manager.sh update
#   bash debian_service_manager.sh update myapp
#
# AVAILABLE FUNCTIONS (Can be called directly after sourcing):
# -----------------------------------------------------------
#
# 1. create_systemd_service(service_name, description, exec_command, working_dir, [user], [restart], [restart_sec], [cpu_limit], [memory_limit], [log_file])
#    - Creates a generic systemd service (not limited to ncore-* naming)
#    - ALL services are created with CPU and memory restrictions by default
#    - Parameters:
#      * service_name (required): Full service name (e.g., "pycore-module-caller", "my-service")
#      * description (required): Service description
#      * exec_command (required): Full command to execute (e.g., "/usr/bin/python3 /path/to/script.py")
#      * working_dir (required): Working directory for the service
#      * user (optional): User to run service as (default: "root")
#      * restart (optional): Restart policy (default: "always")
#      * restart_sec (optional): Restart delay (default: "10s")
#      * cpu_limit (optional): CPU limit like "20%" (default: auto-calculated based on system)
#      * memory_limit (optional): Memory limit like "200M" or "1G" (default: auto-calculated based on system RAM)
#    - Default limits are applied automatically if not specified
#    - Optional log_file (10th arg): if set, StandardOutput/StandardError append to this absolute path (otherwise journal).
#    - Example: create_systemd_service "my-service" "My Service" "/usr/bin/python3 /app/main.py" "/app" "ubuntu"
#
# 2. create_ncore_service(script_path, [custom_name], [description], [cpu_limit], [memory_limit])
#    - Creates or updates a systemd service with ncore-* naming convention
#    - Parameters:
#      * script_path (required): Full path to the script file
#      * custom_name (optional): Custom service name (without ncore- prefix)
#      * description (optional): Service description
#      * cpu_limit (optional): CPU limit like "20%" (default: "20%")
#      * memory_limit (optional): Memory limit like "200M" or "1G" (default: auto-calculated)
#    - Example: create_ncore_service "/www/apps/myapp/start.sh" "myapp" "My Application" "30%" "500M"
#
# 3. remove_ncore_service(service_name)
#    - Removes a systemd service
#    - Parameters:
#      * service_name (required): Service name (with or without ncore- prefix)
#    - Example: remove_ncore_service "myapp"
#
# 4. check_service_status(service_name)
#    - Shows detailed service status
#    - Parameters:
#      * service_name (required): Service name (with or without ncore- prefix)
#    - Example: check_service_status "myapp"
#
# 5. list_ncore_services()
#    - Lists all ncore-* services with their status
#    - No parameters required
#    - Example: list_ncore_services
#
# 6. update_service_resources(service_name)
#    - Updates resource limits for a specific service
#    - Parameters:
#      * service_name (required): Service name (with or without ncore- prefix)
#    - Example: update_service_resources "myapp"
#
# 7. update_all_services_resources()
#    - Updates resource limits for all ncore services
#    - No parameters required
#    - Example: update_all_services_resources
#
# RESOURCE LIMITS:
# ----------------
# - CPU limits: Format "XX%" (e.g., "20%", "50%", "100%")
# - Memory limits: Format "XXXM" or "XG" (e.g., "200M", "500M", "1G", "2G")
# - Default CPU: "20%"
# - Default Memory: Auto-calculated based on system RAM:
#   * <=2GB RAM: 200M
#   * 2-4GB RAM: 300M
#   * 4-8GB RAM: 500M
#   * >8GB RAM: 1G
#
# SERVICE NAMING:
# ---------------
# - All services are prefixed with "ncore-"
# - If custom_name is provided, service will be "ncore-{custom_name}"
# - If not provided, service name is derived from script filename
#
# SUPPORTED SCRIPT TYPES:
# -----------------------
# - .sh files: Executed with bash
# - .py files: Executed with python3
# - .js/.mjs files: Executed with node
# - .pl files: Executed with perl
# - .rb files: Executed with ruby
# - Other files: Executed directly
#
# WORKING DIRECTORY:
# ------------------
# - For poly_apps: /path/to/poly_apps/app_name/scripts/deploy.sh -> /path/to/poly_apps/app_name
# - For ncore apps: /path/to/apps/app_name/scripts/deploy.sh -> /path/to/apps/app_name
# - Other: Uses script directory
#
# IMPORTANT NOTES FOR AI:
# -----------------------
# - This script is idempotent: safe to run multiple times
# - Services are automatically stopped before update
# - Resource limits are validated before application
# - Systemd daemon is automatically reloaded after changes
# - All functions return 0 on success, non-zero on failure
# - No code modification needed - just source and call functions
#
# ============================================================================

# Debian Service Manager for NCore Applications
# Manages systemd services with ncore-* naming convention

# Source gvar_common.sh for path mapping functions (trust-based coding)
# Only source if not already sourced (check for map_web_path function)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! type map_web_path >/dev/null 2>&1; then
    source "$SCRIPT_DIR/gvar_common.sh"
fi

# Variables declaration
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
SERVICE_PREFIX="ncore-"
SYSTEMD_DIR="/etc/systemd/system"  # System directory, keep as-is
# Use map_web_path for path mapping (except /etc which is system directory)
LOG_DIR=$(map_web_path "logs" "ncore_services" 2>/dev/null || echo "/var/log/ncore_services")
SERVICES_LOG_DIR=$(map_web_path "www" "services_log" 2>/dev/null || echo "/www/services_log")
DEFAULT_CPU_LIMIT="20%"
DEFAULT_MEMORY_LIMIT="200M"
REQUIRED_PACKAGES="systemd cgroup-tools"

# Service template with resource limits
SERVICE_TEMPLATE='[Unit]
Description=NCore Service: {description}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={working_dir}
ExecStart={exec_command}
Restart=always
RestartSec=3
CPUQuota={cpu_limit}
MemoryMax={memory_limit}
MemoryHigh={memory_high}
TasksMax=100
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target'

# Function to calculate memory limits based on system memory
calculate_memory_limits() {
    local total_memory_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local total_memory_mb=$((total_memory_kb / 1024))
    local total_memory_gb=$((total_memory_mb / 1024))

    echo "[INFO] System memory: ${total_memory_mb}MB (${total_memory_gb}GB)"

    if [ "$total_memory_mb" -le 2048 ]; then
        # 2GB or less: use 200M
        DEFAULT_MEMORY_LIMIT="200M"
        echo "[INFO] Using memory limit: 200M (system has <=2GB RAM)"
    elif [ "$total_memory_mb" -le 4096 ]; then
        # 2-4GB: use 300M
        DEFAULT_MEMORY_LIMIT="300M"
        echo "[INFO] Using memory limit: 300M (system has 2-4GB RAM)"
    elif [ "$total_memory_mb" -le 8192 ]; then
        # 4-8GB: use 500M
        DEFAULT_MEMORY_LIMIT="500M"
        echo "[INFO] Using memory limit: 500M (system has 4-8GB RAM)"
    else
        # >8GB: use 1G
        DEFAULT_MEMORY_LIMIT="1G"
        echo "[INFO] Using memory limit: 1G (system has >8GB RAM)"
    fi

    # Set MemoryHigh to 80% of MemoryMax
    case "$DEFAULT_MEMORY_LIMIT" in
        "200M") MEMORY_HIGH="160M" ;;
        "300M") MEMORY_HIGH="240M" ;;
        "500M") MEMORY_HIGH="400M" ;;
        "1G") MEMORY_HIGH="800M" ;;
        *) MEMORY_HIGH="160M" ;;
    esac
}

# Function to check and install required packages
ensure_dependencies() {
    local missing_packages=""
    
    for package in $REQUIRED_PACKAGES; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            missing_packages="$missing_packages $package"
        fi
    done
    
    if [ -n "$missing_packages" ]; then
        echo "[INFO] Installing required packages:$missing_packages"
        apt-get update -qq
        apt-get install -y $missing_packages
        
        if [ $? -ne 0 ]; then
            echo "[ERROR] Failed to install required packages"
            return 1
        fi
    fi
    
    return 0
}

# Function to get mapped paths (ensures paths are always correctly mapped)
get_mapped_log_dir() {
    map_web_path "logs" "ncore_services"
}

get_mapped_services_log_dir() {
    map_web_path "www" "services_log"
}

# Function to ensure required directories exist
ensure_directories() {
    # Recalculate paths to ensure they're correctly mapped
    local log_dir=$(get_mapped_log_dir)
    local services_log_dir=$(get_mapped_services_log_dir)
    
    mkdir -p "$log_dir" "$services_log_dir"
    chmod 755 "$log_dir" "$services_log_dir"
    
    # Update global variables for consistency
    LOG_DIR="$log_dir"
    SERVICES_LOG_DIR="$services_log_dir"
}

# Function to check systemd version and resource limit support
check_systemd_support() {
    local systemd_version
    systemd_version=$(systemctl --version | head -n1 | awk '{print $2}')

    echo "[INFO] Systemd version: $systemd_version"

    # Check if systemd supports the resource limit features we use
    if [ "$systemd_version" -ge 230 ]; then
        echo "[INFO] Systemd supports MemoryMax and CPUQuota"
        return 0
    elif [ "$systemd_version" -ge 220 ]; then
        echo "[WARNING] Systemd version may have limited resource control support"
        return 0
    else
        echo "[WARNING] Systemd version is old, resource limits may not work properly"
        return 1
    fi
}

# Function to validate resource limit format
validate_resource_limits() {
    local cpu_limit="$1"
    local memory_limit="$2"

    # Validate CPU limit (should end with %)
    if [[ ! "$cpu_limit" =~ ^[0-9]+%$ ]]; then
        echo "[ERROR] Invalid CPU limit format: $cpu_limit (expected: 30%)"
        return 1
    fi

    # Validate memory limit (should end with K, M, or G)
    if [[ ! "$memory_limit" =~ ^[0-9]+[KMG]$ ]]; then
        echo "[ERROR] Invalid memory limit format: $memory_limit (expected: 500M, 1G, etc.)"
        return 1
    fi

    return 0
}

# Function to get service name from script path
get_service_name() {
    local script_path="$1"
    local basename_name=$(basename "$script_path" .sh)
    echo "${SERVICE_PREFIX}${basename_name}"
}

# Function to get execution command based on file extension
get_exec_command() {
    local filepath="$1"
    local ext="${filepath##*.}"

    case "$ext" in
        py)
            echo "python3 $filepath"
            ;;
        js|mjs)
            echo "node $filepath"
            ;;
        sh)
            echo "bash $filepath"
            ;;
        pl)
            echo "perl $filepath"
            ;;
        rb)
            echo "ruby $filepath"
            ;;
        *)
            echo "$filepath"
            ;;
    esac
}

# Function to get appropriate working directory for different app types
get_working_directory() {
    local script_path="$1"
    local script_dir=$(dirname "$script_path")

    # For Laravel apps, working directory should be the app root, not scripts/
    if [[ "$script_path" == *"/poly_apps/"*"/scripts/"* ]]; then
        # For poly apps: /path/to/poly_apps/app_name/scripts/deploy.sh -> /path/to/poly_apps/app_name
        echo "$(dirname "$script_dir")"
    elif [[ "$script_path" == *"/apps/"*"/scripts/"* ]]; then
        # For ncore apps: /path/to/apps/app_name/scripts/deploy.sh -> /path/to/apps/app_name
        echo "$(dirname "$script_dir")"
    else
        # Default: use script directory
        echo "$script_dir"
    fi
}

# Function to create systemd service file
create_service_file() {
    local service_name="$1"
    local script_path="$2"
    local description="$3"
    local cpu_limit="${4:-$DEFAULT_CPU_LIMIT}"
    local memory_limit="${5:-$DEFAULT_MEMORY_LIMIT}"

    # Validate resource limits
    if ! validate_resource_limits "$cpu_limit" "$memory_limit"; then
        echo "[ERROR] Invalid resource limits, using defaults"
        cpu_limit="$DEFAULT_CPU_LIMIT"
        memory_limit="$DEFAULT_MEMORY_LIMIT"
    fi

    # Check systemd support
    if ! check_systemd_support; then
        echo "[WARNING] Systemd may not fully support resource limits"
    fi

    local exec_command=$(get_exec_command "$script_path")
    local working_dir=$(get_working_directory "$script_path")
    local service_file="$SYSTEMD_DIR/${service_name}.service"

    echo "[INFO] Creating service file: $service_file"
    echo "[INFO] Script path: $script_path"
    echo "[INFO] Working directory: $working_dir"
    echo "[INFO] Execution command: $exec_command"
    echo "[INFO] CPU limit: $cpu_limit"
    echo "[INFO] Memory limit: $memory_limit"
    
    # Calculate memory high (80% of max for soft limit)
    local memory_high
    case "${memory_limit: -1}" in
        "M"|"m") memory_high="$((${memory_limit%?} * 80 / 100))M" ;;
        "G"|"g") memory_high="$((${memory_limit%?} * 1024 * 80 / 100))M" ;;
        "K"|"k") memory_high="$((${memory_limit%?} * 80 / 100))K" ;;
        *) memory_high="$((memory_limit * 80 / 100))" ;;
    esac

    # Create service content
    local service_content="$SERVICE_TEMPLATE"
    service_content="${service_content//\{description\}/$description}"
    service_content="${service_content//\{working_dir\}/$working_dir}"
    service_content="${service_content//\{exec_command\}/$exec_command}"
    service_content="${service_content//\{cpu_limit\}/$cpu_limit}"
    service_content="${service_content//\{memory_limit\}/$memory_limit}"
    service_content="${service_content//\{memory_high\}/$memory_high}"
    
    echo "$service_content" > "$service_file"
    
    if [ $? -eq 0 ]; then
        echo "[SUCCESS] Service file created successfully"
        return 0
    else
        echo "[ERROR] Failed to create service file"
        return 1
    fi
}

# Function to list all ncore services
list_ncore_services() {
    echo "[INFO] Listing all ncore-* services:"
    systemctl list-units --type=service --state=loaded | grep "^  ${SERVICE_PREFIX}" | while read -r line; do
        local service_name=$(echo "$line" | awk '{print $1}')
        local status=$(systemctl is-active "$service_name" 2>/dev/null || echo "inactive")
        local enabled=$(systemctl is-enabled "$service_name" 2>/dev/null || echo "disabled")
        echo "  $service_name [$status] [$enabled]"
    done
}

# Function to get service info by script path
get_service_by_script() {
    local script_path="$1"
    local abs_script_path=$(realpath "$script_path" 2>/dev/null || echo "$script_path")
    
    for service_file in "$SYSTEMD_DIR"/${SERVICE_PREFIX}*.service; do
        if [ -f "$service_file" ]; then
            local exec_start=$(grep "^ExecStart=" "$service_file" | cut -d'=' -f2-)
            local service_script=$(echo "$exec_start" | awk '{print $NF}')
            local abs_service_script=$(realpath "$service_script" 2>/dev/null || echo "$service_script")
            
            if [ "$abs_script_path" = "$abs_service_script" ]; then
                echo "$(basename "$service_file" .service)"
                return 0
            fi
        fi
    done
    
    return 1
}

# Function to apply resource limits to service file (reusable)
apply_resource_limits() {
    local service_file="$1"
    local cpu_limit="$2"
    local memory_limit="$3"

    if [ -n "$cpu_limit" ]; then
        echo "CPUQuota=$cpu_limit" >> "$service_file"
        echo "[INFO] CPU limit: $cpu_limit"
    fi

    if [ -n "$memory_limit" ]; then
        local memory_high
        case "${memory_limit: -1}" in
            "M"|"m") memory_high="$((${memory_limit%?} * 80 / 100))M" ;;
            "G"|"g") memory_high="$((${memory_limit%?} * 1024 * 80 / 100))M" ;;
            "K"|"k") memory_high="$((${memory_limit%?} * 80 / 100))K" ;;
            *) memory_high="$memory_limit" ;;
        esac
        echo "MemoryMax=$memory_limit" >> "$service_file"
        echo "MemoryHigh=$memory_high" >> "$service_file"
        echo "[INFO] Memory limit: $memory_limit (high: $memory_high)"
    fi
}

# Function to create generic systemd service (not limited to ncore-*)
create_systemd_service() {
    local service_name="$1"
    local description="$2"
    local exec_command="$3"
    local working_dir="$4"
    local user="${5:-root}"
    local restart_policy="${6:-always}"
    local restart_sec="${7:-10s}"
    local cpu_limit="${8:-}"
    local memory_limit="${9:-}"
    local log_file="${10:-}"

    if [ -z "$service_name" ] || [ -z "$description" ] || [ -z "$exec_command" ]; then
        echo "[ERROR] service_name, description, and exec_command are required"
        return 1
    fi

    if [ -z "$working_dir" ]; then
        working_dir="/"
    fi

    # Calculate and apply default resource limits if not provided
    if [ -z "$cpu_limit" ] || [ -z "$memory_limit" ]; then
        calculate_memory_limits
        cpu_limit="${cpu_limit:-$DEFAULT_CPU_LIMIT}"
        memory_limit="${memory_limit:-$DEFAULT_MEMORY_LIMIT}"
    fi

    # Extract environment variables from exec_command if present
    local env_vars=""
    local clean_command="$exec_command"

    # Check if command starts with KEY=VALUE pattern
    if [[ "$exec_command" =~ ^([A-Z_][A-Z0-9_]*=) ]]; then
        # Extract all leading environment variable assignments
        while [[ "$clean_command" =~ ^([A-Z_][A-Z0-9_]*=[^[:space:]]+)[[:space:]]+(.*) ]]; do
            env_vars="${env_vars}Environment=\"${BASH_REMATCH[1]}\"\n"
            clean_command="${BASH_REMATCH[2]}"
        done
    fi

    local service_file="$SYSTEMD_DIR/${service_name}.service"

    echo "[INFO] Creating generic systemd service: $service_name"
    echo "[INFO] Description: $description"
    echo "[INFO] Exec: $clean_command"
    if [ -n "$env_vars" ]; then
        echo "[INFO] Environment variables extracted from command"
    fi
    echo "[INFO] Working Directory: $working_dir"
    echo "[INFO] User: $user"
    if [ -n "$log_file" ]; then
        local log_parent
        log_parent="$(dirname "$log_file")"
        mkdir -p "$log_parent" 2>/dev/null || true
        touch "$log_file" 2>/dev/null || true
        echo "[INFO] Unified log file: $log_file"
    fi

    cat > "$service_file" << EOF
[Unit]
Description=$description
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$working_dir
ExecStart=$clean_command
Restart=$restart_policy
RestartSec=$restart_sec
EOF

    if [ -n "$log_file" ]; then
        printf 'StandardOutput=append:%s\nStandardError=append:%s\n' "$log_file" "$log_file" >> "$service_file"
    else
        printf 'StandardOutput=journal\nStandardError=journal\n' >> "$service_file"
    fi

    # Add environment variables if extracted
    if [ -n "$env_vars" ]; then
        printf "\n# Environment variables\n" >> "$service_file"
        printf "$env_vars" >> "$service_file"
    fi

    # Add default PATH environment variable
    echo "Environment=\"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\"" >> "$service_file"

    apply_resource_limits "$service_file" "$cpu_limit" "$memory_limit"

    cat >> "$service_file" << EOF

[Install]
WantedBy=multi-user.target
EOF

    if [ $? -eq 0 ]; then
        echo "[SUCCESS] Service file created: $service_file"
        systemctl daemon-reload
        return 0
    else
        echo "[ERROR] Failed to create service file"
        return 1
    fi
}

# Function to create or update ncore service
create_ncore_service() {
    local script_path="$1"
    local custom_name="$2"
    local description="$3"
    local cpu_limit="$4"
    local memory_limit="$5"
    
    if [ ! -f "$script_path" ]; then
        echo "[ERROR] Script file not found: $script_path"
        return 1
    fi
    
    # Ensure dependencies are installed
    if ! ensure_dependencies; then
        return 1
    fi

    ensure_directories

    # Calculate memory limits based on system resources
    calculate_memory_limits
    
    # Determine service name
    local service_name
    if [ -n "$custom_name" ]; then
        service_name="${SERVICE_PREFIX}${custom_name}"
    else
        service_name=$(get_service_name "$script_path")
    fi
    
    # Set default description if not provided
    if [ -z "$description" ]; then
        description="NCore service for $(basename "$script_path")"
    fi
    
    echo "[INFO] Processing service: $service_name"
    echo "[INFO] Script: $script_path"
    
    # Check if service already exists
    local service_file="$SYSTEMD_DIR/${service_name}.service"
    local service_exists=false

    if [ -f "$service_file" ]; then
        service_exists=true
        echo "[INFO] Service already exists, updating..."

        # Stop existing service and wait for it to fully stop
        echo "[INFO] Stopping existing service..."
        systemctl stop "$service_name" 2>/dev/null

        # Wait for service to fully stop (up to 30 seconds)
        local wait_count=0
        while systemctl is-active "$service_name" >/dev/null 2>&1 && [ $wait_count -lt 30 ]; do
            echo "[INFO] Waiting for service to stop... ($wait_count/30)"
            sleep 1
            wait_count=$((wait_count + 1))
        done

        if systemctl is-active "$service_name" >/dev/null 2>&1; then
            echo "[WARNING] Service did not stop gracefully, forcing stop..."
            systemctl kill "$service_name" 2>/dev/null
            sleep 2
        fi

        systemctl disable "$service_name" 2>/dev/null
        echo "[INFO] Existing service stopped successfully"
    fi
    
    # Check for conflicting services with same script
    local existing_service=$(get_service_by_script "$script_path")
    if [ -n "$existing_service" ] && [ "$existing_service" != "$service_name" ]; then
        echo "[INFO] Found existing service '$existing_service' for same script"
        echo "[INFO] Removing old service: $existing_service"
        remove_ncore_service "$existing_service"
    fi

    # Set default resource limits if not provided
    if [ -z "$cpu_limit" ]; then
        cpu_limit="$DEFAULT_CPU_LIMIT"
    fi
    if [ -z "$memory_limit" ]; then
        memory_limit="$DEFAULT_MEMORY_LIMIT"
    fi

    echo "[INFO] Resource limits: CPU=$cpu_limit, Memory=$memory_limit"

    # Create service file
    if create_service_file "$service_name" "$script_path" "$description" "$cpu_limit" "$memory_limit"; then
        # Reload systemd and enable service
        echo "[INFO] Reloading systemd daemon..."
        systemctl daemon-reload

        echo "[INFO] Enabling service..."
        systemctl enable "$service_name"

        echo "[INFO] Starting service..."
        if systemctl start "$service_name"; then
            # Wait a moment for service to initialize
            sleep 2

            # Check if service started successfully
            if systemctl is-active "$service_name" >/dev/null 2>&1; then
                echo "[SUCCESS] Service started successfully"
            else
                echo "[WARNING] Service may not have started properly"
            fi
        else
            echo "[ERROR] Failed to start service"
            return 1
        fi

        # Log service creation
        log_service_action "$service_name" "$script_path" "UPDATE"
        
        echo "[SUCCESS] Service '$service_name' created and started successfully"
        echo "[INFO] Service status:"
        systemctl status "$service_name" --no-pager -l
        
        return 0
    else
        echo "[ERROR] Failed to create service"
        return 1
    fi
}

# Function to update service resource limits
update_service_resources() {
    local service_name="$1"

    if [ -z "$service_name" ]; then
        echo "[ERROR] Service name is required"
        return 1
    fi

    # Add service prefix if not present
    if [[ ! "$service_name" =~ ^$SERVICE_PREFIX ]]; then
        service_name="${SERVICE_PREFIX}${service_name}"
    fi

    local service_file="$SYSTEMD_DIR/${service_name}.service"

    if [ ! -f "$service_file" ]; then
        echo "[ERROR] Service file not found: $service_file"
        return 1
    fi

    echo "[INFO] Updating resource limits for service: $service_name"

    # Calculate new memory limits
    calculate_memory_limits

    # Update CPU limit
    sed -i "s/^CPUQuota=.*/CPUQuota=$DEFAULT_CPU_LIMIT/" "$service_file"

    # Update memory limits
    sed -i "s/^MemoryMax=.*/MemoryMax=$DEFAULT_MEMORY_LIMIT/" "$service_file"
    sed -i "s/^MemoryHigh=.*/MemoryHigh=$MEMORY_HIGH/" "$service_file"

    echo "[INFO] Updated resource limits:"
    echo "[INFO] - CPU: $DEFAULT_CPU_LIMIT"
    echo "[INFO] - Memory Max: $DEFAULT_MEMORY_LIMIT"
    echo "[INFO] - Memory High: $MEMORY_HIGH"

    # Reload systemd and restart service
    systemctl daemon-reload
    if systemctl is-active --quiet "$service_name"; then
        echo "[INFO] Restarting service to apply new limits..."
        systemctl restart "$service_name"
        if [ $? -eq 0 ]; then
            echo "[SUCCESS] Service $service_name updated and restarted successfully"
        else
            echo "[ERROR] Failed to restart service $service_name"
            return 1
        fi
    else
        echo "[INFO] Service is not running, limits will apply on next start"
    fi

    return 0
}

# Function to update all ncore services with new resource limits
update_all_services_resources() {
    echo "[INFO] Updating resource limits for all ncore services..."

    local services_updated=0
    local services_failed=0

    # Find all ncore services
    for service_file in "$SYSTEMD_DIR"/${SERVICE_PREFIX}*.service; do
        if [ -f "$service_file" ]; then
            local service_name=$(basename "$service_file" .service)
            echo ""
            echo "----------------------------------------"
            if update_service_resources "$service_name"; then
                ((services_updated++))
            else
                ((services_failed++))
            fi
        fi
    done

    echo ""
    echo "========================================"
    echo "[SUMMARY] Resource limits update complete"
    echo "[INFO] Services updated: $services_updated"
    echo "[INFO] Services failed: $services_failed"
    echo "========================================"

    return 0
}

# Function to remove ncore service
remove_ncore_service() {
    local service_name="$1"
    
    # Add prefix if not present
    if [[ ! "$service_name" =~ ^${SERVICE_PREFIX} ]]; then
        service_name="${SERVICE_PREFIX}${service_name}"
    fi
    
    local service_file="$SYSTEMD_DIR/${service_name}.service"
    
    if [ ! -f "$service_file" ]; then
        echo "[ERROR] Service not found: $service_name"
        return 1
    fi
    
    echo "[INFO] Removing service: $service_name"
    
    # Stop and disable service
    systemctl stop "$service_name" 2>/dev/null
    systemctl disable "$service_name" 2>/dev/null
    
    # Remove service file
    rm -f "$service_file"
    
    # Reload systemd
    systemctl daemon-reload
    
    # Log service removal
    log_service_action "$service_name" "" "REMOVE"
    
    echo "[SUCCESS] Service '$service_name' removed successfully"
    return 0
}

# Function to check service status
check_service_status() {
    local service_name="$1"
    
    # Add prefix if not present
    if [[ ! "$service_name" =~ ^${SERVICE_PREFIX} ]]; then
        service_name="${SERVICE_PREFIX}${service_name}"
    fi
    
    if systemctl list-units --type=service | grep -q "$service_name"; then
        echo "[INFO] Service status for: $service_name"
        systemctl status "$service_name" --no-pager -l
        return 0
    else
        echo "[ERROR] Service not found: $service_name"
        return 1
    fi
}

# Function to log service actions
log_service_action() {
    local service_name="$1"
    local script_path="$2"
    local action="$3"
    
    # Ensure path is correctly mapped
    local services_log_dir=$(get_mapped_services_log_dir)
    local log_file="$services_log_dir/ncore_service_actions.log"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] $action: $service_name -> $script_path" >> "$log_file"
    
    if [ "$action" = "CREATE" ]; then
        cat >> "$log_file" << EOF
  Commands for $service_name:
    systemctl start $service_name
    systemctl stop $service_name
    systemctl restart $service_name
    systemctl status $service_name
    systemctl enable $service_name
    systemctl disable $service_name
    journalctl -u $service_name -f

EOF
    fi
}

# Function to show help
show_help() {
    cat << EOF
NCore Debian Service Manager

Usage: $0 COMMAND [OPTIONS]

Commands:
  create SCRIPT_PATH [NAME] [DESCRIPTION] [CPU_LIMIT] [MEMORY_LIMIT]
    Create or update a ncore service
    
  remove SERVICE_NAME
    Remove a ncore service
    
  status SERVICE_NAME
    Show service status
    
  list
    List all ncore services

  update [SERVICE_NAME]
    Update resource limits for service(s)
    If no service name provided, updates all services

  help
    Show this help message

Examples:
  $0 create /path/to/script.sh
  $0 create /path/to/script.sh myapp "My Application" "50%" "1G"
  $0 remove myapp
  $0 status myapp
  $0 list
  $0 update
  $0 update myapp

EOF
}

# Main function
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        create)
            if [ $# -lt 1 ]; then
                echo "[ERROR] Script path required for create command"
                exit 1
            fi
            create_ncore_service "$@"
            ;;
        remove)
            if [ $# -lt 1 ]; then
                echo "[ERROR] Service name required for remove command"
                exit 1
            fi
            remove_ncore_service "$1"
            ;;
        status)
            if [ $# -lt 1 ]; then
                echo "[ERROR] Service name required for status command"
                exit 1
            fi
            check_service_status "$1"
            ;;
        list)
            list_ncore_services
            ;;
        update)
            if [ $# -lt 1 ]; then
                echo "[INFO] Updating all services with new resource limits"
                update_all_services_resources
            else
                echo "[INFO] Updating service: $1"
                update_service_resources "$1"
            fi
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo "[ERROR] Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function if script is run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
