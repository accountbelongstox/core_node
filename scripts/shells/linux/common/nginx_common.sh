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

# Shared nginx install/manage library. Single source of truth for:
# - official nginx.org mainline repository setup (nginx > 1.30, HTTP/3 ready)
# - version / vendor / OpenSSL capability probing
# - legacy installation replacement with config preservation
# - optional source build against OpenSSL >= 3.5.1 (full QUIC 0-RTT)
# - modern TLS/HTTP3 vhost stanza rendering (used by installer AND manager)
# Requires: gvar_common.sh (GLOBAL_VAR_DIR, USE_SUDO, IS_WSL) already sourced.

NGINX_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$NGINX_COMMON_DIR/apt_repository_manager.sh"
# Shared idempotent-replace writer + canonical lazy sudo (single source of
# truth, shared with domain_setup_common.sh / cert_selfheal_common.sh /
# common_functions.sh). Side-effect free; safe in any load order.
# shellcheck source=/dev/null
source "$NGINX_COMMON_DIR/file_ops_common.sh"
# Shared edge-port guard (80/TCP, 443/TCP, 443/UDP occupier stop + y/N
# uninstall); the reload verification and restart pre-flight below build on it.
# shellcheck source=/dev/null
source "$NGINX_COMMON_DIR/port_guard_common.sh"

NGINX_COMMON_NAMESPACE="nginx"
NGINX_MINIMUM_VERSION="1.30.0"
NGINX_MAINLINE_VERSION="1.31.3"
NGINX_OPENSSL_QUIC_VERSION="3.5.1"
NGINX_SIGNING_KEY_URL="https://nginx.org/keys/nginx_signing.key"
NGINX_SIGNING_KEY_FINGERPRINT="573BFD6B3D8FBC641079A6ABABF5BD827BD9BF62"
NGINX_KEYRING_FILE="/usr/share/keyrings/nginx-archive-keyring.gpg"
NGINX_SOURCE_BASE="/usr/local/src/nginx-build"
NGINX_SOURCE_PREFIX="/usr/local/nginx"
NGINX_SOURCE_CONF_PATH="/etc/nginx/nginx.conf"
NGINX_KNOWN_ALIAS_PATHS=(
    "/usr/local/bin/nginx"
    "/usr/sbin/nginx"
    "/usr/bin/nginx"
    "/usr/local/sbin/nginx"
)

# Canonical filesystem constants - the single shell-side source, shared by
# nginx_manager.sh / domain_setup_common.sh / cert_selfheal_common.sh /
# 33_install_nginx.sh / 35_install_certbot.sh / 175_laravel_main_start.sh.
# The Laravel end mirrors the same paths through PathMapper::mapWebPath()
# (ServerManagerV1PathConfig) - the cross-language SYNC CONTRACT. Paths are
# identical on Ubuntu / Debian / Kali.
NGINX_MAIN_CONF="${NGINX_MAIN_CONF:-/etc/nginx/nginx.conf}"
NGINX_LOG_DIR="${NGINX_LOG_DIR:-/var/log/nginx}"
NGINX_CONF_D="${NGINX_CONF_D:-/etc/nginx/conf.d}"
NGINX_LEGACY_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_LEGACY_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_SYSTEMD_UNIT_FILE="/etc/systemd/system/nginx.service"
CERTBOT_BIN_LINK="/usr/local/bin/certbot"
CERTBOT_DEFAULT_CONFIG_DIR="/etc/letsencrypt"
NGINX_INSTALL_COMMON_SCRIPT="$NGINX_COMMON_DIR/nginx_install_common.sh"
NGINX_VHOST_COMMON_SCRIPT="$NGINX_COMMON_DIR/nginx_vhost_common.sh"

source "$NGINX_INSTALL_COMMON_SCRIPT"
source "$NGINX_VHOST_COMMON_SCRIPT"


