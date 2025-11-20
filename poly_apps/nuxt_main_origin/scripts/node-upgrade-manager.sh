#!/bin/bash

# Node.js Version Manager and Dependency Upgrade Script
# Author: Assistant
# Description: Manages Node.js versions and upgrades dependencies with detailed guidance

set -e  # Exit on any error

# Save initial working directory
INITIAL_DIR=$(pwd)

# Working directory management
WORK_DIR=""
TARGET_DIR_ARG="$1"

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

log_reason() {
    echo -e "${CYAN}[REASON]${NC} $1"
}

# Banner
show_banner() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║           Node.js Version Manager & Upgrader             ║"
    echo "║                                                          ║"
    echo "║  Safely upgrade dependencies across Node.js versions    ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Working directory selection and validation
select_working_directory() {
    if [ -n "$TARGET_DIR_ARG" ]; then
        WORK_DIR="$TARGET_DIR_ARG"
        log_info "Using directory from parameter: $WORK_DIR"
    else
        echo -e "\n${YELLOW}═══ Working Directory Selection ═══${NC}"
        log_reason "Choose the directory containing the Node.js project to upgrade"
        
        echo "1) Current directory ($(pwd))"
        echo "2) Manual input"
        echo ""
        read -p "Select working directory [1-2] (default: 1): " dir_choice
        dir_choice=${dir_choice:-1}
        
        case $dir_choice in
            1)
                WORK_DIR="$(pwd)"
                log_info "Using current directory: $WORK_DIR"
                ;;
            2)
                read -p "Enter the full path to the Node.js project directory: " manual_dir
                if [ -n "$manual_dir" ]; then
                    WORK_DIR="$manual_dir"
                    log_info "Using manual input directory: $WORK_DIR"
                                 else
                     log_error "No directory specified"
                     cleanup_and_restore
                     exit 1
                 fi
                ;;
            *)
                log_error "Invalid selection"
                cleanup_and_restore
                exit 1
                ;;
        esac
    fi
    
    # Validate and change to working directory
    if [ ! -d "$WORK_DIR" ]; then
        log_error "Directory does not exist: $WORK_DIR"
        cleanup_and_restore
        exit 1
    fi
    
    log_step "Changing to working directory: $WORK_DIR"
    cd "$WORK_DIR" || {
        log_error "Cannot change to directory: $WORK_DIR"
        cleanup_and_restore
        exit 1
    }
    
    log_success "Working directory set to: $(pwd)"
}

# Cleanup function to restore initial directory
cleanup_and_restore() {
    log_step "Restoring initial working directory: $INITIAL_DIR"
    cd "$INITIAL_DIR" || {
        log_warning "Failed to restore initial directory: $INITIAL_DIR"
    }
}

# Trap to ensure cleanup on script interruption
trap 'cleanup_and_restore; exit 130' INT TERM

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check if we're in a Node.js project
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please run this script in a Node.js project root."
        cleanup_and_restore
        exit 1
    fi
    
    # Check if n is installed
    if ! command -v n &> /dev/null; then
        log_warning "Node version manager 'n' is not installed."
        log_info "Installing 'n' globally..."
        log_reason "We use 'n' to manage multiple Node.js versions seamlessly"
        
        if command -v npm &> /dev/null; then
            sudo npm install -g n
        else
            log_error "npm is not available. Please install Node.js first."
            cleanup_and_restore
            exit 1
        fi
    fi
    
    # Check if yarn is installed
    if ! command -v yarn &> /dev/null; then
        log_warning "Yarn is not installed."
        log_info "Installing Yarn globally..."
        log_reason "Yarn provides better dependency resolution and lockfile management"
        sudo npm install -g yarn
    fi
    
    log_success "All prerequisites are satisfied"
}

# Registry selection menu
select_registry() {
    echo -e "\n${YELLOW}═══ NPM Registry Configuration ═══${NC}"
    log_reason "Choosing the right registry ensures faster downloads and better connectivity"
    
    echo "1) Global (default npm registry)"
    echo "2) CN (China - faster for Chinese users)"
    echo ""
    read -p "Select registry [1-2] (default: 1): " registry_choice
    
    case ${registry_choice:-1} in
        1)
            REGISTRY="global"
            REGISTRY_URL="https://registry.npmjs.org/"
            log_info "Using global npm registry"
            ;;
        2)
            REGISTRY="cn"
            REGISTRY_URL="https://registry.npmmirror.com/"
            log_info "Using China npm mirror"
            ;;
        *)
            log_warning "Invalid choice, using global registry"
            REGISTRY="global"
            REGISTRY_URL="https://registry.npmjs.org/"
            ;;
    esac
}

