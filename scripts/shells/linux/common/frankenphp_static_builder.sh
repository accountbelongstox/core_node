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
# spc's go-xcaddy step; fm_static_go_ensure converges it via the
# canonical 91_install_golang.sh). A previously built dist binary is
# REUSED when the build tuple still matches (fm_static_dist_reusable) -
# pipeline reruns skip the multi-minute rebuild. EMBED is intentionally
# NOT used: the Caddyfile serves the app from disk, so baking the
# Laravel app into the binary would only add dead weight. Also carries
# the post-build system cleanup that reverses
# 43_ensure_php85_intelligent.sh / 77_ensure_php_pgsql.sh: the
# frankenphp plane's PHP runtime is the single static binary - no apt
# PHP, no frankenphp deb, no php-zts third-party repo.
# Sourced by frankenphp_manager.sh; every primitive is idempotent.
#
# STDOUT CONTRACT: fm_static_build echoes ONLY the candidate binary path
# (empty on failure) - every log line goes to stderr, because the caller
# captures stdout via $(...). fm_static_prereq_ensure and
# fm_static_go_ensure follow the same discipline with ok/failed.

FM_STATIC_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FM_STATIC_LOG_TAG="frankenphp-static"

# Host toolchain convergence (apt sources self-heal + full build deps);
# must load after FM_STATIC_CURRENT_DIR resolves this directory.
# shellcheck source=/dev/null
source "${FM_STATIC_CURRENT_DIR}/frankenphp_static_prereq.sh"

# Base extension set for the static build (spc names; covers the Laravel
# main app needs - Laravel 13 included). The official default list is
# intentionally overridden for a deterministic, minimal binary.
FRANKENPHP_STATIC_PHP_EXTENSIONS_BASE="apcu,bcmath,brotli,bz2,calendar,ctype,curl,dom,fileinfo,filter,gd,iconv,intl,mbstring,mysqli,openssl,opcache,pcntl,pdo,pdo_mysql,pdo_sqlite,phar,session,simplexml,sodium,sqlite3,tokenizer,xml,xmlreader,xmlwriter,zip,zstd"
# Service-selector driven additions (get_var START_*): only the database
# backends this host actually starts are baked into the binary.
FRANKENPHP_STATIC_DB_EXT_MYSQL="mysqli,pdo_mysql"
FRANKENPHP_STATIC_DB_EXT_POSTGRESQL="pdo_pgsql,pgsql"
FRANKENPHP_STATIC_DB_EXT_REDIS="redis"
# Persistent build root (NOT /tmp): the git tree, spc source cache and
# build outputs are KEPT so every later run upgrades in place
# (incremental rebuild) instead of re-downloading. Idempotently created.
FRANKENPHP_STATIC_BUILD_ROOT="/www/programing/frankenphp"
# Build-tuple record of the last successful dist build (tag/php/
# extensions) - the dist-reuse probe compares against it, so a changed
# extension set or release pin forces a real rebuild.
FRANKENPHP_STATIC_BUILD_STATE="${FRANKENPHP_STATIC_BUILD_ROOT}/build-state.env"
# Canonical Go toolchain installer (single source of truth for the pin).
FRANKENPHP_STATIC_GOLANG_SCRIPT="${FM_STATIC_CURRENT_DIR}/../debian/install_shells/91_install_golang.sh"
# Third-party php-zts apt repo + keyring of the frankenphp baseline deb
# (henderkes static-php85); retired together with the deb.
FRANKENPHP_STATIC_PHPZTS_REPO_FILE="/etc/apt/sources.list.d/static-php85.list"
FRANKENPHP_STATIC_PHPZTS_KEYRING="/etc/apt/keyrings/static-php85.asc"
FRANKENPHP_STATIC_SRC_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/src"
FRANKENPHP_STATIC_STAGING_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/candidate"
# Runtime binary roots separate by packaging strategy: compiled static builds
# and released prebuilt artifacts keep their executable files in different
# directories and share only cache/cert paths under the same root.
FRANKENPHP_RUNTIME_ROOT_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/runtime"
FRANKENPHP_COMPILED_RUNTIME_DIR="${FRANKENPHP_RUNTIME_ROOT_DIR}/compiled"
FRANKENPHP_PREBUILT_RUNTIME_DIR="${FRANKENPHP_RUNTIME_ROOT_DIR}/prebuilt"
FRANKENPHP_COMPILED_BINARY_PATH="${FRANKENPHP_COMPILED_RUNTIME_DIR}/frankenphp"
FRANKENPHP_PREBUILT_BINARY_PATH="${FRANKENPHP_PREBUILT_RUNTIME_DIR}/frankenphp"
# Shared install-root path family (single source for the manager, the
# prebuilt installer and the acme.sh helper): every FrankenPHP artifact
# lives under the same persistent root so upgrades stay incremental.
FRANKENPHP_PREBUILT_CACHE_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/prebuilt"
FRANKENPHP_PREBUILT_STAGING_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/prebuilt-staging"
FRANKENPHP_ACME_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/acme.sh"
FRANKENPHP_ACME_CERT_DIR="${FRANKENPHP_STATIC_BUILD_ROOT}/certs"

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

