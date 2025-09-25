# 云码 ☁️

> **远程轻松编程，AI 对话无缝衔接**

> **项目迁移说明**: 本项目原名"寸止 (Cunzhi)"，现已重命名为"云码"，以更好地体现远程编程和云端协作的核心理念。

还在为 AI 助手总是提前结束对话而抓狂吗？明明还有很多要聊，它却说"还有什么需要帮助的吗？"**云码** 专治这个毛病！

当 AI 想要"草草了事"时，云码会通过 Flutter 移动端应用及时通知，让你能够继续深入交流，直到真正解决问题为止。

## 🌟 核心特性

- 🛑 **智能拦截**：AI 想结束时自动推送通知到移动端
- 🧠 **记忆管理**：按项目存储开发规范和偏好
- 📱 **移动优先**：Flutter 跨平台移动应用，随时随地响应
- 🌐 **分布式架构**：Laravel 后端 + Flutter 前端 + Rust MCP 服务
- ⚡ **即装即用**：3 秒安装，跨平台支持

## 📸 看看效果

### 📱 Flutter 移动端通知
![寸止移动端通知](./screenshots/flutter_notification.png)

*当 AI 想要结束对话时，寸止智能推送通知到 Flutter 移动端，提供预定义选项快速选择，让交流持续深入*

### ⚙️ Flutter 设置管理界面
![寸止 Flutter 设置界面](./screenshots/flutter_settings.png)

*优雅的 Flutter 移动端设置界面，支持记忆管理、功能开关、主题切换和智能提示词生成*

### 🌐 Laravel 后端管理面板
![Laravel 管理面板](./screenshots/laravel_dashboard.png)

*Laravel 后端提供完整的管理面板，支持服务状态监控、配置管理和日志查看*

## 🚀 开始使用

### 架构组件

云码采用分布式架构，包含三个主要组件：

1. **🦀 Rust MCP 服务**：处理 MCP 协议和业务逻辑
2. **🐘 Laravel 后端**：提供 API 服务和 WebSocket 通信
3. **📱 Flutter 移动端**：用户交互界面和通知接收

### 方式一：Docker 一键部署（推荐）

```bash
# 克隆项目 (原 cunzhi 项目已迁移)
git clone https://github.com/imhuso/yunma.git
cd yunma

# 一键启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

### 方式二：分组件安装

#### 1. Laravel 后端部署

```bash
# 进入 Laravel 目录
cd src/laravel_bridge

# 安装依赖
composer install

# 配置环境
cp .env.example .env
php artisan key:generate

# 数据库迁移
php artisan migrate

# 启动服务
php artisan serve --host=0.0.0.0 --port=8000
```

#### 2. Flutter 移动端安装

```bash
# 进入 Flutter 目录
cd src/flutter_app

# 安装依赖
flutter pub get

# 运行应用
flutter run
```

#### 3. Rust MCP 服务

```bash
# 进入 Rust 目录
cd src/rust

# 编译并运行
cargo run
```

## ⚡ 快速上手

### 第一步：配置 MCP 客户端

在你的 MCP 客户端（如 Claude Desktop）配置文件中添加：

```json
{
  "mcpServers": {
    "云码": {
      "command": "yunma-mcp-server",
      "args": ["--bridge-url", "http://localhost:8000"]
    }
  }
}
```

> **迁移提示**: 如果您之前使用的是"寸止"配置，请将 `"寸止"` 改为 `"云码"`，`"cunzhi-mcp-server"` 改为 `"yunma-mcp-server"`

### 第二步：配置 Flutter 移动端

1. 在 Flutter 应用中配置 Laravel 后端地址
2. 设置推送通知权限
3. 登录或注册账户

### 第三步：配置提示词

在 Flutter 应用的"设置"页面：
1. 查看自动生成的提示词
2. 复制提示词
3. 将提示词添加到你的 AI 助手中

### 第四步：开始使用

现在你的 AI 助手就拥有了智能拦截、记忆管理和移动端通知功能！

> 💡 **小贴士**：
> - 确保 Flutter 应用保持后台运行以接收通知
> - 可以在 Laravel 管理面板中查看服务状态
> - 支持多设备同步，在任意设备上都能响应 AI 请求

### 服务健康检查

```bash
# 检查 Laravel 后端状态
curl http://localhost:8000/api/health

# 检查 MCP 服务连接状态
curl http://localhost:8000/api/mcp/status

# 检查 Flutter 客户端连接状态
curl http://localhost:8000/api/clients/status
```

## 🤝 参与贡献

寸止是开源项目，我们欢迎所有形式的贡献！

### 🛠️ 本地开发
```bash
git clone https://github.com/imhuso/cunzhi.git
cd cunzhi
pnpm install
pnpm tauri:dev
```

## 📄 开源协议

MIT License - 自由使用，欢迎贡献！

</div>
