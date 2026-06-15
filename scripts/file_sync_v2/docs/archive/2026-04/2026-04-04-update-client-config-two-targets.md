# 任务：更新客户端配置为双目标服务端

状态：done
语言：简体中文（zh-CN）
负责人：Codex
目标：将 `client_config.json` 更新为可运行的双目标服务端同步配置。
范围：`client_config.json`。
不在范围：服务端配置修改、网络连通性排障。
约束：保持现有排除规则与同步参数不变。

计划：
- [x] 基于现有配置整理双目标字段结构。
- [x] 更新 `client_config.json` 并校验 JSON 格式。
- [x] 更新任务记录并归档。

进展记录：
- 2026-04-04：任务创建，准备按双目标结构落地配置。
- 2026-04-04：已更新 `client_config.json` 为 `servers` 双目标结构（43.163.112.77 与 10.0.0.8）。
- 2026-04-04：执行 `python3 -m json.tool client_config.json` 与 `_parse_targets` 解析校验通过。

验收标准：
- `client_config.json` 包含 `servers` 双目标配置。
- JSON 格式合法可被客户端直接读取。
