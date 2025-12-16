# Bing Dictionary Multi-File Architecture

## 📁 文件结构

本模块采用**多文件架构**，所有文件均**不超过500行**，遵循关注点分离原则。

```
bing-dictionary/
├── README.md                     # 本文档
├── ClientModePanel.vue           # 105 行 - 客户端模式配置面板
├── SearchBox.vue                 #  54 行 - 搜索框组件
├── WordResult.vue                #  78 行 - 翻译结果显示组件
├── HistoryList.vue               #  42 行 - 历史记录列表组件
├── base-styles.css               # 383 行 - 基础样式
└── client-mode-styles.css        # 230 行 - 客户端模式样式

composables/
├── useBingDictionary.ts          # 167 行 - 词典查询逻辑
└── useBingDictionaryClient.ts    # 176 行 - 客户端模式逻辑

主组件:
└── BingDictionary.vue            # 132 行 - 主容器组件
```

## 🏗️ 架构设计

### 1. **组件分层**

#### 主组件 (BingDictionary.vue - 132行)
- 作为容器组件，组合所有子组件
- 使用 composables 管理状态和业务逻辑
- 处理事件委托和数据流

#### 子组件
- **ClientModePanel.vue** (105行): 自动翻译服务配置
  - 服务状态显示
  - API 配置表单
  - 统计数据展示

- **SearchBox.vue** (54行): 搜索输入
  - 输入框和搜索按钮
  - 加载状态显示
  - 错误消息展示

- **WordResult.vue** (78行): 结果展示
  - 单词信息显示
  - 音标和发音
  - 翻译、例句、同义词

- **HistoryList.vue** (42行): 历史记录
  - 最近搜索列表
  - 空状态提示

### 2. **Composables 逻辑**

#### useBingDictionary.ts (167行)
- 单词查询核心逻辑
- 历史记录管理
- 音频播放控制

#### useBingDictionaryClient.ts (176行)
- 客户端模式状态管理
- 服务启动/停止控制
- 配置持久化

### 3. **样式分离**

#### base-styles.css (383行)
- 主容器、头部、搜索框
- 结果显示、翻译、例句
- 历史记录、空状态

#### client-mode-styles.css (230行)
- 客户端模式配置卡片
- 服务状态指示器
- 统计数据网格

## 🔄 数据流

```
┌─────────────────────────────────────────────┐
│         BingDictionary.vue (主组件)          │
│              ├─ composables                  │
│              │  ├─ useBingDictionary        │
│              │  └─ useBingDictionaryClient  │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
   ┌───▼────┐     ┌───▼────────┐
   │ Search │     │ ClientMode │
   │  Box   │     │   Panel    │
   └───┬────┘     └────────────┘
       │
   ┌───▼────┐     ┌────────────┐
   │ Word   │     │  History   │
   │ Result │     │    List    │
   └────────┘     └────────────┘
```

## 🎯 设计原则

1. **单一职责**: 每个组件只负责一个功能领域
2. **行数限制**: 所有文件严格控制在500行以内
3. **逻辑分离**: 业务逻辑提取到 composables
4. **样式模块化**: CSS 按功能域拆分
5. **Props/Events**: 组件间通过 props 向下传递数据，通过 events 向上通知

## 📦 依赖关系

```
BingDictionary.vue
  ├─ composables/useBingDictionary
  ├─ composables/useBingDictionaryClient
  ├─ bing-dictionary/ClientModePanel
  ├─ bing-dictionary/SearchBox
  ├─ bing-dictionary/WordResult
  ├─ bing-dictionary/HistoryList
  ├─ base-styles.css
  └─ client-mode-styles.css
```

## 🔧 后端服务

### Background Services
- **bing-dictionary-client-service.ts** (283行)
  - 自动翻译队列管理
  - API 请求处理
  - 统计数据维护

- **bing-dictionary-client-listener.ts** (81行)
  - 消息监听和路由
  - 服务控制接口

### MCP Tools
- **bing-dictionary.ts** (156行)
  - Bing 词典查询工具
  - Tab 管理和内容提取

- **bing-dictionary-helper.js** (163行)
  - 页面内容提取脚本
  - 数据解析和格式化

## 📊 文件行数统计

| 文件类型 | 文件数 | 总行数 | 平均行数 | 最大行数 |
|---------|--------|--------|---------|---------|
| Vue组件 | 5 | 411 | 82 | 132 |
| Composables | 2 | 343 | 172 | 176 |
| CSS | 2 | 613 | 307 | 383 |
| 后端服务 | 4 | 683 | 171 | 283 |
| **总计** | **13** | **2050** | **158** | **383** |

✅ 所有文件均符合 **≤ 500行** 的要求！

## 🚀 维护指南

### 添加新功能
1. 如果是UI功能，创建新的子组件（< 100行）
2. 如果是逻辑功能，添加到相应 composable
3. 如果需要新样式，添加到对应 CSS 文件

### 重构准则
- 当文件超过 400 行时考虑拆分
- 提取可复用逻辑到 composables
- 提取可复用组件到独立文件

### 代码规范
- 使用 TypeScript 严格类型检查
- Props/Events 明确定义接口
- CSS 使用 BEM 命名或语义化类名
- 注释说明复杂逻辑
