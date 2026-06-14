# 全局任务系统 - 文件清单

## ✅ 已创建/修改的文件

### 1. 数据库迁移文件 (Migrations)
- ✅ `database/migrations/2025_12_07_071446_add_worker_fields_to_global_tasks_table.php`
  - 创建或更新 `global_tasks` 表
  - 添加 worker 相关字段：execution_type, assigned_to, timeout_at, priority 等
  - 添加索引：idx_task_pulling, idx_timeout_check
  - **语法检查**: ✅ 通过

- ✅ `database/migrations/2025_12_07_071513_create_workers_table.php`
  - 创建 `workers` 表
  - 包含字段：worker_id, processor_types, status, last_heartbeat_at 等
  - 添加索引：idx_worker_status
  - **语法检查**: ✅ 通过

### 2. Eloquent 模型 (Models)
- ✅ `app/Models/GlobalTask.php`
  - 任务模型
  - 方法：assignTo(), releaseAssignment(), complete(), fail(), canRetry()
  - 作用域：pending(), assigned(), timedOut()
  - 常量：STATUS_*, EXECUTION_*
  - **语法检查**: ✅ 通过

- ✅ `app/Models/Worker.php`
  - Worker 模型
  - 方法：markOnline(), markOffline(), heartbeat(), isAlive(), canProcess()
  - 方法：assignTask(), releaseTask(), incrementCompleted(), incrementFailed()
  - 作用域：online(), canProcess()
  - 常量：STATUS_*, HEARTBEAT_TIMEOUT
  - **语法检查**: ✅ 通过

### 3. 服务层 (Services)
- ✅ `app/Services/GlobalTaskSystemInitializer.php`
  - 初始化服务
  - 方法：ensureTablesExist(), getTableStats()
  - 自动创建/更新表结构
  - **语法检查**: ✅ 通过

- ✅ `app/Services/TaskManagerService.php`
  - 任务管理服务
  - 方法：createTask(), pullTasksForWorker(), assignTask()
  - 方法：submitResult(), releaseTimedOutTasks(), cleanOfflineWorkers()
  - 方法：getTaskStats()
  - **语法检查**: ✅ 通过

- ✅ `app/Services/WorkerManagerService.php`
  - Worker 管理服务
  - 方法：register(), heartbeat(), unregister()
  - 方法：getAllWorkers(), getWorkerStats()
  - **语法检查**: ✅ 通过

### 4. 控制器 (Controllers)
- ✅ `app/Http/Controllers/TaskController.php`
  - 任务 API 控制器
  - 端点：create(), status(), cancel(), list(), stats(), cleanInvalid(), resetAssigned()
  - **语法检查**: ✅ 通过

- ✅ `app/Http/Controllers/WorkerController.php`
  - Worker API 控制器
  - 端点：register(), heartbeat(), pullTasks(), acceptTask()
  - 端点：submitResult(), list(), stats()
  - **语法检查**: ✅ 通过

