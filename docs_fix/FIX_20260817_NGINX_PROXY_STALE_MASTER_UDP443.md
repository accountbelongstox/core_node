

 ● 排查完成，未做任何修改。修复清单已写入

   /www/programing/core_node/docs_fix/FIX_20260817_NGINX_PROXY_STALE_MASTER_[UDP443.md](http://UDP443.md)。

   真正的根因（之前没抓到的）：不是"外来二进制/错误 conf-path"——这次的 master（pid 817）

   二进制和 conf-path 都是对的。是 hysteria 抢占了 UDP 443：

   • hysteria（pid 699，/etc/hysteria/config.yaml 里 listen: :443）在 01:27:07 启动并绑定

     UDP *:443，比 nginx master 早 1 秒。

   • 磁盘上的站点配置带 listen 443 quic（HTTP/3 需要 UDP 443）→ 每次 reload 都因 bind 失

     败被中止，error.log 里全是 [emerg] bind() to 0.0.0.0:443 failed (98)。

   • 于是 master 一直服务 01:27 启动时的陈旧配置：那时只有 bootstrap 桩（return 200

     'ok'），所以所有域名都返回 "ok"，且不监听 443。后端 9000 本身是好的（实测 200）。

   为什么之前的修复"成功了"却没效果——两个脚本盲区：

   1. nginx_common.sh:1367-1369：systemctl reload nginx || true 后无条件打印

      "Configuration valid; service reloaded"，从不验证监听器是否真起来了。

   2. nginx_common.sh:1148 的 conformance 只比对 master 的 exe 和 conf-path——这次两者都对

      ，但内容是陈旧的，判定"符合"直接 no-op。

   修复清单（文档里有精确行号）：

   1. UDP 443 归属，需要你决策：

       • A. hysteria 改端口（如 8443），nginx 保留 HTTP/3；

       • B. nginx 去掉 QUIC（模板 nginx_common.sh:618-622、升级注入

         nginx_manager.sh:588-595、4 个站点文件），hysteria 保留 443。

   2. 解决 1 之后 systemctl restart nginx（顺序不能反：现在直接 restart 会让 nginx 彻底起

      不来）。

   3. 修 reload 假成功：加监听器审计，失败要报 [FAIL]。

   4. 修 conformance 盲区：加"实际监听 vs 配置声明"审计；restart 前加 bind 预检。

   5. 云安全组放行 443 TCP（选 A 还要 UDP）——控制台操作，代码管不了。

   6. UI 的 /var/www/html 显示：修复代码其实已在服务器上且 Octane 13:02 已重启加载，硬刷

      新面板应已正常；若仍显示再查。



The programs included with the Debian GNU/Linux system are free software;

the exact distribution terms for each program are described in the

individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent

permitted by applicable law.

Last login: Mon Aug 17 14:39:55 2026 from 116.68.21.228

root@VM-0-2-debian:~# cd /

bin/        etc/        lib64/      mnt/        run/        sys/        www/

boot/       home/       libx32/     opt/        sbin/       tmp/

data/       lib/        lost+found/ proc/       snap/       usr/

dev/        lib32/      media/      root/       srv/        var/

root@VM-0-2-debian:~# cd /

bin/        etc/        lib64/      mnt/        run/        sys/        www/

boot/       home/       libx32/     opt/        sbin/       tmp/

data/       lib/        lost+found/ proc/       snap/       usr/

dev/        lib32/      media/      root/       srv/        var/

root@VM-0-2-debian:~# cd /www/programing/core_node/

root@VM-0-2-debian:/www/programing/core_node# cat docs_fix/FIX_20260817_NGINX_PROXY_STALE_MASTER_[UDP443.md](http://UDP443.md)

# FIX 20260817 — nginx proxy vhosts never served: stale master + UDP/443 conflict

Symptom: `http://api.si.12gm.com/` (and every other Host on :80) returns the

2-byte `ok` bootstrap stub instead of being reverse-proxied to

`http://127.0.0.1:9000`. The on-disk site files are correct; the running nginx

master never loaded them.

This document is a diagnosis + precise fix list only. No fix has been applied.

## Verified facts (measured on this server)

- Backend is healthy: `curl http://127.0.0.1:9000/` -> 200 (Laravel).

- Disk config is valid: `nginx -t -c /etc/nginx/nginx.conf` passes;

  `/www/nginxconfig/sites-available/api.si.12gm.com` has

  `proxy_pass http://api.si.12gm.com_backend` with the upstream defined in the

  same file, plus `listen 443 ssl/quic`.

- The running master `pid 817`, started 2026-08-17 01:27:08, systemd MainPID)

  answers every Host on :80 with the bootstrap stub and listens on no 443

  socket `ss -ltnp`). It serves a stale in-memory config from 01:27.

- Every reload since the QUIC site rewrite has silently failed:

  `/var/log/nginx/error.log` shows repeated

  `[emerg] bind() to 0.0.0.0:443 failed (98: Address already in use)`

  ending in `still could not bind()`. nginx aborts the reload and keeps the old

  config.

