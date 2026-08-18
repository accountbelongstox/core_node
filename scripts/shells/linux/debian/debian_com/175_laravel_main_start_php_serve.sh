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

echo "WARNING: Swoole unavailable and no node -> using node-free fallback."
echo "node-free fallback: php artisan serve + queue:listen + schedule:work (sub-minute timer tasks still run via Laravel Schedule)"

"$PHP_BIN" artisan queue:listen --tries=1 --timeout=0 &
"$PHP_BIN" artisan schedule:work &
"$PHP_BIN" artisan serve --host=0.0.0.0 --port="$PORT"
