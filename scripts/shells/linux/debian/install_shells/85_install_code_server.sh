#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Code Server Installation and Configuration Script
# This script installs code-server, configures it for vscode web, and manages its startup
#
# Development Requirements:
# 1. Install code-server to COMPILE_DIR directory (from LGar.sh)
# 2. Set SERVER_ROOT_DIR as the root directory (CORE_NODE_ROOT_DIR from LGar.sh)
# 3. Create symbolic link to /usr/local/bin directory for startup command
# 4. Reference LGar.sh using relative path: $PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh
# 5. Do not print localhost, instead print all available IP addresses (support WSL and Linux server)
# 6. Do not use nohup in start_code_server, use systemd service instead
# 7. Execute order: create_systemd_service first, then start code-server
# 8. Use dry-run test before installation: curl -fsSL https://code-server.dev/install.sh | sh -s -- --dry-run
# 9. Check if code-server is installed before installing
# 10. Check if code-server is configured before configuring
# 11. Check if code-server is running before starting
# 12. Create systemd service for auto-start on boot
# 13. Support both WSL and Linux server environments
# 14. Use colored output for better user experience
# 15. Handle errors gracefully with proper exit codes

set -e

# Script index for logging
SCRIPT_INDEX="85"

# Source the global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHELLS_DIR="$(dirname "$SCRIPT_DIR")"
CORE_SCRIPTS_DIR="$(dirname "$SHELLS_DIR")"
CORE_NODE_DIR="$(dirname "$CORE_SCRIPTS_DIR")"

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source LGar.sh to get CORE_NODE_ROOT_DIR and COMPILE_DIR
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/resource_limiter_common.sh"
source "$PARENT_DIR_LEVEL_2/linux/common/debian_service_manager.sh"

# Get installation mode
INSTALL_MODE=$(get_var "INSTALL_MODE")

# Define service name early for condition checks
CODE_SERVER_SERVICE_NAME="code-server"

# Check if Code Server should be installed based on mode
if [ "$INSTALL_MODE" != "server" ] && [ "$INSTALL_MODE" != "full" ]; then
    echo "[$SCRIPT_INDEX] Skipping Code Server installation (INSTALL_MODE: $INSTALL_MODE)"
    echo "[$SCRIPT_INDEX] Code Server is only installed in 'server' or 'full' mode"

    # Try to disable existing service if installed
    if systemctl is-active --quiet "ncore-${CODE_SERVER_SERVICE_NAME}.service" 2>/dev/null; then
        echo "[$SCRIPT_INDEX] Stopping existing Code Server service..."
        $USE_SUDO systemctl stop "ncore-${CODE_SERVER_SERVICE_NAME}.service"
        $USE_SUDO systemctl disable "ncore-${CODE_SERVER_SERVICE_NAME}.service"
        echo "[$SCRIPT_INDEX] Code Server service stopped and disabled"
    fi

    exit 0
fi

echo "[$SCRIPT_INDEX] Code Server installation enabled (INSTALL_MODE: $INSTALL_MODE)"

