# API 端点详细文档

## 概述

本文档详细定义了 Laravel Dashboard 需要集成的所有 API 端点，包括请求格式、响应格式和使用示例。

---

## 目录

1. [System Information API](#1-system-information-api)
2. [Translation API](#2-translation-api)
3. [TTS (Text-to-Speech) API](#3-tts-api)
4. [MCP Screenshots API](#4-mcp-screenshots-api)
5. [MCP Task Dispatch API](#5-mcp-task-dispatch-api)
6. [MCP Placeholder API](#6-mcp-placeholder-api)
7. [MCP Voice Subtitle API](#7-mcp-voice-subtitle-api)
8. [Octane Tasks API](#8-octane-tasks-api)
9. [Clipboard API](#9-clipboard-api)
10. [AppQyV1 Media Content API（公开只读）](#10-appqyv1-media-content-api公开只读)
11. [AppQyV1 Group Media Source API](#11-appqyv1-group-media-source-api)

---

## 1. System Information API

### 1.1 获取系统信息

**端点**: `GET /api_info`

**描述**: 获取完整的系统信息，包括服务器、PHP、Laravel、数据库等配置

**请求参数**: 无

**响应格式**:
```typescript
ApiResponse<SystemInfo>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "server": {
      "os": "Linux",
      "architecture": "x86_64",
      "hostname": "laravel-main",
      "server_software": "nginx/1.21.0",
      "server_protocol": "HTTP/1.1",
      "document_root": "/var/www/html/public"
    },
    "php": {
      "version": "8.2.0",
      "extensions": ["pdo", "mbstring", "openssl", "tokenizer", "xml", "ctype", "json", "bcmath"],
      "memory_limit": "256M",
      "max_execution_time": "60",
      "upload_max_filesize": "20M",
      "post_max_size": "20M",
      "display_errors": false,
      "error_reporting": "E_ALL",
      "timezone": "UTC"
    },
    "laravel": {
      "version": "11.0.0",
      "environment": "production",
      "debug_mode": false,
      "app_url": "http://localhost:8000",
      "app_name": "Laravel Main",
      "timezone": "UTC",
      "locale": "en",
      "fallback_locale": "en",
      "config_cached": true,
      "routes_cached": true,
      "events_cached": false,
      "views_cached": true
    },
    "database": {
      "default_connection": "mysql",
      "connections": [
        {
          "name": "mysql",
          "driver": "mysql",
          "host": "127.0.0.1",
          "port": 3306,
          "database": "laravel_db",
          "username": "root",
          "prefix": "",
          "charset": "utf8mb4",
          "collation": "utf8mb4_unicode_ci",
          "connected": true
        }
      ]
    },
    "cache": {
      "default_driver": "redis",
      "stores": [
        { "name": "redis", "driver": "redis", "connection": "cache", "available": true },
        { "name": "file", "driver": "file", "available": true }
      ]
    },
    "queue": {
      "default_connection": "redis",
      "connections": [
        { "name": "redis", "driver": "redis", "queue": "default", "retry_after": 90, "running": true }
      ]
    },
    "environment": {
      "app_env": "production",
      "app_debug": false,
      "app_key_set": true
    },
    "routes": [
      {
        "method": "GET",
        "uri": "/api_info",
        "name": null,
        "action": "App\\Http\\EnvironmentApiInfo\\ApiInfoIndex@index",
        "middleware": ["web"]
      }
    ],
    "timestamp": "2025-12-13T10:30:00Z"
  }
}
```

---

## 2. Translation API

### 2.1 翻译文本

**端点**: `POST /translation/translate`

**描述**: 翻译单个文本

**请求参数**:
```typescript
{
  text: string;              // 要翻译的文本
  source_language?: string;  // 源语言（可选，自动检测）
  target_language: string;   // 目标语言
  type?: TranslationType;    // 翻译类型（可选）
}
```

**请求示例**:
```json
{
  "text": "Hello, world!",
  "target_language": "zh",
  "type": "general"
}
```

**响应格式**:
```typescript
ApiResponse<TranslationResponse>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "original_text": "Hello, world!",
    "translated_text": "你好，世界！",
    "source_language": "en",
    "target_language": "zh",
    "detected_language": "en",
    "confidence": 0.99,
    "alternatives": ["您好，世界！", "哈喽，世界！"],
    "phonetic": "nǐ hǎo, shì jiè!",
    "provider": "google_translate"
  }
}
```

---

### 2.2 批量翻译

**端点**: `POST /translation/batch`

**描述**: 批量翻译多个文本

**请求参数**:
```typescript
{
  texts: string[];           // 要翻译的文本数组
  source_language?: string;  // 源语言
  target_language: string;   // 目标语言
  type?: TranslationType;    // 翻译类型
}
```

**请求示例**:
```json
{
  "texts": ["Hello", "Goodbye", "Thank you"],
  "target_language": "zh",
  "type": "general"
}
```

**响应格式**:
```typescript
ApiResponse<BatchTranslationResponse>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "translations": [
      {
        "original_text": "Hello",
        "translated_text": "你好",
        "source_language": "en",
        "target_language": "zh"
      },
      {
        "original_text": "Goodbye",
        "translated_text": "再见",
        "source_language": "en",
        "target_language": "zh"
      },
      {
        "original_text": "Thank you",
        "translated_text": "谢谢",
        "source_language": "en",
        "target_language": "zh"
      }
    ],
    "total_count": 3,
    "success_count": 3,
    "failed_count": 0
  }
}
```

---

### 2.3 检测并翻译

**端点**: `POST /translation/detect`

**描述**: 自动检测语言并翻译

**请求参数**:
```typescript
{
  text: string;             // 要翻译的文本
  target_language: string;  // 目标语言
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "detected_language": "en",
    "confidence": 0.98,
    "translation": {
      "original_text": "Hello",
      "translated_text": "你好",
      "source_language": "en",
      "target_language": "zh"
    }
  }
}
```

---

### 2.4 学习模式翻译

**端点**: `POST /translation/learning`

**描述**: 专门用于学习的翻译，包含音标、例句等

**请求参数**:
```typescript
{
  text: string;
  target_language: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "original_text": "apple",
    "translated_text": "苹果",
    "phonetic": "ˈæpl",
    "part_of_speech": "noun",
    "definition": "A round fruit with red, green, or yellow skin",
    "example_sentences": [
      "I eat an apple every day.",
      "The apple tree is in the garden."
    ],
    "synonyms": ["fruit"],
    "difficulty_level": "beginner"
  }
}
```

---

### 2.5 获取支持的语言

**端点**: `GET /translation/languages`

**描述**: 获取所有支持的语言列表

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    { "code": "en", "name": "English", "native_name": "English", "direction": "ltr" },
    { "code": "zh", "name": "Chinese", "native_name": "中文", "direction": "ltr" },
    { "code": "ja", "name": "Japanese", "native_name": "日本語", "direction": "ltr" },
    { "code": "ko", "name": "Korean", "native_name": "한국어", "direction": "ltr" },
    { "code": "fr", "name": "French", "native_name": "Français", "direction": "ltr" }
  ]
}
```

---

### 2.6 获取翻译模板

**端点**: `GET /translation/templates`

**描述**: 获取常用翻译模板

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "greetings",
      "name": "Greetings",
      "source_language": "en",
      "target_language": "zh",
      "phrases": [
        { "original": "Hello", "translated": "你好" },
        { "original": "Good morning", "translated": "早上好" },
        { "original": "Good night", "translated": "晚安" }
      ]
    }
  ]
}
```

---

## 3. TTS API

### 3.1 生成语音

**端点**: `POST /tts/generate`

**描述**: 将文本转换为语音

**请求参数**:
```typescript
{
  text: string;              // 要转换的文本
  language: string;          // 语言代码
  voice_type?: string;       // 语音类型（可选）
  speed?: number;            // 语速 0.5-2.0（可选）
  pitch?: number;            // 音调 0.5-2.0（可选）
  volume?: number;           // 音量 0.0-1.0（可选）
}
```

**请求示例**:
```json
{
  "text": "Hello, world!",
  "language": "en",
  "voice_type": "female",
  "speed": 1.0,
  "pitch": 1.0,
  "volume": 0.8
}
```

**响应格式**:
```typescript
ApiResponse<TTSGenerateResponse>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "audio_url": "/tts/audio/en/female/hello_world_abc123.mp3",
    "duration": 1.5,
    "format": "mp3",
    "file_size": 24576,
    "text": "Hello, world!",
    "language": "en",
    "voice_type": "female",
    "cache_hit": false
  }
}
```

---

### 3.2 批量生成语音

**端点**: `POST /tts/batch-generate`

**描述**: 批量生成多个语音文件

**请求参数**:
```typescript
{
  items: Array<{
    text: string;
    language: string;
    voice_type?: string;
  }>;
  speed?: number;  // 统一语速
}
```

**请求示例**:
```json
{
  "items": [
    { "text": "Hello", "language": "en" },
    { "text": "你好", "language": "zh" },
    { "text": "こんにちは", "language": "ja" }
  ],
  "speed": 1.0
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "audio_url": "/tts/audio/en/default/hello_abc123.mp3",
        "duration": 0.8,
        "format": "mp3",
        "text": "Hello",
        "language": "en"
      },
      {
        "audio_url": "/tts/audio/zh/default/nihao_def456.mp3",
        "duration": 0.9,
        "format": "mp3",
        "text": "你好",
        "language": "zh"
      }
    ],
    "total_count": 3,
    "success_count": 3,
    "failed_count": 0
  }
}
```

---

### 3.3 检查语音缓存

**端点**: `POST /tts/check`

**描述**: 检查文本是否已有缓存的语音

**请求参数**:
```typescript
{
  text: string;
  language: string;
  voice_type?: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "exists": true,
    "audio_url": "/tts/audio/en/female/hello_abc123.mp3",
    "duration": 1.5,
    "cached_at": "2025-12-13T10:00:00Z"
  }
}
```

---

### 3.4 获取可用语音列表

**端点**: `GET /tts/voices`

**描述**: 获取所有可用的语音配置

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "language": "en",
      "voice_type": "female",
      "name": "English Female",
      "gender": "female",
      "locale": "en-US",
      "sample_url": "/tts/audio/samples/en_female.mp3"
    },
    {
      "language": "en",
      "voice_type": "male",
      "name": "English Male",
      "gender": "male",
      "locale": "en-US",
      "sample_url": "/tts/audio/samples/en_male.mp3"
    }
  ]
}
```

---

### 3.5 获取缓存统计

**端点**: `GET /tts/cache/stats`

**描述**: 获取 TTS 缓存统计信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_files": 1542,
    "total_size": 52428800,
    "languages": [
      { "language": "en", "count": 832, "size": 28311552 },
      { "language": "zh", "count": 520, "size": 18874368 },
      { "language": "ja", "count": 190, "size": 5242880 }
    ],
    "oldest_file": "2025-11-01T00:00:00Z",
    "newest_file": "2025-12-13T10:30:00Z"
  }
}
```

---

### 3.6 清除缓存

**端点**: `POST /tts/cache/clear`

**描述**: 清除 TTS 缓存

**请求参数**:
```typescript
{
  language?: string;      // 指定语言（可选）
  older_than?: string;    // 清除早于此日期的缓存（ISO 8601）
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "data": {
    "deleted_files": 50,
    "freed_space": 2097152
  }
}
```

---

## 4. MCP Screenshots API

### 4.1 上传截图

**端点**: `POST /api/mcp/v1/screenshots/upload`

**描述**: 上传单个截图

**请求参数** (multipart/form-data):
```typescript
{
  image: File;              // 图片文件
  description?: string;     // 描述
  tags?: string[];          // 标签（JSON 字符串）
  metadata?: object;        // 元数据（JSON 字符串）
}
```

**响应格式**:
```typescript
ApiResponse<ScreenshotUploadResponse>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "screenshot": {
      "id": "scr_abc123xyz",
      "file_path": "/storage/screenshots/2025/12/screenshot_abc123.png",
      "original_name": "my_screenshot.png",
      "mime_type": "image/png",
      "description": "Dashboard screenshot",
      "created_at": "2025-12-13T10:30:00Z",
      "file_size": 524288,
      "width": 1920,
      "height": 1080,
      "thumbnail_url": "/storage/screenshots/thumbs/screenshot_abc123_thumb.png",
      "tags": ["dashboard", "ui"],
      "metadata": {
        "device": "Desktop",
        "browser": "Chrome",
        "viewport": { "width": 1920, "height": 1080 }
      }
    },
    "message": "Screenshot uploaded successfully"
  }
}
```

---

### 4.2 批量上传截图

**端点**: `POST /api/mcp/v1/screenshots/upload-batch`

**描述**: 批量上传多个截图

**请求参数** (multipart/form-data):
```typescript
{
  images: File[];  // 多个图片文件
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "screenshots": [
      { "id": "scr_1", "original_name": "screenshot1.png", "created_at": "2025-12-13T10:30:00Z" },
      { "id": "scr_2", "original_name": "screenshot2.png", "created_at": "2025-12-13T10:30:01Z" }
    ],
    "total_count": 2,
    "success_count": 2,
    "failed_count": 0,
    "errors": []
  }
}
```

---

### 4.3 上传并合并截图

**端点**: `POST /api/mcp/v1/screenshots/upload-merge`

**描述**: 上传多个截图并合并为一张

**请求参数**:
```typescript
{
  images: File[];           // 要合并的图片
  direction?: 'vertical' | 'horizontal';  // 合并方向
  spacing?: number;         // 图片间距（像素）
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "screenshot": {
      "id": "scr_merged_xyz",
      "file_path": "/storage/screenshots/merged_abc123.png",
      "original_name": "merged_screenshot.png",
      "width": 1920,
      "height": 3240,
      "file_size": 1048576,
      "created_at": "2025-12-13T10:30:00Z"
    }
  }
}
```

---

### 4.4 获取最新截图

**端点**: `GET /api/mcp/v1/screenshots/latest`

**描述**: 获取最新上传的截图

**请求参数**:
```typescript
{
  limit?: number;  // 数量限制（默认 10）
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "scr_latest",
    "file_path": "/storage/screenshots/latest.png",
    "original_name": "screenshot.png",
    "created_at": "2025-12-13T10:30:00Z",
    "thumbnail_url": "/storage/screenshots/thumbs/latest_thumb.png"
  }
}
```

---

### 4.5 搜索截图

**端点**: `GET /api/mcp/v1/screenshots/search`

**描述**: 搜索截图

**请求参数**:
```typescript
{
  keyword?: string;     // 关键词
  tags?: string[];      // 标签
  start_date?: string;  // 开始日期
  end_date?: string;    // 结束日期
  limit?: number;       // 数量限制
  offset?: number;      // 偏移量
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "screenshots": [
      {
        "id": "scr_1",
        "original_name": "dashboard.png",
        "description": "Dashboard screenshot",
        "created_at": "2025-12-13T10:00:00Z",
        "tags": ["dashboard", "ui"]
      }
    ],
    "total_count": 1,
    "page": 1,
    "per_page": 20,
    "has_more": false
  }
}
```

---

### 4.6 获取所有截图

**端点**: `GET /api/mcp/v1/screenshots/`

**描述**: 获取所有截图列表

**请求参数**:
```typescript
{
  page?: number;       // 页码
  per_page?: number;   // 每页数量
}
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "scr_1",
      "original_name": "screenshot1.png",
      "thumbnail_url": "/storage/screenshots/thumbs/screenshot1_thumb.png",
      "created_at": "2025-12-13T10:00:00Z",
      "file_size": 524288
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total_pages": 5,
    "total_items": 95,
    "has_next": true,
    "has_prev": false
  }
}
```

---

### 4.7 获取截图详情

**端点**: `GET /api/mcp/v1/screenshots/{id}`

**描述**: 获取指定截图的详细信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "scr_abc123",
    "file_path": "/storage/screenshots/screenshot_abc123.png",
    "original_name": "my_screenshot.png",
    "mime_type": "image/png",
    "description": "Dashboard screenshot",
    "created_at": "2025-12-13T10:30:00Z",
    "file_size": 524288,
    "width": 1920,
    "height": 1080,
    "tags": ["dashboard", "ui"],
    "metadata": {
      "device": "Desktop",
      "browser": "Chrome"
    }
  }
}
```

---

### 4.8 流式获取截图文件

**端点**: `GET /api/mcp/v1/screenshots/{id}/file`

**描述**: 直接获取截图文件（流式传输）

**响应**: 图片文件流

---

### 4.9 删除截图

**端点**: `DELETE /api/mcp/v1/screenshots/{id}`

**描述**: 删除指定截图

**响应示例**:
```json
{
  "success": true,
  "message": "Screenshot deleted successfully"
}
```

---

### 4.10 获取截图统计

**端点**: `GET /api/mcp/v1/screenshots/stats`

**描述**: 获取截图统计信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_count": 432,
    "total_size": 157286400,
    "today_count": 12,
    "week_count": 58,
    "month_count": 189,
    "by_mime_type": [
      { "mime_type": "image/png", "count": 320 },
      { "mime_type": "image/jpeg", "count": 112 }
    ],
    "recent_uploads": [
      {
        "id": "scr_latest1",
        "original_name": "screenshot1.png",
        "created_at": "2025-12-13T10:30:00Z"
      }
    ]
  }
}
```

---

### 4.11 清除所有截图

**端点**: `DELETE /api/mcp/v1/screenshots/clear-all/confirm`

**描述**: 删除所有截图（危险操作）

**请求参数**:
```typescript
{
  confirm: boolean;  // 必须为 true
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "All screenshots cleared",
  "data": {
    "deleted_count": 432,
    "freed_space": 157286400
  }
}
```

---

## 5. MCP Task Dispatch API

### 5.1 获取任务类别

**端点**: `GET /api/mcp/v1/task-dispatch/categories`

**描述**: 获取所有任务类别

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cat_translation",
      "name": "Translation Tasks",
      "description": "Tasks for translation processing",
      "icon": "translate",
      "color": "#3b82f6",
      "file_count": 45,
      "created_at": "2025-12-01T00:00:00Z"
    },
    {
      "id": "cat_coding",
      "name": "Coding Tasks",
      "description": "Programming and development tasks",
      "icon": "code",
      "color": "#10b981",
      "file_count": 23,
      "created_at": "2025-12-01T00:00:00Z"
    }
  ]
}
```

---

### 5.2 创建任务类别

**端点**: `POST /api/mcp/v1/task-dispatch/categories`

**描述**: 创建新的任务类别

**请求参数**:
```typescript
{
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "cat_new_category",
    "name": "New Category",
    "description": "Description here",
    "created_at": "2025-12-13T10:30:00Z"
  }
}
```

---

### 5.3 获取类别文件

**端点**: `GET /api/mcp/v1/task-dispatch/categories/{categoryId}/files`

**描述**: 获取指定类别下的所有文件

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "file_path": "/tasks/translation/task_001.md",
      "file_name": "task_001.md",
      "file_size": 2048,
      "created_at": "2025-12-13T10:00:00Z"
    }
  ]
}
```