# Pinned Go toolchain convergence (string contract: ok/failed): the ONLY
# host tool ./build-static.sh consults. Fast path probes $GO_BIN at the
# pinned GO_VERSION; any other state defers to the canonical
# 91_install_golang.sh (idempotent, bidirectional version convergence)
# instead of reimplementing the download chain here.
fm_static_go_ensure() {
    local go_ver=""

    if [ -n "$GO_BIN" ] && [ -x "$GO_BIN" ]; then
        go_ver="$("$GO_BIN" version 2>/dev/null | awk '{print $3}')"
        if [ "$go_ver" = "go${GO_VERSION}" ]; then
            echo "ok"
            return 0
        fi
    fi
    if [ ! -f "$FRANKENPHP_STATIC_GOLANG_SCRIPT" ]; then
        echo "[$FM_STATIC_LOG_TAG] [ERROR] pinned Go toolchain missing and canonical installer not found: ${FRANKENPHP_STATIC_GOLANG_SCRIPT}" >&2
        echo "failed"
        return 0
    fi
    echo "[$FM_STATIC_LOG_TAG] converging the pinned Go toolchain (go${GO_VERSION}) via 91_install_golang.sh" >&2
    bash "$FRANKENPHP_STATIC_GOLANG_SCRIPT" 1>&2
    go_ver=""
    if [ -n "$GO_BIN" ] && [ -x "$GO_BIN" ]; then
        go_ver="$("$GO_BIN" version 2>/dev/null | awk '{print $3}')"
    fi
    if [ "$go_ver" = "go${GO_VERSION}" ]; then
        echo "ok"
    else
        echo "failed"
    fi
    return 0
}

# Dist-reuse probe (string contract: staged candidate path or ""): a
# previously built dist binary is reused when the build tuple (release
# tag, PHP version, extension set) recorded at build time still matches
# AND the binary itself passes the completeness floor (executes, tag
# match, dnspod module, phar/simplexml/pcntl). Reuse skips the
# multi-minute source build; the staged copy keeps the uniform caller
# contract (rm -rf dirname frees exactly the staging dir).
fm_static_dist_reusable() {
    local version_tag="$1"
    local php_ver="$2"
    local extensions="$3"
    local dist_bin=""
    local dist_tag=""
    local state_line=""

    dist_bin="${FRANKENPHP_STATIC_SRC_DIR}/dist/frankenphp-linux-$(uname -m)"
    if [ ! -x "$dist_bin" ] || [ ! -f "$FRANKENPHP_STATIC_BUILD_STATE" ]; then
        echo ""
        return 0
    fi
    for state_line in "FRANKENPHP_BUILD_TAG=${version_tag}" \
        "FRANKENPHP_BUILD_PHP=${php_ver}" \
        "FRANKENPHP_BUILD_EXTENSIONS=${extensions}"; do
        if ! grep -qxF "$state_line" "$FRANKENPHP_STATIC_BUILD_STATE"; then
            echo ""
            return 0
        fi
    done
    dist_tag="$(fm_version_tag_of "$dist_bin")"
    if [ "$dist_tag" != "$version_tag" ] \
        || [ "$(fm_binary_compile_complete "$dist_bin")" != "yes" ]; then
        echo ""
        return 0
    fi
    rm -rf "$FRANKENPHP_STATIC_STAGING_DIR"
    mkdir -p "$FRANKENPHP_STATIC_STAGING_DIR"
    cp "$dist_bin" "${FRANKENPHP_STATIC_STAGING_DIR}/frankenphp"
    chmod 755 "${FRANKENPHP_STATIC_STAGING_DIR}/frankenphp"
    echo "${FRANKENPHP_STATIC_STAGING_DIR}/frankenphp"
}

