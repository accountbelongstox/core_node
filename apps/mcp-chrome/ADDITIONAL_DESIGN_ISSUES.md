# 其他设计问题与改进建议

## ✅ 已修复的严重问题

### 1. 队列运行在错误的上下文中 ✓
**修复方式**:
- 创建了 `LocalTaskQueueService.ts` 在 Background Service Worker 中运行
- 在 `background/index.ts` 中初始化队列服务

### 2. 缺少 Popup ↔ Background 通信机制 ✓
**修复方式**:
- 创建了 `messages.ts` 定义消息协议
- 创建了 `message-handler.ts` 处理 Background 消息
- 更新了 `useLocalTaskQueue.ts` 使用 `chrome.runtime.sendMessage()`

### 3. 缺少状态持久化 ✓
**修复方式**:
- `LocalTaskQueueService` 实现了 `persistTasks()` 和 `restoreTasks()`
- 使用 `chrome.storage.local` 持久化任务状态
- Service Worker 重启后自动恢复未完成任务

### 4. 事件系统跨上下文问题 ✓
**修复方式**:
- `LocalTaskQueueService` 通过 `chrome.runtime.sendMessage()` 广播事件
- Popup 通过 `chrome.runtime.onMessage` 监听事件
- 实现了实时双向通信

### 5. Service Worker 生命周期问题 ✓
**修复方式**:
- 实现了 `startKeepAlive()` 和 `stopKeepAlive()`
- 处理任务时保持 Service Worker 活跃
- 队列空闲时允许休眠

### 6. 任务去重算法不可靠 ✓
**修复方式**:
- 为每种任务类型实现了自定义 cache key 生成
- Bing: 按单词列表排序后生成 key
- DeepSeek: 按 prompt 生成 key
- 默认: 使用 `sortObjectKeys()` 排序后 stringify

---

## 🔍 发现的额外设计问题

### 7. **LocalTaskQueue 与 TaskCenter 功能重叠**
**问题位置**:
- `background/services/task-center/TaskCenter.ts`
- `background/services/local-task-queue/LocalTaskQueue.ts`

**问题描述**:
项目中存在两个任务管理系统:
1. **TaskCenter** - 管理 Processors（BingDictionaryProcessor, etc.）
2. **LocalTaskQueue** - 管理 Tasks with Handlers

这造成了:
- 概念混淆：Processor vs Handler
- 代码重复：两套任务管理逻辑
- 资源浪费：两个系统同时运行

**查看现有 TaskCenter**:
```typescript
// TaskCenter.ts
class TaskCenterService {
  private registry = new Map<string, ProcessorRegistryEntry>();

  registerProcessor(processor: ITaskProcessor, enabled = true): void {
    // 注册 processor
  }
}
```

**建议方案**:
1. **合并系统**: 废弃 TaskCenter，统一使用 LocalTaskQueue
2. **适配现有代码**: 创建 Processor → Handler 适配器
3. **迁移计划**: 逐步将现有 Processor 迁移到 Handler

---

### 8. **BingDictionaryHandler 可能造成标签页泄漏**
**问题位置**: `handlers/BingDictionaryHandler.ts:66-104`

**问题描述**:
```typescript
// BingDictionaryHandler 使用 bingDictionaryTool
// bingDictionaryTool.execute() 会创建或复用标签页
// 但是在以下情况下可能造成标签页泄漏:

// 1. 用户手动关闭了标签页，但任务仍在处理
// 2. 任务超时，但标签页仍然打开
// 3. 任务失败，没有清理标签页
```

**改进建议**:
```typescript
class BingDictionaryHandler {
  private openTabIds = new Set<number>();

  async execute(task: Task): Promise<void> {
    try {
      // 处理任务...
      const tabId = ...; // 从 tool 返回
      this.openTabIds.add(tabId);

      // ... 处理逻辑
    } finally {
      // 清理标签页（可选）
      // this.cleanupTab(tabId);
    }
  }

  async cancel(taskId: string): Promise<void> {
    // 取消时关闭标签页
    for (const tabId of this.openTabIds) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (error) {
        // 标签页可能已关闭
      }
    }
    this.openTabIds.clear();
  }
}
```

---

