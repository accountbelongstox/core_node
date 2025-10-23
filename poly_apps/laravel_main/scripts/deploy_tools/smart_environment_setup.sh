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

# Smart Environment Setup - Automatically fixes common Laravel deployment issues
# Auto-creates .env from .env.example, sets up directories, generates app key, etc.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
STORAGE_DIR="$PROJECT_ROOT/storage"
BOOTSTRAP_CACHE="$PROJECT_ROOT/bootstrap/cache"

print_step() {
    local status="$1"
    local message="$2"

    case "$status" in
        INFO)
            echo -e "${CYAN}[AUTO]${NC} $message"
            ;;
        SUCCESS)
            echo -e "${GREEN}[DONE]${NC} $message"
            ;;
        SKIP)
            echo -e "${YELLOW}[SKIP]${NC} $message"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
    esac
}

setup_environment_file() {
    echo ""
    echo -e "${BLUE}=== Environment File Setup ===${NC}"

    if [ -f "$ENV_FILE" ]; then
        print_step "SKIP" ".env file already exists"
        return 0
    fi

    if [ ! -f "$ENV_EXAMPLE" ]; then
        print_step "ERROR" ".env.example not found - cannot auto-generate .env"
        return 1
    fi

    print_step "INFO" "Creating .env from .env.example"
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    if [ -f "$ENV_FILE" ]; then
        print_step "SUCCESS" ".env file created successfully"
        chmod 644 "$ENV_FILE"
        return 0
    else
        print_step "ERROR" "Failed to create .env file"
        return 1
    fi
}

setup_storage_directories() {
    echo ""
    echo -e "${BLUE}=== Storage Directories Setup ===${NC}"

    local storage_subdirs=("framework" "framework/cache" "framework/sessions" "framework/views" "logs" "app" "app/public")
    local created_count=0

    for subdir in "${storage_subdirs[@]}"; do
        local dir_path="$STORAGE_DIR/$subdir"
        if [ ! -d "$dir_path" ]; then
            print_step "INFO" "Creating directory: storage/$subdir"
            mkdir -p "$dir_path"
            ((created_count++))
        fi
    done

    if [ $created_count -gt 0 ]; then
        print_step "SUCCESS" "Created $created_count storage directories"
    else
        print_step "SKIP" "All storage directories already exist"
    fi

    if [ ! -d "$BOOTSTRAP_CACHE" ]; then
        print_step "INFO" "Creating bootstrap/cache directory"
        mkdir -p "$BOOTSTRAP_CACHE"
    fi

    print_step "INFO" "Setting storage permissions"
    chmod -R 775 "$STORAGE_DIR" 2>/dev/null || true
    chmod -R 775 "$BOOTSTRAP_CACHE" 2>/dev/null || true

    print_step "SUCCESS" "Storage directories configured"
    return 0
}

setup_app_key() {
    echo ""
    echo -e "${BLUE}=== Application Key Setup ===${NC}"

    if [ ! -f "$ENV_FILE" ]; then
        print_step "ERROR" ".env file not found - cannot generate app key"
        return 1
    fi

    local current_key=$(grep "^APP_KEY=" "$ENV_FILE" | cut -d'=' -f2)

    if [ -n "$current_key" ] && [ "$current_key" != "base64:" ]; then
        print_step "SKIP" "APP_KEY already exists in .env"
        return 0
    fi

    if [ ! -f "artisan" ]; then
        print_step "ERROR" "artisan file not found - cannot generate app key"
        return 1
    fi

    if ! command -v php &>/dev/null; then
        print_step "ERROR" "PHP not available - cannot generate app key"
        return 1
    fi

    print_step "INFO" "Generating application key"
    php artisan key:generate --force 2>/dev/null

    if [ $? -eq 0 ]; then
        print_step "SUCCESS" "Application key generated"
        return 0
    else
        print_step "ERROR" "Failed to generate application key"
        return 1
    fi
}

