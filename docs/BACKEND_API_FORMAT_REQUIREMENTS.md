# 后端 API 数据格式修改需求文档

## 📋 问题概述

**远程服务器** (`http://192.168.50.2:9000`) 返回的数据格式与前端期望不一致,导致队列显示 `undefined`。

**症状**:
```
Index    Text         Category    Play Count    Created
1        undefined    normal      0             2025/11/29 00:57:41
2        undefined    normal      1             2025/11/29 09:00:26
```

---

## 🔍 数据格式对比

### ✅ 本地服务器 (正确格式) - localhost:59000

#### GET /voice-subtitle/queue

```json
{
  "success": true,
  "queue": [
    {
      "text": "Hello, this is a test",
      "audio_path": "D:\\www\\cache\\voice_subtitle_tts\\f16eae25fd6e74e35b1de836c9037012.mp3",
      "play_count": 113,
      "category": "normal",
      "created_at": "2025-11-28T21:38:29.036518"
    }
  ],
  "current_index": 0
}
```

**前端期望的字段**:
- ✅ `text` - 字幕文本 (string)
- ✅ `audio_path` - 音频文件路径 (string)
- ✅ `category` - 分类 (string)
- ✅ `play_count` - 播放次数 (number)
- ✅ `created_at` - 创建时间 (string)

---

### ❌ 远程服务器 (当前格式) - 192.168.50.2:9000

#### GET /api/mcp/v1/voice-subtitle/queue

```json
{
  "success": true,
  "queue": [
    {
      "type": "text",
      "original_text": "Test audio URL",
      "translated_text": "Test audio URL",
      "language": "en",
      "voice": "en-US-AriaNeural",
      "paragraphs": ["Test audio URL"],
      "tts_files": [
        {
          "id": 3,
          "text": "Test audio URL",
          "file_path": "cache/tts/440241dfab3f5d2f280713bf42755d55_en_en-US-AriaNeural.mp3",
          "audio_url": "/api/mcp/v1/voice-subtitle/audio/440241dfab3f5d2f280713bf42755d55_en_en-US-AriaNeural.mp3",
          "file_size": 14976,
          "language": "en",
          "voice": "en-US-AriaNeural",
          "cached": true
        }
      ],
      "created_at": "2025-11-29 00:57:41"
    }
  ]
}
```

**问题字段映射**:
- ❌ **缺失** `text` → 有 `original_text` / `translated_text`
- ❌ **缺失** `audio_path` → 有 `tts_files[0].file_path`
- ❌ **缺失** `category` → 有 `type`
- ❌ **缺失** `play_count` → 完全没有这个字段

---

## 🎯 后端需要修改的内容

### 方案选择

**推荐方案**: 添加前端需要的字段,同时保留现有字段(向后兼容)

### 修改 1: GET /api/mcp/v1/voice-subtitle/queue

**修改前**:
```json
{
  "queue": [{
    "type": "text",
    "original_text": "...",
    "translated_text": "...",
    "tts_files": [{"file_path": "..."}],
    "created_at": "..."
  }]
}
```

**修改后**:
```json
{
  "queue": [{
    "text": "...",              // ← 新增: translated_text 或 original_text
    "audio_path": "...",        // ← 新增: tts_files[0].file_path
    "category": "normal",       // ← 新增: type 字段
    "play_count": 0,            // ← 新增: 播放次数(如果后端有统计)
    "created_at": "...",        // ← 保持原样

    // 保留原有字段(向后兼容)
    "type": "text",
    "original_text": "...",
    "translated_text": "...",
    "tts_files": [...]
  }]
}
```

**Python 伪代码示例**:
```python
@router.get("/queue")
async def get_queue():
    items = get_queue_from_db()

    formatted_items = []
    for item in items:
        formatted_item = {
            # 新增的前端需要字段
            "text": item.translated_text or item.original_text or "",
            "audio_path": item.tts_files[0].file_path if item.tts_files else "",
            "category": item.type or "normal",
            "play_count": item.play_count if hasattr(item, 'play_count') else 0,
            "created_at": item.created_at,

            # 保留原有字段
            "type": item.type,
            "original_text": item.original_text,
            "translated_text": item.translated_text,
            "language": item.language,
            "voice": item.voice,
            "paragraphs": item.paragraphs,
            "tts_files": item.tts_files
        }
        formatted_items.append(formatted_item)

    return {
        "success": True,
        "queue": formatted_items,
        "current_index": get_current_index()  # 如果后端有这个功能
    }
```

---

### 修改 2: GET /api/mcp/v1/voice-subtitle/categories

#### 当前格式 (需要确认)

```bash
curl "http://192.168.50.2:9000/api/mcp/v1/voice-subtitle/categories"
```

**预期返回** (与本地一致):
```json
{
  "success": true,
  "categories": ["normal", "screenshot", "image"]
}
```

**说明**: 如果远程返回格式已经和本地一致,则无需修改。

---

### 修改 3: GET /api/mcp/v1/voice-subtitle/queue/filter-by-category

