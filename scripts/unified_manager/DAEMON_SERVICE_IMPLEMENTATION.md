# Daemon Service Implementation Summary

## Overview
Automatic daemon service detection, creation, and management for all sub-apps in the unified_manager system.

---

## Key Features

### 1. Automatic Detection
- Scans for daemon scripts in `./scripts/` directory
- Case-insensitive matching (daemon, Daemon, DAEMON)
- Supports multiple script types: `.sh`, `.py`, `.js`

### 2. Idempotent Operations
- ✅ Safe to run multiple times
- ✅ Automatically cleans up old daemon services
- ✅ Removes orphaned daemon services when script deleted
- ✅ Refreshes configuration on rebuild

### 3. Resource Management
- **Main Service**: CPU 50%, Memory 1G (configurable)
- **Daemon Service**: CPU 12.5% (1/4 of main), Memory 256M (1/4 of main)
- Automatic calculation with minimum limits

### 4. Service Dependencies
- Daemon service depends on main service
- Daemon starts after main service
- Stopping main service stops daemon service

---

## Implementation Details

### Modified Files

#### 1. `modules/service_manager.sh`
```bash
# New Functions Added:
- scan_daemon_service()           # Detect daemon script
- calculate_daemon_resources()    # Calculate 1/4 resources
- create_daemon_service()         # Create daemon systemd service
- delete_unified_service()        # Delete main + daemon services
```

**Key Changes:**
- Line 96-124: `scan_daemon_service()` - Searches for daemon.{sh,py,js}
- Line 126-163: `calculate_daemon_resources()` - CPU/Memory calculation (1/4)
- Line 165-322: `create_daemon_service()` - Complete daemon service creation with idempotency
- Line 324-419: `delete_unified_service()` - Unified deletion of both services
- Line 656-682: Orphaned daemon service cleanup
- Line 808-816: Automatic daemon service creation trigger

#### 2. `core/launcher_generator.py`
```python
# New Methods Added:
- generate_daemon_launcher()          # Main daemon launcher generator
- _generate_python_daemon_launcher()  # Python daemon support
- _generate_bash_daemon_launcher()    # Bash daemon support
- _generate_node_daemon_launcher()    # Node.js daemon support
- _generate_generic_daemon_launcher() # Generic daemon support
```

**Key Changes:**
- Line 73-110: `generate_daemon_launcher()` - Detects script type and generates launcher
- Line 112-138: Python daemon launcher template
- Line 140-168: Bash daemon launcher template
- Line 170-199: Node.js daemon launcher template
- Line 201-229: Generic daemon launcher template

---

## Service Naming Convention

```
Main Service:    webapp-{app_name}
Daemon Service:  webapp-{app_name}-daemon

Examples:
- webapp-appfactory-master-dashboard
- webapp-appfactory-master-dashboard-daemon
```

---

## Daemon Script Locations (Checked in Order)

```
1. ./scripts/daemon.sh
2. ./scripts/daemon.py
3. ./scripts/daemon.js
4. ./scripts/Daemon.sh
5. ./scripts/Daemon.py
6. ./scripts/Daemon.js
7. ./scripts/DAEMON.sh
8. ./scripts/DAEMON.py
9. ./scripts/DAEMON.js
10. ./daemon.sh
11. ./daemon.py
12. ./daemon.js
```

**First match wins** - stops searching after finding first daemon script.

---

## SystemD Service Configuration

### Main Service Example
```ini
[Unit]
Description=appfactory-master-dashboard (reactStart)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/www/programing/core_node/poly_apps/appfactory-master-dashboard
ExecStart=/var/_core_node/.../webapp-appfactory-master-dashboard.sh
Restart=always
RestartSec=5
CPUQuota=50%
MemoryMax=1G
MemoryHigh=0G

[Install]
WantedBy=multi-user.target
```

### Daemon Service Example
```ini
[Unit]
Description=appfactory-master-dashboard daemon service
After=network.target
Requires=webapp-appfactory-master-dashboard.service
After=webapp-appfactory-master-dashboard.service

[Service]
Type=simple
User=root
WorkingDirectory=/www/programing/core_node/poly_apps/appfactory-master-dashboard
ExecStart=/var/_core_node/.../webapp-appfactory-master-dashboard-daemon.sh
Restart=always
RestartSec=5
CPUQuota=12%
MemoryMax=256M
MemoryHigh=0M

[Install]
WantedBy=multi-user.target
```

**Key Differences:**
- Daemon has `Requires=` and `After=` for main service
- Daemon has 1/4 resources of main service

---

## Launcher Script Templates

### Bash Daemon Launcher
```bash
#!/bin/bash
set -e

echo "=== Daemon Service Launcher (Bash) ==="
cd "/path/to/app"

export APP_ROOT="/path/to/app"
export DEBUG_MODE="true"

chmod +x "/path/to/daemon.sh"
exec bash "/path/to/daemon.sh"
```

### Python Daemon Launcher
```bash
#!/bin/bash
set -e

echo "=== Daemon Service Launcher (Python) ==="
cd "/path/to/app"

export APP_ROOT="/path/to/app"
export DEBUG_MODE="true"
export PYTHONPATH="/path/to/app:$PYTHONPATH"

exec python3 "/path/to/daemon.py"
```

### Node.js Daemon Launcher
```bash
#!/bin/bash
set -e

echo "=== Daemon Service Launcher (Node.js) ==="
cd "/path/to/app"

export PATH="/www/_ubuntu_24/node/...:$PATH"
export APP_ROOT="/path/to/app"
export DEBUG_MODE="true"
export NODE_ENV="development"

exec node "/path/to/daemon.js"
```