setup_database_file() {
    echo ""
    echo -e "${BLUE}=== Database File Setup ===${NC}"

    if [ ! -f "$ENV_FILE" ]; then
        print_step "SKIP" ".env not found - skipping database setup"
        return 0
    fi

    local db_connection=$(grep "^DB_CONNECTION=" "$ENV_FILE" | cut -d'=' -f2)

    if [ "$db_connection" != "sqlite" ]; then
        print_step "SKIP" "Database connection is not SQLite"
        return 0
    fi

    local db_path=$(grep "^DB_DATABASE=" "$ENV_FILE" | cut -d'=' -f2)

    if [ -z "$db_path" ]; then
        print_step "SKIP" "DB_DATABASE path not configured"
        return 0
    fi

    if [ -f "$db_path" ]; then
        print_step "SKIP" "SQLite database file already exists: $db_path"
        return 0
    fi

    print_step "INFO" "Creating SQLite database file: $db_path"

    local db_dir=$(dirname "$db_path")
    if [ ! -d "$db_dir" ]; then
        mkdir -p "$db_dir"
    fi

    touch "$db_path"
    chmod 664 "$db_path"

    if [ -f "$db_path" ]; then
        print_step "SUCCESS" "SQLite database file created"
        return 0
    else
        print_step "ERROR" "Failed to create SQLite database file"
        return 1
    fi
}

setup_composer_dependencies() {
    echo ""
    echo -e "${BLUE}=== Composer Dependencies Setup ===${NC}"

    if [ -d "$PROJECT_ROOT/vendor" ]; then
        print_step "SKIP" "Vendor directory already exists"
        return 0
    fi

    if [ ! -f "composer.json" ]; then
        print_step "ERROR" "composer.json not found"
        return 1
    fi

    if ! command -v composer &>/dev/null; then
        print_step "ERROR" "Composer not installed"
        return 1
    fi

    print_step "INFO" "Installing Composer dependencies (this may take a while)"

    composer install --no-interaction --prefer-dist --optimize-autoloader 2>&1 | while read line; do
        echo "       $line"
    done

    if [ -d "$PROJECT_ROOT/vendor" ]; then
        print_step "SUCCESS" "Composer dependencies installed"
        return 0
    else
        print_step "ERROR" "Failed to install Composer dependencies"
        return 1
    fi
}

setup_laravel_migrations() {
    echo ""
    echo -e "${BLUE}=== Database Migrations Setup ===${NC}"

    if [ ! -f "artisan" ]; then
        print_step "SKIP" "artisan not found - skipping migrations"
        return 0
    fi

    if ! command -v php &>/dev/null; then
        print_step "SKIP" "PHP not available - skipping migrations"
        return 0
    fi

    if [ ! -f "$ENV_FILE" ]; then
        print_step "SKIP" ".env not found - skipping migrations"
        return 0
    fi

    print_step "INFO" "Running database migrations"

    php artisan migrate --force 2>&1 | while read line; do
        if [[ "$line" =~ "Migrating" ]] || [[ "$line" =~ "Migrated" ]]; then
            echo "       $line"
        fi
    done

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        print_step "SUCCESS" "Database migrations completed"
        return 0
    else
        print_step "ERROR" "Database migrations failed (this may be expected if already migrated)"
        return 0
    fi
}

setup_laravel_cache() {
    echo ""
    echo -e "${BLUE}=== Laravel Cache Setup ===${NC}"

    if [ ! -f "artisan" ]; then
        print_step "SKIP" "artisan not found - skipping cache setup"
        return 0
    fi

    if ! command -v php &>/dev/null; then
        print_step "SKIP" "PHP not available - skipping cache setup"
        return 0
    fi

    print_step "INFO" "Clearing existing caches"
    php artisan config:clear 2>/dev/null || true
    php artisan cache:clear 2>/dev/null || true
    php artisan view:clear 2>/dev/null || true
    php artisan route:clear 2>/dev/null || true

    print_step "INFO" "Caching configuration and routes"
    php artisan config:cache 2>/dev/null || true
    php artisan route:cache 2>/dev/null || true

    print_step "SUCCESS" "Laravel cache configured"
    return 0
}

