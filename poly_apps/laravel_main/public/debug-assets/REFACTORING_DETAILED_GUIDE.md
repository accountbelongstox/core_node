# Debug Assets 超详细重构指南 v3.0

> **严格执行要求：本文档必须100%遵守，任何偏差都是错误！**
>
> **目标读者：** Cursor AI / Claude AI / 其他 AI Assistant
> **架构要求：** iframe 中心化架构 + 统一 API 调用
> **禁止行为：** 任何形式的二次封装、防御性编程、HTML/CSS 混写

---

## 🚨 核心架构规则（违反即失败）

### 架构原则 #1: iframe 中心化架构

**主页面：** `debug_interface_template.html`
**作用：** 只包含导航菜单和 iframe 容器
**加载内容：** 通过 iframe 加载各个子页面

**子页面：** 所有 `debug-tools/sections/*.html`
**要求：**
- 必须是完整的 HTML 文档（包含 `<!DOCTYPE html>`）
- 必须自行引入所需的 CSS 和 JS 文件
- 禁止依赖父页面的任何资源
- 禁止与父页面通信（除非必要）

### 架构原则 #2: 中心化 API 调用

**唯一 API 客户端：** `js/api-client.js` 中的 `apiClientInstance`
**调用方式：**
```javascript
// ✅ 唯一正确的方式
const data = await apiClientInstance.json(url, method, data, options);
const response = await apiClientInstance.get(url, options);
const response = await apiClientInstance.post(url, data, options);
```

**API 端点定义位置：** `js/api-client.js` 的 `ApiClient.PointUrlKey` 对象
**禁止行为：**
- ❌ 使用原始 `fetch()` 调用
- ❌ 使用 `axios`、`$.ajax` 等其他库
- ❌ 创建任何封装函数（包括在 api-client.js 中）
- ❌ 在其他文件中定义 API 端点 URL

### 架构原则 #3: 完全分离 HTML/CSS/JS

**HTML 文件职责：** 只包含结构和 data 属性
**CSS 文件职责：** 只包含样式规则
**JS 文件职责：** 只包含逻辑和事件处理

**禁止行为：**
- ❌ JS 中包含任何 HTML 字符串
- ❌ JS 中包含任何 CSS 样式代码
- ❌ HTML 中包含内联 `style=` 属性
- ❌ HTML 中包含内联事件 `onclick=` 等

### 架构原则 #4: 信任式编程（零防御）

**要求：** 直接访问对象属性，假设数据总是正确的

**禁止的防御性代码：**
```javascript
// ❌ 禁止使用 || 操作符提供默认值
const value = data.value || 'default';

// ❌ 禁止使用可选链
const name = user?.profile?.name;

// ❌ 禁止检查 null/undefined
if (!data) return;
if (data === null) return;
if (data === undefined) return;

// ❌ 禁止空 catch 块
try {
    something();
} catch (e) {
    // 什么都不做
}

// ❌ 禁止检查数组长度
if (items && items.length > 0) { }
```

**正确的信任式编程：**
```javascript
// ✅ 直接访问
const value = data.value;
const name = user.profile.name;
const items = data.items;
```

---

## 📁 完整文件清单（100个文件）

### 主页面（1个）
```
debug_interface_template.html                    # 主页面框架
```

### 子页面 HTML（8个）
```
debug-tools/sections/api-testing-section.html    # API 测试页面 [✅ 已重构]
debug-tools/sections/dev-tools-section.html      # 开发工具页面 [🔧 需重构]
debug-tools/sections/mcp-manager-section.html    # MCP 管理器页面 [🔧 需重构]
debug-tools/sections/code-browser-section.html   # 代码浏览器页面 [🔧 需重构]
debug-tools/sections/static-resources-section.html # 静态资源页面 [🔧 需重构]
debug-tools/sections/octane-tasks-section.html   # Octane 任务页面 [🔧 需重构]
debug-tools/sections/system-info-section.html    # 系统信息页面 [🔧 需重构]
debug-tools/sections/learning-section.html       # 学习页面 [🔧 需重构]
```

### 其他 HTML 页面（13个）
```
debug-tools/code-browser-auto-rename.html        # 代码浏览器自动重命名 [🔧 需重构]
debug-tools/code-browser-tools.html              # 代码浏览器工具 [🔧 需重构]
debug-tools/vocabulary-learning.html             # 词汇学习 [🔧 需重构]
debug-tools/vocabulary-learning-demo.html        # 词汇学习演示 [🔧 需重构]
debug-tools/voice-subtitle.html                  # 语音字幕 [🔧 需重构]
debug-tools/dialogs/code-browser-dialogs.html    # 代码浏览器对话框 [🔧 需检查]
debug-tools/dialogs/static-resources-dialogs.html # 静态资源对话框 [🔧 需检查]
debug-tools/placeholders/placeholder-elements.html # 占位符元素 [🔧 需检查]
debug-tools/templates/auth-modal.html            # 认证模态框 [🔧 需检查]
debug-tools/templates/loading.html               # 加载模板 [🔧 需检查]
debug-tools/templates/api-item.html              # API 项模板 [✅ 已检查]
debug-tools/templates/feature-docs.html          # 功能文档模板 [✅ 已检查]
debug-tools/templates/shared-header-item.html    # 共享头部项模板 [✅ 已检查]
debug-tools/templates/shared-headers-section.html # 共享头部区域模板 [✅ 已检查]
```

