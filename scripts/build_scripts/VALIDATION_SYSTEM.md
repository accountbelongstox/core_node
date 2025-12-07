# Poly Apps Manager - Comprehensive Validation System

## Overview

This document describes the comprehensive validation and robustness system implemented to address the following critical issues:

### Problems Solved

1. ✅ **No dependency checking** → Now validates node_modules/vendor before operations
2. ✅ **No build tool detection** → Now detects and validates npm/pnpm/yarn/composer availability
3. ✅ **No smart package manager selection** → Now respects lock files and recommends correct tool
4. ✅ **No build output validation** → Now verifies build artifacts after compilation
5. ✅ **No error recovery** → Now provides clear, actionable error messages with solutions
6. ✅ **No project state pre-check** → Now validates project structure before operations
7. ✅ **Poor error messages** → Now provides detailed, actionable guidance

## Architecture

The validation system follows the project's core architecture rule:

> **Python modules only validate and organize data. Shell scripts execute all commands.**

### Components

```
┌──────────────────────────────────────────────────────────────┐
│                    Validation System                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Python Modules (Validation & Analysis)                     │
│  ├── project_validator.py   - Validates project structure   │
│  ├── dependency_manager.py  - Checks dependencies           │
│  └── build_validator.py     - Validates build requirements  │
│                                                              │
│  Shell Integration                                           │
│  └── validation_helper.sh   - Bridge between Python/Shell   │
│                                                              │
│  Main Script                                                 │
│  └── poly_app_manager.sh    - Integrates validation         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Validation Modules

### 1. Project Validator (`project_validator.py`)

**Purpose**: Validates project configuration and structure before any operations.

**Checks Performed**:
- ✓ Project directory exists
- ✓ Configuration files exist (package.json, nuxt.config.ts, etc.)
- ✓ Configuration files are valid JSON/syntax
- ✓ node_modules/vendor directory exists
- ✓ Lock files detected for smart package manager selection
- ✓ Build scripts present in package.json

**Output**:
- Validation status (pass/fail)
- Detailed error messages with solutions
- Project information (package manager, dependencies, scripts)
- Warnings for potential issues

**Example Usage**:
```bash
python3 project_validator.py /path/to/project nuxt project_name
```

**Exit Codes**:
- `0` - Validation passed
- `1` - Validation failed

**File Variables**:
- Saves to: `POLY_APP_VALIDATION_{PROJECT_NAME}`
- Format: JSON with validation results and project info

### 2. Dependency Manager (`dependency_manager.py`)

**Purpose**: Checks dependency installation status and provides installation commands.

**Checks Performed**:
- ✓ node_modules/vendor directory populated
- ✓ Critical packages installed
- ✓ Package manager availability (npm, pnpm, yarn, composer)
- ✓ Lock file consistency
- ✓ Smart package manager recommendation

**Output**:
- Dependency installation status
- Recommended package manager (based on lock files)
- Installation command if dependencies missing
- Tool availability check commands

**Example Usage**:
```bash
python3 dependency_manager.py /path/to/project nuxt project_name
```

**Features**:
- **Auto-detection**: Automatically detects the correct package manager from lock files
  - `pnpm-lock.yaml` → recommends pnpm
  - `yarn.lock` → recommends yarn
  - `package-lock.json` → recommends npm
- **Actionable Output**: Provides exact commands to fix issues
- **Multi-lock Warning**: Warns if multiple lock files detected

**File Variables**:
- Saves to: `POLY_APP_DEPENDENCY_{PROJECT_NAME}`
- Format: JSON with dependency status and install commands

### 3. Build Validator (`build_validator.py`)

**Purpose**: Validates build requirements before compilation and verifies outputs after.

**Pre-Build Checks**:
- ✓ Build script exists in package.json
- ✓ Expected build tools available
- ✓ Configuration files present
- ✓ Disk space warnings

**Post-Build Checks**:
- ✓ Build output directory created
- ✓ Critical files present (index.mjs, index.html, etc.)
- ✓ Build artifacts size validation
- ✓ Directory structure validation

**Output**:
- Build readiness status
- Expected output paths
- Build command to execute
- Validation warnings

**Example Usage**:
```bash
# Before build
python3 build_validator.py /path/to/project nuxt build project_name

