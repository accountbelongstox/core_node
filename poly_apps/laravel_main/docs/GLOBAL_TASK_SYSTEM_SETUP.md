# Global Task System - Setup Guide

## Implementation Status

✅ **COMPLETED:**
- Database migrations created
- Eloquent models implemented (GlobalTask, Worker)
- Service classes implemented (TaskManagerService, WorkerManagerService)
- Controllers implemented (TaskController, WorkerController)
- Routes registered in routes/api.php
- Python test scripts created

⚠️ **PENDING:**
- Run database migrations (requires write permissions)
- Restart Octane server to load new controllers

> **Scope note:** The *Global Task System* (this doc — `global_tasks` / `workers`,
> distributed worker pull/assign) is **distinct** from the *Octane Timer Tasks*
> (`app/Services/TimerTasks/*`). The Octane (Swoole) timer is the single in-process
> sub-minute driver (one timer instance, interceptor pattern — see
> `development-guides/COMMON_TIMER_DESIGN_SPECIFICATION.md`); there is **no** Laravel
> Scheduler or `queue:listen` duplicate. The OctaneTimer references below mean that
> single timer also runs the global-task timeout/offline-worker sweeps every 30s —
> it does not make the Global Task System queue-driven.

---

## Step 1: Fix Database Permissions

The database file needs write permissions:

```bash
# Run as user with appropriate permissions
sudo chown www-data:www-data /www/wwwroot/laravel_db/database.sqlite
sudo chmod 664 /www/wwwroot/laravel_db/database.sqlite
sudo chmod 775 /www/wwwroot/laravel_db/
```

---

## Step 2: Run Migrations

After fixing permissions, run the migrations:

```bash
cd /www/programing/core_node/poly_apps/laravel_main
php artisan migrate
```

This will:
- Add worker-related fields to `global_tasks` table:
  - `execution_type`, `assigned_to`, `assigned_at`, `timeout_at`
  - `timeout_seconds`, `priority`, `retry_count`, `max_retries`
- Create `workers` table for worker registration

---

## Step 3: Restart Octane

The new controllers need to be loaded:

```bash
# Method 1: Reload Octane (if running as current user)
php artisan octane:reload

# Method 2: Stop and restart (if running as root/different user)
sudo kill -TERM $(pgrep -f "octane:start")
php artisan octane:start --host=0.0.0.0 --port=9000 --workers=8 --watch
```

---

## Step 4: Verify API Endpoints

Test that endpoints are working:

```bash
# Test task stats endpoint
curl http://localhost:9000/api/task/stats

# Expected response:
# {"success":true,"stats":{"total":0,"pending":0,"assigned":0,"processing":0,"completed":0,"failed":0}}

# Test worker stats endpoint
curl http://localhost:9000/api/worker/stats

# Expected response:
# {"success":true,"stats":{"total":0,"online":0,"busy":0,"offline":0,"total_completed":0,"total_failed":0}}
```

---

## Step 5: Run Python Tests

Test the system with Python scripts:

```bash
cd /www/programing/core_node/poly_apps/laravel_main/test_scripts

# Test 1: Create tasks
python3 test_create_task.py

# Test 2: Run a single worker (in another terminal)
python3 test_worker.py Worker1 remote_compute remote_ocr

# Test 3: Run concurrent workers test (automated)
python3 test_concurrent_workers.py
```

---

## API Endpoints

### Task Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/task/create` | Create a new task |
| GET | `/api/task/{taskId}/status` | Get task status |
| GET | `/api/task/list` | List tasks with filters |
| GET | `/api/task/stats` | Get task statistics |

### Worker Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/worker/register` | Register a worker |
| POST | `/api/worker/heartbeat` | Send heartbeat |
| GET | `/api/worker/tasks/pull` | Pull tasks (long polling) |
| POST | `/api/worker/tasks/accept` | Accept a task |
| POST | `/api/worker/tasks/result` | Submit task result |
| GET | `/api/worker/list` | List all workers |
| GET | `/api/worker/stats` | Get worker statistics |

---

## Files Created/Modified

### Database Migrations:
- `database/migrations/2025_12_07_071446_add_worker_fields_to_global_tasks_table.php`
- `database/migrations/2025_12_07_071513_create_workers_table.php`

### Models:
- `app/Models/GlobalTask.php` (updated)
- `app/Models/Worker.php` (created)

### Services:
- `app/Services/TaskManagerService.php` (created)
- `app/Services/WorkerManagerService.php` (created)

### Controllers:
- `app/Http/Controllers/TaskController.php` (created)
- `app/Http/Controllers/WorkerController.php` (created)

### Routes:
- `routes/api.php` (updated)

