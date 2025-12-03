# Pages Directory Indicator

⚠️ **DO NOT EDIT FILES IN THIS DIRECTORY DIRECTLY**

This `pages/` directory is automatically managed by the multi-app architecture system.

## Current Active App

**App Name:** ittools
**Source Directory:** `app_ittools_pages/`

## How It Works

1. The `pages/` directory is **recursively cleared and repopulated** when switching apps
2. All files are copied from `app_ittools_pages/` to `pages/`
3. Any changes made directly to `pages/` will be **lost** when switching apps

## How to Modify Pages

**✅ CORRECT:** Edit files in `app_ittools_pages/`
- Changes persist across app switches
- Source of truth for app pages

**❌ WRONG:** Edit files in `pages/`
- Changes will be overwritten
- Not the source of truth

## Architecture Guide

For complete architecture documentation, see:
`development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`

## Switching Apps

To switch to a different app:
```bash
node scripts/switch-app.js [appname]
```

Available apps: admin, codemart, dashboard, dev, example, ittools, pymatrix, main
