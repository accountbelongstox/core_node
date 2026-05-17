# TTS批量状态查询 - 前端实现完成

**日期**: 2025-12-21
**状态**: ✅ **前端实现完成，等待后端API**

---

## 🎯 优化目标

### 问题分析

**优化前（单个查询）**:
```
轮询10个待处理单词：
GET /queue/status?word=abandon&language=en
GET /queue/status?word=adversity&language=en
GET /queue/status?word=sophisticated&language=en
... (共10个并行请求)

❌ 10个HTTP连接
❌ 10次网络往返（RTT）
❌ 服务器处理10个独立请求
```

**优化后（批量查询）**:
```
轮询10个待处理单词：
POST /queue/check_batch
{
  "words": [
    { "word": "abandon", "language": "en" },
    { "word": "adversity", "language": "en" },
    ... (共10个单词在一个请求中)
  ]
}

✅ 1个HTTP连接
✅ 1次网络往返（RTT）
✅ 服务器批量处理
```

**优化效果**:
- 减少90%的HTTP请求数
- 减少90%的网络往返时间
- 减少服务器连接开销

---

## ✅ 前端实现内容

### 1. 新增接口定义

**文件**: `services/VocabularyAudioCenter.ts`

#### 批量查询请求接口
```typescript
interface BatchStatusCheckRequest {
  words: Array<{
    word: string;
    language: string;
  }>;
}
```

#### 批量查询响应接口
```typescript
interface BatchStatusCheckResponse {
  status: string;
  message: string;
  data: {
    results: Array<{
      word: string;
      language: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      audio_path: string | null;
      audio_url: string | null;
      priority: number;
      retry_count?: number;
      error_message?: string | null;
      requested_at?: string | null;
      started_at?: string | null;
      completed_at?: string | null;
    }>;
    not_found: Array<{
      word: string;
      language: string;
      reason: 'not_in_queue' | 'already_available';
    }>;
    summary: {
      total_checked: number;
      completed: number;
      processing: number;
      pending: number;
      failed: number;
      not_found: number;
    };
  };
}
```

---

### 2. 重写轮询方法 (pollPendingWordsStatus)

**优化前** (services/VocabularyAudioCenter.ts:262-411):
```typescript
// 旧实现：每个单词单独查询
for (const [key, request] of this.pendingAudioRequests.entries()) {
  const response = await fetch(
    `${baseUrl}/api/app_qy_v1/ai_tools/tts/queue/status?word=${request.word}&language=${request.language}`
  );
  // ... 处理单个响应
}
```

**优化后** (services/VocabularyAudioCenter.ts:298-461):
```typescript
// 新实现：批量查询所有待处理单词
const wordsToCheck: Array<{ word: string; language: string }> = [];

for (const [key, request] of this.pendingAudioRequests.entries()) {
  wordsToCheck.push({
    word: request.word,
    language: request.language
  });
}

// 分批查询（每批最多100个）
const batches = [];
for (let i = 0; i < wordsToCheck.length; i += 100) {
  batches.push(wordsToCheck.slice(i, i + 100));
}

for (const batch of batches) {
  const response = await fetch(`${baseUrl}/api/app_qy_v1/ai_tools/tts/queue/check_batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ words: batch })
  });

  const data: BatchStatusCheckResponse = await response.json();

  // 处理批量响应
  // ...
}
```

---

### 3. 响应处理逻辑

#### 3.1 处理成功结果
```typescript
for (const result of data.data.results) {
  if (result.status === 'completed' && result.audio_url) {
    // 音频已完成
    this.updateCachedWord(result.word, result.language, result.audio_url);
    this.notifyListeners(result.word, result.audio_url);
    this.pendingAudioRequests.delete(requestKey);
    completedCount++;
  }
  else if (result.status === 'failed') {
    // 生成失败
    request.retryCount++;
    if (request.retryCount >= MAX_RETRY) {
      this.pendingAudioRequests.delete(requestKey);
    }
  }
  else {
    // 仍在处理（pending/processing）
    request.retryCount++;
  }
}
```

#### 3.2 处理未找到的单词
```typescript
for (const notFound of data.data.not_found) {
  if (notFound.reason === 'already_available') {
    // 音频已经存在，不在队列中
    this.pendingAudioRequests.delete(requestKey);
  }
  else if (notFound.reason === 'not_in_queue') {
    // 单词从未加入队列
    this.pendingAudioRequests.delete(requestKey);
  }
}
```

#### 3.3 日志汇总信息
```typescript
console.log(`[VocabularyAudioCenter] Batch summary:`, {
  completed: data.data.summary.completed,
  processing: data.data.summary.processing,
  pending: data.data.summary.pending,
  failed: data.data.summary.failed,
  not_found: data.data.summary.not_found
});
```

---

### 4. 更新文档注释

**文件头部** (services/VocabularyAudioCenter.ts:1-16):
```typescript
/**
 * VocabularyAudioCenter - TTS Audio Management System (Optimized)
 *
 * Performance Optimizations:
 * 1. Local word cache - avoid re-fetching entire library
 * 2. Targeted polling - only check words without audio
 * 3. Dynamic cache management - clear when switching pages
 * 4. BATCH status queries - query multiple words in one request (max 100)
 * 5. Minimal network requests - only query pending words
 *
 * API Endpoints Used:
 * - POST /api/app_qy_v1/ai_tools/tts/queue_batch (queue words)
 * - POST /api/app_qy_v1/ai_tools/tts/queue/check_batch (batch status check)
 *
 * Based on: FRONTEND_TTS_INTEGRATION_GUIDE.md
 */
