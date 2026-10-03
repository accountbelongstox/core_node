# Temporary guide: switch a host to Headscale (AI-executable)

Scope: move one machine from the Tailscale SaaS control plane to the self-hosted Headscale server. Design: `DESIGN_SHELL_HOSTS.md` §6.5. Remove this guide once every host is switched.

Live facts (read them, never hardcode): login server `https://hs.<region>.<root>` and MagicDNS domain `mesh.<region>.<root>` come from contract `access.mesh.headscale`; today `https://hs.si.12gm.com` and `mesh.si.12gm.com`. Phones use the pycore-manager page **Mesh Login** (`/pycore-manager/mesh-login`).

## Rules
- Never print, log, commit or store a pre-auth key. Mint a single-use key per machine (24h) and pass it straight into the login command.
- Never log out of the current control server before step 2 passes (the converge enforces this too).
- One machine at a time; finish step 6 before the next one.

## 1. Sync code
- Linux: `dd.sh gitsync -m "headscale switch <host>"`
- Windows: `dd.cmd gitsync -m "headscale switch <host>"`

## 2. Check the server
`curl -fsS https://hs.si.12gm.com/health` must print `{"status":"pass"}`. An empty 200 is the wildcard site, not Headscale: stop and report.

## 3. Set the provider (mutual exclusion; the setter writes the mirror keys)
- Linux: `bash -c 'source scripts/shells/linux/common/gvar_common.sh; set_mesh_vpn_provider headscale'`
- Windows (admin PowerShell, repo root):
  ```powershell
  . (Join-Path (Resolve-Path .) 'scripts\shells\win\win_common\TailscaleCommon.ps1')
  Set-MeshVpnProvider -Provider headscale
  ```

## 4. Join with a fresh single-use key
The key is minted by the Laravel beside Headscale (`POST /api/system/mesh/preauth-key`, client key signed) and consumed in the same command.
- Linux:
  ```bash
  KEY="$(node ncore/foundation/common/laravel_signed_cli.js request POST /api/system/mesh/preauth-key | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s.slice(s.indexOf("{"))).data.key))')"
  sudo tailscale logout; sudo tailscale up --login-server=https://hs.si.12gm.com --authkey="$KEY" --accept-routes; unset KEY
  ```
- Windows (admin PowerShell):
  ```powershell
  $raw = node ncore\foundation\common\laravel_signed_cli.js request POST /api/system/mesh/preauth-key | Out-String
  $key = ($raw.Substring($raw.IndexOf('{')) | ConvertFrom-Json).data.key
  tailscale logout; tailscale login --login-server=https://hs.si.12gm.com --authkey=$key; Remove-Variable key, raw
  ```
- No key possible (CLI unreachable): run the login without `--authkey`, read the `hskey-authreq-…` auth ID from the printed URL, and approve it on the pycore-manager Mesh Login page (or `node ncore/foundation/common/laravel_signed_cli.js request POST /api/system/mesh/register --json '{"auth_id":"<id>"}'`).

## 5. Converge (flags, HTTPS site, certificates)
- Linux: `sudo bash scripts/shells/linux/debian/install_shells/97_install_tailscale.sh` (re-applies `--accept-routes`/operator, renders `<machine>.mesh.<region>.<root>` with an acme.sh DNS-01 certificate).
- Windows: `Invoke-MeshProviderConverge` (same session as step 3).
Both are idempotent; a rerun changes nothing.

## 6. Verify
- `tailscale debug prefs` → `"ControlURL": "https://hs.si.12gm.com"`; `tailscale status` lists `vm-0-2-debian` (100.64.0.1).
- `tailscale ping vm-0-2-debian` answers; `getent hosts vm-0-2-debian.mesh.si.12gm.com` (Linux) / `Resolve-DnsName vm-0-2-debian.mesh.si.12gm.com` (Windows) resolves.
- `curl -fsS https://<this-machine>.mesh.si.12gm.com/laravel-api/api/health` from another node returns 200 with a valid certificate.
- Report the machine's new name and 100.64.x.y address; contract `hosts.tailnet_*` IPs change after the switch.

## Phones
Open pycore-manager → **Mesh Login**: it shows the login server, mints a single-use key, gives Android/iOS steps and approves key-less (iOS) logins by auth ID.

## Rollback
Set the provider to `tailscale` (step 3 with `tailscale`), then step 5. The node returns to the SaaS tailnet after a browser login. Headscale data on the server is kept.
