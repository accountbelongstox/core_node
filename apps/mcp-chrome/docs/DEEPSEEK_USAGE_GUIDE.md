# DeepSeek Task Queue - Usage Guide

This guide explains how to use the DeepSeek task queue tools that have been added to MCP Chrome.

## Overview

The DeepSeek task queue system allows you to:
- **Send prompts** to DeepSeek Chat automatically
- **Create and manage tasks** with an internal queue
- **Monitor task status** and detect when responses are complete
- **Retrieve results** asynchronously

## Available Tools

### 1. `deepseek_send_prompt`

Send a prompt to DeepSeek and optionally wait for the response.

**Parameters:**
- `prompt` (string, required): The prompt to send
- `attachments` (string[], optional): File paths to upload
- `waitForCompletion` (boolean, optional): Wait for result (default: false)
- `timeout` (number, optional): Timeout in ms (default: 300000)
- `autoRetry` (boolean, optional): Auto-retry on failure (default: true)

**Returns:**
```json
{
  "taskId": "task_1234567890_abc123",
  "status": "pending",
  "conversationUrl": "https://chat.deepseek.com/...",
  "result": {  // Only if waitForCompletion=true
    "content": "The AI response text...",
    "conversationUrl": "https://chat.deepseek.com/...",
    "extractedAt": 1234567890123
  }
}
```

**Example 1: Send and return immediately**
```javascript
// Send prompt and get task ID
const response = await mcp.callTool('deepseek_send_prompt', {
  prompt: 'Explain quantum computing in simple terms'
});

console.log('Task ID:', response.taskId);
console.log('Status:', response.status); // "pending"
```

**Example 2: Send and wait for completion**
```javascript
// Send prompt and wait for result
const response = await mcp.callTool('deepseek_send_prompt', {
  prompt: 'Write a short poem about AI',
  waitForCompletion: true,
  timeout: 120000  // 2 minutes
});

console.log('Result:', response.result.content);
```

### 2. `deepseek_get_task_status`

Get the current status of a task.

**Parameters:**
- `taskId` (string, required): The task ID to check

**Returns:**
```json
{
  "task": {
    "id": "task_1234567890_abc123",
    "prompt": "Original prompt...",
    "status": "generating",
    "createdAt": 1234567890123,
    "updatedAt": 1234567890456,
    "tabId": 123,
    "conversationId": "https://chat.deepseek.com/...",
    "result": null,  // or TaskResult if completed
    "error": null,   // or error message if failed
    "metadata": {...}
  }
}
```

**Task Status Values:**
- `queued`: Task created, waiting to send
- `sending`: Sending prompt to DeepSeek
- `pending`: Sent, waiting for response
- `generating`: DeepSeek is generating response
- `completed`: Response received
- `failed`: Error occurred
- `cancelled`: Task cancelled by user

**Example:**
```javascript
const response = await mcp.callTool('deepseek_get_task_status', {
  taskId: 'task_1234567890_abc123'
});

console.log('Current status:', response.task.status);
console.log('Updated at:', new Date(response.task.updatedAt));
```

### 3. `deepseek_get_result`

Get the result of a completed task, optionally waiting if not yet complete.

**Parameters:**
- `taskId` (string, required): The task ID
- `waitForCompletion` (boolean, optional): Wait if not completed (default: false)
- `timeout` (number, optional): Wait timeout in ms (default: 60000)

**Returns:**
```json
{
  "taskId": "task_1234567890_abc123",
  "status": "completed",
  "result": {
    "content": "The AI response text...",
    "conversationUrl": "https://chat.deepseek.com/...",
    "extractedAt": 1234567890123
  },
  "error": null
}
```

**Example 1: Get result if available**
```javascript
const response = await mcp.callTool('deepseek_get_result', {
  taskId: 'task_1234567890_abc123'
});

if (response.status === 'completed') {
  console.log('Result:', response.result.content);
} else {
  console.log('Not ready yet, status:', response.status);
}
```

