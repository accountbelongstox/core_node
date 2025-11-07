# pyMatrix Initialization Guide

## Overview

pyMatrix has been upgraded to **scrcpy v3.3.3**, matching the version in `scrcpy_source` for full compatibility.

The new `init.py` script automatically downloads and configures all required dependencies.

## Version Information

| Component | Version | Location |
|-----------|---------|----------|
| **scrcpy-server** | 3.3.3 | `poly_apps/pyMatrix/resources/scrcpy-server.jar` |
| **ADB Platform Tools** | 36.0.0 | `poly_apps/pyMatrix/resources/adb/{platform}/` |
| **Protocol** | v3.3.3 | Matches `scrcpy_source` exactly |

## Quick Start

### 1. Initialize Dependencies

Run the initialization script to download all dependencies:

```bash
# Download all dependencies (ADB + scrcpy-server)
python poly_apps/pyMatrix/init.py

# Or use force download to re-download
python poly_apps/pyMatrix/init.py --force

# Download only ADB
python poly_apps/pyMatrix/init.py --adb-only

# Download only scrcpy-server
python poly_apps/pyMatrix/init.py --server-only
```

### 2. Verify Installation

Test that all versions are consistent:

```bash
python poly_apps/pyMatrix/test_init.py
```

Expected output:
```
[PASS] Configuration test passed
[PASS] All versions consistent: 3.3.3
[PASS] All tests passed!
```

### 3. Start pyMatrix

```bash
python poly_apps/pyMatrix/main.py
```

## What Gets Downloaded

### 1. scrcpy-server v3.3.3

- **Source**: GitHub Releases
- **URL**: https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-server-v3.3.3
- **Size**: ~72 KB
- **Location**: `resources/scrcpy-server.jar`
- **Purpose**: Android screen mirroring service

### 2. ADB Platform Tools v36.0.0

Platform-specific download:

| Platform | Files Downloaded |
|----------|-----------------|
| **Windows** | `adb.exe`, `AdbWinApi.dll`, `AdbWinUsbApi.dll` |
| **Linux** | `adb` (executable) |
| **macOS** | `adb` (executable) |

- **Source**: Google Android Developer Tools
- **Location**: `resources/adb/{platform}/`
- **Purpose**: Android device communication

## Architecture Changes

### Version Consistency

All components now use **v3.3.3**:

```python
# config.py
SCRCPY_SERVER_VERSION = "3.3.3"

# init.py
SCRCPY_VERSION = "3.3.3"

# scrcpy_device.py (command format)
"3.3.3",  # Version arg[0]
```

### Parameter Format (v3.3.3)

Server command now matches scrcpy_source exactly:

```python
# Old format (v2.1)
[
    "2.1",
    f"video_bit_rate={bit_rate}",
    f"max_size={max_size}",
]

# New format (v3.3.3) - matches Options.java
[
    "3.3.3",                              # Version (args[0])
    "video=true",                         # Enable video
    f"video_bit_rate={bit_rate}",        # key=value format
    f"max_size={max_size}",              # key=value format
    f"max_fps={max_fps}",                # key=value format
    f"video_codec={codec}",              # h264, h265, av1
    "audio=false",                        # Disable audio
    f"control={control}",                # Enable control
    "tunnel_forward=true",                # Use port forwarding
    "cleanup=true",                       # Cleanup on exit
    "power_on=true",                      # Power on device
    "clipboard_autosync=true",            # Sync clipboard
    "downsize_on_error=true",             # Auto downsize on error
]
```

Reference: `scrcpy_source/server/src/main/java/com/genymobile/scrcpy/Options.java`

## Dependency Management

### SHA256 Verification

ADB downloads are verified with SHA256 checksums:

```python
ADB_CHECKSUMS = {
    "Windows": "12c2841f354e92a0eb2fd7bf6f0f9bf8538abce7bd6b060ac8349d6f6a61107c",
    # More checksums from scrcpy_source/app/deps/adb_*.sh
}
```

