with open('d:/programing/core_node/docs/PYCORE_MANAGER_BUG_LIST-2.md', 'a', encoding='utf-8') as f:
    f.write('''
### 2026-07-27 第三轮修复报告 (Agent)

**已完成：实施顺序第 1 步 (修复 Python import/启动状态机破损)**

1. **修正 `agent_history_article_service.py` 文件头与循环依赖**
   - 修复了文件顶部的 docstring 和 `from __future__ import annotations` 顺序问题。
   - 移除了 `get_logs()` 内部游离的 `get_agent_history_tick_service` 导入残片，并在文件顶部正确导入，解除了循环依赖。

2. **移除 RPC handler 中的同步执行**
   - 修改了 `local_agent_history_routes.py` 中的 `article_config_post_handler` 和 `article_start_handler`。
   - 移除了 `await _run(tick.tick_extract)` 和 `await _run(tick.tick_pipeline)`，使得 RPC 仅受理命令并立即返回 `operation_id`，不再同步阻塞等待长任务执行。

3. **修复 `get_status()` 同步全量扫描**
   - 修改了 `agent_history_article_service.py` 中的 `get_status()`。
   - 移除了同步的 `collect_fragments()` 调用，改为直接返回后台 worker 维护的 `self._pending_cache`，避免了 UI 轮询时的阻塞。

4. **重构 RPC 路由注册机制 (feature_unavailable)**
   - 重写了 `pycore/callmodule/rpc_routes/__init__.py`，将静态的 `from ... import ...` 改为动态的 `importlib.import_module`。
   - 现在，单个可选 feature（如某个路由模块）导入失败时，会被 `try...except` 捕获并记录 `feature_unavailable`，不会再导致整个 RPC 服务（包括 `ui.ping` 和健康路由）启动失败。
''')