---

### 5.4 添加任务到队列

**端点**: `POST /api/mcp/v1/task-dispatch/queue/add-file`

**描述**: 添加新任务到队列

**请求参数**:
```typescript
{
  category_id: string;
  content: string;
  file_name?: string;
  priority?: number;
  metadata?: object;
}
```

**请求示例**:
```json
{
  "category_id": "cat_translation",
  "content": "Translate this text to Chinese",
  "file_name": "task_translate_001.md",
  "priority": 1,
  "metadata": {
    "source_lang": "en",
    "target_lang": "zh"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "task_xyz123",
    "category_id": "cat_translation",
    "file_path": "/tasks/translation/task_translate_001.md",
    "status": "pending",
    "created_at": "2025-12-13T10:30:00Z"
  }
}
```

---

### 5.5 获取队列任务

**端点**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks`

**描述**: 获取指定类别的任务队列

**请求参数**:
```typescript
{
  status?: TaskStatus;  // 过滤状态
  limit?: number;
  offset?: number;
}
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "task_1",
      "category_id": "cat_translation",
      "file_path": "/tasks/translation/task_001.md",
      "original_name": "task_001.md",
      "status": "pending",
      "priority": 1,
      "created_at": "2025-12-13T10:00:00Z",
      "metadata": {
        "source_lang": "en",
        "target_lang": "zh"
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total_items": 45,
    "has_more": true
  }
}
```

---

### 5.6 获取最后一个任务

**端点**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/last-task`

