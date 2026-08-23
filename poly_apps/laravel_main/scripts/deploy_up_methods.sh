#!/bin/bash

# ============================================================================
up_20251115_install_laravel_mcp() {
    local version="20251115_install_laravel_mcp"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-11-15${NC}"
    echo -e "${CYAN}[UP] Description: Install Laravel MCP for AI integration${NC}"


    echo -e "${CYAN}========================================${NC}"

    local laravel_dir="$LARAVEL_DIR"
    if [ -z "$laravel_dir" ]; then
        echo -e "${RED}[UP] ERROR: Laravel directory not found${NC}"
        return 1
    fi

    cd "$laravel_dir" || return 1

    echo -e "${BLUE}[UP] Step 1: Checking Composer...${NC}"
    if ! command -v composer &> /dev/null; then
        echo -e "${RED}[UP] Composer not found${NC}"
        return 1
    fi
    echo -e "${GREEN}[UP] OK Composer found${NC}"

    echo -e "${BLUE}[UP] Step 2: Installing/Updating Laravel MCP...${NC}"
    print_cmd "$USE_SUDO composer show | grep -q \"laravel/mcp\""
    if $USE_SUDO composer show | grep -q "laravel/mcp"; then
        echo -e "${BLUE}[UP] Laravel MCP already installed, ensuring latest version...${NC}"
        print_cmd "$USE_SUDO composer update laravel/mcp"
        $USE_SUDO composer update laravel/mcp
    else
        echo -e "${BLUE}[UP] Installing Laravel MCP...${NC}"
        print_cmd "$USE_SUDO composer require laravel/mcp"
        $USE_SUDO composer require laravel/mcp
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 3: Publishing AI routes...${NC}"
    print_cmd "test -f \"$LARAVEL_DIR/routes/ai.php\""
    if [ -f "$LARAVEL_DIR/routes/ai.php" ]; then
        echo -e "${BLUE}[UP] AI routes already exist, skipping publish${NC}"
    else
        print_cmd "$USE_SUDO php artisan vendor:publish --tag=ai-routes --force"
        $USE_SUDO php artisan vendor:publish --tag=ai-routes --force
    fi

    if [ -f "$laravel_dir/routes/ai.php" ]; then
        echo -e "${GREEN}[UP] OK AI routes file exists${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING AI routes file not found${NC}"
    fi

    echo -e "${BLUE}[UP] Step 4: Verifying installation...${NC}"
    print_cmd "$USE_SUDO composer show | grep -q \"laravel/mcp\""
    if $USE_SUDO composer show | grep -q "laravel/mcp"; then
        echo -e "${GREEN}[UP] OK Laravel MCP package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR Laravel MCP package not found${NC}"
        return 1
    fi

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251115_install_octane
# Date: 2025-11-15
# Description: Install Laravel Octane with Swoole support
# Idempotent: Can be run multiple times safely
# ============================================================================
up_20251115_install_octane() {
    local version="20251115_install_octane"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-11-15${NC}"
    echo -e "${CYAN}[UP] Description: Install Laravel Octane with Swoole${NC}"


    echo -e "${CYAN}========================================${NC}"

    if [ -z "$LARAVEL_DIR" ]; then
        echo -e "${RED}[UP] ERROR: Laravel directory not found${NC}"
        return 1
    fi

    print_cmd "cd \"$LARAVEL_DIR\""
    cd "$LARAVEL_DIR" || return 1

    echo -e "${BLUE}[UP] Step 1: Checking Composer...${NC}"
    print_cmd "command -v composer"
    if ! command -v composer &> /dev/null; then
        echo -e "${RED}[UP] Composer not found${NC}"
        return 1
    fi
    echo -e "${GREEN}[UP] OK Composer found${NC}"

    echo -e "${BLUE}[UP] Step 2: Installing/Updating Laravel Octane...${NC}"
    # Check if already installed
    print_cmd "$USE_SUDO composer show | grep -q \"laravel/octane\""
    if $USE_SUDO composer show | grep -q "laravel/octane"; then
        echo -e "${BLUE}[UP] Laravel Octane already installed, ensuring latest version...${NC}"
        print_cmd "$USE_SUDO composer update laravel/octane"
        $USE_SUDO composer update laravel/octane
    else
        echo -e "${BLUE}[UP] Installing Laravel Octane...${NC}"
        print_cmd "$USE_SUDO composer require laravel/octane"
        $USE_SUDO composer require laravel/octane
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 3: Publishing Octane configuration...${NC}"
    print_cmd "test -f \"$LARAVEL_DIR/config/octane.php\""
    if [ -f "$LARAVEL_DIR/config/octane.php" ]; then
        echo -e "${BLUE}[UP] Octane config already exists, skipping publish${NC}"
    else
        print_cmd "$USE_SUDO php artisan octane:install --server=swoole 2>&1 | grep -v \"Octane installed successfully\""
        $USE_SUDO php artisan octane:install --server=swoole 2>&1 | grep -v "Octane installed successfully"
    fi

    if [ -f "$laravel_dir/config/octane.php" ]; then
        echo -e "${GREEN}[UP] OK Octane config file exists${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING Octane config not found${NC}"
    fi

    echo -e "${BLUE}[UP] Step 4: Verifying installation...${NC}"
    print_cmd "$USE_SUDO composer show | grep -q \"laravel/octane\""
    if $USE_SUDO composer show | grep -q "laravel/octane"; then
        echo -e "${GREEN}[UP] OK Laravel Octane package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR Laravel Octane package not found${NC}"
        return 1
    fi

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251127_install_chokidar
# Date: 2025-11-27
# Description: Install chokidar for Octane hot-reload functionality
# Idempotent: Always runs to verify and fix installation
# ============================================================================
up_20251127_install_chokidar() {
    local version="20251127_install_chokidar"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-11-27${NC}"
    echo -e "${CYAN}[UP] Description: Install chokidar for hot-reload${NC}"
    echo -e "${CYAN}[UP] Note: Always runs to ensure proper installation${NC}"
    echo -e "${CYAN}========================================${NC}"

    if [ -z "$LARAVEL_DIR" ]; then
        echo -e "${RED}[UP] ERROR: Laravel directory not found${NC}"
        return 1
    fi

    print_cmd "cd \"$LARAVEL_DIR\""
    cd "$LARAVEL_DIR" || return 1

    echo -e "${BLUE}[UP] Step 1: Checking Node.js and pnpm...${NC}"
    print_cmd "command -v node"
    if ! command -v node &> /dev/null; then
        echo -e "${RED}[UP] ERROR: Node.js not found${NC}"
        echo -e "${YELLOW}[UP] Please install Node.js first${NC}"
        return 1
    fi

    print_cmd "command -v pnpm"
    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}[UP] ERROR: pnpm not found${NC}"
        echo -e "${YELLOW}[UP] Please install pnpm first (npm install -g pnpm)${NC}"
        return 1
    fi

    print_cmd "node --version"
    local node_version=$(node --version)
    print_cmd "pnpm --version"
    local pnpm_version=$(pnpm --version)
    echo -e "${GREEN}[UP] OK Node.js: $node_version${NC}"
    echo -e "${GREEN}[UP] OK pnpm: $pnpm_version${NC}"

    echo -e "${BLUE}[UP] Step 2: Checking/Installing chokidar (always runs)...${NC}"

    print_cmd "test -d \"node_modules/chokidar\""
    if [ -d "node_modules/chokidar" ]; then
        echo -e "${BLUE}[UP] chokidar exists, verifying installation...${NC}"
        print_cmd "pnpm install --save-dev chokidar 2>&1 | grep -E \"(up to date|added|updated|Progress)\" || true"
        pnpm install --save-dev chokidar 2>&1 | grep -E "(up to date|added|updated|Progress)" || true
    else
        echo -e "${BLUE}[UP] Installing chokidar...${NC}"
        print_cmd "pnpm install --save-dev chokidar"
        pnpm install --save-dev chokidar
    fi

    echo -e "${BLUE}[UP] Step 3: Verifying chokidar installation...${NC}"
    print_cmd "test -d \"node_modules/chokidar\""
    if [ -d "node_modules/chokidar" ]; then
        print_cmd "pnpm list chokidar 2>/dev/null | grep chokidar | head -1 | awk '{print \$2}' || echo \"unknown\""
        local chokidar_version=$(pnpm list chokidar 2>/dev/null | grep chokidar | head -1 | awk '{print $2}' || echo "unknown")
        echo -e "${GREEN}[UP] OK chokidar installed (version: $chokidar_version)${NC}"
    else
        echo -e "${RED}[UP] ERROR: chokidar not found after installation${NC}"
        return 1
    fi

    echo -e "${BLUE}[UP] Step 4: Testing chokidar functionality...${NC}"
    print_cmd "node -e \"require('chokidar'); console.log('OK')\" 2>/dev/null | grep -q \"OK\""
    if node -e "require('chokidar'); console.log('OK')" 2>/dev/null | grep -q "OK"; then
        echo -e "${GREEN}[UP] OK chokidar can be loaded successfully${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING: chokidar test failed, but continuing...${NC}"
    fi

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251206_install_faker
# Date: 2025-12-06
# Description: Install FakerPHP library for model factories and seeding
# Idempotent: Can be run multiple times safely
# ============================================================================
up_20251206_install_faker() {
    local version="20251206_install_faker"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-12-06${NC}"
    echo -e "${CYAN}[UP] Description: Install FakerPHP for testing${NC}"


    echo -e "${CYAN}========================================${NC}"

    if [ -z "$LARAVEL_DIR" ]; then
        echo -e "${RED}[UP] ERROR: Laravel directory not found${NC}"
        return 1
    fi

    print_cmd "cd \"$LARAVEL_DIR\""
    cd "$LARAVEL_DIR" || return 1

    echo -e "${BLUE}[UP] Step 1: Checking Composer...${NC}"
    print_cmd "command -v composer"
    if ! command -v composer &> /dev/null; then
        echo -e "${RED}[UP] Composer not found${NC}"
        return 1
    fi
    echo -e "${GREEN}[UP] OK Composer found${NC}"

    echo -e "${BLUE}[UP] Step 2: Installing/Updating FakerPHP...${NC}"
    print_cmd "$USE_SUDO composer show | grep -q \"fakerphp/faker\""
    if $USE_SUDO composer show | grep -q "fakerphp/faker"; then
        echo -e "${BLUE}[UP] FakerPHP already installed, ensuring latest version...${NC}"
        print_cmd "$USE_SUDO composer update fakerphp/faker --dev"
        $USE_SUDO composer update fakerphp/faker --dev
    else
        echo -e "${BLUE}[UP] Installing FakerPHP...${NC}"
        print_cmd "$USE_SUDO composer require fakerphp/faker --dev"
        $USE_SUDO composer require fakerphp/faker --dev
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 3: Verifying installation...${NC}"
    print_cmd "$USE_SUDO composer show | grep -q \"fakerphp/faker\""
    if $USE_SUDO composer show | grep -q "fakerphp/faker"; then
        echo -e "${GREEN}[UP] OK FakerPHP package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR FakerPHP package not found${NC}"
        return 1
    fi

    echo -e "${BLUE}[UP] Step 4: Testing fake() helper...${NC}"
    print_cmd "php artisan tinker --execute=\"var_dump(function_exists('fake'));\" 2>/dev/null | grep -q \"bool(true)\""
    if php artisan tinker --execute="var_dump(function_exists('fake'));" 2>/dev/null | grep -q "bool(true)"; then
        echo -e "${GREEN}[UP] OK fake() helper function is available${NC}"
    else
        echo -e "${YELLOW}[UP] WARNING fake() helper may not be available${NC}"
    fi

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# UP: 20251220_install_haikunator
# Date: 2025-12-20
# Description: Install Haikunator PHP for auto-generating nicknames
# Idempotent: Can be run multiple times safely
# ============================================================================
up_20251220_install_haikunator() {
    local version="20251220_install_haikunator"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[UP] Running: $version${NC}"
    echo -e "${CYAN}[UP] Date: 2025-12-20${NC}"
    echo -e "${CYAN}[UP] Description: Install Haikunator for nickname generation${NC}"


    echo -e "${CYAN}========================================${NC}"

    if [ -z "$LARAVEL_DIR" ]; then
        echo -e "${RED}[UP] ERROR: Laravel directory not found${NC}"
        return 1
    fi

    print_cmd "cd \"$LARAVEL_DIR\""
    cd "$LARAVEL_DIR" || return 1

    echo -e "${BLUE}[UP] Step 1: Checking Composer...${NC}"
    print_cmd "command -v composer"
    if ! command -v composer &> /dev/null; then
        echo -e "${RED}[UP] Composer not found${NC}"
        return 1
    fi
    echo -e "${GREEN}[UP] OK Composer found${NC}"

    echo -e "${BLUE}[UP] Step 2: Installing/Updating Haikunator...${NC}"
    print_cmd "$USE_SUDO composer show | grep -q \"atrox/haikunator\""
    if $USE_SUDO composer show | grep -q "atrox/haikunator"; then
        echo -e "${BLUE}[UP] Haikunator already installed, ensuring latest version...${NC}"
        print_cmd "$USE_SUDO composer update atrox/haikunator"
        $USE_SUDO composer update atrox/haikunator
    else
        echo -e "${BLUE}[UP] Installing Haikunator...${NC}"
        print_cmd "$USE_SUDO composer require atrox/haikunator"
        $USE_SUDO composer require atrox/haikunator
    fi

    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[UP] Warning: Composer operation had issues, checking installation...${NC}"
    fi

    echo -e "${BLUE}[UP] Step 3: Verifying installation...${NC}"
    print_cmd "$USE_SUDO composer show | grep -q \"atrox/haikunator\""
    if $USE_SUDO composer show | grep -q "atrox/haikunator"; then
        echo -e "${GREEN}[UP] OK Haikunator package installed${NC}"
    else
        echo -e "${RED}[UP] ERROR Haikunator package not found${NC}"
        return 1
    fi

    echo -e "${GREEN}[UP] $version completed${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[UP] $version completed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"

    return 0
}

# ============================================================================
# REUSABLE FUNCTIONS - Can be called from other scripts
# ============================================================================