### 5. 路由 (Routes)
- ✅ `routes/api.php`
  - 添加任务路由：/api/task/*
  - 添加 worker 路由：/api/worker/*
  - **语法检查**: ✅ 通过（通过 PHP 文件检查）

### 6. 命令 (Commands)
- ✅ `app/Console/Commands/InitializeApps.php`
  - 修改 sys:init 命令
  - 添加全局任务系统初始化步骤（行 311-349）
  - **语法检查**: ✅ 原有文件

### 7. 测试脚本 (Test Scripts)
- ✅ `test_scripts/test_create_task.py`
  - Python 脚本：创建测试任务
  - **语法检查**: Python 脚本

- ✅ `test_scripts/test_worker.py`
  - Python 脚本：模拟 worker 客户端
  - **语法检查**: Python 脚本

- ✅ `test_scripts/test_concurrent_workers.py`
  - Python 脚本：并发 worker 测试
  - **语法检查**: Python 脚本

- ✅ `test_scripts/README.md`
  - 测试脚本文档

### 8. 文档 (Documentation)
- ✅ `GLOBAL_TASK_SYSTEM_SETUP.md`
  - 完整的设置指南
  - API 文档
  - 架构图
  - 故障排除

- ✅ `GLOBAL_TASK_SYSTEM_FILES.md` (本文件)
  - 文件清单

## 🧭 两层任务机制:Octane Timer Tasks vs Global Tasks(不是冗余)

三端都存在"task"一词,实际是**两层正交机制**,职责不同、互相驱动:

| | Octane Timer Tasks(调度层) | Global Tasks(分发层) |
|---|---|---|
| 本质 | 进程内**定时调度**(cron 角色) | 数据库持久化的**分布式工作队列** |
| 实现 | `OctaneTimerServiceProvider` 1s tick → `TimerTasks/*` 按间隔执行 | `global_tasks`+`workers` 表,原子认领 + 结果回传 |
| 状态 | 内存运行计数(run_count/last_run),重启清零 | DB 行(7 状态生命周期),跨进程跨机器 |
| 执行者 | Octane 进程自身 | 外部 worker:pycore、chrome 扩展、laravel-internal-ai |
| Dashboard | OctaneTasks 视图(/octane-tasks/status) | GlobalTasks 视图(/api/task/* + /api/worker/*) |

**交集 = 定时任务充当队列的角色**(这正是两层协作的设计):
- `AppQyV1WordTranslationScanTask` / `AppQyV1DictionaryTranslationTask`(定时)→ **生产**全局任务;
- `AppQyV1WordTranslationFillerTask`(定时)→ 作为内部 worker **消费**全局任务;
- `GlobalTaskMaintenanceTask`(定时)→ **维护**全局任务(超时释放/清理)。

pycore 端同构:PyHeartbeat(1s 心跳 + 回调间隔)≈ 调度层;
`pyctl/desktop/task_manager.py` 本地 TaskManager ≈ 本进程任务记录
(remote_translation 任务会同时有一条本地记录,用于线程派发与本地 UI 可见,
全局任务行才是事实源——这是有意的镜像,不是重复实现)。

已知的少量真实冗余(可接受/留意):
- `GlobalTask::EXECUTION_LOCAL_TIMER` 常量从未使用(残留);
- `/api/task/reset-assigned` 与维护定时器的超时释放部分重叠
  (它是无视租约的"全量立即重置"管理动作,慎用)。

### 任务端点 (Task Endpoints)
| 方法 | 路径 | 控制器方法 |
|------|------|-----------|
| POST | /api/task/create | TaskController@create |
| GET | /api/task/{taskId}/status | TaskController@status |
| POST | /api/task/{taskId}/cancel | TaskController@cancel |
| GET | /api/task/list | TaskController@list |
| GET | /api/task/stats | TaskController@stats |
| POST | /api/task/clean-invalid | TaskController@cleanInvalid |
| POST | /api/task/reset-assigned | TaskController@resetAssigned |

> 注：`/api/worker/tasks/accept` 是**幂等确认**——`tasks/pull` 已经原子认领任务,
> accept 对已拥有的任务直接成功、对仍 pending 的任务补领、对他人任务返回 409。
> 任务恢复(超时释放 assigned+processing、离线 worker 清理、终态任务保留期清理)
> 由 `GlobalTaskMaintenanceTask`(Octane 定时器,15s)负责。

### Task Center 聚合端点(统一管理页的数据源)
| 方法 | 路径 | 控制器方法 |
|------|------|-----------|
| GET | /api/task-center/overview | TaskCenterController@overview |

一次轮询返回两层全貌:`scheduler`(定时器运行态,每个任务标注
`queue_role: producer|consumer|maintainer|null` + `queue_target`)、
`queue.stats`(完整 7 状态统计)、`workers.stats`、`relations`(调度层↔队列层
角色关系表,UI 关系图据此渲染,前端不硬编码)。明细/列表仍走原有端点
(`/octane-tasks/*`、`/api/task/*`、`/api/worker/*`)——聚合层只做组合,不做替代。
pycore 端有对称端点 `GET :59000/api/local/task-center`(PyHeartbeat≈调度层、
本地 TaskManager≈本地任务记录、remote_queue=对 Laravel 队列的视角),三端同构。

### Worker 端点 (Worker Endpoints)
| 方法 | 路径 | 控制器方法 |
|------|------|-----------|
| POST | /api/worker/register | WorkerController@register |
| POST | /api/worker/heartbeat | WorkerController@heartbeat |
| GET | /api/worker/tasks/pull | WorkerController@pullTasks |
| POST | /api/worker/tasks/accept | WorkerController@acceptTask |
| POST | /api/worker/tasks/result | WorkerController@submitResult |
| GET | /api/worker/list | WorkerController@list |
| GET | /api/worker/stats | WorkerController@stats |

## 🗄️ 数据库表结构

### global_tasks 表
```
id, task_id, app_name, task_type, execution_type, status,
assigned_to, assigned_at, timeout_at, timeout_seconds,
priority, retry_count, max_retries, progress, payload,
steps, result, error, queue_item_id, created_at, updated_at
```

**索引：**
- task_id (unique)
- app_name, execution_type, status, assigned_to, timeout_at, priority
- idx_task_pulling (status, execution_type, priority)
- idx_timeout_check (status, timeout_at)

### workers 表
```
id, worker_id, worker_name, processor_types, status,
last_heartbeat_at, hostname, platform, metadata,
completed_tasks, failed_tasks, current_task_id,
created_at, updated_at
```

**索引：**
- worker_id (unique)
- status, last_heartbeat_at
- idx_worker_status (status, last_heartbeat_at)

## ✅ 语法检查状态

所有 PHP 文件已通过语法检查：

```bash
✅ app/Services/GlobalTaskSystemInitializer.php
✅ app/Services/TaskManagerService.php
✅ app/Services/WorkerManagerService.php
✅ app/Models/GlobalTask.php
✅ app/Models/Worker.php
✅ app/Http/Controllers/TaskController.php
✅ app/Http/Controllers/WorkerController.php
✅ database/migrations/2025_12_07_071446_add_worker_fields_to_global_tasks_table.php
✅ database/migrations/2025_12_07_071513_create_workers_table.php
```

## 🚀 下一步操作

1. **运行初始化**
   ```bash
   cd ./poly_apps/laravel_main/
   php artisan sys:init
   ```

2. **重启 Octane**（加载新控制器）
   ```bash
   sudo pkill -f "octane:start"
   php artisan octane:start --host=0.0.0.0 --port=9000 --workers=8 --watch &
   ```

3. **测试 API**
   ```bash
   curl http://localhost:9000/api/task/stats
   curl http://localhost:9000/api/worker/stats
   ```

4. **运行 Python 测试**
   ```bash
   cd test_scripts
   python3 test_concurrent_workers.py
   ```

## 📝 备注

- 所有迁移文件已修复，会自动检查表是否存在
- 所有服务、模型、控制器已完成并通过语法检查
- Python 测试脚本已准备就绪
- 初始化已集成到 `php artisan sys:init` 命令中