**Example 2: Wait for result**
```javascript
const response = await mcp.callTool('deepseek_get_result', {
  taskId: 'task_1234567890_abc123',
  waitForCompletion: true,
  timeout: 120000
});

console.log('Result:', response.result.content);
```

### 4. `deepseek_list_tasks`

List all tasks with optional filtering.

**Parameters:**
- `status` (string or string[], optional): Filter by status
- `limit` (number, optional): Maximum results (default: 50)
- `offset` (number, optional): Offset for pagination (default: 0)

**Returns:**
```json
{
  "tasks": [
    {
      "id": "task_1234567890_abc123",
      "prompt": "...",
      "status": "completed",
      ...
    },
    ...
  ],
  "total": 42,
  "hasMore": false
}
```

**Example 1: List all tasks**
```javascript
const response = await mcp.callTool('deepseek_list_tasks', {});

console.log(`Found ${response.total} tasks`);
response.tasks.forEach(task => {
  console.log(`- ${task.id}: ${task.status}`);
});
```

**Example 2: List only pending/generating tasks**
```javascript
const response = await mcp.callTool('deepseek_list_tasks', {
  status: ['pending', 'generating']
});

console.log(`${response.total} tasks in progress`);
```

**Example 3: Pagination**
```javascript
const response = await mcp.callTool('deepseek_list_tasks', {
  limit: 10,
  offset: 20  // Get tasks 21-30
});
```

### 5. `deepseek_cancel_task`

Cancel a pending or running task.

**Parameters:**
- `taskId` (string, required): The task ID to cancel

**Returns:**
```json
{
  "taskId": "task_1234567890_abc123",
  "status": "cancelled",
  "cancelled": true
}
```

**Example:**
```javascript
const response = await mcp.callTool('deepseek_cancel_task', {
  taskId: 'task_1234567890_abc123'
});

console.log('Cancelled:', response.cancelled);
```

## Usage Patterns

### Pattern 1: Fire and Forget

Send a prompt and continue with other work:

```javascript
// Send prompt
const task = await mcp.callTool('deepseek_send_prompt', {
  prompt: 'Generate a detailed report on AI trends in 2024'
});

console.log('Task started:', task.taskId);

// Do other work...

// Check later
const status = await mcp.callTool('deepseek_get_task_status', {
  taskId: task.taskId
});

if (status.task.status === 'completed') {
  const result = await mcp.callTool('deepseek_get_result', {
    taskId: task.taskId
  });
  console.log('Result:', result.result.content);
}
```

### Pattern 2: Synchronous Wait

Send a prompt and wait for the result:

```javascript
const response = await mcp.callTool('deepseek_send_prompt', {
  prompt: 'What is the capital of France?',
  waitForCompletion: true
});

console.log('Answer:', response.result.content);
```

### Pattern 3: Batch Processing

Send multiple prompts and wait for all:

```javascript
// Send multiple prompts
const prompts = [
  'Explain machine learning',
  'Explain deep learning',
  'Explain neural networks'
];

const tasks = await Promise.all(
  prompts.map(prompt =>
    mcp.callTool('deepseek_send_prompt', { prompt })
  )
);

console.log(`Started ${tasks.length} tasks`);

// Poll until all complete
while (true) {
  const response = await mcp.callTool('deepseek_list_tasks', {
    status: ['pending', 'generating']
  });

  if (response.total === 0) {
    console.log('All tasks completed!');
    break;
  }

  console.log(`Waiting for ${response.total} tasks...`);
  await new Promise(resolve => setTimeout(resolve, 5000));
}

// Get all results
for (const task of tasks) {
  const result = await mcp.callTool('deepseek_get_result', {
    taskId: task.taskId
  });
  console.log('Result:', result.result.content);
}
```

### Pattern 4: Manual Polling

Manually poll for completion with custom logic:

