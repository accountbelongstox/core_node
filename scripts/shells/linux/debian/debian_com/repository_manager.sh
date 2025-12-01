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

# Repository Manager - Common functions for managing apt repositories
# This script provides functions for managing Microsoft Edge, Chrome, MariaDB, and PHP repositories

# Function to check if a repository is already added
is_repo_added() {
    local repo_name="$1"
    local repo_file="$2"
    
    if [ -f "$repo_file" ]; then
        echo "true"
        return 0
    else
        echo "false"
        return 1
    fi
}

# Function to add Microsoft Edge repository
add_edge_repository() {
    echo "Adding Microsoft Edge repository..."
    
    local edge_repo_file="/etc/apt/sources.list.d/microsoft-edge.list"
    local edge_gpg_file="/usr/share/keyrings/microsoft-edge.gpg"
    
    # Check if already added
    if [ "$(is_repo_added "edge" "$edge_repo_file")" = "true" ]; then
        echo "Microsoft Edge repository already added"
        return 0
    fi
    
    # Add Microsoft Edge GPG key
    echo "Adding Microsoft Edge GPG key..."
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
    $USE_SUDO install -o root -g root -m 644 microsoft.gpg "$edge_gpg_file"
    rm microsoft.gpg
    
    # Add repository
    echo "deb [arch=amd64 signed-by=$edge_gpg_file] https://packages.microsoft.com/repos/edge stable main" | \
        $USE_SUDO tee "$edge_repo_file"
    
    echo "Microsoft Edge repository added successfully"
}

# Function to remove Microsoft Edge repository
remove_edge_repository() {
    echo "Removing Microsoft Edge repository..."
    
    local edge_repo_file="/etc/apt/sources.list.d/microsoft-edge.list"
    local edge_gpg_file="/usr/share/keyrings/microsoft-edge.gpg"
    
    # Remove repository file
    if [ -f "$edge_repo_file" ]; then
        $USE_SUDO rm -f "$edge_repo_file"
        echo "Removed Microsoft Edge repository file"
    fi
    
    # Remove GPG key
    if [ -f "$edge_gpg_file" ]; then
        $USE_SUDO rm -f "$edge_gpg_file"
        echo "Removed Microsoft Edge GPG key"
    fi
    
    # Remove any Microsoft GPG keys from apt keyring
    $USE_SUDO apt-key del 0xBC528686B50D79E3 2>/dev/null || true
    
    echo "Microsoft Edge repository removed successfully"
}

# Function to add Google Chrome repository
add_chrome_repository() {
    echo "Adding Google Chrome repository..."

    local chrome_repo_file="/etc/apt/sources.list.d/google-chrome.list"
    local chrome_gpg_file="/usr/share/keyrings/google-chrome.gpg"

    # Check if already added
    if [ "$(is_repo_added "chrome" "$chrome_repo_file")" = "true" ]; then
        echo "Google Chrome repository already added"
        return 0
    fi

    # Add Google Chrome GPG key
    echo "Adding Google Chrome GPG key..."
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > google-chrome.gpg
    $USE_SUDO install -o root -g root -m 644 google-chrome.gpg "$chrome_gpg_file"
    rm google-chrome.gpg

    # Add repository
    echo "deb [arch=amd64 signed-by=$chrome_gpg_file] http://dl.google.com/linux/chrome/deb/ stable main" | \
        $USE_SUDO tee "$chrome_repo_file"

    echo "Google Chrome repository added successfully"
}

# Function to remove Google Chrome repository
remove_chrome_repository() {
    local script_tag="${SCRIPT_INDEX:-[REPO_MGR]}"
    echo "$script_tag Removing Google Chrome repository..."

    local chrome_repo_file="/etc/apt/sources.list.d/google-chrome.list"
    local chrome_gpg_file="/usr/share/keyrings/google-chrome.gpg"

    # Remove repository file
    if [ -f "$chrome_repo_file" ]; then
        $USE_SUDO rm -f "$chrome_repo_file"
        echo "$script_tag Removed Google Chrome repository file"
    fi

    # Remove GPG key
    if [ -f "$chrome_gpg_file" ]; then
        $USE_SUDO rm -f "$chrome_gpg_file"
        echo "$script_tag Removed Google Chrome GPG key"
    fi

    # Remove any Google GPG keys from apt keyring (old method)
    $USE_SUDO apt-key del 7FAC5991 2>/dev/null || true
    $USE_SUDO apt-key del D38B4796 2>/dev/null || true

    echo "$script_tag Google Chrome repository removed successfully"
}

