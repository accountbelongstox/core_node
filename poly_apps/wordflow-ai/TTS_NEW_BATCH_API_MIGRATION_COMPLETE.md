# TTS新批量API迁移完成

**日期**: 2025-12-21
**状态**: ✅ **迁移完成，构建成功**

---

## 🎯 迁移目标

从旧的批量查询方案迁移到后端全新的 **Batch API v2.0.0**

### 后端新API (2025-12-21)

1. **`POST /api/app_qy_v1/ai_tools/tts/queue/batch/add`**
   - 批量添加TTS任务
   - 支持文件穿透检查（已存在的音频立即返回）
   - 返回task_id用于后续查询

2. **`POST /api/app_qy_v1/ai_tools/tts/queue/batch/get`**
   - 通过task_ids批量查询任务状态
   - 一次查询可获取多个任务的完整信息

---

## ✅ 完成内容

### 1. 更新接口定义

**文件**: `services/VocabularyAudioCenter.ts` (29-104行)

#### 新增接口

```typescript
// Backend Batch API Interfaces (v2.0.0)

interface BatchAddTasksRequest {
  tasks: Array<{
    content: string;
    language: string;
    type?: 'word' | 'sentence' | 'article';
    priority?: number;  // 0-100
  }>;
  default_priority?: number;  // 0-100
}

interface BatchAddTasksResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    total: number;
    results: Array<{
      success: boolean;
      status: 'queued' | 'moved_to_front' | 'already_available' | 'already_completed';
      task_id?: number;
      task_type?: string;
      priority?: number;
      audio_path?: string;
      audio_url?: string;
      index: number;
      content: string;
      error?: string;
    }>;
  };
}

interface BatchGetTasksRequest {
  task_ids: number[];
}

interface BatchGetTasksResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    total: number;
    results: Array<TaskDetail | TaskNotFound>;
  };
}

interface TaskDetail {
  task_id: number;
  task_type: 'word' | 'sentence' | 'article';
  content_text: string;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  retry_count: number;
  audio_path?: string;
  audio_url?: string;
  error_message?: string;
  requested_at?: string;
  started_at?: string;
  completed_at?: string;
}

interface TaskNotFound {
  task_id: number;
  error: string;
}

// Internal Request Tracking
interface AudioGenerationRequest {
  word: string;
  language: string;
  index: number;
  priority: number;
  taskId: number | null;  // ✅ NEW: Task ID from batch/add
  requestTime: number;
  retryCount: number;
}
```

**关键变化**:
- ✅ 新增 `taskId` 字段用于追踪后端返回的任务ID
- ✅ 使用 `BatchAddTasksRequest/Response` 替代旧的 `AudioQueueRequest`
- ✅ 使用 `BatchGetTasksRequest/Response` 替代旧的 `BatchStatusCheckRequest/Response`

---

### 2. 修改队列添加方法

**方法**: `queueWordsForGeneration()` (221-311行)

#### 旧实现（已废弃）
```typescript
POST /api/app_qy_v1/ai_tools/tts/queue_batch
{
  words: [
    { word: "hello", language: "en", priority: 10 }
  ]
}
```

#### 新实现
```typescript
POST /api/app_qy_v1/ai_tools/tts/queue/batch/add
{
  tasks: [
    { content: "hello", language: "en", type: "word", priority: 10 }
  ],
  default_priority: 10
}
```

**响应处理** (267-307行):
```typescript
for (const result of data.data.results) {
  const word = result.content;
  const language = batch[result.index].language;
  const key = this.getWordKey(word, language);

  if (result.status === 'already_available' || result.status === 'already_completed') {
    // ✅ 文件穿透检查 - 音频已存在，立即返回
    console.log(`✅ Audio already available: ${word}`);
    if (result.audio_url) {
      this.updateCachedWord(word, language, result.audio_url);
      this.notifyListeners(word, result.audio_url);
    }
    this.pendingAudioRequests.delete(key);

  } else if (result.status === 'queued' || result.status === 'moved_to_front') {
    // ✅ 任务已加入队列 - 记录task_id用于后续查询
    console.log(`⏳ Task queued: ${word}, task_id: ${result.task_id}`);
    const request = this.pendingAudioRequests.get(key);
    if (request && result.task_id) {
      request.taskId = result.task_id;  // 关键：保存task_id
    }
  }
}
```

