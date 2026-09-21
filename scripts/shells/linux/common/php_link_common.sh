#!/usr/bin/env bash
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
#
# php_link_common.sh - converge the php CLI entrypoint on ONE canonical link.
#
# Single source of truth for the `php` command contract (sourced by
# 53_install_swoole.sh, 96_configure_php85.sh, 93_install_frankenphp.sh and the
# frankenphp lifecycle):
#   * CANONICAL: /usr/local/bin/php -- a plain SYMLINK to the real CLI binary
#     (php-zts from the henderkes/frankenphp apt plane, or the versioned distro
#     build). /usr/local/bin precedes /usr/bin in PATH, so this one link is the
#     effective `php` for composer, pecl, artisan and every probe
#     (php_common_vars.sh TARGET_LINK_PATH, 191 octane ExecStart).
#   * DUPLICATES are removed idempotently: /usr/bin/php (plain symlink or
#     update-alternatives entry) and the legacy frankenphp bash shims
#     (/usr/local/bin/php{,-cli}) which exec `frankenphp php-cli` -- that
#     subcommand treats normal php flags (-v/-r/-l) as SCRIPT FILES
#     ("Failed opening required '-v'"), breaking every standard CLI consumer.
# Idempotent: re-running only fixes drift, never rewrites a correct state.

# ---- variable declarations (rule 5) ----
PHP_LINK_CANONICAL="${PHP_LINK_CANONICAL:-/usr/local/bin/php}"
PHP_LINK_DUPLICATE="${PHP_LINK_DUPLICATE:-/usr/bin/php}"
PHP_LINK_REQUIRED_VERSION="${PHP_LINK_REQUIRED_VERSION:-${PHP_VERSION:-8.5}}"
PHP_LINK_LEGACY_SHIM="${PHP_LINK_LEGACY_SHIM:-/usr/local/bin/php-cli}"

ensure_single_php_link() {
    local _sudo="${USE_SUDO:-}"
    local real_bin=""
    local candidate=""

    [ -z "$_sudo" ] && [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && _sudo="sudo"

    # 1) Resolve the real CLI binary: henderkes ZTS build (frankenphp apt
    #    plane), the versioned distro build, or an already-working link target.
    for candidate in /usr/bin/php-zts "/usr/bin/php${PHP_LINK_REQUIRED_VERSION}"; do
        [ -x "$candidate" ] || continue
        if [ -z "$PHP_LINK_REQUIRED_VERSION" ] \
            || "$candidate" -v 2>/dev/null | grep -q "PHP ${PHP_LINK_REQUIRED_VERSION}"; then
            real_bin="$candidate"
            break
        fi
    done
    if [ -z "$real_bin" ] && [ -e "$PHP_LINK_DUPLICATE" ] && "$PHP_LINK_DUPLICATE" -v >/dev/null 2>&1; then
        real_bin="$(readlink -f "$PHP_LINK_DUPLICATE" 2>/dev/null)"
    fi
    if [ -z "$real_bin" ] || [ ! -x "$real_bin" ]; then
        echo "[php-link] no working PHP CLI binary found; convergence skipped"
        return 1
    fi

    # 2) Canonical single link. Anything that is not a symlink resolving to the
    #    real binary (missing, stale frankenphp php-cli shim, wrong target) is
    #    replaced.
    if [ "$(readlink -f "$PHP_LINK_CANONICAL" 2>/dev/null)" != "$real_bin" ]; then
        $_sudo rm -f "$PHP_LINK_CANONICAL" 2>/dev/null || true
        if $_sudo ln -s "$real_bin" "$PHP_LINK_CANONICAL"; then
            echo "[php-link] $PHP_LINK_CANONICAL -> $real_bin"
        else
            echo "[php-link] [WARN] failed to link $PHP_LINK_CANONICAL -> $real_bin"
            return 1
        fi
    fi

    # 3) Legacy frankenphp php-cli shim alias (nothing references it).
    if [ -f "$PHP_LINK_LEGACY_SHIM" ] && [ ! -L "$PHP_LINK_LEGACY_SHIM" ] \
        && head -c 1000 "$PHP_LINK_LEGACY_SHIM" 2>/dev/null | grep -q "frankenphp php-cli"; then
        $_sudo rm -f "$PHP_LINK_LEGACY_SHIM"
        echo "[php-link] removed legacy frankenphp shim $PHP_LINK_LEGACY_SHIM"
    fi

    # 4) The duplicate link: update-alternatives entry first, then any plain
    #    symlink. Never touches a real FILE at $PHP_LINK_DUPLICATE.
    if command -v update-alternatives >/dev/null 2>&1 && update-alternatives --query php >/dev/null 2>&1; then
        $_sudo update-alternatives --remove php "$real_bin" >/dev/null 2>&1 || true
    fi
    if [ -L "$PHP_LINK_DUPLICATE" ]; then
        $_sudo rm -f "$PHP_LINK_DUPLICATE"
        echo "[php-link] removed duplicate $PHP_LINK_DUPLICATE (single link: $PHP_LINK_CANONICAL)"
    fi

    # 5) Verify the one remaining link actually works as a CLI.
    if "$PHP_LINK_CANONICAL" -v >/dev/null 2>&1; then
        echo "[php-link] OK: $("$PHP_LINK_CANONICAL" -v 2>/dev/null | head -n1) (single link $PHP_LINK_CANONICAL)"
        return 0
    fi
    echo "[php-link] [WARN] $PHP_LINK_CANONICAL is not a working php CLI"
    return 1
}
