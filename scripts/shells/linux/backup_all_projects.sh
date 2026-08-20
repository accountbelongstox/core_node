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

# =============================================================================
# Backup All Projects - One-click archive of all code projects on this machine
# =============================================================================
# Scans all user homes and common locations for project indicators (.git,
# package.json, requirements.txt, Cargo.toml, etc.), then archives each
# project into a single backup directory as .tar.gz files.
#
# Usage:
#   bash backup_all_projects.sh [BACKUP_DIR]
#   Default BACKUP_DIR: /var/_core_node/backups/projects_<date>
# =============================================================================

# Variable Declarations
SCRIPT_NAME="backup_all_projects"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEFAULT_BACKUP_DIR="/var/_core_node/backups/projects_${TIMESTAMP}"
BACKUP_DIR="${1:-$DEFAULT_BACKUP_DIR}"
MANIFEST_FILE=""
LOG_FILE=""
TOTAL_PROJECTS=0
TOTAL_SIZE=0
FAILED_COUNT=0

# Exclude patterns for tar (skip build artifacts, deps, caches)
TAR_EXCLUDES=(
    --exclude='.git'
    --exclude='node_modules'
    --exclude='vendor'
    --exclude='__pycache__'
    --exclude='.cache'
    --exclude='.venv'
    --exclude='venv'
    --exclude='env'
    --exclude='.env'
    --exclude='.env.local'
    --exclude='target'
    --exclude='dist'
    --exclude='build'
    --exclude='.next'
    --exclude='.nuxt'
    --exclude='.tox'
    --exclude='*.pyc'
    --exclude='.mypy_cache'
    --exclude='.pytest_cache'
    --exclude='coverage'
    --exclude='.gradle'
    --exclude='.m2'
    --exclude='bin/Debug'
    --exclude='bin/Release'
    --exclude='obj'
)

# Project indicator files (searched by find)
PROJECT_INDICATORS=(
    "package.json"
    "requirements.txt"
    "setup.py"
    "pyproject.toml"
    "composer.json"
    "Cargo.toml"
    "go.mod"
    "pom.xml"
    "build.gradle"
    "CMakeLists.txt"
    "Makefile"
    "*.sln"
    "*.csproj"
)

# Scan locations
SCAN_DIRS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_gray()  { echo -e "${GRAY}  $1${NC}"; }