# Function to add PHP repository (Ondrej PPA)
add_php_repository() {
    local script_tag="${SCRIPT_INDEX:-[REPO_MGR]}"
    echo "$script_tag Adding PHP repository (Ondrej PPA)..."

    # Detect OS
    local os_id=$(lsb_release -si 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "unknown")
    local os_codename=$(lsb_release -sc 2>/dev/null || echo "unknown")

    echo "$script_tag Detected OS: $os_id $os_codename"

    # Install required packages
    $USE_SUDO apt install -y software-properties-common lsb-release ca-certificates curl wget gnupg2 2>/dev/null || true

    # Remove existing PHP repository configurations to avoid conflicts
    $USE_SUDO rm -f /etc/apt/sources.list.d/php.list 2>/dev/null || true
    $USE_SUDO rm -f /etc/apt/sources.list.d/ondrej-ubuntu-php-*.list 2>/dev/null || true
    $USE_SUDO rm -f /usr/share/keyrings/php-archive-keyring.gpg 2>/dev/null || true

    # Setup repository based on OS
    if [[ "$os_id" == "ubuntu" ]]; then
        echo "$script_tag Setting up Ubuntu PPA repository..."
        if $USE_SUDO add-apt-repository ppa:ondrej/php -y 2>/dev/null; then
            echo "$script_tag Ubuntu PPA added successfully"
        else
            echo "$script_tag PPA failed, trying manual method..."
            $USE_SUDO wget -qO- https://packages.sury.org/php/apt.gpg | $USE_SUDO gpg --dearmor -o /usr/share/keyrings/php-archive-keyring.gpg
            echo "deb [signed-by=/usr/share/keyrings/php-archive-keyring.gpg] https://ppa.launchpad.net/ondrej/php/ubuntu $os_codename main" | $USE_SUDO tee /etc/apt/sources.list.d/php.list
        fi
    elif [[ "$os_id" == "debian" ]]; then
        echo "$script_tag Setting up Debian Sury repository..."
        $USE_SUDO wget -qO- https://packages.sury.org/php/apt.gpg | $USE_SUDO gpg --dearmor -o /usr/share/keyrings/php-archive-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/php-archive-keyring.gpg] https://packages.sury.org/php/ $os_codename main" | $USE_SUDO tee /etc/apt/sources.list.d/php.list
        echo "$script_tag Debian Sury repository added"
    else
        echo "$script_tag Unsupported OS: $os_id"
        return 1
    fi

    # Update package index
    echo "$script_tag Updating package index..."
    $USE_SUDO apt update 2>/dev/null || $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true

    echo "$script_tag PHP repository added successfully"
}

# Function to remove PHP repository
remove_php_repository() {
    local script_tag="${SCRIPT_INDEX:-[REPO_MGR]}"
    echo "$script_tag Removing PHP repository..."

    local php_repo_files=(
        "/etc/apt/sources.list.d/php.list"
        "/etc/apt/sources.list.d/ondrej-ubuntu-php-*.list"
    )
    local php_gpg_file="/usr/share/keyrings/php-archive-keyring.gpg"

    # Remove repository files
    for file in "${php_repo_files[@]}"; do
        if [ -f "$file" ] || ls $file 2>/dev/null; then
            $USE_SUDO rm -f $file
            echo "$script_tag Removed $file"
        fi
    done

    # Remove GPG key
    if [ -f "$php_gpg_file" ]; then
        $USE_SUDO rm -f "$php_gpg_file"
        echo "$script_tag Removed PHP GPG key"
    fi

    # Remove PPA from sources (Ubuntu)
    $USE_SUDO add-apt-repository --remove ppa:ondrej/php -y 2>/dev/null || true

    echo "$script_tag PHP repository removed successfully"
}

# Function to add MariaDB repository
add_mysql_repository() {
    echo "Adding MariaDB repository..."
    
    local mariadb_repo_files=(
        "/etc/apt/sources.list.d/mariadb.list"
        "/etc/apt/sources.list.d/mariadb-10.11.list"
        "/etc/apt/sources.list.d/mariadb-maxscale.list"
    )
    
    # Check if any MariaDB repository is already added
    local already_added=false
    for file in "${mariadb_repo_files[@]}"; do
        if [ -f "$file" ]; then
            already_added=true
            break
        fi
    done
    
    if [ "$already_added" = "true" ]; then
        echo "MariaDB repository already added"
        return 0
    fi
    
    # Add MariaDB repository using official setup script
    curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash -s -- --mariadb-server-version="mariadb-10.11"
    
    echo "MariaDB repository added successfully"
}