**描述**: 获取指定类别的最后一个任务

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "task_latest",
    "category_id": "cat_translation",
    "file_path": "/tasks/translation/task_latest.md",
    "status": "completed",
    "created_at": "2025-12-13T10:25:00Z",
    "completed_at": "2025-12-13T10:30:00Z"
  }
}
```

---

### 5.7 检查是否有最新任务

**端点**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/has-latest`

**描述**: 检查是否有新的任务

**响应示例**:
```json
{
  "success": true,
  "data": {
    "has_latest": true,
    "latest_task_id": "task_xyz",
    "created_at": "2025-12-13T10:30:00Z"
  }
}
```

---

### 5.8 搜索任务

**端点**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/search`

**描述**: 搜索任务

**请求参数**:
```typescript
{
  keyword?: string;
  status?: TaskStatus;
  start_date?: string;
  end_date?: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task_1",
        "file_path": "/tasks/translation/task_001.md",
        "status": "pending",
        "created_at": "2025-12-13T10:00:00Z"
      }
    ],
    "total_count": 1
  }
}
```

---

### 5.9 更新任务状态

**端点**: `PUT /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks/{taskId}/status`

**描述**: 更新任务状态

**请求参数**:
```typescript
{
  status: TaskStatus;
}
```

**请求示例**:
```json
{
  "status": "completed"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Task status updated",
  "data": {
    "id": "task_xyz",
    "status": "completed",
    "updated_at": "2025-12-13T10:30:00Z"
  }
}
```

---

### 5.10 获取队列统计

**端点**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/stats`

