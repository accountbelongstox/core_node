# Device Sync - Conflict Detection

## Overview

Conflict detection prevents data corruption when multiple primary devices are detected on the same network. When a conflict is detected, secondary devices automatically stop syncing and display warnings.

## How It Works

### 1. Network Discovery with Conflict Detection

The discovery module (`discovery.py`) scans the network for primary devices:

```python
def find_primary_device(self, use_cache: bool = True) -> Optional[Dict]:
    # Scan network for primary devices
    devices = self._scan_network(network)

    if len(devices) > 1:
        # CONFLICT: Multiple primary devices found
        primary = devices[0]
        primary['conflict'] = True
        primary['conflict_count'] = len(devices)
        primary['conflict_hosts'] = [d['host'] for d in devices]
        return primary
```

### 2. Automatic Sync Stopping

Secondary devices check for conflicts before each sync operation (`sync_client.py`):

```python
def sync_now(self) -> bool:
    # Check for conflicts before syncing
    if self._check_for_conflicts():
        print("[SyncClient] CONFLICT DETECTED")
        print("[SyncClient] Force stopping sync")

        # Auto-disable sync
        self.disable_sync()

        # Trigger callback
        if self.on_conflict_detected:
            self.on_conflict_detected(self.conflict_info)

        return False
```

### 3. Tray Menu Warning Display

The tray menu (`tray_menu.py`) displays prominent warnings when conflicts are detected:

**Tray Menu Display:**
```
⚠ CONFLICT: 3 Primary Devices!
Sync DISABLED - Data Corruption Risk
--------------------------------
Device Sync - SECONDARY (Sync: OFF)
```

**Notification:**
```
Device Sync - CONFLICT DETECTED

Multiple primary devices found: 3

Sync has been DISABLED to prevent data corruption

Hosts: 192.168.1.100, 192.168.1.101, 192.168.1.102
```

## Launcher Menu Options

The launcher (`launcher.py`) provides three startup options:

```
Options:
  [1] - Launch Window Layout Only
  [2] - Launch Device Sync Only
  [3] - Launch Both (Window Layout + Device Sync)
  [M] - Configuration Menu
  [Enter] - Default (Launch Both)
```

- **Option 1**: Start only the window layout system (no Device Sync)
- **Option 2**: Start only Device Sync tray menu (primary/secondary mode selected via tray)
- **Option 3**: Start both window layout and Device Sync (default)

## Conflict Resolution

When a conflict is detected:

1. **Secondary Device Behavior:**
   - Sync is automatically disabled
   - Tray menu shows warning at top
   - System notification alerts user
   - Status window displays conflict details

2. **To Resolve:**
   - Identify which device should be the primary
   - Stop Device Sync on all other devices
   - Keep only ONE primary device running
   - Re-enable sync on secondary devices via tray menu

## Technical Details

### Conflict Detection Flow

```
Secondary Device Sync Loop (every 5 seconds)
    ↓
Check for conflicts via network scan
    ↓
Multiple primary devices found?
    ↓ YES
Disable sync immediately
    ↓
Update tray menu with warning
    ↓
Show notification to user
    ↓
Stop syncing (prevent data corruption)
```

### Data Structures

**Conflict Info Dictionary:**
```python
{
    'count': 3,                                    # Number of primary devices
    'hosts': ['192.168.1.100', '192.168.1.101', '192.168.1.102'],
    'detected_at': 1699123456.789                  # Timestamp
}
```

**Sync Stats (with conflict info):**
```python
{
    'enabled': False,
    'running': True,
    'primary_host': '192.168.1.100',
    'last_sync': 1699123456.789,
    'total_synced': 150,
    'total_downloaded_mb': 25.3,
    'conflict_detected': True,
    'conflict_info': { ... }
}
```

## Files Modified

1. **`discovery.py`** - Added conflict detection in network scan
2. **`sync_client.py`** - Added conflict checking before sync
3. **`tray_menu.py`** - Added conflict warning display
4. **`launcher.py`** - Added 3-option menu (already completed)

## Usage Example

### Starting Device Sync

```bash
# Windows
python -m pycore.pyutils.launcher.launcher

# Select option:
# [2] - Launch Device Sync Only

# Tray icon appears
# Right-click tray icon -> Set as Secondary Device
# Sync starts (if no conflicts)
```

### When Conflict Detected

```
Console Output:
[SyncClient] CONFLICT DETECTED: Multiple primary devices on network
[SyncClient] Force stopping sync to prevent data corruption
[TrayMenu] CONFLICT: 3 primary devices detected
[TrayMenu] Conflicting hosts: 192.168.1.100, 192.168.1.101, 192.168.1.102

System Notification:
"Device Sync - CONFLICT DETECTED
Multiple primary devices found: 3
Sync has been DISABLED to prevent data corruption
Hosts: 192.168.1.100, 192.168.1.101, 192.168.1.102"

Tray Menu:
⚠ CONFLICT: 3 Primary Devices!
Sync DISABLED - Data Corruption Risk
```

## Safety Features

1. **Automatic Sync Disable**: Sync stops immediately when conflict detected
2. **Persistent Warning**: Tray menu shows warning until conflict resolved
3. **Status Window Alert**: Detailed conflict info in status display
4. **Console Logging**: All conflict events logged to console
5. **Prevention First**: Sync disabled BEFORE any file operations

## Best Practices

1. **Single Primary**: Always run only ONE primary device per network
2. **Monitor Tray**: Check tray menu for warnings regularly
3. **Resolve Quickly**: Fix conflicts immediately when detected
4. **Use Status Window**: Check "Show Status" for detailed conflict info
5. **Clean Shutdown**: Properly stop Device Sync when switching primary

## Troubleshooting

**Q: Sync keeps getting disabled**
A: Multiple primary devices detected. Stop Device Sync on all but one device.

**Q: How to check which devices are primary?**
A: Check conflict info in status window - lists all conflicting host IPs.

**Q: Can I force sync even with conflict?**
A: No - sync is force-disabled to prevent data corruption. Resolve conflict first.

**Q: Conflict detected but only one primary running**
A: Check for orphaned Device Sync processes. Use stop scripts to clean up.

## Related Documentation

- `BACKGROUND_MODE.md` - Background process mode
- `README.md` - Device Sync overview
- `launcher.py` - Launcher menu options
