# Backend Worker Task System - API Documentation

## Architecture Overview

The backend uses a **Worker Task Scheduling System** that supports third-party clients as Workers:

### Workflow
```
1. Server creates translation task → Task enters queue (status: pending)
2. Worker client registers and pulls tasks
3. Worker processes task (translates words)
4. Worker submits result to server
5. Server processes result and updates database
```

### Key Concepts
- **Worker**: Third-party client capable of processing specific task types
- **Task**: Task object containing list of untranslated words
- **Execution Type**: Task execution type, dictionary translation uses `remote_client`
- **Processor Types**: List of task types that Worker can handle

---

## Worker API Endpoints (No Authentication Required)

All Worker endpoints are under `/api/worker` path, **no authentication required**, for third-party client integration.

### 1. Worker Registration

**Endpoint**: `POST /api/worker/register`

**Request Body**:
```json
{
  "worker_id": "string (required) - Unique Worker identifier",
  "worker_name": "string (required) - Worker name",
  "processor_types": ["string"] (required) - Array of supported task types, use ["remote_client"] for dictionary translation",
  "hostname": "string (optional) - Hostname",
  "platform": "string (optional) - Platform info",
  "metadata": {} (optional) - Additional metadata"
}
```

**processor_types Options**:
- `remote_client` - Client-executed tasks (used for dictionary translation)
- `remote_compute` - Compute tasks
- `remote_ocr` - OCR tasks
- `remote_translation` - Translation tasks
- `remote_video` - Video processing
- `remote_io` - IO tasks

**Response**:
```json
{
  "success": true,
  "message": "Worker registered successfully",
  "data": {
    "worker_id": "mcp-chrome-xxx"
  }
}
```

---

### 2. Worker Heartbeat

**Endpoint**: `POST /api/worker/heartbeat`

**Description**: Worker must send heartbeat periodically to maintain online status. Will be marked offline if timeout exceeded.

**Heartbeat Timeout**: 180 seconds (see `Worker::HEARTBEAT_TIMEOUT`)

**Request Body**:
```json
{
  "worker_id": "string (required) - Worker ID"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Heartbeat received",
  "data": null
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Worker not found",
  "data": null
}
```

---

### 3. Pull Tasks (Long Polling)

**Endpoint**: `GET /api/worker/tasks/pull`

**Query Parameters**:
- `worker_id` (required) - Worker ID
- `limit` (optional, default 5, range 1-50) - Maximum number of tasks to pull
- `timeout` (optional, default 30, range 1-30) - Long polling timeout in seconds

**Description**:
- Uses long polling mechanism, waits until timeout or new tasks available
- Only returns tasks matching Worker's processor_types
- Sorted by priority (descending) and created_at (ascending)

**Response**:
```json
{
  "success": true,
  "message": "Tasks pulled successfully",
  "data": {
    "count": 1,
    "tasks": [
      {
        "task_id": "task_xxx-xxx-xxx",
        "app_name": "AppQyV1",
        "task_type": "dictionary_explanation",
        "execution_type": "remote_client",
        "status": "pending",
        "payload": {
          "words": [
            {
              "word": "hello",
              "md5": "5d41402abc4b2a76b9719d911017c592",
              "query_count": 0
            }
          ],
          "language": "english",
          "is_demo_mode": false,
          "word_count": 1
        },
        "timeout_seconds": 120,
        "priority": 50,
        "created_at": "2025-12-16T10:30:00.000000Z"
      }
    ]
  }
}
```

**Task Status Explanation**:
- `pending` - Waiting for assignment
- `assigned` - Assigned to Worker
- `processing` - In progress
- `completed` - Completed
- `completed_demo` - Demo mode completed (not written to database)
- `failed` - Failed
- `cancelled` - Cancelled

---

### 4. Accept Task

**Endpoint**: `POST /api/worker/tasks/accept`

**Description**: Worker must accept task after pulling before processing

**Request Body**:
```json
{
  "task_id": "string (required) - Task ID",
  "worker_id": "string (required) - Worker ID"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Task accepted",
  "data": null
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Task already assigned or not available",
  "data": null
}
```

---

### 5. Submit Task Result

**Endpoint**: `POST /api/worker/tasks/result`

**Request Body**:
```json
{
  "task_id": "string (required) - Task ID",
  "worker_id": "string (required) - Worker ID",
  "status": "string (required) - Task status: processing | completed | failed",
  "progress": "number (optional, 0-100) - Progress percentage",
  "result": {} (optional) - Result data, required when status=completed",
  "error": "string (optional) - Error message, recommended when status=failed"
}
```

