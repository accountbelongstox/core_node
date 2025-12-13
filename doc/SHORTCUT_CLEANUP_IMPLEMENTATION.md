# Desktop Shortcut Automatic Cleanup Implementation

## 📋 Overview

Implemented automatic cleanup of old desktop shortcuts when application name changes due to language switching or rebranding.

**Problem**: Users had multiple shortcuts on desktop (e.g., "Matrix Cloud" + "星灿传媒云矩阵") after changing system language.

**Solution**: Automatically detect and remove old shortcuts, keeping only the current language version.

**Implementation Date**: 2025-12-12
**Status**: ✅ Complete

---

## 🎯 Problem Statement

### Issue

When system language changes or app is rebranded:
- Old shortcut remains on desktop
- New shortcut is created with different name
- Result: Multiple shortcuts pointing to same application

**Example**:
```
Desktop:
  ├─ Matrix Cloud.lnk           ← Old English shortcut
  └─ 星灿传媒云矩阵.lnk           ← New Chinese shortcut
```

### User Impact

- Confusing to have multiple icons
- Desktop cluttered with duplicate shortcuts
- Not clear which one to use
- Old shortcuts may have outdated icons/descriptions

---

## ✅ Solution

### Automatic Cleanup

Added `cleanup_old_names` parameter to `ensure_shortcut()`:

```python
manager.ensure_shortcut(
    name="Matrix Cloud",  # Fallback
    i18n_name_key="matrix.shortcut.name",  # Current localized name
    cleanup_old_names=[
        "Matrix Cloud",           # English
        "星灿传媒云矩阵",          # Chinese
        "Xingcan Media - Cloud Matrix",  # Old variant
    ]
)
```

**Behavior**:
1. Resolve current shortcut name (based on system language)
2. Check desktop for all possible old names
3. Remove shortcuts that don't match current name
4. Create/update current shortcut

---

## 🔧 Implementation Details

### 1. New Method: `cleanup_old_shortcuts()`

**File**: `pycore/pyutils/shortcut_manager.py`

```python
def cleanup_old_shortcuts(self, current_name, possible_old_names):
    """
    Clean up old shortcuts with different names

    Args:
        current_name: Current shortcut name (the one we want to keep)
        possible_old_names: List of possible old shortcut names to remove

    Returns:
        list: List of removed shortcut paths
    """
    removed = []
    desktop_path = self.icon_generator.get_desktop_path()

    for old_name in possible_old_names:
        # Skip if this is the current name
        if old_name == current_name:
            continue

        # Check if old shortcut exists
        old_shortcut_path = desktop_path / f"{old_name}.lnk"
        if old_shortcut_path.exists():
            try:
                old_shortcut_path.unlink()
                removed.append(old_shortcut_path)
                print(f"[ShortcutManager] ✓ Removed old shortcut: {old_name}")
            except Exception as e:
                print(f"[ShortcutManager] ✗ Failed to remove: {e}")

    return removed
```

### 2. Enhanced `ensure_shortcut()`

**New Parameter**: `cleanup_old_names` (optional list)

```python
def ensure_shortcut(self,
                   name,
                   command=None,
                   ...,
                   cleanup_old_names=None):  # ← NEW
    """
    Ensure desktop shortcut exists

    cleanup_old_names: Optional list of old shortcut names to clean up
                      (e.g., ["Matrix Cloud", "星灿传媒云矩阵"])
    """
    if cleanup_old_names:
        # Resolve final name (with i18n)
        final_name = name
        if i18n_name_key and self.i18n:
            localized_name = self.i18n.get(i18n_name_key)
            if localized_name:
                final_name = localized_name

        # Clean up old shortcuts
        self.cleanup_old_shortcuts(final_name, cleanup_old_names)

    # Create/update current shortcut
    return self.create_shortcut(...)
```

### 3. Matrix Integration

**File**: `pyapps/matrix/matrix_main.py`

```python
def ensure_desktop_shortcut():
    """
    Ensure Matrix desktop shortcut exists with localized name

    Old shortcuts with different names will be automatically cleaned up.
    """
    manager = ShortcutManager()

    # Define all possible shortcut names (for cleanup)
    ALL_POSSIBLE_NAMES = [
        "Matrix Cloud",                      # English
        "星灿传媒云矩阵",                     # Chinese (simplified)
        "Xingcan Media - Cloud Matrix",      # Old English variant
    ]

    manager.ensure_shortcut(
        name="Matrix Cloud",  # Fallback
        i18n_name_key="matrix.shortcut.name",
        i18n_description_key="matrix.shortcut.description",
        cleanup_old_names=ALL_POSSIBLE_NAMES  # ← Cleanup enabled
    )
```

---

## 🔄 Execution Flow

### With Cleanup Enabled

