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

# APT Repository Manager Library
# Provides comprehensive backup, restore, and management functions for APT repositories
# All function names end with `_from_apt_repository_manager` to identify the source file

# Variable declarations
APT_REPO_MANAGER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APT_SOURCES_DIR="/etc/apt"
APT_SOURCES_LIST="$APT_SOURCES_DIR/sources.list"
APT_SOURCES_LIST_D="$APT_SOURCES_DIR/sources.list.d"
APT_KEYRINGS_DIR="/usr/share/keyrings"
APT_TRUSTED_KEYS_DIR="/etc/apt/trusted.gpg.d"
# Backups live OUTSIDE the repo (under the shared data root) so a foreign distro's
# captured sources (e.g. an Ubuntu-noble snapshot) can never be committed and
# restored onto Debian/Kali. CORE_NODE_DATA_DIR is defined once in
# runtime_environment.sh; source it when a standalone caller has not loaded gvar.
if [ -z "${CORE_NODE_DATA_DIR:-}" ]; then
    source "$APT_REPO_MANAGER_DIR/runtime_environment.sh"
fi
APT_BACKUP_BASE_DIR="$CORE_NODE_DATA_DIR/apt_repository_backups"
APT_ORIGINAL_BACKUP_DIR="$APT_BACKUP_BASE_DIR/original"
# Shared native-sources templates + self-heal (single source of truth;
# also consumed by 3_setting_base.sh and frankenphp_static_prereq.sh).
# shellcheck source=/dev/null
source "${APT_REPO_MANAGER_DIR}/apt_sources_restore.sh"
APT_BACKUP_TIMESTAMP=""
APT_BACKUP_DIR=""

source "$APT_REPO_MANAGER_DIR/apt_repository_backup.sh"
source "$APT_REPO_MANAGER_DIR/apt_repository_catalog.sh"
source "$APT_REPO_MANAGER_DIR/apt_repository_repair.sh"
