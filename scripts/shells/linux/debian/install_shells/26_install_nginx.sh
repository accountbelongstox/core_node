#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Nginx installation step (dd.sh chain). This script is the STEP-GRANULAR
# ORCHESTRATOR; every primitive it invokes lives in the shared management
# architecture (scripts/shells/linux/common/nginx_manager.sh, built on
# nginx_common.sh + domain_setup_common.sh). No implementation is duplicated
# here - each step_run wraps exactly one manager primitive so every sub-step
# (repo, package, layout, main config, default vhost, symlinks, bin link,
# site repair, HTTP/3 migration, service, state, verify) is independently
# idempotent and re-runnable.
#
# SYNC CONTRACT: vhost/TLS templates and repair semantics are shared with the
# Laravel end (ServerManagerV1NginxManagerCtl + ServerManagerV1NginxConfigBuilder);
# see the contract block in common/nginx_manager.sh. Change both ends together.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="26"
NGINX_STEP_NAMESPACE="26_install_nginx"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/step_state.sh"
# shellcheck source=/dev/null
source "$PARENT_DIR_LEVEL_2/common/apache_block_guard.sh"
# shellcheck source=/dev/null
source "$PARENT_DIR_LEVEL_2/common/nginx_manager.sh"

START_NGINX=$(get_global_var "START_NGINX" "false")

echo "[$SCRIPT_INDEX] Nginx Installation Script (official mainline, HTTP/3 ready)"
echo "[$SCRIPT_INDEX] START_NGINX: $START_NGINX"
echo "[$SCRIPT_INDEX] NGINX INSTALLATION (idempotent, step-granular)"

# STEP 1: conflicting web servers
# Trust-based flow: no exit-code chaining; every later step self-detects its
# own prerequisites (binary existence, config test) and no-ops when unmet.
step_run "$NGINX_STEP_NAMESPACE" "conflicts-cleared" "v2-caddy-apache" nm_conflicts_clear

# STEP 2: official nginx.org mainline repository
step_run "$NGINX_STEP_NAMESPACE" "official-repo" "mainline-v1" nginx_ensure_official_repo || {
    echo "[$SCRIPT_INDEX] [WARN] Official repository setup failed; falling back to distro package"
}

# STEP 3: legacy installation replacement (interactive, configs preserved)
nginx_replace_legacy_install "false"

# STEP 3b: purge distro variant packages that conflict with the official
# package (per-package idempotent; a kept legacy install is never broken)
nm_purge_legacy_packages

# STEP 3c: replace every foreign nginx install on the system (quarantines
# non-active foreign prefixes; our marked source build is kept)
nm_replace_foreign_nginx

# STEP 4: install/upgrade nginx package from the mainline repository
# (self-idempotent: compares the installed version with the apt candidate on
# every run, upgrades in place when the candidate is newer, sites preserved)
nm_install_or_upgrade
if [ -z "$(nginx_get_binary)" ]; then
    echo "[$SCRIPT_INDEX] [WARN] No nginx binary after the install step; later steps self-detect and no-op"
fi

# STEP 5: optional source build for full QUIC 0-RTT early data
nginx_offer_source_build "false"

# STEP 6: directory layout
step_run "$NGINX_STEP_NAMESPACE" "directory-layout" "v2" nm_layout_ensure

# STEP 7: canonical nginx.conf (content-hash idempotent)
nm_main_config

# STEP 8: default vhost (content-hash idempotent)
nm_default_vhost

# STEP 9: default landing page (content-hash idempotent)
nm_default_page

# STEP 10: config view symlinks into mapped nginxconfig
step_run "$NGINX_STEP_NAMESPACE" "config-symlinks" "v2" nm_symlinks_ensure

# STEP 11: unify all nginx binaries/symlinks to one canonical install
nginx_binary_for_step=$(nginx_get_binary)
if [ -n "$nginx_binary_for_step" ]; then
    step_run "$NGINX_STEP_NAMESPACE" "bin-unify" "$nginx_binary_for_step" nginx_unify_binaries
else
    echo "[$SCRIPT_INDEX] [WARN] No nginx binary for unify step"
fi

# STEP 11b: fine-grained site repair (dangling links, broken managed sites);
# always runs - it is self-checking and no-ops on a healthy tree.
nginx_repair_sites || {
    echo "[$SCRIPT_INDEX] [WARN] Site repair reported issues (see above)"
}

# STEP 11c: migrate existing HTTPS sites to the canonical HTTP/3 stanza
# (legacy inline-http2 -> http2 on + QUIC listeners + Alt-Svc + early data);
# per-file idempotent, sites and certificates are preserved.
nm_http3_migrate || {
    echo "[$SCRIPT_INDEX] [WARN] HTTP/3 migration reported issues (see above)"
}

# STEP 12: configuration test (informational; the service step self-gates on
# nginx -t, so a broken config never blocks later independent steps)
if ! $USE_SUDO nginx -t; then
    echo "[$SCRIPT_INDEX] [WARN] nginx -t failed after configuration; the service step will skip starting"
fi

# STEP 13: service enable/start per START_NGINX
service_wanted="stop"
[ "$START_NGINX" = "true" ] && service_wanted="start"
step_run "$NGINX_STEP_NAMESPACE" "service-state" "$service_wanted" nm_service_state "$service_wanted" || {
    echo "[$SCRIPT_INDEX] [WARN] Service step reported failure"
}

# STEP 13b: re-unify after service start (guards against package/service races)
nginx_binary_post_service=$(nginx_get_binary)
if [ -n "$nginx_binary_post_service" ]; then
    step_run "$NGINX_STEP_NAMESPACE" "bin-unify-post-service" "$nginx_binary_post_service" nginx_unify_binaries
fi

# STEP 14: persist state for downstream consumers (Laravel ServerManager)
nm_store_info

# STEP 15: verification (informational; the summary below reports the state)
nm_verify || {
    echo "[$SCRIPT_INDEX] [WARN] Verification reported issues; check /var/log/nginx/error.log and journalctl -xeu nginx"
}

echo "[$SCRIPT_INDEX] =============================================="
echo "[$SCRIPT_INDEX] NGINX READY: $(nginx_get_version) (HTTP/3: $(nginx_has_http3 && echo yes || echo no), QUIC 0-RTT: $(nginx_quic_early_data_supported && echo yes || echo no))"
echo "[$SCRIPT_INDEX] Sites: $(nginx_get_sites_enabled) | Root: $(nm_www_root)"
echo "[$SCRIPT_INDEX] Management CLI: $PARENT_DIR_LEVEL_2/common/nginx_manager.sh"
echo "[$SCRIPT_INDEX] =============================================="
