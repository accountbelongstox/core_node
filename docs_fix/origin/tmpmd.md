 本轮实现进度汇报：

 Phase 1 后端（已完成核心）

 契约同步（Batch A）

 - config/queue_center_contract.json：channels→topics、

   relay_channel_auth→relay_hub_auth（/api/relay/hub-auth）

   、新增 relay.hub 块

   （path/token_ttl/cookie/anonymous:false）、events 增

   roster.update

 - config/service_contract.json：新增

   frankenphp_http/https/admin 端口 + planes 块（默认

   frankenphp、nginx 专属端口、迁移窗口端口标注）

 - QueueCenterContract.php：relayChannel→relayTopic，新增

   relayHub()/relayHubString/Int/Bool

 服务层 app/Services/Relay/（新增 8 个）

 - RelayPairRegistry - UI 侧配对 TTL 真值（与机器心跳共同构

   成 R3 双端在线门控）

 - RelayRequestStore - 请求/响应存取（TTL 过期即弃，无离线转

   发）

 - RelayBlobStore - 磁盘分块 blob，chunk/总量双上限强制

 - RelayHubJwt - 唯一 JWT 工厂（lcobucci HS256；发布者/订阅

   者同构不同 claim）

 - RelayHubPublisher - mercure_publish() 进程内优先，POST+发

   布者 JWT 兜底（密钥不出进程）

 - RelayDispatcher - 门控 + 私有 relay.request/response + 公

   有 roster.update 唤醒发布

 - RelayHubAuthService - 按身份（机器/UI 会话）颁发 topic 限

   域短期订阅者 JWT + subscribe_url

 - RelayCapabilityRegistry - 契约驱动能力提供者声明

 控制器与路由

 - RelayController（12 端点

   ：machines/register/heartbeat/unregister/hub-auth(含

   HttpOnly cookie)/pair/requests/responses/blobs + 有界 25s

   长轮询）

 - routes/api/relay.php（机器侧 PycoreClientOnly，已挂入

   api.php）

 - composer.json：lcobucci/jwt ^5.4 + symfony/mercure ^0.6

 - RealtimeConnectionService：新增 hubConnection()，Reverb

   形态标记 legacy（迁移窗口）

 Phase 0 前置（已开工）

 - gvar_[common.sh](http://common.sh)：平面常量唯一解析器

   （web_server_plane/php_runtime_plane/set_*，默认

   frankenphp，禁止各脚本自行解析）

 - 已核对：laravel_run_[runtime.sh](http://runtime.sh) 本就 env 驱动

   （OCTANE_SERVER），132 分支可直接切 frankenphp 并跳过

   Reverb

 下一轮（按序）

 1. Phase 0 剩余：common/frankenphp_[manager.sh](http://manager.sh) +

    28_install_[frankenphp.sh](http://frankenphp.sh)（幂等安装/dnspod xcaddy 模块探

    测/26-27 互斥/端口守卫）

 2. selector_[common.sh](http://common.sh) 菜单项、32-35 平面分支、132

    frankenphp 分支（单进程 + MERCURE 密钥注入 secret

    store）

 3. PHP 端 ServerManagerV1FrankenPhpManagerCtl + Caddyfile

    构建器（SYNC CONTRACT）

 4. 之后进入 pycore 端 mercure_[client.py](http://client.py) 类库抽取

 [compaction]

 Compacted from 115,582 tokens

 Goal

 - Evaluate and design a "pycore UI ↔ pycore relay through

   Laravel central server" feature (reference

   docs_fix/origin/b.txt), with 4-group topology and

   laravel_main as central server

 - Relay entry = user selects an https:// pycore backend (no

   :59000, server-side reverse-proxied) -> UI notifies +

   defaults to relay; http://...:59000 selections keep

   direct connection; UI always-on with Laravel; designation

   of an online machine -> paired-group state

 - Mercure pivot (binding, fully applied): FrankenPHP

   built-in Mercure hub completely replaces Reverb; design

   doc now split into 4 part files (+ index stub)

 - LATEST (final user message): START IMPLEMENTATION —

   adjust doc conflicts per Mercure solution; implement

   Phase 0 (FrankenPHP prerequisite) first while

   simultaneously implementing backend, then extend pycore

   library, then implement UI; follow norms; search official

   docs

 Constraints & Preferences

 - Doc order: requirements -> research -> implementation

   plan; doc-first for every spec change; design docs now

   live as 4 part files (PART_0–PART_3) + index — keep this

   structure

 - Basic norms (binding, restated at head of every part

   file; full text PART_1 §1.9): build from underlying

   architecture (no patches/thin compat layers, latest

   specs); merge common libraries/duplicate implementations;

   consult official docs; no multiple agents; develop

   strictly per spec; shells never use

   exit-code/return-value chaining, trust previous

   function's result, detect binaries by file probing

 - AI SPECIAL ATTENTION RULES headers in scripts:

   English-only code, never tests, never docs/summaries in

   source, variables at file top, PS1 path rules

 - Mercure JWT keys (publisher_jwt/subscriber_jwt) never

   ship to pycore/browser/extension; tokens never in URLs;

   relay is transport-only (no route forking); no tests, no

   git ops

 Progress

 ### Done

 - [x] Backend deep code research (contract system, cache

       store, outbox pattern, Reverb config,

       PycoreClientOnly middleware, ApiResponse envelope,

       pycore WS consumer, nginx manager/selector/menu

       structure — as in prior summary)

 - [x] Backend code written pre-pivot:

       config/queue_center_contract.json v25 relay block

       (with channels key + 12 endpoints incl.

       /api/relay/channel-auth),

       config/service_contract.json (+reverb_backend: 8080),

       QueueCenterContract.php relay accessors

       (relayChannel() etc.), RelayMachineRegistry.php

       (heartbeat TTL presence — unchanged by pivot)

 - [x] Mercure official research completed: [mercure.rocks](http://mercure.rocks)

       spec — deployed hub implements v0.x stable (?topic=

       param, JWT mercure claim

       {publish:[...],subscribe:[...]}, private updates,

       mercureAuthorization HttpOnly cookie for browsers

       since EventSource can't set headers, Last-Event-ID

       reconciliation, subscription API/events =

       experimental connection-level presence only);

       1.0-alpha draft (OAuth authorization_details,

       match_*, RFC9728) NOT deployed — design binds to

       v0.x. FrankenPHP docs: mercure { publisher_jwt;

       subscriber_jwt; [anonymous] } Caddyfile block

       (publisher_jwt requires subscriber_jwt; anonymous =

       JWT-less public updates — we disable it), hub at

       /.well-known/mercure, mercure_publish(string|array

       $topics, string $data='', bool $private=false,

       ?string $id, ?string $type, ?int $retry): string

       in-process publish, authenticated POST alternative,

       symfony/mercure component option

 - [x] Doc split into 4 parts with full Mercure pivot

       applied (user: “现在文档写为4部文...根据上下文查看是

       否有补弃更新”； one document per turn):

     - ..._PART_[0.md](http://0.md) — single octane:frankenphp process,

       built-in Mercure hub on 443/h3, NO Reverb//app/* on

       default plane, reverb_backend =

       migration-window-only, W1–W4

       (28_install_[frankenphp.sh](http://frankenphp.sh) + frankenphp_[manager.sh](http://manager.sh),

       dual-end manager, 132 branch, menu/32–35), acceptance

       P0-A1..A6 (P0-A4 = SSE + mercure_publish roundtrip,

       no Reverb)

     - ..._PART_[1.md](http://1.md) — R1–R9 (new R9 plane gating: relay

       frankenphp-plane only), H2 rewritten (no WebSocket on

       default plane; SSE rides h3; RFC 9220 exception

       deleted), R7 = Mercure JWT keys rule, A1–A7, §1.9

       norms

     - ..._PART_[2.md](http://2.md) — §2.1 code findings (+pre-pivot

       artifact sync list), §2.2.3 Mercure protocol (v0.x vs

       1.0-alpha), §2.2.4 FrankenPHP hub (incl. decision:

       symfony/mercure + lcobucci/jwt for signing),

       Reverb/broadcasting marked LEGACY, §2.3 answer

       rewritten

     - ..._PART_[3.md](http://3.md) — topic layout (pycore.machines public

       updates / pycore.pair.{machineId} private /

       queue-center migration target), RelayPairRegistry

       gate, protocol v1 (mercure_publish(..., private:

       true, type: 'relay.request'); v1 ships UI long-poll

       ?wait=1 bounded ~25s with wake update as latency

       hook; pycore 400ms fallback poll), §3.5 hub-auth

       JWT/cookie security, §3.7 file-touch list + sync

       renames, §3.8 binding order Phase

       0→backend→pycore→UI→audit→Phase 5 Reverb retirement,

       §3.9 risks, §3.10 checklist

     - Original ..._[HTTP3.md](http://HTTP3.md) rewritten as INDEX stub (no

       content — single source in part files)

 - [x] Basic norms added to every document (PART_0/2/3: full

       “Basic norms (binding for this part)” section in

       header; PART_1: header note pointing to §1.9; index:

       one-line summary)

 ### In Progress

 - [ ] Implementation kickoff per final user message: Phase

       0 (FrankenPHP prerequisite) + backend simultaneously,

       then pycore library, then UI — not yet started (docs

       + research just finished)

 ### Blocked

 - (none)

 Key Decisions

 - v0.x protocol binding: code against deployed v0.x (topic

   param + mercure claim), not the 1.0-alpha OAuth draft; no

   reliance on experimental subscription events —

   RelayMachineRegistry stays roster/gate authority

 - Hub auth model: anonymous OFF; short-lived (600s) HS256

   subscriber JWTs with mercure.subscribe scoped topics from

   /api/relay/hub-auth (renamed from channel-auth); browsers

   get Set-Cookie: mercureAuthorization=...;

   Path=/.well-known/mercure; HttpOnly; Secure;

   SameSite=Strict; Max-Age=600; pycore uses Authorization:

   Bearer; publisher key server-side only, primary publish =

   in-process mercure_publish()

 - Required sync renames of already-written code (first

   Phase 1 step): contract relay channels -> topics;

   /api/relay/channel-auth -> /api/relay/hub-auth; add hub

   block (token_ttl: 600, cookie: mercureAuthorization,

   anonymous: false); QueueCenterContract::relayChannel() ->

   relayTopic() + new relayHub() accessors; reverb_backend

   annotated migration-window-only; RelayMachineRegistry

   unchanged

 - Gate = RelayMachineRegistry (written) + RelayPairRegistry

   (new): machine heartbeat fresh AND pair active (TTL 60s)

   else 409 peer-offline

 - v1 response path: UI long-poll (~25s bounded) +

   relay.response private wake update as optimization;

   pycore 400ms fallback poll covers SSE gaps; caps

   8KB/256KB/4MB/32MB

 - JWT signing: symfony/mercure + lcobucci/jwt (official

   pairing per FrankenPHP docs; no hand-rolled signer;

   laravel_main vendors none today)

 - No WebSocket on default plane: SSE is plain HTTPS, rides

   h3 — H2's old wss exception deleted; nginx compat plane

   keeps frozen Reverb legacy (relay not served there per

   R9); Phase 5 retires Reverb (daemon, port, queue-center

   channel, LaravelReverbConnection, wordnew-social

   migration decision point)

 - Server-side long-poll concern resolved in docs: v1 ships

   bounded (~25s) long-poll for UI responses (PART_3 §3.2),

   wake updates are the latency hook — follow PART_3 as

   written

 Next Steps

 1. Phase 0 (per PART_0): plane constants

    (WEB_SERVER_PLANE/PHP_RUNTIME_PLANE single resolver,

    persisted global vars), 28_install_[frankenphp.sh](http://frankenphp.sh) +

    common/frankenphp_[manager.sh](http://manager.sh) (idempotent, xcaddy dnspod

    build w/ frankenphp list-modules probe, mutual exclusion

    with 26/27), PHP-end ServerManagerV1FrankenPhpManagerCtl

     + Caddyfile builder (mercure block w/ JWT keys from

    secret store), 132 frankenphp branch (single supervised

    octane:frankenphp, octane config 'mercure' block, no

    Reverb start), selector_[common.sh](http://common.sh) MENU_CONFIG entry +

    32–35 plane flows, service_contract.json frankenphp

    ports

 2. Simultaneously backend (Phase 1, per PART_3 §3.7–3.8):

    apply sync renames first; then RelayPairRegistry,

    RelayRequestStore, RelayBlobStore, RelayDispatcher (gate

    + mercure_publish + POST fallback), RelayHubAuthService

    (JWT + cookie), RelayCapabilityRegistry, RelayController

    + /api/relay/* routes, RealtimeConnectionService hub

    form, config/octane.php frankenphp+mercure, composer

    require symfony/mercure lcobucci/jwt

 3. Verify Phase 1: tinker publish -> authorized curl SSE

    subscriber; fake-machine request -> 409 peer-offline;

    Caddy validate; h3 on hub

 4. pycore (Phase 2): extract ONE shared

    pyutils/common/mercure_[client.py](http://client.py) (SSE GET + Bearer,

    Last-Event-ID resume, reconnect/backoff, token refresh;

    merges snapshot_service WS consumer onto topics), thin

    pyctl/relay/ (registry loop, pair subscription,

    executor, poster)

 5. UI (Phase 3): pycoreTarget.ts full-URL rebuild,

    PycoreRelayTransport.ts, LaravelAPI.ts relay methods +

    hub-auth fetch, LaravelMercureConnection.ts (native

    EventSource), RelayCapabilities.ts,

    PcPycoreTargetSwitcher.tsx

 6. HTTP/3+SSE audit (A6), hardening, then Phase 5 Reverb

    retirement (after fleet migrated; incl. wordnew-social

    decision)

 Critical Context

 - Docs now:

   docs_fix/DESIGN_20260817_2115_PYCORE_UI_RELAY_GROUPS_HTTP

   [3.md](http://3.md) (INDEX only) + ..._PART_[0.md](http://0.md) / ..._PART_[1.md](http://1.md) /

   ..._PART_[2.md](http://2.md) / ..._PART_[3.md](http://3.md) (~13KB/12KB/16KB/19KB);

   requirements source docs_fix/origin/b.txt

   (FrankenPHP/Mercure revision)

 - Backend files already written (need sync renames in Phase

   1): config/queue_center_contract.json (v25 relay block),

   config/service_contract.json,

   poly_apps/laravel_main/app/Support/[QueueCenterContract.ph](http://QueueCenterContract.ph)

   p,

   poly_apps/laravel_main/app/Services/Relay/RelayMachineReg

   istry.php

 - Key repo paths: poly_apps/laravel_main (Octane+Reverb

   pair today), poly_apps/pycore_laravel_wordnew_ui

   (pycore-manager/laravel-manager/wordnew), pycore/ (HTTP

   RPC :59000, pyctl/queue_center/snapshot_[service.py](http://service.py) WS

   consumer to migrate), scripts/shells/linux/common/

   (nginx_[manager.sh](http://manager.sh), selector_[common.sh](http://common.sh), gvar_[common.sh](http://common.sh)),

   scripts/shells/linux/debian/install_shells/

   (26/27/32–35/132), menu_itemshells/app_install_[menu.sh](http://menu.sh) +

   service_[manager.sh](http://manager.sh)

 - Conventions: ApiResponse trait

   ({success,data,message,code,status}), database cache

   driver, PycoreClientOnly header auth, machineId =

   hostname-stable worker_id family

   (^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$), relay heartbeat

   20s/offline 45s/pair TTL 60s/poll 400ms

 - FrankenPHP facts: install curl

   [https://frankenphp.dev/install.sh](https://frankenphp.dev/install.sh) | sh; octane:frankenphp

   --https --caddyfile --admin-port; dnspod module via

   xcaddy build --with github.com/caddy-dns/dnspod (Go

   toolchain); DNSPod creds readable in 132; reserved SSE

   type values: relay.request, relay.response, roster.update

    (never mercure)

 - Related docs:

   DESIGN_20260814_QUEUE_CENTER_MACHINE_[AUTHENTICATION.md](http://AUTHENTICATION.md)

   (machine enrollment, hub-auth identity),

   FIX_20260802_UI_EXCHANGE_HUB_[ARCHITECTURE.md](http://ARCHITECTURE.md),

   FIX_20260817_NEXUS_DASH_HTTP3_DOMAIN_[BINDING.md](http://BINDING.md) (h3

   verified); date context 2026-08-17

 ───────────────────────────────────────────────────────────

 Turn Context (split turn):

 Original Request

 用户要求（中文）：开始实现。以 Mercure 技术方案落地。实现顺

 序：先实现前置（Phase 0：FrankenPHP 服务平面），同时实现后

 端（Phase 1），再扩展 pycore 端类库，最后实现 UI 端。按项目

 规范执行，并搜索官方文档核对。

 Early Progress

 - 官方文档核对：Laravel Octane FrankenPHP 确认为

   octane:start --server=frankenphp --caddyfile=...

   --admin-port=2019 --https（443、h2/h3）。

 - Batch A（后端同步改名）已完成，3 个文件：

     1. config/queue_center_contract.json（schema_version

        25）：端点 relay_channel_auth →

        relay_hub_auth（/api/relay/hub-auth）；relay 块

        channels → topics（machines: pycore.machines、pair:

        pycore.pair.{machine_id}）；新增 hub 块（path:

        /.well-known/mercure、token_ttl_seconds: 600、

        cookie: mercureAuthorization、anonymous:

        false）；events 增加 roster: roster.update。

     2. config/service_contract.json：新增端口

        frankenphp_http: 80、frankenphp_https: 443、

        frankenphp_admin: 2019；新增 planes 块

        （web_server_default: frankenphp、

        nginx_plane_only_ports: [laravel_api_backend]、

        migration_window_ports: [reverb_backend]）。

     3. app/Support/QueueCenterContract.php：relayChannel()

        → relayTopic()（同样的 {token} 插值）；新增

        relayHub()/relayHubString()/relayHubInt()/relayHubBo

        ol() 访问器；注释更新为 Mercure 术语。

 - 规划了后续批次：Batch B = Phase 1 服务（RelayPairRegistry

   、RelayRequestStore、RelayBlobStore、RelayDispatcher、

   RelayHubAuthService、RelayCapabilityRegistry、

   RelayController + 路由）；Batch C = Phase 0

   shell（gvar_[common.sh](http://common.sh) 平面常量解析器、

   28_install_[frankenphp.sh](http://frankenphp.sh)、frankenphp_[manager.sh](http://manager.sh)、26/27 互

   斥门、132 分支、selector MENU_CONFIG、32–35 平面感知、PHP

   ServerManagerV1FrankenPhpManagerCtl + Caddyfile 构建器、

   octane.php mercure 块、composer 依赖 symfony/mercure +

   lcobucci/jwt）。

 - realtime 块暂不改：queue-center 事件迁移到 Mercure 属

   Phase 2，现有 WS 消费方仍依赖当前 contract。

 Context for Suffix

 - 读取中的支撑文件（为写 Relay 服务做准备）：ApiResponse

   trait（success/error/codedError/unauthorized，无

   try-catch 风格）、PycoreClientOnly 中间件、

   QueueCenterCacheStore（database/PostgreSQL 缓存驱动，静态

   get()/increment()/initialize()）、routes/api.php、

   RealtimeConnectionService、worker 路由组模式。

 - 路由模式：routes/api.php 顶部有 “AI SPECIAL ATTENTION

   RULES” 注释（代码仅英文、写完即停不运行测试、不写 md/进度

   注释、不改规则）。worker 路由组用

   Route::prefix('worker')->group(...)，路径镜像 contract

   endpoints 块（单一事实源，消费方不硬编码）。

 - RelayMachineRegistry 现状：ID_PATTERN =

   /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/，INDEX_KEY =

   relay:machines:index，TTL 心跳即在线门控（R3），无清理

   cron。

 - service_contract_[common.sh](http://common.sh) 是通用 dotted-path

   getter（sc_get ports.X），新增键安全；ServiceContract.php

    第 74 行构造 [http://loopback:laravel_api_backend。](http://loopback:laravel_api_backend。)

 - Phase 5 将移除 reverb_backend；nginx 平面仅保留

   laravel_api_backend(9000) 兼容。

 - 下一步（保留段开头）：基于 worker 路由组与

   RealtimeConnectionService 的模式，撰写 Relay 服务类 +

   RelayController + relay 路由。

 <read-files>

 D:/programing/core_node/docs_fix/origin/b.txt

 D:/programing/core_node/poly_apps/laravel_main/app/Http/Mid

 dleware/ClientTokenAuth.php

 D:/programing/core_node/poly_apps/laravel_main/app/Http/Mid

 dleware/PycoreClientOnly.php

 D:/programing/core_node/poly_apps/laravel_main/app/Services

 /QueueCenter/QueueCenterCacheStore.php

 D:/programing/core_node/poly_apps/laravel_main/routes/chann

 els.php

 D:/programing/core_node/scripts/shells/linux/debian/install

 *shells/132*laravel_main_[start.sh](http://start.sh)

 D:/programing/core_node/scripts/shells/linux/debian/install

 *shells/26*install_[nginx.sh](http://nginx.sh)

 </read-files>

 <modified-files>

 D:/programing/core_node/config/queue_center_contract.json

 D:/programing/core_node/config/service_contract.json

 D:/programing/core_node/docs_fix/DESIGN_20260817_2115_PYCOR

 E_UI_RELAY_GROUPS_[HTTP3.md](http://HTTP3.md)

 D:/programing/core_node/docs_fix/DESIGN_20260817_2115_PYCOR

 E_UI_RELAY_GROUPS_HTTP3_PART_[0.md](http://0.md)

 D:/programing/core_node/docs_fix/DESIGN_20260817_2115_PYCOR

 E_UI_RELAY_GROUPS_HTTP3_PART_[1.md](http://1.md)

 D:/programing/core_node/docs_fix/DESIGN_20260817_2115_PYCOR

 E_UI_RELAY_GROUPS_HTTP3_PART_[2.md](http://2.md)

 D:/programing/core_node/docs_fix/DESIGN_20260817_2115_PYCOR

 E_UI_RELAY_GROUPS_HTTP3_PART_[3.md](http://3.md)

 D:/programing/core_node/poly_apps/laravel_main/app/Services

 /Relay/RelayMachineRegistry.php

 D:/programing/core_node/poly_apps/laravel_main/app/Support/

 QueueCenterContract.php

 </modified-files>