**描述**: 获取队列统计信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "category_id": "cat_translation",
    "total_tasks": 100,
    "pending_tasks": 25,
    "processing_tasks": 5,
    "completed_tasks": 68,
    "failed_tasks": 2,
    "average_completion_time": 120,
    "oldest_pending_task": {
      "id": "task_old",
      "created_at": "2025-12-10T08:00:00Z"
    }
  }
}
```

---

### 5.11 获取所有提示词映射

**端点**: `GET /api/mcp/v1/task-dispatch/mappings`

**描述**: 获取所有任务类别的提示词映射

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "category_id": "cat_translation",
      "prompt_file_path": "/prompts/translation_prompt.md",
      "prompt_content": "You are a professional translator...",
      "variables": [
        { "name": "source_lang", "description": "Source language" },
        { "name": "target_lang", "description": "Target language" }
      ],
      "created_at": "2025-12-01T00:00:00Z",
      "updated_at": "2025-12-13T10:00:00Z"
    }
  ]
}
```

---

### 5.12 获取类别提示词映射

**端点**: `GET /api/mcp/v1/task-dispatch/mappings/{categoryId}`

**描述**: 获取指定类别的提示词映射

**响应示例**:
```json
{
  "success": true,
  "data": {
    "category_id": "cat_translation",
    "prompt_file_path": "/prompts/translation_prompt.md",
    "prompt_content": "You are a professional translator...",
    "variables": [
      { "name": "source_lang" },
      { "name": "target_lang" }
    ]
  }
}
```

