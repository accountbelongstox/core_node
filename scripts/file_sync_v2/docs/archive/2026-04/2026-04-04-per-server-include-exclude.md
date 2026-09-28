# 任务：实现每个 server 独立 include/exclude 规则

状态：done
语言：简体中文（zh-CN）
负责人：Codex
目标：支持在 `client_config.json` 的每个 `servers[]` 节点配置独立的 `include` / `exclude` 规则，并在同步时按目标服务端分别生效。
范围：`client.py`、`tests/test_client_multi_server.py`、`README.md`（如需补充说明）、文档索引状态更新。
不在范围：服务端协议改造、按服务端独立扫描线程重构。
约束：遵循 TDD；兼容现有配置；`include/exclude` 均为可选，缺省不限制（在全局排除基础上）。

计划：
- [x] 创建任务文档并登记索引/状态。
- [x] 先补失败测试：覆盖规则解析与过滤行为。
- [x] 实现按服务端规则过滤全量/增量同步内容。
- [x] 执行测试与语法检查。
- [x] 回写文档并归档。

进展记录：
- 2026-04-04：任务创建。
- 2026-04-04：新增 include/exclude 相关测试并先执行失败，确认缺口在规则解析与按目标过滤。
- 2026-04-04：实现 `servers[].include`、`servers[].exclude` 解析校验，以及按目标过滤全量与增量同步。
- 2026-04-04：更新 `README.md` 使用说明并完成 `python3 -m unittest discover -s tests -p "test_*.py"` 与 `python3 -m py_compile client.py server.py protocol.py` 验证。

验收标准：
- `servers[].include` 与 `servers[].exclude` 可解析，非法类型会报错。
- 不同服务端可对同一轮同步得到不同文件集合。
- 现有多服务端与 `enabled` 功能保持兼容。
- 测试与语法检查通过。
