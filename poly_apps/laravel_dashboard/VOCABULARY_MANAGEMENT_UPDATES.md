# Vocabulary Learning 管理端更新

## 更新概述

在 Laravel Dashboard 的 **Vocabulary Learning** 视图中添加了 TTS 队列管理功能，用于实时监控服务器端的 TTS 音频生成队列状态。

---

## 新增功能

### 1. TTS Queue Management 面板

**位置**: Vocabulary Learning 页面顶部

**功能**:
- ✅ 实时显示 TTS 队列统计信息
- ✅ 5秒自动刷新功能（可开关）
- ✅ 手动刷新按钮
- ✅ 5个关键指标卡片

**显示指标**:

| 指标 | 说明 | 颜色 |
|------|------|------|
| **Pending** | 待处理的任务数量 | 黄色 |
| **Processing** | 正在处理中的任务数量 | 蓝色 |
| **Completed** | 已完成的任务数量 | 绿色 |
| **Failed** | 失败的任务数量 | 红色 |
| **Total** | 总任务数量 | 灰色 |

**界面截图预览**:
```
┌─────────────────────────────────────────────────────────┐
│ TTS Queue Management      [✓] Auto-refresh (5s) Refresh│
├─────────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │  45  │ │   3  │ │ 1205 │ │  12  │ │ 1265 │         │
│  │Pend. │ │Proc. │ │Comp. │ │Failed│ │Total │         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
└─────────────────────────────────────────────────────────┘
```

### 2. 自动刷新功能

**特性**:
- 勾选 "Auto-refresh (5s)" 复选框后，每5秒自动刷新队列统计
- 取消勾选后停止自动刷新
- 适合实时监控 TTS 生成任务的进度

**使用场景**:
- 批量生成 TTS 音频时，监控队列处理进度
- 检查是否有失败的任务需要重试
- 了解系统当前的 TTS 生成负载

---

## 技术实现

### API 新增方法

**文件**: `/poly_apps/laravel_dashboard/core/api/modules/AppQyV1.ts`

添加了3个新的 API 方法：

```typescript
// 获取队列统计（管理端使用）
async getTTSQueueStats(): Promise<APIResponse>

// 检查特定单词的队列状态
async checkTTSQueueStatus(word: string, language: string): Promise<APIResponse>

// 批量添加单词到队列（用户端使用）
async queueBatchTTS(words: Array<{
  word: string;
  language: string;
  priority?: number
}>): Promise<APIResponse>
```

### 组件修改

**文件**: `/poly_apps/laravel_dashboard/components/views/VocabularyLearning.tsx`

**新增状态**:
```typescript
const [queueStats, setQueueStats] = useState<any>(null);
const [loadingQueueStats, setLoadingQueueStats] = useState(false);
const [autoRefreshQueue, setAutoRefreshQueue] = useState(false);
```

**新增函数**:
```typescript
// 加载队列统计
const loadQueueStats = async () => {
  const response = await api.appQyV1.getTTSQueueStats();
  setQueueStats(response.data);
}
```

**自动刷新逻辑**:
```typescript
useEffect(() => {
  if (autoRefreshQueue) {
    const interval = setInterval(() => {
      loadQueueStats();
    }, 5000); // 5秒刷新

    return () => clearInterval(interval);
  }
}, [autoRefreshQueue]);
```

---

## 后端 API 端点

### 获取队列统计

```
GET /api/app_qy_v1/ai_tools/tts/queue/stats
```

**响应示例**:
```json
{
  "status": "success",
  "message": "Queue statistics retrieved",
  "data": {
    "pending": 45,
    "processing": 3,
    "completed": 1205,
    "failed": 12,
    "total": 1265
  }
}
```

### 检查队列状态

```
GET /api/app_qy_v1/ai_tools/tts/queue/status?word=example&language=en
```

**响应示例**:
```json
{
  "status": "success",
  "message": "Queue status retrieved",
  "data": {
    "word": "example",
    "language": "en",
    "status": "completed",
    "priority": 10,
    "retry_count": 0,
    "error_message": null,
    "audio_path": "en/word/p0pct/default/abc123.mp3",
    "requested_at": "2025-12-20 10:30:00",
    "started_at": "2025-12-20 10:30:15",
    "completed_at": "2025-12-20 10:30:25"
  }
}
```

