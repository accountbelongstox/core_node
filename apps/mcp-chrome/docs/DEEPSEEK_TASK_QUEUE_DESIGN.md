# DeepSeek Task Queue System Design

## Overview

This document describes the design and implementation of a task queue system for MCP Chrome that automates interactions with DeepSeek Chat, including sending prompts, monitoring completion, and retrieving results.

## Architecture

### Components

1. **DeepSeek Tools** - MCP tools for interacting with DeepSeek
2. **Task Queue Manager** - In-memory task queue with persistence
3. **Polling Service** - Background service that monitors task completion
4. **Storage Manager** - Persistent storage for tasks and results

### System Flow

```
┌─────────────────┐
│  MCP Client     │
│  (Claude/etc)   │
└────────┬────────┘
         │
         │ call tool
         ▼
┌─────────────────────────────────────────────┐
│  MCP Chrome Extension                       │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  DeepSeek Tools                      │  │
│  │  - deepseek_send_prompt              │  │
│  │  - deepseek_get_task_status          │  │
│  │  - deepseek_get_result               │  │
│  │  - deepseek_list_tasks               │  │
│  │  - deepseek_cancel_task              │  │
│  └──────────────┬───────────────────────┘  │
│                 │                           │
│  ┌──────────────▼───────────────────────┐  │
│  │  Task Queue Manager                  │  │
│  │  - Create tasks                      │  │
│  │  - Track status                      │  │
│  │  - Store results                     │  │
│  └──────────────┬───────────────────────┘  │
│                 │                           │
│  ┌──────────────▼───────────────────────┐  │
│  │  Polling Service                     │  │
│  │  - Background polling                │  │
│  │  - Detect completion                 │  │
│  │  - Extract results                   │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
         │
         │ browser automation
         ▼
┌─────────────────┐
│  DeepSeek Chat  │
│  Web Interface  │
└─────────────────┘
```

## Data Models

### Task

```typescript
interface DeepSeekTask {
  id: string;                    // Unique task ID (UUID)
  prompt: string;                // The prompt sent to DeepSeek
  status: TaskStatus;            // Current task status
  createdAt: number;             // Timestamp (ms)
  updatedAt: number;             // Timestamp (ms)
  tabId?: number;                // Chrome tab ID where task is running
  conversationId?: string;       // DeepSeek conversation ID
  result?: TaskResult;           // Result data when completed
  error?: string;                // Error message if failed
  metadata?: {
    attachments?: string[];      // File paths/URLs of attachments
    options?: DeepSeekOptions;   // Additional options
  };
}

enum TaskStatus {
  QUEUED = 'queued',             // Task created, waiting to send
  SENDING = 'sending',           // Sending prompt to DeepSeek
  PENDING = 'pending',           // Sent, waiting for response
  GENERATING = 'generating',     // DeepSeek is generating response
  COMPLETED = 'completed',       // Response received
  FAILED = 'failed',             // Error occurred
  CANCELLED = 'cancelled'        // Task cancelled by user
}

interface TaskResult {
  content: string;               // The AI response text
  conversationUrl: string;       // URL to the conversation
  extractedAt: number;           // Timestamp when result was extracted
  tokens?: {
    input?: number;
    output?: number;
  };
}

interface DeepSeekOptions {
  model?: string;                // Model selection (if available)
  attachFiles?: boolean;         // Whether to attach files
  waitForCompletion?: boolean;   // Auto-wait or return task ID
}
```

### Task Queue Store

```typescript
interface TaskQueueStore {
  tasks: Map<string, DeepSeekTask>;     // All tasks by ID
  activePolling: Set<string>;           // Tasks currently being polled
  pollingInterval: number;              // Polling interval (ms)
  maxRetries: number;                   // Max polling retries
}
```

## Tool Specifications

### 1. `deepseek_send_prompt`

Send a prompt to DeepSeek and create a task to monitor it.

