# React Native Multi-App System Rebuild Test Log

## Test Date: 2025-12-03

## Current Configuration
- Project Root: `D:\programing\core_node\poly_apps\react_native`
- External Safe Build: **DISABLED** (`use_external_safe_build = false`)
- Target App: `awy` (AnWuYou / SafeGuardian)

---

## Test Plan

### Phase 1: File Verification
- [ ] Step 1.1: Verify all Python scripts exist
- [ ] Step 1.2: Verify build_config.ini readable
- [ ] Step 1.3: Verify app.json, index.js, AndroidManifest.xml

### Phase 2: Python Scripts Test
- [ ] Step 2.1: Test main_launcher.py (menu display)
- [ ] Step 2.2: Test app_switcher.py (app switching)
- [ ] Step 2.3: Test file variable system

### Phase 3: PowerShell Integration
- [ ] Step 3.1: Test FileVarReader.ps1
- [ ] Step 3.2: Test start.ps1 initialization
- [ ] Step 3.3: Test full workflow

### Phase 4: App Switching Validation
- [ ] Step 4.1: Verify app.json updated correctly
- [ ] Step 4.2: Verify index.js updated correctly
- [ ] Step 4.3: Verify AndroidManifest.xml updated correctly
- [ ] Step 4.4: Verify Metro config (if needed)

---

## Test Results

### Phase 1: File Verification

#### Step 1.1: Python Scripts
```
✓ app_scanner.py
✓ app_switcher.py
✓ default_config.py
✓ file_var_system.py
✓ global_var_manager.py
✓ interactive_menu.py
✓ main_launcher.py
```

#### Step 1.2: build_config.ini
```
app_name = AnWuYou
display_name_english = SafeGuardian
default_package_id = com.anwuyou.app
use_external_safe_build = false
```

**Issue Found**: Chinese characters display as garbled text
**Status**: Non-critical, English name works

---

## Issues Found

### Issue 1: UTF-8 BOM in app.json
**Status**: FIXED - Changed encoding from 'utf-8' to 'utf-8-sig'

### Issue 2: PowerShell output capture blocks interactive menu
**Status**: FIXED - Changed from `$output = python ... 2>&1` to `& python ...`

### Issue 3: Chinese character encoding in build_config.ini
**Status**: Open - Need to investigate

---

## Next Steps

1. Test app_switcher.py standalone
2. Fix any remaining encoding issues
3. Test full start.ps1 workflow
4. Verify app switching works end-to-end