---

## 使用方式

### 1. 访问管理面板

1. 打开 Laravel Dashboard: `http://localhost:9000`
2. 点击左侧菜单的 **Vocabulary Learning**
3. 页面顶部会显示 **TTS Queue Management** 面板

### 2. 监控队列状态

**方式一: 手动刷新**
- 点击右上角的 "Refresh" 按钮
- 队列统计会立即更新

**方式二: 自动刷新**
- 勾选 "Auto-refresh (5s)" 复选框
- 队列统计每5秒自动更新
- 适合长时间监控

### 3. 理解队列状态

- **Pending** 很高: 说明有大量任务等待处理，可能需要检查 Timer Task 是否正常运行
- **Processing** 有数值: 说明 Timer Task 正在工作
- **Failed** 增加: 需要检查失败原因（可能是 edge-tts 不可用或网络问题）
- **Completed** 增长: 说明系统正常生成 TTS 音频

---

## 配合使用的后端功能

### Timer Task: AppQyV1TTSGenerationTask

**运行间隔**: 60秒

**处理优先级**:
1. 用户队列任务（优先级 priority 1）
2. 文章 TTS 生成（优先级 priority 2）
3. 自动批量生成（优先级 priority 3）

**每轮处理量**:
- 队列任务: 10个/轮
- 词库单词: 20个/语言/轮
- 文章: 1篇/轮

### Auto Loader Task: AppQyV1TTSQueueAutoLoaderTask

**运行间隔**: 60秒

**自动加载量**:
- 每种语言: 5个单词
- 每种语言: 2篇文章
- 智能跳过已在队列中的项目

---

## 故障排查

### 队列统计不显示

**检查**:
1. 后端 API 是否正常: `curl http://localhost:9000/api/app_qy_v1/ai_tools/tts/queue/stats`
2. 是否有认证错误（需要登录）
3. 查看浏览器控制台是否有 JavaScript 错误

### 队列一直 Pending，不处理

**检查**:
1. Octane Timer Task 是否运行: 访问 **Octane Tasks** 页面
2. 检查 Laravel 日志: `/www/wwwroot/laravel_db/logs/laravel.log`
3. 确认 `APPQYV1_TTS_AUTO_GENERATION=true` 在 `.env` 中设置
4. 检查 edge-tts 是否安装: `which edge-tts`

### Failed 任务过多

**检查**:
1. 查看队列表中的错误信息
2. 检查 edge-tts 是否可执行: `edge-tts --version`
3. 检查网络连接（edge-tts 需要访问 Microsoft 服务器）
4. 查看日志中的详细错误信息

---

## 未来扩展建议

### 可以添加的功能

1. **任务详情列表**
   - 显示最近的 20 条队列任务
   - 包含单词、语言、状态、创建时间等

2. **失败任务管理**
   - 显示所有失败的任务
   - 提供重试按钮

3. **队列操作**
   - 清空已完成任务
   - 重置失败任务
   - 暂停/恢复队列处理

4. **性能图表**
   - 显示最近24小时的任务处理趋势
   - 成功率统计
   - 平均处理时间

5. **语言分组统计**
   - 按语言显示队列状态
   - 各语言的 TTS 覆盖率

---

## 总结

✅ **已完成**:
- TTS 队列统计实时显示
- 自动刷新功能
- API 集成
- 响应式 UI 设计

📋 **配套文档**:
- 后端 API: `/poly_apps/laravel_main/TTS_BATCH_API_DOCUMENTATION.md`
- 前端集成: `/poly_apps/laravel_main/FRONTEND_TTS_INTEGRATION_GUIDE.md`

🎯 **使用目标**:
- 管理端监控服务器 TTS 队列状态
- 实时了解音频生成进度
- 快速发现和排查问题

---

**更新时间**: 2025-12-21
**更新人**: Claude AI
**版本**: v1.0
