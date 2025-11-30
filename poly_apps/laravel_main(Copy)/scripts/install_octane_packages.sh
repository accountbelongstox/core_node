#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Temporary script to install Laravel Octane packages
# This will be automatically pulled by composer install in future deployments

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Installing Laravel Octane Packages${NC}"
echo -e "${CYAN}========================================${NC}"

cd "$LARAVEL_ROOT" || exit 1

echo -e "${BLUE}Current directory: $(pwd)${NC}"
echo ""

echo -e "${BLUE}Step 1: Checking Composer...${NC}"
if ! command -v composer &> /dev/null; then
    echo -e "${RED}Composer not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Composer found${NC}"
echo ""

echo -e "${BLUE}Step 2: Installing Laravel Octane...${NC}"
composer require laravel/octane
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install Laravel Octane${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Laravel Octane installed${NC}"
echo ""

echo -e "${BLUE}Step 3: Publishing Octane configuration...${NC}"
php artisan octane:install --server=swoole
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Warning: octane:install command failed, but package may be installed${NC}"
fi
echo -e "${GREEN}✓ Configuration published${NC}"
echo ""

echo -e "${BLUE}Step 4: Verifying installation...${NC}"
if [ -f "$LARAVEL_ROOT/config/octane.php" ]; then
    echo -e "${GREEN}✓ Octane config file created${NC}"
else
    echo -e "${YELLOW}⚠ Octane config not found, may need manual setup${NC}"
fi

if composer show | grep -q "laravel/octane"; then
    echo -e "${GREEN}✓ Laravel Octane package installed${NC}"
else
    echo -e "${RED}✗ Laravel Octane package not found${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  1. Check config/octane.php for settings"
echo -e "  2. Test: php artisan octane:start --port=8000"
echo -e "  3. Use ServerManager to deploy with Swoole mode"
echo ""
