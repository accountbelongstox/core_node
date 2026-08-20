#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# RuntimeConfigurationStore shell adapter (common area). Single shared
# implementation for every caller (175_laravel_main_start.sh,
# laravel_start_service.sh, the laravel_runtime_* plane branches) - the
# store itself (key normalization, private permissions) lives in
# poly_apps/laravel_main/app/Support/RuntimeConfigurationStore.php.
#
# Callers MUST provide before use: PHP_BIN, VENDOR_AUTOLOAD, BOOTSTRAP_APP.
# Code runs through php_script_run (temp script file + env arguments): the
# embedded frankenphp php-cli runner accepts neither -r nor $argv, while
# the real php CLI handles the identical file+getenv() form.

runtime_config_directory() {
    RC_ARG_AUTOLOAD="$VENDOR_AUTOLOAD" RC_ARG_BOOTSTRAP="$BOOTSTRAP_APP" \
        php_script_run '
        $autoload = getenv("RC_ARG_AUTOLOAD");
        $bootstrap = getenv("RC_ARG_BOOTSTRAP");
        require $autoload;
        require $bootstrap;
        echo \App\Support\RuntimeConfigurationStore::directory();
    '
}

runtime_config_get() {
    local key="$1"

    RC_ARG_AUTOLOAD="$VENDOR_AUTOLOAD" RC_ARG_BOOTSTRAP="$BOOTSTRAP_APP" RC_ARG_KEY="$key" \
        php_script_run '
        $autoload = getenv("RC_ARG_AUTOLOAD");
        $bootstrap = getenv("RC_ARG_BOOTSTRAP");
        $key = getenv("RC_ARG_KEY");
        $value = null;
        require $autoload;
        require $bootstrap;
        $value = \App\Support\RuntimeConfigurationStore::get($key);
        if ($value !== null) {
            echo $value;
        }
    '
}

runtime_config_put() {
    local key="$1"
    local value="$2"

    printf '%s' "$value" | \
        RC_ARG_AUTOLOAD="$VENDOR_AUTOLOAD" RC_ARG_BOOTSTRAP="$BOOTSTRAP_APP" RC_ARG_KEY="$key" \
        php_script_run '
        $autoload = getenv("RC_ARG_AUTOLOAD");
        $bootstrap = getenv("RC_ARG_BOOTSTRAP");
        $key = getenv("RC_ARG_KEY");
        $value = trim(stream_get_contents(STDIN));
        require $autoload;
        require $bootstrap;
        exit(\App\Support\RuntimeConfigurationStore::put($key, $value) ? 0 : 1);
    '
}

ensure_runtime_config_value() {
    local key="$1"
    local value="$2"
    local current=""

    current="$(runtime_config_get "$key")"
    if [ -n "$current" ]; then
        return 0
    fi

    runtime_config_put "$key" "$value"
}

# Ensure the Mercure hub keys exist in the store. Single writer: the
# laravel_main provisioner (App\Services\Relay\RelayHubKeyProvisioner) -
# idempotent, present keys are never rotated. Same caller contract as
# runtime_config_get/put (PHP_BIN, VENDOR_AUTOLOAD, BOOTSTRAP_APP).
# Non-zero when the provisioner cannot run; silent on success.
runtime_config_ensure_mercure_keys() {
    RC_ARG_AUTOLOAD="$VENDOR_AUTOLOAD" RC_ARG_BOOTSTRAP="$BOOTSTRAP_APP" \
        php_script_run '
        $autoload = getenv("RC_ARG_AUTOLOAD");
        $bootstrap = getenv("RC_ARG_BOOTSTRAP");
        require $autoload;
        require $bootstrap;
        \App\Services\Relay\RelayHubKeyProvisioner::ensure();
    '
}
