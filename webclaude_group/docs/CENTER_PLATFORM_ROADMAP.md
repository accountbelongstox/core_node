# 中心平台路线图与分工（主机资源 / 用户资源）

> 文档日期：2026-04-02  
> 目的：把「中心后端注册与 Key、聊天前端、加速节点、主机端、插件」统一到一张图里，标明**角色、模块数量**，并**对齐现有文档与将要做的事**（冲突与扩展点）。

### 官方声明：`webclaude_gateway` 不使用

仓库 **`webclaude_gateway`**（独立 Go「Bridge」）与 **`webclaude_go-gateway`** 内置的 WebSocket 中继（`internal/websocket/`，前端与 `claude_host` 的桥接）在职责上**重复**。**当前平台不部署、不依赖 `webclaude_gateway`**；聊天与 Host 的实时链路以 **`webclaude_go-gateway`** 为唯一中继实现。详见 `webclaude_go-gateway/docs/GATEWAY_INTEGRATION.md`。`webclaude_gateway` 目录若仍保留在组内，仅作历史参考，**新功能不得再向该仓库添加**。

---

## 1. 产品目标（摘要）

| 方向 | 说明 |
|------|------|
| 中心后端 | 用户注册、申请与授权 **API Key**；分 **主机资源** 与 **用户资源** 两大域。 |
| 聊天前端 | Web 版（可公开访问，填 Key 或从用户后台免 Key 跳转）；VS Code 插件与独立客户端由插件组负责。 |
| 边缘加速 | 多节点 **Nginx 反代**，降低延迟；用户侧逐步**弱化对虚拟局域网的依赖**；无本地目录挂载时仍可按规范走虚拟机方案。 |
| 协作 | 主机上的 **Host 客户端** 由你方实现；**中心服务器**由本仓库演进；**插件（VS Code / 独立客户端）** 由另一组实现；对外沟通可拉小群。 |

商业与工期描述（原文保留）：双人全职约数日量级；兼职可八折；定价叙事（示例 888 / 原价 700 打八折 560）仅作运营参考，**不落库、不硬编码到代码**。

---

## 2. 系统分层（目标态）

```
                    [ Nginx 边缘节点 x N ]
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   [ 聊天前端 Web ]    [ 用户后台 / 官网 UI ]   [ 管理端 / 内部 ]
   (webclaude_website)  (同仓或子应用)          (admin-spa 等)
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │ HTTPS / WSS
                              ▼
              ┌───────────────────────────────┐
              │   webclaude_center_server      │  ◄── 用户资源 + 主机控制面（新增/扩展）
              │   （注册、项目/对话配额、Key）   │
              └───────────────┬───────────────┘
                              │ MySQL / Redis
              ┌───────────────┴───────────────┐
              │   webclaude_go-gateway         │  ◄── HTTP 中继、账号池、鉴权、用量
              │   + WebSocket（前端 ↔ Host）    │      **唯一** WS 层（勿再部署 webclaude_gateway）
              └───────────────┬───────────────┘
                              │ WSS：客户端 / 反向隧道 Host
                              ▼
              ┌───────────────────────────────┐
              │ core_node/pyapps/claude_host   │  ◄── 执行 Claude CLI、系统用户隔离
              └───────────────────────────────┘
```

**说明**：执行路径（聊天 → **go-gateway WebSocket** → Host）与「控制面」（主机向 **center** HTTPS 上报、用户配额与 Key）正交；见下文「冲突与对齐」。

---

## 3. 后端两大块（需求拆解）

### 3.1 主机资源管理（Host / Control Plane）

面向 **机房侧 Agent**（运行在物理机/虚拟机上的 Host 客户端），中心需提供或扩展：

| 能力 | 说明 |
|------|------|
| 心跳与清单上报 | 当前主机上有哪些 **Linux user**；每个 user 绑定的 **Claude 账号**、**账号类型**、**可用时长/配额元数据**（具体字段需与计费/订阅对齐）。 |
| 用户生命周期 API | **创建** Host 侧 user（与现有 `create_user` 协议对齐或封装）；**校验** Claude 是否可用（探测/试跑）。 |
| 流式对话入口 | 接收 **提示词**（及会话上下文 ID），返回 **WebSocket 流**（用户写的是「vivo socket」，此处统一为 **WebSocket/SSE 流**；落地时与 Bridge/网关路径二选一或组合，避免重复实现）。 |

**实现落点**：以 `webclaude_center_server` 为主扩展 **Host 专用路由**（建议前缀如 `/host/*` 或 `/internal/host/*`）。实时执行与 **`claude_host` 的 WS 协议**以 **`webclaude_go-gateway`** 为准（**不使用** `webclaude_gateway`）；详细字段见 `docs/host-protocol.md` 与 `core_node/pyapps/claude_host/docs/HOST_INTEGRATION.md`，需在路线图阶段做一次 **字段级对齐表**。

