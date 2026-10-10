# CodeMart 审计收尾：交接清单（给 Kimi）

## 背景
- CodeMart 中不删改数据的代码修复已全部完成，自动 gitsync 已推送，线上 Laravel 也已同步。
- 原始记录：Claude 会话 `3e527406`，任务来源 `D:\www\core_node\data\terminal_backup\restore\20261010-104221\terminal-16.txt`。
- 规范：遵守 `AGENTS.md`；改 Laravel 时参照 `development-guides/LARAVEL_GUIDE.md`。
- 设计文档：`docs_fix/DESIGN_CODEMART.md`。
- 不要使用子 Agent，不要手动提交。自动 gitsync 每 5 分钟推送一次，所以每一步都要保证能编译通过。

## 已完成并验证（不用重做）
1. 前端写死的规则改由后端下发：最低预算、评审最少字数、重新申请间隔、最低系统版本、默认币种。前端统一通过 `apps/codemart/contexts/useCmPolicy.ts` 读取。
2. 分页参数统一由 `CodeMartV1Pagination::params` 处理，`page_size` 和 `pageSize` 都接受；仪表盘最多读取 5 页。
3. 新增改密码卡片 `CmPasswordChangeCard`，钱包充值增加支付方式选择。
4. 全项目 `tsc --noEmit` 通过（exit 0）；线上 Laravel 错误日志为空。

## 待 Kimi 完成
1. **运行流程测试 `test:codemart:flows`**
   - 方式 A：本地启动 Laravel（`127.0.0.1:9000`），然后在 `poly_apps/pycore_laravel_wordnew_ui` 下执行 `npm run test:codemart:flows`。
   - 方式 B：针对线上服务器运行，需要设置 `CM_API=https://api.si.12gm.com`，并用 `CM_PASSWORD_FILE` 指向线上 demo 密码文件。注意：本地 `D:/www/wwwroot/laravel_db/.core_node_secrets/CODEMART_ADMIN_PASSWORD` 中的密码在线上会被拒绝（`AUTH_INVALID_PASSWORD`）。
   - 禁止注册新的测试账号。
2. **验证 `bootstrap` 新字段**：登录后请求 `GET /api/codemart/v1/bootstrap`，确认 `vocabulary.policy` 里有 `project_min_budget`、`review_comment_min_length`、`reviewer_retry_days`。
3. **验证 `min_os`**：`GET /api/codemart/v1/public/app-downloads` 目前返回空列表。等有安装包条目后，确认每条都带 `min_os`，下载页的最低系统要求那一行也能正常显示。
4. **在浏览器里检查界面**（Chrome MCP 本次连不上）：设置页的改密码卡片、钱包充值的支付方式下拉、仪表盘的未完成项、评审页的最少字数提示，中英文都要看。
5. **可选：运行爬取测试** `npm run test:codemart:crawl`。大约需要 2 小时，并且依赖可访问的 API。
6. 验证结果有变化时，只更新 `docs_fix/DESIGN_CODEMART.md` 里状态变了的地方。

## 上次有意跳过的项（需要先新增后端功能，未经用户同意不要开工）
- 管理后台编辑平台规则的界面（佣金率、保证金、下载列表）：目前没有写入接口。
- 头像上传、修改邮箱：后端不存在。
- 未接入前端的路由：`POST /payments`、`GET /payments/{id}`、`GET /deposits/{id}/status`、`GET /tasks`、`GET /ai-analysis/{id}`。其中支付相关的取决于支付网关的决定。
- 各接口响应里的分页字段名不一致（`page_size`/`total_pages` 和 `pageSize`/`totalPages`）。前端已经兼容两种写法。

## 用户已决定（2026-10-10）
- 本地测试（本地 Laravel `127.0.0.1:9000` + `test:codemart:flows`）。
- 完成所有后端管理功能和 UI：写死的部分全部改为可设置（后台可编辑）。
- AI 估价币种：RMB（CNY）。
- 测试数据不清理。
- 后端已有但前端没接的功能全部接入前端。
- 进行中：codemart-lead 子代理（Claude 会话 `540ccf45`），完成后更新本清单。

## 必须由用户决定（Kimi 不要做）
- 关闭线上 demo 数据（`CODEMART_SEED_DEMO`），以及去掉 demo 管理员的全部权限（`rolelevel=10`）。
- AI 估价公式（币种已定为 RMB）。
- 支付网关：接入真实网关，还是删掉非钱包支付方式。
- 隐私政策和服务条款的法律文本。
- 短信服务商；评审资格考试目前是写死的。
- Redis 缓存故障切换的测试。
- 暂缓的功能：私信、公开主页、仲裁、多方组织、更多支付网关、原生打包。
