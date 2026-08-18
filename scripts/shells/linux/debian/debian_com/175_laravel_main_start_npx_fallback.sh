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
COMPOSER_CMD="${COMPOSER_CMD:-composer}"

echo "WARNING: Swoole unavailable -> Octane HTTP server disabled, using node-based fallback."
echo "Starting fallback (composer dev:win -> server 0.0.0.0:${PORT} + queue + timer)"

$COMPOSER_CMD dev:win
