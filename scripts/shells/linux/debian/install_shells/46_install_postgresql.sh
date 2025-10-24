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
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
SCRIPT_INDEX="46"
INSTALL_POSTGRESQL=""
INSTALL_MODE=""
POSTGRESQL_VERSION=""
POSTGRESQL_DATA_DIR=""
POSTGRESQL_CONFIG_DIR=""
POSTGRESQL_LOG_DIR=""
POSTGRESQL_USER="postgres"
POSTGRESQL_SERVICE_NAME="postgresql"

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Initialize variables
SCRIPT_INDEX="46"
INSTALL_POSTGRESQL=$(get_var "INSTALL_POSTGRESQL")
INSTALL_MODE=$(get_var "INSTALL_MODE")
POSTGRESQL_VERSION="15"
# Use path mapping from gvar_common.sh to support WSL Windows directories
POSTGRESQL_DATA_DIR=$(map_web_path "/www/wwwroot/postgresql/data")
POSTGRESQL_CONFIG_DIR=""
POSTGRESQL_LOG_DIR=$(map_web_path "/www/wwwroot/postgresql/logs")

echo "[$SCRIPT_INDEX] PostgreSQL Database Management Script"
echo "[$SCRIPT_INDEX] INSTALL_POSTGRESQL: $INSTALL_POSTGRESQL"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if PostgreSQL is already installed
check_postgresql() {
    if command_exists psql; then
        return 0  # true, is installed
    fi
    return 1  # false, is not installed
}

# Function to check if PostgreSQL service is running
is_postgresql_running() {
    if command_exists systemctl; then
        if systemctl is-active --quiet postgresql; then
            return 0  # true, is running
        fi
    fi
    return 1  # false, is not running
}

##############################
# Debian/Ubuntu cluster model #
##############################

# Detect installed PostgreSQL major version safely
detect_postgresql_version() {
    local ver=""
    if command_exists psql; then
        ver=$(psql -V 2>/dev/null | awk '{print $3}' | cut -d. -f1)
    fi
    if [[ -z "$ver" || ! "$ver" =~ ^[0-9]+$ ]]; then
        if [ -d "/usr/lib/postgresql" ]; then
            ver=$(ls -1 "/usr/lib/postgresql" 2>/dev/null | sed -n '/^[0-9]\+$/p' | sort -n | tail -1)
        fi
    fi
    if [[ -z "$ver" || ! "$ver" =~ ^[0-9]+$ ]]; then
        ver="$POSTGRESQL_VERSION" # fallback to default defined earlier
    fi
    echo "$ver"
}

# Function to create necessary directories (do not pre-create data dir to avoid pg_createcluster conflicts)
create_postgresql_directories() {
    echo "[$SCRIPT_INDEX] Ensuring PostgreSQL directories..."

    # Use path mapping from gvar_common.sh to support WSL Windows directories
    local postgresql_parent=$(map_web_path "/www/wwwroot/postgresql")

    # Parent and logs
    $USE_SUDO mkdir -p "$postgresql_parent"
    $USE_SUDO mkdir -p "$POSTGRESQL_LOG_DIR"

    # Set proper ownership (skip in WSL as Windows filesystem doesn't support chown)
    if [ "$IS_WSL" = false ]; then
        $USE_SUDO chown -R postgres:postgres "$postgresql_parent"
    fi
    $USE_SUDO chmod 755 "$POSTGRESQL_LOG_DIR" 2>/dev/null || true

    echo "[$SCRIPT_INDEX] Directories prepared"
}

# Function to install PostgreSQL
install_postgresql() {
    echo "[$SCRIPT_INDEX] Installing PostgreSQL $POSTGRESQL_VERSION..."

    # Update package list
    $USE_SUDO apt update

    # Install PostgreSQL and additional packages
    $USE_SUDO apt install -y postgresql postgresql-contrib postgresql-client

    if [ $? -eq 0 ]; then
        echo "[$SCRIPT_INDEX] PostgreSQL installed successfully"
        return 0
    else
        echo "[$SCRIPT_INDEX] Failed to install PostgreSQL"
        return 1
    fi
}