**优势**:
- ✅ **文件穿透检查**: 后端自动检查音频是否已存在，避免重复生成
- ✅ **立即可用**: 已存在的音频直接返回，无需等待
- ✅ **任务追踪**: 通过task_id精确追踪每个任务

---

### 3. 修改轮询方法

**方法**: `pollPendingWordsStatus()` (343-501行)

#### 旧实现（已废弃）
```typescript
// 每个单词发送一个请求
for (const [key, request] of pendingRequests) {
  GET /queue/status?word=${request.word}&language=${request.language}
}
```

#### 新实现
```typescript
// 收集所有task_ids
const taskIds: number[] = [];
for (const [key, request] of this.pendingAudioRequests.entries()) {
  if (request.taskId) {
    taskIds.push(request.taskId);
  }
}

// 批量查询
POST /api/app_qy_v1/ai_tools/tts/queue/batch/get
{
  task_ids: [123, 124, 125, ...]
}
```

**响应处理** (406-486行):
```typescript
for (const result of data.data.results) {
  // 处理TaskNotFound
  if ('error' in result) {
    const taskNotFound = result as TaskNotFound;
    console.warn(`Task not found: ${taskNotFound.task_id}`);
    this.pendingAudioRequests.delete(requestKey);
    continue;
  }

  // 处理TaskDetail
  const task = result as TaskDetail;
  const request = this.pendingAudioRequests.get(requestKey);

  if (task.status === 'completed' && task.audio_url) {
    // ✅ 音频生成完成
    this.updateCachedWord(request.word, request.language, task.audio_url);
    this.notifyListeners(request.word, task.audio_url);
    this.pendingAudioRequests.delete(requestKey);
    completedCount++;
  }
  else if (task.status === 'failed') {
    // ❌ 生成失败
    request.retryCount++;
    if (request.retryCount >= MAX_RETRY) {
      this.pendingAudioRequests.delete(requestKey);
    }
  }
  else {
    // ⏳ 仍在处理中
    request.retryCount++;
  }
}

// 日志汇总
const summary = {
  total: data.data.total,
  completed: results.filter(...).length,
  processing: results.filter(...).length,
  pending: results.filter(...).length,
  failed: results.filter(...).length,
  not_found: results.filter(...).length
};
console.log(`Batch summary:`, summary);
```

**优势**:
- ✅ **批量查询**: 一次请求查询所有待处理任务（原来需要N次请求）
- ✅ **精确追踪**: 通过task_id查询，不会出现单词重复的问题
- ✅ **详细信息**: 获取每个任务的完整状态和错误信息

---

## 📊 性能对比

### 场景：查询10个待处理单词的状态

#### 旧方案（已废弃）
```
❌ 发送10个并行GET请求
GET /queue/status?word=hello&language=en
GET /queue/status?word=world&language=en
... (共10个请求)

网络开销:
- 请求数: 10个
- RTT: 10次
- 流量: ~10-20 KB
```

#### 新方案
```
✅ 发送1个POST请求
POST /queue/batch/get
{
  "task_ids": [123, 124, 125, ...]
}

网络开销:
- 请求数: 1个
- RTT: 1次
- 流量: ~2-3 KB
```

**优化效果**:
- 减少90%的HTTP请求数
- 减少90%的网络往返时间
- 减少70-85%的网络流量

---

## 🎨 UI显示逻辑

### LibraryDetail.tsx (547-568行)

**播放按钮显示逻辑**:
```tsx
{word.audio_available && word.audio_url && (
  <button
    onClick={() => playAudio(word.audio_url!, word.word)}
    className="px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm"
    title="播放音频"
  >
    {playingAudio === word.word ? '⏸️' : '▶️'}
  </button>
)}

{!word.audio_available && VocabularyAudioCenter.isPending(word.word, library?.language || 'en') && (
  <span className="px-2 py-1 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 rounded text-sm" title="音频生成中">
    ⏳
  </span>
)}
```

