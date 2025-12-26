========================================
Translation Worker System - Quick Start
========================================

## Overview

This system implements WebSocket-enabled task distribution for translation tasks:
- Laravel backend with GlobalTask system
- Laravel Reverb for WebSocket broadcasting
- Python worker client that processes translation tasks
- Demo mode support (no database writes)

## Architecture

Backend (Laravel):
  - GlobalTask: Task management system
  - TaskManagerService: Task distribution with WebSocket broadcasting
  - AppQyV1TranslationTaskService: Translation task creation
  - Broadcasting Events: TaskAssigned, TaskProgress, TaskCompleted, TaskFailed

Client (Python):
  - translation_worker_client.py: Worker that polls tasks and reports progress
  - HTTP API for task management
  - WebSocket support for real-time task assignments (future)

## Installation

1. Install/Configure Reverb:
   cd /www/programing/core_node/poly_apps/laravel_main
   bash scripts/deploy.sh

2. Initialize system:
   php artisan sys:init

3. Install Python dependencies:
   pip3 install httpx asyncio

## Usage

### Start Worker Client:

   cd /www/programing/core_node/scripts/python_clients
   python3 translation_worker_client.py

   Or use the test script:
   bash test_translation_worker.sh

### Create Translation Task (from Laravel):

   use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationTaskService;
   use App\Services\TaskManagerService;

   $service = new AppQyV1TranslationTaskService(new TaskManagerService());

   // Create demo task (no database write)
   $taskInfo = $service->createTranslationTask(
       ['hello', 'world', 'task'],
       'english',
       'chinese',
       true  // isDemoMode = true
   );

   echo "Task created: " . $taskInfo['task_id'];

### Monitor Task Progress:

   The worker will automatically:
   1. Register with backend
   2. Poll for available tasks
   3. Accept and process tasks
   4. Report progress (20%, 40%, 60%, 80%, 100%)
   5. Submit final result

   WebSocket broadcasts (if Reverb running):
   - worker.{worker_id} channel: Receives task assignments
   - task.{task_id} channel: Receives progress updates

## Testing Demo Mode

Demo mode allows testing without writing to database:

1. Start worker:
   python3 translation_worker_client.py

2. In Laravel artisan tinker:
   use App\Services\TaskManagerService;
   use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationTaskService;

   $tm = new TaskManagerService();
   $ts = new AppQyV1TranslationTaskService($tm);

   // Create demo task
   $task = $ts->createTranslationTask(
       ['hello', 'world', 'system', 'worker', 'task'],
       'english',
       'chinese',
       true  // Demo mode
   );

   echo "Created demo task: " . $task['task_id'];

3. Watch worker console for task processing

## File Structure

Backend:
  app/Events/
    TaskAssignedEvent.php       - Task assignment broadcast
    TaskProgressEvent.php       - Progress updates broadcast
    TaskCompletedEvent.php      - Completion broadcast
    TaskFailedEvent.php         - Failure broadcast

  app/Services/
    TaskManagerService.php      - Task management (updated with broadcasts)

  app/Models/
    GlobalTask.php              - Task model (added EXECUTION_REMOTE_CLIENT)

  app/Apps/AppQyV1/AppQyV1Services/
    AppQyV1TranslationTaskService.php  - Translation task service

Scripts:
  scripts/deploy.sh                   - Added up_20251215_install_reverb()
  scripts/python_clients/
    translation_worker_client.py      - Python worker client
    test_translation_worker.sh        - Test script

## Key Features

✅ Task distribution with priority queue
✅ WebSocket broadcasting for real-time updates
✅ Demo mode (no database writes)
✅ Progress reporting (0-100%)
✅ Automatic retry on failure
✅ Worker heartbeat monitoring
✅ Timeout detection and task reassignment
✅ Multi-worker support
✅ Transaction-safe task assignment

## Configuration

.env variables:
  BROADCAST_CONNECTION=reverb
  REVERB_APP_ID=task-system
  REVERB_APP_KEY=reverb-key-...
  REVERB_APP_SECRET=reverb-secret-...
  REVERB_HOST=0.0.0.0
  REVERB_PORT=8080
  REVERB_SCHEME=http

## API Endpoints

Worker API:
  POST /api/worker/register        - Register worker
  POST /api/worker/heartbeat       - Send heartbeat
  GET  /api/worker/tasks/pull      - Pull available tasks
  POST /api/worker/tasks/accept    - Accept task
  POST /api/worker/tasks/result    - Submit result/progress

Task API:
  POST /api/task/create            - Create task
  GET  /api/task/{id}/status       - Get task status

## Troubleshooting

1. Worker not receiving tasks:
   - Check worker is registered: check database workers table
   - Verify task execution_type matches worker processor_types
   - Check task status is 'pending'

2. WebSocket not working:
   - Verify Reverb is installed: composer show | grep reverb
   - Check BROADCAST_CONNECTION=reverb in .env
   - Start Reverb server: php artisan reverb:start

3. Tasks timing out:
   - Increase timeout_seconds in createTask()
   - Check worker heartbeat is working
   - Verify network connectivity

## Next Steps

1. Enable Reverb server for real-time WebSocket:
   php artisan reverb:start

2. Implement actual translation API:
   - Replace demo translator in translate_word()
   - Add ChatGPT/DeepL/Google Translate integration

3. Add database persistence for non-demo mode:
   - Update processTranslationResult() in AppQyV1TranslationTaskService
   - Store translations in dictionary tables

4. Scale horizontally:
   - Run multiple worker instances
   - Use Redis for Reverb scaling

========================================
Created: 2025-12-15
System: GlobalTask + Reverb + WebSocket
========================================
