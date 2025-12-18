#!/bin/bash

# Restart Laravel Octane Service
# This script restarts the Laravel Octane service to reload code changes

echo "Restarting Laravel Octane (ncore-laravel_main)..."

sudo systemctl restart ncore-laravel_main

if [ $? -eq 0 ]; then
    echo "✓ Laravel Octane restarted successfully"
    echo ""
    echo "Waiting for service to be ready..."
    sleep 2

    # Check status
    sudo systemctl status ncore-laravel_main --no-pager
else
    echo "✗ Failed to restart Laravel Octane"
    exit 1
fi
