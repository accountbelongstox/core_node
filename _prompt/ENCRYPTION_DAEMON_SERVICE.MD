# Encryption Daemon Service

## Overview

This document describes the encryption daemon service that monitors a compilation directory, encrypts new files with a password, and stores them in a target directory.

## Directory Mapping

The compilation factory directory:
- **Windows**: Build temporary directory (e.g., `~/.build_dir/compile_factory` or project-relative build directory)
- **Linux**: Server deployment path `/www/_build_dir` (Note: `/www/` is not fixed, use path map mapping)

Find the path mapping method in:
```
GVAR_COMMON_PATH="$CORE_NODE_ROOT/scripts/shells/linux/common/gvar_common.sh"
map_web_path
```

## Implementation Steps

### 1. Daemon Script Setup

In `daemon.sh`, use relative path to import the above file and set the compilation directory.

### 2. Convert to daemon.js

Change `daemon` to `daemon.js` script that:
- Scans the compilation directory (note: mapped file path) every 1 second
- Checks if `/${appname}` directory exists
- Creates directory if it doesn't exist
- Corrects permissions using `get_real_user` method (find this method)
- Since the service runs under root, real-time permission correction is needed so regular users can access

### 3. File Encryption

If there are new files in the compilation directory (note: mapped file path)/${appname}:
- Call encryption method in `daemon.js`
- Encrypt to `poly_apps/appfactory-master-dashboard`
- Encryption process:
  - Encode a password in `daemon.js`
  - Perform operation between read file and password to get a new file
  - Generate `.en` encrypted file (all code in English)
  - File contains: `export xxx="encrypted compressed code"`
  - When other files reference this file, directly read the ciphertext
  - Use the same password to perform operation to get original binary

**Note**: Any password can produce a result through operation, even if it results in garbled text.

## Requirements

- All code must be in English
- Use path mapping instead of hardcoded paths
- Real-time permission correction for regular user access
- Automatic directory creation
- Continuous monitoring (1 second interval)