### 3.2 用户资源管理（Tenant / Data Plane）

面向 **最终用户**：

| 能力 | 说明 |
|------|------|
| 注册与登录 | 已有 `/users/*` 基础；按需扩展 OAuth/短信等。 |
| 级别与配额 | 按套餐限制 **项目数**（每个项目 = 一个路径/工作区标识）、**对话数**（每个对话 ≈ 一个 Claude 会话/窗口）。 |
| Key 生命周期 | 用户申请 **API Key**；中心 **授权**（权限范围、绑定的项目/对话、过期）；Key 供 **聊天前端** 使用。 |
| 后台跳转 | 登录后用户门户 **跳转聊天前端**并注入会话（免手动填 Key）。 |

**实现落点**：`webclaude_center_server` 已有用户、订阅、Key 等；需新增/明确 **project / conversation** 实体与配额检查中间件，并与 `webclaude_go-gateway` 的 Key 校验逻辑一致（共享 DB 或同步接口，见 `docs/INTEGRATION.md`）。

---

## 4. 聊天前端（范围边界）

| 归属 | 内容 |
|------|------|
| Web | 公开可进；**填 Key** 加载项目列表；或从用户后台 **免 Key**；支持 **上传文件**；后续：代码预览、提示词编排等。 |
| 插件组 | VS Code 扩展：同步代码、Windows/Linux 目录挂载到远端、内嵌聊天、MCP 调试通道、Git/文件夹上传等。 |
| 独立客户端 | Windows 一键 `.ps1`、Linux 一键脚本，后台常驻；可选安装（不装则无同步能力）。 |

**仓库**：Web 与后台 UI 以 `webclaude_website` 为主；与现有 `ARCHITECTURE_GUIDE.md` 中「Chat UI」一致。

---

## 5. 角色与人数（建议）

| # | 角色 | 职责 | 人数建议 |
|---|------|------|----------|
| R1 | **中心后端**（你方对接的「我」） | `webclaude_center_server`：主机控制面 API、用户项目/对话/Key、与 go-gateway 数据一致 | **1** |
| R2 | **Host 客户端**（你方） | `claude_host` 侧：上报、执行、与中心/网关联调 | **1** |
| R3 | **中继** | `webclaude_go-gateway`（HTTP + WebSocket 统一进程）：流与权限、不落业务到错误层 | **0.5–1**（可 R1 兼） |
| R4 | **Web / 官网 UI** | `webclaude_website`：用户站、聊天 Web、跳转体验 | **1** |
| R5 | **插件与独立客户端** | VS Code 扩展、PS1/SH 安装器、MCP | **1+** |
| R6 | **边缘与运维** | Nginx、证书、多节点、监控 | **0.5**（可兼职） |

**合计**：全职约 **4–5 人·等效** 可并行；**2 人**则顺序做中心+Host 核心链路，插件与边缘排后。  
**协作**：有外部咨询时拉 **小群**（你已说明）。

---

## 6. 模块清单（按仓库）

以下为「模块」粒度，便于排期；数量含**将新增**项。

| 模块 ID | 仓库 | 模块名 | 状态 |
|---------|------|--------|------|
| M1 | webclaude_center_server | 用户认证与资料 | 已有 |
| M2 | webclaude_center_server | 订阅与支付 / 套餐 | 已有 |
| M3 | webclaude_center_server | API Key CRUD 与权限 | ✅ 已完成（`ApiKey.allowed_projects` + `scopes`，注册默认 Key 沿用） |
| M4 | webclaude_center_server | **项目 / 对话** 模型与配额 | ✅ 已完成 — `Project`/`Conversation` EntitySchema + `/api/projects`、`/api/projects/:pid/conversations`、`/api/conversations/:id`；按 `User.level` 走 `quotaPolicyDefaults`（free/pro/max/team），超限 403 `QUOTA_EXCEEDED` |
| M5 | webclaude_center_server | **主机注册 / 心跳 / 用户-Claude 映射上报** | ✅ 已完成 — Host 经 `POST /api/registry/host` 上报心跳（含 `users[]`/`load`/`memory_mb`），`GET /admin/hosts` 派生在线/离线（90s 阈值）与可用用户 |
| M6 | webclaude_center_server | **Host API**：创建 user、Claude 可用性探测 | ✅ 已完成 — `/admin/hosts/:id/create-user`、`/admin/hosts/:id/verify-claude` 经 `gatewayBridgeClient` → go-gateway `/internal/bridge/{hostId}` 同步往返 |
| M7 | webclaude_center_server | **流式 API**（聊天链路；与网关去重） | ✅ 已完成 — 不在中心直连；由 go-gateway 提供 `WS /ws/chat` 与 **HTTP SSE `POST /api/chat/completions`**（共用账号/主机选择，不重复实现） |
| M8 | webclaude_go-gateway | Key 校验、账号池、用量、**WS 前端/Host 中继** | 已有（新增同步桥接 `BridgeCommandSync` + SSE 聊天端点） |
| M9 | `webclaude_gateway`（独立仓库） | **不使用** — 与 M8 重复，**不部署** | 废弃 |
| M10 | core_node/pyapps/claude_host | HostAgent、Runner、LinuxOps | ✅ 已接中心上报（`center_registration` HTTPS 心跳）；补齐 `verify_claude`/`create_project_dir` 指令、心跳 `uptime_s`/`disk_mb` |
| M11 | webclaude_website | 聊天 Web、免 Key 跳转、上传 | ✅ 项目/对话页对接 `/api/projects`；注册补齐邮箱验证两步流程（send-verification/verify-email）。免 Key 跳转 + 上传仍待对齐 |
| M12 | （插件组仓库） | VS Code / 独立客户端 | 外部 |
| M13 | 运维 | Nginx 边缘模板与多节点 | **待做** |