**UI状态**:
1. ✅ **有音频**: 显示 ▶️ 播放按钮
2. ⏸️ **播放中**: 按钮变为 ⏸️
3. ⏳ **生成中**: 显示 ⏳ 图标

---

## 🔄 完整工作流程

### 用户打开词库页面

```
1. LibraryDetail.tsx 加载词库
   GET /vocabulary/libraries/{id}/words
   ↓
   返回1000个单词，其中:
   - 800个有音频 (audio_available: true)
   - 200个没有音频 (audio_available: false)

2. VocabularyAudioCenter.processVocabularyLibrary()
   ↓
   构建本地缓存 (cachedWords Map)
   筛选200个没有音频的单词
   ↓

3. 批量添加任务
   POST /queue/batch/add
   {
     "tasks": [
       { "content": "abandon", "language": "en", "type": "word" },
       { "content": "adversity", "language": "en", "type": "word" },
       ... (共200个)
     ]
   }
   ↓
   响应:
   {
     "results": [
       { "status": "already_available", "audio_url": "..." },  // 50个已存在
       { "status": "queued", "task_id": 123 },                 // 150个需生成
       ...
     ]
   }
   ↓

4. 处理响应
   - 50个 already_available → 立即更新UI显示播放按钮
   - 150个 queued → 记录task_id，加入待轮询列表
   ↓

5. 启动轮询 (每5秒)
   POST /queue/batch/get
   {
     "task_ids": [123, 124, 125, ...]  // 150个task_id
   }
   ↓

6. 处理轮询响应
   {
     "results": [
       { "task_id": 123, "status": "completed", "audio_url": "..." },  // 20个完成
       { "task_id": 124, "status": "processing" },                      // 30个处理中
       { "task_id": 125, "status": "pending" },                         // 100个等待中
     ]
   }
   ↓
   - 20个completed → 更新缓存 → 通知UI → 显示播放按钮
   - 130个pending/processing → 继续轮询
   ↓

7. 持续轮询直到所有任务完成或超时
```

---

## 📝 代码修改汇总

### 修改的文件

**services/VocabularyAudioCenter.ts** (612 lines):

**新增内容**:
1. ✅ 新API接口定义 (29-104行, +75行)
2. ✅ 文档注释更新 (1-17行)

**修改内容**:
1. ✅ `queueWordsForGeneration()` 方法 (221-311行)
   - 改用 `POST /queue/batch/add`
   - 处理文件穿透检查响应
   - 记录task_id
2. ✅ `pollPendingWordsStatus()` 方法 (343-501行)
   - 改用 `POST /queue/batch/get`
   - 通过task_ids查询
   - 处理TaskDetail和TaskNotFound
3. ✅ `startPolling()` 日志更新 (314-331行)

**保持不变**:
- ✅ LibraryDetail.tsx 播放按钮显示逻辑（已完美适配）
- ✅ 本地缓存机制
- ✅ 动态缓存管理
- ✅ 订阅通知机制

---

## 📦 构建状态

**之前构建**: 816.35 kB (gzip: 196.76 kB)
**当前构建**: 817.03 kB (gzip: 197.02 kB)
**增加**: +0.68 kB (+0.26 kB gzipped)

**原因**: 新增批量API接口定义和处理逻辑

**状态**: ✅ **构建成功**

---

## 🧪 测试清单

### 后端API测试 (等待后端部署)

- [ ] `POST /queue/batch/add` API可用
- [ ] 文件穿透检查正常工作（已存在音频直接返回）
- [ ] task_id正确返回
- [ ] `POST /queue/batch/get` API可用
- [ ] 通过task_ids批量查询正常工作
- [ ] TaskDetail和TaskNotFound正确返回

### 前端集成测试

- [ ] 打开词库页面，自动加载单词
- [ ] 没有音频的单词自动调用 batch/add
- [ ] 已存在音频的单词立即显示播放按钮
- [ ] 轮询正常工作（每5秒查询一次）
- [ ] 音频生成完成后UI自动更新（⏳ → ▶️）
- [ ] 播放按钮点击正常播放音频
- [ ] 切换页面时缓存正确清理
- [ ] 错误处理正常（401, 422, 500）

