# PNPM Scripts Migration Summary

## Overview
Successfully migrated all core_node initialization and build scripts from yarn to pnpm for the root project only.

## Files Modified

### 1. Root Configuration Files
- ✅ `.npmrc` - Created pnpm configuration
- ✅ `package.json` - Added pnpm engine and packageManager field
- ✅ `.gitignore` - Updated to allow root pnpm-lock.yaml
- ✅ `PNPM_MIGRATION_GUIDE.md` - Created migration documentation

### 2. Shell Scripts (Linux/Unix)

#### Main Installation Scripts
**`scripts/shells/scripts/installer_node_modules.sh`**
- ❌ `YARN_LOCK` → ✅ `PNPM_LOCK`
- ❌ `yarn install` → ✅ `pnpm install`
- ❌ Yarn availability check → ✅ pnpm availability check
- Lines modified: 32, 110-118, 134-162

**`scripts/shells/scripts/installer_node_modules/installer_node_modules.sh`**
- ❌ `YARN_LOCK_PATH` → ✅ `PNPM_LOCK_PATH`
- ❌ `YARN_AVAILABLE` → ✅ `PNPM_AVAILABLE`
- ❌ `check_yarn_availability()` → ✅ `check_pnpm_availability()`
- ❌ `install_yarn()` → ✅ `install_pnpm()`
- ❌ `yarn install` → ✅ `pnpm install`
- Lines modified: 28, 33, 92-102, 116-139, 169-177, 204-231, 247

**`scripts/shells/linux/debian/install_shells/83_core_node_finish.sh`**
- ❌ Check yarn availability → ✅ Check pnpm availability
- ❌ `yarn install` → ✅ `pnpm install`
- Lines modified: 30-43, 88-93

#### Configuration Files
**`scripts/shells/common/install_config.sh`**
- ❌ `YARN_INSTALLED_FLAG` → ✅ `PNPM_INSTALLED_FLAG`
- ❌ `is_yarn_installed()` → ✅ `is_pnpm_installed()`
- ❌ `ensure_node_modules()` references → ✅ Updated to pnpm
- Lines modified: 32, 89-103, 105-145, 353

**`scripts/shells/common/install_logic.sh`**
- ❌ "yarn" in comments → ✅ "pnpm" in comments
- Lines modified: 224-228

### 3. Node.js Scripts

**`ncore/utils/frontend_launcher/main.js`**
- ❌ `where yarn` → ✅ `where pnpm` (Windows batch script)
- ❌ `yarn install` → ✅ `pnpm install`
- ❌ `yarn dev:${namespace}` → ✅ `pnpm dev:${namespace}`
- ❌ `spawn('yarn', ...)` → ✅ `spawn('pnpm', ...)` (Linux)
- Lines modified: 120-138, 150-151, 213

### 4. Files NOT Modified (Already Support pnpm)
- ✅ `scripts/shells/linux/debian/install_shells/28_ensure_npm_packages.sh` - Already includes pnpm in package list
- ✅ `ncore/mcp_server/wait_please/install-windows.ps1` - Already uses pnpm exclusively

## Migration Impact

### Affected Operations
1. **Initial Project Setup**
   - `dd.sh` / `dd.cmd` scripts will install pnpm instead of yarn
   - Node modules installation uses pnpm

2. **Development Workflows**
   - Frontend launcher now uses pnpm for nuxt_main
   - CI/CD scripts need to be updated (see migration guide)

3. **Subprojects (NOT Affected)**
   - `poly_apps/nuxt_main` - Keeps its own package manager
   - `poly_apps/flutter_bloom` - Uses Flutter's pub/dart
   - `poly_apps/laravel_main` - Uses Composer
   - Other poly_apps - Independent package management

## Verification Checklist

- [ ] Delete `yarn.lock` and `package-lock.json`
- [ ] Run `pnpm install` in root directory
- [ ] Test `scripts/shells/scripts/installer_node_modules.sh`
- [ ] Test frontend launcher with `node ncore/utils/frontend_launcher/main.js`
- [ ] Verify dd.sh/dd.cmd scripts install pnpm correctly
- [ ] Update CI/CD pipelines to use pnpm
- [ ] Notify team members about migration

## Key Changes Summary

| Component | Before | After |
|-----------|--------|-------|
| Package Manager | yarn | pnpm |
| Lock File | yarn.lock | pnpm-lock.yaml |
| Install Command | yarn install | pnpm install |
| Run Command | yarn run | pnpm run |
| Global Install | npm install -g yarn | npm install -g pnpm |
| Check Command | command -v yarn | command -v pnpm |
| Flag Variable | YARN_INSTALLED_FLAG | PNPM_INSTALLED_FLAG |

## Total Files Modified
- **Configuration**: 3 files (.npmrc, package.json, .gitignore)
- **Shell Scripts**: 5 files
- **Node.js Scripts**: 1 file
- **Documentation**: 2 files

**Total: 11 files**

## Notes
- All modifications preserve backward compatibility with npm as fallback
- Subprojects in poly_apps/ remain independent
- Only root project migrated to pnpm
- Installation scripts now check for pnpm first, fallback to npm if not available
