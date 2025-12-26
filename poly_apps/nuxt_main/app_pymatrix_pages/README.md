# PyMatrix App Pages Directory

This directory contains page files for the PyMatrix application.

## Architecture

According to the Nuxt Multi-App Architecture (development-guides/NUXT_MULTI_APP_ARCHITECTURE.md):

- **Source of Truth**: This `app_pymatrix_pages/` directory
- **Active Directory**: `pages/` (auto-managed by switch-app.js)
- **DO NOT** edit files in `pages/` directly - changes will be lost when switching apps

## Entry Point Pattern

Each `index.vue` should ONLY import a single component with all logic in the app component:

```vue
<template>
  <PyMatrixApp />
</template>

<script setup lang="ts">
import PyMatrixApp from '@/app_pymatrix_pages/components/pymatrix_index/PyMatrixApp.vue';
</script>
```

## Usage

To switch to pymatrix app pages:

```bash
cd poly_apps/nuxt_main
node scripts/switch-app.js pymatrix
```

This will:
1. Backup current `pages/` directory
2. Clear `pages/` directory
3. Copy all files from `app_pymatrix_pages/` to `pages/`
4. Create indicator file `pages/INDEX.md`