```

---

## 📊 性能对比

| 指标 | 单个查询（旧） | 批量查询（新） | 优化幅度 |
|------|---------------|---------------|----------|
| **HTTP请求数** | 10个并行GET | 1个POST | **-90%** |
| **网络往返（RTT）** | 10次 | 1次 | **-90%** |
| **服务器连接** | 10个 | 1个 | **-90%** |
| **请求体大小** | ~100 bytes × 10 | ~300 bytes | **-70%** |
| **响应体大小** | ~1 KB × 10 | ~2 KB | **-80%** |
| **总网络流量** | ~11 KB | ~2.3 KB | **-79%** |

**假设**：查询10个待处理单词

---

## 🔄 工作流程

### 用户打开词库页面

```
1. LibraryDetail.tsx 加载词库
   ↓
2. VocabularyAudioCenter.processVocabularyLibrary()
   - 构建本地缓存
   - 筛选没有音频的单词（audio_available = false）
   - 调用 POST /queue_batch 加入队列
   ↓
3. 启动轮询（每5秒）
   VocabularyAudioCenter.pollPendingWordsStatus()
   ↓
4. 批量查询待处理单词状态
   POST /queue/check_batch
   {
     "words": [
       { "word": "abandon", "language": "en" },
       { "word": "adversity", "language": "en" },
       ... (所有待处理单词)
     ]
   }
   ↓
5. 处理批量响应
   - completed 单词 → 更新缓存 → 通知UI → 移除待处理列表
   - processing 单词 → 继续等待
   - pending 单词 → 继续等待
   - failed 单词 → 重试或放弃
   - not_found 单词 → 移除待处理列表
   ↓
