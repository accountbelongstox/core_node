# Google News Processor - 快速开始指南

## 🚀 5 分钟快速测试

### 步骤 1: 构建扩展 (如果还未构建)

```bash
cd /www/programing/core_node/apps/mcp-chrome/app/chrome-extension
pnpm install
pnpm build
```

### 步骤 2: 加载 Chrome 扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用右上角的"**开发者模式**"
4. 点击"**加载已解压的扩展程序**"
5. 选择目录：
   ```
   /www/programing/core_node/apps/mcp-chrome/app/chrome-extension/.output/chrome-mv3
   ```
6. 扩展应该出现在列表中，名称为 "**MCP Chrome**"

### 步骤 3: 选择测试方法

#### 🎨 方法 A: 使用图形界面 (最简单)

1. **打开测试页面**
   ```
   file:///www/programing/core_node/apps/mcp-chrome/test-google-news.html
   ```
   或直接双击 `test-google-news.html` 文件

2. **点击"▶️ Start Processor"按钮**

3. **观察输出**
   - 实时统计数据会显示在页面上
   - 详细日志显示在黑色输出框中
   - 同时按 F12 打开开发者工具查看完整日志

#### 💻 方法 B: 使用 Background Console (高级)

1. **打开扩展的 Background Page**
   - 访问 `chrome://extensions/`
   - 找到 "MCP Chrome" 扩展
   - 点击 "**Inspect views: background page**"
   - 会打开一个 DevTools 窗口

2. **在 Console 中运行**
   ```javascript
   // 启动处理器
   chrome.runtime.sendMessage({
     type: 'task_center',
     action: 'start_processor',
     processorType: 'google_news',
     config: {
       apiUrl: 'http://localhost:9000',
       pollInterval: 10  // 10 秒间隔
     }
   }, (response) => {
     console.log('[Response]', response);
   });
   ```

3. **查看详细输出**
   - Console 会显示每次搜索的详细信息
   - 包括提取的标题、内容等

#### 📋 方法 C: 使用测试脚本 (查看说明)

```bash
node /www/programing/core_node/apps/mcp-chrome/test-google-news-processor.js
```

这会显示完整的使用说明。

### 步骤 4: 观察结果

处理器会：

1. ✅ 读取 8 个内置单词
2. ✅ 依次搜索每个单词的 Google 新闻
3. ✅ 自动打开新标签页（后台）
4. ✅ 提取文章标题和内容
5. ✅ 在控制台打印详细 Debug 信息
6. ✅ 所有单词处理完成后自动停止

#### 预期输出示例

```
═══════════════════════════════════════════════════════
[GoogleNewsProcessor] 🔍 Searching for word #1/8: "artificial intelligence"
═══════════════════════════════════════════════════════
[GoogleNewsProcessor] 🌐 Opening URL: https://news.google.com/search?q=...
[GoogleNewsProcessor] 📑 Created tab 12345 for "artificial intelligence"
[GoogleNewsProcessor] ✅ Search successful for "artificial intelligence"
[GoogleNewsProcessor] 📰 Found 10 articles
[GoogleNewsProcessor] Search results: {
  "success": true,
  "word": "artificial intelligence",
  "url": "https://news.google.com/...",
  "articleCount": 10,
  "headlines": [
    "AI Breakthrough in Medical Diagnosis...",
    "New AI Regulations Announced...",
    "Tech Giants Invest Billions in AI...",
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

### 步骤 5: 管理处理器

#### 查看状态
```javascript
chrome.runtime.sendMessage({
  type: 'task_center',
  action: 'get_status'
}, (response) => {
  console.log('[Status]', JSON.stringify(response, null, 2));
});
```

#### 停止处理器
```javascript
chrome.runtime.sendMessage({
  type: 'task_center',
  action: 'stop_processor',
  processorType: 'google_news'
}, (response) => {
  console.log('[Stop]', response);
});
```

#### 重新启动
```javascript
chrome.runtime.sendMessage({
  type: 'task_center',
  action: 'start_processor',
  processorType: 'google_news',
  config: {
    apiUrl: 'http://localhost:9000',
    pollInterval: 5  // 改成 5 秒间隔
  }
}, (response) => {
  console.log('[Start]', response);
});
```

## 🎯 当前功能

- ✅ **内置 8 个测试单词**
  - artificial intelligence
  - climate change
  - technology
  - renewable energy
  - space exploration
  - quantum computing
  - electric vehicles
  - cryptocurrency

- ✅ **自动搜索和提取**
  - 打开 Google News 搜索页面
  - 提取前 10 个文章标题
  - 提取页面文本（前 5000 字符）
  - 自动关闭标签页

- ✅ **详细调试信息**
  - 每个搜索的完整日志
  - 实时进度显示
  - 成功/失败统计

## ⚙️ 配置选项

| 参数 | 说明 | 默认值 | 范围 |
|------|------|--------|------|
| `apiUrl` | API 基础 URL | `http://localhost:9000` | 任意 URL |
| `pollInterval` | 搜索间隔（秒） | `10` | 1-60 |

## 📊 统计信息

处理器会收集以下统计数据：

- **总搜索次数**：已完成的搜索总数
- **成功次数**：成功提取内容的次数
- **失败次数**：搜索失败的次数
- **待处理**：队列中剩余的单词数

## 🐛 故障排查

### 问题 1: 扩展没有加载

**症状**：test-google-news.html 页面显示错误

**解决**：
1. 确认扩展已正确加载到 Chrome
2. 刷新扩展：chrome://extensions/ → 点击刷新按钮
3. 重新加载测试页面

### 问题 2: 处理器无法启动

**症状**：点击 Start 后没有反应

**解决**：
1. 打开 Background Console 查看错误
2. 确认 TaskCenter 已初始化
3. 检查控制台是否有错误信息

### 问题 3: 无法提取内容

**症状**：articleCount 为 0

**解决**：
1. Google News 可能更新了页面结构
2. 检查网络连接
3. 增加页面加载等待时间

### 问题 4: 标签页没有关闭

**症状**：搜索后标签页残留

**解决**：
1. 检查是否有 JavaScript 错误
2. 手动关闭残留标签页
3. 重启处理器

## 📚 更多信息

- **完整文档**：`GOOGLE_NEWS_PROCESSOR_README.md`
- **实现总结**：`IMPLEMENTATION_SUMMARY.md`
- **项目 README**：`README.md`

## 💡 下一步

1. **修改单词列表**
   - 编辑 `GoogleNewsProcessor.ts` 中的 `wordList` 数组

2. **调整搜索间隔**
   - 修改 `pollInterval` 参数

3. **查看源代码**
   - 文件位置：`app/chrome-extension/entrypoints/background/services/task-center/processors/GoogleNewsProcessor.ts`

4. **扩展功能**
   - 添加 API 集成
   - 保存结果到数据库
   - 支持更多新闻源

---

**准备好了吗？**

现在就打开 `test-google-news.html` 开始测试吧！🚀
