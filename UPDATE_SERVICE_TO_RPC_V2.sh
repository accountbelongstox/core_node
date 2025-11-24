#!/bin/bash
# Update pycore-module-caller service with network access and fast startup

echo "======================================================================"
echo "Updating pycore-module-caller service"
echo "======================================================================"
echo ""

# Step 1: Add PYCORE_SKIP_DEP_CHECK environment variable to service
echo "[1/3] Adding PYCORE_SKIP_DEP_CHECK to service configuration..."
if ! grep -q "PYCORE_SKIP_DEP_CHECK" /etc/systemd/system/pycore-module-caller.service; then
    sed -i '/^Environment="PYTHONPATH/a Environment="PYCORE_SKIP_DEP_CHECK=1"' /etc/systemd/system/pycore-module-caller.service
    echo "  ✓ Environment variable added"
else
    echo "  ✓ Environment variable already present"
fi

# Step 2: Reload systemd daemon
echo ""
echo "[2/3] Reloading systemd daemon..."
systemctl daemon-reload
echo "  ✓ Daemon reloaded"

# Step 3: Restart service
echo ""
echo "[3/3] Restarting service..."
systemctl restart pycore-module-caller.service
echo "  ✓ Service restarted"

# Wait for startup
echo ""
echo "Waiting for service to start (10 seconds)..."
sleep 10

# Show status
echo ""
echo "======================================================================"
echo "Service Status"
echo "======================================================================"
systemctl status pycore-module-caller.service --no-pager -l | head -20

echo ""
echo "======================================================================"
echo "Service Updated Successfully!"
echo "======================================================================"
echo ""
echo "Changes applied:"
echo "  ✅ Network accessible (0.0.0.0:59000)"
echo "  ✅ Fast startup (PYCORE_SKIP_DEP_CHECK=1)"
echo "  ✅ pyaudio moved to Windows-only (no Linux installation)"
echo ""
echo "Access points:"
echo "  Homepage:    http://192.168.2.1:59000/docs"
echo "  Health:      http://192.168.2.1:59000/health"
echo "  API Call:    POST http://192.168.2.1:59000/api/call"
echo ""
echo "Test API:"
echo "  curl -X POST http://192.168.2.1:59000/api/call \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"module\": \"pycore.pyutils.translator\", \"function\": \"translate_single\", \"params\": {\"text\": \"Hello\", \"src\": \"en\", \"dest\": \"ko\"}}'"
echo ""
echo "======================================================================"