# Resolve the sites-available directory: map_web_path when gvar_common is
# loaded, else the value 33_install_nginx.sh persisted, else the default.
nginx_get_sites_available() {
    if declare -F map_web_path >/dev/null 2>&1; then
        map_web_path "nginxconfig" "sites-available"
        return 0
    fi
    local stored=""
    local gdir="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
    [ -f "$gdir/NGINX_SITES_AVAILABLE" ] && stored=$($USE_SUDO cat "$gdir/NGINX_SITES_AVAILABLE" 2>/dev/null | tr -d '[:space:]')
    echo "${stored:-/etc/nginx/sites-available}"
}

# Resolve the sites-enabled directory (same resolution order as above).
nginx_get_sites_enabled() {
    if declare -F map_web_path >/dev/null 2>&1; then
        map_web_path "nginxconfig" "sites-enabled"
        return 0
    fi
    local stored=""
    local gdir="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
    [ -f "$gdir/NGINX_SITES_ENABLED" ] && stored=$($USE_SUDO cat "$gdir/NGINX_SITES_ENABLED" 2>/dev/null | tr -d '[:space:]')
    echo "${stored:-/etc/nginx/sites-enabled}"
}

# Ensure a directory path exists as a REAL, traversable directory. Shared by
# every nginx site/layout step (fine-grained idempotent; safe to re-run).
# Repairs the two conflict shapes that defeat a bare `mkdir -p`:
#   - a regular file at the path   (mkdir -p reports "File exists")
#   - a DANGLING symlink           ([ -e ] false, [ -d ] false, mkdir -p
#     reports "File exists", writes through it fail ENOENT)
# A symlink that already resolves to a directory is kept (writes flow through
# to its target). The repair commands are trusted to run; the outcome is then
# verified by direct filesystem detection and published in
# NGINX_ENSURE_DIR_READY ("yes"/"no") - never inferred from an exit code.
# Usage: nginx_ensure_directory <path>; then read NGINX_ENSURE_DIR_READY.
NGINX_ENSURE_DIR_READY="no"
nginx_ensure_directory() {
    local dir="$1"
    local sudo_cmd=""

    # Canonical lazy sudo (file_ops_common.sh, sourced at the top of this
    # library; honors a pre-set USE_SUDO from gvar_common.sh).
    sudo_cmd=$(lazy_sudo)

    if [ ! -d "$dir" ]; then
        if [ -e "$dir" ] || [ -L "$dir" ]; then
            echo "[nginx] Removing conflicting non-directory path: $dir"
            $sudo_cmd rm -f "$dir"
        fi
        $sudo_cmd mkdir -p "$dir" 2>/dev/null || true
    fi

    if [ -d "$dir" ]; then
        NGINX_ENSURE_DIR_READY="yes"
    else
        NGINX_ENSURE_DIR_READY="no"
        echo "[nginx] [FAIL] Directory could not be ensured: $dir"
    fi
}