### 9. **进度更新未节流**
**问题位置**:
- `LocalTaskQueue.ts:247` - `onProgress?.(progress)`
- `BingDictionaryHandler.ts:104` - 每个单词都触发进度更新

**问题描述**:
- 批量处理时频繁触发进度事件
- 每次进度更新都会:
  1. 触发本地事件监听器
  2. 广播消息到 Popup (`chrome.runtime.sendMessage`)
  3. 持久化到 storage (在某些事件类型)
  4. Popup 接收后更新 UI

在处理 100 个单词时，会触发 100 次跨上下文消息传递！

**改进方案**:
```typescript
class LocalTaskQueue {
  private lastProgressBroadcast = new Map<string, number>();
  private progressThrottleMs = 200; // 最多每 200ms 广播一次

  private emitEvent(type: TaskEventType, task: Task): void {
    // 节流进度事件
    if (type === TaskEventTypeEnum.PROGRESS) {
      const now = Date.now();
      const lastBroadcast = this.lastProgressBroadcast.get(task.id) || 0;

      if (now - lastBroadcast < this.progressThrottleMs && task.progress !== 100) {
        // 跳过广播（但仍然更新本地状态）
        return;
      }

      this.lastProgressBroadcast.set(task.id, now);
    }

    // 本地事件
    const listeners = this.eventListeners.get(type);
    listeners?.forEach(listener => listener({ type, task, timestamp: Date.now() }));

    // 广播到 Popup
    chrome.runtime.sendMessage({
      type: 'QUEUE_EVENT',
      eventType: type,
      task,
      timestamp: Date.now(),
    }).catch(() => {});
  }
}
```

---

### 10. **错误类型未区分**
**问题位置**: `LocalTaskQueue.ts:265-277`

**问题描述**:
所有错误都使用相同的重试逻辑，但有些错误不应该重试:
- 参数验证错误（永远不会成功）
- 权限错误（需要用户干预）
- 网络错误（可以重试）

**改进方案**:
```typescript
// types.ts - 添加错误类型
export enum ErrorType {
  RETRIABLE = 'retriable',         // 网络错误、超时
  NON_RETRIABLE = 'non_retriable', // 参数错误、验证错误
  FATAL = 'fatal',                 // 系统级错误
}

export class TaskError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType = ErrorType.RETRIABLE
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

// Handler 中抛出特定类型的错误
class BingDictionaryHandler {
  validate(details: BingDictionaryTaskDetails): true | string {
    if (!details.words || details.words.length === 0) {
      throw new TaskError('No words to translate', ErrorType.NON_RETRIABLE);
    }
    return true;
  }

  async execute(task: Task): Promise<void> {
    try {
      // ... 执行逻辑
    } catch (error: any) {
      if (error.message.includes('Permission denied')) {
        throw new TaskError('Permission denied', ErrorType.NON_RETRIABLE);
      }
      if (error.message.includes('Network error')) {
        throw new TaskError('Network error', ErrorType.RETRIABLE);
      }
      throw error;
    }
  }
}

// LocalTaskQueue 中根据错误类型决定是否重试
catch (error: any) {
  const isRetriable = error instanceof TaskError
    ? error.type === ErrorType.RETRIABLE
    : true; // 未知错误默认可重试

  const retryCount = task.metadata?.retryCount ?? 0;
  const maxRetries = task.metadata?.maxRetries ?? this.config.maxRetries;

  if (isRetriable && retryCount < maxRetries) {
    // 重试
    task.metadata = { ...task.metadata, retryCount: retryCount + 1 };
    task.status = TaskStatusEnum.PENDING;
    // ...
  } else {
    // 失败
    await this.failTask(task, error.message);
  }
}
```

---

### 11. **缺少队列容量限制**
**问题位置**: `LocalTaskQueue.ts` - 没有检查队列大小

**问题描述**:
- 没有限制最大任务数
- 可能导致内存溢出
- 可能导致 storage 溢出（chrome.storage.local 有 10MB 限制）