### MCP 模板文件（10个）
```
debug-tools/templates/mcp-batch-item.html        # MCP 批处理项 [🔧 需检查]
debug-tools/templates/mcp-menu-item.html         # MCP 菜单项 [🔧 需检查]
debug-tools/templates/mcp-placeholder-module.html # MCP 占位符模块 [🔧 需检查]
debug-tools/templates/mcp-prompt-mapping-editor.html # MCP 提示映射编辑器 [🔧 需检查]
debug-tools/templates/mcp-prompt-mappings-module.html # MCP 提示映射模块 [🔧 需检查]
debug-tools/templates/mcp-screenshot-detail.html  # MCP 截图详情 [🔧 需检查]
debug-tools/templates/mcp-screenshot-list-empty.html # MCP 空截图列表 [🔧 需检查]
debug-tools/templates/mcp-screenshot-list-item.html # MCP 截图列表项 [🔧 需检查]
debug-tools/templates/mcp-screenshot-module.html  # MCP 截图模块 [🔧 需检查]
debug-tools/templates/mcp-settings-module.html    # MCP 设置模块 [🔧 需检查]
debug-tools/templates/mcp-task-dispatch-module.html # MCP 任务调度模块 [🔧 需检查]
debug-tools/templates/mcp-upload-item.html        # MCP 上传项 [🔧 需检查]
```

### ITTools 模板文件（需创建约60个）
```
debug-tools/templates/ittools/clipboard.html     # ✅ 已创建
debug-tools/templates/ittools/*.html             # 🔧 需为每个工具创建
```

### JavaScript 文件（54个）

#### 核心 JS（3个）
```
js/api-client.js                                 # API 客户端 [✅ 已完成]
js/debug-interface.js                            # 主界面逻辑 [🔧 需检查]
js/api-testing-section.js                       # API 测试页面 [✅ 已重构]
```

#### 认证和初始化（3个）
```
js/auth-helper.js                                # 认证辅助 [🔧 需重构]
js/debug-init.js                                 # 初始化脚本 [🔧 需重构]
js/debug-registry.js                             # 注册表 [🔧 需重构]
```

#### ITTools 核心（6个）
```
js/ittools-core.js                               # IT工具核心 [🔧 需重构]
js/ittools-menu-config.js                        # IT工具菜单配置 [🔧 需重构]
js/ittools-menu-universal.js                     # IT工具通用菜单 [🔧 需重构]
js/ittools-tools.js                              # IT工具注册 [🔧 需重构]
js/ittools-advanced-tools.js                     # IT高级工具 [🔧 需重构]
js/ittools-client-tools.js                       # IT客户端工具 [🔧 需重构]
js/ittools-tts-helper.js                         # IT工具 TTS 辅助 [🔧 需重构]
```

#### ITTools 实现（30个）
```
js/ittools-impl-clipboard.js                     # 剪贴板工具 [🔧 需重构]
js/ittools-impl-converters.js                    # 转换器工具 [🔧 需重构]
js/ittools-impl-crypto.js                        # 加密工具 [🔧 需重构]
js/ittools-impl-dev.js                           # 开发工具 [🔧 需重构]
js/ittools-impl-formatters.js                    # 格式化工具 [🔧 需重构]
js/ittools-impl-generators.js                    # 生成器工具 [🔧 需重构]
js/ittools-impl-generators-2.js                  # 生成器工具2 [🔧 需重构]
js/ittools-impl-images.js                        # 图像工具 [🔧 需重构]
js/ittools-impl-text.js                          # 文本工具 [🔧 需重构]
js/ittools-impl-translation.js                   # 翻译工具 [🔧 需重构]
js/ittools-impl-web.js                           # Web工具 [🔧 需重构]
js/ittools-impl-batch1a.js                       # 批处理1a [🔧 需重构]
js/ittools-impl-batch1b.js                       # 批处理1b [🔧 需重构]
js/ittools-impl-batch2.js                        # 批处理2 [🔧 需重构]
js/ittools-impl-batch3a.js                       # 批处理3a [🔧 需重构]
js/ittools-impl-batch3b.js                       # 批处理3b [🔧 需重构]
js/ittools-impl-batch4.js                        # 批处理4 [🔧 需重构]
js/ittools-impl-batch5.js                        # 批处理5 [🔧 需重构]
js/ittools-impl-batch6a.js                       # 批处理6a [🔧 需重构]
js/ittools-impl-batch6b.js                       # 批处理6b [🔧 需重构]
js/ittools-impl-batch7a.js                       # 批处理7a [🔧 需重构]
js/ittools-impl-batch7b.js                       # 批处理7b [🔧 需重构]
js/ittools-impl-batch8.js                        # 批处理8 [🔧 需重构]
js/ittools-impl-batch9.js                        # 批处理9 [🔧 需重构]
js/ittools-impl-batch10.js                       # 批处理10 [🔧 需重构]
js/ittools-impl-batch11.js                       # 批处理11 [🔧 需重构]
js/ittools-impl-batch12.js                       # 批处理12 [🔧 需重构]
js/ittools-impl-batch13.js                       # 批处理13 [🔧 需重构]
js/ittools-impl-batch14.js                       # 批处理14 [🔧 需重构]
js/ittools-impl-batch15.js                       # 批处理15 [🔧 需重构]
```