# Function to configure PostgreSQL using Debian/Ubuntu cluster tools
configure_postgresql() {
    echo "[$SCRIPT_INDEX] Configuring PostgreSQL (Debian/Ubuntu cluster)..."

    # Ensure directories
    create_postgresql_directories

    # Remove any previous custom override that may break the distro unit
    if [ -d "/etc/systemd/system/postgresql.service.d" ]; then
        echo "[$SCRIPT_INDEX] Removing custom systemd override for postgresql.service"
        $USE_SUDO rm -rf "/etc/systemd/system/postgresql.service.d"
        $USE_SUDO systemctl daemon-reload || true
    fi

    # Determine installed major version
    POSTGRESQL_VERSION="$(detect_postgresql_version)"
    POSTGRESQL_CONFIG_DIR="/etc/postgresql/$POSTGRESQL_VERSION/main"

    # If cluster exists in /etc/postgresql/<ver>/main
    local cluster_dir="$POSTGRESQL_CONFIG_DIR"
    local need_recreate=false
    if [ -d "$cluster_dir" ]; then
        echo "[$SCRIPT_INDEX] Found existing cluster directory: $cluster_dir"
        # Read current data_directory from config if present
        local current_data_dir
        current_data_dir=$(awk -F"='" '/^data_directory\s*=/{print $2}' "$cluster_dir/postgresql.conf" 2>/dev/null | sed "s/'\s*$//")
        if [ -z "$current_data_dir" ]; then
            # Try to infer default path
            current_data_dir="/var/lib/postgresql/$POSTGRESQL_VERSION/main"
        fi
        if [ "$current_data_dir" != "$POSTGRESQL_DATA_DIR" ]; then
            need_recreate=true
        fi
    else
        need_recreate=true
    fi

    # Stop base service to avoid conflicts
    $USE_SUDO systemctl stop postgresql 2>/dev/null || true

    # Case 1: If target data dir already initialized (PG_VERSION exists), adopt it via config
    if [ -f "$POSTGRESQL_DATA_DIR/PG_VERSION" ]; then
        echo "[$SCRIPT_INDEX] Existing initialized data directory detected: $POSTGRESQL_DATA_DIR"
        # Set proper ownership (skip in WSL as Windows filesystem doesn't support chown)
        if [ "$IS_WSL" = false ]; then
            $USE_SUDO chown -R postgres:postgres "$POSTGRESQL_DATA_DIR"
        fi
        # Ensure config dir exists
        if [ ! -d "$cluster_dir" ]; then
            echo "[$SCRIPT_INDEX] Creating cluster directory structure"
            $USE_SUDO mkdir -p "$cluster_dir"
            $USE_SUDO chown -R postgres:postgres "/etc/postgresql/$POSTGRESQL_VERSION"
        fi
        # Ensure base config exists (copy from package template if needed)
        if [ ! -f "$cluster_dir/postgresql.conf" ]; then
            echo "[$SCRIPT_INDEX] Bootstrapping configuration files"
            $USE_SUDO pg_createcluster "$POSTGRESQL_VERSION" main --datadir="/var/lib/postgresql/$POSTGRESQL_VERSION/main" --start
            $USE_SUDO systemctl stop postgresql
        fi
        # Point data_directory to our path and set logging options
        local cfg="$cluster_dir/postgresql.conf"
        if grep -q "^data_directory\s*=" "$cfg"; then
            $USE_SUDO sed -i "s|^data_directory\s*=.*$|data_directory = '$POSTGRESQL_DATA_DIR'|" "$cfg"
        else
            echo "data_directory = '$POSTGRESQL_DATA_DIR'" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        if grep -q "^#\?logging_collector\s*=" "$cfg"; then
            $USE_SUDO sed -i "s|^#\?logging_collector\s*=.*$|logging_collector = on|" "$cfg"
        else
            echo "logging_collector = on" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        if grep -q "^#\?log_directory\s*=" "$cfg"; then
            $USE_SUDO sed -i "s|^#\?log_directory\s*=.*$|log_directory = '$POSTGRESQL_LOG_DIR'|" "$cfg"
        else
            echo "log_directory = '$POSTGRESQL_LOG_DIR'" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        # Enable and start service
        $USE_SUDO systemctl enable postgresql >/dev/null 2>&1 || true
        $USE_SUDO systemctl start postgresql
    else
        # Case 2: Recreate cluster with target data dir
        if [ "$need_recreate" = true ]; then
            echo "[$SCRIPT_INDEX] Recreating cluster with data dir: $POSTGRESQL_DATA_DIR"
            # Drop existing cluster if present
            if [ -d "$cluster_dir" ]; then
                $USE_SUDO pg_dropcluster --stop "$POSTGRESQL_VERSION" main || true
            fi
            # Ensure parent and permissions; do not pre-create data dir (pg_createcluster will create it)
            $USE_SUDO mkdir -p "$(dirname "$POSTGRESQL_DATA_DIR")"
            # Set proper ownership (skip in WSL as Windows filesystem doesn't support chown)
            if [ "$IS_WSL" = false ]; then
                $USE_SUDO chown -R postgres:postgres "$(dirname "$POSTGRESQL_DATA_DIR")"
            fi
            # Create cluster in the desired data directory and start it
            $USE_SUDO pg_createcluster "$POSTGRESQL_VERSION" main --datadir="$POSTGRESQL_DATA_DIR" --start
            POSTGRESQL_CONFIG_DIR="/etc/postgresql/$POSTGRESQL_VERSION/main"
        fi
        # Update logging settings in cluster config
        local cfg="$POSTGRESQL_CONFIG_DIR/postgresql.conf"
        if grep -q "^#\?logging_collector\s*=" "$cfg"; then
            $USE_SUDO sed -i "s|^#\?logging_collector\s*=.*$|logging_collector = on|" "$cfg"
        else
            echo "logging_collector = on" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        if grep -q "^#\?log_directory\s*=" "$cfg"; then
            $USE_SUDO sed -i "s|^#\?log_directory\s*=.*$|log_directory = '$POSTGRESQL_LOG_DIR'|" "$cfg"
        else
            echo "log_directory = '$POSTGRESQL_LOG_DIR'" | $USE_SUDO tee -a "$cfg" >/dev/null
        fi
        $USE_SUDO systemctl enable postgresql >/dev/null 2>&1 || true
        $USE_SUDO systemctl restart postgresql
    fi

    echo "[$SCRIPT_INDEX] PostgreSQL cluster configuration completed"
}

