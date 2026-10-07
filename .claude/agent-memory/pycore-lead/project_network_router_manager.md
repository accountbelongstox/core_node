---
name: project-network-router-manager
description: 2026-10-06 network router (NAT gateway) pycore library + pycore-manager page: where it lives, delegation to 113_natgateway.sh, relay policy, unverified Windows path
metadata:
  type: project
---

Network router manager: `pycore/pyutils/network_router/` (constants + `network_router` service instance), routes `callmodule/rpc_routes/network_router_routes.py` (`ui/network_router/status|logs|action`), UI `apps/pycore-manager/pages/PcNetworkRouterPage.tsx` (+ `PcNetworkRouterLocales.ts`, `core/integrations/pycore/PycoreApiNetworkRouter.ts`).

- Status is read from router.conf, /run/ncore-natgateway/applied.*, dnsmasq leases, sysfs, systemd (all world-readable); start/stop/restart/logs/report delegate to `113_natgateway.sh` (Linux, `sudo -n` when not root) or `Step73_InstallNetworkRouter.ps1` (Windows, only when pycore is elevated).
- Relay policy: status = general_read; logs and action = denied (direct pycore only).
- Windows path is untested (no Windows host); sidebar entry is always listed, the page shows a not-installed state.

**Why:** user asked for router management in the 13054 pycore-manager. **How to apply:** extend the same service for new router actions (e.g. set-dhcp) by adding a CLI command passthrough, not by re-implementing gateway logic. See [[project-pycore-pitfalls]].
