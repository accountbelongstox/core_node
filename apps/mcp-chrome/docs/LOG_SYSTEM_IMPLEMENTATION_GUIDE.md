# Log System Implementation Guide

## Overview

This guide outlines the implementation of a centralized logging system that:
1. **Replaces all `throw` statements** with error returns and logging
2. **Displays all logs in a UI panel** instead of console only
3. **Uses English for all code** (comments, logs, and messages)

---

## ✅ Completed

### 1. Logger System (`logger.ts`)
Created centralized logging system with:
- Log levels: DEBUG, INFO, WARN, ERROR
- Log storage (last 500 logs)
- Broadcasting to popup via `chrome.runtime.sendMessage()`
- Log filtering by level/source
- Statistics tracking

**File**: `/entrypoints/background/services/local-task-queue/logger.ts`

### 2. Log Viewer Panel (`LogViewerPanel.vue`)
Created UI panel with:
- Real-time log display
- Filtering by log level (DEBUG, INFO, WARN, ERROR)
- Auto-scroll feature
- Log statistics
- Clear logs button
- Color-coded log entries

**File**: `/entrypoints/popup/components/extensions/LogViewerPanel.vue`

### 3. Message Protocol Updates (`messages.ts`)
Added log-related message types:
```typescript
QUEUE_LOG_GET_ALL = 'QUEUE_LOG_GET_ALL',  // Get all logs
QUEUE_LOG_CLEAR = 'QUEUE_LOG_CLEAR',      // Clear all logs
QUEUE_LOG = 'QUEUE_LOG',                   // Log event broadcast
```

---

## 🔨 Remaining Work

### 1. Add Log Message Handlers

**File**: `/entrypoints/background/services/local-task-queue/message-handler.ts`

Add these cases to `handleMessage()`:

```typescript
case MessageType.QUEUE_LOG_GET_ALL:
  return await this.handleGetLogs();

case MessageType.QUEUE_LOG_CLEAR:
  return await this.handleClearLogs();
```

Add these methods to `QueueMessageHandler`:

```typescript
/**
 * Handle get all logs
 */
private async handleGetLogs(): Promise<MessageResponse> {
  const logs = queueLogger.getLogs();
  return {
    success: true,
    data: { logs },
  };
}

/**
 * Handle clear logs
 */
private async handleClearLogs(): Promise<MessageResponse> {
  queueLogger.clearLogs();
  return { success: true };
}
```

---

### 2. Add Log Panel to ExtensionsPanel

**File**: `/entrypoints/popup/components/ExtensionsPanel.vue`

Add import:
```typescript
import LogViewerPanel from './extensions/LogViewerPanel.vue';
```

Add to extensions array:
```typescript
{
  id: 'log-viewer',
  name: 'Task Queue Logs',
  description: 'View all task queue logs and events',
  component: LogViewerPanel,
  status: 'active',
},
```

---

### 3. Export Logger from index.ts

**File**: `/entrypoints/background/services/local-task-queue/index.ts`

Add export:
```typescript
export * from './logger';
```

---

### 4. Replace `throw` Statements

**Pattern**: Instead of throwing errors, log them and return error status.

#### Before:
```typescript
if (!words || words.length === 0) {
  throw TaskError.nonRetriable('No words to translate');
}
```

#### After:
```typescript
if (!words || words.length === 0) {
  queueLogger.error('BingDictionaryHandler', 'No words to translate', {
    taskId: task.id,
    words,
  });
  return; // Task will fail with error in result
}
```

#### Files to Update:

**A. BingDictionaryHandler.ts**
```typescript
// Add import
import { queueLogger } from '../logger';

// Replace throws with logging
async execute(task: Task<BingDictionaryTaskDetails>, onProgress?: (progress: number) => void): Promise<void> {
  const { words, language = 'english', batchSize = 1, provider = 'bing' } = task.details;

  if (!words || words.length === 0) {
    queueLogger.error('BingDictionaryHandler', 'No words provided for translation', { taskId: task.id });
    task.error = 'No words to translate';
    return;
  }

  queueLogger.info('BingDictionaryHandler', `Processing ${words.length} words`, { taskId: task.id, language });

  // ... rest of code
}
```

**B. DeepSeekHandler.ts**
```typescript
// Add import
import { queueLogger } from '../logger';

// Replace throws
async execute(task: Task<DeepSeekTaskDetails>, onProgress?: (progress: number) => void): Promise<void> {
  const { prompt } = task.details;

  if (!prompt || prompt.trim() === '') {
    queueLogger.error('DeepSeekHandler', 'Empty prompt provided', { taskId: task.id });
    task.error = 'Prompt is required';
    return;
  }

  queueLogger.info('DeepSeekHandler', 'Sending prompt to DeepSeek', {
    taskId: task.id,
    promptLength: prompt.length
  });

  // ... rest of code
}
```

**C. LocalTaskQueue.ts**
Add logging throughout:

