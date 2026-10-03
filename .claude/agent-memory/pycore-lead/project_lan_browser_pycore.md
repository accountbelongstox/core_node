---
name: project-lan-browser-pycore
description: 2026-10-03 page-host :59000 candidate for LAN browser pages; why a LAN browser still cannot reach pycore (bind, K3 key leak via dev server, no CORS/preflight for non-loopback)
metadata:
  type: project
---

UI derives `<page scheme>://<page host>:59000` (pageHostBackendUrl in core/integrations/pycore/pycoreTarget.ts, source `this_machine`) for non-loopback, non-tailnet, non-relay-domain browser pages; banner kind `lan_page`. Pycore side was NOT changed.

**Why pycore stays closed:** bind is 127.0.0.1 unless system setting `rpcLanBind=true`; non-loopback callers need K3 and browsers never sign; the Vite dev server compiles the K3 key into the bundle and listens on 0.0.0.0:13054, so any LAN browser can read the key (making browser K3 on LAN equal to no auth); the guard rejects unsigned OPTIONS preflight and CORSMiddleware only allows loopback origins.

**How to apply:** do not open LAN browser access via Vite proxy or browser signing; a safe design needs a per-device pairing/token (not the shared build key), preflight handling and dynamic CORS origins. See [[project-pycore-pitfalls]].
