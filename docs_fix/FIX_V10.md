# FIX V10：pyfoundations 分层清理

## 1. 目标

在 V3-V9 后，将 pyfoundations 中较高层策略、仓储、launcher、storage、device、workflow 移到 database、pyutils 或 pyctl。保持行为的 import refactor，不与功能重写混做。

## 2. 层级

- pyfoundations：最低 OS/path/process/thread/lock/event/platform 原语和中立 ABI 常量。
- database：engine/session/schema/migration/repository/cursor/持久序列化和全局持久数据类型。
- pyutils：按 domain 组织可复用高层工具；可依赖 foundations/database，不得跨 pyutils domain 导入。
- pyctl：service lifecycle、feature policy、应用动作编排。

禁止 foundations 向上导入、database 向上导入、foundations 中 DB、import-time install/launch/model load/DB mutation、用局部 import 隐藏循环。

## 3. 入口阻断项

先处理 pycore/__init__.py 的 try/except 缩进完整性。此前日志：

~~~text
IndentationError: expected an indented block after try statement
~~~

入口修复必须保持 import 顶部、消除循环根因，不用 except ImportError 吞真实语法/初始化错误，不把 feature 初始化重新塞回包入口。

## 4. 移置清单

| 当前模块 | 目标 | 处理 |
|---|---|---|
| pyfoundations/state_store | database | V4 提前完成并删除旧 namespace。 |
| pyfoundations/database_base.py | database | 合并现有 BaseModel，禁止双 base。 |
| pyfoundations/pg_sync_adapter.py | database/adapters | 移 PostgreSQL adapter。 |
| pyfoundations/tts_engine_policy.py | pyutils/tts | 移 engine/capability policy。 |
| pyfoundations/isolated_venv.py | pyutils/python_env | 移环境/package workflow。 |
| pyfoundations/app_launcher.py | pyutils/launcher | 移 launcher 行为。 |
| pyfoundations/launcher_config.py | pyutils/launcher | 移配置/校验。 |
| pyfoundations/service_launcher_provider.py | pyutils/launcher 或 pyctl | provider 复用在 utils，应用编排在 ctl。 |
| pyfoundations/heartbeat | pyutils/heartbeat | 移 heartbeat scheduling/service。 |
| pyfoundations/tasks.py | pyutils/heartbeat 或 pyctl | 拆 scheduling mechanics 与 app tasks。 |
| pyfoundations/device | 现有 pyutils/device | 合并，不建第二 domain。 |
| pyfoundations/text_parsing.py | pyutils/text | 移 text parsing。 |
| pyfoundations/punctuation_markers.py | pyutils/text | 移语言标点 policy。 |
| pyfoundations/file_lock_manager.py | pyutils/storage | primitive file_lock 可留，manager 上移。 |
| pyfoundations/split_file_store.py | pyutils/storage | 移高层 file storage。 |
| pyfoundations/user_data_store.py | database + migrations | 持久 config/data 入 database；system_paths 只算路径。 |
| pyfoundations/secret_manager.py | 拆分 | OS credential primitive 可留；provider/API key 语义上移。 |
| pyfoundations/ai_runtime_policy.py | 拆分 | neutral ABI 可留；model/runtime selection 上移。 |
| pyfoundations/python_package_policy.py | 拆分 | metadata primitive 可留；install/pin/CUDA policy 上移。 |
| pyfoundations/third_party | 拆分 | lowest loader 可留；package acquisition/feature policy 上移。 |

## 5. 候选保留

只有通过 leaf audit 才保留：app_config_path.py、event_bus.py、file_lock.py、serialized_worker.py、stdio_utils.py、system_info.py、system_paths.py、thread_bus_constants.py、thread_bus、pybasecommon、gvar。发现高层 import/policy 就拆分，不豁免。

## 6. 每模块步骤

1. 先找目标层已有等价组件并合并。
2. 记录公共 symbol 和 importers。
3. 分离最低 primitive 与 policy/orchestration。
4. 移实现并一次更新所有 importers。
5. 删除旧 module/export，不留向上 shim。
6. 通过最低有效层的中立 data/protocol 打断 cycle。
7. 保持 config key、error code、persisted data 和 V3-V9 行为。

## 7. database 扫描

扫描 sqlite3、SQLAlchemy engine/session、PostgreSQL driver、CREATE TABLE、migration/version table、cursor store、repository pattern，所有所有权归 database。全局 table key、record revision、durable cursor、event identity、transaction result 类型归 database。

## 8. import 规则

~~~text
pyfoundations → stdlib/批准的最低外部原语
database → pyfoundations
pyutils/domain → pyfoundations + database
pyctl → pyfoundations + database + pyutils
feature/UI → 发布的低层接口
~~~

pyutils domain 不互相 import。只有真正最低原语才下沉 foundations。

## 9. 验收

- pycore/__init__.py 无不完整 try/except，入口不做高层副作用。
- foundations 只剩审计过的最低原语。
- 无 persistence/repository/DB driver/launcher/TTS/workflow。
- 清单每项有 keep/move/split 记录。
- database 是唯一持久化所有者。
- pyutils domain 不互相导入。
- 无新增 lazy import 隐藏循环。
- V3-V9 行为不因移动改变。