6. 重复步骤3-5，直到所有单词完成或超时
```

---

## 🧪 测试场景

### 场景1：10个待处理单词

**初始状态**:
```typescript
pendingAudioRequests.size = 10
```

**轮询请求**:
```
POST /api/app_qy_v1/ai_tools/tts/queue/check_batch
{
  "words": [
    { "word": "abandon", "language": "en" },
    { "word": "adversity", "language": "en" },
    ... (10个单词)
  ]
}
```

**响应示例**:
```json
{
  "status": "success",
  "data": {
    "results": [
      { "word": "abandon", "status": "completed", "audio_url": "/api/.../audio.mp3" },
      { "word": "adversity", "status": "processing", "audio_url": null },
      { "word": "sophisticated", "status": "pending", "audio_url": null }
    ],
    "not_found": [],
    "summary": {
      "total_checked": 10,
      "completed": 3,
      "processing": 4,
      "pending": 3,
      "failed": 0,
      "not_found": 0
    }
  }
}
```

**处理结果**:
- 3个completed单词：更新UI显示播放按钮
- 7个pending/processing单词：继续轮询
- 下次轮询只查7个单词（3个已完成的移除）

---

### 场景2：200个待处理单词（分批）

**初始状态**:
```typescript
pendingAudioRequests.size = 200
```

**轮询请求**（分2批）:
```
批次1: POST /queue/check_batch (前100个单词)
批次2: POST /queue/check_batch (后100个单词)
```

**日志输出**:
```
[VocabularyAudioCenter] Polling 200 pending words (BATCH)...
[VocabularyAudioCenter] Querying 200 words in 2 batch(es)...
[VocabularyAudioCenter] Batch summary: { completed: 15, processing: 40, pending: 45 }
[VocabularyAudioCenter] Batch summary: { completed: 20, processing: 35, pending: 45 }
[VocabularyAudioCenter] ✅ 35 audio files completed
[VocabularyAudioCenter] Still pending: 165 words
```

---

### 场景3：单词不在队列中

**响应示例**:
```json
{
  "status": "success",
  "data": {
    "results": [],
    "not_found": [
      {
        "word": "abandon",
        "language": "en",
        "reason": "already_available"
      }
    ],
    "summary": {
      "total_checked": 1,
      "not_found": 1
    }
  }
}
```

**处理逻辑**:
```typescript
if (notFound.reason === 'already_available') {
  // 音频已经生成并缓存，从待处理列表移除
  this.pendingAudioRequests.delete(requestKey);
}
```

---

## 📝 代码修改汇总

### 修改的文件

**services/VocabularyAudioCenter.ts** (612 lines, +70 lines):

**新增内容**:
1. ✅ `BatchStatusCheckRequest` 接口（50-55行）
2. ✅ `BatchStatusCheckResponse` 接口（57-88行）
3. ✅ 重写 `pollPendingWordsStatus()` 方法（298-461行，+164行）
4. ✅ 更新文档注释（1-16行）

**删除内容**:
1. ❌ 旧的单个查询逻辑（~100行代码）

**净增加**: +70行

---

## 📦 构建状态

**之前构建**: 815.41 kB (gzip: 196.45 kB)
**当前构建**: 816.35 kB (gzip: 196.76 kB)
**增加**: +0.94 kB (+0.31 kB gzipped)

**原因**: 新增批量查询接口定义和处理逻辑

**状态**: ✅ **构建成功**

---

## 🔗 后端API需求文档

已创建详细的后端API需求文档：

**文件**: `BACKEND_BATCH_STATUS_CHECK_REQUEST.md` (690+ lines)

**包含内容**:
1. ✅ API规格说明（请求/响应格式）
2. ✅ 验证规则
3. ✅ 字段说明
4. ✅ 前端使用场景示例
5. ✅ 性能对比分析
6. ✅ Laravel实现建议（伪代码）
7. ✅ 测试用例
8. ✅ 验收标准

---

## 🚀 后续步骤

### 等待后端实现

**新API端点**: `POST /api/app_qy_v1/ai_tools/tts/queue/check_batch`

**预估工作量**: 2-4小时（后端开发）

### 前端集成测试

**待测试功能**:
- [ ] 批量查询API正常工作
- [ ] 分批处理（>100单词）正常工作
- [ ] `results` 数组正确处理
- [ ] `not_found` 数组正确处理
- [ ] `summary` 日志正确显示
- [ ] UI自动更新（⏳ → ▶️）
- [ ] 错误处理（401, 422, 500）
- [ ] 性能优化效果验证

---

## 📊 性能预期

### 网络使用对比

**优化前**（10个待处理单词）:
```
每5秒轮询一次：
- 发送: 10个GET请求 × ~100 bytes = ~1 KB
- 接收: 10个响应 × ~1 KB = ~10 KB
- 总计: ~11 KB / 5秒 = ~132 KB/分钟
```

**优化后**（10个待处理单词）:
```
每5秒轮询一次：
- 发送: 1个POST请求 × ~300 bytes = ~300 bytes
- 接收: 1个响应 × ~2 KB = ~2 KB
- 总计: ~2.3 KB / 5秒 = ~28 KB/分钟
```

**优化效果**: 减少79%的网络流量

---

### 服务器负载对比

**优化前**:
```
10个并发连接
10次数据库查询（每个单词独立查询）
10次JSON序列化/反序列化
```

**优化后**:
```
1个连接
1次批量数据库查询（WHERE ... IN (...)）
1次JSON序列化/反序列化
```

**优化效果**: 减少90%的服务器开销

---

## ✅ 验收标准

### 前端实现 ✅

- [x] 批量查询接口定义完成
- [x] `pollPendingWordsStatus()` 重写完成
- [x] 响应处理逻辑完成（results + not_found）
- [x] 错误处理完成
- [x] 分批逻辑完成（>100单词）
- [x] 日志输出完成
- [x] 代码编译成功
- [x] 文档注释更新

### 系统集成（待后端完成后测试）

- [ ] POST /queue/check_batch API可用
- [ ] 批量查询返回正确格式
- [ ] `results` 数组包含所有查询的单词
- [ ] `not_found` 数组包含未找到的单词
- [ ] `summary` 统计信息正确
- [ ] UI自动更新
- [ ] 性能优化效果达标（-90% requests）

---

## 📌 总结

### 前端已完成 ✅

1. ✅ **批量查询接口定义**
2. ✅ **轮询方法重写**（单个查询 → 批量查询）
3. ✅ **响应处理逻辑**（results + not_found + summary）
4. ✅ **分批处理逻辑**（每批最多100个）
5. ✅ **错误处理和重试**
6. ✅ **代码构建成功**
7. ✅ **后端需求文档**（690+ lines）

### 优化效果预期 📊

- ✅ 减少90%的HTTP请求数
- ✅ 减少90%的网络往返时间
- ✅ 减少79%的网络流量
- ✅ 减少90%的服务器连接开销
- ✅ 更好的日志可读性（批量汇总）

### 等待后端 ⏳

**API端点**: `POST /api/app_qy_v1/ai_tools/tts/queue/check_batch`
**需求文档**: `BACKEND_BATCH_STATUS_CHECK_REQUEST.md`
**预估时间**: 2-4小时

---

*生成于 2025-12-21*
*前端: React 19.2 + TypeScript 5.8*
*文件: services/VocabularyAudioCenter.ts (612 lines)*
*构建状态: ✅ 成功 (816.35 kB)*
