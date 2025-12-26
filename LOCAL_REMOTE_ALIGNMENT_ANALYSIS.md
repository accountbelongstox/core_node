# Local vs Remote API Alignment Analysis

## 📋 Overview

This document analyzes all API methods in `api.js` to identify which features are correctly aligned between local and remote modes, and which need modification.

---

## 🎯 Classification Criteria

### 🔒 Must Be Local (forceLocal=true)
Features that access **local system resources**:
- Local file system (audio files, images, code files)
- System services (clipboard, screenshot monitors)
- Local hardware/OS capabilities

### 🌐 Can Be Remote (forceLocal=false)
Features that work with **server-managed data**:
- Queue management
- Text processing
- Category management
- Task status tracking

---

## 📊 Current Status Analysis

### ✅ Correctly Aligned (No Changes Needed)

| Method | Type | forceLocal | Status | Line |
|--------|------|------------|--------|------|
| `startClipboardMonitor()` | POST | ✅ true | ✅ Correct | 162-164 |
| `stopClipboardMonitor()` | POST | ✅ true | ✅ Correct | 166-168 |
| `getClipboardStatus()` | GET | ✅ true | ✅ Correct | 170-172 |
| `startScreenshotMonitor()` | POST | ✅ true | ✅ Correct | 174-176 |
| `stopScreenshotMonitor()` | POST | ✅ true | ✅ Correct | 178-180 |
| `getScreenshotStatus()` | GET | ✅ true | ✅ Correct | 182-184 |
| `getAudioUrl()` | URL | ✅ true | ✅ Correct (FIXED) | 199-202 |

**Reasoning**: All background services correctly use `forceLocal=true` because they interact with local system resources.

---

### 🌐 Correctly Remote-Capable (No Changes Needed)

| Method | Type | forceLocal | Status | Line |
|--------|------|------------|--------|------|
| `ping()` | GET | ❌ false | ✅ Correct | 75-81 |
| `getQueue()` | GET | ❌ false | ✅ Correct | 85-87 |
| `getLatestItems()` | GET | ❌ false | ✅ Correct | 89-91 |
| `getTodayItems()` | GET | ❌ false | ✅ Correct | 93-95 |
| `getItemsByCategory()` | GET | ❌ false | ✅ Correct | 97-99 |
| `clearQueue()` | POST | ❌ false | ✅ Correct | 101-103 |
| `setCurrentIndex()` | POST | ❌ false | ✅ Correct | 105-107 |
| `incrementPlayCount()` | POST | ❌ false | ✅ Correct | 109-113 |
| `addText()` | POST | ❌ false | ✅ Correct | 117-119 |
| `removeItems()` | POST | ❌ false | ✅ Correct | 138-140 |
| `changeItemCategory()` | POST | ❌ false | ✅ Correct | 142-144 |
| `getCategories()` | GET | ❌ false | ✅ Correct | 148-150 |
| `getTaskStatus()` | GET | ❌ false | ✅ Correct | 228-231 |
| `getAllTasks()` | GET | ❌ false | ✅ Correct | 233-235 |
| `pollTask()` | Utility | ❌ false | ✅ Correct | 237-266 |

**Reasoning**: These methods manage server-side data (queue, categories, tasks) and should work with remote servers.

---

### ⚠️ NEEDS MODIFICATION - Mixed Behavior Required

#### 1. File Upload Operations

| Method | Current | Should Be | Issue | Line |
|--------|---------|-----------|-------|------|
| `uploadFile()` | ❌ false | ⚠️ DEPENDS | Ambiguous use case | 154-158 |
| `addImage()` | ❌ false | ⚠️ DEPENDS | Ambiguous use case | 121-127 |
| `addVoice()` | ❌ false | ⚠️ DEPENDS | Ambiguous use case | 129-136 |

**Analysis**:

**Case 1: Local File Path Mode** (Current Behavior)
```javascript
// User provides local file path
await api.addImage("C:\\Users\\test\\image.png", ['en'], 'image');
// Backend reads from local disk → ✅ Must be Local
```

**Case 2: Uploaded File Mode** (Potential Use)
```javascript
// User uploads file through browser
await api.uploadFile(file);  // FormData upload
// Backend receives file data → 🌐 Can be Remote
```

**Current Issue**:
- `addImage()` and `addVoice()` accept **file paths** (strings), not file uploads
- These paths are **local file system paths** on the client machine
- Remote servers **cannot access** client's local file paths
- **Conclusion**: ❌ These methods are **BROKEN in Remote Mode**

---

### ⚠️ NEEDS MODIFICATION - Code Sync (Hybrid Approach)