**Input:**
```typescript
{
  prompt: string;                       // Required: The prompt to send
  attachments?: string[];               // Optional: File paths to upload
  waitForCompletion?: boolean;          // Optional: Wait for result (default: false)
  timeout?: number;                     // Optional: Timeout in ms (default: 300000)
  autoRetry?: boolean;                  // Optional: Auto-retry on failure (default: true)
}
```

**Output:**
```typescript
{
  taskId: string;                       // Task ID for tracking
  status: TaskStatus;                   // Current status
  conversationUrl?: string;             // URL if task started
  result?: TaskResult;                  // Result if waitForCompletion=true
}
```

**Behavior:**
- Opens DeepSeek chat in a new tab (or reuses existing)
- Sends the prompt
- Creates a task in the queue
- If `waitForCompletion=true`, polls until completed and returns result
- If `waitForCompletion=false`, returns task ID immediately

### 2. `deepseek_get_task_status`

Get the current status of a task.

**Input:**
```typescript
{
  taskId: string;                       // Required: Task ID
}
```

**Output:**
```typescript
{
  task: DeepSeekTask;                   // Full task object
}
```

### 3. `deepseek_get_result`

Get the result of a completed task.

**Input:**
```typescript
{
  taskId: string;                       // Required: Task ID
  waitForCompletion?: boolean;          // Optional: Wait if not completed
  timeout?: number;                     // Optional: Wait timeout (default: 60000)
}
```

**Output:**
```typescript
{
  taskId: string;
  status: TaskStatus;
  result?: TaskResult;                  // Result if completed
  error?: string;                       // Error if failed
}
```

### 4. `deepseek_list_tasks`

List all tasks with optional filtering.

**Input:**
```typescript
{
  status?: TaskStatus | TaskStatus[];   // Optional: Filter by status
  limit?: number;                       // Optional: Max results (default: 50)
  offset?: number;                      // Optional: Offset for pagination
}
```

**Output:**
```typescript
{
  tasks: DeepSeekTask[];                // Array of tasks
  total: number;                        // Total count
  hasMore: boolean;                     // Whether more results available
}
```

### 5. `deepseek_cancel_task`

Cancel a pending or running task.

**Input:**
```typescript
{
  taskId: string;                       // Required: Task ID
}
```

**Output:**
```typescript
{
  taskId: string;
  status: TaskStatus;                   // Should be 'cancelled'
  cancelled: boolean;                   // Whether cancellation succeeded
}
```

## Implementation Details

### Task Queue Manager

**Location:** `app/chrome-extension/utils/task-queue-manager.ts`

**Responsibilities:**
- Maintain in-memory task queue
- Persist tasks to chrome.storage
- Provide CRUD operations for tasks
- Emit events for task status changes

**Key Methods:**
```typescript
class TaskQueueManager {
  createTask(prompt: string, options?: DeepSeekOptions): Promise<DeepSeekTask>
  getTask(taskId: string): Promise<DeepSeekTask | null>
  updateTask(taskId: string, updates: Partial<DeepSeekTask>): Promise<void>
  listTasks(filter?: TaskFilter): Promise<DeepSeekTask[]>
  cancelTask(taskId: string): Promise<void>
}
```

### Polling Service

**Location:** `app/chrome-extension/entrypoints/background/deepseek-polling-service.ts`

**Responsibilities:**
- Poll DeepSeek UI for task completion
- Extract results when complete
- Update task status
- Handle errors and retries

**Key Methods:**
```typescript
class DeepSeekPollingService {
  startPolling(taskId: string): void
  stopPolling(taskId: string): void
  checkTaskStatus(taskId: string): Promise<TaskStatus>
  extractResult(taskId: string): Promise<TaskResult>
}
```

**Polling Strategy:**
- Initial delay: 1 second
- Exponential backoff: 1s, 2s, 4s, 8s, max 10s
- Max duration: 5 minutes (configurable)
- Checks for:
  - Completion indicator (stop button disappears)
  - New message in conversation
  - Error messages

### DeepSeek Detection

