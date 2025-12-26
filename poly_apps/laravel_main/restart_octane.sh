#!/bin/bash
# Restart Laravel Octane to pick up route changes

echo "Stopping Octane..."
pkill -f "octane:start"

sleep 2

echo "Starting Octane..."
cd /www/programing/core_node/poly_apps/laravel_main
nohup php artisan octane:start --host=0.0.0.0 --port=9000 --workers=8 > /dev/null 2>&1 &

sleep 3

echo "Checking Octane status..."
if ps aux | grep -q "[o]ctane:start"; then
    echo "✓ Octane started successfully"
    curl -s http://localhost:9000/api/app_qy_v1/ai_tools/tts/queue/stats | jq -r '.data.statistics | "Pending: \(.pending), Completed: \(.completed)"'
else
    echo "✗ Failed to start Octane"
fi
