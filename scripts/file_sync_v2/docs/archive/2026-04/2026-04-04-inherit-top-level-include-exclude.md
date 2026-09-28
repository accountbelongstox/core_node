# 任务：支持 servers 继承顶层 include/exclude

状态：done
语言：简体中文（zh-CN）
负责人：Codex
目标：当 `client_config.json` 在 `servers` 外配置了 `include` / `exclude`，且某个 `servers[]` 节点未配置对应规则时，该目标继承顶层规则。
范围：`client.py`、`tests/test_client_multi_server.py`、`README.md`、文档索引状态更新。
不在范围：服务端协议改造、按服务端增量扫描线程改造。
约束：遵循 TDD；兼容现有 `servers[].enabled` 与多目标同步流程；保留顶层 `exclude` 的全局扫描排除行为。

计划：
- [x] 创建任务文档并登记索引/状态。
- [x] 先补失败测试：覆盖继承与覆盖优先级行为。
- [x] 实现继承逻辑并保持兼容。
- [x] 更新 README 说明。
- [x] 运行测试与语法检查，归档文档。

进展记录：
- 2026-04-04：任务创建并登记到 `docs/INDEX.md`、`docs/STATUS.md`。
- 2026-04-04：新增继承相关测试，先执行 `python3 -m unittest tests/test_client_multi_server.py`，观察到失败（RED）。
- 2026-04-04：实现 `servers[]` 缺省继承顶层 `include/exclude`，并保留节点内显式配置优先。
- 2026-04-04：更新 README 配置示例和优先级说明。
- 2026-04-04：执行 `python3 -m unittest discover -s tests -p "test_*.py"` 与 `python3 -m py_compile client.py server.py protocol.py`，通过。

验收标准：
- `servers[]` 未配置规则时可继承顶层 `include/exclude`。
- `servers[]` 显式配置规则时，以节点内配置为准。
- 多服务端同步行为和已有功能不回退。
- 单元测试和语法检查通过。