# After build (via shell helper)
validate_build_output /path/to/project nuxt project_name
```

**Expected Outputs by Project Type**:

| Project Type | Output Directory | Critical Files |
|--------------|------------------|----------------|
| Nuxt | `.output` | `.output/server/index.mjs` |
| React | `dist` or `build` | `index.html` |
| Vue | `dist` or `build` | `index.html` |
| Vite | `dist` or `build` | `index.html` |
| Next.js | `.next` | `.next/server/`, `.next/static/` |

## Shell Integration

### Validation Helper (`validation_helper.sh`)

**Purpose**: Provides shell functions that integrate Python validators with shell execution.

**Functions**:

#### `validate_project`
```bash
validate_project PROJECT_PATH PROJECT_TYPE PROJECT_NAME
```
Runs project structure validation.

#### `check_and_install_dependencies`
```bash
check_and_install_dependencies PROJECT_PATH PROJECT_TYPE PROJECT_NAME AUTO_INSTALL
```
Checks dependencies and optionally installs them automatically.

Parameters:
- `AUTO_INSTALL`: Set to `"true"` to auto-install dependencies

#### `validate_build_requirements`
```bash
validate_build_requirements PROJECT_PATH PROJECT_TYPE PROJECT_NAME ACTION
```
Validates that build requirements are met.

#### `validate_build_output`
```bash
validate_build_output PROJECT_PATH PROJECT_TYPE PROJECT_NAME
```
Validates build artifacts after compilation.

#### `run_full_validation`
```bash
run_full_validation PROJECT_PATH PROJECT_TYPE PROJECT_NAME ACTION AUTO_INSTALL
```
Runs all validation checks in sequence.

**Workflow**:
```
1. Validate project structure
   ↓
2. Check and install dependencies (auto if enabled)
   ↓
3. Validate build requirements (for build actions)
   ↓
4. Execute build/dev command
   ↓
5. Validate build output (for build actions)
```

## Integration with poly_app_manager.sh

The validation system is integrated at key points in the main script:

### Debug Mode
```bash
"debug")
    # Run validation
    if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" \
         "$SELECTED_PROJECT_NAME" "$SELECTED_ACTION" "true"; then
        echo "Error: Validation failed. Cannot start development server."
        exit 1
    fi

    # Start dev server
    pnpm run dev || npm run dev
    ;;
```

### Build Mode
```bash
"build")
    # Run full validation
    if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" \
         "$SELECTED_PROJECT_NAME" "$SELECTED_ACTION" "true"; then
        echo "Error: Validation failed. Cannot proceed with build."
        exit 1
    fi

    # Build project
    pnpm run build || npm run build

    # Validate output
    if ! validate_build_output "$PROJECT_PATH" "$PROJECT_TYPE" \
         "$SELECTED_PROJECT_NAME"; then
        echo "Error: Build output validation failed."
        exit 1
    fi

    # Proceed with deployment if needed
    ;;
```

## Error Messages and Solutions

The validation system provides actionable error messages with solutions:

### Example: Missing node_modules
```
⚠ [NODE_MODULES_MISSING] node_modules directory not found
  Solution: Run 'npm install' or 'pnpm install' to install dependencies

======================================================================
Installation command:
======================================================================
cd "/path/to/project"
pnpm install
```

### Example: Invalid package.json
```
✗ [PACKAGE_JSON_INVALID] package.json is not valid JSON: Expecting ',' delimiter
  Solution: Fix JSON syntax errors in package.json
```

### Example: Missing build script
```
⚠ [BUILD_SCRIPT_MISSING] No 'build' script found in package.json
  Solution: Add a 'build' script to package.json
```

### Example: Build output missing
```
✗ Build output directory not found (checked: dist/, build/, .output/public/)
  Solution: Verify build command completed successfully
```

## File Variable Communication

The system uses file-based variables for Python-Shell communication:

### Variables Created

| Variable Name | Content | Created By |
|---------------|---------|------------|
| `POLY_APP_VALIDATION_{NAME}` | Project validation results | project_validator.py |
| `POLY_APP_DEPENDENCY_{NAME}` | Dependency status | dependency_manager.py |

### Variable Format

All variables store JSON:
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "info": {
    "package_manager": "pnpm",
    "lock_files": ["pnpm-lock.yaml"],
    "dependencies_installed": true,
    "scripts": {...}
  }
}
```