- UDP/443 is owned by hysteria: `ss -lnp` shows `hysteria (pid 699, started

  01:27:07 `bound to UDP` *:443`. Bind probe: TCP 443 OK, UDP 443 EADDRINUSE.

## Root cause chain

1. hysteria2 `/etc/hysteria/config.yaml`: `listen: :443`) owns UDP/443.

2. The managed site template emits `listen 443 quic` (HTTP/3 needs UDP/443).

3. At 01:27:08 the master started with the pre-cert bootstrap world

   `nginx_render_http_bootstrap`, `return 200 'ok'`); [api.si.12gm.com](http://api.si.12gm.com) was the

   only enabled site and became the implicit default server on :80.

4. The domain install later rewrote the sites as proxy+quic, but every reload

   dies on the UDP/443 bind, so the master serves the 01:27 stub world forever.

5. The management scripts report "Configuration valid; service reloaded"

   anyway (see item 3 below), so the failure was invisible.

## Fix list (precise, per file)

### 1. UDP/443 ownership conflict — DECISION REQUIRED (root cause)

- `/etc/hysteria/config.yaml` — `listen: :443` holds UDP/443.

- `scripts/shells/linux/common/nginx_common.sh:618-619`

  `nginx_render_tls_stanza`) — emits `listen 443 quic;` / `listen [::]:443 quic;`.

- `scripts/shells/linux/common/nginx_manager.sh:588-595`

  `nm_install_or_upgrade` site-upgrade loop) — sed-injects quic listeners into

  existing site files.

- `/www/nginxconfig/sites-available/{12gm.com,api.si.12gm.com,api.si.gm15.com,gm15.com}`

  — rendered files carrying the quic listeners.

Options (pick one):

- **A. Move hysteria off 443** (e.g. `listen: :8443`), keep HTTP/3. nginx keeps

  QUIC; hysteria clients must update their server port.

- **B. Drop QUIC from nginx**: remove the quic lines from the template

  (nginx_common.sh:618-619, also `http3 on;quic_retry on;` at 620-622), from

  the upgrade injector (nginx_manager.sh:588-595), and re-render the 4 site

  files. hysteria keeps UDP/443; HTTPS still works over TCP (HTTP/2).

### 2. Stale running master (the visible symptom)

- Not a file change — an operational step with an ordering constraint.

- After item 1 is resolved: `systemctl restart nginx` (reload re-reads the same

  in-memory world; only a fresh exec heals it).

- WARNING: restarting **before** item 1 takes nginx fully down — the new master

  aborts on the UDP/443 bind failure. Do not restart first.

### 3. Reload success is asserted, never verified

- `scripts/shells/linux/common/nginx_common.sh:1367-1369`

  `nginx_repair_sites`): runs `systemctl reload nginx || true` and then

  unconditionally prints `[nginx] Configuration valid; service reloaded`.

- Fix: after reload, verify the listeners declared in the rendered config

  (443 tcp/udp per enabled site) against `ss` output, or scan the error.log

  tail for new `[emerg]` entries; on mismatch print `[FAIL]` and return

  non-zero so callers see the truth.

### 4. Master conformance check is blind to stale content

- `scripts/shells/linux/common/nginx_common.sh:1148-1186`

  `nginx_master_conformance_ensure`) and `:1127-1141`

  `nginx_master_effective_conf`): conformance only compares the master's exe

  path and its effective conf-path. A master with the correct conf-path whose

  in-memory config is stale (reloads failing) is judged conformant -> no-op.

  That is exactly this incident.

- Fix: add a third dimension — a listener audit (configured `listen` sockets vs

  actually bound sockets) and/or a staleness check (newest enabled-site mtime

  newer than the last successful reload). Mark divergent when they mismatch.

- Same function, line 1183: the gated `systemctl restart nginx` has no bind

  pre-flight. Under a port conflict (item 1) it converts "stale but serving"

  into "down". Add a pre-flight bind probe for every configured listen socket

  before restarting.

### 5. Cloud security group (external, user action)

- Tencent Cloud SG must allow 443/TCP inbound (and 443/UDP if option A in

  item 1 is chosen). A previous external probe showed 443 filtered. This cannot

  be fixed or verified from inside the server.

- After items 1-2, verify from outside:

  `curl -i http://api.si.12gm.com/` -> expect 301 to https;

  `curl -i https://api.si.12gm.com/` -> expect the Laravel response.

### 6. UI panel "Web Directory: /var/www/html" — likely already resolved, verify

- The parse fix is present on this server:

  `poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Controllers/ServerManagerV1NginxManagerCtl.php:2139-2148`

  and

  `poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1DomainManager.php:1419`

  (proxy vhost => `config_type: proxy`, `root` inside ACME location no longer

  surfaces as web directory).

- File mtimes (12:29 / 12:32) predate the Octane backend restart (13:02:50),

  so the running backend already serves the fixed code. If the panel still

  shows `/var/www/html` after a hard refresh, reopen this item.