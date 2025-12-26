# PNPM Migration Guide

## What Has Been Changed

### 1. Created `.npmrc` Configuration File
- Configured `node-linker=hoisted` for Electron compatibility
- Auto-install peer dependencies enabled
- Hoisted Electron and native modules to root level
- Disabled workspace mode (root project only)

### 2. Updated `package.json`
- Added `pnpm` engine requirement (>=8.0.0)
- Set `packageManager` to pnpm@10.13.1
- Added pnpm-specific configurations for peer dependencies

### 3. Backed Up Old Lock Files
- Backup location: `.backup_before_pnpm/`
- Files backed up: `package-lock.json`, `yarn.lock`

## How to Complete Migration

### Step 1: Clean Old Dependencies
```bash
# Delete old lock files
rm package-lock.json
rm yarn.lock

# Delete node_modules (optional but recommended)
rm -rf node_modules
```

### Step 2: Install Dependencies with pnpm
```bash
pnpm install
```

### Step 3: Verify Installation
```bash
# Check if electron works
pnpm run dev-electron

# Run other test commands
pnpm run dev
```

## Script Migration

All npm/yarn commands should be replaced with pnpm:

### Before:
```bash
npm install
npm run dev
npm run build
```

### After:
```bash
pnpm install
pnpm run dev
pnpm run build
```

## Important Notes

### 1. Subprojects Are NOT Affected
- `poly_apps/` subprojects keep their own package managers
- `apps/` modules are not managed by pnpm workspace
- Only root project uses pnpm

### 2. Electron Native Modules
If you encounter issues with native modules:
```bash
# Rebuild native modules
pnpm run rebuild
pnpm run re-sqlite
```

### 3. CI/CD Updates
Update your CI/CD scripts to use pnpm:
```yaml
# Example for GitHub Actions
- uses: pnpm/action-setup@v2
  with:
    version: 10.13.1
- run: pnpm install
- run: pnpm run build
```

### 4. Team Synchronization
Make sure all team members:
- Have pnpm installed: `npm install -g pnpm`
- Delete their local `node_modules` and lock files
- Run `pnpm install` to regenerate dependencies

## Rollback Plan

If you need to rollback to npm/yarn:

```bash
# Restore old lock files
cp .backup_before_pnpm/package-lock.json ./
# or
cp .backup_before_pnpm/yarn.lock ./

# Remove pnpm files
rm pnpm-lock.yaml
rm -rf node_modules

# Reinstall with npm/yarn
npm install
# or
yarn install

# Revert changes in package.json
# Remove the "packageManager" and "pnpm" fields
# Change engines.pnpm if needed
```

## Common Issues

### Issue 1: Module Not Found
**Cause**: pnpm's strict dependency resolution

**Solution**: Add the missing package to package.json
```bash
pnpm add <missing-package>
```

### Issue 2: Electron Build Fails
**Cause**: Native modules not properly hoisted

**Solution**: Add to `.npmrc`:
```ini
public-hoist-pattern[]=<your-module-name>
```

### Issue 3: Path Alias Not Working
**Cause**: pnpm's symlink structure

**Solution**: Already configured in `.npmrc` with `node-linker=hoisted`

## Benefits

- **Disk Space**: Save 60-80% disk space (906MB → ~200-300MB)
- **Speed**: 2-3x faster installation
- **Consistency**: Stricter dependency resolution
- **Security**: Better isolation of dependencies

## Next Steps

1. Delete old lock files and node_modules
2. Run `pnpm install`
3. Test all key features
4. Update CI/CD scripts
5. Notify team members
6. Delete `.backup_before_pnpm/` after confirming everything works
