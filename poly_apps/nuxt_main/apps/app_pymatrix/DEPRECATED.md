# ⚠️ DEPRECATED DIRECTORY

**This directory is DEPRECATED and should not be used.**

## Migration Status

All code has been migrated to the new structure:
- **New Location:** `app_pymatrix_pages/`
- **Migration Date:** 2025-12-04

## Directory Mapping

| Old Path | New Path |
|----------|----------|
| `apps/app_pymatrix/components_app_pymatrix/` | `app_pymatrix_pages/components/` |
| `apps/app_pymatrix/composables_app_pymatrix/` | `app_pymatrix_pages/composables/` |
| `apps/app_pymatrix/stores_app_pymatrix/` | `app_pymatrix_pages/stores/` |
| `apps/app_pymatrix/i18n_app_pymatrix/` | `app_pymatrix_pages/i18n/` |
| `apps/app_pymatrix/config_app_pymatrix/` | `app_pymatrix_pages/config/` |
| `apps/app_pymatrix/services_app_pymatrix/` | `app_pymatrix_pages/services/` |
| `apps/app_pymatrix/utils_app_pymatrix/` | `app_pymatrix_pages/utils/` |
| `apps/app_pymatrix/layouts_app_pymatrix/` | `app_pymatrix_pages/layouts/` |
| `apps/app_pymatrix/constants_app_pymatrix/` | `app_pymatrix_pages/constants/` |

## Action Required

**DO NOT** use files from this directory. All imports should reference `app_pymatrix_pages/` instead.

This directory can be safely deleted after verifying all references have been updated.

## Verification

To check for remaining references:
```bash
grep -r "apps/app_pymatrix" --include="*.vue" --include="*.ts" --include="*.js"
```