```
1. python pymain.py app=matrix
   ↓
2. ensure_desktop_shortcut()
   ↓
3. i18n.extend_translations() → Detect language (e.g., "zh")
   ↓
4. manager.ensure_shortcut(cleanup_old_names=[...])
   ↓
5. Resolve current name: i18n.get("matrix.shortcut.name") → "星灿传媒云矩阵"
   ↓
6. cleanup_old_shortcuts("星灿传媒云矩阵", ALL_POSSIBLE_NAMES)
   ├─ Check: "Matrix Cloud" → Found → Remove ✓
   ├─ Check: "星灿传媒云矩阵" → Skip (current name)
   └─ Check: "Xingcan Media - Cloud Matrix" → Not found → Skip
   ↓
7. create_shortcut(name="星灿传媒云矩阵")
   ↓
8. Result: Only "星灿传媒云矩阵.lnk" on desktop
```

---

## 🧪 Testing

### Test Script

**File**: `pyapps/matrix/test_shortcut_cleanup.py`

#### Create Test Shortcuts

```bash
# Create multiple shortcuts with different names
python pyapps/matrix/test_shortcut_cleanup.py --create-test-shortcuts
```

**Result**: Creates 3 shortcuts on desktop:
- Matrix Cloud.lnk
- 星灿传媒云矩阵.lnk
- Xingcan Media - Cloud Matrix.lnk

#### Test Cleanup

```bash
# Run cleanup test
python pyapps/matrix/test_shortcut_cleanup.py
```

**Expected Output**:

```
[Desktop] Checking shortcuts in: C:\Users\...\Desktop
  ⚠ Found existing shortcut: Matrix Cloud
  ⚠ Found existing shortcut: 星灿传媒云矩阵
  ⚠ Found existing shortcut: Xingcan Media - Cloud Matrix

  Total existing shortcuts: 3

Running ensure_shortcut with cleanup...

[ShortcutManager] Checking for old shortcuts to clean up...
[ShortcutManager] Current name: 星灿传媒云矩阵
[ShortcutManager] Possible old names: ['Matrix Cloud', '星灿传媒云矩阵', 'Xingcan Media - Cloud Matrix']
[ShortcutManager] Found old shortcut: Matrix Cloud
[ShortcutManager] ✓ Removed old shortcut: Matrix Cloud
[ShortcutManager] Found old shortcut: Xingcan Media - Cloud Matrix
[ShortcutManager] ✓ Removed old shortcut: Xingcan Media - Cloud Matrix
[ShortcutManager] Cleaned up 2 old shortcut(s)

Checking Desktop After Cleanup

  ✓ Current shortcut exists: 星灿传媒云矩阵

✓ SUCCESS: Only current language shortcut exists!
```

---

## 📊 Test Scenarios

### Scenario 1: English System → Chinese System

**Initial State** (English):
```
Desktop:
  └─ Matrix Cloud.lnk
```

**User changes system language to Chinese**

**After running Matrix**:
```
Desktop:
  └─ 星灿传媒云矩阵.lnk  ← Only Chinese shortcut remains
```

**Log**:
```
[ShortcutManager] Found old shortcut: Matrix Cloud
[ShortcutManager] ✓ Removed old shortcut: Matrix Cloud
[ShortcutManager] Cleaned up 1 old shortcut(s)
```

### Scenario 2: Multiple Old Shortcuts

**Initial State**:
```
Desktop:
  ├─ Matrix Cloud.lnk
  ├─ 星灿传媒云矩阵.lnk
  └─ Xingcan Media - Cloud Matrix.lnk
```

**System language: Chinese**

**After running Matrix**:
```
Desktop:
  └─ 星灿传媒云矩阵.lnk  ← Only current language shortcut
```

**Log**:
```
[ShortcutManager] Found old shortcut: Matrix Cloud
[ShortcutManager] ✓ Removed old shortcut: Matrix Cloud
[ShortcutManager] Found old shortcut: Xingcan Media - Cloud Matrix
[ShortcutManager] ✓ Removed old shortcut: Xingcan Media - Cloud Matrix
[ShortcutManager] Cleaned up 2 old shortcut(s)
```

### Scenario 3: No Old Shortcuts

**Initial State**:
```
Desktop:
  └─ 星灿传媒云矩阵.lnk  (already correct)
```

**System language: Chinese**

**After running Matrix**:
```
Desktop:
  └─ 星灿传媒云矩阵.lnk  (unchanged)
```

**Log**:
```
[ShortcutManager] Checking for old shortcuts to clean up...
[ShortcutManager] No old shortcuts found to clean up
Shortcut already exists and matches: ...  (idempotent)
```

---

## 🛡️ Safety Features

### 1. Current Name Protection

**Rule**: Never remove shortcut with current name

```python
if old_name == current_name:
    continue  # Skip, don't remove
```

**Example**: If system is Chinese, `cleanup_old_shortcuts("星灿传媒云矩阵", [...])` will never remove "星灿传媒云矩阵.lnk"

### 2. Error Handling

If removal fails, log error but continue:

```python
try:
    old_shortcut_path.unlink()
    print(f"✓ Removed: {old_name}")
except Exception as e:
    print(f"✗ Failed to remove {old_name}: {e}")
    # Continue to next shortcut
```

### 3. Optional Cleanup

Cleanup is **optional** - only runs if `cleanup_old_names` is provided:

```python
if cleanup_old_names:
    self.cleanup_old_shortcuts(...)
```