#### 其他模块（9个）
```
js/mcp-manager.js                                # MCP 管理器 [🔧 需重构]
js/mcp-placeholder-module.js                     # MCP 占位符模块 [🔧 需重构]
js/code-browser.js                               # 代码浏览器 [🔧 需重构]
js/static-resource-browser.js                    # 静态资源浏览器 [🔧 需重构]
js/octane-tasks-manager.js                       # Octane 任务管理器 [🔧 需重构]
js/prompt-mapping-manager.js                     # 提示映射管理器 [🔧 需重构]
js/prompts-manager.js                            # 提示管理器 [🔧 需重构]
js/prompts-tasks-manager.js                      # 提示任务管理器 [🔧 需重构]
debug-tools/assets/auto-rename-helper.js        # 自动重命名辅助 [🔧 需检查]
debug-tools/assets/demo.js                       # 演示脚本 [🔧 需检查]
debug-tools/assets/main.js                       # 主脚本 [🔧 需检查]
```

### CSS 文件（11个）
```
css/debug-interface.css                          # 主界面样式 [✅ 已完成]
css/api-testing-section.css                      # API测试样式 [✅ 已完成]
css/dev-tools-section.css                        # 开发工具样式 [✅ 已完成]
css/ittools-layout.css                           # IT工具布局 [✅ 已恢复]
css/ittools-clipboard.css                        # IT剪贴板样式 [✅ 已创建]
css/mcp-manager.css                              # MCP管理器样式 [✅ 已恢复]
css/static-resources.css                         # 静态资源样式 [✅ 已恢复]
debug-tools/templates/auth-modal.css             # 认证模态框样式 [🔧 需检查]
debug-tools/assets/demo.css                      # 演示样式 [🔧 需检查]
debug-tools/assets/index.css                     # 索引样式 [🔧 需检查]
debug-tools/assets/main.css                      # 主样式 [🔧 需检查]
```

---

## 🔍 已发现的 API 端点（从现有代码提取）

### ITTools API 端点（已测试）
```
POST /api/ittools/v1/crypto/bcrypt/hash
  请求: {"password": "string"}
  响应: {"success": true, "data": {"hash": "string"}, "timestamp": "string"}

POST /api/ittools/v1/crypto/bcrypt/verify
  请求: {"password": "string", "hash": "string"}
  响应: {"success": true, "data": {"valid": boolean}, "timestamp": "string"}

POST /api/ittools/v1/crypto/ulid/generate
GET  /api/ittools/v1/converter/json-to-yaml
POST /api/ittools/v1/converter/yaml-to-json
GET  /api/ittools/v1/web/markdown/to-html
POST /api/ittools/v1/web/xml/format
POST /api/ittools/v1/web/yaml/format
POST /api/ittools/v1/web/sql/format
POST /api/ittools/v1/advanced/image/compress
POST /api/ittools/v1/advanced/image/crop
POST /api/ittools/v1/advanced/pdf/split
POST /api/ittools/v1/crypto/bip39/generate
```

### Clipboard API 端点（已测试）
```
GET  /clipboard/data?namespace={id}
  响应: {
    "success": true,
    "data": {
      "namespace": "string",
      "current": {
        "text": "string",
        "files": [],
        "updated_at": "ISO8601"
      },
      "history": []
    }
  }

POST /clipboard/text
  请求: {"namespace": "string", "text": "string"}

POST /clipboard/upload
  Content-Type: multipart/form-data

POST /clipboard/delete-file
  请求: {"namespace": "string", "stored_name": "string"}

POST /clipboard/new
  请求: {"namespace": "string"}

POST /clipboard/restore
  请求: {"namespace": "string", "history_index": number}
```