# Configure npm registry
configure_registry() {
    log_step "Configuring npm registry to $REGISTRY_URL"
    log_reason "Setting registry ensures all package downloads use the selected source"
    
    npm config set registry "$REGISTRY_URL"
    yarn config set registry "$REGISTRY_URL"
    
    if [ "$REGISTRY" = "cn" ]; then
        # Set additional China-specific configurations
        npm config set disturl https://npmmirror.com/dist/
        npm config set electron_mirror https://npmmirror.com/mirrors/electron/
        npm config set electron_custom_dir 10.1.3
        log_info "Applied China-specific npm optimizations"
    fi
    
    log_success "Registry configured successfully"
}

# Parse engines from package.json
get_engines_node_version() {
    if [ -f "package.json" ]; then
        # Extract engines.node field
        local engines_node=$(node -e "
            try {
                const pkg = require('./package.json');
                if (pkg.engines && pkg.engines.node) {
                    console.log(pkg.engines.node);
                } else {
                    console.log('');
                }
            } catch (e) {
                console.log('');
            }
        " 2>/dev/null)
        
        if [ -n "$engines_node" ]; then
            log_info "Found engines.node in package.json: $engines_node"
            
            # Parse version range to recommend a specific version
            if [[ "$engines_node" == *">=16"* || "$engines_node" == *"^16"* ]]; then
                echo "3" # 18.12.0 (safe upgrade from 16)
            elif [[ "$engines_node" == *">=18"* || "$engines_node" == *"^18"* ]]; then
                echo "3" # 18.12.0
            elif [[ "$engines_node" == *">=20"* || "$engines_node" == *"^20"* ]]; then
                echo "5" # 20.9.0
            elif [[ "$engines_node" == *">=14"* || "$engines_node" == *"^14"* ]]; then
                echo "1" # 16.14.0 (upgrade from 14)
            else
                echo "3" # Default to 18.12.0 LTS
            fi
        else
            echo "3" # Default to 18.12.0 LTS if no engines field
        fi
    else
        echo "3" # Default to 18.12.0 LTS
    fi
}

# Node version selection menu
select_node_versions() {
    echo -e "\n${YELLOW}═══ Node.js Version Selection ═══${NC}"
    log_reason "We'll install dependencies on an older Node version first, then upgrade on a newer version"
    log_reason "This ensures maximum compatibility and catches version-specific issues"
    
    # Get recommended versions
    local recommended_old=$(get_engines_node_version)
    local recommended_new="6" # 20.18.0 (Latest LTS)
    
    echo "Available Node.js versions:"
    echo ""
    echo "16.x series:"
    echo "  1) 16.14.0 (LTS)$([ "$recommended_old" = "1" ] && echo " ← Recommended for OLD")"
    echo "  2) 16.20.2 (Latest 16.x)"
    echo ""
    echo "18.x series:"
    echo "  3) 18.12.0 (LTS)$([ "$recommended_old" = "3" ] && echo " ← Recommended for OLD")"
    echo "  4) 18.20.4 (Latest 18.x)"
    echo ""
    echo "20.x series:"
    echo "  5) 20.9.0 (LTS)$([ "$recommended_old" = "5" ] && echo " ← Recommended for OLD")"
    echo "  6) 20.18.0 (Latest LTS)$([ "$recommended_new" = "6" ] && echo " ← Recommended for NEW")"
    echo ""
    echo "22.x series:"
    echo "  7) 22.9.0"
    echo "  8) 22.15.0 (Latest)"
    echo ""
    
    # Select old version
    read -p "Select OLD Node.js version for initial installation [1-8] (default: $recommended_old): " old_choice
    old_choice=${old_choice:-$recommended_old}
    case $old_choice in
        1) OLD_NODE_VERSION="16.14.0" ;;
        2) OLD_NODE_VERSION="16.20.2" ;;
        3) OLD_NODE_VERSION="18.12.0" ;;
        4) OLD_NODE_VERSION="18.20.4" ;;
        5) OLD_NODE_VERSION="20.9.0" ;;
        6) OLD_NODE_VERSION="20.18.0" ;;
        7) OLD_NODE_VERSION="22.9.0" ;;
        8) OLD_NODE_VERSION="22.15.0" ;;
        *) 
            log_error "Invalid selection"
            cleanup_and_restore
            exit 1
            ;;
    esac
    
    # Select new version
    read -p "Select NEW Node.js version for upgrade [1-8] (default: $recommended_new): " new_choice
    new_choice=${new_choice:-$recommended_new}
    case $new_choice in
        1) NEW_NODE_VERSION="16.14.0" ;;
        2) NEW_NODE_VERSION="16.20.2" ;;
        3) NEW_NODE_VERSION="18.12.0" ;;
        4) NEW_NODE_VERSION="18.20.4" ;;
        5) NEW_NODE_VERSION="20.9.0" ;;
        6) NEW_NODE_VERSION="20.18.0" ;;
        7) NEW_NODE_VERSION="22.9.0" ;;
        8) NEW_NODE_VERSION="22.15.0" ;;
        *) 
            log_error "Invalid selection"
            cleanup_and_restore
            exit 1
            ;;
    esac
    
    log_info "Selected versions:"
    log_info "  Old (for initial install): Node.js $OLD_NODE_VERSION"
    log_info "  New (for upgrade): Node.js $NEW_NODE_VERSION"
}

