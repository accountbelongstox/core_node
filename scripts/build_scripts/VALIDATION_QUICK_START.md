# Validation System - Quick Start Guide

## What Changed

The Poly Apps Manager now includes a comprehensive validation system that automatically checks your project before building or deploying.

## New Features

### 1. Automatic Dependency Detection
The system now automatically:
- ✅ Detects if `node_modules` is missing
- ✅ Identifies the correct package manager (`pnpm`, `yarn`, or `npm`)
- ✅ **Auto-installs dependencies** if missing
- ✅ Provides exact commands if manual installation needed

### 2. Smart Package Manager Selection
- Reads lock files (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`)
- Uses the package manager that matches your lock file
- Warns if multiple lock files detected

### 3. Project Validation
Before any operation, validates:
- ✅ Project configuration files exist and are valid
- ✅ Required scripts present in `package.json`
- ✅ Build tools available
- ✅ Project structure correct

### 4. Build Output Verification
After building, verifies:
- ✅ Build output directory created
- ✅ Expected files present (e.g., `.output/server/index.mjs` for Nuxt)
- ✅ Build artifacts not empty

### 5. Clear Error Messages
Every error now includes:
- ❌ What went wrong
- 💡 How to fix it
- 📋 Exact commands to run

## Usage

### Normal Usage (No Changes Required)

Just run the script as before:

```bash
./scripts/build_scripts/poly_app_manager.sh
```

The validation system runs automatically!

### What You'll See

#### Before (Old System)
```
Building Nuxt project...
sh: 1: vite: not found
```
❌ Confusing error, no solution

#### After (New System)
```
╔═══════════════════════════════════════════════════════════════╗
║            COMPREHENSIVE VALIDATION SYSTEM                    ║
╚═══════════════════════════════════════════════════════════════╝

Project: matrix_ui_react
Type: react
Path: /www/programing/core_node/poly_apps/matrix_ui_react
Action: build

===============================================================================
  PROJECT VALIDATION
===============================================================================

✓ Project validation passed

===============================================================================
  DEPENDENCY CHECK
===============================================================================

⚠ Dependencies are missing or incomplete

Missing: node_modules
Package Manager: pnpm

To install dependencies, run:
  pnpm install

Auto-installing dependencies...
Command: pnpm install

[... installation output ...]

✓ Dependencies installed successfully

===============================================================================
  BUILD REQUIREMENTS CHECK
===============================================================================

✓ Ready to build
Build command: pnpm run build

✓ Build requirements satisfied

╔═══════════════════════════════════════════════════════════════╗
║              ✓ ALL VALIDATIONS PASSED                         ║
╚═══════════════════════════════════════════════════════════════╝

Building project...
```
✅ Clear progress, automatic fixes, detailed feedback

## Testing the Fix

### Test Case: The Original Error

The issue you encountered was:
```
Building project...
sh: 1: vite: not found
WARN Local package.json exists, but node_modules missing
```

Now try building the same project:

```bash
cd /www/programing/core_node/scripts/build_scripts
./poly_app_manager.sh

# Select: matrix_ui_react
# Action: Build
# Platform: Deploy+Laravel
```

**Expected behavior:**
1. ✅ Validation detects missing `node_modules`
2. ✅ Identifies `pnpm` as the package manager (from `pnpm-lock.yaml`)
3. ✅ Automatically runs `pnpm install`
4. ✅ Verifies installation succeeded
5. ✅ Proceeds with build
6. ✅ Validates build output
7. ✅ Deploys to Laravel

## Validation Stages

Every action now goes through these stages:

```
Stage 1: Project Validation
├── Check project directory exists
├── Validate configuration files
├── Check package.json syntax
└── Detect package manager from lock files

Stage 2: Dependency Check
├── Check node_modules exists
├── Verify critical packages installed
├── Auto-install if missing (when enabled)
└── Verify installation success

Stage 3: Build Requirements (for build/generate actions)
├── Check build script exists
├── Validate build configuration
└── Check disk space

Stage 4: Execute Operation
└── Run build/dev command

Stage 5: Build Verification (for build/generate actions)
├── Check output directory created
├── Verify critical files present
└── Validate output size
```

## Configuration

### Auto-Install Dependencies

By default, **auto-install is enabled** in `poly_app_manager.sh`:

```bash
run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" \
                    "$SELECTED_PROJECT_NAME" "$SELECTED_ACTION" "true"
#                                                                  ^^^^
#                                                          AUTO_INSTALL enabled
```

To **disable auto-install** and require manual installation:
```bash
run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" \
                    "$SELECTED_PROJECT_NAME" "$SELECTED_ACTION" "false"
```

## Error Handling Examples

### Example 1: Missing Dependencies
```
✗ Dependencies are missing or incomplete

Missing: node_modules
Package Manager: pnpm

======================================================================
Installation command:
======================================================================
cd "/www/programing/core_node/poly_apps/matrix_ui_react"
pnpm install
```

### Example 2: Invalid package.json
```
✗ [PACKAGE_JSON_INVALID] package.json is not valid JSON: Expecting ',' delimiter
  Solution: Fix JSON syntax errors in package.json
```

### Example 3: Missing Build Script
```
⚠ [BUILD_SCRIPT_MISSING] No 'build' script found in package.json
  Solution: Add a 'build' script to package.json
```

### Example 4: Build Output Missing
```
✗ Build output directory not found (checked: dist/, build/, .output/public/)

This usually means the build command failed. Check the build output above for errors.
```

## Supported Project Types

The validation system supports:

- ✅ **Nuxt** - Validates `.output` directory and `server/index.mjs`
- ✅ **React** - Validates `dist/` or `build/` with `index.html`
- ✅ **Vue** - Validates `dist/` or `build/` with `index.html`
- ✅ **Vite** - Validates `dist/` or `build/` with `index.html`
- ✅ **Next.js** - Validates `.next/` directory structure
- ✅ **React Native** - Validates build outputs
- ✅ **Flutter** - Validates Flutter SDK and dependencies
- ✅ **Laravel** - Validates `vendor/` and Composer

## Architecture Compliance

The validation system follows the project's architecture rules:

✅ **Python only validates** - No command execution in Python
✅ **Shell executes all commands** - Commands only run in `.sh` scripts
✅ **File-based communication** - Python and Shell communicate via file variables
✅ **Keys Center pattern** - All variable names centralized

## Files Added

```
scripts/build_scripts/build_py_tools/
├── project_validator.py      # Validates project structure
├── dependency_manager.py      # Manages dependencies
├── build_validator.py         # Validates builds
└── validation_helper.sh       # Shell integration

scripts/build_scripts/
├── VALIDATION_SYSTEM.md       # Detailed documentation
└── VALIDATION_QUICK_START.md  # This file
```

## Files Modified

```
scripts/build_scripts/
└── poly_app_manager.sh        # Integrated validation calls
```

## Troubleshooting

### Validation takes too long
The validation is comprehensive. First run may take longer as it checks all dependencies.

### Auto-install not working
Check that you have the package manager installed:
```bash
which pnpm
which npm
which yarn
```

### False positive errors
If validation reports errors but project is fine, check:
1. Are you using a non-standard project structure?
2. Are configuration files in unexpected locations?
3. Open an issue with project details

### Validation passes but build still fails
Validation checks prerequisites, not build logic. If validation passes but build fails:
1. Check build command output for actual error
2. Validation confirms setup is correct
3. Build error is in your code, not environment

## Next Steps

1. **Run the system** - Try building a project
2. **Watch validation** - Observe automatic checks
3. **Check errors** - See clear error messages with solutions
4. **Review documentation** - Read `VALIDATION_SYSTEM.md` for details

## Feedback

If you encounter issues or have suggestions:
1. Check `VALIDATION_SYSTEM.md` for detailed documentation
2. Review error messages - they include solutions
3. Test with different project types
4. Report patterns of false positives

## Summary

The validation system transforms error handling from:
- ❌ Cryptic errors
- ❌ No guidance
- ❌ Manual fixes

To:
- ✅ Clear validation stages
- ✅ Automatic problem detection
- ✅ Auto-fix when possible
- ✅ Actionable solutions when manual fix needed
- ✅ Build verification

Your specific error (`vite: not found` due to missing `node_modules`) is now automatically detected and fixed!
