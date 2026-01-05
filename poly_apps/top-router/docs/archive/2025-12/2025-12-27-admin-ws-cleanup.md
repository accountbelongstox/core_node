# 任务: 清理 /admin/ws 路由与前端 WS Store

状态: 已完成
语言: 简体中文（zh-CN）
负责人: 待定
目标: 移除未使用的 /admin/ws 管控路由与前端 ws store，统一到 /admin/clients。
范围:
- 删除 /admin/ws 路由及相关入口
- 移除 web/admin-spa/src/stores/ws.js 与 ws-clients 路由映射
- 更新脚本与文档中旧路径
不在范围内:
- 归档文档内容改写
- WS 协议与账户逻辑调整
约束:
- 清理前需确认无代码引用

计划:
- [ ] 梳理 /admin/ws 与 ws store 的引用点
- [ ] 清理路由/前端入口/脚本引用
- [ ] 更新相关文档

进度日志:
- 2025-12-27: 确认 /admin/ws 与 ws store 的引用点，开始清理。
- 2025-12-27: 移除 /admin/ws 路由与 ws store，同步前端路由/脚本/文档到 /admin/clients。

验收:
- /admin/ws 路由与 ws store 已移除
- 前端/脚本/文档统一使用 /admin/clients