## Auto-Installation Feature

The system supports automatic dependency installation:

**Enable auto-install:**
```bash
run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$PROJECT_NAME" "$ACTION" "true"
#                                                                              ^^^^
#                                                                       AUTO_INSTALL=true
```

**What happens:**
1. System detects missing dependencies
2. Determines correct package manager from lock files
3. Automatically runs install command
4. Verifies installation succeeded
5. Continues with build/dev operation

**When disabled** (default):
- System detects missing dependencies
- Prints installation command for user to run manually
- Exits with error code

## Testing the Validation System

### Test 1: Missing Dependencies
```bash
# Remove node_modules
rm -rf /path/to/project/node_modules

# Run the system
./poly_app_manager.sh

# Expected: Clear error message with install command
```

### Test 2: Invalid Configuration
```bash
# Corrupt package.json
echo "invalid json" > /path/to/project/package.json

# Run the system
./poly_app_manager.sh

# Expected: JSON validation error with solution
```

### Test 3: Successful Build
```bash
# With valid project and dependencies
./poly_app_manager.sh

# Expected:
# 1. All validations pass
# 2. Build completes
# 3. Output validation succeeds
# 4. Deployment proceeds
```

### Test 4: Auto-Install
```bash
# Remove dependencies
rm -rf node_modules

# Script auto-installs (AUTO_INSTALL=true in poly_app_manager.sh)
./poly_app_manager.sh

# Expected:
# 1. Detects missing dependencies
# 2. Shows "Auto-installing dependencies..."
# 3. Runs correct package manager
# 4. Continues with build
```

## Benefits

### 1. Early Problem Detection
- Issues caught before attempting operations
- No wasted time on failing builds
- Clear indication of what's wrong

### 2. Actionable Error Messages
- Every error includes a solution
- Exact commands provided to fix issues
- No guessing needed

### 3. Smart Tool Selection
- Respects project's lock files
- Recommends correct package manager
- Prevents lock file conflicts

### 4. Build Verification
- Ensures build actually succeeded
- Validates expected artifacts present
- Catches incomplete builds

### 5. Consistent Experience
- Same validation for all project types
- Predictable error messages
- Uniform fix procedures

### 6. Maintainability
- Clear separation of concerns
- Python does validation, Shell does execution
- Easy to extend with new checks

## Extending the System

### Adding New Validation Checks

#### In project_validator.py:
```python
def _validate_node_project(self, project_path: Path, project_type: str, validation: Dict):
    # ... existing checks ...

    # Add new check
    if not (project_path / "tsconfig.json").exists():
        validation["warnings"].append({
            "code": "TSCONFIG_MISSING",
            "message": "No TypeScript configuration found",
            "solution": "Create tsconfig.json if using TypeScript"
        })
```

#### In build_validator.py:
```python
def _get_expected_build_output(self, project_type: str) -> Dict:
    # Add new project type
    output_configs = {
        KeysCenter.PROJECT_TYPE_NEW: {
            "directory": "output",
            "critical_files": ["main.js"],
            "critical_dirs": ["assets"],
        },
        # ... existing configs ...
    }
```

### Adding New Project Types

1. Update `keys_center.py`:
```python
PROJECT_TYPE_NEW = "new_type"
```

2. Add detection in `project_detector.py`:
```python
if (project_path / "new_config.json").exists():
    return KeysCenter.PROJECT_TYPE_NEW
```

3. Add validation logic in `project_validator.py`:
```python
elif project_type == KeysCenter.PROJECT_TYPE_NEW:
    self._validate_new_project(project_path, validation)
```

4. Update `framework_configs.py` for menu options

5. Add case in `poly_app_manager.sh`

## Summary

The validation system transforms the Poly Apps Manager from a simple launcher into a robust build system with:

- **Comprehensive validation** at every step
- **Automatic dependency management** with smart tool detection
- **Build verification** to ensure success
- **Clear, actionable error messages** that guide users to solutions
- **Maintainable architecture** that follows project conventions

This addresses all 7 robustness issues identified in the initial system scan.