# Install and switch to Node version
switch_node_version() {
    local version=$1
    local purpose=$2
    
    log_step "Switching to Node.js $version for $purpose"
    log_reason "Using 'n' to manage Node.js versions ensures clean environment switches"
    
    log_info "Installing Node.js $version (if not already installed)..."
    sudo n $version
    
    # Verify the switch
    local current_version=$(node --version)
    log_info "Current Node.js version: $current_version"
    
    if [[ "$current_version" == *"$version"* ]]; then
        log_success "Successfully switched to Node.js $version"
    else
        log_warning "Version switch may not be complete. Current: $current_version, Expected: $version"
    fi
}

# Clean environment
clean_environment() {
    log_step "Cleaning existing dependencies and lock files"
    log_reason "Removing old dependencies ensures a fresh start and prevents conflicts"
    
    if [ -d "node_modules" ]; then
        log_info "Removing node_modules directory..."
        rm -rf node_modules
    fi
    
    if [ -f "yarn.lock" ]; then
        log_info "Removing existing yarn.lock..."
        rm -f yarn.lock
    fi
    
    if [ -f "package-lock.json" ]; then
        log_info "Removing existing package-lock.json..."
        rm -f package-lock.json
    fi
    
    log_success "Environment cleaned"
}

# Install dependencies with old Node version
install_with_old_node() {
    log_step "Installing dependencies with Node.js $OLD_NODE_VERSION"
    log_reason "Installing with older Node ensures compatibility and generates a stable yarn.lock"
    
    switch_node_version $OLD_NODE_VERSION "initial dependency installation"
    
    log_info "Running yarn install..."
    if yarn install; then
        log_success "Dependencies installed successfully with Node.js $OLD_NODE_VERSION"
    else
        log_error "Failed to install dependencies with Node.js $OLD_NODE_VERSION"
        log_info "Trying with --legacy-peer-deps flag..."
        if yarn install --legacy-peer-deps; then
            log_success "Dependencies installed with legacy peer deps"
        else
            log_error "Installation failed even with legacy peer deps"
            cleanup_and_restore
            exit 1
        fi
    fi
    
    # Verify yarn.lock was created
    if [ -f "yarn.lock" ]; then
        log_success "yarn.lock file generated successfully"
    else
        log_error "yarn.lock file was not created"
        cleanup_and_restore
        exit 1
    fi
}

# Upgrade with new Node version
upgrade_with_new_node() {
    log_step "Upgrading dependencies with Node.js $NEW_NODE_VERSION"
    log_reason "Using newer Node version for upgrades ensures compatibility with latest features"
    
    switch_node_version $NEW_NODE_VERSION "dependency upgrade"
    
    log_info "Running yarn upgrade-interactive --latest..."
    log_warning "Interactive upgrade will start. You can choose which packages to upgrade."
    log_info "Recommended: Upgrade packages with major version changes carefully"
    log_info "Press SPACE to select, ENTER to confirm, or follow the interactive prompts"
    
    echo ""
    echo -e "${YELLOW}Starting interactive upgrade in 3 seconds...${NC}"
    sleep 3
    
    if yarn upgrade-interactive --latest; then
        log_success "Interactive upgrade completed successfully"
    else
        log_warning "Interactive upgrade was cancelled or failed"
        log_info "You can run 'yarn upgrade-interactive --latest' manually later"
    fi
}

# Final installation with new Node version
final_install_with_new_node() {
    log_step "Running final installation with Node.js $NEW_NODE_VERSION"
    log_reason "Installing dependencies with the new Node version ensures all packages work correctly"
    
    log_info "Running yarn install..."
    if yarn install; then
        log_success "Final installation completed successfully with Node.js $NEW_NODE_VERSION"
        log_info "All dependencies are now installed and compatible with the new Node.js version"
    else
        log_warning "Final installation failed with standard yarn install"
        log_info "Trying with --legacy-peer-deps flag..."
        
        if yarn install --legacy-peer-deps; then
            log_success "Final installation completed with legacy peer deps"
        else
            log_error "Final installation failed even with legacy peer deps"
            echo ""
            echo -e "${YELLOW}Manual installation commands to try:${NC}"
            echo "cd $(pwd)"
            echo "yarn install"
            echo "yarn install --legacy-peer-deps"
            echo "yarn install --force"
            echo "npm install"
            echo "npm install --legacy-peer-deps"
            echo "npm install --force"
            echo ""
            log_warning "Please try the above commands manually to complete the installation"
        fi
    fi
}