**status Values**:
- `processing` - Task in progress, can submit multiple times to update progress
- `completed` - Task completed, must provide result field
- `failed` - Task failed, recommended to provide error field

**Dictionary Translation Task Result Format**:
```json
{
  "result": {
    "explanations": [
      {
        "word": "hello",
        "md5": "5d41402abc4b2a76b9719d911017c592",
        "explanation": "int. Used as greeting or to attract attention\nn. A greeting",
        "phonetic": "/həˈləʊ/",
        "us_phonetic": "/həˈloʊ/",
        "uk_phonetic": "/həˈləʊ/",
        "provider": "bing"
      }
    ]
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Result submitted",
  "data": null
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Worker not assigned to this task or task was reassigned",
  "data": null
}
```

---

### 6. Query Worker List

**Endpoint**: `GET /api/worker/list`

**Response**:
```json
{
  "success": true,
  "message": "Workers list retrieved successfully",
  "data": {
    "count": 1,
    "workers": [
      {
        "worker_id": "mcp-chrome-xxx",
        "worker_name": "MCP Chrome Dictionary Worker",
        "processor_types": ["remote_client"],
        "status": "online",
        "hostname": "localhost",
        "platform": "chrome-extension",
        "completed_tasks": 10,
        "failed_tasks": 0,
        "current_task_id": null,
        "last_heartbeat_at": "2025-12-16T10:30:00.000000Z",
        "created_at": "2025-12-16T10:00:00.000000Z"
      }
    ]
  }
}
```

---

### 7. Worker Statistics

**Endpoint**: `GET /api/worker/stats`

**Response**:
```json
{
  "success": true,
  "message": "Worker stats retrieved successfully",
  "data": {
    "stats": {
      "total": 5,
      "online": 3,
      "offline": 2,
      "idle": 2,
      "working": 1
    }
  }
}
```

---

## Task Management Endpoints (Authentication Required)

### 1. Create Dictionary Translation Task

**Endpoint**: `POST /api/app_qy_v1/dictionary/tasks/create-explanation`

**Authentication**: Requires `custom.authenticate` middleware

**Request Body**:
```json
{
  "language": "string (optional, default english) - Language: english|spanish|french|german|chinese",
  "limit": "number (optional, default 50, range 1-500) - Maximum words per task",
  "is_demo_mode": "boolean (optional, default false) - Demo mode, does not write to database"
}
```

**Response - With Untranslated Words**:
```json
{
  "success": true,
  "message": "Dictionary explanation task created",
  "data": {
    "task_id": "task_xxx-xxx-xxx",
    "word_count": 50,
    "timeout_seconds": 210,
    "is_demo_mode": false,
    "status": "pending"
  }
}
```

**Response - No Untranslated Words**:
```json
{
  "success": true,
  "message": "No words need explanations",
  "data": {
    "status": "no_words_needed",
    "message": "No words need explanations",
    "word_count": 0
  }
}
```

---

### 2. Get Untranslated Words Count

**Endpoint**: `GET /api/app_qy_v1/dictionary/tasks/untranslated-words`

**Authentication**: Requires `custom.authenticate` middleware

**Query Parameters**:
- `limit` (optional, default 100, range 1-1000) - Number of words to return

**Response**:
```json
{
  "success": true,
  "message": "Untranslated words retrieved",
  "data": {
    "count": 150,
    "limit": 100,
    "words": [
      {
        "word": "hello",
        "md5": "5d41402abc4b2a76b9719d911017c592",
        "query_count": 0
      }
    ]
  }
}
```

---

### 3. Query Task Status

**Endpoint**: `GET /api/task/{taskId}/status`

**Response**:
```json
{
  "success": true,
  "message": "Task status retrieved successfully",
  "data": {
    "task": {
      "task_id": "task_xxx-xxx-xxx",
      "app_name": "AppQyV1",
      "task_type": "dictionary_explanation",
      "execution_type": "remote_client",
      "status": "completed",
      "progress": 100,
      "assigned_to": "mcp-chrome-xxx",
      "result": {
        "explanations": [...]
      },
      "error": null,
      "created_at": "2025-12-16T10:30:00.000000Z",
      "updated_at": "2025-12-16T10:35:00.000000Z"
    }
  }
}
```

---

### 4. Task List

**Endpoint**: `GET /api/task/list`

**Query Parameters**:
- `status` (optional) - Filter by status
- `app_name` (optional) - Filter by app name
- `execution_type` (optional) - Filter by execution type
- `limit` (optional, default 20) - Items per page
- `offset` (optional, default 0) - Offset

