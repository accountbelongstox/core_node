# Matrix Application - Migration to pymain.py Launcher

## Summary

The Matrix application has been migrated to use the standard `pymain.py` launcher system following pycore development standards.

## Changes Made

### 1. Created Standard Entry Point

**File**: `matrix_main.py`

- Created standard entry point following pycore conventions
- Implements `start()` and `main()` functions
- Uses absolute imports: `from pyapps.matrix.xxx`
- Integrates with pycore ColorPrint for logging
- Simplified application startup

### 2. Updated Import Paths

**Changed**: `poly_apps.pyMatrix` → `pyapps.matrix`

Modified files (16 total):
- All API route files (`api/`)
- All service files (`services/`)
- All middleware files (`middleware/`)
- Configuration files
- Test files

### 3. Updated Configuration

**File**: `config.py`

- Added English comments following pycore standards
- Removed dependency on non-existent `APP_NAME` from pygvar
- Changed environment variable from `PYMATRIX_MODE` to `MATRIX_MODE`
- Added `APP_NAME` constant directly in Config class

### 4. Maintained Backward Compatibility

**File**: `main.py` (kept for backward compatibility)

- Original entry point still available
- Import paths updated to use `pyapps.matrix`
- Can still be run directly: `python pyapps/matrix/main.py`

## New Usage

### Standard Method (Recommended)

```bash
# Basic launch
python pymain.py app=matrix

# With custom host and port
python pymain.py app=matrix --host=0.0.0.0 --port=8000

# Development mode with auto-reload
python pymain.py app=matrix --reload

# Show help
python pymain.py app=matrix --help
```

### Direct Method (Still Available)

```bash
# Using Python module
python -m pyapps.matrix.matrix_main

# Using direct path
python pyapps/matrix/main.py
```

### Fuzzy Matching

The launcher supports fuzzy matching:

```bash
python pymain.py app=mat     # Matches "matrix"
python pymain.py app=matr    # Matches "matrix"
```

## Architecture Compliance

The application now follows pycore standards:

1. **Entry Point**: `{appname}_main.py` with `start()` or `main()` function
2. **Import Style**: Absolute imports from `pyapps.matrix`
3. **Configuration**: Centralized in `config.py`
4. **Logging**: Uses pycore ColorPrint instead of print statements
5. **Directory Structure**: Follows pycore app structure

## Testing

The migration has been tested with:

```bash
python pymain.py app=matrix --help
```

Output shows proper help message and configuration, confirming:
- Entry point is found correctly
- Imports work properly
- Configuration loads successfully
- Logging service initializes correctly

## Benefits

1. **Consistency**: Follows same pattern as other pycore applications
2. **Discovery**: App can be discovered by launcher system
3. **Standards**: Complies with pycore development guide
4. **Maintainability**: Easier to understand and maintain
5. **Integration**: Better integration with pycore utilities

## Next Steps

To further improve the application:

1. Consider moving reusable functionality to `pycore/pyutils`
2. Use pycore utilities for ADB management
3. Implement proper logging with ColorPrint throughout
4. Add proper error handling without try-except blocks
5. Use pycore's device management utilities

## Reference

See the development guide for more details:
- `development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`