fix_permissions() {
    echo ""
    echo -e "${BLUE}=== Permissions Fix ===${NC}"

    print_step "INFO" "Setting proper file permissions"

    if [ -d "$STORAGE_DIR" ]; then
        chmod -R 775 "$STORAGE_DIR" 2>/dev/null || true
    fi

    if [ -d "$BOOTSTRAP_CACHE" ]; then
        chmod -R 775 "$BOOTSTRAP_CACHE" 2>/dev/null || true
    fi

    if [ -f "$ENV_FILE" ]; then
        chmod 644 "$ENV_FILE" 2>/dev/null || true
    fi

    print_step "SUCCESS" "Permissions updated"
    return 0
}

create_symlink_public_storage() {
    echo ""
    echo -e "${BLUE}=== Public Storage Symlink ===${NC}"

    local public_storage="$PROJECT_ROOT/public/storage"
    local storage_app="$PROJECT_ROOT/storage/app/public"

    if [ -L "$public_storage" ]; then
        print_step "SKIP" "Public storage symlink already exists"
        return 0
    fi

    if [ ! -d "$storage_app" ]; then
        print_step "INFO" "Creating storage/app/public directory"
        mkdir -p "$storage_app"
    fi

    if [ -f "artisan" ] && command -v php &>/dev/null; then
        print_step "INFO" "Creating storage symlink using artisan"
        php artisan storage:link 2>/dev/null

        if [ -L "$public_storage" ]; then
            print_step "SUCCESS" "Storage symlink created"
            return 0
        fi
    fi

    print_step "INFO" "Creating storage symlink manually"
    ln -sf "$storage_app" "$public_storage" 2>/dev/null || true

    if [ -L "$public_storage" ]; then
        print_step "SUCCESS" "Storage symlink created"
        return 0
    else
        print_step "SKIP" "Could not create storage symlink (may need manual setup)"
        return 0
    fi
}

verify_setup() {
    echo ""
    echo -e "${BLUE}=== Setup Verification ===${NC}"

    local issues=0

    if [ ! -f "$ENV_FILE" ]; then
        print_step "ERROR" ".env file missing"
        ((issues++))
    else
        print_step "SUCCESS" ".env file exists"
    fi

    if [ ! -d "$STORAGE_DIR/framework" ]; then
        print_step "ERROR" "Storage framework directory missing"
        ((issues++))
    else
        print_step "SUCCESS" "Storage directories exist"
    fi

    if [ -f "$ENV_FILE" ]; then
        local app_key=$(grep "^APP_KEY=" "$ENV_FILE" | cut -d'=' -f2)
        if [ -n "$app_key" ] && [ "$app_key" != "base64:" ]; then
            print_step "SUCCESS" "APP_KEY configured"
        else
            print_step "ERROR" "APP_KEY not configured"
            ((issues++))
        fi
    fi

    if [ -d "$PROJECT_ROOT/vendor" ]; then
        print_step "SUCCESS" "Composer dependencies installed"
    else
        print_step "ERROR" "Composer dependencies not installed"
        ((issues++))
    fi

    echo ""
    if [ $issues -eq 0 ]; then
        echo -e "${GREEN}Environment setup completed successfully!${NC}"
        return 0
    else
        echo -e "${YELLOW}Environment setup completed with $issues issues${NC}"
        return 1
    fi
}

run_smart_setup() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Laravel Smart Environment Setup${NC}"
    echo -e "${BLUE}========================================${NC}"

    setup_environment_file
    setup_storage_directories
    setup_composer_dependencies
    setup_app_key
    setup_database_file
    create_symlink_public_storage
    setup_laravel_migrations
    setup_laravel_cache
    fix_permissions
    verify_setup

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}Smart setup process completed${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

export -f print_step
export -f setup_environment_file
export -f setup_storage_directories
export -f setup_app_key
export -f setup_database_file
export -f setup_composer_dependencies
export -f setup_laravel_migrations
export -f setup_laravel_cache
export -f fix_permissions
export -f create_symlink_public_storage
export -f verify_setup
export -f run_smart_setup
