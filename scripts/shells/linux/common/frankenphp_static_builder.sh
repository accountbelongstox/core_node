#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# FrankenPHP Official Static Builder (common area) - the docker-LESS
# implementation of frankenphp.dev/docs/static: clone php/frankenphp at
# the RUNNING binary's tag and run the official ./build-static.sh
# (static-php-cli builds its own PHP/libphp toolchain - the ONLY host
# tool consulted is the pinned Go toolchain from gvar_common.sh, used by
# spc's go-xcaddy step). Also carries the post-build system cleanup that
# reverses 43_ensure_php85_intelligent.sh / 77_ensure_php_pgsql.sh: the
# frankenphp plane's PHP runtime is the single static binary - no apt PHP.
# Sourced by frankenphp_manager.sh; every primitive is idempotent.
#
# STDOUT CONTRACT: fm_static_build echoes ONLY the candidate binary path
# (empty on failure) - every log line goes to stderr, because the caller
# captures stdout via $(...).

FM_STATIC_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FM_STATIC_LOG_TAG="frankenphp-static"

# Host toolchain convergence (apt sources self-heal + full build deps);
# must load after FM_STATIC_CURRENT_DIR resolves this directory.
# shellcheck source=/dev/null
source "${FM_STATIC_CURRENT_DIR}/frankenphp_static_prereq.sh"

# Base extension set for the static build (spc names; covers the Laravel
# main app needs - Laravel 13 included). The official default list is
# intentionally overridden for a deterministic, minimal binary.
FRANKENPHP_STATIC_PHP_EXTENSIONS_BASE="apcu,bcmath,brotli,bz2,calendar,ctype,curl,dom,fileinfo,filter,gd,iconv,intl,mbstring,mysqli,openssl,opcache,pdo,pdo_mysql,pdo_sqlite,session,sodium,sqlite3,tokenizer,xml,xmlreader,xmlwriter,zip,zstd"
# Service-selector driven additions (get_var START_*): only the database
# backends this host actually starts are baked into the binary.
FRANKENPHP_STATIC_DB_EXT_MYSQL="mysqli,pdo_mysql"
FRANKENPHP_STATIC_DB_EXT_POSTGRESQL="pdo_pgsql,pgsql"
FRANKENPHP_STATIC_DB_EXT_REDIS="redis"
# EMBED app root (build-static.sh --with-frankenphp-app): the Laravel main
# app is baked into the binary only when it is fully deployed. The repo
# root is 4 levels above this common dir (common -> linux -> shells ->
# scripts -> repo root), resolved once here.
FRANKENPHP_STATIC_REPO_ROOT="$(cd "${FM_STATIC_CURRENT_DIR}/../../../.." && pwd)"
FRANKENPHP_STATIC_EMBED_APP_DIR="${FRANKENPHP_STATIC_REPO_ROOT}/poly_apps/laravel_main"
# Persistent build root (NOT /tmp): the git tree, spc source cache and
# build outputs are KEPT so every later run upgrades in place
# (incremental rebuild) instead of re-downloading. Idempotently created.
FRANKENPHP_STATIC_BUILD_ROOT="/www/programing/frankenphp"
FRANKENPHP_STATIC_SRC_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/src"
FRANKENPHP_STATIC_STAGING_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/candidate"

# Effective PHP_EXTENSIONS list: base + selector-driven database sets,
# de-duplicated preserving order.
fm_static_php_extensions() {
    local exts=""

    exts="$FRANKENPHP_STATIC_PHP_EXTENSIONS_BASE"
    if [ "$(get_var "START_MYSQL" "false")" = "true" ]; then
        exts="${exts},${FRANKENPHP_STATIC_DB_EXT_MYSQL}"
    fi
    if [ "$(get_var "START_POSTGRESQL" "false")" = "true" ]; then
        exts="${exts},${FRANKENPHP_STATIC_DB_EXT_POSTGRESQL}"
    fi
    if [ "$(get_var "START_REDIS" "false")" = "true" ]; then
        exts="${exts},${FRANKENPHP_STATIC_DB_EXT_REDIS}"
    fi
    echo "$exts" | tr ',' '\n' | awk 'NF && !seen[$0]++' | paste -sd','
}

# EMBED source dir (empty when the Laravel main app is not fully deployed:
# composer.json + composer.lock + installed vendor tree must all exist -
# the same trio the official EMBED path relies on).
fm_static_embed_dir() {
    local app_dir=""

    app_dir="$FRANKENPHP_STATIC_EMBED_APP_DIR"
    if [ -f "${app_dir}/composer.json" ] \
        && [ -f "${app_dir}/composer.lock" ] \
        && [ -f "${app_dir}/vendor/composer/installed.json" ]; then
        echo "$app_dir"
        return 0
    fi
    echo ""
}

