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

runtime_config_directory() {
    "$PHP_BIN" -r '
        $autoload = $argv[1];
        $bootstrap = $argv[2];
        require $autoload;
        require $bootstrap;
        echo \App\Support\RuntimeConfigurationStore::directory();
    ' "$VENDOR_AUTOLOAD" "$BOOTSTRAP_APP"
}

runtime_config_get() {
    local key="$1"

    "$PHP_BIN" -r '
        $autoload = $argv[1];
        $bootstrap = $argv[2];
        $key = $argv[3];
        $value = null;
        require $autoload;
        require $bootstrap;
        $value = \App\Support\RuntimeConfigurationStore::get($key);
        if ($value !== null) {
            echo $value;
        }
    ' "$VENDOR_AUTOLOAD" "$BOOTSTRAP_APP" "$key"
}

runtime_config_put() {
    local key="$1"
    local value="$2"

    printf '%s' "$value" | "$PHP_BIN" -r '
        $autoload = $argv[1];
        $bootstrap = $argv[2];
        $key = $argv[3];
        $value = trim(stream_get_contents(STDIN));
        require $autoload;
        require $bootstrap;
        exit(\App\Support\RuntimeConfigurationStore::put($key, $value) ? 0 : 1);
    ' "$VENDOR_AUTOLOAD" "$BOOTSTRAP_APP" "$key"
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
