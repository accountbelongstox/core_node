---
name: headscale-windows-switch
description: 2026-10-03 local Windows (desktop-1l9k06n) switched to Headscale; guide trap with silent site skip; leftovers
metadata:
  type: project
---

Local Windows host joined Headscale 2026-10-03 as 100.64.0.3 (desktop-1l9k06n.mesh.si.12gm.com); contract `hosts.tailnet_nuul` updated to it (uncommitted, tree had unrelated pycore autostart WIP so gitsync was skipped).

**Why:** `Invoke-MeshProviderConverge` only converges the HTTPS site when the FrankenPhp functions are loaded; with only TailscaleCommon.ps1 it returns True and skips the site silently (self HTTPS then fails the TLS handshake). Fixed in docs_fix/GUIDE_HEADSCALE_SWITCH.md step 5.

**How to apply:** after any mesh switch, curl the machine's own `https://<name>.mesh.../laravel-api/api/health`. `api.<name>.mesh...` does not resolve (needs headscale dns-subdomain-resolve / policy). Not changed: `code_sync_peers.json` (codesync frozen, still old IP), `tailnet_api`/`tailnet_lan` (other devices not switched yet), README/prompt mentions of 100.101.149.39. node CLI prints a libuv assertion on exit on this host but the call succeeds.