---

## 🎯 新API的优势

### 1. 文件穿透检查
```
旧方案: 所有单词都加入队列，即使音频已存在
新方案: 后端自动检查，已存在的音频立即返回

优势:
- ✅ 减少队列压力
- ✅ 用户体验更好（无需等待）
- ✅ 减少重复生成
```

### 2. 任务追踪
```
旧方案: 通过 word + language 查询
新方案: 通过 task_id 查询

优势:
- ✅ 避免单词重名问题
- ✅ 支持同一单词多次请求
- ✅ 更精确的状态追踪
```

### 3. 批量操作
```
旧方案:
- 添加: 批量
- 查询: 单个（每个单词一个请求）

新方案:
- 添加: 批量
- 查询: 批量（所有task_id一个请求）

优势:
- ✅ 大幅减少网络请求（90%）
- ✅ 降低服务器负载
- ✅ 提高响应速度
```

### 4. 统一接口
```
新方案支持:
- 单词 (word)
- 句子 (sentence)
- 文章 (article)

优势:
- ✅ 未来扩展性强
- ✅ 代码复用
- ✅ 维护成本低
```

---

## 🔗 相关文档

1. **TTS_BATCH_API_DOCUMENTATION.md** (665 lines)
   - 后端提供的完整API文档
   - 包含请求/响应示例、TypeScript类型定义

2. **BACKEND_BATCH_STATUS_CHECK_REQUEST.md** (690+ lines)
   - 之前提交给后端的需求文档（已被新API替代）

3. **TTS_AUDIO_INTEGRATION_COMPLETE.md** (527 lines)
   - 之前的TTS集成完成文档（部分内容已过时）

---

## ✅ 迁移验收

### 前端实现 ✅

- [x] 新API接口定义完成
- [x] batch/add集成完成
- [x] batch/get集成完成
- [x] task_id映射管理完成
- [x] 文件穿透检查处理完成
- [x] 代码编译成功
- [x] 文档注释更新

### 系统集成（待后端部署后测试）

- [ ] batch/add API响应正确
- [ ] 文件穿透检查工作正常
- [ ] task_id正确返回和追踪
- [ ] batch/get API响应正确
- [ ] UI自动更新正常
- [ ] 播放按钮显示正常

---

## 🚀 下一步

### 后端部署完成后

1. **集成测试**:
   - 访问 http://192.168.50.3:10029/vocabulary_library/6
   - 验证有音频的单词显示 ▶️ 播放按钮
   - 验证没有音频的单词自动调用 batch/add
   - 验证音频生成完成后自动更新UI

2. **性能验证**:
   - 检查网络请求数（应大幅减少）
   - 检查响应时间（应更快）
   - 检查服务器负载（应降低）

3. **异常测试**:
   - 测试网络错误处理
   - 测试认证失败处理
   - 测试任务失败重试

---

## 📌 总结

### 已完成 ✅

1. ✅ **全面迁移到新批量API v2.0.0**
2. ✅ **支持文件穿透检查**（已存在音频立即返回）
3. ✅ **基于task_id的追踪**（更精确、更高效）
4. ✅ **批量查询优化**（减少90%网络请求）
5. ✅ **代码构建成功**
6. ✅ **播放按钮显示逻辑已就绪**

### 等待验证 ⏳

**API端点**:
- `POST /api/app_qy_v1/ai_tools/tts/queue/batch/add`
- `POST /api/app_qy_v1/ai_tools/tts/queue/batch/get`

**测试页面**:
- http://192.168.50.3:10029/vocabulary_library/6

---

*迁移完成于 2025-12-21*
*前端: React 19.2 + TypeScript 5.8*
*文件: services/VocabularyAudioCenter.ts (612 lines)*
*构建状态: ✅ 成功 (817.03 kB)*
*基于: TTS_BATCH_API_DOCUMENTATION.md (Backend API v2.0.0)*
