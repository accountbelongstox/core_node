# Task: 修复 /admin-next/app 空白页

Status: in_progress
Language: Simplified Chinese (zh-CN)
Owner: Codex
Goal: 修复登录后 /admin-next/app 页面空白的问题并确认原因。
Scope: server/web/admin-spa 路由、构建与静态资源路径、服务端 admin-next 静态路由。
Out of scope: 业务功能改动或新增页面。
Constraints: 不引入不必要的重构；保持现有路由结构。

Plan:
- [ ] 复现并定位空白原因（路由守卫/静态资源/构建基址）
- [ ] 修复并验证 /admin-next/app 正常渲染
- [ ] 更新任务进度记录

Progress Log:
- 2025-12-27: 创建任务，开始排查 /admin-next/app 空白问题。
- 2025-12-27: 修正用户登录跳转与登录URL生成，统一使用 /auth/user-login 和 history 路由路径。

Acceptance:
- /admin-next/app 登录后可正常渲染页面内容
- 不引入新的 404 或路由回退错误