**模块数**：**13** 个逻辑编号（M9 为显式废弃声明）；**活跃实现 12**。**中心侧 M4–M7 + M3 绑定已落地**（2026-06-15）；剩余主要为 **M13（Nginx 边缘）** 与 **M11 的免 Key 跳转 / 文件上传**、插件组（M12，外部）。

---

## 7. 与现有文档的冲突与对齐

以下三点是「旧假设」与「本路线图」的差异，后续实现时以本文件为**产品真值**，并回写各子 README。

| 主题 | 现有说法（摘录） | 本路线图对齐方式 |
|------|------------------|------------------|
| center ↔ host | `INTEGRATION.md`：center **不直连** claude_host 做执行；数据经 DB → go-gateway | **保留执行路径不变**（WS 仅 **go-gateway ↔ host**）；**新增**：Host **主动 HTTPS** 向 center **上报元数据**（控制面），与 WS 执行隧道 **正交**。**不使用** `webclaude_gateway`。 |
| 流式入口 | 旧文档曾写独立 **webclaude_gateway** | **统一为 go-gateway** 内 WebSocket；禁止再引入第二套 Bridge 进程。 |
| 聊天前端免登录 | 新需求：聊天可匿名 + Key | 与纯 JWT 全站登录并存；需在 **ApiManager** 增加 Key-only 模式与 CORS/安全策略。 |

详细集成仍见：
- [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) — 系统整体架构
- [host-protocol.md](./host-protocol.md) — Host 通信协议与执行模型
- [gateway-api.md](./gateway-api.md) — Gateway & Center Server API 参考
- `webclaude_center_server/docs/INTEGRATION.md`
- `webclaude_go-gateway/docs/GATEWAY_INTEGRATION.md`

---

## 8. 建议的下一步（实施顺序）

1. ✅ **数据模型**：项目 / 对话 / Key 绑定关系（`Project`/`Conversation` 实体 + center `/api/projects*`；`ApiKey.allowed_projects`）。  
2. ✅ **Host 上报**：心跳 JSON + 鉴权（`/api/registry/host` + Host token；`/admin/hosts` 聚合）。  
3. ✅ **网关**：同步桥接（`/internal/bridge/{hostId}` + `BridgeCommandSync`）+ SSE 聊天端点；会话亲和缓存解析项目/对话。  
4. ⏳ **Web 聊天**：Key 登录路径已具备（注册含邮箱验证）；**文件上传**对接同一上传服务仍待做。  
5. ⏳ **Nginx**：边缘反代模板，指向 website + gateway + ws 升级（M13，未做）。  
6. ⏳ **插件组**：在稳定 WebSocket 与 Key 语义后再接 MCP/同步（外部）。

> **本地开发热重载**：统一启动器 `scripts/start.{sh,ps1}` 让四端均以热重载运行 —— center=nodemon、gateway=air、website=Vite HMR、claude_host=watchdog（`--dev` → `dev_reload.py`）。详见 [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) §9.5。

---

## 9. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-02 | 初版：角色/模块/冲突对齐 |
| 2026-04-02 | 声明 `webclaude_gateway` 重复实现、不部署；执行路径改为仅 go-gateway WS |
| 2026-06-15 | 落地 M4（项目/对话+配额）、M5/M6（主机注册/心跳 + Host Admin API 经网关桥接）、M7（go-gateway SSE 聊天端点）、M3（Key↔项目绑定）；claude_host 补齐 verify_claude/create_project_dir + 心跳 uptime_s/disk_mb；website 项目页对接 + 注册邮箱验证两步流程；统一启动器四端热重载对齐 |