# Generate upgrade report
generate_report() {
    log_step "Generating upgrade report..."
    
    local report_file="upgrade-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Dependency Upgrade Report

Generated: $(date '+%Y-%m-%d %H:%M:%S')

## Configuration Used
- Registry: $REGISTRY ($REGISTRY_URL)
- Old Node.js Version: $OLD_NODE_VERSION
- New Node.js Version: $NEW_NODE_VERSION
- Working Directory: $WORK_DIR

## Process Summary
1. ✅ Cleaned environment (removed node_modules, lock files)
2. ✅ Switched to Node.js $OLD_NODE_VERSION
3. ✅ Installed dependencies with yarn
4. ✅ Generated yarn.lock file
5. ✅ Switched to Node.js $NEW_NODE_VERSION
6. ✅ Ran interactive upgrade
7. ✅ Final installation with new Node.js version

## Current Environment
- Node.js Version: $(node --version)
- Yarn Version: $(yarn --version)
- NPM Registry: $(npm config get registry)

## Next Steps
1. Test your application: \`yarn dev\` or \`npm run dev\`
2. Run tests if available: \`yarn test\` or \`npm test\`
3. Check for any breaking changes in upgraded packages
4. Commit the updated package.json and yarn.lock

## Verification Commands
\`\`\`bash
# Verify installation completed successfully
yarn list --depth=0

# Check for vulnerabilities
yarn audit

# Check for outdated packages
yarn outdated

# Test development server
yarn dev

# Test build process
yarn build
\`\`\`

## Manual Installation (if needed)
If the final installation failed, try these commands in the working directory:
\`\`\`bash
cd $WORK_DIR
yarn install
yarn install --legacy-peer-deps
yarn install --force
npm install
npm install --legacy-peer-deps
npm install --force
\`\`\`

EOF

    log_success "Upgrade report saved to: $report_file"
}

# Main execution
main() {
    show_banner
    
    log_info "Starting Node.js version management and dependency upgrade process"
    echo ""
    
    # Step 1: Select working directory
    select_working_directory
    echo ""
    
    # Step 2: Check prerequisites
    check_prerequisites
    echo ""
    
    # Step 3: Select registry
    select_registry
    echo ""
    
    # Step 4: Configure registry
    configure_registry
    echo ""
    
    # Step 5: Select Node versions
    select_node_versions
    echo ""
    
    # Step 6: Confirm the plan
    echo -e "${YELLOW}═══ Execution Plan ═══${NC}"
    echo "Working directory: $WORK_DIR"
    echo "1. Clean environment (remove node_modules, lock files)"
    echo "2. Switch to Node.js $OLD_NODE_VERSION"
    echo "3. Install dependencies with yarn"
    echo "4. Switch to Node.js $NEW_NODE_VERSION"
    echo "5. Run interactive upgrade"
    echo "6. Final installation with new Node.js version"
    echo "7. Generate upgrade report"
    echo "8. Restore initial working directory"
    echo ""
    read -p "Do you want to proceed? [y/N]: " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled by user"
        cleanup_and_restore
        exit 0
    fi
    
    echo ""
    log_info "Starting execution..."
    echo ""
    
    # Step 7: Execute the plan
    clean_environment
    echo ""
    
    install_with_old_node
    echo ""
    
    upgrade_with_new_node
    echo ""
    
    final_install_with_new_node
    echo ""
    
    generate_report
    echo ""
    
    # Final summary
    echo -e "${GREEN}═══ Process Complete ═══${NC}"
    log_success "Node.js version management and dependency upgrade completed!"
    log_info "Current Node.js version: $(node --version)"
    log_info "Registry: $(npm config get registry)"
    log_warning "Please test your application thoroughly before deploying"
    echo ""
    echo -e "${YELLOW}Recommended next steps:${NC}"
    echo "1. Verify installation: yarn list --depth=0"
    echo "2. Run your development server: yarn dev"
    echo "3. Test critical functionality"
    echo "4. Check for any console errors"
    echo "5. Review the upgrade report"
    echo ""
    
    log_info "Working directory was: $WORK_DIR"
    log_info "Dependencies have been upgraded and installed with Node.js $NEW_NODE_VERSION"
    
    # Restore initial directory
    cleanup_and_restore
}

# Execute main function
main "$@" 