#### 修改要求

与 `/queue` 相同,返回的 `items` 数组中的每个对象都需要包含:
- `text`
- `audio_path`
- `category`
- `play_count`
- `created_at`

**修改前**:
```json
{
  "success": true,
  "category": "normal",
  "items": [
    {
      "original_text": "...",
      "tts_files": [...]
    }
  ]
}
```

**修改后**:
```json
{
  "success": true,
  "category": "normal",
  "items": [
    {
      "text": "...",
      "audio_path": "...",
      "category": "normal",
      "play_count": 0,
      "created_at": "...",

      // 保留原有字段
      "original_text": "...",
      "translated_text": "...",
      "tts_files": [...]
    }
  ],
  "count": 1
}
```

---

### 修改 4: GET /api/mcp/v1/voice-subtitle/queue/filter-by-today

同样需要添加前端字段到 `items` 数组。

---

### 修改 5: GET /api/mcp/v1/voice-subtitle/queue/latest

同样需要添加前端字段到 `items` 数组。

---

## 📊 字段映射表

| 前端期望字段 | 远程当前字段 | 映射逻辑 | 是否必须 |
|-------------|-------------|---------|---------|
| `text` | `translated_text` / `original_text` | `translated_text \|\| original_text \|\| ""` | ✅ 必须 |
| `audio_path` | `tts_files[0].file_path` | `tts_files[0].file_path if tts_files else ""` | ✅ 必须 |
| `category` | `type` | `type \|\| "normal"` | ✅ 必须 |
| `play_count` | ❌ 无 | `0` 或 后端统计值 | ✅ 必须 |
| `created_at` | `created_at` | 保持不变 | ✅ 必须 |

---

## 🧪 测试验证

### 测试步骤

1. **修改后端代码**
2. **重启后端服务**
3. **测试 API 返回**:

```bash
# 测试队列API
curl "http://192.168.50.2:9000/api/mcp/v1/voice-subtitle/queue" | python -m json.tool

# 验证必须字段存在
# ✅ queue[0].text
# ✅ queue[0].audio_path
# ✅ queue[0].category
# ✅ queue[0].play_count
# ✅ queue[0].created_at
```

4. **前端测试**:
   - 切换到 Remote Mode (`http://192.168.50.2:9000`)
   - 打开 Queue Manager
   - 验证队列表格正确显示文本
   - 验证音频可以正常播放

### 预期结果

**修改前**:
```
Index    Text         Category    Play Count
1        undefined    normal      0
```

**修改后**:
```
Index    Text                    Category    Play Count
1        Test audio URL          normal      0
2        This image displays...  normal      1
```

---

## 📝 需要修改的API端点清单

| 端点 | 优先级 | 修改内容 |
|------|-------|---------|
| `GET /api/mcp/v1/voice-subtitle/queue` | 🔴 高 | 添加 `text`, `audio_path`, `category`, `play_count` |
| `GET /api/mcp/v1/voice-subtitle/queue/filter-by-category` | 🔴 高 | 同上 |
| `GET /api/mcp/v1/voice-subtitle/queue/filter-by-today` | 🟡 中 | 同上 |
| `GET /api/mcp/v1/voice-subtitle/queue/latest` | 🟡 中 | 同上 |
| `GET /api/mcp/v1/voice-subtitle/categories` | 🟢 低 | 可能已正确,需验证 |

---

## 🎯 兼容性说明

### 向后兼容

建议保留所有原有字段,仅**添加**新字段:

**优点**:
- ✅ 不影响其他可能使用原有字段的客户端
- ✅ 前端可以选择使用新字段
- ✅ 便于调试和对比数据

**数据示例**:
```json
{
  "text": "Hello",              // 新增(前端使用)
  "audio_path": "path/to.mp3", // 新增(前端使用)
  "category": "normal",         // 新增(前端使用)
  "play_count": 0,             // 新增(前端使用)

  "original_text": "Hello",    // 保留(后端使用)
  "translated_text": "Hello",  // 保留(后端使用)
  "type": "text",              // 保留(后端使用)
  "tts_files": [...]           // 保留(后端使用)
}
```

---

## 📌 总结

### 核心问题
远程服务器返回的数据格式与前端期望不一致

### 解决方案
后端API添加4个必须字段: `text`, `audio_path`, `category`, `play_count`

### 影响范围
- 需要修改 4-5 个 API 端点
- 纯后端修改,前端无需改动
- 建议保留原有字段确保向后兼容

### 修改工作量
- 代码修改: 1个路由文件
- 测试工作: API测试 + 前端集成测试
- 预计时间: 2-4小时

---

## 🔗 相关文档

- **DATA_ALIGNMENT_ISSUE.md** - 详细问题分析
- **LOCAL_REMOTE_ALIGNMENT_ANALYSIS.md** - 本地/远程对齐分析
- **BACKEND_REPORT.md** - 后端验证报告

---

**创建日期**: 2025-12-01
**文档版本**: 1.0
**创建人**: Claude
**审阅状态**: 待后端团队确认