# Configuration variables
CODE_SERVER_INSTALL_DIR="$COMPILE_DIR/code-server"
CODE_SERVER_CONFIG_DIR="$CODE_SERVER_INSTALL_DIR/config"
CODE_SERVER_DATA_DIR="$CODE_SERVER_INSTALL_DIR/data"
SERVER_ROOT_DIR="$CORE_NODE_ROOT_DIR"
CODE_SERVER_PORT=38008
CODE_SERVER_HOST="0.0.0.0"
CODE_SERVER_CPU_LIMIT="10"
CODE_SERVER_MEMORY_LIMIT="200M"
CODE_SERVER_SCRIPT_PATH="/usr/bin/code-server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$SCRIPT_INDEX] [$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$SCRIPT_INDEX] [$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$SCRIPT_INDEX] [$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Function to check if code-server is installed
check_code_server_installed() {
    if command -v code-server &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to install code-server
install_code_server() {
    log "Installing code-server..."
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        error "curl is not installed. Installing curl first..."
        $USE_SUDO apt update
        $USE_SUDO apt install -y curl
    fi
    
    # Install code-server
    log "Downloading and installing code-server..."
    curl -fsSL https://code-server.dev/install.sh | sh -s -- --dry-run
    
    if [ $? -eq 0 ]; then
        log "Dry run successful. Installing code-server..."
        curl -fsSL https://code-server.dev/install.sh | sh
        log "Code-server installed successfully"
        
        # Copy code-server binary to our custom directory
        log "Copying code-server to custom directory: $CODE_SERVER_INSTALL_DIR"
        $USE_SUDO mkdir -p "$CODE_SERVER_INSTALL_DIR/bin"
        $USE_SUDO cp /usr/bin/code-server "$CODE_SERVER_INSTALL_DIR/bin/"
        $USE_SUDO chmod +x "$CODE_SERVER_INSTALL_DIR/bin/code-server"
        
        # Update PATH to use our custom installation
        export PATH="$CODE_SERVER_INSTALL_DIR/bin:$PATH"
        log "Code-server copied to $CODE_SERVER_INSTALL_DIR/bin"
    else
        error "Failed to install code-server"
        exit 1
    fi
}

# Function to get all IP addresses
get_all_ips() {
    local ips=()
    
    # Get all IP addresses
    while IFS= read -r line; do
        if [[ $line =~ inet[[:space:]]+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
            local ip="${BASH_REMATCH[1]}"
            # Exclude loopback and link-local addresses
            if [[ $ip != "127.0.0.1" && $ip != "169.254."* ]]; then
                ips+=("$ip")
            fi
        fi
    done < <(ip addr show 2>/dev/null || ifconfig 2>/dev/null)
    
    echo "${ips[@]}"
}

# Function to configure code-server
configure_code_server() {
    log "Configuring code-server..."
    
    # Create directories
    mkdir -p "$CODE_SERVER_CONFIG_DIR"
    mkdir -p "$CODE_SERVER_DATA_DIR"
    
    # Create configuration file in CODE_SERVER_INSTALL_DIR
    cat > "$CODE_SERVER_CONFIG_DIR/config.yaml" << EOF
bind-addr: $CODE_SERVER_HOST:$CODE_SERVER_PORT
auth: password
password: admin123
cert: false
user-data-dir: $CODE_SERVER_DATA_DIR
EOF
    
    # Create symbolic links from CODE_SERVER_INSTALL_DIR to official directories
    local official_config_dir="$HOME/.config/code-server"
    local official_data_dir="$HOME/.local/share/code-server"
    
    mkdir -p "$official_config_dir"
    mkdir -p "$official_data_dir"
    
    # Remove existing files/directories and create symbolic links
    rm -rf "$official_config_dir/config.yaml"
    rm -rf "$official_data_dir"
    
    ln -sf "$CODE_SERVER_CONFIG_DIR/config.yaml" "$official_config_dir/config.yaml"
    ln -sf "$CODE_SERVER_DATA_DIR" "$official_data_dir"
    
    log "Code-server configuration created at $CODE_SERVER_CONFIG_DIR/config.yaml"
    log "Symbolic links created:"
    log "  $official_config_dir/config.yaml -> $CODE_SERVER_CONFIG_DIR/config.yaml"
    log "  $official_data_dir -> $CODE_SERVER_DATA_DIR"
    log "Default password: admin123"
    
    # Get and display all IP addresses
    local ips=($(get_all_ips))
    if [ ${#ips[@]} -gt 0 ]; then
        log "Access URLs:"
        for ip in "${ips[@]}"; do
            log "  http://$ip:$CODE_SERVER_PORT"
        done
    else
        log "Access URL: http://localhost:$CODE_SERVER_PORT"
    fi
    
    log "Server root directory: $SERVER_ROOT_DIR"
}

# Function to check if code-server is running using debian_service_manager
check_code_server_running() {
    # Check if ncore-code-server service is active
    if $USE_SUDO systemctl is-active --quiet "ncore-${CODE_SERVER_SERVICE_NAME}.service"; then
        return 0
    else
        return 1
    fi
}

# Function to check and handle port conflicts
check_port_conflicts() {
    log "Checking for port conflicts on port $CODE_SERVER_PORT..."

    local port_in_use=false
    local conflicting_process=""

    # Check if port is in use
    if command -v netstat &> /dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":$CODE_SERVER_PORT "; then
            port_in_use=true
            conflicting_process=$(netstat -tlnp 2>/dev/null | grep ":$CODE_SERVER_PORT " | head -1)
        fi
    elif command -v ss &> /dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ":$CODE_SERVER_PORT "; then
            port_in_use=true
            conflicting_process=$(ss -tlnp 2>/dev/null | grep ":$CODE_SERVER_PORT " | head -1)
        fi
    fi

    if [ "$port_in_use" = true ]; then
        warn "Port $CODE_SERVER_PORT is already in use:"
        echo "$conflicting_process"

        # Check if it's our own service
        if echo "$conflicting_process" | grep -q "code-server"; then
            log "Port is being used by code-server process, this is expected during service updates"
            return 0
        else
            warn "Port is being used by another process. Service may fail to start."
            return 1
        fi
    else
        log "Port $CODE_SERVER_PORT is available"
        return 0
    fi
}



# Function to create systemd service using debian_service_manager
create_systemd_service() {
    log "Creating systemd service for code-server using debian_service_manager..."

    # Calculate memory limits based on system resources
    calculate_memory_limits_from_common_functions

    # Use calculated limits or custom limits
    local cpu_limit="${CODE_SERVER_CPU_LIMIT}%"
    local memory_limit="$CODE_SERVER_MEMORY_LIMIT"

    # If using default values, use calculated limits
    if [ "$CODE_SERVER_MEMORY_LIMIT" = "500M" ]; then
        memory_limit="$DEFAULT_MEMORY_LIMIT"
    fi

    log "Resource limits: CPU=$cpu_limit, Memory=$memory_limit"

    # Create a wrapper script for code-server with environment variables
    local wrapper_script="$CODE_SERVER_INSTALL_DIR/code-server-wrapper.sh"
    cat > "$wrapper_script" << EOF
#!/bin/bash
export PASSWORD=admin123
cd "$SERVER_ROOT_DIR"
exec /usr/bin/code-server --bind-addr $CODE_SERVER_HOST:$CODE_SERVER_PORT --auth password --user-data-dir $CODE_SERVER_DATA_DIR --log debug
EOF
    chmod +x "$wrapper_script"

    log "Created wrapper script: $wrapper_script"

    # Check for port conflicts before creating service
    check_port_conflicts

    # Use debian_service_manager to create the service with resource limits
    local service_description="Code Server with Resource Limits"

    log "Calling debian_service_manager to create service..."
    if create_ncore_service "$wrapper_script" "$CODE_SERVER_SERVICE_NAME" "$service_description" "$cpu_limit" "$memory_limit"; then
        log "Service created successfully using debian_service_manager"
        log "Service name: ncore-${CODE_SERVER_SERVICE_NAME}.service"
        log "Resource limits applied: CPU=$cpu_limit, Memory=$memory_limit"

        # Wait a moment for service to initialize
        sleep 3

        # Check if service started successfully
        if $USE_SUDO systemctl is-active --quiet "ncore-${CODE_SERVER_SERVICE_NAME}.service"; then
            log "Service is running successfully"

            # Get and display all IP addresses
            local ips=($(get_all_ips))
            if [ ${#ips[@]} -gt 0 ]; then
                log "Access URLs:"
                for ip in "${ips[@]}"; do
                    log "  http://$ip:$CODE_SERVER_PORT"
                done
            else
                log "Access URL: http://localhost:$CODE_SERVER_PORT"
            fi

            log "Password: admin123"
            log "Server root directory: $SERVER_ROOT_DIR"
        else
            warn "Service may not have started properly, checking status..."
            $USE_SUDO systemctl status "ncore-${CODE_SERVER_SERVICE_NAME}.service" --no-pager -l
        fi

        return 0
    else
        error "Failed to create service using debian_service_manager"
        return 1
    fi
}

# Function to create symbolic link
create_symbolic_link() {
    log "Creating symbolic link for code-server..."
    
    # Check if code-server binary exists
    if [ -f "/usr/bin/code-server" ]; then
        # Create symbolic link to /usr/local/bin
        $USE_SUDO ln -sf /usr/bin/code-server /usr/local/bin/code-server
        log "Symbolic link created: /usr/local/bin/code-server -> /usr/bin/code-server"
    else
        warn "Code-server binary not found at /usr/bin/code-server"
    fi
}

# Function to show resource usage information
show_resource_usage() {
    log "Code-server resource usage information:"
    log "CPU Limit: ${CODE_SERVER_CPU_LIMIT}%"
    log "Memory Limit: $CODE_SERVER_MEMORY_LIMIT"

    # Show current system resource usage
    if command -v systemctl >/dev/null 2>&1; then
        if $USE_SUDO systemctl is-active --quiet "ncore-${CODE_SERVER_SERVICE_NAME}.service"; then
            log "Service is running. Checking resource usage..."

            # Get service PID
            local service_pid=$($USE_SUDO systemctl show --property MainPID --value "ncore-${CODE_SERVER_SERVICE_NAME}.service")
            if [ "$service_pid" != "0" ] && [ -n "$service_pid" ]; then
                log "Service PID: $service_pid"

                # Show CPU and memory usage
                if command -v ps >/dev/null 2>&1; then
                    ps -p "$service_pid" -o pid,ppid,pcpu,pmem,vsz,rss,comm --no-headers 2>/dev/null || log "Could not get process information"
                fi

                # Show systemd resource usage if available
                if command -v systemd-cgtop >/dev/null 2>&1; then
                    log "Systemd resource usage (5 second sample):"
                    timeout 5s systemd-cgtop --batch -n 1 | grep "ncore-${CODE_SERVER_SERVICE_NAME}" || log "No systemd resource data available"
                fi
            else
                log "Could not determine service PID"
            fi
        else
            log "Service is not running"
        fi
    fi
}

# Function to show service management commands
show_service_management_commands() {
    log "Service management commands:"
    log "  Start:   systemctl start ncore-${CODE_SERVER_SERVICE_NAME}.service"
    log "  Stop:    systemctl stop ncore-${CODE_SERVER_SERVICE_NAME}.service"
    log "  Restart: systemctl restart ncore-${CODE_SERVER_SERVICE_NAME}.service"
    log "  Status:  systemctl status ncore-${CODE_SERVER_SERVICE_NAME}.service"
    log "  Logs:    journalctl -u ncore-${CODE_SERVER_SERVICE_NAME}.service -f"
    log ""
    log "Using debian_service_manager.sh:"
    log "  Status:  bash $PARENT_DIR_LEVEL_2/common/debian_service_manager.sh status $CODE_SERVER_SERVICE_NAME"
    log "  Remove:  bash $PARENT_DIR_LEVEL_2/common/debian_service_manager.sh remove $CODE_SERVER_SERVICE_NAME"
    log "  Update:  bash $PARENT_DIR_LEVEL_2/common/debian_service_manager.sh update $CODE_SERVER_SERVICE_NAME"
}

# Main execution
main() {
    log "Starting code-server installation and configuration..."
    log "Using COMPILE_DIR: $COMPILE_DIR"
    log "Using CORE_NODE_ROOT_DIR: $CORE_NODE_ROOT_DIR"
    
    # Check if code-server is installed
    if ! check_code_server_installed; then
        log "Code-server is not installed. Installing..."
        install_code_server
    else
        log "Code-server is already installed"
    fi
    
    # Configure code-server
    if [ ! -f "$CODE_SERVER_CONFIG_DIR/config.yaml" ]; then
        log "Code-server is not configured. Configuring..."
        configure_code_server
    else
        log "Code-server is already configured"
    fi
    
    # Create symbolic link
    create_symbolic_link

    # Configure code-server (this will create the hard link)
    configure_code_server

    # Create systemd service using debian_service_manager (handles existing services automatically)
    create_systemd_service
    
    log "Code-server installation and configuration completed successfully!"
    log "Install directory: $CODE_SERVER_INSTALL_DIR"

    # Show resource usage information
    echo ""
    show_resource_usage

    # Show service management commands
    echo ""
    show_service_management_commands
}

# Run main function
main "$@"