```typescript
import { queueLogger } from './logger';

// In addTask()
async addTask<T = any>(task: Task<T>): Promise<boolean> {
  if (this.tasks.size >= this.config.maxQueueSize) {
    queueLogger.warn('LocalTaskQueue', 'Queue is full', {
      current: this.tasks.size,
      max: this.config.maxQueueSize,
    });
    return false;
  }

  // ... existing code

  queueLogger.info('LocalTaskQueue', 'Task added to queue', {
    taskId: task.id,
    taskType: task.type,
    queueSize: this.taskOrder.length,
  });

  // ... rest
}

// In processNext()
private async processNext(): Promise<void> {
  // ... get task

  queueLogger.info('LocalTaskQueue', 'Processing task', {
    taskId: task.id,
    taskType: task.type,
  });

  // On success
  queueLogger.info('LocalTaskQueue', 'Task completed successfully', {
    taskId: task.id,
    duration: Date.now() - task.startedAt!,
  });

  // On error
  queueLogger.error('LocalTaskQueue', 'Task failed', {
    taskId: task.id,
    error: error.message,
    retriable: isRetriable,
  });
}
```

**D. LocalTaskQueueService.ts**
Add logging:

```typescript
import { queueLogger } from './logger';

// In initialize()
async initialize(): Promise<void> {
  queueLogger.info('LocalTaskQueueService', 'Initializing task queue service');

  // ... code

  queueLogger.info('LocalTaskQueueService', 'Task queue service initialized successfully');
}

// In persistTasks()
private async persistTasks(): Promise<void> {
  queueLogger.debug('LocalTaskQueueService', 'Persisting tasks to storage', {
    taskCount: incompleteTasks.length,
    sizeKB: (dataSize / 1024).toFixed(2),
  });

  // On truncation
  queueLogger.warn('LocalTaskQueueService', 'Task data truncated due to size limit', {
    original: incompleteTasks.length,
    truncated: truncated.length,
  });
}

// In restoreTasks()
private async restoreTasks(): Promise<void> {
  queueLogger.info('LocalTaskQueueService', 'Restoring tasks from storage', {
    taskCount: tasks.length,
  });
}
```

---

### 5. Convert Chinese Comments to English

**Pattern**: Replace all Chinese comments with English equivalents.

#### Example Files:

**messages.ts**
```typescript
// Before:
/**
 * 基础消息接口
 */
export interface BaseMessage {
  type: MessageType;
}

// After:
/**
 * Base message interface
 */
export interface BaseMessage {
  type: MessageType;
}
```

**message-handler.ts**
```typescript
// Before:
/**
 * 消息处理器
 * 在 Background Service Worker 中处理来自 Popup 的命令
 */
export class QueueMessageHandler {
  // ...
}

// After:
/**
 * Message handler
 * Handles commands from Popup in Background Service Worker
 */
export class QueueMessageHandler {
  // ...
}
```

Apply this pattern to ALL files in:
- `/entrypoints/background/services/local-task-queue/`
- `/entrypoints/popup/composables/`
- `/entrypoints/popup/components/extensions/`

---

## 📋 Implementation Checklist

- [ ] **Step 1**: Add log message handlers to `message-handler.ts`
- [ ] **Step 2**: Export logger from `index.ts`
- [ ] **Step 3**: Add LogViewerPanel to ExtensionsPanel
- [ ] **Step 4**: Replace `throw` in BingDictionaryHandler
- [ ] **Step 5**: Replace `throw` in DeepSeekHandler
- [ ] **Step 6**: Add logging to LocalTaskQueue
- [ ] **Step 7**: Add logging to LocalTaskQueueService
- [ ] **Step 8**: Convert Chinese comments in types.ts
- [ ] **Step 9**: Convert Chinese comments in messages.ts
- [ ] **Step 10**: Convert Chinese comments in message-handler.ts
- [ ] **Step 11**: Convert Chinese comments in LocalTaskQueueService.ts
- [ ] **Step 12**: Convert Chinese comments in useLocalTaskQueue.ts
- [ ] **Step 13**: Test log panel displays logs correctly
- [ ] **Step 14**: Test error handling without throws
- [ ] **Step 15**: Verify all Chinese text replaced

---

## 🎯 Benefits

After implementation:
1. ✅ **No exceptions thrown** - errors are logged and handled gracefully
2. ✅ **Centralized logging** - all logs in one place
3. ✅ **UI visibility** - logs visible in popup panel
4. ✅ **Debugging ease** - filter by level/source
5. ✅ **English codebase** - consistent language throughout
6. ✅ **Better UX** - users can see what's happening

---

## 📊 Usage Example

After implementation, logs will appear like this in the panel:

```
[ERROR] BingDictionaryHandler | 14:23:45
No words provided for translation
{ taskId: "bing-1234...", words: [] }

[INFO] LocalTaskQueue | 14:23:46
Task added to queue
{ taskId: "bing-5678...", taskType: "bing_dictionary", queueSize: 3 }

[WARN] LocalTaskQueueService | 14:23:50
Task data truncated due to size limit
{ original: 500, truncated: 400 }
```

---

## 🚀 Testing

After implementation:
1. Open extension popup
2. Navigate to "Task Queue Logs" panel
3. Add a test task
4. Verify logs appear in real-time
5. Test filtering by level
6. Test clear logs button
7. Verify no console errors from thrown exceptions

---

## 📝 Notes

- Logger automatically broadcasts logs to popup
- Logs are kept in memory (last 500 entries)
- WARN and ERROR levels also output to console
- Log panel auto-scrolls by default (can be paused)
- Filters can be toggled (click level badge)