---

### 5.13 更新提示词映射

**端点**: `PUT /api/mcp/v1/task-dispatch/mappings/{categoryId}`

**描述**: 更新类别的提示词映射

**请求参数**:
```typescript
{
  prompt_file_path: string;
  prompt_content?: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Prompt mapping updated",
  "data": {
    "category_id": "cat_translation",
    "prompt_file_path": "/prompts/new_prompt.md",
    "updated_at": "2025-12-13T10:30:00Z"
  }
}
```

---

### 5.14 重置提示词映射

**端点**: `POST /api/mcp/v1/task-dispatch/mappings/{categoryId}/reset`

**描述**: 重置为默认提示词

**响应示例**:
```json
{
  "success": true,
  "message": "Prompt mapping reset to default"
}
```

---

### 5.15 删除提示词映射

**端点**: `DELETE /api/mcp/v1/task-dispatch/mappings/{categoryId}`

**描述**: 删除提示词映射

**响应示例**:
```json
{
  "success": true,
  "message": "Prompt mapping deleted"
}
```

---

## 6. MCP Placeholder API

### 6.1 生成占位图

**端点**: `POST /api/mcp/v1/placeholders/generate`

**描述**: 生成占位图

**请求参数**:
```typescript
{
  width: number;
  height: number;
  text?: string;
  bg_color?: string;    // hex color
  text_color?: string;  // hex color
  format?: 'png' | 'jpg' | 'svg' | 'webp';
  mode?: 'simple' | 'real';
}
```

**请求示例**:
```json
{
  "width": 800,
  "height": 600,
  "text": "Placeholder Image",
  "bg_color": "#cccccc",
  "text_color": "#333333",
  "format": "png",
  "mode": "simple"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "uuid": "placeholder_abc123",
    "url": "/api/mcp/v1/placeholders/placeholder_abc123.png",
    "download_url": "/api/mcp/v1/placeholders/placeholder_abc123/download",
    "width": 800,
    "height": 600,
    "format": "png",
    "file_size": 10240,
    "text": "Placeholder Image",
    "created_at": "2025-12-13T10:30:00Z",
    "expires_at": "2025-12-20T10:30:00Z"
  }
}
```

---

### 6.2 获取占位图列表

**端点**: `GET /api/mcp/v1/placeholders/`

**描述**: 获取所有占位图

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "uuid": "placeholder_1",
      "width": 800,
      "height": 600,
      "text": "Placeholder Image",
      "format": "png",
      "file_size": 10240,
      "file_path": "/storage/placeholders/placeholder_1.png",
      "created_at": "2025-12-13T10:00:00Z"
    }
  ]
}
```

---

### 6.3 获取占位图统计

**端点**: `GET /api/mcp/v1/placeholders/stats`

**描述**: 获取占位图统计

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_count": 85,
    "total_size": 5242880,
    "by_format": [
      { "format": "png", "count": 50, "size": 3145728 },
      { "format": "jpg", "count": 35, "size": 2097152 }
    ],
    "by_dimensions": [
      { "dimensions": "800x600", "count": 30 },
      { "dimensions": "1920x1080", "count": 25 }
    ]
  }
}
```

---

### 6.4 清理占位图

**端点**: `POST /api/mcp/v1/placeholders/cleanup`

**描述**: 清理过期的占位图

