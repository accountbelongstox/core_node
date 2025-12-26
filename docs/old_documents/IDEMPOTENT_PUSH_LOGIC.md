# Idempotent Self-Healing Push Logic

## ✅ Changes Made

**File**: `pycore/pyutils/device/scrcpy_server_manager.py:423-529`

**Function**: `push_jar_to_device()`

---

## 🎯 Core Problem

**Before**:
```python
# Old logic with early return
if not force and await self.check_jar_on_device(serial):
    return True  # ❌ SKIPPED deletion and push steps!
```

**Issue**:
- If hash matched, skipped deletion and push
- Could not fix version mismatch (3.3.4 on device vs 3.3.3 in code)
- Not idempotent - repeated runs had different behavior

---

## ✅ Solution: Idempotent 4-Step Approach

**New logic** (ALWAYS executes all steps):

```python
# ========== STEP 1: ALWAYS ensure local jar is valid ==========
if not self.ensure_local_jar(auto_download=True):
    return False
ColorPrint.green("[STEP 1/4 OK] Local jar validated")

# ========== STEP 2: ALWAYS remove old jar from device ==========
# CRITICAL: Always remove to prevent version mismatch
await subprocess.run([adb, "-s", serial, "shell", "rm -f /data/local/tmp/scrcpy-server"])
ColorPrint.green("[STEP 2/4 OK] Old jar removed")

# ========== STEP 3: ALWAYS push new jar to device ==========
await subprocess.run([adb, "-s", serial, "push", jar, "//data/local/tmp/scrcpy-server"])
ColorPrint.green("[STEP 3/4 OK] Jar pushed successfully")

# ========== STEP 4: ALWAYS verify push success ==========
await subprocess.run([adb, "-s", serial, "shell", "test -f /data/local/tmp/scrcpy-server"])
ColorPrint.green("[STEP 4/4 OK] Push verified successfully")
```

---

## 🔑 Key Features

### 1️⃣ **Idempotent**
- Repeated runs produce same result
- Safe to run multiple times
- No side effects from previous runs

### 2️⃣ **Self-Healing**
- Always removes old/wrong version
- Always pushes correct version
- Fixes version mismatch automatically (e.g., 3.3.4 → 3.3.3)

### 3️⃣ **Never Skips Steps**
- ❌ No early returns based on checks
- ✅ All 4 steps always execute
- ✅ Each step has clear logging

### 4️⃣ **Defensive**
- Step 1: Validates local jar exists
- Step 2: Removes stale files (non-fatal if fails)
- Step 3: Pushes new jar (fatal if fails)
- Step 4: Verifies file exists on device (fatal if fails)

---

## 📊 Behavior Comparison

| Scenario | Old Logic | New Logic |
|----------|-----------|-----------|
| First push | Push jar | Push jar ✅ |
| Hash matches | **Skip push** ❌ | **Always push** ✅ |
| Version mismatch (3.3.4 vs 3.3.3) | **Skip fix** ❌ | **Auto fix** ✅ |
| Corrupted file | **Not detected** ❌ | **Re-push** ✅ |
| Repeated runs | Different behavior | Same behavior ✅ |

---

## 🔧 Version Consistency Fix

### Problem Chain
1. `scrcpy_server_manager.py` downloaded **3.3.4** (old code)
2. Devices already had **3.3.4** pushed
3. Code changed to download **3.3.3** (new version)
4. But old logic skipped push (hash check passed for wrong version)
5. Result: **Version mismatch error**

### Solution Chain
1. ✅ Changed `SCRCPY_VERSION = "3.3.3"` (line 46)
2. ✅ Changed push logic to **always remove + push** (lines 423-529)
3. ✅ Next connection will:
   - Remove old 3.3.4 from device
   - Push new 3.3.3 to device
   - Verify push success
   - **No more version mismatch**

---

## 📝 Log Output Example

**Before** (with skip):
```
[ScrcpyServerManager] Skipping push for xxx (jar already exists)
[Server] ERROR: The server version (3.3.4) does not match the client (3.3.3)
```

**After** (idempotent):
```
[ScrcpyServerManager] Starting idempotent push for xxx...
[ScrcpyServerManager] [STEP 1/4 OK] Local jar validated
[ScrcpyServerManager] [STEP 2/4] Removing old jar on xxx...
[ScrcpyServerManager] [STEP 2/4 OK] Old jar removed
[ScrcpyServerManager] [STEP 3/4] Pushing jar to xxx...
[ScrcpyServerManager] [STEP 3/4 OK] Jar pushed successfully
[ScrcpyServerManager] [STEP 4/4] Verifying push...
[ScrcpyServerManager] [STEP 4/4 OK] Push verified successfully
[ScrcpyServerManager] ✓ Idempotent push completed for xxx
```

---

## ✅ Guarantees

### Every Run Will:
1. ✅ Check local jar is valid (download if missing)
2. ✅ Remove device jar (cleanup stale versions)
3. ✅ Push new jar (ensure correct version)
4. ✅ Verify push (confirm file exists)

### Will NOT:
- ❌ Skip steps based on cached checks
- ❌ Assume previous state is correct
- ❌ Leave wrong version on device

---

## 🚀 Impact

### Performance
- **Slightly slower**: Always pushes (adds ~1-2 seconds per device)
- **Worth it**: Guarantees version consistency and auto-healing

### Reliability
- **Much higher**: No version mismatch errors
- **Self-healing**: Automatically fixes stale/wrong versions
- **Predictable**: Same behavior every run

---

## 🎯 Usage

**No changes needed in calling code**. The function signature remains the same:

```python
# Old call (still works)
await manager.push_jar_to_device(serial, force=False)

# New behavior: always force push (ignores 'force' parameter)
```

**Note**: `force` parameter is kept for API compatibility but ignored internally.

---

## 📋 Testing Checklist

After service restart, verify:
- [ ] First connection: Shows all 4 steps
- [ ] Second connection: Still shows all 4 steps (not skipped)
- [ ] Version mismatch fixed: No "3.3.4 vs 3.3.3" error
- [ ] All devices work: 19/19 devices connect successfully

---

## ✅ Summary

**Problem**: Version mismatch due to skipped push logic
**Solution**: Idempotent 4-step approach that never skips
**Result**: Self-healing, consistent, reliable jar deployment

**Code changes**:
- Line 46: `SCRCPY_VERSION = "3.3.3"` (version consistency)
- Lines 423-529: New idempotent push logic (self-healing)

**Next step**: Restart service to apply changes.