**Response**:
```json
{
  "success": true,
  "message": "Tasks list retrieved successfully",
  "data": {
    "total": 100,
    "count": 20,
    "tasks": [...]
  }
}
```

---

## Data Format Specifications

### Task Payload Format (Dictionary Translation)

```json
{
  "words": [
    {
      "word": "hello",
      "md5": "5d41402abc4b2a76b9719d911017c592",
      "query_count": 0
    }
  ],
  "language": "english",
  "is_demo_mode": false,
  "word_count": 1
}
```

### Task Result Format (Dictionary Translation)

Worker submits result field:

```json
{
  "explanations": [
    {
      "word": "hello (required) - Word",
      "md5": "5d41402abc4b2a76b9719d911017c592 (required) - Word MD5, must match task",
      "explanation": "int. Used as greeting\nn. A greeting (required) - Combined translation text",
      "phonetic": "/həˈləʊ/ (optional) - General phonetic",
      "us_phonetic": "/həˈloʊ/ (optional) - US phonetic",
      "uk_phonetic": "/həˈləʊ/ (optional) - UK phonetic",
      "provider": "bing (optional) - Translation provider"
    }
  ]
}
```

**Field Description**:
- `word`: Required, original word
- `md5`: Required, MD5 hash of word for database matching
- `explanation`: Required, translation/explanation text, can contain newlines separating multiple parts of speech
- `phonetic/us_phonetic/uk_phonetic`: Optional, phonetic information
- `provider`: Optional, identifies translation source

---

## Backend Processing Flow

### Task Creation Flow

1. Call `AppQyV1DictionaryService::getUntranslatedWords()` to get untranslated word list
2. If no untranslated words, return `no_words_needed` status
3. Construct task payload containing word list and language info
4. Call `TaskManagerService::createTask()` to create task
5. Task type: `dictionary_explanation` or `dictionary_explanation_demo`
6. Execution type: `GlobalTask::EXECUTION_REMOTE_CLIENT`
7. Priority: 50, max retries: 3

### Result Processing Flow

1. Worker submits `completed` status result
2. `TaskManagerService::submitResult()` updates task status
3. Calls `TaskManagerService::processTaskResult()` to process result
4. Detects task type is `dictionary_explanation`, calls `AppQyV1TranslationTaskService::processExplanationResult()`
5. Iterates each translation result, calls `AppQyV1MultiLangDictionaryModel::updateWord()` to update database
6. Updates fields: `translations`, `has_translation`, `phonetic`, `us_phonetic`, `uk_phonetic`, `translation_provider`

### Demo Mode

When `is_demo_mode: true`:
- Task type is `dictionary_explanation_demo`
- Task status marked as `completed_demo`
- **Does not update database**, only logs
- Used for testing workflow

---

## Task Scheduling Mechanism

### Timeout Handling
- Task timeout calculation: `60 + (word_count * 3)` seconds, max 600 seconds
- Task automatically released and re-queued after timeout
- `TaskManagerService::releaseTimedOutTasks()` periodic cleanup

### Retry Mechanism
- Task automatically retries after failure (if `retry_count < max_retries`)
- Max retries: 3
- Task returns to `pending` status on retry

### Worker Offline Handling
- Worker marked `offline` if no heartbeat received for 180 seconds
- Tasks assigned to offline Workers are released
- `TaskManagerService::cleanOfflineWorkers()` periodic cleanup

---

## Error Handling

### Common Error Codes

- `422` - Validation failed, parameter error
- `409` - Conflict, task already accepted by another Worker
- `404` - Resource not found (Worker or task does not exist)

### Recommended Error Handling

1. **Task pull failed**: Wait and retry
2. **Task accept failed**: Abandon task, continue pulling new tasks
3. **Result submit failed**: Retry submission, abandon after multiple failures
4. **Translation failed**: Skip word, continue processing others, submit partial results

---

## Summary

The backend Worker task system is fully implemented with the following capabilities:

### Core Features
1. **Worker Registration & Management** - Supports third-party client integration
2. **Task Queue System** - Automatic scheduling and task assignment
3. **Long Polling Mechanism** - Efficient task pulling
4. **Task Timeout & Retry** - Automatic fault tolerance
5. **Worker Heartbeat Monitoring** - Automatic offline Worker detection

### API Endpoints
- **7 Worker Endpoints** (no authentication) - For third-party client use
- **4 Task Management Endpoints** (authentication required) - For system management

### Data Processing
- Automatically fetches untranslated words from database
- Receives translation results and updates database
- Supports Demo mode (does not write to database)

**Backend requires no modifications and is ready to use!**