# Idempotent git source convergence: an existing repo is UPGRADED in
# place (fetch + pinned-tag checkout; no-op when already at the tag -
# untracked build outputs such as dist/ survive the checkout), a missing
# or non-git directory is (re-)cloned with full history so future tag
# jumps never need another clone. String contract: "ok"/"failed" on
# stdout (logs to stderr; file-state re-probes, never exit codes).
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
            echo "failed"
            return 0
        fi
        if [ "$head_commit" = "$tag_commit" ]; then
            echo "[$FM_STATIC_LOG_TAG] source tree already at ${version_tag} (${tag_commit:0:12}); incremental rebuild" >&2
            echo "ok"
            return 0
        fi
        git -C "$dest_dir" checkout --quiet --force "$version_tag" >&2
        head_commit="$(git -C "$dest_dir" rev-parse HEAD 2>/dev/null)"
        if [ "$head_commit" = "$tag_commit" ]; then
            echo "[$FM_STATIC_LOG_TAG] source tree upgraded to ${version_tag} (${tag_commit:0:12})" >&2
            echo "ok"
        else
            echo "[$FM_STATIC_LOG_TAG] [ERROR] checkout of ${version_tag} failed in ${dest_dir}" >&2
            echo "failed"
        fi
        return 0
    fi

    rm -rf "$dest_dir"
    echo "[$FM_STATIC_LOG_TAG] cloning $repo_url at $version_tag (full clone: later tag jumps reuse it)" >&2
    git clone --quiet --branch "$version_tag" "$repo_url" "$dest_dir" >&2
    # Trust the run result, re-probe the file state: a clone is complete
    # only when the work tree sits at the requested tag.
    tag_commit="$(git -C "$dest_dir" rev-parse "${version_tag}^{commit}" 2>/dev/null)"
    head_commit="$(git -C "$dest_dir" rev-parse HEAD 2>/dev/null)"
    if [ -n "$tag_commit" ] && [ "$head_commit" = "$tag_commit" ]; then
        echo "ok"
    else
        echo "[$FM_STATIC_LOG_TAG] [ERROR] clone of ${repo_url}@${version_tag} failed" >&2
        echo "failed"
    fi
    return 0
}

