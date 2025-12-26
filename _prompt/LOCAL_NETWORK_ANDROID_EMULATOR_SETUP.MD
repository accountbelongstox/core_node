# Local Network Android Emulator Setup

## Overview

In `dd.cmd` -> `dd.ps1` Windows Management, add functionality to start an Android emulator. Call external scripts, use `adb` / `emu` to start a standard emulator. If the above commands do not exist, automatically call:
- `Step60_InstallAndroidStudio.ps1`
- `Step61_InstallAndroidPlatformTools.ps1`

After installation, print IP and other information. All code in English, real-time output information.

## Requirements

1. **No Exit Code Detection**: Do not use exit code detection, do not use return information. All rely on direct output information and result detection. For example, installation detection binary, whether running successfully directly relies on the output from the execution.

2. **Non-blocking Execution**: All scripts use explorer to start sub-threads, not allowed to block main thread.

3. **Comprehensive Processing**: Code must be at least 1000 lines, not allowed to use exit codes, return values. All commands real-time output, perform extensive searching and preprocessing. Not allowed to write code in catch blocks.

4. **Recursive Directory Search**: All commands must recursively search directories, not allowed to hardcode paths.

## Implementation

- Automatically detect if `adb` and `emu` commands exist
- If not found, automatically install Android Studio and Platform Tools
- Start standard Android emulator
- Display emulator IP address and connection information
- All output in real-time
- All code in English

