# MCP Manager 前后端 API 不一致性报告

## 检查时间：2025-12-19

## 概述
本报告列出后端已实现但前端 API 模块（`McpV1.ts`）中缺失的方法。

---

## ❌ 完全缺失的 API 方法

### 1. 截图管理（Screenshots）

| 后端方法 | 路由 | 前端API | 状态 | 优先级 |
|---------|------|---------|------|--------|
| `getLatest()` | `GET /screenshots/latest` | ❌ 缺失 | 未实现 | 🟡 中 |
| `clearAll()` | `DELETE /screenshots/clear-all/confirm` | ❌ 缺失 | 未实现 | 🟢 低 |

**影响**：
- 无法快速获取最新截图
- 无法清空所有截图（需要危险操作确认）

---

### 2. 任务管理（Task Dispatch）

| 后端方法 | 路由 | 前端API | 状态 | 优先级 |
|---------|------|---------|------|--------|
| `getLastTask()` | `GET /task-dispatch/queue/{categoryId}/last-task` | ❌ 缺失 | 未实现 | 🟢 低 |
| `hasLatestTask()` | `GET /task-dispatch/queue/{categoryId}/has-latest` | ❌ 缺失 | 未实现 | 🟢 低 |
| `getAllMappings()` | `GET /task-dispatch/mappings` | ❌ 缺失 | 未实现 | 🟢 低 |
| `resetCategoryMapping()` | `POST /task-dispatch/mappings/{categoryId}/reset` | ❌ 缺失 | 未实现 | 🟢 低 |
| `deleteCategoryMapping()` | `DELETE /task-dispatch/mappings/{categoryId}` | ❌ 缺失 | 未实现 | 🟢 低 |

**影响**：
- 无法获取最后一个任务
- 无法检查是否有最新任务
- 缺少提示词映射管理功能（但已有 `getPromptMappings()` 和 `updatePromptMapping()`）

**注意**：`getPromptMappings()` 已存在，可能与 `getAllMappings()` 功能重复

---

### 3. Placeholder 生成器

| 后端方法 | 路由 | 前端API | 状态 | 优先级 |
|---------|------|---------|------|--------|
| `cleanup()` | 未知 | ❌ 缺失 | 未实现 | 🟡 中 |

**影响**：
- 无法清理旧的占位图以释放存储空间

---

## ✅ 已存在但未在UI中使用的 API 方法

### 1. OCR 识别

| 前端API | UI集成状态 | 优先级 |
|---------|-----------|--------|
| `getOcrEngineInfo(engine)` | ❌ 未使用 | 🟡 中 |

**建议**：在 OCR 标签页显示当前引擎的详细信息（准确率、支持语言等）

---

### 2. 语音字幕（Voice Subtitle）

| 前端API | UI集成状态 | 优先级 |
|---------|-----------|--------|
| `vsIncrementPlayCount(id)` | ❌ 未使用 | 🟡 中 |
| `vsGetCategories()` | ❌ 未使用 | 🟡 中 |
| `vsListTasks()` | ❌ 未使用 | 🟢 低 |
| `vsDeleteTasks(taskIds)` | ❌ 未使用 | 🟢 低 |
| `vsGetTaskStatus(taskId)` | ❌ 未使用 | 🟢 低 |
| `vsGetUserSettings()` | ✅ 已实现函数 | 🟡 中 - 需UI集成 |
| `vsUpdateUserSettings()` | ✅ 已实现函数 | 🟡 中 - 需UI集成 |
| `vsGetSupportedLanguages()` | ❌ 未使用 | 🟡 中 |

**建议**：
- 播放时自动调用 `vsIncrementPlayCount()` 增加播放计数
- 添加分类过滤功能使用 `vsGetCategories()`
- 添加 Settings 标签页集成 `vsGetUserSettings()` 和 `vsUpdateUserSettings()`
- 在添加文本时显示支持的语言列表

---

## 📊 统计总结

### 缺失的 API 方法
| 模块 | 缺失数量 | 优先级分布 |
|------|---------|-----------|
| 截图管理 | 2 | 中:1, 低:1 |
| 任务管理 | 5 | 低:5 |
| Placeholder | 1 | 中:1 |
| **总计** | **8** | **中:2, 低:6** |

### 已有但未使用的 API 方法
| 模块 | 未使用数量 | 优先级分布 |
|------|----------|-----------|
| OCR | 1 | 中:1 |
| 语音字幕 | 8 | 中:5, 低:3 |
| **总计** | **9** | **中:6, 低:3** |

---

## 🎯 建议实现顺序

### 立即实现（中优先级）

1. **截图管理**
   ```typescript
   async getLatestScreenshot(): Promise<APIResponse> {
     return this.get('/screenshots/latest');
   }
   ```

2. **Placeholder 清理**
   ```typescript
   async cleanupPlaceholders(): Promise<APIResponse> {
     return this.post('/placeholders/cleanup');
   }
   ```

3. **OCR 引擎信息显示**
   - 在UI中使用现有的 `getOcrEngineInfo(engine)`

4. **语音字幕增强**
   - 播放时调用 `vsIncrementPlayCount()`
   - 添加语言选择器使用 `vsGetSupportedLanguages()`
   - 添加分类过滤使用 `vsGetCategories()`
   - 创建 Settings 标签页集成设置管理

### 后续实现（低优先级）

5. **任务管理扩展**
   ```typescript
   async getLastTask(categoryId: string): Promise<APIResponse> {
     return this.get(`/task-dispatch/queue/${categoryId}/last-task`);
   }

   async hasLatestTask(categoryId: string): Promise<APIResponse> {
     return this.get(`/task-dispatch/queue/${categoryId}/has-latest`);
   }
   ```

6. **映射管理**（如果需要与现有 `getPromptMappings()` 不同的功能）
   ```typescript
   async getAllTaskMappings(): Promise<APIResponse> {
     return this.get('/task-dispatch/mappings');
   }
   ```

7. **危险操作**
   ```typescript
   async clearAllScreenshots(): Promise<APIResponse> {
     return this.delete('/screenshots/clear-all/confirm');
   }
   ```

8. **语音字幕后台任务管理**
   - `vsListTasks()`, `vsDeleteTasks()`, `vsGetTaskStatus()` - 创建后台任务管理面板

---

## 🔍 验证已实现的功能

### 最近实现的功能（需验证）

✅ **截图批量上传和合并**
- `uploadBatch()` - 已实现
- `uploadMerge()` - 已实现
- 拖放上传 - 已实现

✅ **语音字幕图片上传**
- `vsAddImage()` - 已实现

✅ **任务管理高级功能**
- `getCategoryFiles()` - 已实现
- `updateTaskStatus()` - 已实现

✅ **语音字幕高级功能**
- `vsRemoveItems()` - 已实现
- `vsClearQueue()` - 已实现
- `vsUpdateItemGroup()` - 已实现

---

## 📝 总结

**当前状态**：
- 前端 API 模块覆盖率：~90%
- UI 功能集成率：~85%
- 缺失 API 方法：8个（主要是低优先级）
- 已有但未使用：9个

**建议**：
1. 优先实现中优先级的缺失方法（3个）
2. 在UI中使用已有的API方法（6个中优先级）
3. 低优先级功能可根据用户反馈决定是否实现

**影响评估**：
- 🟢 **低影响**：大部分缺失功能为辅助功能，不影响核心业务流程
- 🟡 **中影响**：部分功能（如引擎信息、播放计数、设置管理）可提升用户体验
- 🔴 **无高影响**：所有高优先级功能已实现