### 4. Idempotency Preserved

Cleanup happens **before** shortcut creation, so idempotency checks still work:

```
1. Clean up old shortcuts
2. Check if current shortcut needs update (idempotent check)
3. Create/update only if needed
```

---

## 📝 Logging

### Cleanup Logs

```
[ShortcutManager] Checking for old shortcuts to clean up...
[ShortcutManager] Current name: 星灿传媒云矩阵
[ShortcutManager] Possible old names: ['Matrix Cloud', '星灿传媒云矩阵', 'Xingcan Media - Cloud Matrix']
```

**Found and removed**:
```
[ShortcutManager] Found old shortcut: Matrix Cloud
[ShortcutManager] ✓ Removed old shortcut: Matrix Cloud
```

**Not found**:
```
[ShortcutManager] No old shortcuts found to clean up
```

**Failure**:
```
[ShortcutManager] Found old shortcut: Matrix Cloud
[ShortcutManager] ✗ Failed to remove old shortcut Matrix Cloud: [Errno 13] Permission denied
```

---

## 🚀 Benefits

1. **Clean Desktop**: Only one shortcut per application
2. **Automatic**: No manual cleanup needed
3. **Language Aware**: Respects current system language
4. **Safe**: Never removes current shortcut
5. **Robust**: Handles errors gracefully
6. **Idempotent**: Still follows idempotent behavior
7. **Extensible**: Easy to add new language names

---

## 📚 Usage in Other Apps

### Example: MCP Server

```python
from pycore.pyutils.shortcut_manager import ShortcutManager

def ensure_mcp_shortcut():
    manager = ShortcutManager()

    # Define all possible names
    ALL_NAMES = [
        "MCP Server",
        "MCP服务器",
        "MCPサーバー",
    ]

    manager.ensure_shortcut(
        name="MCP Server",
        command="python pymain.py app=mcp",
        i18n_name_key="mcp.shortcut.name",
        cleanup_old_names=ALL_NAMES  # ← Enable cleanup
    )
```

### Example: Custom App

```python
manager = ShortcutManager()

# Manual cleanup (without i18n)
manager.cleanup_old_shortcuts(
    current_name="My App 2025",
    possible_old_names=[
        "My App",
        "My App 2024",
        "MyApp",
    ]
)

# Then create current shortcut
manager.create_shortcut(
    name="My App 2025",
    target_path="C:\\Program Files\\MyApp\\app.exe"
)
```

---

## 🔄 Migration Guide

### For Existing Apps

If your app already has shortcuts with different names:

1. **Identify all possible names** (check desktop, test different languages)
   ```python
   ALL_POSSIBLE_NAMES = [
       "Old Name",
       "旧名称",
       "Current Name",
   ]
   ```

2. **Add cleanup to ensure_shortcut()**
   ```python
   manager.ensure_shortcut(
       ...,
       cleanup_old_names=ALL_POSSIBLE_NAMES
   )
   ```

3. **Test**
   - Create old shortcuts manually
   - Run app
   - Verify only current shortcut remains

---

## 📋 Files Modified

### 1. Core Library Enhanced
- ✅ `pycore/pyutils/shortcut_manager.py`
  - Added `cleanup_old_shortcuts()` method
  - Enhanced `ensure_shortcut()` with `cleanup_old_names` parameter

### 2. Matrix Application Updated
- ✅ `pyapps/matrix/matrix_main.py`
  - Added `ALL_POSSIBLE_NAMES` constant
  - Enabled cleanup in `ensure_desktop_shortcut()`

### 3. Test Scripts Created
- ✅ `pyapps/matrix/test_shortcut_cleanup.py` - Cleanup test script

### 4. Documentation
- ✅ `doc/SHORTCUT_CLEANUP_IMPLEMENTATION.md` - This document

---

## ✅ Verification Steps

To verify cleanup is working:

1. **Create test shortcuts**
   ```bash
   python pyapps/matrix/test_shortcut_cleanup.py --create-test-shortcuts
   ```
   - Check desktop for 3 shortcuts

2. **Run cleanup test**
   ```bash
   python pyapps/matrix/test_shortcut_cleanup.py
   ```
   - Should see cleanup logs
   - Only 1 shortcut should remain

3. **Run actual application**
   ```bash
   python pymain.py app=matrix
   ```
   - Check desktop
   - Only current language shortcut should exist

4. **Change system language**
   - Change Windows display language
   - Run Matrix again
   - Old language shortcut should be removed
   - New language shortcut should appear

---

## 🎯 Summary

**Before**:
```
Desktop:
  ├─ Matrix Cloud.lnk
  └─ 星灿传媒云矩阵.lnk  ← Two shortcuts!
```

**After**:
```
Desktop:
  └─ 星灿传媒云矩阵.lnk  ← Only current language!
```

**How**: Automatic cleanup of old shortcuts on every app startup.

**User Experience**: Clean desktop, no duplicate icons, always shows correct language name.

---

**Document Version**: v1.0
**Last Updated**: 2025-12-12
**Author**: Claude Code
**Status**: ✅ Implementation Complete
