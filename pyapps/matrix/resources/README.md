# Matrix Resources

This directory contains the scrcpy package for automatic extraction.

## Scrcpy Package

The `scrcpy-win64-v3.3.3.pyp` file is a renamed ZIP archive containing scrcpy and adb tools.

### Why .pyp extension?

- `.pyp` (Python Package) extension distinguishes it as a bundled package
- The file is automatically extracted to user data directory on first use
- Provides bundled tools for immediate use without manual installation

### User Data Directory Locations

- **Windows**: `C:\Users\<username>\.core_node\scrcpy`
- **Linux**: `/var/_core_node/scrcpy` (fallback: `~/.core_node/scrcpy`)
- **macOS**: `~/.core_node/scrcpy`

### How It Works

1. On first run, `Config.get_adb_path()` calls `scrcpy_init.py`
2. The initializer checks if scrcpy is already extracted
3. If not, it automatically extracts `scrcpy-win64-v3.3.3.pyp` to the user data directory
4. Returns absolute path to `adb.exe` (or `adb` on Linux/macOS)

### Files Included in Package

- `adb.exe` - Android Debug Bridge
- `scrcpy.exe` - Screen copy utility
- `scrcpy-server.jar` - Server component (copied separately)
- Supporting DLL files and libraries

## Manual Installation

If you need to manually install the package:

```bash
# Extract to user data directory
python pycore/pyutils/scrcpy_init.py
```

### Download Link

If the `.pyp` package is not available in the repository:

**Official Download**:
- https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-win64-v3.3.3.zip

**Steps**:
1. Download the ZIP file from the link above
2. Rename `scrcpy-win64-v3.3.3.zip` to `scrcpy-win64-v3.3.3.pyp`
3. Place it in `pyapps/matrix/resources/`
4. Run Matrix to auto-extract

## Updating Scrcpy

To update to a new version:

1. Download new scrcpy release
2. Rename ZIP to `.pyp` extension
3. Replace `scrcpy-win64-v*.pyp` in this directory
4. Update version in `scrcpy_init.py` glob pattern if needed
5. Delete user data directory to force re-extraction

## See Also

- `pycore/pyutils/scrcpy_init.py` - Initialization module
- `pyapps/matrix/matrix_config/config.py` - Config with ADB path logic
- `pyapps/matrix/docs/SCRCPY_INITIALIZATION.md` - Detailed documentation
