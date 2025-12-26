# Google News Processor

## 概述

Google News Processor 是一个 Chrome 扩展处理器，用于批量搜索 Google 新闻并提取内容。

## 功能特性

- ✅ 从内置单词列表读取关键词（未来支持 API）
- ✅ 依次搜索每个关键词的 Google 新闻
- ✅ 自动打开新标签页进行搜索
- ✅ 提取新闻标题和内容
- ✅ 详细的 Debug 日志输出
- ✅ 统计信息（成功/失败/总数）
- ✅ 后台运行，不干扰用户操作

## 架构设计

```
GoogleNewsProcessor (ITaskProcessor)
  ├─ 内置单词列表
  ├─ 搜索循环 (pollInterval: 10s)
  ├─ Chrome Tabs API
  │   ├─ 创建新标签页
  │   ├─ 等待页面加载
  │   ├─ 注入脚本提取内容
  │   └─ 关闭标签页
  └─ 统计信息收集
```

## 文件结构

```
app/chrome-extension/entrypoints/background/services/task-center/
  ├─ processors/
  │   ├─ BingDictionaryProcessor.ts  (已有)
  │   ├─ DeepSeekProcessor.ts        (已有)
  │   └─ GoogleNewsProcessor.ts      (新增) ✨
  ├─ TaskCenter.ts                   (已有)
  ├─ ITaskProcessor.ts               (已有)
  └─ init-processors.ts              (已修改) ✨
```

## 使用方法

### 方法 1: 通过 Background Console

1. **加载扩展**
   ```
   打开 chrome://extensions/
   启用开发者模式
   加载未打包的扩展
   ```

2. **打开 Background Console**
   ```
   chrome://extensions/
   找到 MCP Chrome 扩展
   点击 "Inspect views: background page"
   ```

3. **启动处理器**
   ```javascript
   chrome.runtime.sendMessage({
     type: 'task_center',
     action: 'start_processor',
     processorType: 'google_news',
     config: {
       apiUrl: 'http://localhost:9000',
       pollInterval: 10  // 每个搜索间隔 10 秒
     }
   }, (response) => {
     console.log('[Test] Response:', response);
   });
   ```

4. **查看状态**
   ```javascript
   chrome.runtime.sendMessage({
     type: 'task_center',
     action: 'get_status'
   }, (response) => {
     console.log('[Status]', JSON.stringify(response, null, 2));
   });
   ```

5. **停止处理器**
   ```javascript
   chrome.runtime.sendMessage({
     type: 'task_center',
     action: 'stop_processor',
     processorType: 'google_news'
   }, (response) => {
     console.log('[Stop]', response);
   });
   ```

### 方法 2: 通过测试脚本

```bash
# 运行测试脚本获取使用说明
node test-google-news-processor.js
```

## Debug 输出示例

```
═══════════════════════════════════════════════════════
[GoogleNewsProcessor] 🔍 Searching for word #1/8: "artificial intelligence"
═══════════════════════════════════════════════════════
[GoogleNewsProcessor] 🌐 Opening URL: https://news.google.com/search?q=artificial%20intelligence...
[GoogleNewsProcessor] 📑 Created tab 12345 for "artificial intelligence"
[GoogleNewsProcessor] ✅ Search successful for "artificial intelligence"
[GoogleNewsProcessor] 📰 Found 10 articles
[GoogleNewsProcessor] Search results: {
  "success": true,
  "word": "artificial intelligence",
  "url": "https://news.google.com/search?q=artificial%20intelligence...",
  "articleCount": 10,
  "headlines": [
    "AI breakthrough in medical diagnosis...",
    "New regulations for AI systems...",
    ...
  ],
  "extractedText": "...",
  "timestamp": 1702998765432
}
[GoogleNewsProcessor] 🗑️  Closed tab 12345
[GoogleNewsProcessor] 📊 Progress: {
  processed: 1,
  total: 8,
  pending: 7,
  successful: 1,
  failed: 0
}
```

## 配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `apiUrl` | string | - | API 基础 URL（当前未使用，预留） |
| `pollInterval` | number | 10 | 搜索间隔（秒） |

## 内置单词列表

当前版本使用以下内置单词列表：

1. artificial intelligence
2. climate change
3. technology
4. renewable energy
5. space exploration
6. quantum computing
7. electric vehicles
8. cryptocurrency

**未来版本**将支持从 API 动态获取单词列表。

## 统计信息

处理器提供以下统计数据：

```typescript
{
  pending: number,           // 待处理数量
  translated: number,        // 成功处理数量
  failed: number,           // 失败数量
  lastRun: number | null,   // 最后运行时间戳
  totalSearches: number,    // 总搜索次数
  successfulSearches: number,  // 成功搜索次数
  failedSearches: number,   // 失败搜索次数
  isOnline: boolean,        // 是否在线
  queueTotal: number,       // 队列总数
}
```

## 提取的内容

每次搜索会提取：

1. **文章数量** (`articleCount`)
2. **标题列表** (`headlines[]`) - 最多 10 条
3. **页面文本** (`extractedText`) - 前 5000 字符
4. **搜索 URL** (`url`)
5. **时间戳** (`timestamp`)

## 工作流程

```
1. 启动处理器
   ↓
2. 读取单词列表
   ↓
3. 循环处理每个单词:
   ├─ 创建 Google News 搜索标签页
   ├─ 等待页面加载完成 (2秒)
   ├─ 注入脚本提取内容
   │   ├─ 查找文章标题
   │   ├─ 提取页面文本
   │   └─ 返回结果
   ├─ 关闭标签页
   ├─ 更新统计信息
   ├─ 打印 Debug 日志
   └─ 等待 pollInterval
   ↓
4. 所有单词处理完成
   ↓
5. 自动停止处理器
```

## 开发指南

### 添加新的单词到列表

编辑 `GoogleNewsProcessor.ts`:

```typescript
private wordList: string[] = [
  'artificial intelligence',
  'climate change',
  'your new word here',  // ← 添加这里
];
```

### 修改提取逻辑

编辑 `extractPageContent()` 方法:

```typescript
private async extractPageContent(tabId: number): Promise<any> {
  // 修改这里的选择器和提取逻辑
}
```

### 调整搜索间隔

启动时传入不同的 `pollInterval`:

```javascript
config: {
  pollInterval: 5  // 5 秒间隔
}
```

## 未来计划

- [ ] 从 API 动态获取单词列表
- [ ] 支持更多新闻源（BBC, CNN, etc.）
- [ ] 更智能的内容提取
- [ ] 保存搜索结果到数据库
- [ ] 支持自定义搜索参数（语言、地区等）
- [ ] 添加错误重试机制
- [ ] 支持并发搜索

## 故障排查

### 问题：处理器启动失败

**解决方案**：
1. 检查扩展是否正确加载
2. 查看 background console 错误信息
3. 确认 TaskCenter 已初始化

### 问题：无法提取内容

**解决方案**：
1. Google News 可能更新了 HTML 结构
2. 检查 `extractPageContent()` 的选择器
3. 增加页面加载等待时间

### 问题：标签页没有关闭

**解决方案**：
1. 检查 `chrome.tabs.remove()` 是否执行
2. 查看是否有异常中断
3. 手动关闭残留标签页

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
