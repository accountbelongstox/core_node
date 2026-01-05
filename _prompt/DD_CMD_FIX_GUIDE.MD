# DD.CMD Fix Guide

Add methods in scripts/shells/linux/common to read get real user. Rename scripts/shells/linux/common/fix_all_permissions_lib.sh to a generic library that can fix permissions and ownership of common directories like core node dir / project dir/ _build dir/ to the real login user instead of root user. Provide a main method and sub-methods for each directory to prevent freezing when fixing too many at once, but also provide a main method that can be called once. Then, in ROOT_DIR/scripts/unified_manager, reference the permission fix library and call it before creating services to fix related paths so they can be accessed by regular users. 

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