### 公共 API 端点
```
GET  /api_info                                   # API 信息
POST /api_headers_cache/save                     # 保存缓存头部
POST /api_headers_cache/reset                    # 重置缓存头部
POST /api_params_cache/save                      # 保存参数缓存
GET  /api_params_cache/load                      # 加载参数缓存
```

---

## 📋 重构执行清单

### 步骤 1: 扫描并提取 API 端点

**对每个 JS 文件执行：**

1. **查找所有 API 调用**
   ```bash
   grep -n "fetch(\|apiClientInstance\|axios\|\.post(\|\.get(" {文件名}.js
   ```

2. **提取 URL 和参数**
   - 记录 API URL
   - 记录 HTTP 方法
   - 记录请求参数
   - 记录响应结构

3. **实际测试 API**
   ```bash
   # 对每个发现的端点执行
   curl -X {METHOD} http://127.0.0.1:9000{API_PATH} \
        -H "Content-Type: application/json" \
        -d '{测试数据}' | python3 -m json.tool
   ```

4. **记录数据结构**
   - 在文档中记录真实的请求/响应结构
   - 不允许猜测或假设数据结构

### 步骤 2: 更新 api-client.js

**文件位置：** `js/api-client.js`

**操作：**

在 `ApiClient.PointUrlKey` 对象中添加所有发现的端点：

```javascript
ApiClient.PointUrlKey = {
    // 现有端点...
    API_INFO: '/api_info',

    // ITTools Crypto
    ITTOOLS_CRYPTO_BCRYPT_HASH: '/api/ittools/v1/crypto/bcrypt/hash',
    ITTOOLS_CRYPTO_BCRYPT_VERIFY: '/api/ittools/v1/crypto/bcrypt/verify',
    ITTOOLS_CRYPTO_ULID_GENERATE: '/api/ittools/v1/crypto/ulid/generate',
    ITTOOLS_CRYPTO_BIP39_GENERATE: '/api/ittools/v1/crypto/bip39/generate',

    // ITTools Converters
    ITTOOLS_CONVERTER_JSON_YAML: '/api/ittools/v1/converter/json-to-yaml',
    ITTOOLS_CONVERTER_YAML_JSON: '/api/ittools/v1/converter/yaml-to-json',

    // ITTools Formatters
    ITTOOLS_FORMAT_XML: '/api/ittools/v1/web/xml/format',
    ITTOOLS_FORMAT_YAML: '/api/ittools/v1/web/yaml/format',
    ITTOOLS_FORMAT_SQL: '/api/ittools/v1/web/sql/format',

    // ITTools Web
    ITTOOLS_WEB_MARKDOWN_HTML: '/api/ittools/v1/web/markdown/to-html',

    // ITTools Image
    ITTOOLS_IMAGE_COMPRESS: '/api/ittools/v1/advanced/image/compress',
    ITTOOLS_IMAGE_CROP: '/api/ittools/v1/advanced/image/crop',

    // ITTools PDF
    ITTOOLS_PDF_SPLIT: '/api/ittools/v1/advanced/pdf/split',

    // Clipboard
    CLIPBOARD_DATA: '/clipboard/data',
    CLIPBOARD_TEXT: '/clipboard/text',
    CLIPBOARD_UPLOAD: '/clipboard/upload',
    CLIPBOARD_DELETE_FILE: '/clipboard/delete-file',
    CLIPBOARD_NEW: '/clipboard/new',
    CLIPBOARD_RESTORE: '/clipboard/restore',

    // MCP (需要扫描 mcp-manager.js 提取)
    MCP_SCREENSHOTS_LIST: '/api/mcp/v1/screenshots',
    MCP_SCREENSHOTS_UPLOAD: '/api/mcp/v1/screenshots/upload',
    // ... 其他 MCP 端点

    // Code Browser (需要扫描 code-browser.js 提取)
    // ... Code Browser 端点

    // Static Resources (需要扫描 static-resource-browser.js 提取)
    // ... Static Resources 端点
};
```

**禁止行为：**
- ❌ 在 api-client.js 中添加任何封装方法
- ❌ 在 api-client.js 中添加业务逻辑
- ❌ 在其他文件中定义端点 URL

### 步骤 3: 检查所有 HTML 文件

**对每个 HTML 文件执行以下检查：**

#### 检查 1: 是否有内联样式
```bash
grep -n 'style=' {文件名}.html
```
**如果发现：** 将所有内联样式提取到对应的 CSS 文件

#### 检查 2: 是否有内联事件
```bash
grep -n 'onclick=\|onchange=\|oninput=\|onsubmit=' {文件名}.html
```
**如果发现：** 替换为 `data-action` 属性

#### 检查 3: 子页面是否完整
**如果是 sections/ 目录下的文件：**
- 必须包含 `<!DOCTYPE html>`
- 必须包含完整的 `<head>` 和 `<body>`
- 必须引入所需的 CSS
- 必须引入所需的 JS
- 必须引入 `api-client.js`

