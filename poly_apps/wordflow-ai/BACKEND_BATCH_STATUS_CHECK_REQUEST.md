# 后端API需求：批量音频状态查询

**提交日期**: 2025-12-21
**前端团队**: WordFlow AI
**优先级**: 高 (High)

---

## 📋 需求背景

### 当前问题

**现状**：
- 前端使用 `GET /api/app_qy_v1/ai_tools/tts/queue/status?word=xxx&language=en` 查询单个单词状态
- 当有多个待处理单词时（例如10个），需要并行发送10个HTTP请求
- 这会产生过多的网络连接，增加服务器负载

**示例（当前方式）**：
```
轮询10个单词时：
GET /queue/status?word=abandon&language=en
GET /queue/status?word=adversity&language=en
GET /queue/status?word=sophisticated&language=en
GET /queue/status?word=abbreviate&language=en
... (共10个并行请求)
```

### 优化目标

将多个单独请求合并为一个批量请求，减少：
- HTTP连接数（10个请求 → 1个请求）
- 网络往返时间（RTT）
- 服务器处理开销

---

## 🎯 需求说明

### 新增API端点

**端点**: `POST /api/app_qy_v1/ai_tools/tts/queue/check_batch`

**用途**: 批量查询多个单词的音频生成状态

**认证**: 需要（Bearer Token）

---

## 📝 API规格

### 请求规范

**HTTP方法**: `POST`

**Content-Type**: `application/json`

**请求体格式**:
```json
{
  "words": [
    {
      "word": "abandon",
      "language": "en"
    },
    {
      "word": "adversity",
      "language": "en"
    },
    {
      "word": "sophisticated",
      "language": "en"
    }
  ]
}
```

**验证规则**:
- `words`: 必需，数组类型
  - 最小: 1个单词
  - 最大: 100个单词（与 `queue_batch` 保持一致）
- `words.*.word`: 必需，字符串，最大255字符
- `words.*.language`: 必需，字符串，最大10字符（语言代码：en, ja, ko等）

---

### 响应规范

#### 成功响应 (200 OK)

```json
{
  "status": "success",
  "message": "Batch status check completed",
  "data": {
    "results": [
      {
        "word": "abandon",
        "language": "en",
        "status": "completed",
        "audio_path": "p0pct/default/5f93f983524def3dca464469d2cf9f3e.mp3",
        "audio_url": "/api/app_qy_v1/ai_tools/tts/audio/en/word/p0pct/default/5f93f983524def3dca464469d2cf9f3e.mp3",
        "priority": 10,
        "completed_at": "2025-12-21 10:35:22"
      },
      {
        "word": "adversity",
        "language": "en",
        "status": "processing",
        "audio_path": null,
        "audio_url": null,
        "priority": 10,
        "started_at": "2025-12-21 10:35:00"
      },
      {
        "word": "sophisticated",
        "language": "en",
        "status": "pending",
        "audio_path": null,
        "audio_url": null,
        "priority": 5,
        "requested_at": "2025-12-21 10:30:00"
      }
    ],
    "not_found": [
      {
        "word": "unknown_word",
        "language": "en",
        "reason": "not_in_queue"
      }
    ],
    "summary": {
      "total_checked": 4,
      "completed": 1,
      "processing": 1,
      "pending": 1,
      "not_found": 1
    }
  }
}
```

#### 验证错误响应 (422 Unprocessable Entity)

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "words": ["The words field is required."],
    "words.0.word": ["The word field is required."],
    "words.100": ["The words array must not have more than 100 items."]
  }
}
```

#### 认证失败响应 (401 Unauthorized)

```json
{
  "status": "error",
  "message": "Unauthenticated"
}
```

---

## 🔧 字段说明

### 响应字段详解

#### `results` 数组（成功查询的单词）

| 字段 | 类型 | 说明 |
|------|------|------|
| `word` | string | 单词文本 |
| `language` | string | 语言代码 |
| `status` | string | 状态：`pending`, `processing`, `completed`, `failed` |
| `audio_path` | string\|null | 音频文件路径（相对路径，仅completed时有值） |
| `audio_url` | string\|null | 音频文件URL（完整路径，仅completed时有值） |
| `priority` | integer | 优先级（0-100） |
| `retry_count` | integer | 重试次数（可选） |
| `error_message` | string\|null | 错误信息（仅failed时有值） |
| `requested_at` | string\|null | 请求时间（ISO 8601格式） |
| `started_at` | string\|null | 开始处理时间（仅processing/completed时有值） |
| `completed_at` | string\|null | 完成时间（仅completed时有值） |

#### `not_found` 数组（未找到的单词）

| 字段 | 类型 | 说明 |
|------|------|------|
| `word` | string | 单词文本 |
| `language` | string | 语言代码 |
| `reason` | string | 未找到原因：`not_in_queue`, `already_available` |

> **注意**：如果单词音频已经生成并缓存在数据库中（不在队列中），建议返回在 `not_found` 中，并标记 `reason: "already_available"`

#### `summary` 对象（汇总统计）

| 字段 | 类型 | 说明 |
|------|------|------|
| `total_checked` | integer | 查询的单词总数 |
| `completed` | integer | 已完成的单词数 |
| `processing` | integer | 正在处理的单词数 |
| `pending` | integer | 等待处理的单词数 |
| `failed` | integer | 失败的单词数 |
| `not_found` | integer | 未找到的单词数 |

---

## 📊 前端使用场景

### 场景1：轮询待处理单词（常规）

```typescript
// 前端有10个待处理单词
const pendingWords = [
  { word: "abandon", language: "en" },
  { word: "adversity", language: "en" },
  { word: "sophisticated", language: "en" },
  // ... 共10个
];

