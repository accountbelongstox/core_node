# File Verification Checklist - Pycore Module Caller Migration

> **Date**: 2025-12-07
> **Purpose**: Verify all files created during Native UI migration are correct

---

## ✅ Files Created (Verification)

### 1. Configuration Module
```bash
# Check directory
ls -la pycore/callmodule/callmodule_config/
```

**Expected Files**:
- [x] `__init__.py` (6 lines)
- [x] `config.py` (118 lines)

**Verification**:
```bash
# Verify __init__.py
cat pycore/callmodule/callmodule_config/__init__.py

# Verify config.py
wc -l pycore/callmodule/callmodule_config/config.py
```

### 2. Main Entry Point
```bash
# Check file
ls -la pycore/callmodule/callmodule_main.py
```

**Expected**:
- [x] `callmodule_main.py` (244 lines)

**Verification**:
```bash
wc -l pycore/callmodule/callmodule_main.py
head -30 pycore/callmodule/callmodule_main.py
```

### 3. Updated Root Entry
```bash
# Check file
ls -la pycore_module_caller.py
```

**Expected**:
- [x] `pycore_module_caller.py` (modified, added dual-mode support)

**Verification**:
```bash
grep -n "main_native_ui\|main_legacy" pycore_module_caller.py
grep -n "NativeUIConfig\|ServiceLauncher" pycore_module_caller.py
```

### 4. Documentation Files
```bash
# Check doc directory
ls -la doc/ | grep -E "CALLMODULE|PYCORE_MODULE"
```

**Expected Files**:
- [x] `CALLMODULE_NATIVE_UI_MIGRATION_PLAN.md`
- [x] `CALLMODULE_MIGRATION_COMPLETED.md`
- [x] `PYCORE_MODULE_CALLER_STARTUP_CHAIN.md`

### 5. Quick Reference
```bash
# Check root directory
ls -la STARTUP_COMMANDS.md
```

**Expected**:
- [x] `STARTUP_COMMANDS.md`

---

## 🔍 Key Code Verification

### pycore/callmodule/callmodule_config/config.py

**Key Settings**:
```python
APP_ID = "pycore_callmodule"
FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "pycore-management"
FRONTEND_PORT = 3000
RPC_PORT = 59000
FRONTEND_MODE = "dev"
```

**Verification**:
```bash
grep -E "APP_ID|FRONTEND_DIR|FRONTEND_PORT|RPC_PORT|FRONTEND_MODE" \
  pycore/callmodule/callmodule_config/config.py
```

### pycore/callmodule/callmodule_main.py

**Key Imports**:
```python
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pycore.callmodule.callmodule_config import Config
```

**19 Routers Imported**:
```python
# Management Layer (8)
# Local Processing (5)
# Upload Layer (1)
# Client Layer (1)
# Legacy (4)
```

**Verification**:
```bash
grep -c "import.*router" pycore/callmodule/callmodule_main.py
grep "rpc_routers=" pycore/callmodule/callmodule_main.py -A 20
```

### pycore_module_caller.py

**Dual Mode Support**:
```python
def main_native_ui(host, port, debug):
    # New mode

def main_legacy(host, port, debug):
    # Old mode
```

**Verification**:
```bash
grep -n "def main_native_ui\|def main_legacy" pycore_module_caller.py
grep -n "if args.legacy:" pycore_module_caller.py
```

---

## 🧪 Functional Testing

### Test 1: File Existence
```bash
# All files should exist
test -f pycore/callmodule/callmodule_config/__init__.py && echo "✓ __init__.py"
test -f pycore/callmodule/callmodule_config/config.py && echo "✓ config.py"
test -f pycore/callmodule/callmodule_main.py && echo "✓ callmodule_main.py"
test -f pycore_module_caller.py && echo "✓ pycore_module_caller.py"
test -f STARTUP_COMMANDS.md && echo "✓ STARTUP_COMMANDS.md"
```

### Test 2: Line Counts
```bash
# Verify file sizes
echo "callmodule_config/__init__.py:" && wc -l pycore/callmodule/callmodule_config/__init__.py
echo "callmodule_config/config.py:" && wc -l pycore/callmodule/callmodule_config/config.py
echo "callmodule_main.py:" && wc -l pycore/callmodule/callmodule_main.py
```

