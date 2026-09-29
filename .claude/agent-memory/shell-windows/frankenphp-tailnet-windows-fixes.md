---
name: frankenphp-tailnet-windows-fixes
description: Step175 on the dual-boot desktop needed 3 fixes; the Windows tailnet name is desktop-1l9k06n, the Linux side is debian-gpu (separate nodes)
metadata:
  type: project
---

This machine dual-boots: Windows = tailnet node `desktop-1l9k06n`, Linux = `debian-gpu` (different Tailscale nodes; `debian-gpu` shows offline while Windows is booted). Target URL is always `https://<current OS machine name>.thresher-python.ts.net`, auto-detected.

Step175 (`Step175_LaravelMainStart.ps1`) failed until three bugs were fixed: (1) `Set-PAServer` was never called before `Get-PAAccount` in `FrankenPhpCertificateManager.ps1` (now `$script:FrankenPhpCertificateAcmeServer = 'LE_PROD'`); (2) `Get-FrankenPhpLanCertificateMaterial` took the first `*.crt` in the shared certs dir, i.e. the stale `debian-gpu` one, and now prefers the current machine's DNS name; (3) `ConvertTo-WinswXmlText` rejected empty env values (`CADDY_SERVER_*=`) so WinSW registration failed.

**Why:** the certs dir `D:\www\core_node\certs\local` is shared by both OSes, so stale files from the other OS are always present.

**How to apply:** any script picking cert/host files from a shared dir must match on the current machine name, not glob the first file. `mkcert -install` can block on a Windows trust dialog in a non-interactive run; verify with a short `timeout`. Test with `curl https://desktop-1l9k06n.thresher-python.ts.net/pycore-manager`. See [[dot-sourced-servicecontract-shadows-module]].
