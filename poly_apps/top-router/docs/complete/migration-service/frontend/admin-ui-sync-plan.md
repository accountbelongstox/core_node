# 前端管理端（Admin SPA）页面与全局样式同步计划

> 目标：同步 fork 的管理端页面与样式，保持现有后端接口与鉴权逻辑不变；如前端同步必须依赖后端调整，则记录为“阻塞项”，不在本轮直接改后端。

## 范围与原则

### ✅ 同步范围（管理端）
- 管理端页面：`web/admin-spa/src/views/admin/*`
- 管理端布局：`web/admin-spa/src/layouts/AdminLayout.vue`
- 管理端组件：`web/admin-spa/src/components/admin/*`
- 管理端通用组件（仅被管理端引用者）：`web/admin-spa/src/components/common/*`
- 管理端功能组件：`web/admin-spa/src/components/accounts/*`、`web/admin-spa/src/components/apikeys/*`、`web/admin-spa/src/components/apistats/*`
- 全局样式（管理端相关差异）：`web/admin-spa/src/assets/styles/global.css`、`web/admin-spa/src/assets/styles/main.css`

### ❌ 不在本轮范围（保持现状）
- 路由与鉴权逻辑：`web/admin-spa/src/router/index.js`
- 认证/配置 store：`web/admin-spa/src/stores/*`（除非同步页面明确要求）
- 营销/用户面板页面与样式
- 后端接口与响应结构（仅记录依赖，不直接改）

## 已确认差异清单（初始盘点）

### 管理端页面
- `views/admin/Clients.vue`：fork 含 `VpnTunnelModal`，**本仓保持独立 `/admin/vpn`**，不再内嵌 VPN 弹窗

### 管理端组件
- `components/admin/ChangeRoleModal.vue`：有差异（保留本仓中文与交互）
- `components/admin/UserUsageStatsModal.vue`：有差异（保留本仓中文与图表增强）
- `components/admin/VpnTunnelModal.vue`：仅 fork 有（不引入，统一走 `/admin/vpn`）

### 管理端布局与导航
- `layouts/AdminLayout.vue`：保留 VPN tab，同时补齐订阅/事件日志入口
- `components/layout/AppHeader.vue`、`components/layout/TabBar.vue`：有差异
- `components/layout/MainLayout.vue`：仅本仓存在（fork 使用 AdminLayout 结构）

### 通用组件（管理端使用）
- `components/common/AccountSelector.vue`：有差异
- `components/common/CustomDropdown.vue`：有差异
- `components/common/StatCard.vue`：有差异
- `components/common/ActionDropdown.vue`：仅本仓有（fork 无）

### 业务组件
- `components/accounts/*`：多处差异（表单、弹窗、OAuth、代理配置等）
- `components/apikeys/*`：多处差异（编辑/批量/使用明细等）
- `components/apistats/LimitConfig.vue`：有差异

### 配置与样式
- `config/api.js`、`config/apiStats.js`、`config/app.js`：有差异（通常与后端/路由相关）
- `assets/styles/global.css`、`assets/styles/main.css`：有差异（需避免影响营销/用户面板）

## 实施步骤（分阶段）

### Phase 0 — 对齐目标与依赖评估
- [x] 逐页列出管理端页面使用的 API 与响应字段（Dashboard/Accounts/ApiKeys/Users/Clients/Subscriptions/Settings/EventLogs）。
- [x] 标记需要后端配合的差异（仅记录，不改后端）。
- [x] 明确“差异归属”：保留 VPN 独立入口与中文/交互增强。

### Phase 1 — 管理端页面同步
目标：保持页面结构/布局与 fork 一致，仅在存在差异时覆盖同步。
- [x] `views/admin/Clients.vue`：移除 VPN modal 入口，保留配置/历史/健康等功能。
- [x] 其余 `views/admin/*` 已核对无差异。
- [x] 管理端导航补齐订阅/事件日志入口，并保留 VPN/WS 标签。

### Phase 2 — 管理端组件同步
目标：补齐页面依赖组件，确保功能一致。
- [x] `components/admin/ChangeRoleModal.vue`：保持本仓中文与交互增强
- [x] `components/admin/UserUsageStatsModal.vue`：保持本仓中文与图表增强
- [x] `components/admin/VpnTunnelModal.vue`：不引入（统一走 `/admin/vpn`）
- [x] `components/common/AccountSelector.vue`：保持本仓（含 Gemini-API 账号与扩展状态）
- [x] `components/common/CustomDropdown.vue`：保持本仓（支持多选与分组缩进）
- [x] `components/common/ActionDropdown.vue`：仅本仓有，保留
- [x] `components/accounts/*` 与 `components/apikeys/*`：保持本仓增强（功能覆盖 fork）
- [x] `components/apistats/LimitConfig.vue`：已对齐 fork（见落地页/用户面板同步）

### Phase 3 — 配置与 Store 对齐（如需）
目标：仅在页面同步导致接口不兼容时调整。
- [x] 对比 `config/api.js` / `apiStats.js` / `app.js`，记录差异与风险
- [x] `config/api.js` 已补齐 `userToken` 兜底与 401 清理（支持用户面板请求）
- [x] `stores/*` 未发现阻断性接口不兼容，仅记录保留差异

**保留差异（确认）**
- `config/app.js`：保持 `/login`（走 legacy redirect），标题保持本仓文案
- `config/apiStats.js`、`stores/settings.js`：默认站点名保持本仓文案
- `stores/accounts.js`：保留 ws-client 路径与 fromClient/clientId；Gemini-API 列表不走 store
- `stores/vpn.js`、`stores/apistats.js`：保留本仓增强逻辑
- `stores/user.js`：继续使用 `x-user-token`（后端兼容）

### Phase 4 — 全局样式对齐（谨慎）
目标：仅影响管理端，不影响营销/用户面板。
- [x] 对比 `global.css`、`main.css` 差异，评估是否需要合并
- [x] 仅存在空行/格式差异，无需合并与隔离处理

## 校验清单（不执行构建也可人工复核）
- [ ] 管理端页面能正常进入：`/admin`、`/admin/accounts`、`/admin/api-keys`、`/admin/clients` 等
- [ ] 管理端关键表格与弹窗可打开（不报错）
- [ ] 组件依赖齐全（无 Vue/SFC import 报错）
- [ ] 样式未污染营销/用户面板

## 风险与回滚
- 风险：组件/样式差异导致 UI 错乱或功能不可用
- 回滚：逐文件回退（优先回退样式/布局，再回退页面）

## 进度记录
| 日期 | 模块 | 项目 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 2025-12-24 | admin views | Clients.vue 差异处理 | 已完成 | 保留独立 `/admin/vpn` |
| 2025-12-24 | admin views | 其他 admin views 核对 | 已完成 | 与 fork 一致 |
| 2025-12-24 | admin nav | Tab/route 补齐订阅与日志 | 已完成 | 保留 VPN/WS |
| 2025-12-24 | admin components | admin/common/accounts/apikeys | 已完成 | 保留本仓增强 |
| 2025-12-24 | config/stores | API/Store 最小对齐 | 已完成 | `api.js` 兼容 userToken |
| 2025-12-24 | styles | global/main 样式隔离 | 已完成 | 仅格式差异，无需处理 |
