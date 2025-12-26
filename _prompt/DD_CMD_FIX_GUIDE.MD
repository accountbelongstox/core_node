# DD.CMD Fix Guide

## Overview

Check in `dd.cmd`'s download chain, whether `SecretDecryptionCheck.ps1` script download was not added, or this script was killed by antivirus software.

## Variable Storage

All variables stored in:
- **Windows**: User home directory `~/.core_node/.build_global_vars` (e.g., `C:\Users\username\.core_node\.build_global_vars`)
- **Linux**: `/var/_core_node/_build_global_vars/`

**Format**: No folders and subdirectories, `key=filename`, `val=content`.

## Git Management

In `dd.sh` and `dd.ps1`'s Git Management, all use Python to organize commands. Of course, finally need to return to shell for execution. Now Windows/Linux both only use entry as call to Python, final commands will go to shell for execution.

**Note**: Do not use exit codes, return value detection for anything, but use file variables. All variables stored in:
- **Windows**: User home directory `~/.core_node/.build_global_vars` (e.g., `C:\Users\username\.core_node\.build_global_vars`)
- **Linux**: `/var/_core_node/_build_global_vars/`

**Format**: No folders and subdirectories, `key=filename`, `val=content`.