#### 检查 4: 模板文件是否纯净
**如果是 templates/ 目录下的文件：**
- 不允许有 `<style>` 标签
- 不允许有 `<script>` 标签
- 不允许有内联 `style=` 属性
- 不允许有内联事件属性
- 必须使用 `data-*` 属性标记元素

### 步骤 4: 重构所有 JS 文件

**对每个 JS 文件执行：**

#### 4.1 移除 HTML 字符串

**检测命令：**
```bash
grep -n "innerHTML\|<div\|<button\|<input\|<select\|<textarea\|<span\|<p\|<h1\|<h2\|<h3\|<form" {文件名}.js
```

**执行操作：**
1. 找到所有 HTML 字符串
2. 为每个工具/功能创建独立的 HTML 模板文件
3. 将模板文件放在 `debug-tools/templates/ittools/` 或其他适当位置
4. 在 JS 中使用 `fetch()` 加载模板
5. 模板加载必须在 `render()` 或 `init()` 方法中完成

#### 4.2 移除内联样式代码

**检测命令：**
```bash
grep -n '\.style\.\|style=' {文件名}.js
```

**执行操作：**
1. 找到所有样式设置代码
2. 将样式规则提取到对应的 CSS 文件
3. 使用 class 名称替代内联样式
4. 使用 `classList.add/remove/toggle` 控制状态

#### 4.3 替换所有 API 调用

**检测命令：**
```bash
grep -n "fetch(\|axios\|\.ajax" {文件名}.js
```

**执行操作：**
1. 找到所有 API 调用
2. 替换为 `apiClientInstance.json()` 或其他方法
3. 使用 `ApiClient.PointUrlKey` 中定义的常量
4. 不允许直接写 URL 字符串

**替换规则：**
```javascript
// ❌ 错误：原始 fetch
const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
const result = await response.json();

// ✅ 正确：使用 apiClientInstance
const result = await apiClientInstance.json(
    ApiClient.PointUrlKey.ENDPOINT_NAME,
    'POST',
    data
);
```

#### 4.4 移除防御性编程

**检测命令：**
```bash
grep -n '||.*default\|??\|?.\|if (!.*)\|if (.*=== null)\|if (.*=== undefined)' {文件名}.js
```

**执行操作：**
1. 删除所有 `||` 默认值操作符
2. 删除所有 `??` 空值合并操作符
3. 删除所有 `?.` 可选链操作符
4. 删除所有 null/undefined 检查
5. 删除所有空 catch 块

#### 4.5 实现事件委托

**要求：**
- 使用 `document.addEventListener` 在容器级别监听事件
- 使用 `e.target.closest('[data-action]')` 查找触发元素
- 根据 `data-action` 属性值分发到对应处理函数
- 不允许为每个按钮单独绑定事件

### 步骤 5: 更新子页面 HTML