# Quarantine stale duplicate server_name configs. nginx loads the FIRST
# server block for a name and merely warns "conflicting server name ...
# ignored" for the rest, so a bootstrap-era file anywhere in the include
# path silently masks the canonical managed vhost. Canonical names are the
# server_name values of the managed files in the mapped sites-available;
# duplicates found in OTHER include dirs (conf.d, /etc/nginx/sites-*,
# provided they do not resolve into the mapped tree) are moved to the
# quarantine dir. Fine-grained idempotent: nothing moves when no duplicate
# exists.
nginx_quarantine_duplicate_server_names() {
    local sites_available="$1"
    local sites_enabled="$2"
    local quarantine_dir
    local canonical_names=""
    local file=""
    local dir=""
    local name=""
    local file_names=""
    local sudo_cmd

    sudo_cmd=$(lazy_sudo)
    quarantine_dir="$(dirname "$sites_available")/quarantined"

    for file in "$sites_available"/*; do
        [ -f "$file" ] || continue
        grep -q "$NGINX_MANAGED_SITE_MARKER" "$file" 2>/dev/null || continue
        file_names=$(grep -oE '^[[:space:]]*server_name[[:space:]]+[^;]+;' "$file" 2>/dev/null \
            | sed -E 's/^[[:space:]]*server_name[[:space:]]+//; s/;//' \
            | tr ' ' '\n' | grep -vE '^$|^_$' || true)
        for name in $file_names; do
            case " $canonical_names " in *" $name "*) ;; *) canonical_names="$canonical_names $name" ;; esac
        done
    done
    [ -z "$canonical_names" ] && return 0

    for dir in /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d; do
        [ -d "$dir" ] || continue
        [ "$(readlink -f "$dir" 2>/dev/null)" = "$(readlink -f "$sites_available")" ] && continue
        [ "$(readlink -f "$dir" 2>/dev/null)" = "$(readlink -f "$sites_enabled")" ] && continue
        for file in "$dir"/*; do
            { [ -f "$file" ] || [ -L "$file" ]; } || continue
            file_names=$(grep -oE '^[[:space:]]*server_name[[:space:]]+[^;]+;' "$file" 2>/dev/null \
                | sed -E 's/^[[:space:]]*server_name[[:space:]]+//; s/;//' \
                | tr ' ' '\n' | grep -vE '^$|^_$' || true)
            for name in $file_names; do
                case " $canonical_names " in
                    *" $name "*)
                        echo "[nginx] Quarantining stale duplicate of $name: $file"
                        $sudo_cmd mkdir -p "$quarantine_dir"
                        if [ -L "$file" ]; then
                            $sudo_cmd rm -f "$file"
                        else
                            $sudo_cmd mv "$file" "$quarantine_dir/$(basename "$file").$(date +%Y%m%d%H%M%S).dup"
                        fi
                        break
                        ;;
                esac
            done
        done
    done
    return 0
}

# Verify the :80/:443 listeners belong to the systemd-managed nginx master.
# A foreign nginx master (source build / manual start, e.g. an old duplicate
# install) keeps serving the OLD config no matter how often the unit is
# reloaded. Foreign masters are stopped and the unit restarted - this is the
# nginx twin of the stale-certbot detection. Result is re-verified from the
# process table after the stop.
nginx_single_instance_ensure() {
    local sudo_cmd
    local unit_main_pid=""
    local pid=""
    local ppid=""
    local foreign=""
    local remaining=""

    sudo_cmd=$(lazy_sudo)
    command -v systemctl >/dev/null 2>&1 || return 0
    systemctl is-active --quiet nginx 2>/dev/null || return 0
    command -v pgrep >/dev/null 2>&1 || return 0

    unit_main_pid=$(systemctl show -p MainPID --value nginx 2>/dev/null)
    if [ -z "$unit_main_pid" ] || [ "$unit_main_pid" = "0" ]; then
        return 0
    fi

    for pid in $(pgrep -x nginx 2>/dev/null); do
        ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        # A master has PPID 1; any master that is not the unit's MainPID is foreign.
        if [ "$ppid" = "1" ] && [ "$pid" != "$unit_main_pid" ]; then
            foreign="$foreign $pid"
        fi
    done

    for pid in $foreign; do
        echo "[nginx] Stopping foreign nginx master PID $pid (systemd unit master is $unit_main_pid); it was serving stale config"
        $sudo_cmd kill "$pid" 2>/dev/null || true
    done

    if [ -n "$foreign" ]; then
        sleep 2
        $sudo_cmd systemctl restart nginx 2>/dev/null || true
        remaining=$(pgrep -x nginx 2>/dev/null | while read -r pid; do
            ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
            if [ "$ppid" = "1" ] && [ "$pid" != "$unit_main_pid" ]; then
                echo "$pid"
            fi
        done)
        if [ -n "$remaining" ]; then
            echo "[nginx] [WARN] foreign nginx master(s) still present: $remaining"
        else
            echo "[nginx] [OK] single systemd-managed nginx instance serving"
        fi
    fi
    return 0
}

# Compile-time default config path of a binary (its -V --conf-path). Debian /
# Ubuntu package builds do not print one and default to /etc/nginx/nginx.conf.
nginx_binary_default_conf() {
    local binary="$1"
    local conf_path=""
    conf_path=$("$binary" -V 2>&1 | tr ' ' '\n' | grep -m1 '^--conf-path=' | cut -d= -f2)
    if [ -n "$conf_path" ]; then
        echo "$conf_path"
    else
        echo "/etc/nginx/nginx.conf"
    fi
}

# Effective config path of a running master process: an explicit -c in its
# cmdline wins over the binary's compile-time default.
nginx_master_effective_conf() {
    local pid="$1"
    local exe=""
    local cmdline=""
    exe=$(readlink "/proc/$pid/exe" 2>/dev/null || true)
    exe="${exe% (deleted)}"
    [ -n "$exe" ] || return 1
    cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
    if echo "$cmdline" | grep -qE '(^|[[:space:]])-c[[:space:]]'; then
        echo "$cmdline" | sed -E 's/.*(^|[[:space:]])-c[[:space:]]+([^[:space:]]+).*/\2/'
        return 0
    fi
    nginx_binary_default_conf "$exe"
}