| Method | Current | Should Be | Issue | Line |
|--------|---------|-----------|-------|------|
| `getCodeSyncStatus()` | ❌ false | ✅ true | Needs Local | 206-208 |
| `startCodeSyncServer()` | ❌ false | ✅ true | Needs Local | 210-212 |
| `startCodeSyncClient()` | ❌ false | ✅ true | Needs Local | 214-216 |
| `stopCodeSync()` | ❌ false | ✅ true | Needs Local | 218-220 |
| `toggleBackup()` | ❌ false | ✅ true | Needs Local | 222-225 |

**Reasoning**:
- Code Sync monitors **local file system** for changes
- Manages **local WebSocket server/client**
- Cannot run on remote server (remote server doesn't have access to user's code files)
- **Must use `forceLocal=true`**

---

## 🔧 Required Modifications

### Fix 1: Code Sync Methods (5 methods)

**File**: `pycore/pyctl/desktop/ui/api.js`

#### Lines 206-225 - Before:
```javascript
// ========== Code Sync ==========

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

#### Lines 206-225 - After:
```javascript
// ========== Code Sync (Always Local) ==========

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

### Fix 2: File Path Methods (Needs Documentation Warning)

**File**: `pycore/pyctl/desktop/ui/api.js`

#### Lines 121-136 - Add Warning Comments:
```javascript
// ========== Item Management ==========

async addText(text, langs = ['en'], category = 'normal') {
    return await this.post(this.endpoints.ADD_TEXT, { text, langs, category });
}

/**
 * ⚠️ WARNING: Only works in Local Mode
 *
 * Adds image from LOCAL FILE PATH (not file upload).
 * In Remote Mode, the remote server cannot access local file paths.
 *
 * @param {string} imagePath - Local file system path (e.g., "C:\\Users\\test.png")
 */
async addImage(imagePath, langs = ['en'], category = 'image') {
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
 *
 * @param {string} audioPath - Local file system path (e.g., "C:\\Users\\test.mp3")
 */
async addVoice(audioPath, text = null, langs = ['en'], category = 'normal') {
    return await this.post(this.endpoints.ADD_VOICE, {
        audio_path: audioPath,
        text,
        langs,
        category
    });
}
```

**Alternative Solution**: Consider adding runtime check:
```javascript
async addImage(imagePath, langs = ['en'], category = 'image') {
    // Warn if in remote mode
    if (this.config.REMOTE_API.ENABLED) {
        console.warn('[API] addImage() only works in Local Mode (local file path access)');
    }
    return await this.post(this.endpoints.ADD_IMAGE, {
        image_path: imagePath,
        langs,
        category
    });
}
```

---

### Fix 3: File Upload (Hybrid Solution)

**Option A**: Keep uploadFile() remote-capable (for web uploads)
```javascript
async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    return await this.postFormData(this.endpoints.FILE_UPLOAD, formData);
    // No forceLocal - can work with remote servers
}
```

**Option B**: Force local if backend processes uploaded files
```javascript
async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    // If backend saves to local disk and returns path
    return await this.postFormData(this.endpoints.FILE_UPLOAD, formData, true);
}
```

**Decision Needed**: Check backend implementation of `/voice-subtitle/upload-file` to determine correct behavior.

---

## 📋 Summary

### ✅ Already Correct (12 methods)
- Background services: 6 methods ✅
- Audio URL: 1 method ✅ (FIXED)
- Queue management: 9 methods ✅
- Task management: 3 methods ✅

### ❌ Needs Fix (5 methods)
- **Code Sync**: 5 methods need `forceLocal=true`

### ⚠️ Needs Documentation (2 methods)
- **addImage()**: Add warning that it only works in Local Mode
- **addVoice()**: Add warning that it only works in Local Mode

### 🔍 Needs Investigation (1 method)
- **uploadFile()**: Check backend behavior to determine local vs remote

---

## 🎯 Action Items

### Priority 1: Critical Fixes
1. ✅ Fix `getAudioUrl()` - ✅ COMPLETED
2. ⚠️ Fix Code Sync methods (5 methods) - Add `forceLocal=true`

### Priority 2: Documentation
3. Add warning comments to `addImage()` and `addVoice()`
4. Optionally add runtime warnings when these are called in Remote Mode

### Priority 3: Investigation
5. Investigate `uploadFile()` backend behavior
6. Determine if it should use `forceLocal=true`

---

## 📊 Final Statistics

| Category | Count | Percentage |
|----------|-------|------------|
| **Correctly Aligned** | 24 | 80% |
| **Needs Fix** | 5 | 17% |
| **Needs Investigation** | 1 | 3% |
| **Total Methods** | 30 | 100% |

---

**Created**: 2025-12-01
**Analyst**: Claude
**Status**: Ready for Implementation