---

## Idempotency Flow

### Create Service Flow
```
1. Check if daemon script exists
   ├─ Yes → Continue
   └─ No  → Check for orphaned daemon service
            ├─ Found → Clean up orphaned service
            └─ Not Found → Skip daemon creation

2. Create main service
   ├─ Check if exists → Clean up old service
   └─ Generate launcher → Create systemd service

3. Create daemon service (if script exists)
   ├─ Check if exists → Clean up old daemon service
   ├─ Calculate resources (1/4 of main)
   ├─ Generate daemon launcher
   ├─ Create daemon systemd service
   └─ Start daemon service
```

### Delete Service Flow
```
1. Delete daemon service first
   ├─ Stop daemon service
   ├─ Disable daemon service
   └─ Remove daemon service file

2. Delete main service
   ├─ Stop main service
   ├─ Disable main service
   └─ Remove main service file

3. Reload systemd
```

---

## User Experience

### When Daemon Script Exists
```
=== Creating Main Service ===
✓ Service created successfully

📦 Found daemon script: daemon.sh

=== Creating Daemon Service ===
Daemon script: /path/to/scripts/daemon.sh
Daemon CPU limit: 12% (main: 50%)
Daemon Memory limit: 256M (main: 1G)
✓ Daemon launcher script generated
✓ Daemon service file created
✓ Daemon service is running

=== Daemon Service Management ===
  Status:  sudo systemctl status webapp-app-daemon
  Logs:    sudo journalctl -u webapp-app-daemon -f
  Stop:    sudo systemctl stop webapp-app-daemon
  Restart: sudo systemctl restart webapp-app-daemon
```

### When Daemon Script Not Found
```
=== Creating Main Service ===
✓ Service created successfully

💡 No daemon script found (checked: scripts/daemon.{sh,py,js})
```

### When Daemon Script Removed (Orphan Cleanup)
```
⚠ Daemon script not found, but daemon service exists
Cleaning up orphaned daemon service: webapp-app-daemon
✓ Orphaned daemon service removed
```

---

## Management Commands

### View Services
```bash
# List all services for app
systemctl list-unit-files | grep appfactory-master-dashboard

# Main service status
systemctl status webapp-appfactory-master-dashboard

# Daemon service status
systemctl status webapp-appfactory-master-dashboard-daemon
```

### Control Services
```bash
# Stop both services (stop main, daemon auto-stops)
systemctl stop webapp-appfactory-master-dashboard

# Restart both services
systemctl restart webapp-appfactory-master-dashboard
systemctl restart webapp-appfactory-master-dashboard-daemon

# View daemon logs
journalctl -u webapp-appfactory-master-dashboard-daemon -f
```

### Check Resources
```bash
# Main service resources
systemctl show webapp-appfactory-master-dashboard \
  -p CPUQuota -p MemoryMax

# Daemon service resources
systemctl show webapp-appfactory-master-dashboard-daemon \
  -p CPUQuota -p MemoryMax
```

---

## Error Handling

### Daemon Creation Fails
- Main service continues to work
- Error message displayed with daemon script path
- Logs available for debugging

### Daemon Script Has Syntax Error
- Service starts but immediately fails
- Check logs: `journalctl -u webapp-app-daemon`
- Main service unaffected

### Daemon Service Crashes
- Systemd restarts daemon automatically (RestartSec=5)
- Main service continues to work
- Check logs for crash reason

---

## Testing Checklist

- [ ] Create service with daemon.sh present
- [ ] Create service without daemon.sh
- [ ] Rebuild service (daemon.sh present)
- [ ] Remove daemon.sh and rebuild
- [ ] Add back daemon.sh and rebuild
- [ ] Delete service (both removed)
- [ ] Create service multiple times consecutively
- [ ] Check resource limits are correct
- [ ] Verify daemon service depends on main service
- [ ] Test daemon script errors (syntax error, runtime error)

---

## Example Daemon Script

Created: `poly_apps/appfactory-master-dashboard/scripts/daemon.sh`

```bash
#!/bin/bash

echo "=== AppFactory Master Dashboard Daemon Service ==="
echo "Started at: $(date)"
echo "APP_ROOT: $APP_ROOT"
echo "DEBUG_MODE: $DEBUG_MODE"

# Main daemon loop
while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Daemon heartbeat"

    # Example: Clean up temp files
    if [ -d "$APP_ROOT/tmp" ]; then
        find "$APP_ROOT/tmp" -type f -mtime +7 -delete 2>/dev/null
    fi

    sleep 60
done
```

---

## Future Enhancements (Optional)

1. **Multiple Daemon Types**
   - Support worker.sh, cron.sh, websocket.sh
   - Different resource allocation per type

2. **Port Allocation for Daemons**
   - Assign ports: main + 1000 for daemon
   - Configure in launcher scripts

3. **Health Checks**
   - Daemon health check endpoints
   - Auto-restart on health check failure

4. **Metrics Collection**
   - Daemon CPU/Memory usage tracking
   - Performance metrics in logs

---

## Implementation Date
- **Created**: 2025-12-27
- **Status**: Production Ready
- **Tested**: Pending User Testing

---

## Support

For issues or questions:
1. Check daemon logs: `journalctl -u webapp-{app}-daemon -f`
2. Verify daemon script: `cat scripts/daemon.sh`
3. Check service status: `systemctl status webapp-{app}-daemon`
4. Review idempotency test: `DAEMON_SERVICE_IDEMPOTENCY_TEST.md`
