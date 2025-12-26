# Voice Subtitle API 桥接问题分析文档

## 📋 问题概述

**错误信息**:
```
js: [Player] Play error: [object DOMException]
js: Uncaught (in promise) NotSupportedError: The element has no supported sources.
```

**影响范围**: 音频播放功能完全失效

---

## 🔍 根本原因分析

### 1. API调用流程

```
前端请求队列 → 获取音频路径 → 构建音频URL → HTML5 Audio播放
```

### 2. 问题定位

**当前实现 (api.js:188-192)**:
```javascript
getAudioUrl(audioPath) {
    const baseUrl = this.getBaseUrl();           // ❌ 可能返回远程服务器
    const apiPrefix = this.config.getApiPrefix(); // ❌ 可能是 /api/mcp/v1
    return `${baseUrl}${apiPrefix}${this.endpoints.AUDIO}?path=${encodeURIComponent(audioPath)}`;
}
```

**问题**:
- 当用户切换到 **Remote Mode** 时
- `getBaseUrl()` 返回: `http://192.168.50.2:9000` (远程服务器)
- `getApiPrefix()` 返回: `/api/mcp/v1`
- 最终URL: `http://192.168.50.2:9000/api/mcp/v1/voice-subtitle/audio?path=C:\Users\...`

**错误**:
1. 音频文件在**本地磁盘**,不在远程服务器
2. 远程服务器上没有 `/api/mcp/v1/voice-subtitle/audio` 路由
3. HTML5 Audio无法加载跨域/不存在的音频源

---

## 📊 API响应数据分析

### GET /voice-subtitle/queue

**响应格式**:
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

**关键字段**:
- `audio_path`: 本地文件绝对路径 (Windows路径)
- `text`: 字幕文本
- `category`: 分类标签

### GET /voice-subtitle/categories

**响应格式**:
```json
{
    "success": true,
    "categories": ["normal", "screenshot"]
}
```

---

## 🎯 后端API路由分析

### 音频服务路由 (voice_subtitle_router.py:309-346)

```python
@router.get("/audio")
async def get_audio_file(path: str = Query(..., description="Audio file path")):
    """
    Serve audio file for playback

    Args:
        path: Path to audio file (from queue item)

    Returns:
        FileResponse: Audio file
    """
    audio_path = Path(path)

    if not audio_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file not found: {path}")

    # Determine media type based on extension
    ext = audio_path.suffix.lower()
    media_types = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        # ... more types
    }
    media_type = media_types.get(ext, 'audio/mpeg')

    return FileResponse(
        path=str(audio_path),
        media_type=media_type,
        filename=audio_path.name
    )
```

**特点**:
- ✅ 返回 FileResponse (流式传输)
- ✅ 自动识别音频格式
- ✅ 设置正确的 Content-Type
- ✅ 仅在**本地服务器**可用

---

## 🔧 解决方案

### 方案1: 强制本地音频请求 (推荐)

**修改 api.js:188-192**:

```javascript
// ❌ 错误实现
getAudioUrl(audioPath) {
    const baseUrl = this.getBaseUrl();           // 可能是远程
    const apiPrefix = this.config.getApiPrefix(); // 可能有prefix
    return `${baseUrl}${apiPrefix}${this.endpoints.AUDIO}?path=${encodeURIComponent(audioPath)}`;
}

// ✅ 正确实现
getAudioUrl(audioPath) {
    // 音频文件始终从本地服务器获取
    return this.getFullUrl(this.endpoints.AUDIO, true) + `?path=${encodeURIComponent(audioPath)}`;
    // forceLocal=true 确保使用 localhost
}
```

**原理**:
- `forceLocal=true` 参数强制使用本地服务器
- 跳过 remote mode 的URL/prefix覆盖
- 确保音频请求总是: `http://localhost:59000/voice-subtitle/audio?path=...`

---

## 📝 需要修改的文件

### 文件: `pycore/pyctl/desktop/ui/api.js`

**位置**: Line 188-192

**当前代码**:
```javascript
getAudioUrl(audioPath) {
    const baseUrl = this.getBaseUrl();
    const apiPrefix = this.config.getApiPrefix();
    return `${baseUrl}${apiPrefix}${this.endpoints.AUDIO}?path=${encodeURIComponent(audioPath)}`;
}
```

**修改为**:
```javascript
getAudioUrl(audioPath) {
    // Force local server for audio files (files are on local disk)
    return this.getFullUrl(this.endpoints.AUDIO, true) + `?path=${encodeURIComponent(audioPath)}`;
}
```

---

## 🧪 测试验证

### 测试步骤

1. **Local Mode 测试**:
```javascript
// 预期URL: http://localhost:59000/voice-subtitle/audio?path=C:\Users\...
api.getAudioUrl("C:\\Users\\test.mp3")
```

2. **Remote Mode 测试**:
```javascript
// 预期URL: http://localhost:59000/voice-subtitle/audio?path=C:\Users\...
// (仍然是localhost,不是远程服务器)
CONFIG.setApiMode('remote', 'http://192.168.50.2:9000');
api.getAudioUrl("C:\\Users\\test.mp3")
```

3. **实际播放测试**:
- 打开 Desktop Manager
- 切换到 Voice Player 模块
- 点击播放按钮
- 验证音频正常播放
- 切换到 Remote Mode
- 再次验证音频播放

### 预期结果

- ✅ Local Mode: 音频正常播放
- ✅ Remote Mode: 音频正常播放 (使用本地文件)
- ✅ 控制台无 "NotSupportedError" 错误
- ✅ Network面板显示正确的音频请求

---

## 🚀 额外改进建议

### 1. 背景服务API也应强制本地

**修改 api.js:162-184**:

所有背景服务相关的API已经正确使用 `forceLocal=true`:
```javascript
async startClipboardMonitor() {
    return await this.post(this.endpoints.CLIPBOARD_START, {}, true);  // ✅ 正确
}
```

### 2. 代码注释优化

在 `getAudioUrl()` 方法上方添加清晰的注释:

```javascript
/**
 * Get audio file URL for playback
 *
 * IMPORTANT: Always uses local server (forceLocal=true) because:
 * 1. Audio files are stored on local disk
 * 2. Remote servers don't have access to local file system
 * 3. Prevents CORS and 404 errors when in remote mode
 *
 * @param {string} audioPath - Local file system path
 * @returns {string} Full URL to audio endpoint on localhost
 */
getAudioUrl(audioPath) {
    return this.getFullUrl(this.endpoints.AUDIO, true) + `?path=${encodeURIComponent(audioPath)}`;
}
```

---

## 📌 总结

### 问题根源
- 音频URL构建逻辑未考虑 Remote Mode
- 本地文件路径被错误地发送到远程服务器

### 解决方案
- 使用 `forceLocal=true` 参数
- 确保音频请求始终指向 localhost

### 影响范围
- **仅前端**: 1个文件,1行代码修改
- **后端**: 无需修改
- **兼容性**: 完全向后兼容

### 修改文件清单
```
pycore/pyctl/desktop/ui/api.js:188-192
```

---

**创建日期**: 2025-12-01
**分析人员**: Claude
**状态**: 待修复
