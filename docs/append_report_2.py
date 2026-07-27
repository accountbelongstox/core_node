with open('d:/programing/core_node/docs/PYCORE_MANAGER_BUG_LIST-2.md', 'a', encoding='utf-8') as f:
    f.write('''
**已完成：实施顺序第 3 步和第 4 步 (SQLite State Store 与 Agent History 迁移)**

1. **建立 SQLite State Store (`pycore/pyfoundations/state_store`)**
   - 创建了 `schema.py` 定义了 `operations`, `operation_items`, `operation_events` 等表结构。
   - 创建了 `models.py` 定义了数据模型。
   - 创建了 `repository.py` 实现了线程安全的 SQLite 仓储，支持事务和乐观锁并发控制。

2. **实现 Operation Lifecycle Services**
   - 创建了 `operation_service.py` 用于管理 operation 和 item 的状态转换、进度更新和汇总。
   - 创建了 `operation_event_service.py` 用于记录结构化的事件日志（`seq` 机制）。
   - 创建了 `operation_routes.py` 提供了 `ui.operation.snapshot` 和 `ui.operation.events` 等 RPC 接口。

3. **重构 Agent History Pipeline (`pycore/callmodule/services/agent_history_pipeline`)**
   - 将原本庞大的 `agent_history_article_service.py` 拆分为模块化的 pipeline。
   - `planner.py`: 负责扫描 fragment 并规划 batch。
   - `worker.py`: 负责驱动 item 经过各个 checkpoint stage。
   - `article_stages.py`: 负责 CN 生成和 EN 翻译。
   - `audio_stage.py`: 负责 TTS 合成。
   - `laravel_stage.py`: 负责 Laravel 上传。

4. **实现 Checkpoint Stages 断点续传**
   - 将 Agent History 的处理流程拆分为明确的阶段：`queued` -> `generating_reference_cn` -> `translating_target_en` -> `synthesizing_audio` -> `saving_local_result` -> `uploading_laravel` -> `completed`。
   - 每个阶段的结果都会持久化到 `operation_items` 的 `checkpoint_json` 中，重启后可直接从上一个成功的阶段恢复，避免重复消耗 API 额度。

5. **更新 RPC 路由与 Tick 服务**
   - 更新了 `local_agent_history_routes.py`，移除了旧的同步逻辑，改用新的 pipeline 接口。
   - 更新了 `agent_history_tick_service.py`，调用新的 `tick_pipeline()`。
''')