# Function to setup PostgreSQL user and database
setup_postgresql_user() {
    echo "[$SCRIPT_INDEX] Setting up PostgreSQL user and databases..."

    # Wait for PostgreSQL to be ready
    sleep 3

    # Set password for postgres user (use peer auth before switching to md5)
    echo "[$SCRIPT_INDEX] Setting up postgres user password..."
    $USE_SUDO -u postgres psql -d postgres -c "ALTER USER postgres WITH PASSWORD 'postgres123';"

    # Create a sample database
    echo "[$SCRIPT_INDEX] Creating sample database..."
    $USE_SUDO -u postgres createdb sample_db

    # Update pg_hba.conf for local connections (Debian keeps it under /etc/postgresql/<ver>/main)
    local hba_file="$POSTGRESQL_CONFIG_DIR/pg_hba.conf"
    if [ -f "$hba_file" ]; then
        # Backup original
        $USE_SUDO cp "$hba_file" "$hba_file.backup"

        # Switch local auth to md5 robustly
        $USE_SUDO sed -E -i "s/^(\s*local\s+all\s+postgres\s+).*/\1md5/" "$hba_file"
        $USE_SUDO sed -E -i "s/^(\s*local\s+all\s+all\s+).*/\1md5/" "$hba_file"

        # Reload configuration
        $USE_SUDO systemctl reload postgresql
    fi

    echo "[$SCRIPT_INDEX] PostgreSQL user setup completed"
    echo "[$SCRIPT_INDEX] Default postgres password: postgres123"
}

# Function to display PostgreSQL status and information
show_postgresql_info() {
    echo "[$SCRIPT_INDEX] PostgreSQL Installation Information:"
    echo "[$SCRIPT_INDEX] ========================================"

    if command_exists psql; then
        echo "[$SCRIPT_INDEX] PostgreSQL Version: $(psql --version)"
        echo "[$SCRIPT_INDEX] Data Directory: $POSTGRESQL_DATA_DIR"
        if [ -z "$POSTGRESQL_CONFIG_DIR" ]; then
            local ver_detected
            ver_detected="$(detect_postgresql_version)"
            POSTGRESQL_CONFIG_DIR="/etc/postgresql/${ver_detected}/main"
        fi
        echo "[$SCRIPT_INDEX] Config Directory: $POSTGRESQL_CONFIG_DIR"
        echo "[$SCRIPT_INDEX] Log Directory: $POSTGRESQL_LOG_DIR"
        echo "[$SCRIPT_INDEX] Default Port: 5432"
        echo "[$SCRIPT_INDEX] Default User: postgres"
        echo "[$SCRIPT_INDEX] Default Password: postgres123"

        if is_postgresql_running; then
            echo "[$SCRIPT_INDEX] Status: Running"
            echo "[$SCRIPT_INDEX] Service: systemctl {start|stop|restart|status} postgresql"
        else
            echo "[$SCRIPT_INDEX] Status: Stopped"
        fi

        echo "[$SCRIPT_INDEX] Connect: psql -U postgres -d sample_db"
        echo "[$SCRIPT_INDEX] Config: $POSTGRESQL_CONFIG_DIR/postgresql.conf"
    else
        echo "[$SCRIPT_INDEX] PostgreSQL is not installed"
    fi

    echo "[$SCRIPT_INDEX] ========================================"
}

