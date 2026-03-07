# Chrome MCP Server — UI 功能说明

本文档描述 Popup 界面中 **7 个 Tab** 及所有 UI 功能元素，对应代码：`app/chrome-extension/entrypoints/popup/App.vue` 及子组件。

---

## 全局布局

- **Header Bar**
  - Logo（🌐 图标 + 渐变背景）
  - 标题：`Chrome MCP Server`，副标题：`AI-Powered Browser Automation`
  - **LanguageSelector**：语言切换
- **Tab 导航栏**：7 个 Tab 按钮，当前 Tab 有蓝色底条高亮
- **主内容区**：按当前 Tab 切换内容
- **Footer**：`chrome mcp server for ai`

---

## 1. Server（⚡）

| 元素 | 类型 | 说明 |
|------|------|------|
| Running Status 卡片 | 状态卡 | 标签「Running Status」、刷新按钮(↻)、状态圆点(绿/黄/红/灰)+ 状态文案、最后更新时间 |
| Connection 卡片 | 表单+按钮 | 「Connection Port」输入框(端口)、主按钮：连接/断开/连接中(禁用) |
| MCP Server Config 卡片 | 条件显示 | 仅当已连接且服务运行显示；标题、「Copy」按钮、JSON 配置代码块(streamable-http URL) |

---

## 2. Semantic（🧠）

| 元素 | 类型 | 说明 |
|------|------|------|
| Semantic Engine 状态卡 | 状态卡 | 标签「Semantic Engine」、状态点+状态文案、最后更新时间、主按钮(初始化/重新初始化/初始化中) |
| Progress 卡片 | 条件 | 初始化中时显示进度条与文案 |
| Error 卡片 | 条件 | 初始化失败时：错误图标、失败文案、错误类型、[RETRY] 按钮 |
| Embedding Model 区块 | 标题+网格 | 标题「Embedding Model」、多张模型卡(multilingual-e5-small/base/large)：名称、描述、性能/尺寸/维度标签、选中勾选、点击切换模型 |
| Model 切换进度 | 条件 | 切换或下载中时显示进度条与文案 |

---

## 3. Data（💾）

| 元素 | 类型 | 说明 |
|------|------|------|
| Indexed Pages 卡 | 统计卡 | 标签、文档图标、数字(已索引页数) |
| Index Size 卡 | 统计卡 | 标签、数据库图标、索引大小(MB) |
| Active Tabs 卡 | 统计卡 | 标签、Tab 图标、当前 Tab 数 |
| Vector Documents 卡 | 统计卡 | 标签、向量图标、向量文档总数 |
| Index Data Management 卡 | 操作区 | 标题、清除中进度(条件)、「Clear All Data」按钮 → 触发确认弹窗 |
| Model Cache Management 卡 | 子组件 | 缓存大小/条数、缓存条目列表(URL/大小/年龄/过期)、「Clean Expired」「Clear All Cache」按钮、处理中进度 |

**ConfirmDialog**（清除数据确认）：标题、警告文案、列表项、不可逆提示、确认/取消按钮、确认中状态。

---

## 4. Extensions（🧩）

| 元素 | 类型 | 说明 |
|------|------|------|
| Global Task System 区块 | 控制区 | 图标(⚡/⏸️)、标题「Global Task System」、状态文案(Stopped/Running/Paused + N extensions enabled)、实时统计(completed/pending)、Start / Pause / Resume / Stop 按钮、运行/暂停提示条、错误提示条 |
| Extensions 标题行 | 标题+按钮 | 「Extensions」、Expand All / Collapse All |
| 扩展卡片网格 | 卡片列表 | 每张卡：图标、名称、描述、状态标签(ACTIVE/COMING SOON)、Running 指示(可选)、启用开关；点击卡片展开/收起，展开后渲染该扩展的配置组件 |
| 内置扩展及展开内容 | 子组件 | **API Settings**：扩展 API 配置；**Local Task Queue**：本地任务队列；**Task Queue Logs (LogViewerPanel)**：任务队列日志；**Bing Dictionary**：查词与翻译；**Deepseek Chat**：AI 对话 |

---

## 5. Audio（🎙️）

