#!/bin/bash

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

# Component libraries. Each source is guarded: a missing component (e.g. a file
# not yet committed/pulled, or a partial bootstrap download) must degrade to a
# warning instead of aborting the caller's `set -e` shell -- an unguarded source
# here once killed 3_setting_base.sh before the desktop power policy ran.
_apt_repo_component=""
for _apt_repo_component in apt_repository_backup.sh apt_repository_catalog.sh apt_repository_repair.sh; do
    if [ -f "$APT_REPO_MANAGER_DIR/$_apt_repo_component" ]; then
        source "$APT_REPO_MANAGER_DIR/$_apt_repo_component"
    else
        echo "[apt-repository-manager] WARNING: component missing, skipping: $_apt_repo_component" >&2
    fi
done
unset _apt_repo_component
