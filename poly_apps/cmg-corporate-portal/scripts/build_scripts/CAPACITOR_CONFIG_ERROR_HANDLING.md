# Capacitor Initialization Error Handling

## Issue

When running `npx cap init`, you may encounter this error:

```
[error] Cannot run init for a project using a non-JSON configuration file.
        Delete capacitor.config.ts and try again.
```

This happens when:
- A previous Capacitor configuration exists (capacitor.config.ts or capacitor.config.js)
- Capacitor requires a JSON configuration for the init command
- TypeScript/JavaScript configs need to be removed first

## Solution

The build system now **automatically detects** this error and provides an interactive solution.

## Automatic Error Handling

When the error is detected, the system will:

1. **Detect the error** from Capacitor's output
2. **Find existing config files** (capacitor.config.ts, capacitor.config.js)
3. **Prompt the user** with a Y/n question
4. **Backup the files** before deletion
5. **Retry initialization** automatically if confirmed

## User Experience

### Windows (PowerShell)

```powershell
--------------------------------------------
Initializing Capacitor
--------------------------------------------
[Config] App Name: CMG-Shooting&Hotel
[Config] Package ID: com.ddsj.cmg.club
[Capacitor] Running: npx cap init "CMG-Shooting&Hotel" "com.ddsj.cmg.club"
[ERROR] Capacitor initialization failed
[error] Cannot run init for a project using a non-JSON configuration file.
        Delete capacitor.config.ts and try again.

[Warning] Found existing Capacitor configuration file(s)
[Info] Found: capacitor.config.ts

Capacitor requires a JSON configuration file for initialization.
The existing TypeScript/JavaScript config will be removed.

Delete config file(s) and reinitialize? [Y/n]: Y

[Action] Removing existing configuration files...
[Backup] Created backup: capacitor.config.ts.backup
[Removed] Deleted: capacitor.config.ts

[Capacitor] Retrying initialization...
[Success] Capacitor initialized successfully
```

### Linux (Bash)

```bash
--------------------------------------------
Initializing Capacitor
--------------------------------------------
[Config] App Name: CMG-Shooting&Hotel
[Config] Package ID: com.ddsj.cmg.club
[Capacitor] Running: npx cap init "CMG-Shooting&Hotel" "com.ddsj.cmg.club"
[ERROR] Capacitor initialization failed
[error] Cannot run init for a project using a non-JSON configuration file.
        Delete capacitor.config.ts and try again.

[Warning] Found existing Capacitor configuration file(s)
[Info] Found: capacitor.config.ts

Capacitor requires a JSON configuration file for initialization.
The existing TypeScript/JavaScript config will be removed.

Delete config file(s) and reinitialize? [Y/n]: Y

[Action] Removing existing configuration files...
[Backup] Created backup: capacitor.config.ts.backup
[Removed] Deleted: capacitor.config.ts

[Capacitor] Retrying initialization...
[Success] Capacitor initialized successfully
```

## User Options

### Option 1: Accept (Y or Enter)

**What happens:**
1. System creates backup files (e.g., `capacitor.config.ts.backup`)
2. Original config files are deleted
3. Capacitor initialization is retried automatically
4. If successful, proceeds with installation
5. If failed, shows error message

**When to use:**
- You want to reinitialize Capacitor with new settings
- You don't need the old config file
- This is a fresh setup

### Option 2: Decline (N)

**What happens:**
1. Capacitor initialization is skipped
2. Manual intervention required
3. User can fix the issue manually

**When to use:**
- You want to keep the existing config
- You need to review the config file first
- You want to manually merge configurations

## Backup System

### Automatic Backups

Before deleting any file, the system creates a backup:

```
Original:           capacitor.config.ts
Backup:            capacitor.config.ts.backup
```

### Restore from Backup

If you need to restore the original file:

**Windows:**
```powershell
Copy-Item capacitor.config.ts.backup capacitor.config.ts
```

**Linux:**
```bash
cp capacitor.config.ts.backup capacitor.config.ts
```

## Manual Resolution

If you choose "N" or want to handle it manually:

### Method 1: Delete the Config File

```bash
# Windows
del capacitor.config.ts

# Linux
rm capacitor.config.ts
```

Then run the build script again.

### Method 2: Convert to JSON

Create `capacitor.config.json` manually:

```json
{
  "appId": "com.ddsj.cmg.club",
  "appName": "CMG-Shooting&Hotel",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  }
}
```

Then delete the TypeScript config.

### Method 3: Use Existing Config

If you want to keep the existing config, skip the initialization step and proceed with adding the Android platform directly:

```bash
npx cap add android
```

## Technical Details

### Files Checked

The system checks for:
- `capacitor.config.ts` (TypeScript config)
- `capacitor.config.js` (JavaScript config)

### Error Detection

Detects these error messages:
- "non-JSON configuration file"
- "capacitor.config.ts"

### Implementation

**Windows:** `execute_commands_windows.ps1` → `Initialize-Capacitor` function

**Linux:** `execute_commands_linux.sh` → `initialize_capacitor` function

Both implementations:
1. Capture command output
2. Check exit code
3. Parse error messages
4. Check for config files
5. Prompt user
6. Backup and delete if confirmed
7. Retry initialization

## Troubleshooting

### Backup File Already Exists

If `.backup` file already exists, the backup will overwrite it.

**Solution:** Rename existing backup first if you need to keep it.

### Initialization Fails After Retry

If initialization fails even after deleting config files:

1. Check that files were actually deleted
2. Verify Capacitor CLI is installed: `npx cap --version`
3. Check for permission issues
4. Try manual initialization: `npx cap init "AppName" "com.package.id"`

### Permission Denied

If you get permission errors:

**Windows:** Run PowerShell as Administrator

**Linux:** Check file permissions
```bash
ls -la capacitor.config.*
```

### Want to Keep Old Config

If you accidentally deleted and want to restore:

1. Use the backup file created: `capacitor.config.ts.backup`
2. Copy it back to original name
3. Manually merge with new JSON config if needed

## Best Practices

1. **Let the system handle it** - The automatic process is safe with backups
2. **Review backups** - Check `.backup` files if you need the old config
3. **Choose JSON** - Going forward, use JSON config for better compatibility
4. **Don't panic** - All deletions are backed up first

## Example Flow

```
User runs: Install Capacitor
  ↓
System installs packages
  ↓
System runs: npx cap init
  ↓
Error detected: non-JSON config exists
  ↓
System prompts: Delete config file(s)? [Y/n]
  ↓
User presses: Y (or Enter)
  ↓
System: Creates capacitor.config.ts.backup
System: Deletes capacitor.config.ts
System: Retries npx cap init
  ↓
Success: Capacitor initialized
  ↓
Continue with: Add Android platform
```

## Related Files

- `scripts/build_scripts/execute_commands_windows.ps1` - Windows implementation
- `scripts/build_scripts/execute_commands_linux.sh` - Linux implementation
- `scripts/build_scripts/main_controller.py` - Prepares the init command

## Summary

✅ **Automatic detection** of config file conflicts

✅ **User confirmation** before making changes

✅ **Automatic backup** before deletion

✅ **Automatic retry** after fixing

✅ **Clear messaging** at each step

✅ **Cross-platform** support (Windows & Linux)

The system handles this common error gracefully, making the installation process smoother and safer!
