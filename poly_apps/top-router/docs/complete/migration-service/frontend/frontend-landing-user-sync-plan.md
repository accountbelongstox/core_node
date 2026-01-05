# 前端落地页与用户面板同步计划（来自 fork）

> 目标：仅同步 fork 的 **落地页（marketing）** 与 **用户面板（user）** 相关页面/组件，保持现有后端接口与路由/鉴权逻辑不变。  
> 源：`/Users/wangxin/Documents/WangXinProjects/ai-projects/claude-relay-service`  
> 目标：`/Users/wangxin/Documents/WangXinProjects/ai-projects/top-router/client`

## 范围与原则

### ✅ 同步范围（页面）
**落地页**
- [x] `web/admin-spa/src/views/marketing/Landing.vue`
- [x] `web/admin-spa/src/views/marketing/Features.vue`
- [x] `web/admin-spa/src/views/marketing/Pricing.vue`
- [x] `web/admin-spa/src/views/marketing/CaseStudies.vue`
- [x] `web/admin-spa/src/views/marketing/Solutions.vue`
- [x] `web/admin-spa/src/views/marketing/About.vue`
- [x] `web/admin-spa/src/views/marketing/Contact.vue`
- [x] `web/admin-spa/src/views/marketing/ApiStatus.vue`
- [x] `web/admin-spa/src/views/marketing/Tutorial.vue`

**用户面板**
- [x] `web/admin-spa/src/views/user/Dashboard.vue`
- [x] `web/admin-spa/src/views/user/UsageAnalytics.vue`
- [x] `web/admin-spa/src/views/user/Plans.vue`
- [x] `web/admin-spa/src/views/user/Subscription.vue`
- [x] `web/admin-spa/src/views/user/Billing.vue`
- [x] `web/admin-spa/src/views/user/Payment.vue`
- [x] `web/admin-spa/src/views/user/ApiKeys.vue`
- [x] `web/admin-spa/src/views/user/Support.vue`
- [x] `web/admin-spa/src/views/user/SmsSettings.vue`
- [x] `web/admin-spa/src/views/user/Tutorials.vue`

### ✅ 条件同步（依赖文件，仅当被页面引用且有差异）
- [x] `web/admin-spa/src/components/user/*`
- [x] `web/admin-spa/src/layouts/MarketingLayout.vue`
- [x] `web/admin-spa/src/layouts/UserLayout.vue`
- [x] `web/admin-spa/src/assets/styles/*`（仅落地页/用户面板限定样式，避免影响管理端）
- [x] `web/admin-spa/src/components/common/StatCard.vue`（User UsageAnalytics 依赖）
- [x] `web/admin-spa/src/components/apistats/LimitConfig.vue`（Marketing ApiStatus 依赖）
- [x] `web/admin-spa/src/stores/apistats.js`（Marketing ApiStatus 依赖）
- [ ] 其他被页面直接引用的组件/配置/资源（需在变更记录中列出）

### ❌ 不在本轮范围（保持现状，但标记差异）
- 路由/鉴权与后端对接逻辑：`web/admin-spa/src/router/index.js`（**已确认有差异**：本仓使用显式路由与 `/user-login`、`/login` 路径；fork 使用模块化路由与 `/auth/*` 路径，且包含 role 校验与 toast 行为）
- 用户认证 store：`web/admin-spa/src/stores/user.js`（**已确认有差异**：本仓使用 `x-user-token` 头与 `/user-login` 跳转；fork 使用 `Authorization` Bearer 与 `/auth/user-login`）
- 管理端页面与管理端布局/样式（**已确认有差异**：`web/admin-spa/src/layouts/AdminLayout.vue` 与多处 admin store 不同）
- 全局样式：`web/admin-spa/src/assets/styles/global.css`、`web/admin-spa/src/assets/styles/main.css`（**已确认有差异**：当前仅格式/细节差异，暂不合并）
- 后端接口与响应结构（除非前端同步后确实需要）

#### 差异清单（仅标记，暂不处理）
- [ ] `web/admin-spa/src/router/index.js`：路由组织结构、登录路径、守卫逻辑、权限提示
- [ ] `web/admin-spa/src/stores/user.js`：鉴权头与跳转路径
- [ ] `web/admin-spa/src/stores/auth.js` / `dashboard.js` / `settings.js` / `apistats.js` / `vpn.js`：管理端 store 差异（本轮不动）
- [ ] `web/admin-spa/src/layouts/AdminLayout.vue`：管理端布局差异（本轮不动）
- [ ] `web/admin-spa/src/assets/styles/global.css`、`main.css`：全局样式差异（本轮不动）

## 实施步骤
1. **差异检查**：逐个对比 fork 与当前文件，仅在存在差异时同步覆盖。
2. **依赖补齐**：若页面引用的组件/资源在本仓缺失，补齐最小依赖集。
3. **样式隔离**：如需样式变更，优先限定到 `landing`/`user` 容器类，避免全局污染。
4. **最小验证**：页面能正常加载与路由跳转，无控制台报错（可选 build/preview）。

## 审核要点
- 落地页与用户面板 UI/交互是否与 fork 一致
- 资源引用是否完整（图片、图标、静态数据）
- 未动路由/鉴权，不影响现有 admin SPA
- 样式变更不影响管理端布局

## 风险与回滚
- 风险：全局样式污染、依赖缺失导致页面报错
- 回滚：回退对应页面/组件文件至同步前版本

## 进度记录
| 日期 | 模块 | 项目 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 2025-12-24 | marketing | Landing/Features/Pricing... | 已完成 | 与 fork 一致，无需改动 |
| 2025-12-24 | user | Dashboard/Usage/Plans... | 已完成 | 与 fork 一致，无需改动 |
| 2025-12-24 | deps | components/user + layouts | 已完成 | 与 fork 一致 |
| 2025-12-24 | deps | StatCard / LimitConfig / apistats store | 已完成 | 对齐 fork 版本 |
| 2025-12-24 | deps | assets/styles | 已完成 | 与 fork 一致，无需改动 |