// 批量查询状态
const response = await fetch('/api/app_qy_v1/ai_tools/tts/queue/check_batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ words: pendingWords })
});

const data = await response.json();

// 处理已完成的单词
data.data.results.forEach(result => {
  if (result.status === 'completed' && result.audio_url) {
    // 更新UI，显示播放按钮
    updateWordAudioUI(result.word, result.audio_url);
  }
});
```

### 场景2：大批量查询（100个单词）

```typescript
// 用户打开包含2000个单词的词库
// 其中200个单词没有音频，已加入队列

// 分批查询状态（每批100个）
for (let i = 0; i < pendingWords.length; i += 100) {
  const batch = pendingWords.slice(i, i + 100);

  const response = await fetch('/api/app_qy_v1/ai_tools/tts/queue/check_batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ words: batch })
  });

  const data = await response.json();
  processResults(data.data.results);
}
```

---

## 🚀 性能优化效果

### 优化前（当前方式）

**假设**：10个待处理单词

| 指标 | 当前方式 |
|------|---------|
| HTTP请求数 | 10个并行GET请求 |
| 总请求大小 | ~1 KB × 10 = 10 KB |
| 总响应大小 | ~1 KB × 10 = 10 KB |
| 网络往返 | 10次RTT |
| 服务器连接 | 10个并发连接 |

### 优化后（批量查询）

**假设**：10个待处理单词

| 指标 | 批量查询方式 |
|------|-------------|
| HTTP请求数 | 1个POST请求 |
| 总请求大小 | ~1 KB（包含10个单词） |
| 总响应大小 | ~2 KB（包含10个状态） |
| 网络往返 | 1次RTT |
| 服务器连接 | 1个连接 |

**优化幅度**：
- ✅ 请求数减少：10个 → 1个（**减少90%**）
- ✅ 网络往返减少：10次RTT → 1次RTT（**减少90%**）
- ✅ 连接开销减少：10个连接 → 1个连接（**减少90%**）

---

## 🔄 与现有API的对比

| 特性 | 单个查询 (`GET /queue/status`) | 批量查询 (`POST /check_batch`) |
|------|-------------------------------|--------------------------------|
| 端点 | GET /queue/status | POST /check_batch |
| 请求方式 | Query参数 | JSON Body |
| 单次查询数 | 1个单词 | 1-100个单词 |
| 认证 | 可选 | 需要 |
| 响应格式 | 单个对象 | 数组 + 汇总 |
| 适用场景 | 单个单词状态检查 | 批量轮询、大规模查询 |

**建议**：
- 保留 `GET /queue/status` 用于单个单词查询（向后兼容）
- 新增 `POST /check_batch` 用于批量查询（推荐前端使用）

---

## 🛠️ 后端实现建议（可选参考）

### Laravel控制器伪代码

```php
// app/Http/Controllers/AppQyV1/AITools/TTSController.php