# Function to remove MariaDB repository
remove_mysql_repository() {
    echo "Removing MariaDB repository..."
    
    local mariadb_repo_files=(
        "/etc/apt/sources.list.d/mariadb.list"
        "/etc/apt/sources.list.d/mariadb-10.11.list"
        "/etc/apt/sources.list.d/mariadb-maxscale.list"
    )
    
    local mariadb_key_files=(
        "/usr/share/keyrings/mariadb-keyring.gpg"
        "/usr/share/keyrings/mariadb-archive-keyring.gpg"
    )
    
    # Remove repository files
    for file in "${mariadb_repo_files[@]}"; do
        if [ -f "$file" ]; then
            $USE_SUDO rm -f "$file"
            echo "Removed $file"
        fi
    done
    
    # Remove GPG keys
    for key in "${mariadb_key_files[@]}"; do
        if [ -f "$key" ]; then
            $USE_SUDO rm -f "$key"
            echo "Removed $key"
        fi
    done
    
    echo "MariaDB repository removed successfully"
}

# Function to check if Edge repository is properly configured
check_edge_repo_status() {
    local install_edge="$1"
    local edge_repo_file="/etc/apt/sources.list.d/microsoft-edge.list"
    
    if [ "$install_edge" = "true" ]; then
        if [ "$(is_repo_added "edge" "$edge_repo_file")" = "true" ]; then
            echo "Edge repository is properly added"
            return 0
        else
            echo "Edge repository is not added but should be"
            return 1
        fi
    elif [ "$install_edge" = "false" ]; then
        if [ "$(is_repo_added "edge" "$edge_repo_file")" = "false" ]; then
            echo "Edge repository is properly removed"
            return 0
        else
            echo "Edge repository is still present but should be removed"
            return 1
        fi
    else
        echo "INSTALL_EDGE is not set or invalid: $install_edge"
        return 1
    fi
}

# Function to check if MySQL repository is properly configured
check_mysql_repo_status() {
    local install_mysql="$1"
    local mariadb_repo_files=(
        "/etc/apt/sources.list.d/mariadb.list"
        "/etc/apt/sources.list.d/mariadb-10.11.list"
        "/etc/apt/sources.list.d/mariadb-maxscale.list"
    )
    
    local repo_exists=false
    for file in "${mariadb_repo_files[@]}"; do
        if [ -f "$file" ]; then
            repo_exists=true
            break
        fi
    done
    
    if [ "$install_mysql" = "true" ]; then
        if [ "$repo_exists" = "true" ]; then
            echo "MySQL repository is properly added"
            return 0
        else
            echo "MySQL repository is not added but should be"
            return 1
        fi
    elif [ "$install_mysql" = "false" ]; then
        if [ "$repo_exists" = "false" ]; then
            echo "MySQL repository is properly removed"
            return 0
        else
            echo "MySQL repository is still present but should be removed"
            return 1
        fi
    else
        echo "INSTALL_MYSQL is not set or invalid: $install_mysql"
        return 1
    fi
}

# Function to fix apt issues
fix_apt_issues() {
    echo "Attempting to fix apt issues..."
    
    # Clean apt cache
    $USE_SUDO apt clean 2>/dev/null || true
    $USE_SUDO apt autoclean 2>/dev/null || true
    
    # Fix broken packages
    $USE_SUDO apt --fix-broken install -y 2>/dev/null || true
    
    # Remove lock files if they exist
    $USE_SUDO rm -f /var/lib/dpkg/lock-frontend 2>/dev/null || true
    $USE_SUDO rm -f /var/lib/dpkg/lock 2>/dev/null || true
    $USE_SUDO rm -f /var/cache/apt/archives/lock 2>/dev/null || true
    
    # Reconfigure dpkg
    $USE_SUDO dpkg --configure -a 2>/dev/null || true
    
    # Update package lists
    $USE_SUDO apt update 2>/dev/null || $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true
    
    echo "Apt issues fix completed"
}