**改进方案**:
```typescript
class LocalTaskQueue {
  private config: Required<TaskQueueConfig> & {
    maxQueueSize?: number;
  };

  constructor(config: TaskQueueConfig = {}) {
    this.config = {
      // ... 现有配置
      maxQueueSize: config.maxQueueSize ?? 1000, // 最多 1000 个任务
    };
  }

  async addTask<T = any>(task: Task<T>): Promise<boolean> {
    // 检查队列大小
    if (this.tasks.size >= this.config.maxQueueSize!) {
      console.error(
        `[LocalTaskQueue] Queue is full (${this.tasks.size}/${this.config.maxQueueSize})`
      );
      return false;
    }

    // ... 现有逻辑
  }
}
```

---

### 12. **持久化可能超过 storage 限制**
**问题位置**: `LocalTaskQueueService.ts:94-105`

**问题描述**:
- chrome.storage.local 有 10MB 限制
- 大量任务或大型任务（如带附件的 DeepSeek）可能超限
- 超限时 `chrome.storage.local.set()` 会失败，但代码没有处理

**改进方案**:
```typescript
class LocalTaskQueueService {
  private async persistTasks(): Promise<void> {
    if (!this.queue) return;

    try {
      const tasks = this.queue.getAllTasks();

      // 只持久化未完成的任务（节省空间）
      const incompleteTasks = tasks.filter(
        t => t.status === TaskStatus.PENDING || t.status === TaskStatus.PROCESSING
      );

      // 检查大小（粗略估计）
      const dataSize = JSON.stringify(incompleteTasks).length;
      const maxSize = 5 * 1024 * 1024; // 5MB 限制（留一半给其他数据）

      if (dataSize > maxSize) {
        console.warn(
          `[LocalTaskQueueService] Task data too large (${dataSize} bytes), truncating...`
        );

        // 只保留最新的任务
        incompleteTasks.sort((a, b) => b.createdAt - a.createdAt);
        const truncated = incompleteTasks.slice(0, 100); // 最多 100 个

        await chrome.storage.local.set({
          'localTaskQueue.tasks': truncated,
          'localTaskQueue.taskOrder': truncated.map(t => t.id),
        });
      } else {
        await chrome.storage.local.set({
          'localTaskQueue.tasks': incompleteTasks,
          'localTaskQueue.taskOrder': incompleteTasks.map(t => t.id),
        });
      }
    } catch (error: any) {
      console.error('[LocalTaskQueueService] Failed to persist tasks:', error);

      // 如果是 QUOTA_EXCEEDED 错误，尝试清理
      if (error.message && error.message.includes('QUOTA_EXCEEDED')) {
        console.warn('[LocalTaskQueueService] Storage quota exceeded, clearing old tasks...');
        await this.clearOldTasks();
      }
    }
  }

  private async clearOldTasks(): Promise<void> {
    // 清理已完成超过 1 天的任务
    const oneDayAgo = Date.now() - 86400000;

    const tasks = this.queue?.getAllTasks() || [];
    const recent = tasks.filter(t => {
      if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.FAILED) {
        return (t.completedAt || t.createdAt) > oneDayAgo;
      }
      return true; // 保留未完成的任务
    });

    await chrome.storage.local.set({
      'localTaskQueue.tasks': recent,
      'localTaskQueue.taskOrder': recent.map(t => t.id),
    });
  }
}
```

---

### 13. **DeepSeekHandler 依赖旧的 task queue**
**问题位置**: `handlers/DeepSeekHandler.ts:33`, `tools/browser/deepseek.ts:11-16`

**问题描述**:
```typescript
// deepseek.ts 导入了旧的 task queue
import {
  getTaskQueueManager,
  TaskStatus,
  type DeepSeekTask,
  type DeepSeekOptions,
  type TaskFilter,
} from '@/utils/deepseek-task-queue';

// DeepSeekHandler 使用 deepseekSendPromptTool
// 但 deepseekSendPromptTool 内部又创建了旧的 DeepSeek task
// 造成了两层任务系统
```

**系统架构混乱**:
```
用户 → LocalTaskQueue (新) → DeepSeekHandler → deepseekSendPromptTool → DeepSeekTaskQueue (旧)
                                                                              ↓
                                                                        真正执行任务
```

**改进建议**:
1. **短期方案**: DeepSeekHandler 保持现状，作为旧系统的适配器
2. **长期方案**: 重构 deepseekSendPromptTool，移除对旧 task queue 的依赖