# Function to remove PostgreSQL
remove_postgresql() {
    echo "[$SCRIPT_INDEX] Removing PostgreSQL..."

    # Stop service
    if is_postgresql_running; then
        $USE_SUDO systemctl stop postgresql
    fi

    # Disable service
    $USE_SUDO systemctl disable postgresql 2>/dev/null || true

    # Remove packages
    $USE_SUDO apt remove --purge -y postgresql postgresql-contrib postgresql-client
    $USE_SUDO apt autoremove -y

    # Remove custom directories (ask for confirmation)
    echo "[$SCRIPT_INDEX] Do you want to remove PostgreSQL data directories? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        # Use path mapping from gvar_common.sh to support WSL Windows directories
        local postgresql_parent=$(map_web_path "/www/wwwroot/postgresql")
        $USE_SUDO rm -rf "$postgresql_parent"
        echo "[$SCRIPT_INDEX] PostgreSQL data directories removed"
    fi

    # Remove any stray systemd override
    $USE_SUDO rm -rf "/etc/systemd/system/postgresql.service.d"
    $USE_SUDO systemctl daemon-reload

    echo "[$SCRIPT_INDEX] PostgreSQL removal completed"
}

# Main execution logic
main() {
    case "$INSTALL_POSTGRESQL" in
        "true")
            if check_postgresql; then
                echo "[$SCRIPT_INDEX] PostgreSQL is already installed"
                show_postgresql_info
            else
                echo "[$SCRIPT_INDEX] Installing PostgreSQL..."
                if install_postgresql; then
                    configure_postgresql
                    if is_postgresql_running; then
                        setup_postgresql_user
                        show_postgresql_info
                        echo "[$SCRIPT_INDEX] PostgreSQL installation completed successfully"
                    else
                        echo "[$SCRIPT_INDEX] PostgreSQL installation failed - service not running"
                        exit 1
                    fi
                else
                    echo "[$SCRIPT_INDEX] PostgreSQL installation failed"
                    exit 1
                fi
            fi
            ;;
        "false")
            if check_postgresql; then
                echo "[$SCRIPT_INDEX] PostgreSQL is installed but disabled in configuration"
                if is_postgresql_running; then
                    echo "[$SCRIPT_INDEX] Stopping PostgreSQL service..."
                    $USE_SUDO systemctl stop postgresql
                    $USE_SUDO systemctl disable postgresql
                    echo "[$SCRIPT_INDEX] PostgreSQL service stopped and disabled"
                fi
            else
                echo "[$SCRIPT_INDEX] PostgreSQL is not installed (INSTALL_POSTGRESQL: $INSTALL_POSTGRESQL)"
            fi
            ;;
        "remove")
            if check_postgresql; then
                remove_postgresql
            else
                echo "[$SCRIPT_INDEX] PostgreSQL is not installed, nothing to remove"
            fi
            ;;
        *)
            echo "[$SCRIPT_INDEX] Invalid INSTALL_POSTGRESQL value: $INSTALL_POSTGRESQL"
            echo "[$SCRIPT_INDEX] Valid values: true, false, remove"
            exit 1
            ;;
    esac
}

# Check if PostgreSQL should be processed based on installation mode
case "$INSTALL_MODE" in
    "base")
        echo "[$SCRIPT_INDEX] Base mode - PostgreSQL installation skipped"
        exit 0
        ;;
    "server"|"full"|"desktop")
        echo "[$SCRIPT_INDEX] Mode: $INSTALL_MODE - Processing PostgreSQL..."
        ;;
    *)
        echo "[$SCRIPT_INDEX] Unknown installation mode: $INSTALL_MODE"
        ;;
esac

# Execute main function
main
