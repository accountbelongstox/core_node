# Claude Relay Service Fork 功能迁移方案（以本地 fork 为准）

> 目标：将 `/Users/wangxin/Documents/WangXinProjects/ai-projects/claude-relay-service` 的新增能力按需迁移到本仓库，保持与上游共同仓库可持续同步，默认兼容上游行为（新能力需有开关）。

## 基线与分支策略
- 远端：保留 `upstream`（共同上游），新增本地只读远端 `fork-local` 指向 `/Users/wangxin/Documents/WangXinProjects/ai-projects/claude-relay-service/.git`；本地 fork 未 push，以本地提交为准。
- 工作分支：`feature/fork-backport` 用于迁移；主干继续仅与 `upstream` 同步。
- 文档：本目录维护计划、变更清单、同步日志（不覆盖 `docs/migration-client/*`）。

## 差异梳理流程
1) 在本仓库：`git fetch upstream`、`git fetch fork-local`。
2) 差异视图：
   - `git diff upstream/main..fork-local/main --stat` → fork 额外能力。
   - `git diff upstream/main..main --stat` → 本仓库定制。
3) 结合 fork 文档（如 websocket、vpn、支付、mysql 等）标注“直接移植 / 需改写 / 暂缓”。
4) 更新 `docs/migration-service/overview/fork-migration-change-list.md` 差异表。

## 范围与优先级（建议）
1) 数据层：MySQL provider + 迁移脚本，保持 Redis/SQLite 默认不变。
2) WebSocket：引入 fork 的 **server 端能力**（当前项目已有 client 端），通过环境变量决定启用 server/client/关闭（不支持同时启动），默认保持现状。
3) VPN：同 WebSocket，迁移 server 端能力，按环境变量选择 server/client/关闭，默认保持现状。
4) 支付与订阅：WeChat Pay 集成、套餐模型、对账脚本，默认关闭。
5) 安全与限流：`express-rate-limit`、JWT/客户端白名单、脱敏日志（**是否迁移视当前需求/风险评估决定，若不迁移仅记录差异**）。
6) 前端：需单独梳理迁移范围（WS/VPN/支付/订阅/客户端管理等），避免一次性合并过大。
（DDD/TS 分层保持现状，必要时单点转译为 JS 接入。）

## 里程碑拆解
- 准备：补齐远端、记录 fork HEAD 与 `git status`，导出 `git bundle` 备份（可选）。
- 里程碑 A｜配置与依赖：对齐依赖差异（mysql2/jsonwebtoken/express-rate-limit/wechatpay 等）；更新 `config/config.example.js`、`.env.example`，新增 MySQL/WS/支付开关，默认关闭。
- 里程碑 B｜数据层：新增 `src/models/datastore/mysqlDataStore.js` 与工厂选择；迁移脚本支持 Redis↔MySQL 干跑/回滚；低耦合读路径改走适配层。
- 里程碑 C｜WebSocket：迁移 fork 的 server 端能力；保留现有 client 端；通过环境变量控制模式（server/client/关闭），默认关闭新 server；`src/routes/admin` 增加管控接口；脚本 `create-client-apikey`、`client-config` 适配；前端 `web/admin-spa` 增加管理视图。
- 里程碑 D｜VPN：迁移 server 端能力，按环境变量控制 server/client/关闭；保持默认关闭；补充 CLI/状态脚本与安全/资源配置。
- 里程碑 E｜支付/订阅：移植支付服务、签名/证书校验、回调路由、套餐模型与对账脚本；前端补充支付入口与状态展示；全部受配置开关。
- 里程碑 F｜安全/限流：如评估需要再引入；否则仅保留差异记录与日志脱敏。
- 里程碑 G｜前端对齐：单独梳理 WS/VPN/支付/订阅/客户端管理相关页面与测试，择优迁移。
- 验证与发布：新增/改造最小测试；`npm run lint && npm test && npm run test:datastore` 作为基础；支付/WS/MySQL 用可选 job；上线前运行迁移干跑、开关关闭/开启冒烟；保留回滚与关闭开关。

## 上游同步与冲突处理
- 原则：新增能力放独立目录或受配置开关，避免与上游同名文件直接冲突。
- 同步流程：`git fetch upstream && git rebase upstream/main`；冲突优先保留上游，再用适配层/开关接入本地改动；记录在 `docs/migration-service/sync-log.md`（时间、冲突点、处理方式）。

## 风险与缓解
- 本地 fork 未 push：先记录 fork HEAD 与工作目录状态，必要时 `git bundle` 备份。
- 数据迁移：MySQL 迁移需干跑 + 回滚脚本，保留 Redis/SQLite 回退。
- 新能力默认关闭：避免影响现有用户；需具备快速关闭/回滚路径。
- 安全与支付：证书/密钥妥善管理，回调校验严格，日志脱敏。