# Idempotent git source convergence: an existing repo is UPGRADED in
# place (fetch + pinned-tag checkout; no-op when already at the tag -
# untracked build outputs such as dist/ survive the checkout), a missing
# or non-git directory is (re-)cloned with full history so future tag
# jumps never need another clone.
fm_static_git_ensure() {
    local repo_url="$1"
    local version_tag="$2"
    local dest_dir="$3"
    local head_commit=""
    local tag_commit=""

    if [ -d "${dest_dir}/.git" ]; then
        if ! git -C "$dest_dir" fetch --quiet --tags --force origin >&2; then
            echo "[$FM_STATIC_LOG_TAG] [WARN] git fetch failed (continuing with local tags)" >&2
        fi
        head_commit="$(git -C "$dest_dir" rev-parse HEAD 2>/dev/null)"
        tag_commit="$(git -C "$dest_dir" rev-parse "${version_tag}^{commit}" 2>/dev/null)"
        if [ -z "$tag_commit" ]; then
            echo "[$FM_STATIC_LOG_TAG] [ERROR] tag ${version_tag} not present in ${dest_dir}" >&2
            return 1
        fi
        if [ "$head_commit" = "$tag_commit" ]; then
            echo "[$FM_STATIC_LOG_TAG] source tree already at ${version_tag} (${tag_commit:0:12}); incremental rebuild" >&2
            return 0
        fi
        git -C "$dest_dir" checkout --quiet --force "$version_tag" >&2
        echo "[$FM_STATIC_LOG_TAG] source tree upgraded to ${version_tag} (${tag_commit:0:12})" >&2
        return 0
    fi

    rm -rf "$dest_dir"
    echo "[$FM_STATIC_LOG_TAG] cloning $repo_url at $version_tag (full clone: later tag jumps reuse it)" >&2
    git clone --quiet --branch "$version_tag" "$repo_url" "$dest_dir" >&2
}

# Official static build (./build-static.sh). SPC_REL_TYPE=binary keeps the
# run composer-independent (composer is installed later, at 94); musl
# (SPC default on Linux) yields a fully static binary that runs on
# ubuntu/debian/kali alike. FRANKENPHP_VERSION + PHP_VERSION are pinned to
# the RUNNING binary so a rebuild never drifts. Echoes the staged candidate
# path on stdout; on failure echoes "" - the persistent source tree at
# $FRANKENPHP_STATIC_SRC_DIR is always kept (log: build.log) for debugging
# and for the next incremental run.
fm_static_build() {
    local version_tag=""
    local php_ver=""
    local extensions=""
    local embed_dir=""
    local built_bin=""

    if ! fm_static_prereq_ensure; then
        echo "[$FM_STATIC_LOG_TAG] [WARN] static-build prerequisites unsatisfied; build deferred" >&2
        echo ""
        return 0
    fi

    version_tag="$(fm_version_tag)"
    if [ -z "$version_tag" ]; then
        echo "[$FM_STATIC_LOG_TAG] cannot parse the running frankenphp version; static build aborted" >&2
        echo ""
        return 0
    fi
    php_ver="$(fm_php_version)"
    if [ -z "$php_ver" ]; then
        echo "[$FM_STATIC_LOG_TAG] cannot parse the embedded PHP version; static build aborted" >&2
        echo ""
        return 0
    fi
    extensions="$(fm_static_php_extensions)"
    embed_dir="$(fm_static_embed_dir)"

    mkdir -p "$FRANKENPHP_STATIC_BUILD_ROOT"
    if ! fm_static_git_ensure "$FRANKENPHP_STATIC_REPO" "$version_tag" "$FRANKENPHP_STATIC_SRC_DIR"; then
        echo "[$FM_STATIC_LOG_TAG] [WARN] frankenphp source convergence failed" >&2
        echo ""
        return 0
    fi

    echo "[$FM_STATIC_LOG_TAG] official ./build-static.sh (SPC_REL_TYPE=binary, SPC_LIBC=musl, PHP ${php_ver}, frankenphp ${version_tag}${embed_dir:+, EMBED=${embed_dir}})" >&2
    echo "[$FM_STATIC_LOG_TAG] PHP_EXTENSIONS: ${extensions}" >&2
    echo "[$FM_STATIC_LOG_TAG] XCADDY_ARGS: ${FRANKENPHP_STATIC_XCADDY_ARGS}" >&2
    # GOPROXY chain mirrors the GO_TAR_URLS fallback philosophy: official
    # proxy first, CN mirror next, VCS direct last. pipefail keeps the
    # pipeline status honest through the tee logging; everything is
    # re-emitted on stderr so stdout stays the pure path contract.
    if ! (set -o pipefail; cd "$FRANKENPHP_STATIC_SRC_DIR" \
        && SPC_REL_TYPE="binary" \
        SPC_LIBC="musl" \
        FRANKENPHP_VERSION="$version_tag" \
        PHP_VERSION="$php_ver" \
        PHP_EXTENSIONS="$extensions" \
        XCADDY_ARGS="$FRANKENPHP_STATIC_XCADDY_ARGS" \
        GOPROXY="${GOPROXY:-https://proxy.golang.org,https://goproxy.cn,direct}" \
        EMBED="${embed_dir}" \
        ./build-static.sh 2>&1 | tee "${FRANKENPHP_STATIC_BUILD_ROOT}/build.log" >&2); then
        echo "[$FM_STATIC_LOG_TAG] [WARN] ./build-static.sh failed (source kept: ${FRANKENPHP_STATIC_SRC_DIR}, log: ${FRANKENPHP_STATIC_BUILD_ROOT}/build.log)" >&2
        echo ""
        return 0
    fi

    built_bin="${FRANKENPHP_STATIC_SRC_DIR}/dist/frankenphp-linux-$(uname -m)"
    if [ ! -x "$built_bin" ]; then
        echo "[$FM_STATIC_LOG_TAG] [WARN] no binary produced at ${built_bin} (source kept: ${FRANKENPHP_STATIC_SRC_DIR})" >&2
        echo ""
        return 0
    fi

    # Fixed staging dir (idempotent refresh): the caller's cleanup
    # (rm -rf dirname) frees exactly the staged copy while the multi-GB
    # source tree stays for the next incremental build.
    rm -rf "$FRANKENPHP_STATIC_STAGING_DIR"
    mkdir -p "$FRANKENPHP_STATIC_STAGING_DIR"
    cp "$built_bin" "${FRANKENPHP_STATIC_STAGING_DIR}/frankenphp"
    chmod 755 "${FRANKENPHP_STATIC_STAGING_DIR}/frankenphp"
    echo "${FRANKENPHP_STATIC_STAGING_DIR}/frankenphp"
}

