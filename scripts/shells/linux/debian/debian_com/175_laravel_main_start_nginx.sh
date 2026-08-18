#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

PORT="${PORT:-}"
PHP_BIN="${PHP_BIN:-}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
LARAVEL_RUNTIME_NGINX_SCRIPT="${LARAVEL_RUNTIME_NGINX_SCRIPT:-}"
OCTANE_RUNTIME_WATCH="${OCTANE_RUNTIME_WATCH:-0}"
OCTANE_RUNTIME_POLL="${OCTANE_RUNTIME_POLL:-0}"

echo "Starting headless API runtime (nginx plane -> Octane swoole on server 0.0.0.0:${PORT}, single timer driver)"

/bin/bash "$LARAVEL_RUNTIME_NGINX_SCRIPT"
