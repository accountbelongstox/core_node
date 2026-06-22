# 字体配置说明

## Inter 字体本地托管方案

为了确保在国内环境下字体能够正常加载，我们使用本地托管的 Inter 字体文件，替代 Google Fonts CDN。

### 方案优势

1. **无需外部依赖** - 不依赖 Google Fonts CDN，避免访问问题
2. **加载速度更快** - 字体文件托管在本地服务器，加载速度更快
3. **更好的隐私保护** - 不向 Google 发送请求
4. **离线可用** - 即使没有网络也能正常显示字体
5. **自动降级** - 如果本地字体不可用，自动使用 jsDelivr CDN（国内访问较快）

### 字体文件位置

字体文件存储在 `public/fonts/` 目录：
- `Inter-Light.woff2` (300)
- `Inter-Regular.woff2` (400)
- `Inter-Medium.woff2` (500)
- `Inter-SemiBold.woff2` (600)
- `Inter-Bold.woff2` (700)

### 下载字体文件

#### 方法 1: 使用自动下载脚本（推荐）

```bash
cd /www/programing/core_node/poly_apps/appfactory-master-dashboard
./scripts/download-inter-fonts.sh
```

#### 方法 2: 手动下载

1. 访问 [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)
2. 选择需要的字重（300, 400, 500, 600, 700）
3. 下载字体文件（选择 woff2 格式）
4. 将文件重命名并放置到 `public/fonts/` 目录

#### 方法 3: 从 GitHub 下载

Inter 字体是开源字体，可以从官方仓库下载：
- 仓库: https://github.com/rsms/inter
- 发布页面: https://github.com/rsms/inter/releases

### 国内 CDN 替代方案（已配置为降级方案）

当前配置已包含 jsDelivr CDN 作为降级方案。如果本地字体文件不存在，会自动使用以下 CDN：

1. **jsDelivr CDN**（已配置，国内访问较快）
   - URL: `https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/css/inter.min.css`
   - 优点：国内访问速度快，稳定可靠
   - 已在 `index.html` 中配置为降级方案

2. **unpkg CDN**（可选）
   ```html
   <link href="https://unpkg.com/@fontsource/inter@5.0.0/css/inter.min.css" rel="stylesheet">
   ```

3. **其他国内 CDN 选项**
   - 360 CDN（已停止服务）
   - 字节跳动 CDN（需要申请）
   - 七牛云 CDN（需要配置）

### 配置说明

字体 CSS 文件位于 `public/fonts/inter.css`，在 `index.html` 中引用：

```html
<link rel="stylesheet" href="/fonts/inter.css">
```

### 验证字体加载

打开浏览器开发者工具，检查 Network 标签：
- 应该看到 `/fonts/inter.css` 和字体文件（.woff2）的请求
- 不应该有对 `fonts.googleapis.com` 或 `fonts.gstatic.com` 的请求

### 故障排除

如果字体无法加载：

1. 检查字体文件是否存在：
   ```bash
   ls -la public/fonts/
   ```

2. 检查文件权限：
   ```bash
   chmod 644 public/fonts/*.woff2
   ```

3. 检查 Vite 配置是否正确处理静态资源

4. 查看浏览器控制台是否有 404 错误