**请求参数**:
```typescript
{
  older_than?: string;  // ISO 8601 date
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "deleted_count": 15,
    "freed_space": 1048576,
    "oldest_kept": "2025-12-13T00:00:00Z"
  }
}
```

---

### 6.5 下载占位图

**端点**: `GET /api/mcp/v1/placeholders/{uuid}/download`

**描述**: 下载指定占位图

**响应**: 文件流

---

### 6.6 删除占位图

**端点**: `DELETE /api/mcp/v1/placeholders/{uuid}`

**描述**: 删除指定占位图

**响应示例**:
```json
{
  "success": true,
  "message": "Placeholder deleted successfully"
}
```

---

## 7. MCP Voice Subtitle API

### 7.1 添加到语音队列

**端点**: `POST /api/mcp/v1/voice-subtitle/add`

**描述**: 添加项目到语音播放队列

**请求参数**:
```typescript
{
  type: 'text' | 'url' | 'voice';
  content: string;
  language?: string;
  auto_play?: boolean;
}
```

**请求示例**:
```json
{
  "type": "text",
  "content": "Hello, world! This is a test.",
  "language": "en",
  "auto_play": true
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "voice_queue_123",
    "type": "text",
    "content": "Hello, world! This is a test.",
    "language": "en",
    "status": "queued",
    "created_at": "2025-12-13T10:30:00Z"
  }
}
```

---

### 7.2 获取语音队列

**端点**: `GET /api/mcp/v1/voice-subtitle/queue`

**描述**: 获取当前语音队列

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "voice_1",
      "type": "text",
      "content": "First item",
      "language": "en",
      "status": "playing",
      "audio_url": "/tts/audio/en/default/first_abc123.mp3",
      "duration": 3.5,
      "created_at": "2025-12-13T10:30:00Z"
    },
    {
      "id": "voice_2",
      "type": "text",
      "content": "Second item",
      "language": "en",
      "status": "queued",
      "created_at": "2025-12-13T10:30:05Z"
    }
  ]
}
```

---

### 7.3 获取当前播放

**端点**: `GET /api/mcp/v1/voice-subtitle/current`

**描述**: 获取当前正在播放的语音项

**响应示例**:
```json
{
  "success": true,
  "data": {
    "queue_item": {
      "id": "voice_1",
      "type": "text",
      "content": "Hello, world!",
      "language": "en",
      "status": "playing",
      "audio_url": "/tts/audio/en/default/hello_abc123.mp3",
      "subtitle_segments": [
        {
          "id": "seg_1",
          "start_time": 0,
          "end_time": 1.2,
          "text": "Hello,",
          "translation": "你好，",
          "active": true
        },
        {
          "id": "seg_2",
          "start_time": 1.2,
          "end_time": 2.5,
          "text": "world!",
          "translation": "世界！",
          "active": false
        }
      ],
      "duration": 2.5
    },
    "current_time": 0.8,
    "total_duration": 2.5,
    "is_playing": true,
    "current_segment": {
      "id": "seg_1",
      "text": "Hello,",
      "translation": "你好，"
    }
  }
}
```

---

### 7.4 播放下一个

**端点**: `POST /api/mcp/v1/voice-subtitle/next`

**描述**: 跳到下一个语音项

**响应示例**:
```json
{
  "success": true,
  "message": "Playing next item",
  "data": {
    "id": "voice_2",
    "status": "playing"
  }
}
```

---

### 7.5 播放上一个

**端点**: `POST /api/mcp/v1/voice-subtitle/previous`

**描述**: 跳到上一个语音项

**响应示例**:
```json
{
  "success": true,
  "message": "Playing previous item",
  "data": {
    "id": "voice_0",
    "status": "playing"
  }
}
```

---

## 8. Octane Tasks API

### 8.1 获取所有任务状态

**端点**: `GET /octane-tasks/status`

**描述**: 获取 Octane 所有任务的状态

**响应示例**:
```json
{
  "success": true,
  "data": {
    "timer_enabled": true,
    "timer_running": true,
    "total_tasks": 8,
    "running_tasks": 2,
    "completed_tasks": 450,
    "failed_tasks": 3,
    "total_ticks": 12548,
    "uptime": 86400,
    "last_tick_at": "2025-12-13T10:30:00Z",
    "next_tick_at": "2025-12-13T10:31:00Z"
  }
}
```

---

### 8.2 获取任务详情

**端点**: `GET /octane-tasks/task/{taskName}`

**描述**: 获取指定任务的详细信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "name": "CleanupTempFiles",
    "class": "App\\Tasks\\CleanupTempFiles",
    "status": "idle",
    "schedule": "*/5 * * * *",
    "last_run_at": "2025-12-13T10:25:00Z",
    "next_run_at": "2025-12-13T10:30:00Z",
    "run_count": 288,
    "success_count": 285,
    "failure_count": 3,
    "average_duration": 1200,
    "last_duration": 1150,
    "last_error": null,
    "enabled": true,
    "metadata": {
      "description": "Clean up temporary files older than 24 hours",
      "priority": 1,
      "timeout": 60,
      "retry_on_failure": true,
      "max_retries": 3
    }
  }
}
```

---

### 8.3 获取基础对象

**端点**: `GET /octane-tasks/basic`

