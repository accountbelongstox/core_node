# Continuous Task Testing Guide

## Overview

Test the Worker task system with continuous task creation and monitoring.

## Files

1. **`test-worker-continuous.py`** - Continuously pulls and prints tasks
2. **`create-test-tasks.sh`** - Creates tasks periodically (requires auth)

---

## Quick Start (No Authentication Required)

### Step 1: Start the Monitor

In terminal 1:
```bash
cd /www/programing/core_node/apps/mcp-chrome
python3 test-worker-continuous.py
```

The monitor will:
- Register as a Worker
- Send periodic heartbeats
- Poll for tasks every 30 seconds
- Print task details when found

### Step 2: Manually Create Tasks

In terminal 2, create tasks manually:

#### Option A: Using curl with authentication
```bash
curl -X POST http://localhost:9000/api/app_qy_v1/dictionary/tasks/create-explanation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "language": "english",
    "limit": 10,
    "is_demo_mode": true
  }'
```

#### Option B: Using Laravel tinker
```bash
cd /www/programing/core_node/poly_apps/laravel_main

php artisan tinker
```

Then in tinker:
```php
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationTaskService;

$taskManager = app(TaskManagerService::class);
$translationService = new AppQyV1TranslationTaskService($taskManager);

// Create a task
$result = $translationService->createDictionaryExplanationTask('english', 10, true);
print_r($result);

// Create multiple tasks
for ($i = 0; $i < 5; $i++) {
    $result = $translationService->createDictionaryExplanationTask('english', 5, true);
    echo "Task {$i}: {$result['task_id']}\n";
}
```

---

## With Authentication (Automated)

If you have authentication set up:

### Step 1: Set Authentication Token

```bash
export AUTH_TOKEN='your-bearer-token-here'
```

### Step 2: Start Task Creator

In terminal 1:
```bash
cd /www/programing/core_node/apps/mcp-chrome
./create-test-tasks.sh
```

Creates a new task every 5 seconds.

### Step 3: Start Monitor

In terminal 2:
```bash
cd /www/programing/core_node/apps/mcp-chrome
python3 test-worker-continuous.py
```

---

## Expected Output

### Monitor Output

```
╔════════════════════════════════════════════════════════════════════╗
║        Continuous Worker Task Monitor - Backend Port 9000         ║
╚════════════════════════════════════════════════════════════════════╝
API URL       : http://localhost:9000
Worker ID     : worker-monitor-xxx-xxx-xxx
Poll Timeout  : 30s

Press Ctrl+C to stop...

[2025-12-16 10:30:00] [INFO] Registering worker...
[2025-12-16 10:30:00] [INFO] ✓ Worker registered: worker-monitor-xxx
[2025-12-16 10:30:00] [INFO] Starting continuous task polling...

[2025-12-16 10:30:01] [INFO] Polling for tasks (timeout: 30s)...
[2025-12-16 10:30:15] [SUCCESS] ✓ Found 1 task(s)

======================================================================
TASK #1 - 10:30:15
======================================================================
Task ID       : task_xxx-xxx-xxx
App Name      : AppQyV1
Task Type     : dictionary_explanation
Status        : pending
Priority      : 50
Timeout       : 90s
Created       : 2025-12-16T10:30:00.000000Z

--- Payload ---
Language      : english
Word Count    : 10
Demo Mode     : True

--- Words (10 total) ---
   1. hello                  (MD5: 5d41402abc4b... | Queries: 0)
   2. world                  (MD5: 7d793037a076... | Queries: 0)
   ...
======================================================================

[2025-12-16 10:30:16] [INFO] Polling for tasks (timeout: 30s)...
[2025-12-16 10:30:46] [INFO] ○ No tasks available
```

---

## Backend Support for Continuous Distribution

The backend already supports continuous task distribution through:

### 1. Long Polling Mechanism

- **Endpoint**: `GET /api/worker/tasks/pull?worker_id=xxx&timeout=30`
- **Behavior**: Waits up to 30 seconds for new tasks
- **Implementation**: `WorkerController@pullTasks` with sleep loop

### 2. Task Queue System

- **Automatic Scheduling**: Tasks are automatically queued and distributed
- **Priority Ordering**: Higher priority tasks distributed first
- **Worker Matching**: Only tasks matching Worker's `processor_types` are returned

### 3. Multiple Worker Support

- **Concurrent Workers**: Multiple Workers can pull tasks simultaneously
- **Task Locking**: Tasks are locked when pulled (status: pending)
- **Conflict Prevention**: Already assigned tasks return 409 error

### 4. Auto-Release Mechanism

- **Timeout Handling**: Tasks timeout if not completed within specified time
- **Auto Re-queue**: Timed-out tasks automatically return to pending status
- **Retry Logic**: Failed tasks retry up to max_retries (default 3)

---

## Stopping the Tests

Press `Ctrl+C` in each terminal to stop:

```
[2025-12-16 10:35:00] [INFO] Monitor stopped by user
[2025-12-16 10:35:00] [INFO] Total tasks processed: 15
```

---

## Troubleshooting

### Monitor shows "No tasks available"

**Solution**: Create tasks manually or ensure task creator is running

### Authentication errors in task creator

**Solution**: Set valid AUTH_TOKEN or use Laravel tinker method

### Connection refused

**Solution**: Verify backend is running on port 9000

### Tasks not being distributed

**Check**:
```bash
# View all tasks
curl http://localhost:9000/api/task/list

# View all workers
curl http://localhost:9000/api/worker/list

# Check task stats
curl http://localhost:9000/api/task/stats
```

---

## Performance Notes

- **Long Polling**: Reduces server load compared to rapid polling
- **Heartbeat**: Sent every 2 poll cycles (~60s)
- **Timeout**: 30s allows efficient task distribution
- **Demo Mode**: Using `is_demo_mode: true` prevents database writes

---

## Backend Hot Reload

Backend supports hot reload - no restart needed:
- Code changes auto-reload
- Workers maintain connection
- Tasks remain in queue
