# Worker Task Pull Test Scripts

Test scripts to verify backend Worker API functionality. These scripts will:
1. Register as a Worker
2. Send heartbeat
3. Pull tasks from the queue
4. Accept a task
5. Print task details

**Note**: These scripts do NOT submit results. Tasks will timeout and return to pending status.

## Prerequisites

### For Node.js Script
- Node.js 18+ (for native fetch API support)

### For Python Script
- Python 3.6+
- requests library: `pip install requests`

## Usage

### 1. Set API URL (Optional)

Default is `http://localhost:8000`. To use a different URL:

```bash
export API_URL=http://your-backend-url
```

### 2. Create a Translation Task

Before running the test script, create a translation task using authenticated API:

```bash
curl -X POST http://localhost:8000/api/app_qy_v1/dictionary/tasks/create-explanation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "language": "english",
    "limit": 10,
    "is_demo_mode": true
  }'
```

Or manually add some untranslated words to the dictionary database.

### 3. Run Test Script

#### Node.js Version:
```bash
node test-worker-pull-task.js
```

#### Python Version:
```bash
python3 test-worker-pull-task.py
```

Or make executable and run directly:
```bash
chmod +x test-worker-pull-task.py
./test-worker-pull-task.py
```

## Expected Output

```
╔════════════════════════════════════════╗
║  Worker Task Pull Test Script         ║
╚════════════════════════════════════════╝
API Base URL: http://localhost:8000
Worker ID: test-worker-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Worker Name: Test Dictionary Worker

========================================
STEP 1: Register Worker
========================================
[REQUEST] POST http://localhost:8000/api/worker/register
[REQUEST BODY] {
  "worker_id": "test-worker-xxx...",
  "worker_name": "Test Dictionary Worker",
  "processor_types": ["remote_client"],
  ...
}
[RESPONSE] Status: 200
✓ Worker registered successfully: test-worker-xxx...

========================================
STEP 2: Send Heartbeat
========================================
✓ Heartbeat sent successfully

========================================
STEP 3: Pull Tasks (Long Polling)
========================================
Waiting for tasks...
✓ Pulled 1 task(s)

========================================
STEP 4: Accept Task
========================================
✓ Task accepted: task_xxx...

========================================
TASK DETAILS
========================================
Task ID: task_xxx-xxx-xxx
App Name: AppQyV1
Task Type: dictionary_explanation
Execution Type: remote_client
Status: pending
Priority: 50
Timeout: 90 seconds
Created At: 2025-12-16T10:30:00.000000Z

--- Payload ---
Language: english
Word Count: 10
Demo Mode: true

--- Words List ---
1. hello (MD5: 5d41402abc4b2a76b9719d911017c592, Query Count: 0)
2. world (MD5: 7d793037a0760186574b0282f2f435e7, Query Count: 0)
...

========================================

✓ Test completed successfully!

Note: Task has been accepted but NOT completed.
The task will timeout and return to pending status after timeout period.
```

## Troubleshooting

### No tasks available

**Message**: `⚠️  No tasks available. Please create a translation task first.`

**Solution**: Create a translation task first (see step 2 above), or add untranslated words to the dictionary.

### Connection refused

**Message**: `[ERROR] Connection refused`

**Solution**:
1. Verify Laravel backend is running
2. Check API_URL is correct
3. Ensure backend is accessible from your machine

### Worker not found (on heartbeat)

**Message**: `Worker not found`

**Solution**: Registration failed. Check backend logs for errors.

### Task already assigned

**Message**: `Task already assigned or not available`

**Solution**: Another Worker accepted the task. Run the script again to pull a new task.

## Notes

- Each run generates a new unique Worker ID
- Tasks are not completed, they will timeout and be released back to the queue
- Default timeout is 10 seconds for task pulling (long polling)
- Scripts are safe to run multiple times
- Backend uses hot reload, no need to restart

## Clean Up

Tasks will automatically timeout and be released. To manually check task status:

```bash
curl http://localhost:8000/api/task/{task_id}/status
```

To view all workers:

```bash
curl http://localhost:8000/api/worker/list
```