**对每个子页面（sections/*.html）：**

#### 5.1 确保完整性

**检查清单：**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{页面标题}</title>

    <!-- 引入所需的 CSS -->
    <link rel="stylesheet" href="/debug-assets/css/{page}.css">
    <!-- 如果有额外的 CSS，继续添加 -->
</head>
<body>
    <!-- 页面内容 -->

    <!-- 必须首先引入 api-client.js -->
    <script src="/debug-assets/js/api-client.js"></script>

    <!-- 引入所需的 JS 文件 -->
    <script src="/debug-assets/js/{page}.js"></script>
    <!-- 如果有额外的 JS，继续添加 -->
</body>
</html>
```

#### 5.2 检查引用完整性

**dev-tools-section.html 必须引入所有 ITTools JS：**
```html
<script src="/debug-assets/js/api-client.js"></script>
<script src="/debug-assets/js/ittools-core.js"></script>
<script src="/debug-assets/js/ittools-menu-config.js"></script>
<script src="/debug-assets/js/ittools-menu-universal.js"></script>
<script src="/debug-assets/js/ittools-tools.js"></script>
<script src="/debug-assets/js/ittools-advanced-tools.js"></script>
<script src="/debug-assets/js/ittools-client-tools.js"></script>
<script src="/debug-assets/js/ittools-tts-helper.js"></script>
<script src="/debug-assets/js/ittools-impl-clipboard.js"></script>
<script src="/debug-assets/js/ittools-impl-converters.js"></script>
<script src="/debug-assets/js/ittools-impl-crypto.js"></script>
<script src="/debug-assets/js/ittools-impl-dev.js"></script>
<script src="/debug-assets/js/ittools-impl-formatters.js"></script>
<script src="/debug-assets/js/ittools-impl-generators.js"></script>
<script src="/debug-assets/js/ittools-impl-generators-2.js"></script>
<script src="/debug-assets/js/ittools-impl-images.js"></script>
<script src="/debug-assets/js/ittools-impl-text.js"></script>
<script src="/debug-assets/js/ittools-impl-translation.js"></script>
<script src="/debug-assets/js/ittools-impl-web.js"></script>
<script src="/debug-assets/js/ittools-impl-batch1a.js"></script>
<script src="/debug-assets/js/ittools-impl-batch1b.js"></script>
<script src="/debug-assets/js/ittools-impl-batch2.js"></script>
<script src="/debug-assets/js/ittools-impl-batch3a.js"></script>
<script src="/debug-assets/js/ittools-impl-batch3b.js"></script>
<script src="/debug-assets/js/ittools-impl-batch4.js"></script>
<script src="/debug-assets/js/ittools-impl-batch5.js"></script>
<script src="/debug-assets/js/ittools-impl-batch6a.js"></script>
<script src="/debug-assets/js/ittools-impl-batch6b.js"></script>
<script src="/debug-assets/js/ittools-impl-batch7a.js"></script>
<script src="/debug-assets/js/ittools-impl-batch7b.js"></script>
<script src="/debug-assets/js/ittools-impl-batch8.js"></script>
<script src="/debug-assets/js/ittools-impl-batch9.js"></script>
<script src="/debug-assets/js/ittools-impl-batch10.js"></script>
<script src="/debug-assets/js/ittools-impl-batch11.js"></script>
<script src="/debug-assets/js/ittools-impl-batch12.js"></script>
<script src="/debug-assets/js/ittools-impl-batch13.js"></script>
<script src="/debug-assets/js/ittools-impl-batch14.js"></script>
<script src="/debug-assets/js/ittools-impl-batch15.js"></script>
```

**mcp-manager-section.html 必须引入：**
```html
<script src="/debug-assets/js/api-client.js"></script>
<script src="/debug-assets/js/mcp-manager.js"></script>
<script src="/debug-assets/js/mcp-placeholder-module.js"></script>
```

**code-browser-section.html 必须引入：**
```html
<script src="/debug-assets/js/api-client.js"></script>
<script src="/debug-assets/js/code-browser.js"></script>
```

**static-resources-section.html 必须引入：**
```html
<script src="/debug-assets/js/api-client.js"></script>
<script src="/debug-assets/js/static-resource-browser.js"></script>
```

**octane-tasks-section.html 必须引入：**
```html
<script src="/debug-assets/js/api-client.js"></script>
<script src="/debug-assets/js/octane-tasks-manager.js"></script>
```

---

## ✅ 验证检查清单

### 自动化验证命令

**在 debug-assets 目录执行：**

```bash
#!/bin/bash

echo "========================================="
echo "重构验证检查"
echo "========================================="

# 检查 1: JS 文件中的 HTML 字符串
echo ""
echo "检查 1: JS 文件中的 HTML 字符串"
echo "-----------------------------------------"
HTML_IN_JS=$(grep -r '<div\|<button\|<input\|innerHTML' js/*.js | grep -v "\.bak\|\.old" | wc -l)
if [ "$HTML_IN_JS" -gt 0 ]; then
    echo "❌ 失败: 发现 $HTML_IN_JS 处 HTML 字符串"
    grep -rn '<div\|<button\|<input\|innerHTML' js/*.js | grep -v "\.bak\|\.old" | head -20
else
    echo "✅ 通过: 没有 HTML 字符串"
fi

# 检查 2: JS 文件中的内联样式
echo ""
echo "检查 2: JS 文件中的内联样式"
echo "-----------------------------------------"
STYLE_IN_JS=$(grep -r '\.style\.\|style=' js/*.js | grep -v "\.bak\|\.old\|stylesheet" | wc -l)
if [ "$STYLE_IN_JS" -gt 0 ]; then
    echo "❌ 失败: 发现 $STYLE_IN_JS 处内联样式"
    grep -rn '\.style\.\|style=' js/*.js | grep -v "\.bak\|\.old\|stylesheet" | head -20
else
    echo "✅ 通过: 没有内联样式"
fi

# 检查 3: HTML 文件中的内联样式
echo ""
echo "检查 3: HTML 文件中的内联样式"
echo "-----------------------------------------"
STYLE_IN_HTML=$(grep -r 'style=' debug-tools/**/*.html | wc -l)
if [ "$STYLE_IN_HTML" -gt 0 ]; then
    echo "❌ 失败: 发现 $STYLE_IN_HTML 处内联样式"
    grep -rn 'style=' debug-tools/**/*.html | head -20
else
    echo "✅ 通过: 没有内联样式"
fi