| 元素 | 类型 | 说明 |
|------|------|------|
| 面板标题栏 | 标题+折叠 | 「Audio Recording」、▼/▲ 折叠按钮 |
| Recording Status | 状态区 | 录制状态标签、状态点+文案；录制中时显示时长、Chunk 数 |
| API Server Configuration | 配置区 | 标题；服务器列表：每项含启用复选框、名称输入、删除按钮；启用时展开：URL、Auth Token、Streaming Mode(Realtime/Chunks/File)、Chunk Interval(Chunks 时)；「Add API Server」按钮 |
| Recording Settings | 配置区 | 标题；Include Microphone、Save Locally、Auto-stop on silence 复选框；静默时长(数字)；Max Duration 下拉(1/5/10/30/60 分钟/无限制) |
| Session Metadata | 配置区 | 标题、JSON 文本框、说明文案、错误提示 |
| Quick Actions | 按钮组 | 「Start Recording」「Stop Recording」(按录制状态禁用) |
| Background Streaming | 开关区 | 启用后台流式传输复选框、Active 角标、说明文案 |

---

## 6. Settings（⚙️）

| 元素 | 类型 | 说明 |
|------|------|------|
| 页头 | 标题区 | 「⚙️ Settings Center」「Unified Configuration Management」 |
| API Configuration 卡 | 表单 | API Endpoint 下拉(预设+Custom)；Custom 时显示 Custom URL 输入；当前 URL 展示 |
| Task Queue 卡 | 表单+统计 | Enable Task Queue 开关；启用后：Queue Status、Pause/Resume 按钮、Max Concurrent 滑块(1–10)、Retry Attempts 滑块(0–5)、Pending/Running/Completed/Failed 统计、Clear Completed、Clear All 按钮 |
| Server 卡 | 表单+状态 | Auto Connect 开关、Server Port 数字输入(1024–65535)、连接状态指示(Connected/Disconnected + 端口) |
| Other 卡 | 开关+按钮 | Debug Mode 开关、Reset All Settings 按钮(带确认) |

---

## 7. Debug（🐛）

| 元素 | 类型 | 说明 |
|------|------|------|
| Debug Toggle 卡 | 按钮 | [SHOW DEBUG] / [HIDE DEBUG] 切换 |
| Connection Status 卡 | 条件 | 展开时显示：nativeConnectionStatus、isConnecting、port 的 JSON |
| Server Status 卡 | 条件 | 展开时显示：serverStatus 的 JSON |
| Debug Logs 卡 | 条件 | 展开时：标题、[CLEAR] 按钮、日志列表(时间、级别、消息)，级别区分颜色(ERROR/SUCCESS/INFO)，最大高度可滚动 |

---

## Tab 与入口汇总

| Tab ID | 图标 | 标签 | 主内容 |
|--------|------|------|--------|
| server | ⚡ | Server | 服务状态、连接端口、MCP 配置复制 |
| semantic | 🧠 | Semantic | 语义引擎状态、嵌入模型选择与切换 |
| data | 💾 | Data | 存储统计、清除索引、模型缓存管理 |
| extensions | 🧩 | Extensions | 全局任务系统、扩展列表与配置 |
| audio | 🎙️ | Audio | 录音与 API 服务器、后台流式 |
| settings | ⚙️ | Settings | API、任务队列、服务器、调试、重置 |
| debug | 🐛 | Debug | 连接/服务状态与调试日志 |

---

## 关键子组件路径

- `popup/App.vue` — 主布局与 7 Tab
- `popup/components/ConfirmDialog.vue` — 清除数据确认
- `popup/components/ProgressIndicator.vue` — 进度条
- `popup/components/ModelCacheManagement.vue` — 模型缓存
- `popup/components/ExtensionsPanel.vue` — Extensions Tab 内容
- `popup/components/AudioRecordingPanel.vue` — Audio Tab 内容
- `popup/components/SettingsCenter.vue` — Settings Tab 内容
- `popup/components/ApiSettings.vue` — 扩展「API Settings」
- `popup/components/extensions/LocalTaskQueue.vue` — 扩展「Local Task Queue」
- `popup/components/extensions/LogViewerPanel.vue` — 扩展「Task Queue Logs」
- `popup/components/extensions/BingDictionary.vue` — 扩展「Bing Dictionary」
- `popup/components/extensions/DeepseekChat.vue` — 扩展「Deepseek Chat」
- `popup/components/LanguageSelector.vue` — 顶部语言选择

扩展配置定义见：`composables/useExtensionConfig.ts`（EXTENSION_REGISTRY）。