# Build list of directories to scan
build_scan_dirs() {
    # All real user home dirs
    while IFS=: read -r username _ uid _ _ home _; do
        if [[ "$uid" -ge 1000 || "$uid" -eq 0 ]] && [[ -d "$home" ]]; then
            SCAN_DIRS+=("$home")
        fi
    done < /etc/passwd

    # Common code locations
    local common_dirs=("/www" "/var/www" "/opt" "/srv")
    for dir in "${common_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            SCAN_DIRS+=("$dir")
        fi
    done

    # Mounted drives (top level only)
    if [[ -d "/mnt" ]]; then
        for mnt in /mnt/*/; do
            if [[ -d "$mnt" ]] && mountpoint -q "$mnt" 2>/dev/null; then
                SCAN_DIRS+=("$mnt")
            fi
        done
    fi
}

# Noise path patterns - tool caches, SDKs, extensions, not real user projects
is_noise_path() {
    local p="$1"
    case "$p" in
        */.npm/_npx/*)              return 0 ;;  # npm cache
        */.npm/_cacache/*)          return 0 ;;
        */.vscode-server/*)         return 0 ;;  # VS Code remote extensions
        */.vscode/extensions/*)     return 0 ;;
        */.claude/plugins/*)        return 0 ;;  # Claude marketplace plugins
        */.codex/*)                 return 0 ;;  # Codex temp
        */.local/flutter*)          return 0 ;;  # Flutter SDK
        */snap/flutter/*)           return 0 ;;  # Flutter SDK (snap)
        */.config/nvim*)            return 0 ;;  # Neovim config backups
        */.local/share/nvim/*)      return 0 ;;
        */.local/lib/*)             return 0 ;;  # pip/lib installs
        */.local/bin/*)             return 0 ;;
        */.cargo/registry/*)        return 0 ;;  # Cargo registry cache
        */.rustup/*)                return 0 ;;  # Rustup toolchains
        */.pyenv/*)                 return 0 ;;
        */.nvm/*)                   return 0 ;;  # nvm node versions
        */.sdkman/*)                return 0 ;;
        */_ubuntu_24/go/*)          return 0 ;;  # Go SDK install
        */go/pkg/mod/*)             return 0 ;;  # Go module cache
        */claude-code-*/*)          return 0 ;;  # Downloaded CLI tool
    esac
    # A bare home directory (e.g. /home/user) is not a project
    if [[ "$p" =~ ^/home/[^/]+$ ]] || [[ "$p" == "/root" ]]; then
        return 0
    fi
    # Path is only 1 component under .local (e.g. /home/user/.local) - not a project
    if [[ "$p" =~ ^/home/[^/]+/\.local$ ]]; then
        return 0
    fi
    return 1
}

# Find all project root directories
find_projects() {
    local all_projects=()

    for scan_dir in "${SCAN_DIRS[@]}"; do
        [[ -d "$scan_dir" ]] || continue

        # Find .git dirs (most reliable project indicator)
        while IFS= read -r gitdir; do
            local project_dir=$(dirname "$gitdir")
            all_projects+=("$project_dir")
        done < <(find "$scan_dir" -maxdepth 5 -type d -name ".git" \
            ! -path "*/node_modules/*" \
            ! -path "*/__pycache__/*" \
            ! -path "*/vendor/*" \
            ! -path "*/.cache/*" \
            ! -path "*/target/*" \
            ! -path "*/.npm/*" \
            ! -path "*/.vscode-server/*" \
            ! -path "*/.claude/plugins/*" \
            ! -path "*/snap/flutter/*" \
            ! -path "*/.local/flutter*" \
            ! -path "*/.cargo/*" \
            ! -path "*/.rustup/*" \
            ! -path "*/_ubuntu_24/go/*" \
            2>/dev/null)

        # Find standalone projects without .git (by indicator files)
        for indicator in "${PROJECT_INDICATORS[@]}"; do
            while IFS= read -r filepath; do
                local project_dir=$(dirname "$filepath")
                all_projects+=("$project_dir")
            done < <(find "$scan_dir" -maxdepth 4 -name "$indicator" -type f \
                ! -path "*/node_modules/*" \
                ! -path "*/__pycache__/*" \
                ! -path "*/vendor/*" \
                ! -path "*/.cache/*" \
                ! -path "*/target/*" \
                ! -path "*/.npm/*" \
                ! -path "*/.vscode-server/*" \
                ! -path "*/.claude/plugins/*" \
                ! -path "*/snap/flutter/*" \
                ! -path "*/.local/flutter*" \
                ! -path "*/.cargo/*" \
                ! -path "*/.rustup/*" \
                ! -path "*/_ubuntu_24/go/*" \
                2>/dev/null)
        done
    done

    # Deduplicate, remove noise paths, output sorted
    printf '%s\n' "${all_projects[@]}" | sort -u | while read -r dir; do
        is_noise_path "$dir" || echo "$dir"
    done
}

# Detect project type from indicator files
detect_project_type() {
    local dir="$1"
    local types=""

    [[ -f "$dir/package.json" ]]    && types="${types}Node "
    [[ -f "$dir/composer.json" ]]   && types="${types}PHP "
    [[ -f "$dir/requirements.txt" || -f "$dir/setup.py" || -f "$dir/pyproject.toml" ]] && types="${types}Python "
    [[ -f "$dir/Cargo.toml" ]]      && types="${types}Rust "
    [[ -f "$dir/go.mod" ]]          && types="${types}Go "
    [[ -f "$dir/pom.xml" || -f "$dir/build.gradle" ]] && types="${types}Java "
    [[ -f "$dir/CMakeLists.txt" ]]  && types="${types}C++ "
    [[ -f "$dir/Makefile" ]]        && types="${types}Make "
    ls "$dir"/*.sln "$dir"/*.csproj 2>/dev/null | grep -q . && types="${types}C# "
    [[ -d "$dir/.git" ]]            && types="${types}(git) "

    echo "${types:-Unknown }" | sed 's/ $//'
}

# Filter project list: keep only top-level roots (remove nested sub-projects)
filter_top_level_projects() {
    local projects=()
    while IFS= read -r line; do
        projects+=("$line")
    done

    local filtered=()
    for proj in "${projects[@]}"; do
        local is_child=false
        for other in "${projects[@]}"; do
            if [[ "$proj" != "$other" ]] && [[ "$proj" == "$other"/* ]]; then
                is_child=true
                break
            fi
        done
        if [[ "$is_child" = false ]]; then
            filtered+=("$proj")
        fi
    done

    printf '%s\n' "${filtered[@]}"
}

# Archive a single project
archive_project() {
    local project_dir="$1"
    local project_name=""
    local archive_name=""
    local archive_path=""
    local project_type=""
    local size_before=""

    # Build archive name from path: /home/alice/myproject -> home_alice_myproject
    project_name=$(echo "$project_dir" | sed 's|^/||; s|/|_|g')
    archive_name="${project_name}.tar.gz"
    archive_path="${BACKUP_DIR}/${archive_name}"
    project_type=$(detect_project_type "$project_dir")

    # Get approx source size (excluding deps)
    size_before=$(du -sh --exclude=node_modules --exclude=.git --exclude=vendor \
        --exclude=target --exclude=__pycache__ --exclude=.venv \
        "$project_dir" 2>/dev/null | awk '{print $1}')

    log_info "Archiving: $project_dir"
    log_gray "Type: $project_type | Source size: ${size_before:-?}"

    # Create archive
    if tar czf "$archive_path" "${TAR_EXCLUDES[@]}" -C "$(dirname "$project_dir")" "$(basename "$project_dir")" 2>/dev/null; then
        local archive_size=$(du -sh "$archive_path" 2>/dev/null | awk '{print $1}')
        log_ok "-> ${archive_name} (${archive_size})"
        echo "${project_dir}|${project_type}|${size_before:-?}|${archive_size}|${archive_name}" >> "$MANIFEST_FILE"
        ((TOTAL_PROJECTS++))
    else
        log_error "Failed to archive: $project_dir"
        echo "FAILED|${project_dir}" >> "$MANIFEST_FILE"
        ((FAILED_COUNT++))
    fi
}

# Main
main() {
    echo ""
    echo "============================================================"
    echo "  Backup All Projects"
    echo "  $(date)"
    echo "============================================================"
    echo ""

    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    MANIFEST_FILE="${BACKUP_DIR}/manifest.txt"
    LOG_FILE="${BACKUP_DIR}/backup.log"

    echo "# Project Backup Manifest - ${TIMESTAMP}" > "$MANIFEST_FILE"
    echo "# Format: path|type|source_size|archive_size|archive_name" >> "$MANIFEST_FILE"
    echo "" >> "$MANIFEST_FILE"

    log_info "Backup directory: $BACKUP_DIR"
    echo ""

    # Step 1: Build scan directories
    log_info "Step 1: Building scan directory list..."
    build_scan_dirs
    log_ok "Scanning ${#SCAN_DIRS[@]} directories:"
    for d in "${SCAN_DIRS[@]}"; do
        log_gray "$d"
    done
    echo ""

    # Step 2: Find all projects
    log_info "Step 2: Scanning for projects (this may take a moment)..."
    local project_list=""
    project_list=$(find_projects | filter_top_level_projects)
    local project_count=$(echo "$project_list" | grep -c .)

    log_ok "Found $project_count project(s)"
    echo ""

    # Step 3: Show preview
    log_info "Step 3: Project preview:"
    echo "$project_list" | while read -r proj; do
        local ptype=$(detect_project_type "$proj")
        log_gray "$proj  [$ptype]"
    done
    echo ""

    # Step 4: Confirm
    echo -e "${YELLOW}Archive $project_count project(s) to ${BACKUP_DIR}?${NC}"
    read -r -p "[y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy] ]]; then
        log_warn "Cancelled by user."
        rmdir "$BACKUP_DIR" 2>/dev/null
        exit 0
    fi
    echo ""

    # Step 5: Archive each project
    log_info "Step 4: Archiving projects..."
    echo ""
    echo "$project_list" | while read -r proj; do
        [[ -z "$proj" ]] && continue
        archive_project "$proj"
        echo ""
    done

    # Step 6: Summary
    local total_backup_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')
    echo ""
    echo "============================================================"
    echo "  Backup Complete"
    echo "============================================================"
    echo ""
    log_ok "Projects archived:  $TOTAL_PROJECTS"
    if [[ "$FAILED_COUNT" -gt 0 ]]; then
        log_error "Failed:            $FAILED_COUNT"
    fi
    log_ok "Total backup size: $total_backup_size"
    log_ok "Backup location:   $BACKUP_DIR"
    log_ok "Manifest:          $MANIFEST_FILE"
    echo ""
}

main
