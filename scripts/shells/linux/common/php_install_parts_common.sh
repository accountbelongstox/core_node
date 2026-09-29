#!/bin/bash

# Sub-part selection for 93_install_php.sh: `--only=runtime,swoole` or
# `--only composer`. Every other argument is passed through untouched
# (--mode=, --apt, --compile, --prebuilt-version=, --no-mutex, --force).

PHP_INSTALL_PARTS_ALL="runtime swoole config composer"
PHP_INSTALL_PARTS=""
PHP_INSTALL_PARTS_VALID="yes"
PHP_INSTALL_PASSTHROUGH=()

php_install_arguments_read() {
    local argument=""
    local part=""
    local expect_value="no"
    local only_seen="no"

    PHP_INSTALL_PARTS=""
    PHP_INSTALL_PARTS_VALID="yes"
    PHP_INSTALL_PASSTHROUGH=()
    for argument in "$@"; do
        if [ "$expect_value" = "yes" ]; then
            PHP_INSTALL_PARTS="${argument//,/ }"
            only_seen="yes"
            expect_value="no"
            continue
        fi
        case "$argument" in
            --only=*) PHP_INSTALL_PARTS="${argument#--only=}"; PHP_INSTALL_PARTS="${PHP_INSTALL_PARTS//,/ }"; only_seen="yes" ;;
            --only) expect_value="yes"; only_seen="yes" ;;
            *) PHP_INSTALL_PASSTHROUGH+=("$argument") ;;
        esac
    done
    if [ "$only_seen" = "no" ]; then
        PHP_INSTALL_PARTS="$PHP_INSTALL_PARTS_ALL"
    elif [ -z "${PHP_INSTALL_PARTS//[[:space:]]/}" ]; then
        PHP_INSTALL_PARTS_VALID="no"
    fi
    for part in $PHP_INSTALL_PARTS; do
        case " $PHP_INSTALL_PARTS_ALL " in
            *" $part "*) ;;
            *) PHP_INSTALL_PARTS_VALID="no" ;;
        esac
    done
}

php_install_part_selected() {
    case " $PHP_INSTALL_PARTS " in
        *" $1 "*) echo "yes" ;;
        *) echo "no" ;;
    esac
}
