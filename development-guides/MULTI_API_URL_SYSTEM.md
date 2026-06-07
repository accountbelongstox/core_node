# 多API URL切换系统 - 架构设计指南

## 🎯 系统概述

多API URL切换系统是一个高可用性架构模式，用于在多个后端API服务器之间进行自动切换和负载均衡。

### 核心价值

- ✅ **高可用性**: 单个服务器故障不影响应用运行
- ✅ **自动故障转移**: 自动检测并切换到可用服务器
- ✅ **性能优化**: 选择响应最快的服务器
- ✅ **灵活部署**: 支持本地、局域网、云端多环境

---

## 🏗️ 核心原理

### 1. 多端点配置

系统维护一个端点列表，每个端点包含：
- `id` - 唯一标识符
- `url` - 服务器地址
- `protocol` - http/https
- `port` - 端口号
- `priority` - 优先级（1最高）
- `isLocal` - 是否本地服务器
- `description` - 描述信息

### 2. 优先级测试机制

```
应用启动 → 加载所有端点 → 按优先级排序 → 遍历测试
    ↓
[端点1] 发送请求测试连通性
    ↓
    ├─ 能访问 → ✓ 选中使用 → 后台继续测试其余端点
    └─ 失败/超时 → 继续测试下一个
```

### 3. 连通性检查策略

**核心原则：能访问就算健康**
- HTTP 状态码 2xx-4xx 都认为端点可用
- 测试路径可以是任何端点（如根路径 `/` 或 `/api/health` 等）
- 超时时间通常设置为 1 秒（快速失败）
- 记录响应时间用于性能对比

### 4. 持久化策略

使用 localStorage/SessionStorage 存储：
- `api_current_endpoint` - 当前使用的端点ID
- `api_auto_detected` - 自动检测到的端点ID
- `api_user_modified` - 用户手动选择的端点ID（优先级最高）

**加载优先级**: 用户手动选择 > 自动检测结果 > 配置文件优先级

---

## 📐 系统架构

### 三层架构

```
┌────────────────────────────┐
│   应用层 (UI Layer)         │  状态显示、手动切换
└──────────┬─────────────────┘
           │
┌──────────▼─────────────────┐
│   管理层 (Manager Layer)    │  ApiManager 核心管理器
│   • initialize()            │  初始化与自动检测
│   • checkEndpoint()         │  连通性检查
│   • autoDetect()            │  自动检测最佳端点
│   • setEndpoint()           │  手动设置端点
│   • getCurrentUrl()         │  获取当前base URL
└──────────┬─────────────────┘
           │
┌──────────▼─────────────────┐
│   配置层 (Config Layer)     │  api-endpoints 端点配置
│   • ENDPOINTS 数组          │  所有端点列表
│   • buildApiUrl()           │  URL构建工具
│   • getEndpointById()       │  按ID查询
└────────────────────────────┘
```

---

## 🔧 实现步骤

### 步骤1: 定义端点配置
创建 `config/api-endpoints.ts` 文件，定义 `ApiEndpoint` 接口和 `API_ENDPOINTS` 数组，包含所有可用端点。

### 步骤2: 实现管理器
创建 `services/ApiManager.ts` 文件，实现核心方法：
- **initialize()**: 检查用户设置 → 检查自动检测结果 → 执行自动检测
- **checkEndpoint()**: 发送请求测试连通性，记录响应时间
- **autoDetectEndpoint()**: 按优先级遍历测试，找到第一个可用端点
- **setEndpoint()**: 手动设置端点，保存到 localStorage
- **getCurrentBaseUrl()**: 返回当前端点的 base URL

### 步骤3: 集成到API服务
修改 API 服务类，所有请求使用 `apiManager.getCurrentBaseUrl()` 获取动态 base URL。

### 步骤4: 应用初始化
在应用入口点调用 `apiManager.initialize({ autoDetect: true, timeout: 1000 })`。

### 步骤5: UI组件（可选）
创建端点切换器组件，显示当前状态、响应时间，提供手动切换功能。

---

