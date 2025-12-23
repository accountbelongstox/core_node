# 🔧 修复总结 - Voice Subtitle Local/Remote API 对齐

## 📋 问题描述

用户切换到 Remote API Mode 后,多个功能失效:

### 问题 1: 音频播放失败
```
NotSupportedError: The element has no supported sources.
```

### 问题 2: Code Sync 失效
- Code Sync 状态查询失败
- 无法启动/停止 Code Sync
- 备份功能无法控制

### 问题 3: 文件路径功能无警告
- `addImage()` 和 `addVoice()` 在 Remote Mode 下静默失败
- 用户不知道这些功能仅支持 Local Mode

---

## 🎯 根本原因

多个API方法未正确区分本地和远程模式:

1. **音频播放**: 本地文件路径被发送到远程服务器
2. **Code Sync**: 本地文件监控被发送到远程服务器
3. **文件路径方法**: 缺少警告提示

---

## ✅ 解决方案

### 修改文件

**文件**: `pycore/pyctl/desktop/ui/api.js`
**类型**: 前端修复,无需后端修改

---

## 🔧 修复详情

### 修复 1: 音频播放 (Line 188-202)

**修改前**:
```javascript
getAudioUrl(audioPath) {
    const baseUrl = this.getBaseUrl();
    const apiPrefix = this.config.getApiPrefix();
    return `${baseUrl}${apiPrefix}${this.endpoints.AUDIO}?path=${encodeURIComponent(audioPath)}`;
}
```

**修改后**:
```javascript
/**
 * Get audio file URL for playback
 *
 * IMPORTANT: Always uses local server (forceLocal=true) because:
 * 1. Audio files are stored on local disk
 * 2. Remote servers don't have access to local file system
 * 3. Prevents CORS and 404 errors when in remote mode
 */
getAudioUrl(audioPath) {
    return this.getFullUrl(this.endpoints.AUDIO, true) + `?path=${encodeURIComponent(audioPath)}`;
}
```

---

### 修复 2: Code Sync 方法 (Line 204-231)

**修改前**:
```javascript
async getCodeSyncStatus() {
    return await this.get(this.endpoints.CODE_SYNC_STATUS);
}

async startCodeSyncServer() {
    return await this.post(this.endpoints.CODE_SYNC_START_SERVER);
}

async startCodeSyncClient() {
    return await this.post(this.endpoints.CODE_SYNC_START_CLIENT);
}

async stopCodeSync() {
    return await this.post(this.endpoints.CODE_SYNC_STOP);
}

async toggleBackup(enabled) {
    return await this.post(this.endpoints.CODE_SYNC_TOGGLE_BACKUP, { enabled });
}
```

**修改后**:
```javascript
/**
 * Code sync operations always use local server because:
 * 1. Monitors local file system for changes
 * 2. Manages local WebSocket server/client
 * 3. Remote servers don't have access to user's code files
 */

async getCodeSyncStatus() {
    return await this.get(this.endpoints.CODE_SYNC_STATUS, {}, true);  // Force local
}

async startCodeSyncServer() {
    return await this.post(this.endpoints.CODE_SYNC_START_SERVER, {}, true);  // Force local
}

async startCodeSyncClient() {
    return await this.post(this.endpoints.CODE_SYNC_START_CLIENT, {}, true);  // Force local
}

async stopCodeSync() {
    return await this.post(this.endpoints.CODE_SYNC_STOP, {}, true);  // Force local
}

async toggleBackup(enabled) {
    return await this.post(this.endpoints.CODE_SYNC_TOGGLE_BACKUP, { enabled }, true);  // Force local
}
```

---

### 修复 3: 文件路径方法警告 (Line 121-163)

**修改前**:
```javascript
async addImage(imagePath, langs = ['en'], category = 'image') {
    return await this.post(this.endpoints.ADD_IMAGE, {
        image_path: imagePath,
        langs,
        category
    });
}

async addVoice(audioPath, text = null, langs = ['en'], category = 'normal') {
    return await this.post(this.endpoints.ADD_VOICE, {
        audio_path: audioPath,
        text,
        langs,
        category
    });
}
```

**修改后**:
```javascript
/**
 * ⚠️ WARNING: Only works in Local Mode
 *
 * Adds image from LOCAL FILE PATH (not file upload).
 * In Remote Mode, the remote server cannot access local file paths.
 */
async addImage(imagePath, langs = ['en'], category = 'image') {
    if (this.config.REMOTE_API.ENABLED) {
        console.warn('[API] addImage() only works in Local Mode (local file path access)');
    }
    return await this.post(this.endpoints.ADD_IMAGE, {
        image_path: imagePath,
        langs,
        category
    });
}

/**
 * ⚠️ WARNING: Only works in Local Mode
 *
 * Adds voice from LOCAL AUDIO FILE PATH (not file upload).
 * In Remote Mode, the remote server cannot access local file paths.
 */
async addVoice(audioPath, text = null, langs = ['en'], category = 'normal') {
    if (this.config.REMOTE_API.ENABLED) {
        console.warn('[API] addVoice() only works in Local Mode (local file path access)');
    }
    return await this.post(this.endpoints.ADD_VOICE, {
        audio_path: audioPath,
        text,
        langs,
        category
    });
}
```

---

## 🧪 测试结果

### Local Mode
- ✅ 音频播放正常
- ✅ Code Sync 功能正常
- ✅ 文件路径方法正常

### Remote Mode
- ✅ 音频仍使用本地服务器播放
- ✅ Code Sync 仍使用本地服务器
- ✅ 文件路径方法显示警告
- ✅ 队列管理等功能正确使用远程服务器

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

详细的技术分析和对齐状态请参考:
- **API_BRIDGE_ANALYSIS.md** - 原始问题分析
- **LOCAL_REMOTE_ALIGNMENT_ANALYSIS.md** - 完整的对齐分析和修复方案

---

## 📊 修复统计

| 类别 | 方法数 | 状态 |
|------|--------|------|
| 音频播放 | 1 | ✅ 已修复 |
| Code Sync | 5 | ✅ 已修复 |
| 文件路径方法 | 2 | ✅ 已添加警告 |
| 背景服务 | 6 | ✅ 原本正确 |
| 队列管理 | 9 | ✅ 原本正确 |
| 任务管理 | 3 | ✅ 原本正确 |
| **总计** | **26** | **✅ 100%对齐** |

---

## 🎉 修复完成

**修改范围**: 1个文件, 8个方法
**影响范围**: 仅前端
**兼容性**: 完全向后兼容
**测试状态**: ✅ 已验证

---

**修复日期**: 2025-12-01
**修复人员**: Claude
**文档版本**: 2.0
