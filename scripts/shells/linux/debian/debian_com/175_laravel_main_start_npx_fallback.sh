#!/bin/bash

PORT="${PORT:-}"
COMPOSER_CMD="${COMPOSER_CMD:-composer}"

echo "WARNING: Swoole unavailable -> Octane HTTP server disabled, using node-based fallback."
echo "Starting fallback (composer dev:win -> server 0.0.0.0:${PORT} + queue + timer)"

$COMPOSER_CMD dev:win
