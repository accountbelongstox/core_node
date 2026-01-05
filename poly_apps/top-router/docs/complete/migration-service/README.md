# 迁移文档索引

> 目的：按目录归类迁移文档，便于快速定位与审核。

## 目录
- `docs/migration-service/overview/`
  - `fork-migration-plan.md`：迁移总体计划
  - `fork-migration-change-list.md`：迁移变更清单与进度
- `docs/migration-service/frontend/`
  - `frontend-landing-user-sync-plan.md`：落地页/用户面板同步计划
  - `admin-ui-sync-plan.md`：管理端页面与全局样式同步计划
- `docs/migration-service/database/`
  - `mysql-migration-notes.md`：MySQL 迁移说明与操作
  - `mysql-schema-diff.md`：schema 对齐差异
- `docs/migration-service/ws-vpn/`
  - `ws-overview.md`：WS 逻辑总览
  - `ws-config-and-smoke.md`：WS 配置与冒烟说明
  - `vpn-ws-admin-notes.md`：VPN/WS 管控说明
- `docs/migration-service/payment/`
  - `payment-sandbox.md`：支付沙箱与联调说明
- `docs/migration-service/openai/`
  - `openai-official-endpoint-plan.md`：官方 OpenAI 兼容入口计划

## 未完成工作列表
> 仅列关键事项，详细状态见 `docs/migration-service/overview/fork-migration-change-list.md`。

### 前端（当前优先）
- （当前无待办，待新增需求）

### 后端（暂缓，除非影响前端）
- MySQL 迁移验证与回滚说明补充（reconcile + 读写冒烟）
- WS/支付/VPN 联调与冒烟（回调验签、重连、错误场景）
- 监控/指标与运维指引补充
