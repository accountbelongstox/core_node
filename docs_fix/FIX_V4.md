# FIX V4：SQLite state store 统一到 pycore/database

## 1. 目标

pycore/database 成为 Pycore 唯一持久化地基。移除错误的 pycore/pyfoundations/state_store，修复现有 database 公共入口，并为 operation、RPC delivery、UI snapshot、Laravel cursor 提供模型、迁移和仓储。

## 2. 分层

~~~text
pyfoundations：最低 OS/runtime 原语
      ↓
database：engine/session/model/migration/repository
      ↓
pyutils：可复用功能服务
      ↓
pyctl：应用编排
~~~

禁止在 pyfoundations 留一个向上导入 database 的兼容 shim。

## 3. 已知问题

- pyfoundations/state_store/repository.py 自行管理 sqlite3、threading.local、schema、transaction。
- 它的数据库路径/生命周期与现有 DatabaseManager 分裂。
- database/__init__.py 的 type_converter/json_serializer import 不完整或错位，先修复可导入性。
- 现有 DatabaseManager、BaseModel、TableKeys、models 未被初版 store 复用。
- RPC durable delivery、UI snapshots 尚无标准仓储。

## 4. 目标结构

复用现有实现，必要时形成：

~~~text
pycore/database/
  database_manager.py
  base_model.py
  table_keys.py
  models/
    operation.py
    operation_item.py
    operation_event.py
    ui_state_snapshot.py
    remote_log_cursor.py
    rpc_event_outbox.py
    rpc_client_delivery.py
    rpc_client_offset.py
    rpc_command_idempotency.py
  repositories/
    operation_repository.py
    ui_state_repository.py
    remote_log_repository.py
    rpc_delivery_repository.py
  migrations/
  adapters/
~~~

## 5. 最小记录

- operation：id/kind/owner/status/progress/stage/message/input/result/error/revision/各时间。
- item：operation_id/item_key/position/status/progress/stage/input/result/error/revision/各时间；唯一键 operation_id + item_key。
- event：event_id/operation_id/item_key/sequence/type/revision/payload/created_at。
- UI snapshot：client_id/page_key/scope_key/revision/state/updated_at。
- outbox：event_id/topic/entity/revision/payload/causation/audience/created/expiry/policy。
- delivery：client_id/event_id/seq/status/attempt/error/sent/acked。
- offset：client_id/highest contiguous acked seq。
- idempotency：client_id/key/route/request_hash/status/response/error/operation_id/expiry。
- Laravel cursor：source/stream/cursor/source revision/time/last success/error/summary。

## 6. 事务与并发

- 状态变更、domain event、outbox 同事务。
- commit 前不得 dispatch。
- ACK 幂等；offset 只跨连续 ACK 前进。
- repository 管事务，调用方不操作 raw connection/session。
- SQLite WAL、busy timeout、并发、retryable 分类、shutdown 归 database。
- 使用修复后的现有 serializer/converter。
- UTC 时间；payload 有大小上限。
- schema 只由版本迁移管理，禁止 import-time CREATE TABLE。

TableKeys 增加稳定表键。路径由 DatabaseManager 和标准 data path 解析，不另造独立 pycore_state.sqlite3 所有者。

## 7. 迁移步骤

1. 修复 database/__init__.py。
2. 增加/复用 keys、models、migrations、repositories。
3. 若已部署过初版表，写可重启、版本化、幂等数据迁移。
4. operation/state_store 调用切 database 仓储。
5. 全部调用者切换后删除 pyfoundations/state_store。
6. V10 再扫描其他数据库类模块。

上层依赖 database 暴露的数据对象/仓储接口，不依赖 sqlite row 或 SQLAlchemy session。

## 8. 验收

- database 公共入口可正常导入。
- 所有最小记录有 migration/repository。
- database 外无直接 sqlite3/驱动所有权。
- pyfoundations/state_store、database_base 不再拥有持久化。
- 重启保留 operation/item/event/UI/RPC/idempotency/Laravel cursor。
- 状态和 outbox 原子一致。
- 第三轮已有 operation 行为未倒退。