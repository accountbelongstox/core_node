# Debug Assets 重构文档

## 重构目标

1. **架构统一化**：使用 iframe 架构，主页面只加载主 JS/CSS，子页面加载各自的 JS/CSS
2. **API 中心化**：所有 API 调用统一使用 `apiClientInstance` (来自 `api-client.js`)
3. **代码分离**：移除所有内联 CSS/JS，HTML/CSS/JS 完全分离
4. **信任式编程**：移除所有防御性编程检查（`||`, `if(null)`, `has`, 空 `catch` 等）
5. **模板化**：所有动态 HTML 提取到模板文件

## 重构原则

- **不允许 JS 和 HTML 混写**：HTML 提取到对应的页面文件中
- **不允许内联 CSS/JS**：所有样式和脚本必须使用外部文件
- **使用中心化 API**：所有 API 调用必须通过 `apiClientInstance` (来自 `api-client.js`)
- **使用 iframe 架构**：子页面通过 iframe 加载
- **信任式编程**：直接访问属性，不做防御性检查

## 文件分类清单

### 1. 主页面（Main Interface）

#### 已完成
- ✅ `debug_interface_template.html` - 主页面模板（已使用 iframe 架构）
- ✅ `js/api-client.js` - 统一 API 客户端（已创建）

#### 待重构
- `js/debug-interface.js` (1423 行) - 主页面核心逻辑
- `js/debug-init.js` - 初始化脚本
- `js/debug-registry.js` - 注册表
- `js/auth-helper.js` - 认证辅助
- `css/debug-interface.css` - 主页面样式

---

### 2. API Testing 页面

#### 已完成
- ✅ `debug-tools/sections/api-testing-section.html` - 子页面（已重构为完整 HTML）
- ✅ `js/api-testing-section.js` - 页面逻辑（已重构）
- ✅ `css/api-testing-section.css` - 页面样式（已创建）

#### 模板文件（已完成）
- ✅ `debug-tools/templates/api-item.html` - API 项模板
- ✅ `debug-tools/templates/shared-headers-section.html` - 共享头部模板
- ✅ `debug-tools/templates/shared-header-item.html` - 共享头部项模板
- ✅ `debug-tools/templates/feature-docs.html` - 功能文档模板

---

### 3. Code Browser 页面

#### 待重构
- `debug-tools/sections/code-browser-section.html` - 子页面
- `js/code-browser.js` - 页面逻辑
- `debug-tools/code-browser-auto-rename.html` - 自动重命名工具
- `debug-tools/code-browser-tools.html` - 工具页面
- `debug-tools/dialogs/code-browser-dialogs.html` - 对话框
- `debug-tools/assets/auto-rename-helper.js` - 自动重命名辅助

---

### 4. Dev Tools 页面（IT Tools）

#### 已完成
- ✅ `debug-tools/sections/dev-tools-section.html` - 子页面（已重构为完整 HTML）
- ✅ `js/dev-tools-section.js` - 页面逻辑（已创建基础框架）
- ✅ `css/dev-tools-section.css` - 页面样式（已创建）

#### 待重构（已备份为 .bak）
- `js/ittools-core.js.bak` (496 行) - 核心逻辑
- `js/ittools-tools.js.bak` - 工具集合
- `js/ittools-menu-config.js.bak` - 菜单配置
- `js/ittools-menu-universal.js.bak` - 通用菜单
- `js/ittools-advanced-tools.js.bak` - 高级工具
- `js/ittools-client-tools.js.bak` - 客户端工具
- `js/ittools-tts-helper.js.bak` - TTS 辅助
- `css/ittools-layout.css.bak` - 布局样式（已迁移到 dev-tools-section.css）

#### IT Tools 实现模块（待重构）
- `js/ittools-impl-clipboard.js` - 剪贴板（部分重构：已使用 apiClientInstance）
- `js/ittools-impl-converters.js` - 转换器
- `js/ittools-impl-crypto.js` - 加密
- `js/ittools-impl-dev.js` - 开发工具
- `js/ittools-impl-formatters.js` (367 行) - 格式化
- `js/ittools-impl-generators.js` - 生成器
- `js/ittools-impl-generators-2.js` - 生成器 2
- `js/ittools-impl-images.js` - 图片处理
- `js/ittools-impl-text.js` - 文本处理
- `js/ittools-impl-translation.js` - 翻译
- `js/ittools-impl-web.js` - Web 工具

#### IT Tools Batch 模块（待重构）
- `js/ittools-impl-batch1a.js`
- `js/ittools-impl-batch1b.js`
- `js/ittools-impl-batch2.js`
- `js/ittools-impl-batch3a.js`
- `js/ittools-impl-batch3b.js`
- `js/ittools-impl-batch4.js`
- `js/ittools-impl-batch5.js`
- `js/ittools-impl-batch6a.js`
- `js/ittools-impl-batch6b.js`
- `js/ittools-impl-batch7a.js`
- `js/ittools-impl-batch7b.js`
- `js/ittools-impl-batch8.js`
- `js/ittools-impl-batch9.js`
- `js/ittools-impl-batch10.js` (401 行)
- `js/ittools-impl-batch11.js` (348 行)
- `js/ittools-impl-batch12.js`
- `js/ittools-impl-batch13.js`
- `js/ittools-impl-batch14.js`
- `js/ittools-impl-batch15.js`

---

### 5. System Info 页面

#### 待重构
- `debug-tools/sections/system-info-section.html` - 子页面

---

### 6. Learning 页面

#### 待重构
- `debug-tools/sections/learning-section.html` - 子页面
- `debug-tools/vocabulary-learning.html` - 词汇学习
- `debug-tools/vocabulary-learning-demo.html` - 词汇学习演示
- `debug-tools/voice-subtitle.html` - 语音字幕