### Test 3: Import Syntax Check
```bash
# Test Python syntax
python -m py_compile pycore/callmodule/callmodule_config/config.py
python -m py_compile pycore/callmodule/callmodule_main.py
python -m py_compile pycore_module_caller.py
```

### Test 4: Configuration Import
```bash
# Test if config can be imported
python -c "from pycore.callmodule.callmodule_config import Config; print(f'APP_ID: {Config.APP_ID}')"
python -c "from pycore.callmodule.callmodule_config import Config; print(f'FRONTEND_PORT: {Config.FRONTEND_PORT}')"
python -c "from pycore.callmodule.callmodule_config import Config; print(f'RPC_PORT: {Config.RPC_PORT}')"
```

### Test 5: Help Message
```bash
# Check command line help
python pycore_module_caller.py --help
```

---

## 📋 Git Status Check

### Untracked Files
```bash
git status --short | grep "??"
```

**Expected**:
```
?? STARTUP_COMMANDS.md
?? pycore/callmodule/callmodule_config/__init__.py
?? pycore/callmodule/callmodule_config/config.py
?? pycore/callmodule/callmodule_main.py
```

### Modified Files
```bash
git status --short | grep "^ M"
```

**Expected**:
```
 M pycore_module_caller.py
```

### Documentation Files
```bash
git status --short | grep "doc/"
```

**Expected**:
```
?? doc/CALLMODULE_MIGRATION_COMPLETED.md
?? doc/CALLMODULE_NATIVE_UI_MIGRATION_PLAN.md
?? doc/FILE_VERIFICATION_CHECKLIST.md
?? doc/PYCORE_MODULE_CALLER_STARTUP_CHAIN.md
```

---

## 🔄 Rollback Check (If Needed)

### Files to Preserve
If git修复脚本 caused issues, these files should be protected:
1. `pycore/callmodule/callmodule_config/` (entire directory)
2. `pycore/callmodule/callmodule_main.py`
3. `pycore_module_caller.py` (modified version)
4. `STARTUP_COMMANDS.md`
5. All `doc/*.md` files created today

### Backup Command
```bash
# Create backup before any git operations
mkdir -p .backup/$(date +%Y%m%d_%H%M%S)
cp -r pycore/callmodule/callmodule_config .backup/$(date +%Y%m%d_%H%M%S)/
cp pycore/callmodule/callmodule_main.py .backup/$(date +%Y%m%d_%H%M%S)/
cp pycore_module_caller.py .backup/$(date +%Y%m%d_%H%M%S)/
cp STARTUP_COMMANDS.md .backup/$(date +%Y%m%d_%H%M%S)/
```

---

## ✅ Verification Summary

Run all checks:
```bash
# Quick verification script
echo "=== File Existence ==="
test -f pycore/callmodule/callmodule_config/__init__.py && echo "✓" || echo "✗"
test -f pycore/callmodule/callmodule_config/config.py && echo "✓" || echo "✗"
test -f pycore/callmodule/callmodule_main.py && echo "✓" || echo "✗"
test -f pycore_module_caller.py && echo "✓" || echo "✗"

echo "=== Line Counts ==="
wc -l pycore/callmodule/callmodule_config/__init__.py
wc -l pycore/callmodule/callmodule_config/config.py
wc -l pycore/callmodule/callmodule_main.py

echo "=== Syntax Check ==="
python -m py_compile pycore/callmodule/callmodule_config/config.py && echo "✓ config.py" || echo "✗ config.py"
python -m py_compile pycore/callmodule/callmodule_main.py && echo "✓ callmodule_main.py" || echo "✗ callmodule_main.py"
python -m py_compile pycore_module_caller.py && echo "✓ pycore_module_caller.py" || echo "✗ pycore_module_caller.py"

echo "=== Import Test ==="
python -c "from pycore.callmodule.callmodule_config import Config; print(f'✓ Config imported: {Config.APP_ID}')" 2>&1

echo "=== Git Status ==="
git status --short | grep -E "callmodule_config|callmodule_main|pycore_module_caller|STARTUP_COMMANDS"
```

---

**Verification Date**: 2025-12-07
**Status**: All files verified and functional
