# Laravel Remote Task System

## Overview

Set up a global task system for the entire Laravel, equivalent to Laravel being able to add tasks inside, then wait for third-party systems to process and return. Currently, the task processing is also this system's Python `./pycore caller pycore_module_caller.py`. Reference specification: `development-guides\PYTHON_PYCORE.md`.

## Architecture Analysis Summary

### Existing Infrastructure

**Laravel Side**:
- ✅ GlobalTask table exists (task_id, app_name, task_type, status, progress, payload, result, error)
- ✅ OctaneTimerService - Swoole timer (ticks every second)
- ✅ McpV1 TaskQueueService - JSON file queue (for MCP, not suitable for global tasks)

**Python Side**:
- ✅ FastAPI service (port 59000)
- ✅ Database system (SQLAlchemy + SQLite)
- ✅ Module Call Router (has HTTP API foundation)
- ⚠️ Heartbeat system (mentioned in documentation, but implementation not found in code)

## Global Task System Design

### Architecture Pattern: Hybrid Bidirectional Communication

```
┌─────────────────────────────────────────────────────────┐
│                    Laravel Backend                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │         GlobalTask Table (SQLite)                │  │
│  │  - task_id, app_name, task_type, status          │  │
│  │  - payload (JSON), result (JSON), error          │  │
│  └──────────────────────────────────────────────────┘  │
│                          ▲                              │
│                          │ Read/Write                   │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │      GlobalTaskService (Task Management)          │  │
│  │  - createTask()        - updateTaskStatus()      │  │
│  │  - submitTaskToPython()  - handleCallback()      │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│                          │ HTTP API                     │
└──────────────────────────┼──────────────────────────────┘
                           │
                           │ Port 59000
                           │
┌──────────────────────────┼──────────────────────────────┐
│                Python Pycore                            │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │    Global Task Router (FastAPI)                  │  │
│  │  POST /api/tasks/submit                          │  │
│  │  GET  /api/tasks/{task_id}/status                │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │    Global Task Processor Registry                │  │
│  │  - registerProcessor(task_type, handler)         │  │
│  │  - processTask(task_id, task_type, payload)      │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │    Task Processors (Extensible)                  │  │
│  │  - OCRProcessor                                   │  │
│  │  - TranslationProcessor                          │  │
│  │  - VideoProcessor                                 │  │
│  │  - CustomProcessor (User-defined)                 │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│                          │ Callback (HTTP)              │
└──────────────────────────┼──────────────────────────────┘
                           │
                           │ POST /api/global-task/callback
                           │
┌──────────────────────────┼──────────────────────────────┐
│                    Laravel Backend                      │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │    TaskCallbackController                       │  │
│  │  - receiveResult(task_id, result, status)        │  │
│  │  - updateGlobalTask()                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Workflow

1. Laravel creates task → GlobalTask table (status: pending)
2. Laravel submits task → Python HTTP API (POST /api/tasks/submit)
3. Python receives task → Starts background thread processing
4. Python processing → Callback Laravel (POST /api/global-task/callback, status: processing)
5. Python processing complete → Callback Laravel (status: completed, result: {...})
6. Laravel updates task → GlobalTask table updates result
7. Frontend polls result → Laravel API returns final result

## Task Types

GlobalTask now extends tasks to two types:
1. Tasks processed by Laravel calling timer (type: local_timer)
2. Tasks processed by remote clients (e.g., requiring computation) (type: remote_compute)

**Note**: Task system is global, available to all APPs. Each task can be requested by clients, and has a processing time. Intelligent allocation system: when a task is requested, wait for client callback within timeout period. If timeout, can continue to assign (of course, when callback task, need to check if it may have been processed again).

## Communication

Requires WebSocket communication. Call MCP to view official WebSocket solution, then scan this project, check specifications, then continue to provide second version design.

## Architecture Clarification

Laravel creates tasks (also provides task creation API), then processed by pycore. Task creation may be from web end, so Laravel is server. Now pycore uses part of its functionality to act as client role, not server. Because pycore may run on regular computers. Now continue to design and modify third version.

## Testing

Test task functionality via API:
1. Create a task via API
2. Request task
3. Process task
4. Query status during processing
5. Callback
6. Query status after callback

Write Python script using multiple files to simultaneously process one task, test if backend's intelligent scheduling is effective when multiple clients simultaneously request processing.