**描述**: 获取 Octane 基础对象信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "workers": 4,
    "max_requests": 1000,
    "memory_limit": "256M",
    "task_instances": [
      { "name": "CleanupTempFiles", "initialized": true, "class": "App\\Tasks\\CleanupTempFiles" },
      { "name": "ProcessQueue", "initialized": true, "class": "App\\Tasks\\ProcessQueue" }
    ]
  }
}
```

---

### 8.4 验证初始化

**端点**: `GET /octane-tasks/verify`

**描述**: 验证 Octane 任务系统初始化状态

**响应示例**:
```json
{
  "success": true,
  "data": {
    "initialized": true,
    "timer_registered": true,
    "tasks_loaded": 8,
    "errors": [],
    "warnings": [
      "Task 'OldTask' has not run in 24 hours"
    ]
  }
}
```

---

## 9. Clipboard API

### 9.1 获取或创建 Namespace

**端点**: `GET /clipboard/namespace`

**描述**: 获取现有 namespace 或创建新的

**响应示例**:
```json
{
  "success": true,
  "data": {
    "namespace": "clip_abc123xyz",
    "created_at": "2025-12-13T10:30:00Z",
    "expires_at": "2025-12-20T10:30:00Z"
  }
}
```

---

### 9.2 保存文本

**端点**: `POST /clipboard/text`

**描述**: 保存文本到剪贴板

**请求参数**:
```typescript
{
  namespace: string;
  text: string;
}
```

**请求示例**:
```json
{
  "namespace": "clip_abc123xyz",
  "text": "Hello, this is clipboard content!"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Text saved to clipboard"
}
```

---

### 9.3 获取剪贴板数据

**端点**: `GET /clipboard/data`

**描述**: 获取剪贴板数据

**请求参数**:
```typescript
{
  namespace: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "text": "Hello, this is clipboard content!",
    "files": [
      {
        "id": "file_1",
        "original_name": "document.pdf",
        "size": 524288,
        "mime_type": "application/pdf",
        "file_path": "/storage/clipboard/clip_abc123xyz/document.pdf",
        "uploaded_at": "2025-12-13T10:20:00Z",
        "download_url": "/clipboard/download?namespace=clip_abc123xyz&file=file_1"
      }
    ],
    "updated_at": "2025-12-13T10:30:00Z",
    "namespace": "clip_abc123xyz",
    "file_count": 1,
    "total_size": 524288,
    "history": [
      {
        "id": "history_1",
        "timestamp": "2025-12-13T10:25:00Z",
        "text": "Previous clipboard content",
        "file_count": 0
      }
    ]
  }
}
```

---

### 9.4 上传文件

**端点**: `POST /clipboard/upload`

**描述**: 上传文件到剪贴板

**请求参数** (multipart/form-data):
```typescript
{
  namespace: string;
  files: File[];
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "files": [
      {
        "id": "file_1",
        "original_name": "document.pdf",
        "size": 524288,
        "mime_type": "application/pdf",
        "uploaded_at": "2025-12-13T10:30:00Z",
        "download_url": "/clipboard/download?file=file_1"
      }
    ],
    "message": "Files uploaded successfully"
  }
}
```

---

### 9.5 下载文件

**端点**: `GET /clipboard/download`

**描述**: 下载剪贴板文件

**请求参数**:
```typescript
{
  namespace: string;
  file: string;  // file ID
}
```

**响应**: 文件流

---

### 9.6 删除文件

**端点**: `POST /clipboard/delete-file`

**描述**: 删除剪贴板中的文件

**请求参数**:
```typescript
{
  namespace: string;
  file_id: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

### 9.7 创建新剪贴板

**端点**: `POST /clipboard/new`

**描述**: 创建新的剪贴板 namespace

**响应示例**:
```json
{
  "success": true,
  "data": {
    "namespace": "clip_new_xyz789",
    "created_at": "2025-12-13T10:30:00Z"
  }
}
```

---

### 9.8 恢复历史

**端点**: `POST /clipboard/restore`

**描述**: 恢复历史记录

**请求参数**:
```typescript
{
  namespace: string;
  history_id: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "History restored successfully",
  "data": {
    "text": "Restored clipboard content",
    "file_count": 0
  }
}
```

---

## 10. AppQyV1 Media Content API（公开只读）

> **新增于 2026-06-12。** 以下端点**无需认证**（公开只读），用于匿名浏览已同步的媒体内容（书籍 / 字幕）。列表与内容端点**永不返回 `full_content`**。

### 10.1 获取书籍列表

**端点**: `GET /api/app_qy_v1/media/books`

**描述**: 分页获取已同步的书籍列表（可按语言过滤）

**请求参数**:
```typescript
{
  language?: string;  // 语言过滤（可选）
  start?: number;     // 偏移量（默认 0）
  limit?: number;     // 每页数量（默认 50，上限 200）
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 12,
    "start": 0,
    "limit": 50,
    "books": [
      {
        "id": 1,
        "source_key": "alice_in_wonderland",
        "title": "Alice in Wonderland",
        "language": "en",
        "sentence_count": 1432,
        "has_audio": true,
        "synced_at": "2026-06-12T10:00:00Z"
      }
    ]
  }
}
```

---

### 10.2 获取字幕列表

**端点**: `GET /api/app_qy_v1/media/subtitles`

**描述**: 分页获取已同步的字幕列表（可按语言过滤）

**请求参数**: 同 10.1（`language` / `start` / `limit`）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 5,
    "start": 0,
    "limit": 50,
    "subtitles": [
      {
        "id": 3,
        "source_key": "movie_abc",
        "title": "Movie ABC",
        "language": "en",
        "duration_sec": 5400,
        "sentence_count": 980,
        "segment_count": 45,
        "synced_at": "2026-06-12T10:00:00Z"
      }
    ]
  }
}
```

---

### 10.3 获取媒体内容（句子）

**端点**: `GET /api/app_qy_v1/media/content/{type}/{id}`

**描述**: 分页获取某个书籍 / 字幕的句子内容。句子经共享句库解析，优先粒度 `sentence`，为空时回退 `cue`（响应中带 `grain` 字段）

> **v2 书籍注意**：书籍来源的句子在库中为**去标点**形式，故 `type=book` 返回的 `text` 为去标点文本，`audio` 初始为空（pycore 后续回填）。带标点原文重建依赖 `book.sentence_seq` + 标点标识库；当前控制器尚未做重建。详见 `pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md` §8.4/§8.12。

**路径参数**: `type` 为 `book` 或 `subtitle`；`id` 为数字主键

**请求参数**:
```typescript
{
  start?: number;  // 偏移量（默认 0）
  limit?: number;  // 每页数量（默认 50，上限 200）
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "info": {
      "id": 1,
      "source_key": "alice_in_wonderland",
      "title": "Alice in Wonderland",
      "language": "en",
      "sentence_count": 1432,
      "has_audio": true,
      "synced_at": "2026-06-12T10:00:00Z"
    },
    "total_sentences": 1432,
    "start": 0,
    "limit": 50,
    "grain": "sentence",
    "sentences": [
      {
        "seq": 0,
        "text": "Alice was beginning to get very tired.",
        "audio": "/static/media/alice/sentences/0.mp3",
        "explanation": null,
        "start_sec": null,
        "end_sec": null
      }
    ]
  }
}
```

---

### 10.4 获取词库推荐（已改为公开）

**端点**: `GET /api/app_qy_v1/learning/recommendations`

**描述**: 获取推荐词库集合。**2026-06-12 起为公开端点**（移出 `auth:sanctum`）：匿名访问返回 `is_selected=false`；携带 Bearer token 时返回真实选中状态。`/learning/collections/select` 与 `/learning/collections/selected` 仍需认证。

---

## 11. AppQyV1 Group Media Source API

> **新增于 2026-06-12。** 把已同步的媒体来源（书籍 / 字幕）挂载到词组（word group）。需要认证（`custom.authenticate`）。关联表 `app_qy_v1_group_media_sources`（模型 `AppQyV1GroupMediaSourceModel`）。

### 11.1 挂载媒体来源到词组

**端点**: `POST /api/app_qy_v1/group/add_media_source`

**描述**: 从来源全部句子中抽词（`StrTool::extractWords`），以 fill-missing 方式合并进词组的 `gwords` 与 `words_frequency`（已有词频不覆盖），并记录关联。**幂等**：已挂载的来源再次提交返回成功且 `words_added=0`

**请求参数**:
```typescript
{
  gid: string;                          // 词组 gid
  source_type: 'book' | 'subtitle';     // 来源类型
  source_key: string;                   // 来源 key（books/subtitles.source_key）
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "gid": "g_abc123",
    "source_type": "book",
    "source_key": "alice_in_wonderland",
    "words_added": 256,
    "total_words": 1820
  },
  "message": "Media source added to group successfully"
}
```

---

### 11.2 移除词组的媒体来源

**端点**: `POST /api/app_qy_v1/group/remove_media_source`

**描述**: 只删除关联记录——**已并入词组的单词保留**（语义同 `/group/remove_library`）

**请求参数**: 同 11.1（`gid` / `source_type` / `source_key`）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "gid": "g_abc123",
    "source_type": "book",
    "source_key": "alice_in_wonderland"
  },
  "message": "Media source removed from group successfully"
}
```