# Official static build (./build-static.sh). SPC_REL_TYPE=binary keeps the
# run composer-independent (composer is installed later, at 94); musl
# (SPC default on Linux) yields a fully static binary that runs on
# ubuntu/debian/kali alike. FRANKENPHP_VERSION + PHP_VERSION are pinned to
# the RUNNING binary so a rebuild never drifts. A matching dist binary
# from a previous build is staged without rebuilding. Echoes the staged
# candidate path on stdout; on failure echoes "" - the persistent source
# tree at $FRANKENPHP_STATIC_SRC_DIR is always kept (log: build.log) for
# debugging and for the next incremental run.
fm_static_build() {
    local version_tag=""
    local php_ver=""
    local extensions=""
    local reuse_path=""
    local built_bin=""

    if [ "$(fm_static_prereq_ensure)" != "ok" ]; then
        echo "[$FM_STATIC_LOG_TAG] [WARN] static-build prerequisites unsatisfied; build deferred" >&2
        echo ""
        return 0
    fi
    if [ "$(fm_static_go_ensure)" != "ok" ]; then
        echo "[$FM_STATIC_LOG_TAG] [WARN] pinned Go toolchain unavailable; build deferred" >&2
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

    reuse_path="$(fm_static_dist_reusable "$version_tag" "$php_ver" "$extensions")"
    if [ -n "$reuse_path" ]; then
        echo "[$FM_STATIC_LOG_TAG] dist binary reused (build tuple unchanged, no rebuild): ${reuse_path}" >&2
        echo "$reuse_path"
        return 0
    fi

    mkdir -p "$FRANKENPHP_STATIC_BUILD_ROOT"
    if [ "$(fm_static_git_ensure "$FRANKENPHP_STATIC_REPO" "$version_tag" "$FRANKENPHP_STATIC_SRC_DIR")" != "ok" ]; then
        echo "[$FM_STATIC_LOG_TAG] [WARN] frankenphp source convergence failed" >&2
        echo ""
        return 0
    fi

    echo "[$FM_STATIC_LOG_TAG] official ./build-static.sh (SPC_REL_TYPE=binary, SPC_LIBC=musl, PHP ${php_ver}, frankenphp ${version_tag})" >&2
    echo "[$FM_STATIC_LOG_TAG] PHP_EXTENSIONS: ${extensions}" >&2
    echo "[$FM_STATIC_LOG_TAG] XCADDY_ARGS: ${FRANKENPHP_STATIC_XCADDY_ARGS}" >&2
    # Upstream v1.12.7 build-static.sh documents XCADDY_ARGS but never uses
    # it - the REAL knob is SPC_CMD_VAR_FRANKENPHP_XCADDY_MODULES (only
    # defaulted when unset). Export BOTH so the documented knob works on
    # newer tags and the real knob drives the running tag.
    echo "[$FM_STATIC_LOG_TAG] SPC_CMD_VAR_FRANKENPHP_XCADDY_MODULES: ${FRANKENPHP_STATIC_XCADDY_ARGS}" >&2
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
        SPC_CMD_VAR_FRANKENPHP_XCADDY_MODULES="$FRANKENPHP_STATIC_XCADDY_ARGS" \
        GOPROXY="${GOPROXY:-https://proxy.golang.org,https://goproxy.cn,direct}" \
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

    # Record the build tuple so the next run can dist-reuse this binary.
    {
        echo "FRANKENPHP_BUILD_TAG=${version_tag}"
        echo "FRANKENPHP_BUILD_PHP=${php_ver}"
        echo "FRANKENPHP_BUILD_EXTENSIONS=${extensions}"
    } > "$FRANKENPHP_STATIC_BUILD_STATE"

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
    local held_pkg=""

    binary="$(fm_get_binary)"
    if [ "$(fm_binary_usable "$binary")" != "yes" ]; then
        echo "[$FM_STATIC_LOG_TAG] cleanup skipped: no healthy frankenphp binary"
        return 0
    fi
    # INSTALLED (ii-state) php runtime set only: the php* glob also matches
    # deinstalled config leftovers (rc) which would poison the purge command;
    # the set additionally owns the apache mod_php modules + pkg-php-tools
    # (the only non-php* reverse dependency).
    pkgs="$(dpkg -l 2>/dev/null | awk '$1=="ii" && $2 ~ /^(php|libapache2-mod-php|pkg-php-tools)/ {print $2}' || true)"
    if [ -z "$pkgs" ]; then
        echo "[$FM_STATIC_LOG_TAG] apt PHP already clean (no installed packages to purge)"
    else
        # Held php-runtime packages freeze the dependency resolver (a hold
        # blocks removal too - pkgProblemResolver "breaks"). Release ONLY
        # php-related holds one by one; unrelated holds stay.
        for held_pkg in $(apt-mark showhold 2>/dev/null | grep -E '^(php|libapache2-mod-php|pkg-php-tools)' || true); do
            $USE_SUDO apt-mark unhold "$held_pkg" >/dev/null 2>&1 || true
        done

        for fpm_pkg in $(echo "$pkgs" | grep -E 'php.*fpm' || true); do
            $USE_SUDO systemctl disable --now "$fpm_pkg" >/dev/null 2>&1 || true
        done
        echo "[$FM_STATIC_LOG_TAG] purging apt PHP (the static frankenphp binary is the only PHP runtime): $(echo "$pkgs" | tr '\n' ' ')"
        # shellcheck disable=SC2086
        $USE_SUDO apt-get purge -y $pkgs >/dev/null
        $USE_SUDO apt-get autoremove -y -qq >/dev/null
    fi

    # Explicit frankenphp deb purge (henderkes php-zts baseline): the php
    # purge cascade removes it only IMPLICITLY - probe and purge it
    # explicitly so the state never depends on cascade side effects. The
    # deb binary is NEVER purged while it is the live runtime (the
    # link-first binary probe above resolves the plane's own binary).
    if dpkg-query -W -f='${Status}' frankenphp 2>/dev/null | grep -q '^install ok installed$' \
        && [ "$binary" != "/usr/bin/frankenphp" ]; then
        $USE_SUDO systemctl disable --now frankenphp.service >/dev/null 2>&1 || true
        $USE_SUDO apt-get purge -y frankenphp >/dev/null
        echo "[$FM_STATIC_LOG_TAG] purged the frankenphp baseline deb (/usr/bin/frankenphp)"
    fi
    # Retire the third-party php-zts apt repo + keyring: their only purpose
    # was the baseline deb; the plane runtime is the static binary.
    if [ -f "$FRANKENPHP_STATIC_PHPZTS_REPO_FILE" ]; then
        $USE_SUDO rm -f "$FRANKENPHP_STATIC_PHPZTS_REPO_FILE"
        echo "[$FM_STATIC_LOG_TAG] retired the php-zts apt repo (${FRANKENPHP_STATIC_PHPZTS_REPO_FILE})"
    fi
    if [ -f "$FRANKENPHP_STATIC_PHPZTS_KEYRING" ]; then
        $USE_SUDO rm -f "$FRANKENPHP_STATIC_PHPZTS_KEYRING"
        echo "[$FM_STATIC_LOG_TAG] removed the php-zts repo keyring (${FRANKENPHP_STATIC_PHPZTS_KEYRING})"
    fi

    if [ -x /usr/local/bin/xcaddy ]; then
        $USE_SUDO rm -f /usr/local/bin/xcaddy
        echo "[$FM_STATIC_LOG_TAG] removed stale xcaddy binary (/usr/local/bin/xcaddy)"
    fi

    pkgs="$(dpkg -l 2>/dev/null | awk '$1=="ii" && $2 ~ /^(php|libapache2-mod-php|pkg-php-tools)/ {print $2}' || true)"
    if [ -z "$pkgs" ]; then
        echo "[$FM_STATIC_LOG_TAG] apt PHP purged; php runtime: ${FRANKENPHP_PHP_SHIM_DIR}/php -> ${binary} php-cli"
    else
        echo "[$FM_STATIC_LOG_TAG] [WARN] apt PHP packages remain after purge: $(echo "$pkgs" | tr '\n' ' ')"
    fi
}