### Auto-Retry

If checksum verification fails, the script automatically re-downloads.

### Progress Tracking

```
============================================================
Downloading ADB platform-tools v36.0.0 (Windows)
============================================================
URL: https://dl.google.com/android/repository/...
Destination: D:\...\resources\platform-tools_r36.0.0-windows.zip
Downloading...
[██████████████████████████████████████████████████] 100.0%
[OK] Download complete
   Size: 12.34 MB
Verifying checksum...
[OK] Checksum verified
```

## Troubleshooting

### Version Mismatch Error

```
[FAIL] Version mismatch!
   Config: 2.1
   Init: 3.3.3
```

**Solution**: Re-run initialization
```bash
python poly_apps/pyMatrix/init.py --force
```

### Download Failed

```
[ERROR] Download failed: HTTPError 404
```

**Solution**: Check internet connection or download manually:
1. Visit https://github.com/Genymobile/scrcpy/releases/tag/v3.3.3
2. Download `scrcpy-server-v3.3.3`
3. Rename to `scrcpy-server.jar`
4. Place in `poly_apps/pyMatrix/resources/`

### ADB Not Found

```
[ERROR] ADB not found
```

**Solution**: Run ADB download
```bash
python poly_apps/pyMatrix/init.py --adb-only --force
```

## Advanced Usage

### Custom ADB Path

If you already have ADB installed, pyMatrix will use it automatically:

1. System PATH (highest priority)
2. Local resources directory
3. Fallback to "adb" command

### Force Re-download

```bash
# Force re-download all dependencies
python poly_apps/pyMatrix/init.py --force

# Force re-download only specific component
python poly_apps/pyMatrix/init.py --server-only --force
```

### Offline Installation

1. Download dependencies on a machine with internet
2. Copy `resources/` directory to target machine
3. Run verification:
   ```bash
   python poly_apps/pyMatrix/test_init.py
   ```

## File Structure

```
poly_apps/pyMatrix/
├── init.py                          # NEW: Initialization script
├── test_init.py                     # NEW: Verification script
├── download_scrcpy_server.py        # UPDATED: v3.3.3
├── config.py                        # UPDATED: Version 3.3.3
└── resources/
    ├── scrcpy-server.jar           # v3.3.3 (72 KB)
    └── adb/
        ├── windows/
        │   ├── adb.exe
        │   ├── AdbWinApi.dll
        │   └── AdbWinUsbApi.dll
        ├── linux/
        │   └── adb
        └── macos/
            └── adb

pycore/pyfoundations/device/
└── scrcpy_device.py                # UPDATED: v3.3.3 parameters
```

## Compatibility Matrix

| pyMatrix | scrcpy_source | scrcpy-server | ADB | Status |
|----------|---------------|---------------|-----|--------|
| Current | v3.3.3 | v3.3.3 | v36.0.0 | ✅ Fully Compatible |
| Previous | v3.3.3 | v2.1 | Manual | ⚠️ Version Mismatch |

## Next Steps

After successful initialization:

1. **Connect Device**
   ```bash
   # Enable USB debugging on Android device
   # Connect via USB
   adb devices
   ```

2. **Start pyMatrix**
   ```bash
   python poly_apps/pyMatrix/main.py
   ```

3. **Access Web UI**
   ```
   http://localhost:3007/pymatrix
   ```

## References

- **scrcpy Official**: https://github.com/Genymobile/scrcpy
- **scrcpy_source Location**: `D:\programing\core_node\poly_apps\scrcpy_source`
- **Options.java**: `scrcpy_source/server/src/main/java/com/genymobile/scrcpy/Options.java`
- **ADB Downloads**: https://developer.android.com/studio/releases/platform-tools

## Support

For issues or questions:
1. Run verification: `python poly_apps/pyMatrix/test_init.py`
2. Check logs in console output
3. Verify versions match in all components