public function checkBatch(Request $request)
{
    // 验证请求
    $validated = $request->validate([
        'words' => 'required|array|min:1|max:100',
        'words.*.word' => 'required|string|max:255',
        'words.*.language' => 'required|string|max:10',
    ]);

    $results = [];
    $notFound = [];
    $summary = [
        'total_checked' => count($validated['words']),
        'completed' => 0,
        'processing' => 0,
        'pending' => 0,
        'failed' => 0,
        'not_found' => 0,
    ];

    foreach ($validated['words'] as $item) {
        // 查询队列表
        $queueItem = AppQyV1TTSQueue::where('word', $item['word'])
            ->where('language', $item['language'])
            ->first();

        if ($queueItem) {
            // 构建结果
            $result = [
                'word' => $queueItem->word,
                'language' => $queueItem->language,
                'status' => $queueItem->status,
                'audio_path' => $queueItem->audio_path,
                'audio_url' => $queueItem->audio_path
                    ? "/api/app_qy_v1/ai_tools/tts/audio/{$queueItem->language}/word/{$queueItem->audio_path}"
                    : null,
                'priority' => $queueItem->priority,
                'requested_at' => $queueItem->created_at->toISOString(),
                'started_at' => $queueItem->started_at?->toISOString(),
                'completed_at' => $queueItem->completed_at?->toISOString(),
            ];

            $results[] = $result;
            $summary[$queueItem->status]++;
        } else {
            // 检查是否已在字典表中
            $dictEntry = AppQyV1LangDictionaryModel::where('word', $item['word'])
                ->where('language', $item['language'])
                ->whereNotNull('tts_audio_path')
                ->first();

            if ($dictEntry) {
                $notFound[] = [
                    'word' => $item['word'],
                    'language' => $item['language'],
                    'reason' => 'already_available',
                ];
            } else {
                $notFound[] = [
                    'word' => $item['word'],
                    'language' => $item['language'],
                    'reason' => 'not_in_queue',
                ];
            }

            $summary['not_found']++;
        }
    }

    return response()->json([
        'status' => 'success',
        'message' => 'Batch status check completed',
        'data' => [
            'results' => $results,
            'not_found' => $notFound,
            'summary' => $summary,
        ],
    ]);
}
```

### 路由配置

```php
// routes/api.php

Route::post('/ai_tools/tts/queue/check_batch', [TTSController::class, 'checkBatch'])
    ->middleware('auth:sanctum');
```

---

## ✅ 验收标准

### 功能要求

- [x] 支持批量查询1-100个单词
- [x] 返回每个单词的详细状态
- [x] 区分队列中的单词和已完成的单词
- [x] 提供汇总统计信息
- [x] 验证请求格式（超过100个单词时返回422错误）
- [x] 需要认证（Bearer Token）
- [x] 响应时间 < 500ms（100个单词）

### 性能要求

- [x] 单次查询100个单词时，响应时间 < 500ms
- [x] 支持并发请求（多个用户同时查询）
- [x] 使用数据库索引优化查询（word + language复合索引）

### 错误处理

- [x] 请求体格式错误 → 422 Unprocessable Entity
- [x] 缺少认证 → 401 Unauthorized
- [x] 超过100个单词 → 422 Validation Error
- [x] 服务器错误 → 500 Internal Server Error

---

## 🧪 测试用例

### 测试1：正常批量查询

**请求**:
```json
POST /api/app_qy_v1/ai_tools/tts/queue/check_batch
{
  "words": [
    { "word": "abandon", "language": "en" },
    { "word": "adversity", "language": "en" }
  ]
}
```

**期望响应**: 200 OK，包含2个单词的状态

---

### 测试2：超过100个单词

**请求**:
```json
POST /api/app_qy_v1/ai_tools/tts/queue/check_batch
{
  "words": [ /* 101个单词 */ ]
}
```

**期望响应**: 422 Validation Error

---

### 测试3：单词不在队列中

**请求**:
```json
POST /api/app_qy_v1/ai_tools/tts/queue/check_batch
{
  "words": [
    { "word": "nonexistent_word", "language": "en" }
  ]
}
```

**期望响应**: 200 OK，`not_found` 数组包含该单词

---

### 测试4：未认证

**请求**: 不带 `Authorization` 头

**期望响应**: 401 Unauthorized

---

## 📅 开发计划建议

### 优先级：高

**预期工作量**: 2-4小时

**建议步骤**:
1. 创建控制器方法 `checkBatch()`（30分钟）
2. 添加请求验证规则（15分钟）
3. 实现批量查询逻辑（1小时）
4. 添加路由和中间件（15分钟）
5. 编写单元测试（1小时）
6. 性能测试和优化（30分钟）

**依赖**:
- 现有 `AppQyV1TTSQueue` 模型
- 现有 `AppQyV1LangDictionaryModel` 模型
- Sanctum认证系统

---

## 📞 联系方式

**前端团队负责人**: WordFlow AI Team
**问题反馈**: 请在实现前与前端团队确认API细节
**测试配合**: 前端团队可提供集成测试协助

---

## 🔖 附录

### 参考文档

- 现有API: `FRONTEND_TTS_INTEGRATION_GUIDE.md`
- 前端实现: `services/VocabularyAudioCenter.ts`

### 版本历史

- **v1.0** (2025-12-21): 初始需求文档

---

**总结**：
- ✅ 新增批量状态查询API可大幅减少网络请求（90%）
- ✅ 保持与现有 `queue_batch` API的设计一致性
- ✅ 提供详细的响应信息和汇总统计
- ✅ 向后兼容（保留单个查询API）

请后端团队评估该需求的可行性和开发时间。如有疑问，请随时联系前端团队。