# Function to fix GPG key issues
fix_gpg_issues() {
    echo "Attempting to fix GPG key issues..."
    
    # Update GPG keys
    $USE_SUDO apt-key update 2>/dev/null || true
    
    # Fix Microsoft repository GPG key
    if ! curl -sSL https://packages.microsoft.com/keys/microsoft.asc | $USE_SUDO apt-key add - 2>/dev/null; then
        echo "Warning: Failed to add Microsoft GPG key"
    fi
    
    # Fix MariaDB repository GPG key
    if ! curl -sSL https://r.mariadb.com/RPM-GPG-KEY-MariaDB | $USE_SUDO apt-key add - 2>/dev/null; then
        echo "Warning: Failed to add MariaDB GPG key"
    fi
    
    echo "GPG issues fix completed"
}

# Function to manage repositories with auto-repair
manage_repositories() {
    echo "Managing repositories based on control variables..."
    
    # Get control variables
    local install_edge=$(get_global_var "INSTALL_EDGE" "false")
    local install_mysql=$(get_global_var "INSTALL_MYSQL" "false")
    
    echo "INSTALL_EDGE: $install_edge, INSTALL_MYSQL: $install_mysql"
    
    # Fix apt issues first
    fix_apt_issues
    
    # Manage Edge repository with auto-repair
    if [ "$install_edge" = "true" ]; then
        echo "Managing Edge repository..."
        if ! add_edge_repository; then
            echo "Edge repository addition failed, attempting repair..."
            fix_gpg_issues
            fix_apt_issues
            echo "Retrying Edge repository addition..."
            add_edge_repository || echo "Warning: Edge repository addition failed after repair"
        fi
    elif [ "$install_edge" = "false" ]; then
        echo "Removing Edge repository..."
        remove_edge_repository || echo "Warning: Edge repository removal had issues"
    else
        echo "INSTALL_EDGE not set or invalid: $install_edge"
    fi
    
    # Manage MySQL repository with auto-repair
    if [ "$install_mysql" = "true" ]; then
        echo "Managing MySQL repository..."
        if ! add_mysql_repository; then
            echo "MySQL repository addition failed, attempting repair..."
            fix_gpg_issues
            fix_apt_issues
            echo "Retrying MySQL repository addition..."
            add_mysql_repository || echo "Warning: MySQL repository addition failed after repair"
        fi
    elif [ "$install_mysql" = "false" ]; then
        echo "Removing MySQL repository..."
        remove_mysql_repository || echo "Warning: MySQL repository removal had issues"
    else
        echo "INSTALL_MYSQL not set or invalid: $install_mysql"
    fi
    
    echo "Repository management completed"
}

# Function to verify repository status for Edge installation with auto-repair
verify_edge_repo_for_install() {
    local install_edge=$(get_global_var "INSTALL_EDGE" "false")
    
    if ! check_edge_repo_status "$install_edge"; then
        echo "Edge repository status does not match INSTALL_EDGE setting, attempting auto-repair..."
        
        # Attempt to fix the repository status
        if [ "$install_edge" = "true" ]; then
            echo "Auto-repairing Edge repository..."
            fix_gpg_issues
            fix_apt_issues
            add_edge_repository || echo "Warning: Auto-repair failed for Edge repository"
        elif [ "$install_edge" = "false" ]; then
            echo "Auto-repairing Edge repository removal..."
            remove_edge_repository || echo "Warning: Auto-repair failed for Edge repository removal"
        fi
        
        # Check again after repair attempt
        if check_edge_repo_status "$install_edge"; then
            echo "Edge repository auto-repair successful"
            return 0
        else
            echo "Warning: Edge repository auto-repair failed, but continuing"
            return 1
        fi
    fi
    
    return 0
}

# Function to verify repository status for MySQL installation with auto-repair
verify_mysql_repo_for_install() {
    local install_mysql=$(get_global_var "INSTALL_MYSQL" "false")
    
    if ! check_mysql_repo_status "$install_mysql"; then
        echo "MySQL repository status does not match INSTALL_MYSQL setting, attempting auto-repair..."
        
        # Attempt to fix the repository status
        if [ "$install_mysql" = "true" ]; then
            echo "Auto-repairing MySQL repository..."
            fix_gpg_issues
            fix_apt_issues
            add_mysql_repository || echo "Warning: Auto-repair failed for MySQL repository"
        elif [ "$install_mysql" = "false" ]; then
            echo "Auto-repairing MySQL repository removal..."
            remove_mysql_repository || echo "Warning: Auto-repair failed for MySQL repository removal"
        fi
        
        # Check again after repair attempt
        if check_mysql_repo_status "$install_mysql"; then
            echo "MySQL repository auto-repair successful"
            return 0
        else
            echo "Warning: MySQL repository auto-repair failed, but continuing"
            return 1
        fi
    fi
    
    return 0
}