# Compute the edge listeners the rendered configuration DECLARES: tcp:80
# always (the default vhost), tcp:443 when any enabled site carries an ssl
# listener, udp:443 when any enabled site carries a quic listener (HTTP/3).
# Publishes NGINX_EXPECTED_LISTENERS as a space-separated "proto:port" list.
NGINX_EXPECTED_LISTENERS="tcp:80"
nginx_expected_listeners_compute() {
    local sites_enabled
    local entry
    local target
    local has_tls="no"
    local has_quic="no"

    sites_enabled=$(nginx_get_sites_enabled)
    for entry in "$sites_enabled"/*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        target=$(readlink -f "$entry" 2>/dev/null || echo "$entry")
        [ -f "$target" ] || continue
        if grep -qE '^[[:space:]]*listen[[:space:]]+(\[::\]:)?443[[:space:]][^;]*\bssl\b' "$target" 2>/dev/null; then
            has_tls="yes"
        fi
        if grep -qE '^[[:space:]]*listen[[:space:]]+(\[::\]:)?443[[:space:]][^;]*\bquic\b' "$target" 2>/dev/null; then
            has_quic="yes"
        fi
    done

    NGINX_EXPECTED_LISTENERS="tcp:80"
    [ "$has_tls" = "yes" ] && NGINX_EXPECTED_LISTENERS="$NGINX_EXPECTED_LISTENERS tcp:443"
    [ "$has_quic" = "yes" ] && NGINX_EXPECTED_LISTENERS="$NGINX_EXPECTED_LISTENERS udp:443"
    return 0
}

# Audit the declared listeners against the LIVE socket table: every declared
# socket must be bound by nginx itself. This is the truth a reload assertion
# can never provide - a master whose reload aborted on a failed bind shows up
# here as "nothing bound" or "held by <foreign>". Publishes
# NGINX_LISTENERS_OK=yes|no.
NGINX_LISTENERS_OK="yes"
nginx_listeners_audit() {
    local sudo_cmd
    local item
    local proto
    local port
    local opt
    local owner
    sudo_cmd=$(lazy_sudo)

    NGINX_LISTENERS_OK="yes"
    command -v ss >/dev/null 2>&1 || return 0

    for item in $NGINX_EXPECTED_LISTENERS; do
        proto="${item%%:*}"
        port="${item##*:}"
        opt="-lntHp"
        [ "$proto" = "udp" ] && opt="-lnuHp"
        owner=$($sudo_cmd ss "$opt" 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -oE '"[^"]+"' | head -1 | tr -d '"')
        if [ "$owner" = "nginx" ]; then
            echo "[nginx]   listener $proto/$port: [OK] bound by nginx"
        else
            NGINX_LISTENERS_OK="no"
            if [ -n "$owner" ]; then
                echo "[nginx]   listener $proto/$port: [FAIL] held by foreign process: $owner"
            else
                echo "[nginx]   listener $proto/$port: [FAIL] declared in config but nothing is bound"
            fi
        fi
    done
    return 0
}

# Restart pre-flight: every declared listen socket must be bindable before a
# restart, otherwise the new master aborts on the bind failure and "stale but
# serving" becomes "down". Foreign occupiers are cleared through the shared
# port guard (stop + y/N uninstall offer); the outcome is re-detected from
# the live socket table. Publishes NGINX_BIND_PREFLIGHT_OK=yes|no.
NGINX_BIND_PREFLIGHT_OK="yes"
nginx_bind_preflight() {
    NGINX_BIND_PREFLIGHT_OK="yes"
    pg_holders_detect 80 443
    if [ -n "$PG_HOLDERS" ]; then
        echo "[nginx] [WARN] foreign occupiers on the nginx edge ports; clearing them before the restart"
        pg_ports_ensure_free 80 443
    fi
    pg_holders_detect 80 443
    if [ -n "$PG_HOLDERS" ]; then
        NGINX_BIND_PREFLIGHT_OK="no"
        echo "[nginx] [FAIL] bind pre-flight: edge ports still occupied; a restart would abort the master"
    fi
    return 0
}

# Fine-grained conformance step: the RUNNING systemd master must exec the
# canonical binary AND serve $NGINX_MAIN_CONF AND bound the listeners the
# rendered config declares. A master started from a foreign build (or before
# a binary switch) keeps serving its own compile-time config across any
# number of reloads; a master whose reloads keep aborting (e.g. a foreign
# process holding UDP/443) serves a STALE in-memory world with the correct
# exe and conf-path - the listener audit catches what exe/conf cannot. Only a
# fresh exec heals either divergence, so both end in a gated restart (nginx
# -t + bind pre-flight first). Self-detecting: no-op when fully conformant.
nginx_master_conformance_ensure() {
    local sudo_cmd
    local canonical=""
    local unit_main_pid=""
    local master_exe=""
    local master_conf=""
    local divergent="no"
    sudo_cmd=$(lazy_sudo)

    command -v systemctl >/dev/null 2>&1 || return 0
    systemctl is-active --quiet nginx 2>/dev/null || return 0

    canonical=$(nginx_get_binary)
    [ -n "$canonical" ] || return 0
    canonical=$(readlink -f "$canonical" 2>/dev/null || echo "$canonical")

    unit_main_pid=$(systemctl show -p MainPID --value nginx 2>/dev/null)
    if [ -z "$unit_main_pid" ] || [ "$unit_main_pid" = "0" ]; then
        return 0
    fi

    master_exe=$(readlink "/proc/$unit_main_pid/exe" 2>/dev/null || true)
    master_exe="${master_exe% (deleted)}"
    master_conf=$(nginx_master_effective_conf "$unit_main_pid")

    if [ "$master_exe" != "$canonical" ] || [ "$master_conf" != "$NGINX_MAIN_CONF" ]; then
        divergent="yes"
        echo "[nginx] [WARN] running master diverges: exe=$master_exe conf=${master_conf:-unknown}"
        echo "[nginx]         canonical: exe=$canonical conf=$NGINX_MAIN_CONF"
    fi

    # Third conformance dimension (staleness): the live listeners must match
    # the rendered configuration even when exe and conf-path are correct.
    if [ "$divergent" = "no" ]; then
        nginx_expected_listeners_compute
        nginx_listeners_audit
        if [ "$NGINX_LISTENERS_OK" = "yes" ]; then
            return 0
        fi
        divergent="yes"
        echo "[nginx] [WARN] master serves a stale in-memory world: live listeners diverge from the rendered config"
    fi

    if ! $sudo_cmd nginx -t -c "$NGINX_MAIN_CONF" >/dev/null 2>&1; then
        echo "[nginx] [WARN] config test failed; master restart skipped (repair config first)"
        return 1
    fi

    # Restart pre-flight: a restart under a port conflict converts "stale but
    # serving" into "down", so every edge socket must be bindable first.
    nginx_bind_preflight
    if [ "$NGINX_BIND_PREFLIGHT_OK" != "yes" ]; then
        echo "[nginx] [WARN] bind pre-flight failed; master restart skipped (would take nginx down)"
        return 1
    fi

    echo "[nginx] Restarting nginx so the master execs the canonical binary, config and listeners"
    $sudo_cmd systemctl restart nginx || return 1

    nginx_expected_listeners_compute
    nginx_listeners_audit
    if [ "$NGINX_LISTENERS_OK" = "yes" ]; then
        echo "[nginx] [OK] nginx master restarted onto $NGINX_MAIN_CONF; listeners verified"
        return 0
    fi
    echo "[nginx] [FAIL] listeners still divergent after the restart"
    return 1
}

# Print the serve-truth report (read-only diagnostic): which binary SHOULD
# serve vs which master process ACTUALLY serves and with which config. The
# divergence between the two is the classic "site file updated on disk but
# the served config never changed" case (foreign master, or a main config
# without the mapped sites-enabled include).
nginx_serve_truth_report() {
    local binary
    local sites_available
    local sites_enabled
    local unit_main_pid=""
    local master_exe=""
    local master_cmd=""
    local pid=""
    local ppid=""
    local available_count=0
    local enabled_count=0

    binary=$(nginx_get_binary)
    sites_available=$(nginx_get_sites_available)
    sites_enabled=$(nginx_get_sites_enabled)

    echo "[nginx] serve-truth:"
    echo "[nginx]   canonical binary: ${binary:-none} (version $(nginx_get_version))"
    echo "[nginx]   main config: $NGINX_MAIN_CONF"
    echo "[nginx]   sites dirs: available=$sites_available enabled=$sites_enabled"

    if [ -f "$NGINX_MAIN_CONF" ]; then
        if grep -q "include ${sites_enabled}/\*" "$NGINX_MAIN_CONF" 2>/dev/null || \
           grep -qE "include[[:space:]]+${sites_enabled}/\*" "$NGINX_MAIN_CONF" 2>/dev/null; then
            echo "[nginx]   main config includes mapped sites-enabled: yes"
        else
            echo "[nginx]   main config includes mapped sites-enabled: NO (managed sites will NOT load)"
        fi
    else
        echo "[nginx]   main config missing: $NGINX_MAIN_CONF"
    fi

    available_count=$(find "$sites_available" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
    enabled_count=$(find "$sites_enabled" -maxdepth 1 \( -type f -o -type l \) 2>/dev/null | wc -l | tr -d ' ')
    echo "[nginx]   site files: $available_count available, $enabled_count enabled"

    # Content class per enabled site (proxy vhost vs stale bootstrap stub) -
    # this is the truth that decides what a request actually gets.
    local site=""
    local site_target=""
    local site_class=""
    for site in "$sites_enabled"/*; do
        [ -e "$site" ] || [ -L "$site" ] || continue
        site_target=$(readlink -f "$site" 2>/dev/null || true)
        if [ -z "$site_target" ] || [ ! -f "$site_target" ]; then
            echo "[nginx]   site $(basename "$site"): DANGLING LINK"
            continue
        fi
        site_class=$(grep -m1 -oE 'proxy_pass http://[^;]+' "$site_target" 2>/dev/null || true)
        if [ -n "$site_class" ]; then
            echo "[nginx]   site $(basename "$site"): proxy ($site_class), quic=$(grep -c 'listen 443 quic' "$site_target" 2>/dev/null)"
        elif [ "$(basename "$site")" = "default" ]; then
            echo "[nginx]   site default: static catch-all (intentional: unmatched hosts + ACME webroot)"
        else
            echo "[nginx]   site $(basename "$site"): NON-PROXY content (stale bootstrap or static) -> needs re-render"
        fi
    done

    if command -v systemctl >/dev/null 2>&1; then
        unit_main_pid=$(systemctl show -p MainPID --value nginx 2>/dev/null)
    fi
    if [ -n "$unit_main_pid" ] && [ "$unit_main_pid" != "0" ]; then
        master_exe=$(readlink -f "/proc/$unit_main_pid/exe" 2>/dev/null || echo "?")
        master_cmd=$(tr '\0' ' ' < "/proc/$unit_main_pid/cmdline" 2>/dev/null || echo "?")
        echo "[nginx]   running master: pid=$unit_main_pid exe=$master_exe"
        echo "[nginx]   master cmdline: $master_cmd"
        local master_conf=""
        master_conf=$(nginx_master_effective_conf "$unit_main_pid" 2>/dev/null || true)
        echo "[nginx]   master effective conf: ${master_conf:-unknown}"
        if [ -n "$master_conf" ] && [ "$master_conf" != "$NGINX_MAIN_CONF" ]; then
            echo "[nginx]   [FAIL] master does NOT serve the managed main conf ($NGINX_MAIN_CONF); site writes never reach it"
        fi
    else
        echo "[nginx]   running master: none via systemd"
    fi

    if command -v pgrep >/dev/null 2>&1; then
        for pid in $(pgrep -x nginx 2>/dev/null); do
            ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
            if [ "$ppid" = "1" ] && [ "$pid" != "$unit_main_pid" ]; then
                echo "[nginx]   FOREIGN master detected: pid=$pid ($(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null))"
            fi
        done
    fi

    # Declared-vs-live listener audit (the stale-master truth: a master with
    # aborted reloads shows up here as unbound or foreign-held sockets).
    if systemctl is-active --quiet nginx 2>/dev/null; then
        nginx_expected_listeners_compute
        nginx_listeners_audit
    fi
    return 0
}

# Fine-grained, idempotent site repair. Each sub-check is independent:
# 1. prune dangling symlinks in sites-enabled
# 2. prune symlinks whose target is outside sites-available
# 3. run nginx -t; on failure quarantine the offending managed site and retry
# 4. reload the service only when the final config test passes
# Usage: nginx_repair_sites
nginx_repair_sites() {
    local sites_available
    local sites_enabled
    local entry
    local target
    local test_output
    local bad_file
    local quarantine_dir
    local attempt
    local log_mark=0
    local new_emerg=""
    local emerg_line=""

    sites_available=$(nginx_get_sites_available)
    sites_enabled=$(nginx_get_sites_enabled)
    quarantine_dir="$(dirname "$sites_available")/quarantined"

    # Prerequisite sub-step, independent of the sweeps below: the site
    # directories must be real, traversable directories (symlink-aware ensure;
    # repairs dangling symlinks / file conflicts left by older layouts).
    nginx_ensure_directory "$sites_available"
    local available_ready="$NGINX_ENSURE_DIR_READY"
    nginx_ensure_directory "$sites_enabled"
    if [ "$available_ready" != "yes" ] || [ "$NGINX_ENSURE_DIR_READY" != "yes" ]; then
        echo "[nginx] [FAIL] sites directories unusable; repair cannot run"
        return 1
    fi

    for entry in "$sites_enabled"/*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        if [ -L "$entry" ]; then
            target=$(readlink -f "$entry" 2>/dev/null || true)
            if [ -z "$target" ] || [ ! -e "$target" ]; then
                echo "[nginx] Removing dangling site link: $entry"
                $USE_SUDO rm -f "$entry"
                continue
            fi
            case "$target" in
                "$sites_available"/*) ;;
                *)
                    echo "[nginx] Removing foreign site link: $entry -> $target"
                    $USE_SUDO rm -f "$entry"
                    ;;
            esac
        fi
    done

    # Stale duplicate server_name configs mask the canonical managed vhost
    # (nginx keeps the first-loaded block and only warns); quarantine them.
    nginx_quarantine_duplicate_server_names "$sites_available" "$sites_enabled"

    for attempt in 1 2 3 4 5; do
        test_output=$($USE_SUDO nginx -t -c "$NGINX_MAIN_CONF" 2>&1) && break
        bad_file=$(echo "$test_output" | grep -oE "$sites_available/[^ :]+" | head -1)
        if [ -z "$bad_file" ] || [ ! -f "$bad_file" ]; then
            echo "[nginx] [FAIL] nginx -t failed and no site file could be identified:"
            echo "$test_output"
            return 1
        fi
        if ! grep -q "$NGINX_MANAGED_SITE_MARKER" "$bad_file" 2>/dev/null; then
            echo "[nginx] [FAIL] nginx -t failed on unmanaged site $bad_file; manual fix required:"
            echo "$test_output"
            return 1
        fi
        echo "[nginx] Quarantining broken managed site: $bad_file"
        $USE_SUDO mkdir -p "$quarantine_dir"
        $USE_SUDO mv "$bad_file" "$quarantine_dir/$(basename "$bad_file").$(date +%Y%m%d%H%M%S).broken"
        $USE_SUDO rm -f "$sites_enabled/$(basename "$bad_file")"
    done

    if ! $USE_SUDO nginx -t -c "$NGINX_MAIN_CONF" >/dev/null 2>&1; then
        echo "[nginx] [FAIL] configuration still invalid after repair attempts"
        return 1
    fi

    # The reload only helps when the listeners ARE the systemd unit's nginx;
    # a foreign master would keep serving the old config regardless.
    nginx_single_instance_ensure

    # The unit's master itself must exec the canonical binary and serve
    # $NGINX_MAIN_CONF; a divergent master ignores reloads (they re-read its
    # own compile-time config), so this heals via a gated restart.
    nginx_master_conformance_ensure || true

    if systemctl is-active --quiet nginx 2>/dev/null; then
        [ -f "$NGINX_LOG_DIR/error.log" ] && log_mark=$(wc -l < "$NGINX_LOG_DIR/error.log" 2>/dev/null | tr -d ' ')
        [ -z "$log_mark" ] && log_mark=0
        $USE_SUDO systemctl reload nginx 2>/dev/null || true
        sleep 1

        # Verify, never assert: a reload aborted by a failed bind leaves the
        # master serving its stale in-memory world. Detect it via fresh
        # [emerg] log lines AND the declared-vs-live listener audit.
        if [ -f "$NGINX_LOG_DIR/error.log" ]; then
            new_emerg=$(tail -n +$((log_mark + 1)) "$NGINX_LOG_DIR/error.log" 2>/dev/null | grep '\[emerg\]' || true)
        fi
        nginx_expected_listeners_compute
        nginx_listeners_audit

        if [ "$NGINX_LISTENERS_OK" = "yes" ] && [ -z "$new_emerg" ]; then
            echo "[nginx] [OK] Configuration valid; service reloaded and listeners verified"
        else
            echo "[nginx] [FAIL] reload did NOT take effect; the master keeps serving its stale in-memory config"
            if [ -n "$new_emerg" ]; then
                printf '%s\n' "$new_emerg" | while IFS= read -r emerg_line; do
                    echo "[nginx]   $emerg_line"
                done
            fi
            # A reload can never heal an aborted-bind world; only a fresh exec
            # can. The restart is gated on the bind pre-flight so a port
            # conflict is cleared first instead of causing downtime.
            nginx_bind_preflight
            if [ "$NGINX_BIND_PREFLIGHT_OK" != "yes" ]; then
                echo "[nginx] [FAIL] bind pre-flight failed; restart skipped (would take nginx down)"
                return 1
            fi
            $USE_SUDO systemctl restart nginx 2>/dev/null || true
            sleep 1
            nginx_expected_listeners_compute
            nginx_listeners_audit
            if [ "$NGINX_LISTENERS_OK" = "yes" ] && systemctl is-active --quiet nginx 2>/dev/null; then
                echo "[nginx] [OK] restart healed the stale master; listeners verified"
            else
                echo "[nginx] [FAIL] listeners still divergent after the restart"
                return 1
            fi
        fi
    else
        echo "[nginx] Configuration valid; service not active, reload skipped"
    fi
    return 0
}
