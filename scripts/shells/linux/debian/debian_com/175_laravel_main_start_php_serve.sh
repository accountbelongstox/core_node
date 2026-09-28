#!/bin/bash

PORT="${PORT:-}"
PHP_BIN="${PHP_BIN:-}"

echo "WARNING: Swoole unavailable and no node -> using node-free fallback."
echo "node-free fallback: php artisan serve + queue:listen + schedule:work (sub-minute timer tasks still run via Laravel Schedule)"

"$PHP_BIN" artisan queue:listen --tries=1 --timeout=0 &
"$PHP_BIN" artisan schedule:work &
"$PHP_BIN" artisan serve --host=0.0.0.0 --port="$PORT"
