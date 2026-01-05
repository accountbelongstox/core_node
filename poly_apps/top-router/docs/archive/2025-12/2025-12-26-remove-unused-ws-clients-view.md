# 任务: 清理未使用的 WsClientsView

状态: 已完成
语言: 简体中文（zh-CN）
负责人: 待定
目标: 删除未使用的 WsClientsView.vue 文件，避免误用与维护成本。
范围:
- 删除 `web/admin-spa/src/views/WsClientsView.vue`
不在范围内:
- 路由与菜单调整
- 新页面替换
约束:
- 保持现有路由行为不变

计划:
- [x] 移除未使用的 WsClientsView.vue

进度日志:
- 2025-12-26: 删除未使用的 WsClientsView.vue。

验收:
- 项目内不再包含 WsClientsView.vue
- 路由仍指向 Clients.vue
