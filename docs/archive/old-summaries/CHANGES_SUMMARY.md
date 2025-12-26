# 🔧 修复总结 - Voice Subtitle 音频播放问题

## 📋 问题描述

用户切换到 Remote API Mode 后,音频播放功能完全失效:
```
NotSupportedError: The element has no supported sources.
```

---

## 🎯 根本原因

音频URL构建逻辑错误地将本地文件路径发送到远程服务器:

**错误流程**:
1. 用户切换到 Remote Mode (192.168.50.2:9000)
2. 前端请求音频: `api.getAudioUrl("C:\\Users\\...\\audio.mp3")`
3. 生成URL: `http://192.168.50.2:9000/api/mcp/v1/voice-subtitle/audio?path=C:\Users\...\audio.mp3`
4. HTML5 Audio尝试从远程服务器加载本地文件 → **失败**

---

## ✅ 解决方案

### 修改文件

**文件**: `pycore/pyctl/desktop/ui/api.js`
**位置**: Line 199-201
**类型**: 前端修复,无需后端修改

### 修改内容

**修改前**:
```javascript
getAudioUrl(audioPath) {
    const baseUrl = this.getBaseUrl();           // ❌ 可能返回远程服务器
    const apiPrefix = this.config.getApiPrefix(); // ❌ 可能是 /api/mcp/v1
    return `${baseUrl}${apiPrefix}${this.endpoints.AUDIO}?path=${encodeURIComponent(audioPath)}`;
}
```

**修改后**:
```javascript
getAudioUrl(audioPath) {
    // Force local server for audio files (files are on local disk)
    return this.getFullUrl(this.endpoints.AUDIO, true) + `?path=${encodeURIComponent(audioPath)}`;
    //                                          ^^^^
    //                                          forceLocal=true 确保使用 localhost
}
```

---

## 🧪 测试结果

### Local Mode
- ✅ URL: `http://localhost:59000/voice-subtitle/audio?path=...`
- ✅ 音频正常播放

### Remote Mode
- ✅ URL: `http://localhost:59000/voice-subtitle/audio?path=...` (仍然是localhost)
- ✅ 音频正常播放
- ✅ 其他API请求正确发送到远程服务器

---

## 📊 后端API验证

### 测试命令
```bash
curl http://localhost:59000/voice-subtitle/queue
curl http://localhost:59000/voice-subtitle/categories
```

### 响应状态
- ✅ `/voice-subtitle/queue` - 200 OK
- ✅ `/voice-subtitle/categories` - 200 OK
- ✅ `/voice-subtitle/audio` - 200 OK (音频流)

---

## 📝 完整文档

详细的技术分析和测试验证请参考:
- **API_BRIDGE_ANALYSIS.md** - 完整的问题分析和解决方案文档

---

## 🎉 修复完成

**修改范围**: 1个文件, 1行代码
**影响范围**: 仅前端
**兼容性**: 完全向后兼容
**测试状态**: ✅ 已验证

---

**修复日期**: 2025-12-01
**修复人员**: Claude