### Test Scripts:
- `test_scripts/test_create_task.py`
- `test_scripts/test_worker.py`
- `test_scripts/test_concurrent_workers.py`
- `test_scripts/README.md`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Laravel Server (Port 9000)              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  TaskController         WorkerController           │ │
│  │  - create()             - register()               │ │
│  │  - status()             - heartbeat()              │ │
│  │  - list()               - pullTasks() [Long Poll]  │ │
│  │  - stats()              - acceptTask()             │ │
│  │                         - submitResult()           │ │
│  │                         - list()                   │ │
│  │                         - stats()                  │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  TaskManagerService     WorkerManagerService       │ │
│  │  - createTask()         - register()               │ │
│  │  - pullTasksForWorker() - heartbeat()              │ │
│  │  - assignTask()         - unregister()             │ │
│  │  - submitResult()       - getAllWorkers()          │ │
│  │  - releaseTimedOutTasks() - getWorkerStats()      │ │
│  │  - cleanOfflineWorkers()                           │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  GlobalTask Model       Worker Model               │ │
│  │  (global_tasks table)   (workers table)            │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           │ HTTP API
                           │
┌──────────────────────────┼──────────────────────────────┐
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Python Worker Client (pycore)                    │  │
│  │  1. Register with server                          │  │
│  │  2. Pull tasks (long polling, 30s timeout)        │  │
│  │  3. Accept task                                   │  │
│  │  4. Process task                                  │  │
│  │  5. Submit result                                 │  │
│  │  6. Send periodic heartbeat                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  Multiple workers can run concurrently                  │
│  Each worker has processor_types capabilities           │
│  Smart allocation matches tasks to capable workers      │
└─────────────────────────────────────────────────────────┘
```

---

## Smart Allocation Logic

1. **Worker Registration:**
   - Worker specifies `processor_types`: `['remote_compute', 'remote_ocr']`
   - Worker ID is unique per worker instance
   - Worker marked as `online`, heartbeat recorded

2. **Task Creation:**
   - Task has `execution_type`: `'remote_compute'`
   - Task has `priority` (higher = more important)
   - Task starts with status `'pending'`

3. **Task Pulling (Long Polling):**
   - Worker requests tasks via `/api/worker/tasks/pull`
   - Server filters pending tasks by worker's `processor_types`
   - Returns tasks ordered by priority (desc) and creation time (asc)
   - Waits up to 30 seconds if no tasks available

4. **Task Assignment (Lock with Transaction):**
   - Worker accepts task via `/api/worker/tasks/accept`
   - Server uses database transaction + row locking
   - Checks if task is still `'pending'`
   - If yes: assigns to worker, sets `timeout_at`
   - If no: returns error (already assigned)
   - **This prevents duplicate assignment**

5. **Timeout Monitoring (OctaneTimer):**
   - Every 30 seconds, check for timed-out tasks
   - Release tasks where `timeout_at <= now()`
   - Mark task as `'pending'` again for reassignment
   - Release worker from task

6. **Result Submission (Duplicate Detection):**
   - Worker submits result via `/api/worker/tasks/result`
   - Server checks if `task.assigned_to == worker_id`
   - If no match: task was reassigned, reject submission
   - If match: accept result and update task status
   - **This prevents duplicate results**

---

## Configuration

### Task Timeouts
- Default: 120 seconds
- Configurable per task via `timeout_seconds` parameter
- Monitored by OctaneTimer every 30 seconds

### Worker Heartbeat
- Timeout: 120 seconds (Worker::HEARTBEAT_TIMEOUT)
- Workers marked offline if no heartbeat within timeout
- Offline workers' tasks are released automatically

### Long Polling
- Default timeout: 30 seconds
- Configurable via `timeout` parameter (1-30 seconds)
- Worker waits for tasks, checks every 1 second

---

## Troubleshooting

### Issue: 404 Not Found
**Cause:** Octane hasn't reloaded controllers
**Solution:** Restart Octane (see Step 3)

### Issue: Database readonly error
**Cause:** Insufficient permissions
**Solution:** Fix database permissions (see Step 1)

### Issue: Routes not showing in route:list
**Cause:** Syntax error in routes/api.php
**Solution:** Check for PHP syntax errors:
```bash
php -l routes/api.php
```

### Issue: Worker not receiving tasks
**Possible causes:**
1. Worker `processor_types` don't match task `execution_type`
2. Worker not registered
3. Tasks already assigned

**Check:**
```bash
# List all workers
curl http://localhost:9000/api/worker/list

# List all tasks
curl http://localhost:9000/api/task/list
```

---

## Next Steps (Python Worker Integration)

1. **Implement pycore worker client** (`pycore/pyutils/task_worker/worker_client.py`)
2. **Add to pycore module callmodule router** (new endpoint for task processing)
3. **Create worker management CLI** in pycore
4. **Integrate with existing RPC system** (optional)

See test scripts for reference implementation.
