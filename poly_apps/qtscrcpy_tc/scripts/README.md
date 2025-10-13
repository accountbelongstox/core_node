# QtScrcpy_tc Build Scripts

This directory contains the build scripts for the QtScrcpy_tc project.

## Directory Structure

```
qtscrcpy_tc/
├── build.bat              # Main launcher script (project root)
├── scripts/
│   ├── build.ps1          # PowerShell build script
│   ├── build.bat          # Batch wrapper for PowerShell script
│   └── README.md          # This file
├── TcUi/                  # Qt project files
└── output_YYYYMMDD_HHMMSS/ # Build output directories
```

## Usage

### From Project Root (Recommended)

```bash
# Basic build
.\build.bat

# Debug build
.\build.bat -BuildType Debug

# Clean build with specific architecture
.\build.bat -Clean -Architecture x64

# Build with custom Qt path
.\build.bat -QtPath "D:\Qt\6.9.3"

# Build and create distribution package
.\build.bat -Publish
```

### From Scripts Directory

```bash
cd scripts

# Using batch wrapper
.\build.bat -BuildType Release

# Using PowerShell directly
powershell -ExecutionPolicy Bypass -File build.ps1 -Clean
```

## Script Details

### build.bat (Project Root)
- Main launcher script
- Changes to project root directory
- Calls scripts/build.bat with all arguments

### scripts/build.bat
- Batch wrapper for PowerShell script
- Provides error handling and user-friendly output
- Calls scripts/build.ps1 with proper PowerShell execution

### scripts/build.ps1
- Main PowerShell build script
- Handles Qt detection, Visual Studio setup, and compilation
- Uses data exchange directory for variable sharing
- Creates timestamped output directories

## Data Exchange Directory

The build scripts use a data exchange directory for sharing variables between PowerShell and batch processes:

```
C:\Users\[用户名]\.core_node\qt_scrcpy\
├── build_vars\           # Build variables
├── build_logs\           # Build logs
└── build_temp\           # Temporary build files
```

## Build Output

Build outputs are created in timestamped directories to avoid conflicts:

```
output_YYYYMMDD_HHMMSS/
└── win/
    └── x64/
        └── release/
            ├── TcUi.exe
            ├── Qt6*.dll
            └── [other dependencies]
```

## Requirements

- Windows 10/11
- PowerShell 5.1 or later
- Qt 6.9.3 or later
- Visual Studio 2022 (recommended) or MinGW
- Git (for version control)

## Troubleshooting

### PowerShell Execution Policy
If you get execution policy errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Qt Not Found
Ensure Qt is installed in one of these locations:
- `D:\.dev_win11\Qt\6.9.3\` (auto-detected)
- `C:\Qt\6.9.3\`
- `D:\Qt\6.9.3\`
- Or specify with `-QtPath` parameter

### Visual Studio Not Found
Install Visual Studio 2022 Community with C++ development tools, or use MinGW build.

### Build Failures
Check the build logs in:
```
C:\Users\[用户名]\.core_node\qt_scrcpy\build_logs\
```