**Selectors for detecting response state:**
```typescript
const SELECTORS = {
  // Text input area
  INPUT: 'textarea[placeholder*="输入"], textarea[placeholder*="Ask"]',

  // Send button
  SEND_BUTTON: 'button[type="submit"]',

  // Stop generating button (indicates generating)
  STOP_BUTTON: 'button:has-text("停止"), button:has-text("Stop")',

  // Response container
  RESPONSE: '.ds-markdown, [class*="markdown"], [class*="message"]',

  // Last message (to extract)
  LAST_MESSAGE: '.ds-markdown:last-of-type, [class*="markdown"]:last-of-type',

  // Error indicators
  ERROR: '[class*="error"], [class*="failed"]',
};
```

### Storage

**Chrome Storage Structure:**
```typescript
{
  'deepseek_tasks': {
    [taskId: string]: DeepSeekTask
  },
  'deepseek_config': {
    pollingInterval: number,
    maxRetries: number,
    defaultTimeout: number
  }
}
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create `TaskQueueManager` class
2. Define data models and interfaces
3. Implement storage layer
4. Add unit tests

### Phase 2: DeepSeek Tools
1. Create `deepseek-tools.ts` file
2. Implement `deepseek_send_prompt` tool
3. Implement basic task creation
4. Test prompt sending

### Phase 3: Polling Service
1. Create `DeepSeekPollingService` class
2. Implement status detection logic
3. Implement result extraction
4. Add retry and error handling

### Phase 4: Remaining Tools
1. Implement `deepseek_get_task_status`
2. Implement `deepseek_get_result`
3. Implement `deepseek_list_tasks`
4. Implement `deepseek_cancel_task`

### Phase 5: Integration & Testing
1. Register tools in tool registry
2. Add tool schemas
3. End-to-end testing
4. Documentation

## Usage Examples

### Example 1: Send and Wait

```typescript
// Send prompt and wait for completion
const result = await mcp.callTool('deepseek_send_prompt', {
  prompt: 'Explain quantum computing in simple terms',
  waitForCompletion: true,
  timeout: 120000
});

console.log(result.result.content);
```

### Example 2: Send and Poll Later

```typescript
// Send prompt
const task = await mcp.callTool('deepseek_send_prompt', {
  prompt: 'Write a comprehensive essay on AI ethics',
  waitForCompletion: false
});

console.log('Task created:', task.taskId);

// Do other work...

// Check status later
const status = await mcp.callTool('deepseek_get_task_status', {
  taskId: task.taskId
});

if (status.task.status === 'completed') {
  const result = await mcp.callTool('deepseek_get_result', {
    taskId: task.taskId
  });
  console.log(result.result.content);
}
```

### Example 3: Batch Processing

```typescript
// Send multiple prompts
const prompts = [
  'Summarize the history of computing',
  'Explain machine learning',
  'Describe blockchain technology'
];

const tasks = await Promise.all(
  prompts.map(prompt =>
    mcp.callTool('deepseek_send_prompt', { prompt })
  )
);

// Wait for all to complete
while (true) {
  const statuses = await mcp.callTool('deepseek_list_tasks', {
    status: ['pending', 'generating']
  });

  if (statuses.tasks.length === 0) break;

  await new Promise(resolve => setTimeout(resolve, 5000));
}

// Get all results
for (const task of tasks) {
  const result = await mcp.callTool('deepseek_get_result', {
    taskId: task.taskId
  });
  console.log(`Result for "${prompts[tasks.indexOf(task)]}":`, result.result.content);
}
```

## Considerations

### Security
- Never store sensitive data in tasks
- Clear task queue on user request
- Sanitize prompts and results

### Performance
- Limit concurrent polling tasks (max 5)
- Use exponential backoff for polling
- Clean up old completed tasks (after 24h)

### Error Handling
- Network errors: Retry with backoff
- Tab closed: Mark task as failed
- Timeout: Mark task as failed, allow retry
- Rate limiting: Increase polling interval

### Future Enhancements
- Support for streaming responses
- Multi-conversation management
- Result caching and history
- Task priority queue
- Webhook notifications
- Export conversation history
