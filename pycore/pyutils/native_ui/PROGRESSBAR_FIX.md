# Progress Bar "after" Timer Fix

**Date**: 2025-11-10
**Status**: ✅ Fixed

---

## Issue

**Error Message**:
```
can't invoke "winfo" command: application has been destroyed
    while executing
"winfo exists $pb"
    (procedure "ttk::progressbar::Autoincrement" line 4)
invoked from within
"ttk::progressbar::Autoincrement .!frame4.!progressbar 10 1"
    ("after" script)
```

**Root Cause**:
- Progress bar started infinite animation with `self.progress_bar.start(10)`
- Animation uses Tkinter's `after()` timer to continuously update
- When window closes, progress bar animation continues trying to update destroyed window
- Result: `after` callback tries to access destroyed widget → error

---

## Fix Applied

**File**: `pycore/pyutils/native_ui/startup_window.py`

**Location**: `close()` method (lines 342-363)

**Change**:
```python
def close(self):
    """Close the startup window."""
    if not self._running:
        return

    self._running = False

    # Call completion callback
    if self.on_complete:
        self.on_complete()

    # ✅ NEW: Stop progress bar animation to prevent "after" errors
    if self.progress_bar:
        try:
            self.progress_bar.stop()
        except:
            pass

    # Close window
    if self.root:
        self.root.after(0, self.root.quit)
        self.root.after(0, self.root.destroy)
```

**Key Addition** (lines 353-358):
```python
# Stop progress bar animation to prevent "after" errors
if self.progress_bar:
    try:
        self.progress_bar.stop()
    except:
        pass
```

---

## Technical Details

### Progress Bar Lifecycle

**Start** (startup_window.py:277):
```python
self.progress_bar = ttk.Progressbar(
    status_frame,
    mode='indeterminate',  # Infinite animation
    length=self.width - 40
)
self.progress_bar.start(10)  # Start animation with 10ms interval
```

**Stop** (startup_window.py:353-358):
```python
if self.progress_bar:
    try:
        self.progress_bar.stop()  # Stop animation before destroying window
    except:
        pass  # Ignore errors if already stopped or destroyed
```

### Why `try/except` is Needed

The `try/except` block prevents errors in edge cases:
1. Progress bar already stopped
2. Progress bar widget already destroyed
3. Root window already destroyed

This ensures clean shutdown even in race conditions.

---

## Other Timers Verified

### `_process_logs()` Timer
**Location**: startup_window.py:289-301

**Status**: ✅ Already Safe

```python
def _process_logs(self):
    """Process log messages from queue."""
    if not self._running or not self.root:  # ✅ Check before processing
        return

    # Process logs...

    # Schedule next check
    if self._running:  # ✅ Only schedule if still running
        self.root.after(100, self._process_logs)
```

**Protection**:
- Checks `self._running` before processing (line 291)
- Checks `self._running` before scheduling next call (line 300)
- When `close()` sets `self._running = False`, timer stops automatically

---

## Verification

**Syntax Check**:
```bash
✓ startup_window.py syntax OK
```

**Test Commands**:
```bash
# Test 1: Standalone startup window
python test_startup_window_i18n.py

# Test 2: Full Matrix application
python pymain.py app=matrix
```

**Expected Behavior**:
- ✅ No "winfo" errors when closing window
- ✅ Clean shutdown without timer errors
- ✅ No background processes left running

---

## Related Files

All Tkinter timer issues in startup window are now resolved:

| Timer Type | Location | Status |
|-----------|----------|--------|
| Progress bar animation | `self.progress_bar.start(10)` | ✅ Fixed - stopped in `close()` |
| Log processing timer | `self.root.after(100, self._process_logs)` | ✅ Already safe - checks `_running` flag |
| Status update timer | `self.root.after(0, lambda: ...)` | ✅ Safe - one-time callbacks |

---

## Summary of All Fixes

### Session Fix History

1. ✅ **Missing `Any` type import** (startup_window.py:17)
   - Added `Any` to typing imports

2. ✅ **Invalid ColorPrint methods** (i18n_manager.py - 24 occurrences)
   - `print_info()` → `blue()`
   - `print_warn()` → `yellow()`
   - `print_error()` → `red()`
   - `print_success()` → `green()`

3. ✅ **Progress bar timer leak** (startup_window.py:353-358)
   - Stop progress bar animation before destroying window
   - Prevents "after" errors on window close

---

## Status

✅ **All Issues Resolved**
✅ **Ready for Testing**

**Test Command**:
```bash
python pymain.py app=matrix
```

**Expected Result**: No timer errors, clean startup and shutdown with language selector working correctly.