# 检查 4: HTML 文件中的内联事件
echo ""
echo "检查 4: HTML 文件中的内联事件"
echo "-----------------------------------------"
EVENTS_IN_HTML=$(grep -r 'onclick=\|onchange=\|oninput=' debug-tools/**/*.html | wc -l)
if [ "$EVENTS_IN_HTML" -gt 0 ]; then
    echo "❌ 失败: 发现 $EVENTS_IN_HTML 处内联事件"
    grep -rn 'onclick=\|onchange=\|oninput=' debug-tools/**/*.html | head -20
else
    echo "✅ 通过: 没有内联事件"
fi

# 检查 5: 原始 fetch 调用
echo ""
echo "检查 5: 原始 fetch 调用（应使用 apiClientInstance）"
echo "-----------------------------------------"
RAW_FETCH=$(grep -r 'fetch(' js/*.js | grep -v "\.bak\|\.old\|templateUrl\|\.html" | wc -l)
if [ "$RAW_FETCH" -gt 0 ]; then
    echo "⚠️  警告: 发现 $RAW_FETCH 处原始 fetch 调用"
    grep -rn 'fetch(' js/*.js | grep -v "\.bak\|\.old\|templateUrl\|\.html" | head -20
else
    echo "✅ 通过: 没有原始 fetch 调用"
fi

# 检查 6: apiClientInstance 使用
echo ""
echo "检查 6: apiClientInstance 使用统计"
echo "-----------------------------------------"
API_CLIENT_COUNT=$(grep -r 'apiClientInstance\.' js/*.js | grep -v "\.bak\|\.old" | wc -l)
echo "✅ 找到 $API_CLIENT_COUNT 处 apiClientInstance 调用"

# 检查 7: 防御性编程（|| 操作符）
echo ""
echo "检查 7: 防御性编程检查"
echo "-----------------------------------------"
DEFENSIVE_OR=$(grep -r '||.*["\x27]' js/*.js | grep -v "\.bak\|\.old\|console\|comment" | wc -l)
if [ "$DEFENSIVE_OR" -gt 0 ]; then
    echo "⚠️  警告: 发现 $DEFENSIVE_OR 处 || 默认值"
    grep -rn '||.*["\x27]' js/*.js | grep -v "\.bak\|\.old\|console\|comment" | head -10
else
    echo "✅ 通过: 没有 || 默认值"
fi

# 检查 8: 子页面完整性
echo ""
echo "检查 8: 子页面 HTML 结构完整性"
echo "-----------------------------------------"
for file in debug-tools/sections/*.html; do
    if grep -q '<!DOCTYPE html>' "$file"; then
        if grep -q '<script src="/debug-assets/js/api-client.js"></script>' "$file"; then
            echo "✅ $file 结构完整"
        else
            echo "❌ $file 缺少 api-client.js 引用"
        fi
    else
        echo "❌ $file 缺少 DOCTYPE"
    fi
done

echo ""
echo "========================================="
echo "验证检查完成"
echo "========================================="
```

### 手动验证清单

**对每个重构完成的模块：**

```
模块名称: _________________

[ ] 1. 所有 HTML 字符串已提取到模板文件
[ ] 2. 所有内联样式已提取到 CSS 文件
[ ] 3. 所有内联事件已替换为 data-action
[ ] 4. 所有 API 调用使用 apiClientInstance
[ ] 5. 所有 API 端点定义在 ApiClient.PointUrlKey
[ ] 6. 没有二次封装的函数
[ ] 7. 没有防御性编程代码
[ ] 8. 使用事件委托模式
[ ] 9. 子页面 HTML 结构完整
[ ] 10. 在浏览器中功能正常
[ ] 11. 没有控制台错误
[ ] 12. 没有 404 资源加载失败
[ ] 13. API 调用正常工作
[ ] 14. 响应式布局正常
[ ] 15. 所有按钮可点击
[ ] 16. 所有输入框可输入
[ ] 17. 数据正确显示
[ ] 18. 错误处理正确（如有）
[ ] 19. 代码可读性良好
[ ] 20. 符合所有架构规则
```

---

## 🎯 执行优先级

### Phase 1: ITTools 模块（最高优先级）

**原因：** 包含最多文件（30个实现文件），最复杂

**执行顺序：**
1. ✅ 已完成 `ittools-impl-clipboard.js`
2. 🔧 `ittools-impl-text.js` （包含12个工具）
3. 🔧 `ittools-impl-crypto.js` （包含10个工具）
4. 🔧 `ittools-impl-formatters.js` （包含6个工具）
5. 🔧 `ittools-impl-converters.js` （包含13个工具）
6. 🔧 `ittools-impl-generators.js` + `ittools-impl-generators-2.js`
7. 🔧 `ittools-impl-images.js`
8. 🔧 `ittools-impl-translation.js`
9. 🔧 `ittools-impl-web.js`
10. 🔧 `ittools-impl-dev.js`
11. 🔧 所有 `ittools-impl-batch*.js` 文件（15个）

### Phase 2: MCP Manager 模块

**文件：**
- `js/mcp-manager.js`
- `js/mcp-placeholder-module.js`
- 所有 `debug-tools/templates/mcp-*.html` 文件

### Phase 3: Code Browser 模块

**文件：**
- `js/code-browser.js`
- `debug-tools/code-browser-*.html`
- `debug-tools/dialogs/code-browser-dialogs.html`

### Phase 4: Static Resources 模块

**文件：**
- `js/static-resource-browser.js`
- `debug-tools/dialogs/static-resources-dialogs.html`

### Phase 5: 其他子页面

**文件：**
- `debug-tools/sections/system-info-section.html`
- `debug-tools/sections/learning-section.html`
- `debug-tools/sections/octane-tasks-section.html`
- 相关的 JS 文件

---

## 📊 进度追踪

### 使用以下表格追踪进度

```
文件: js/ittools-impl-clipboard.js
[ ] API 端点已提取并测试
[ ] API 端点已添加到 api-client.js
[ ] HTML 模板已创建
[ ] CSS 文件已创建
[ ] JS 文件已重构（移除 HTML）
[ ] JS 文件已重构（移除内联样式）
[ ] JS 文件已重构（替换 API 调用）
[ ] JS 文件已重构（移除防御性编程）
[ ] 事件委托已实现
[ ] 自动化检查通过
[ ] 手动测试通过
```

**为每个文件复制上述清单！**

---

## 🚫 常见错误和禁止行为

### 错误 1: 二次封装 API 调用

```javascript
// ❌ 绝对禁止！
async function getUserData() {
    return await apiClientInstance.json('/api/user', 'GET');
}

// ❌ 绝对禁止！
class ApiService {
    async getUser() {
        return await apiClientInstance.json('/api/user', 'GET');
    }
}

// ✅ 正确：直接调用
const userData = await apiClientInstance.json(
    ApiClient.PointUrlKey.API_USER,
    'GET'
);
```

### 错误 2: 在非 api-client.js 文件中定义端点

```javascript
// ❌ 绝对禁止！在其他文件中定义
const ENDPOINTS = {
    USER: '/api/user',
    LOGIN: '/api/login'
};

// ✅ 正确：只在 api-client.js 中定义
// 在 api-client.js 中：
ApiClient.PointUrlKey = {
    API_USER: '/api/user',
    API_LOGIN: '/api/login'
};
```

### 错误 3: 使用内联 HTML

```javascript
// ❌ 绝对禁止！
function renderCard() {
    return `
        <div class="card">
            <h2>Title</h2>
            <p>Content</p>
        </div>
    `;
}

// ✅ 正确：使用模板文件
async function renderCard() {
    const response = await fetch('/debug-assets/templates/card.html');
    return await response.text();
}
```

### 错误 4: 防御性编程

```javascript
// ❌ 绝对禁止！
const name = user?.name || 'Unknown';
if (!data) return;
if (items && items.length > 0) {
    // ...
}

// ✅ 正确：信任式编程
const name = user.name;
const items = data.items;
```

---

## 📞 问题解决

### Q: 如何判断一个端点是否需要认证？

A: 查看 `/api_info` 返回的数据，查找端点的 `feature` 字段：
- `no_auth_required` = 不需要认证
- `auth_required` = 需要认证

### Q: 如何测试需要认证的端点？

A:
```bash
# 先登录获取 token
TOKEN=$(curl -X POST http://127.0.0.1:9000/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password"}' \
    | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

# 使用 token 调用需要认证的端点
curl -X GET http://127.0.0.1:9000/api/user \
    -H "Authorization: Bearer $TOKEN"
```

### Q: 模板文件放在哪里？

A:
- ITTools 工具模板：`debug-tools/templates/ittools/{tool-name}.html`
- MCP 模块模板：`debug-tools/templates/mcp-{module-name}.html`
- 通用模板：`debug-tools/templates/{template-name}.html`

### Q: CSS 文件如何命名？

A:
- 页面级 CSS：`css/{page-name}.css`
- 模块级 CSS：`css/{module-name}.css`
- 工具级 CSS（如果样式很多）：`css/ittools-{tool-name}.css`
- 工具级 CSS（如果样式较少）：合并到 `css/ittools-tools.css`

---

## 🎓 执行示范

**不包含任何代码示例！只有规范和要求！**

**Cursor AI 必须：**
1. 严格按照本文档执行
2. 不允许跳过任何检查
3. 不允许假设任何数据结构
4. 必须实际测试每个 API 端点
5. 必须执行所有验证命令
6. 每完成一个文件，更新进度清单
7. 遇到问题立即停止，不允许猜测

---

**文档版本：** v3.0
**最后更新：** 2025-12-02 21:30
**维护者：** CoreNode Development Team
**强制执行：** 违反任何规则视为失败