---

### 14. **日志系统未优化**
**问题**: 所有 `console.log` 在生产环境仍然输出

**改进方案**:
```typescript
// utils/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;

  constructor() {
    // 从环境变量或 manifest 读取 log level
    this.level = import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();

// 使用
import { logger } from '@/utils/logger';
logger.debug('[LocalTaskQueue] Processing task...');
```

---

### 15. **缺少任务优先级队列优化**
**问题位置**: `LocalTaskQueue.ts:370-387`

**当前实现**:
```typescript
private getNextPendingTaskId(): string | null {
  // 每次都排序整个数组 - O(n log n)
  const sortedIds = [...this.taskOrder].sort((a, b) => {
    // ...
  });
}
```

**性能问题**:
- 每次获取下一个任务都要排序
- 1000 个任务 = 1000 次排序操作

**改进方案**:
使用优先级队列数据结构（最小堆）- O(log n) 插入和提取

```bash
npm install heap-js
```

```typescript
import { Heap } from 'heap-js';

class LocalTaskQueue {
  private pendingTasksHeap: Heap<string>;

  constructor(config: TaskQueueConfig = {}) {
    // ... 现有配置

    // 创建优先级队列（最小堆）
    this.pendingTasksHeap = new Heap<string>((a, b) => {
      const taskA = this.tasks.get(a);
      const taskB = this.tasks.get(b);

      if (!taskA || !taskB) return 0;

      // 优先级降序（高优先级先处理）
      const priorityA = taskA.metadata?.priority ?? 0;
      const priorityB = taskB.metadata?.priority ?? 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      // 创建时间升序（早创建的先处理）
      return taskA.createdAt - taskB.createdAt;
    });
  }

  async addTask<T = any>(task: Task<T>): Promise<boolean> {
    // ... 验证逻辑

    // 添加到 map
    this.tasks.set(task.id, task);

    // 添加到优先级队列
    if (task.status === TaskStatus.PENDING) {
      this.pendingTasksHeap.push(task.id);
    }

    // ... 其他逻辑
  }

  private getNextPendingTaskId(): string | null {
    // O(log n) 操作
    while (this.pendingTasksHeap.length > 0) {
      const taskId = this.pendingTasksHeap.pop();
      const task = this.tasks.get(taskId!);

      if (task && task.status === TaskStatus.PENDING) {
        return taskId!;
      }
      // 如果任务已被取消或改变状态，继续下一个
    }

    return null;
  }
}
```

---

## 📊 问题优先级总结

### P0 (已修复):
- ✅ 队列运行在 Popup（应该在 Background）
- ✅ 缺少消息通信
- ✅ 缺少状态持久化
- ✅ 事件系统跨上下文问题
- ✅ Service Worker 生命周期
- ✅ 任务去重算法

### P1 (建议尽快修复):
- ⚠️ **#7**: TaskCenter 与 LocalTaskQueue 功能重叠
- ⚠️ **#9**: 进度更新未节流（性能问题）
- ⚠️ **#10**: 错误类型未区分（浪费重试）
- ⚠️ **#12**: 持久化可能超过 storage 限制

### P2 (可以延后):
- 💡 **#8**: BingDictionaryHandler 标签页泄漏
- 💡 **#11**: 缺少队列容量限制
- 💡 **#13**: DeepSeekHandler 系统架构混乱
- 💡 **#15**: 任务优先级队列优化

### P3 (优化改进):
- 📝 **#14**: 日志系统未优化

---

## 🎯 下一步行动建议

### 立即执行:
1. 测试修复后的系统
2. 验证消息通信是否正常
3. 验证任务持久化是否正确

### 短期计划（1-2周）:
1. 实现进度更新节流（#9）
2. 添加错误类型区分（#10）
3. 处理 storage 限制（#12）
4. 决定 TaskCenter 的命运（#7）

### 中期计划（1-2月）:
1. 重构 DeepSeek 系统（#13）
2. 优化任务优先级队列（#15）
3. 添加日志系统（#14）

### 长期计划:
1. 完善测试覆盖率
2. 性能优化
3. 用户文档