---

### 11.3 获取词组全部来源（统一视图）

**端点**: `POST /api/app_qy_v1/group/get_sources`

**描述**: 一次返回词组挂载的词库（libraries，条目形同 `/group/get_libraries`）与媒体来源（media_sources）

**请求参数**:
```typescript
{
  gid: string;
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "gid": "g_abc123",
    "gname": "English Reading",
    "libraries_count": 1,
    "libraries": [
      { "id": 2, "name": "CET-6", "language": "en", "total_words": 5500, "added_at": "2026-06-10T08:00:00Z" }
    ],
    "media_sources_count": 1,
    "media_sources": [
      {
        "source_type": "book",
        "source_key": "alice_in_wonderland",
        "title": "Alice in Wonderland",
        "language": "en",
        "words_added": 256,
        "added_at": "2026-06-12T10:30:00Z"
      }
    ]
  },
  "message": "Group sources retrieved successfully"
}
```

---

## 总结

本文档详细定义了 **60+ API 端点**，涵盖：

- ✅ System Information (1 个端点)
- ✅ Translation (6 个端点)
- ✅ TTS (6 个端点)
- ✅ MCP Screenshots (11 个端点)
- ✅ MCP Task Dispatch (15 个端点)
- ✅ MCP Placeholder (6 个端点)
- ✅ MCP Voice Subtitle (5 个端点)
- ✅ Octane Tasks (4 个端点)
- ✅ Clipboard (8 个端点)
- ✅ AppQyV1 Media Content 公开只读 (4 个端点，2026-06-12 新增)
- ✅ AppQyV1 Group Media Source (3 个端点，2026-06-12 新增)

所有端点都包含完整的请求/响应格式和示例。

**下一步**: 查看 UI 组件和页面元素文档。