# Post-build system cleanup - reverses the apt PHP stack installed by
# 43_ensure_php85_intelligent.sh / 77_ensure_php_pgsql.sh once the static
# frankenphp binary is the verified PHP runtime (the frankenphp plane
# keeps NO apt PHP). Idempotent: nothing to purge -> no-op. Also retires
# the xcaddy binary of the abandoned native-build path (build-static.sh
# ships its own xcaddy via spc install-pkg go-xcaddy).
fm_static_apt_php_cleanup() {
    local binary=""
    local pkgs=""
    local fpm_pkg=""

    binary="$(fm_get_binary)"
    if [ -z "$binary" ] || ! "$binary" version >/dev/null 2>&1; then
        echo "[$FM_STATIC_LOG_TAG] cleanup skipped: no healthy frankenphp binary"
        return 0
    fi
    # shellcheck disable=SC2016
    pkgs="$(dpkg-query -W -f='${binary:Package}\n' 'php*' 2>/dev/null | grep -E '^php' || true)"
    if [ -z "$pkgs" ]; then
        echo "[$FM_STATIC_LOG_TAG] apt PHP already clean (no packages to purge)"
        return 0
    fi

    for fpm_pkg in $(echo "$pkgs" | grep -E 'php.*fpm' || true); do
        $USE_SUDO systemctl disable --now "$fpm_pkg" >/dev/null 2>&1 || true
    done
    echo "[$FM_STATIC_LOG_TAG] purging apt PHP (the static frankenphp binary is the only PHP runtime): $(echo "$pkgs" | tr '\n' ' ')"
    # shellcheck disable=SC2086
    $USE_SUDO apt-get purge -y $pkgs >/dev/null
    $USE_SUDO apt-get autoremove -y -qq >/dev/null

    if [ -x /usr/local/bin/xcaddy ]; then
        $USE_SUDO rm -f /usr/local/bin/xcaddy
        echo "[$FM_STATIC_LOG_TAG] removed stale xcaddy binary (/usr/local/bin/xcaddy)"
    fi

    # shellcheck disable=SC2016
    pkgs="$(dpkg-query -W -f='${binary:Package}\n' 'php*' 2>/dev/null | grep -E '^php' || true)"
    if [ -z "$pkgs" ]; then
        echo "[$FM_STATIC_LOG_TAG] apt PHP purged; php runtime: ${FRANKENPHP_PHP_SHIM_DIR}/php -> ${binary} php-cli"
    else
        echo "[$FM_STATIC_LOG_TAG] [WARN] apt PHP packages remain after purge: $(echo "$pkgs" | tr '\n' ' ')"
    fi
}
