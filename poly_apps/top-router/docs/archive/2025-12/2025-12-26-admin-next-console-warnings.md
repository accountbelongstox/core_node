# 任务: 清理 admin-next no-console 警告

状态: done
语言: 简体中文（zh-CN）
负责人:
目标: 清理 admin-next 前端视图中的 no-console 警告。
范围:
- AccountsView.vue
- DashboardView.vue
不在范围:
- 功能逻辑调整
约束:
- 仅处理 lint 警告

计划:
- [x] 替换 console.debug 为允许的日志级别
- [x] 更新文档并归档

进展记录:
- 2025-12-26: 完成 warning 清理

验收:
- no-console 警告消除
