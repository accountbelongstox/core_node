# Daemon Service Idempotency Test Report

## Test Scenarios

### Scenario 1: Initial Service Creation
**Steps:**
1. Run: Create service (C)
2. daemon.sh exists

**Expected Result:**
- ✓ Main service created: webapp-appfactory-master-dashboard
- ✓ Daemon service created: webapp-appfactory-master-dashboard-daemon
- ✓ Both services running

**Resource Allocation:**
- Main: CPU 50%, Memory 1G
- Daemon: CPU 12% (50%/4), Memory 256M (1G/4)

---

### Scenario 2: Rebuild Service (daemon.sh exists)
**Steps:**
1. Run: Create service (C) again
2. daemon.sh still exists

**Expected Result:**
- ✓ Main service replaced (stopped, removed, recreated)
- ✓ Daemon service detected as existing
- ✓ Old daemon service cleaned up
- ✓ New daemon service created
- ✓ Both services running with updated configuration

**Idempotent Behavior:**
- Service files refreshed
- Resource limits updated
- Launcher scripts regenerated
- No orphaned services left

---

### Scenario 3: Rebuild Service (daemon.sh removed)
**Steps:**
1. Delete: rm scripts/daemon.sh
2. Run: Create service (C)

**Expected Result:**
- ✓ Main service created/updated
- ✓ Orphaned daemon service detected
- ✓ Old daemon service cleaned up
- ✓ No new daemon service created
- ✓ Message: "💡 No daemon script found"

**Cleanup Behavior:**
- Orphaned daemon service removed
- No stale services remain

---

### Scenario 4: Rebuild Service (daemon.sh re-added)
**Steps:**
1. Add back: scripts/daemon.sh
2. Run: Create service (C)

**Expected Result:**
- ✓ Main service updated
- ✓ Daemon service created again
- ✓ Both services running

**Recovery Behavior:**
- Daemon service automatically recreated when script exists

---

### Scenario 5: Delete Services (D)
**Steps:**
1. Run: Delete systemd service (D)

**Expected Result:**
- ✓ Daemon service deleted first
- ✓ Main service deleted second
- ✓ Both service files removed
- ✓ Systemd daemon reloaded
- ✓ Message: "Total services deleted: 2"

**Cleanup Order:**
1. Stop daemon service
2. Disable daemon service
3. Remove daemon service file
4. Stop main service
5. Disable main service
6. Remove main service file
7. Reload systemd

---

### Scenario 6: Multiple Consecutive Rebuilds
**Steps:**
1. Run: Create service (C)
2. Run: Create service (C)
3. Run: Create service (C)

**Expected Result:**
- ✓ Each rebuild cleans up old services
- ✓ No duplicate services
- ✓ No orphaned processes
- ✓ Resource limits consistent

**Stability:**
- System remains stable
- No resource leaks
- Services always in consistent state

---

## Verification Commands

### Check Services Status
```bash
# List all services for app
systemctl list-unit-files | grep appfactory-master-dashboard

# Check main service
systemctl status webapp-appfactory-master-dashboard

# Check daemon service
systemctl status webapp-appfactory-master-dashboard-daemon

# Check resource limits
systemctl show webapp-appfactory-master-dashboard -p CPUQuota -p MemoryMax
systemctl show webapp-appfactory-master-dashboard-daemon -p CPUQuota -p MemoryMax
```

### Check Daemon Logs
```bash
# Real-time daemon logs
journalctl -u webapp-appfactory-master-dashboard-daemon -f

# Recent daemon logs
journalctl -u webapp-appfactory-master-dashboard-daemon --since "5 minutes ago"
```

### Check Service Files
```bash
# List service files
ls -la /etc/systemd/system/webapp-appfactory-master-dashboard*

# Check daemon service configuration
cat /etc/systemd/system/webapp-appfactory-master-dashboard-daemon.service
```

### Check Launcher Scripts
```bash
# List launcher scripts
ls -la /var/_core_node/unified_manager/temp_scripts/webapp-appfactory-master-dashboard*

# Check daemon launcher
cat /var/_core_node/unified_manager/temp_scripts/webapp-appfactory-master-dashboard-daemon.sh
```

---

## Idempotency Guarantees

### ✅ Safe to Run Multiple Times
- Creating service multiple times is safe
- Each run cleanly rebuilds services
- No duplicate services created
- No orphaned processes left

### ✅ Automatic Cleanup
- Orphaned daemon services are removed
- Stale launcher scripts are replaced
- Old service files are cleaned up
- Systemd is always reloaded

### ✅ Consistent State
- Services are always in expected state
- Resource limits are always correct
- Dependencies are always properly set
- Logs are always accessible

### ✅ Error Recovery
- Failed daemon creation doesn't affect main service
- Daemon script errors are logged
- Main service continues to work if daemon fails
- Clear error messages for troubleshooting

---

## Resource Calculation Formula

```
Main Service:
  CPU: 50%
  Memory: 1G

Daemon Service:
  CPU: main_cpu / 4 = 50% / 4 = 12.5% (min: 10%)
  Memory: main_memory / 4 = 1024M / 4 = 256M (min: 128M)
```

### Examples:
| Main CPU | Main Memory | Daemon CPU | Daemon Memory |
|----------|-------------|------------|---------------|
| 50%      | 1G          | 12%        | 256M          |
| 80%      | 2G          | 20%        | 512M          |
| 40%      | 500M        | 10%        | 128M          |
| 100%     | 4G          | 25%        | 1G            |

---

## Success Criteria

✅ **All scenarios pass**
✅ **No orphaned services after any operation**
✅ **Resource limits correctly calculated**
✅ **Service dependencies properly set**
✅ **Logs accessible and meaningful**
✅ **Error messages clear and actionable**

---

## Test Date
- Implemented: 2025-12-27
- Status: Ready for Testing
- Tested by: [Pending]
