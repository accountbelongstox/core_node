# 任务：为多服务端节点增加 enabled 同步开关

状态：done
语言：简体中文（zh-CN）
负责人：Codex
目标：在 `client_config.json` 的 `servers` 每个节点增加 `enabled` 开关，`true` 可同步、`false` 跳过，并确保从禁用切回启用后先执行一次全量同步。
范围：`client.py`、`tests/test_client_multi_server.py`、`client_config.json`、文档索引状态更新。
不在范围：实现“同一次同步中不同服务器使用不同文件集合”的策略。
约束：遵循 TDD；兼容旧配置；`enabled` 缺省等价于 `true`。

计划：
- [x] 创建任务文档并登记索引/状态。
- [x] 先写失败测试覆盖 `enabled` 解析与状态迁移。
- [x] 实现按目标启停同步与禁用后重启全量同步。
- [x] 运行测试与语法检查。
- [x] 回写文档并归档任务。

进展记录：
- 2026-04-04：任务创建，开始进入测试先行实现。
- 2026-04-04：新增 `enabled` 相关测试并执行，观察到预期失败（缺少 `enabled` 解析与禁用回切状态方法）。
- 2026-04-04：实现 `servers[].enabled` 解析、禁用目标跳过同步、禁用后将目标状态标记为需全量同步。
- 2026-04-04：执行 `python3 -m unittest discover -s tests -p "test_*.py"` 与 `python3 -m py_compile client.py server.py protocol.py`，均通过。

验收标准：
- `servers[].enabled` 可被解析，缺省按启用处理。
- `enabled=false` 的服务器不会执行同步。
- 服务器从 `enabled=false` 改为 `enabled=true` 后，先进行一次全量同步再走增量。
- 回归测试与语法检查通过。
