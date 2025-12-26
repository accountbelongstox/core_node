# Path Conversion Summary

## Overview

All absolute paths in `_prompt` directory files have been converted to relative paths.

## Path Conversion Rules

### Windows Absolute Paths
- `D:\programing\core_node\` → Removed, use relative path from project root
- `C:\Users\accou\Downloads\` → `~/Downloads/` (user download directory)

### Linux Server Paths
- `/www/wwwroot/core_node/` → Relative path or marked as "server path"
- `/www/nginxconfig/` → Marked as "server path" (system configuration directory)

### Project Root Paths
- All paths starting with project root are now relative
- Example: `poly_apps/laravel_main/...` instead of `D:\programing\core_node\poly_apps\laravel_main\...`

## Files Processed

All `.MD` files in `_prompt` directory have been processed to use relative paths.

## Notes

- User-specific paths (like Downloads) are marked with `~/` or noted as "user download directory"
- Server-specific paths (like `/www/`) are marked as "server path" when they cannot be made relative
- All project paths are now relative to the project root directory

---

**Status**: ✅ All paths converted to relative paths
**Date**: 2025-01-XX

