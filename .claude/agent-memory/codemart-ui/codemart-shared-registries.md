---
name: codemart-shared-registries
description: CodeMart single sources for routes, images, flavor data and ledger text; use them instead of literals
metadata:
  type: project
---

- Routes: `components/public-home/cmPublicRoutes.ts` (CM_PUBLIC_ROUTE, CM_PROTECTED_ROUTE, CM_ADMIN_ROUTE, cmRouteWithQuery, cmProjectPath, cmTaskPath, cmAdminUserPath, cmWorkspacePath, CM_TASK_QUERY_PARAM). No `'/codemart/...'` literal elsewhere.
- Images: `assets/cmImageRegistry.ts` (name -> width, height, altKey, lazy; glob of images/*.webp and icons/*.webp). Render with `components/CmImage.tsx`; public pages wrap it as CmPublicIllustration. No direct `.webp` imports. CM_ICON_SPECS is the icon slot (icons are 128x128 WebP from the lead's generator).
- Flavor data: `cmFlavor.ts` reads `shell/flavor.ts` FLAVOR_REGISTRY (version, icon.svg URL); flavor.json is the only version declaration.
- Wallet ledger rows: `description_code` + `description_params` -> cm `wallet.ledger.<code>`; stored description only when the code is empty. Keys must equal CodeMartV1Constants LEDGER_* values.

**Why:** codemart-ui-G1 (d9-03, cmpolish-IMG-01, cmdesign-13, CKA-28-ui) centralized these.

**How to apply:** extend the registry/route module instead of adding local constants; the zh register is 你 (never 您), glossary terms 交付物/保证金/评审员.