---

### 7. MCP Manager 页面

#### 待重构
- `debug-tools/sections/mcp-manager-section.html` - 子页面
- `js/mcp-manager.js` (1226 行) - 页面逻辑（部分重构：已使用 apiClientInstance）
- `js/mcp-placeholder-module.js` - 占位符模块
- `css/mcp-manager.css` - 页面样式

#### MCP 模板文件（待重构）
- `debug-tools/templates/mcp-batch-item.html`
- `debug-tools/templates/mcp-menu-item.html`
- `debug-tools/templates/mcp-placeholder-module.html`
- `debug-tools/templates/mcp-prompt-mapping-editor.html`
- `debug-tools/templates/mcp-prompt-mappings-module.html`
- `debug-tools/templates/mcp-screenshot-detail.html`
- `debug-tools/templates/mcp-screenshot-list-empty.html`
- `debug-tools/templates/mcp-screenshot-list-item.html`
- `debug-tools/templates/mcp-screenshot-module.html`
- `debug-tools/templates/mcp-settings-module.html`
- `debug-tools/templates/mcp-task-dispatch-module.html`
- `debug-tools/templates/mcp-upload-item.html`

---

### 8. Octane Tasks 页面

#### 待重构
- `debug-tools/sections/octane-tasks-section.html` - 子页面
- `js/octane-tasks-manager.js` - 页面逻辑

---

### 9. Static Resources 页面

#### 待重构
- `debug-tools/sections/static-resources-section.html` - 子页面
- `js/static-resource-browser.js` - 页面逻辑
- `css/static-resources.css` - 页面样式
- `debug-tools/dialogs/static-resources-dialogs.html` - 对话框

---

### 10. Prompts 相关功能

#### 待重构
- `js/prompt-mapping-manager.js` - 提示映射管理
- `js/prompts-manager.js` - 提示管理
- `js/prompts-tasks-manager.js` - 提示任务管理

---

### 11. 通用模板和资源

#### 待重构
- `debug-tools/templates/auth-modal.html` - 认证模态框
- `debug-tools/templates/auth-modal.css` - 认证模态框样式
- `debug-tools/templates/loading.html` - 加载模板
- `debug-tools/placeholders/placeholder-elements.html` - 占位符元素

---

### 12. Debug Tools Assets

#### 待重构
- `debug-tools/assets/demo.js` - 演示脚本
- `debug-tools/assets/main.js` - 主脚本
- `debug-tools/assets/demo.css` - 演示样式
- `debug-tools/assets/index.css` - 索引样式
- `debug-tools/assets/main.css` - 主样式

---

### 13. 已废弃或不需要重构的文件

- `js/api-client.js` - 统一 API 客户端（当前使用）
- `js/video.min.js` - 第三方库，不需要重构
- `css/video-js.min.css` - 第三方库，不需要重构
- `avatars/*.png` - 静态资源，不需要重构

---

## 重构检查清单

### JavaScript 文件
- [ ] 所有 `fetch()` 调用已替换为 `apiClientInstance.json()`
- [ ] 所有 `APIClient` 调用已替换为 `apiClientInstance`
- [ ] 移除了所有 `||` 操作符
- [ ] 移除了所有 `if(null)` 检查
- [ ] 移除了所有 `if(!...)` 防御性检查
- [ ] 移除了所有空 `catch` 块
- [ ] 移除了所有 `has()` 方法调用
- [ ] 移除了所有 `innerHTML` 字符串拼接
- [ ] 所有动态 HTML 已提取到模板文件
- [ ] 使用 `data-*` 属性替代 `onclick` 等内联事件

### HTML 文件
- [ ] 移除了所有 `<style>` 标签
- [ ] 移除了所有内联 `style=""` 属性
- [ ] 移除了所有 `onclick=""` 等内联事件处理器
- [ ] 所有样式已提取到外部 CSS 文件
- [ ] 所有脚本已提取到外部 JS 文件
- [ ] 如果是子页面，已重构为完整的 HTML 文档（包含 `<!DOCTYPE html>`）

### CSS 文件
- [ ] 所有样式已从 HTML 和 JS 中提取
- [ ] 使用语义化的类名
- [ ] 无重复样式定义

### 模板文件
- [ ] 移除了所有内联样式
- [ ] 移除了所有内联事件处理器
- [ ] 使用 `data-*` 属性传递数据
- [ ] 使用占位符（如 `{variable}`）进行模板替换

---

## 文件统计

### 实际文件统计
- **总文件数（JS/HTML/CSS）**：101 个文件
  - JavaScript 文件：56 个
  - HTML 文件：35 个
  - CSS 文件：10 个

### 重构状态统计
- **已完成重构**：9 个文件
- **待重构文件**：88 个文件
  - JavaScript 文件：53 个
  - HTML 文件：34 个
  - CSS 文件：9 个
- **不需要重构**：4 个文件

---

## 注意事项

1. **测试**：每次重构后，在 `http://127.0.0.1:9000/#` 进行测试
2. **兼容性**：确保重构后的代码与现有后端 API 兼容
3. **性能**：注意 iframe 加载性能，必要时使用懒加载
4. **错误处理**：虽然移除防御性编程，但仍需确保关键错误能被捕获和显示

---

## 更新日志

- **2024-01-XX**：创建重构文档
- **2024-01-XX**：完成 `api-testing-section` 重构
- **2024-01-XX**：完成 `api-client.js` 创建，删除 `unified-api.js`
- **2024-01-XX**：完成主页面 iframe 架构改造
- **2024-01-XX**：按页面/功能模块重新组织文档结构