## 📋 最佳实践

### 1. 端点优先级设计
- **优先级1**: 本地开发服务器 (localhost) - 无网络延迟
- **优先级2**: 局域网主服务器 (192.168.x.x) - 低延迟
- **优先级3**: 局域网备用服务器 - 主服务器故障时使用
- **优先级4**: 云端生产服务器 (https://api.domain.com) - 最稳定可靠

### 2. 超时设置建议
- 连通性检查超时: **1秒**（快速失败）
- 后台检查间隔: **60秒**
- 失败重试次数: **3次**

### 3. 错误处理策略
- 单次请求失败 → 重试
- 多次失败 → 自动切换到下一个可用端点
- 所有端点不可用 → 提示用户检查网络

### 4. 安全注意事项
- 生产环境端点使用 HTTPS
- 后端需要正确配置 CORS
- 不要在配置文件中硬编码 token
- 验证用户输入的 URL 格式

---

## 🎓 实际案例

### laravel_dashboard
**端点配置**: localhost:9000 (P1) → 192.168.50.3:9000 (P2) → 192.168.50.2:9000 (P3) → https://api.si.12gm.com (P4)

**测试方式**: 发送请求到任何端点，能响应即可用

**使用方式**: 应用启动时 `apiManager.initialize()`，API调用时 `apiManager.getCurrentBaseUrl()`

### wordflow-ai
**端点配置**: localhost:9000 (P1) → 192.168.50.3:9000 (P2) → 192.168.50.2:9000 (P3) → https://api.si.12gm.com (P4)

**UI组件**: 显示当前端点状态（绿点/红点）、响应时间、手动切换下拉菜单

---

## 📊 系统对比

| 特性 | 传统单端点 | 多URL切换系统 |
|------|-----------|--------------|
| 可用性 | ❌ 单点故障 | ✅ 多点备份 |
| 性能 | ⚠️ 固定延迟 | ✅ 自动选择最快 |
| 灵活性 | ❌ 硬编码 | ✅ 动态配置 |
| 用户体验 | ❌ 故障时无法使用 | ✅ 无感知切换 |

---

## 🎯 核心原理总结

**五层架构**:
1. **配置层** - 维护多个备用端点
2. **检测层** - 自动测试并选择最佳端点
3. **管理层** - 统一管理当前端点状态
4. **应用层** - 所有API调用使用动态URL
5. **交互层** - 用户可手动切换端点

**类似架构**: CDN多节点、数据库主从、微服务网关、DNS轮询

**应用场景**: 企业内网应用、开发/测试/生产多环境、地理分布式团队、高可用性要求

---

---

## Realized detection contract (English, authoritative — updated 2026-05-19, "API detection redundancy fix")

> This section is authoritative and **supersedes** the older "60s background
> check interval" and "select-then-background-test-the-rest" descriptions above
> for `laravel_dashboard`. The earlier flow caused a redundant-probe storm and a
> ~21s preflight hang; the realized behavior is below.
>
> **⚠️ CORRECTION 2026-05-19 — this note supersedes the earlier same-day
> "lazy / probe-only-when-the-switcher-dropdown-opens / once-only-for-switcher"
> wording that previously appeared in this section and its sibling docs.**
> Detection is **automatic at app startup**, NOT lazy and NOT click-triggered.

### Detection (frontend, `services/ApiManager.ts`)
- Detection runs **automatically at app startup** — `ApiManager` probes **ALL
  endpoints in parallel exactly once per app load**, single-flight via a stored
  `healthPassPromise` (React-18 StrictMode-safe), **no timers/intervals, no
  retries**.
- `App.tsx` triggers detection at startup and dispatches `api-health-initialized`
  after the parallel pass settles. `ApiEndpointSwitcher.tsx` is **read-only** —
  it renders results and listens for that event; it **no longer probes on
  dropdown open**.
- Active-endpoint precedence after the single parallel pass:
  1. `api_user_modified` (explicit manual choice) **if healthy** → use it.
  2. else stored `api_current_endpoint` / `api_auto_detected` **if healthy** →
     use it.
  3. else **first healthy endpoint by priority order** → use it **and write it
     back** to `api_auto_detected` / `api_current_endpoint`.
  4. else (none healthy) → highest-priority endpoint as fallback, left marked
     unhealthy.
- Principle 以能使用的为准: never hard-pin a dead endpoint; auto-failover to an
  available one. Auto-detection **NEVER overwrites `api_user_modified`** (only
  the manual switcher sets it) — a dead manual choice still yields a working
  session endpoint without deleting the saved manual key.
- The single all-endpoints parallel pass both feeds the switcher dots and drives
  selection. **No re-probe unless the user manually switches** (no timer, no 60s
  background interval). All endpoints are kept in `config/api-endpoints.ts` (no
  pruning).

### Canonical endpoint contract
| Endpoint | Behavior | Auth | Cache |
|---|---|---|---|
| `GET {base}/api/health` | `200 { status:'healthy', service, timestamp, version }`, liveness-only; cheap OPTIONS preflight via CORS fast-path, no web/Sanctum middleware | none | `no-store, max-age=0` |
| `GET {base}/api_info[?app=]` | catalog JSON (body unchanged) | as before | server `ETag` + `Cache-Control: public, max-age=300, stale-while-revalidate=600` (304 on `If-None-Match`); client 60s TTL cache + single-flight; fetched with `retry=false` |

Backend root cause that was fixed (`laravel_main`): `/api_info` is a
`routes/web.php` route; previously no `cors.php` path matched it, so the OPTIONS
preflight fell through the full web middleware stack (~21s hang). Fix:
`config/cors.php` `paths` now includes `'api/health'` and `'api_info'` and
`max_age` is `env('CORS_MAX_AGE', 86400)` (browser caches preflights);
`GET /api/health` bypasses Sanctum/session middleware; `/api_info` emits stable
ETag + `Cache-Control` and handles `If-None-Match` → 304.

### ⚠️ LINKED-CHANGE constraint (联动改)

> **The frontend probing contract and the backend `/api/health` + CORS/`cors.php`
> paths + `/api_info` caching MUST be changed together — changing one side's
> health/api_info contract, CORS paths, or cache headers without the other
> reintroduces the preflight-hang / redundant-probe bug.**

Treat the auto-parallel-once-at-startup probe / precedence / single-flight
(`healthPassPromise`) in `ApiManager.ts`, the `/api/health` route + its
middleware bypass + body shape, the `cors.php` `paths`/`max_age`, and the
`/api_info` ETag/`Cache-Control` as **one coordinated contract** — never edit
one side alone.

### noise.svg → local data-URI (frontend init hygiene — 2026-05-19)

Separate, **frontend-only** init-hygiene change for `laravel_dashboard` with
**no backend coupling** (not part of the linked health/CORS contract above): the
external decorative texture `https://grainy-gradients.vercel.app/noise.svg`
(which 404'd and triggered N failed cross-origin requests during init) was
replaced with a fully local inline SVG `feTurbulence` data URI defined once in
`poly_apps/laravel_dashboard/utils/noiseTexture.ts` and consumed by
`BentoCard.tsx` and `tools/HexToRgb.tsx`. No external/CDN dependency remains.
Not JS-blocking, but removes network/console overhead during init.

---

## Availability-first selection + cold-boot timeout (qy_capacitor / wordflow-ai — 2026-05-28)

> Authoritative for `poly_apps/qy_capacitor`. Refines the realized contract above:
> **availability is the PRIMARY sort key for endpoint selection — including for
> the value read from localStorage.** A stored choice only ranks *higher in
> weight*; it is never blindly pinned.

### Selection rule (`services/ApiManager.ts`)
- `initialize({ autoDetect: true })` probes **all endpoints once in parallel**
  (`checkAllEndpoints`), then `selectAvailabilityFirst(results)` chooses:
  1. **Filter to healthy endpoints only** (availability = primary key — an
     unhealthy endpoint is never chosen while any healthy one exists).
  2. Among the healthy set, tie-break by weight, lowest-rank first:
     `api_user_modified` (0) → `api_auto_detected` (1) → config `priority`
     ascending (2).
  3. Persist the winner to `api_auto_detected` + `api_current_endpoint`. The
     `api_user_modified` key is **never** written by auto-detection — only the
     manual switcher (`setEndpoint`) owns it, so a dead manual choice survives
     in storage yet still yields a *working* session endpoint.
  4. If nothing is healthy → fall back to highest-priority endpoint, logged,
     left marked unhealthy (rare last resort).
- **Bug this fixed:** the old `initialize()` early-returned on a stored
  `api_user_modified` / `api_auto_detected` id without probing, and the
  "no healthy" path used `getAllEndpoints()[0]` — so on a same-machine/WSL dev
  box it blind-pinned the unreachable priority-1 LAN IP (`192.168.50.3:9000`)
  instead of the reachable `localhost:9000`.

### Probe timeout vs `artisan serve` cold boot
- Dev backend (`laravel_main`) runs under `php artisan serve` with **no
  config/route cache and no opcache reuse**, so it cold-boots the whole
  framework **per request** (~2.5s, ~27 MB peak observed) — this cost is **not
  health-specific** (the `/api/health` route itself is already cheap and
  correctly strips Sanctum/`GoLatency` via `withoutMiddleware`; CORS in
  `config/cors.php` already lists `api/health`). A 1s probe aborts before a
  healthy localhost can reply, which is what made every endpoint look dead.
- Mitigation (frontend): probe `timeout` raised **1000 → 3000ms**
  (`config/api-endpoints.ts` `GLOBAL_API_ENDPOINTS.timeout`,
  `ApiManager.initialize` default, and the `AppContext.tsx` call site) to clear
  the cold-boot window.
- **Durable cure (dev-runtime, not the probe):** run
  `php artisan config:cache && php artisan route:cache` in dev, or serve via
  **Octane (Swoole)** so the worker stays warm — that drops every request
  (including `/health`) to single-digit ms. No `/api/health` code change was
  warranted.

### Auto current-origin endpoint (qy_capacitor — 2026-05-28)

> The page's **current origin** is auto-injected as the **highest-priority
> (weight 0)** endpoint, so a same-origin backend is always tried first.

- `config/api-endpoints.ts` adds `getCurrentOriginEndpoint()` — it derives an
  `ApiEndpoint` from `window.location` (protocol + hostname + port), id
  `current-origin` (`CURRENT_ORIGIN_ENDPOINT_ID`), `priority: 0`. It reuses the
  **same `/api` path contract** as the static endpoints — only the host/port
  come from wherever the app is served (e.g. `http://localhost`).
- `getAllEndpoints()` prepends it (deduped against any identical
  protocol/host/port already configured) and sorts by priority, so it leads the
  probe/selection order and shows first in the switcher + testing center.
  `getEndpointById('current-origin')` re-derives it fresh from `window.location`
  (so a stored auto/manual choice of it stays correct across reloads).
- Safe by construction: it is **availability-first** like every other endpoint —
  if the current origin can't serve `/api/health` (e.g. split Vite dev server on
  a different port with no proxy), its probe fails and the manager falls through
  to the next healthy endpoint. Returns null for non-http(s) origins
  (SSR / `file://` / `capacitor://`), so nothing is injected there.
- Primary benefit: production / reverse-proxy / same-origin Capacitor hosting,
  where the frontend and backend share an origin — that origin is now selected
  first with zero manual configuration.

---

## 🔗 参考实现

- **laravel_dashboard**: `/services/ApiManager.ts` + `/config/api-endpoints.ts`
- **wordflow-ai**: `/services/ApiManager.ts` + `/components/ApiEndpointSwitcher.tsx`

开发者可以参考这两个项目的完整实现，根据自己的技术栈进行调整。

---

**文档版本**: v3.2 (精简版 + realized detection contract + availability-first selection)
**最后更新**: 2026-05-28
**适用范围**: 所有前端应用
