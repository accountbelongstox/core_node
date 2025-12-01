# 🔴 Remote/Local 数据结构不对齐问题

## 问题发现

用户在 Remote Mode 下看到队列显示 `undefined`:

```
Index    Text         Category    Play Count
1        undefined    normal      0
2        undefined    normal      1
```

## 🔍 根本原因

**本地服务器** 和 **远程服务器** 返回的队列数据结构**完全不同**!

---

## 📊 数据结构对比

### Local Server (localhost:59000)

**Endpoint**: `GET /voice-subtitle/queue`

```json
{
  "success": true,
  "queue": [
    {
      "text": "Hello, this is a test",
      "audio_path": "C:\\Users\\accou\\.core_node\\cache\\voice_subtitle_tts\\f16eae25fd6e74e35b1de836c9037012.mp3",
      "play_count": 113,
      "category": "normal",
      "created_at": "2025-11-28T21:38:29.036518"
    }
  ],
  "current_index": 0
}
```

**字段**:
- ✅ `text` - 字幕文本
- ✅ `audio_path` - 音频文件路径
- ✅ `category` - 分类
- ✅ `play_count` - 播放次数
- ✅ `created_at` - 创建时间

---

### Remote Server (192.168.50.2:9000)

**Endpoint**: `GET /api/mcp/v1/voice-subtitle/queue`

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

**字段**:
- ❌ NO `text` - 使用 `original_text` / `translated_text`
- ❌ NO `audio_path` - 使用 `tts_files` 数组
- ❌ NO `category` - 使用 `type`
- ❌ NO `play_count` - 缺失字段

---

## 🎯 前端代码期望

**framework.js:389**:
```javascript
tr.innerHTML = `
    <td>${index + 1}</td>
    <td>${item.text}</td>          // ← 期望 item.text
    <td>${item.category}</td>       // ← 期望 item.category
    <td>${item.play_count || 0}</td>
    <td>${createdDate}</td>
`;
```

**实际远程数据**:
- `item.text` → `undefined` (应该是 `item.original_text` 或 `item.translated_text`)
- `item.category` → `undefined` (应该是 `item.type`)
- `item.play_count` → `undefined` (远程没有这个字段)
- `item.audio_path` → `undefined` (应该是 `item.tts_files[0].file_path`)

---

## ✅ 解决方案

### 方案 1: 前端数据适配器 (推荐)

在前端添加一个数据转换层,将远程数据格式转换为本地格式:

```javascript
// api.js - 添加数据适配器

function normalizeQueueItem(item, isRemote = false) {
    if (!isRemote) {
        // 本地数据,直接返回
        return item;
    }

    // 远程数据,转换为本地格式
    return {
        text: item.translated_text || item.original_text || '',
        audio_path: item.tts_files && item.tts_files[0]
            ? item.tts_files[0].file_path
            : '',
        category: item.type || 'normal',
        play_count: 0,  // 远程没有play_count
        created_at: item.created_at,

        // 保留原始数据以备用
        _remote_data: item
    };
}

async getQueue() {
    const data = await this.get(this.endpoints.QUEUE);

    if (data && data.success && data.queue) {
        // 检测是否是远程模式
        const isRemote = this.config.REMOTE_API.ENABLED;

        // 转换每个队列项
        data.queue = data.queue.map(item => normalizeQueueItem(item, isRemote));
    }

    return data;
}
```

**优点**:
- ✅ 前端代码无需修改
- ✅ 支持本地和远程两种数据格式
- ✅ 向后兼容
- ✅ 只需修改 `api.js`

**缺点**:
- ⚠️ `play_count` 在远程模式下总是显示 0
- ⚠️ `audio_path` 需要从 `tts_files` 数组提取

---

### 方案 2: 修改远程后端 (长期方案)

让远程服务器返回与本地一致的数据结构:

```python
# 远程后端需要修改为:
{
    "queue": [{
        "text": item.translated_text or item.original_text,
        "audio_path": item.tts_files[0].file_path if item.tts_files else "",
        "category": item.type,
        "play_count": 0,  # 或者添加这个字段
        "created_at": item.created_at
    }]
}
```

**优点**:
- ✅ 数据结构统一
- ✅ 前端无需适配器

**缺点**:
- ❌ 需要修改远程服务器代码
- ❌ 需要协调后端团队
- ❌ 可能影响其他客户端

---

## 🔧 推荐实施方案

**立即**: 实施**方案1**(前端适配器)
**长期**: 与后端团队协商统一数据格式(**方案2**)

---

## 📝 需要修改的文件

### 方案 1 (前端适配器):

**文件**: `pycore/pyctl/desktop/ui/api.js`

**位置**:
1. 添加 `normalizeQueueItem()` 函数 (Line 24附近)
2. 修改 `getQueue()` 方法 (Line 85-87)
3. 修改 `getLatestItems()` 方法 (Line 89-91)
4. 修改 `getTodayItems()` 方法 (Line 93-95)
5. 修改 `getItemsByCategory()` 方法 (Line 97-99)

---

## 📊 影响范围

| 功能 | 本地模式 | 远程模式 (修复前) | 远程模式 (修复后) |
|------|----------|-------------------|-------------------|
| 队列显示 | ✅ 正常 | ❌ Text显示undefined | ✅ 显示translated_text |
| 音频播放 | ✅ 正常 | ❌ 路径错误 | ✅ 使用tts_files[0].file_path |
| 分类显示 | ✅ 正常 | ❌ 显示undefined | ✅ 显示type |
| 播放次数 | ✅ 正常 | ❌ 显示undefined | ⚠️ 固定显示0 |
| 日期显示 | ✅ 正常 | ✅ 正常 | ✅ 正常 |

---

## 🎯 总结

**问题**: 远程服务器数据结构与本地不一致
**症状**: Remote Mode下队列Text列显示 `undefined`
**原因**: 前端期望 `item.text`,远程返回 `item.original_text`
**解决**: 添加前端数据适配器转换格式

---

**创建日期**: 2025-12-01
**发现人员**: Claude
**状态**: 待修复