```javascript
const task = await mcp.callTool('deepseek_send_prompt', {
  prompt: 'Write a comprehensive essay on climate change'
});

// Poll every 3 seconds
const pollInterval = setInterval(async () => {
  const status = await mcp.callTool('deepseek_get_task_status', {
    taskId: task.taskId
  });

  console.log('Status:', status.task.status);

  if (status.task.status === 'completed') {
    clearInterval(pollInterval);

    const result = await mcp.callTool('deepseek_get_result', {
      taskId: task.taskId
    });
    console.log('Result:', result.result.content);
  } else if (status.task.status === 'failed') {
    clearInterval(pollInterval);
    console.error('Task failed:', status.task.error);
  }
}, 3000);
```

### Pattern 5: Cancellation

Cancel a long-running task:

```javascript
const task = await mcp.callTool('deepseek_send_prompt', {
  prompt: 'Write a 10,000 word essay...'
});

// Wait a bit
await new Promise(resolve => setTimeout(resolve, 5000));

// Cancel it
const cancelled = await mcp.callTool('deepseek_cancel_task', {
  taskId: task.taskId
});

console.log('Cancelled:', cancelled.cancelled);
```

## Configuration

The task queue system uses the following default configuration:

- **Polling Interval**: 2 seconds (increases with exponential backoff)
- **Max Retries**: 150 (approximately 5 minutes)
- **Default Timeout**: 300000ms (5 minutes)
- **Max Concurrent Polling**: 5 tasks
- **Cleanup After**: 24 hours (old completed tasks are removed)

## Troubleshooting

### Task stays in "pending" status

- Check if the DeepSeek tab is still open
- Check browser console for errors
- The polling service should automatically detect completion

### Task fails immediately

- Check if DeepSeek website is accessible
- Check browser console for errors
- Verify that the prompt is valid

### Result is empty or incorrect

- The polling service extracts content using CSS selectors
- If DeepSeek UI changes, selectors may need updating
- Check the conversation URL to verify manually

## Advanced Features

### Event Listeners

You can listen to task events programmatically:

```javascript
// In the extension code
import { getTaskQueueManager } from '@/utils/deepseek-task-queue';

const taskManager = getTaskQueueManager();
await taskManager.initialize();

taskManager.addEventListener((task, eventType) => {
  console.log(`Task ${task.id}: ${eventType}`);

  if (eventType === 'completed') {
    console.log('Result:', task.result?.content);
  }
});
```

### Statistics

Get statistics about the task queue:

```javascript
// In the extension code
const stats = await taskManager.getStatistics();

console.log('Total tasks:', stats.total);
console.log('By status:', stats.byStatus);
```

### Custom Configuration

Update configuration:

```javascript
// In the extension code
await taskManager.updateConfig({
  pollingInterval: 3000,  // 3 seconds
  maxRetries: 200,        // More retries
  defaultTimeout: 600000, // 10 minutes
});
```

## Implementation Details

### Architecture

```
Claude/MCP Client
    ↓
MCP Chrome Extension
    ↓
DeepSeek Tools → TaskQueueManager → Chrome Storage
    ↓                    ↓
DeepSeek Chat ← Polling Service
```

### Files

- `utils/deepseek-task-queue.ts` - Task queue manager
- `entrypoints/background/deepseek-polling-service.ts` - Polling service
- `entrypoints/background/tools/browser/deepseek.ts` - Tool implementations
- `packages/shared/src/tools.ts` - Tool schemas

### Storage

Tasks are persisted in Chrome local storage under `deepseek_tasks` key.

### Polling Strategy

- Initial delay: 1 second
- Exponential backoff: 1s → 1.5s → 2.25s → 3.375s → ... (max 10s)
- Detects completion by checking:
  - Stop button disappears
  - Last message is present
  - No error indicators

## Support

For issues or questions:
- Check browser console for errors
- Verify DeepSeek website is accessible
- Check the conversation URL in the task object
- Report issues to the repository

## Future Enhancements

Potential improvements:
- Streaming response support
- Multi-conversation management
- Result caching
- Priority queue
- Webhook notifications
- Export conversation history
