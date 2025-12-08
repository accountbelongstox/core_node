# Cleanup Confirmation Guide

## Overview

The build system now includes **interactive confirmation prompts** before performing any cleanup operations. This prevents accidental deletion of cache files and gives you control over the build process.

---

## When You'll See Confirmation Prompts

### 1. **Initial Cleanup** (Before First Build)

When the build process starts, you'll see:

```
================================================================
  CLEANUP CONFIRMATION
================================================================

This will clean the following:
  [1] Gradle cache (~/.gradle/caches)
  [2] Gradle wrapper (~/.gradle/wrapper)
  [3] Gradle daemon (~/.gradle/daemon)
  [4] Flutter build directories (build, .dart_tool)
  [5] Android build directories (android/build, android/.gradle)

WARNING: This operation cannot be undone!

Do you want to proceed with cleanup? (Y/N):
```

**Your Options:**
- **Y** or **y**: Proceed with cleanup and then build
- **N** or **n**: Skip cleanup and continue directly to build

### 2. **Retry Cleanup** (After Build Failure)

If the build fails, you'll see:

```
[ORCHESTRATOR] Build failed with exit code: 1
[ORCHESTRATOR] Retry attempt 1 of 1...
[ORCHESTRATOR] Waiting 5 seconds before retry...

[ORCHESTRATOR] Build failed. Do you want to clean and retry?
Clean build directories and retry? (Y/N):
```

**Your Options:**
- **Y** or **y**: Clean build directories and retry the build
- **N** or **n**: Cancel retry and exit (shows error solutions)

---

## Behavior Summary

### If You Choose **Y** (Yes to Cleanup):

```
[CLEANUP] Starting comprehensive cache cleanup...
[CLEANUP] Stopping Gradle daemons...
[CLEANUP] Cleaning Gradle cache...
[CLEANUP]   Removed: C:\Users\YourName\.gradle\caches
[CLEANUP]   Removed: C:\Users\YourName\.gradle\wrapper
[CLEANUP]   Removed: C:\Users\YourName\.gradle\daemon
[CLEANUP] Cleaning Flutter build directories...
[CLEANUP]   Removed: build
[CLEANUP]   Removed: .dart_tool
[CLEANUP]   Removed: android\build
[CLEANUP]   Removed: android\.gradle
[CLEANUP] Comprehensive cleanup completed!

[BUILD] Starting Flutter build process...
```

### If You Choose **N** (No to Cleanup):

```
[CLEANUP] Cleanup cancelled by user
[CLEANUP] Skipping cleanup and continuing with build...

[BUILD] Starting Flutter build process...
```

---

## Use Cases

### ✅ **When to Answer Y (Clean)**

1. **First build of the day** - Clean start ensures no stale cache issues
2. **After dependencies change** - pubspec.yaml or gradle files modified
3. **Build fails with cache errors** - "Could not resolve dependencies"
4. **Switching between branches** - Different dependency versions
5. **After Flutter/Gradle updates** - Version changes require clean cache

### ✅ **When to Answer N (Skip)**

1. **Quick rebuild** - Just changed some Dart code
2. **Iterative development** - Making small changes repeatedly
3. **Cache is already clean** - Just cleaned manually
4. **Testing specific changes** - Want to preserve existing build state
5. **Slow internet connection** - Avoid re-downloading dependencies

---

## What Gets Cleaned

### Gradle Cache (~/.gradle/)
- **caches/**: Compiled dependencies, build outputs
- **wrapper/**: Gradle wrapper distributions
- **daemon/**: Running Gradle daemon processes

**Impact**: ~500MB-2GB freed, dependencies will be re-downloaded

### Flutter Build Directories
- **build/**: Compiled Dart code, APK outputs
- **.dart_tool/**: Package config, analysis info

**Impact**: ~50-200MB freed, will be rebuilt from scratch

### Android Build Directories
- **android/build/**: Compiled Android code
- **android/.gradle/**: Android-specific Gradle cache

**Impact**: ~100-500MB freed, will be recompiled

---

## Advanced: Non-Interactive Mode

If you want to **always clean** without prompts (for CI/CD), you can modify the script or use environment variables:

```powershell
# Set environment variable to auto-confirm
$env:AUTO_CONFIRM_CLEANUP = "Y"
.\start.ps1
```

(Note: This feature needs to be implemented if required)

---

## Troubleshooting

### Problem: Cleanup hangs or takes too long

**Solution**:
- Press `Ctrl+C` to cancel
- Manually delete directories in Windows Explorer
- Check if files are locked by other processes (Android Studio, VS Code)

### Problem: "Could not remove" warnings

**Solution**:
- Close all IDEs (Android Studio, VS Code)
- Stop running Gradle daemons manually: `gradle --stop`
- Run cleanup as Administrator

### Problem: Need to clean without confirmation in scripts

**Solution**:
- Create a separate script that calls cleanup directly
- Or modify `01_cleanup.ps1` to accept command-line parameters

---

## Examples

### Example 1: Clean Build

```
User Input: Y
Result: Full cleanup + fresh build
Time: ~2-5 minutes (depending on internet)
Success Rate: Highest (eliminates cache-related issues)
```

### Example 2: Quick Rebuild

```
User Input: N
Result: Skip cleanup + incremental build
Time: ~30 seconds - 2 minutes
Success Rate: High (if no dependency changes)
```

### Example 3: Retry After Failure

```
First Build: N (failed)
Retry Prompt: Y (clean and retry)
Result: Clean build + retry
Success Rate: Medium-High (may fix transient issues)
```

---

## Summary

The cleanup confirmation system gives you:
- ✅ **Control** over when to clean
- ✅ **Transparency** about what will be cleaned
- ✅ **Speed** by skipping unnecessary cleanups
- ✅ **Safety** by preventing accidental deletions

**Recommended Workflow:**
1. **First build**: Choose **Y** (clean)
2. **Development builds**: Choose **N** (skip)
3. **Build failures**: Choose **Y** (clean and retry)
4. **End of day**: Choose **Y** (clean for next day)
