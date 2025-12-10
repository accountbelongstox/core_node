# YT Multi Downloader Auto Click - 油猴插件

一个 Tampermonkey/Greasemonkey 用户脚本，用于在 ytmultidownloader.com 网站上自动点击 "Load Options" 按钮。

## 功能

- 自动查找包含 "Load Options" 文本的按钮
- 当按钮可用时自动点击
- 支持多种查找方式，确保能够找到按钮
- 监听 DOM 变化，即使按钮是动态加载的也能自动点击
- 宽泛的文本匹配，提高查找成功率

## 安装方法

### 1. 安装 Tampermonkey 扩展

- **Chrome**: 在 Chrome 网上应用店搜索 "Tampermonkey" 并安装
- **Firefox**: 在 Firefox 附加组件商店搜索 "Tampermonkey" 并安装
- **Edge**: 在 Microsoft Edge 附加组件商店搜索 "Tampermonkey" 并安装

### 2. 安装用户脚本

1. 打开 Tampermonkey 扩展图标
2. 点击"创建新脚本"
3. 删除默认内容
4. 复制 `ytmultidownloader-auto-click.user.js` 文件的全部内容
5. 粘贴到编辑器中
6. 按 `Ctrl+S` 保存（或点击保存按钮）

### 或者直接安装

1. 打开 `ytmultidownloader-auto-click.user.js` 文件
2. 复制全部内容
3. 在浏览器中打开 Tampermonkey 仪表板
4. 点击"实用工具" -> "从剪贴板安装"
5. 确认安装

## 使用方法

1. 访问 https://ytmultidownloader.com/
2. 插件会自动查找并点击 "Load Options" 按钮
3. 无需任何手动操作

## 工作原理

插件使用多种方式查找按钮：
1. **通过文本内容查找**（最宽泛）- 查找包含 "Load Options"、"Options" 或 "Load" 的按钮
2. **通过 SVG 图标查找** - 查找包含下载图标的按钮
3. **通过 CSS 类名查找** - 查找特定类名的按钮
4. **通过图标特征查找** - 查找包含 lucide-download 图标的按钮

插件会：
- 监听 DOM 变化，实时检测新出现的按钮
- 定期检查按钮是否出现
- 确保按钮可用（未禁用）才点击
- 自动滚动到按钮位置确保可见

