# MCP Chrome 本地开发指南

## 概述

本指南介绍如何使用本地编译版本而非全局安装版本进行开发。

## 架构说明

```
┌────────────────────────────────────────────────────┐
│  MCP Client (Claude/CherryStudio)                  │
└────────────────┬───────────────────────────────────┘
                 │ HTTP (127.0.0.1:12306)
                 ▼
┌────────────────────────────────────────────────────┐
│  Native Server (Node.js)                           │
│  路径: app/native-server/dist/                     │
│  启动: run_host.bat (Windows) / run_host.sh (Unix) │
└────────────────┬───────────────────────────────────┘
                 │ Native Messaging (stdin/stdout)
                 ▼
┌────────────────────────────────────────────────────┐
│  Chrome Extension                                  │
│  路径: app/chrome-extension/.output/chrome-mv3/    │
└────────────────────────────────────────────────────┘
```

---

## 快速开始

### 1. 一键设置 (推荐)

```bash
# 克隆项目后，在项目根目录执行
cd D:\programing\core_node\apps\mcp-chrome

# 一键构建并注册
pnpm run setup:local
```

这个命令会：
1. 构建 shared 包
2. 构建 native server
3. 构建 Chrome extension
4. 自动注册本地开发版本

### 2. 分步设置

如果一键设置失败，可以分步执行：

```bash
cd D:\programing\core_node\apps\mcp-chrome

# 步骤1: 构建shared包
pnpm run build:shared

# 步骤2: 构建native server
pnpm run build:native

# 步骤3: 构建Chrome extension
pnpm run build:extension

# 步骤4: 注册本地开发版本
pnpm run register:local
```

---

## 脚本命令说明

### 构建命令

| 命令 | 说明 |
|------|------|
| `pnpm run build:shared` | 构建共享包 |
| `pnpm run build:native` | 构建Native Server |
| `pnpm run build:extension` | 构建Chrome Extension |
| `pnpm run build:all` | 构建所有组件 |

### 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm run dev:native` | 启动Native Server开发模式 (监听文件变化) |
| `pnpm run dev:extension` | 启动Extension开发模式 (监听文件变化) |

### 注册命令

| 命令 | 说明 |
|------|------|
| `pnpm run register:local` | 注册本地开发版本 |
| `pnpm run unregister:local` | 注销本地开发版本 |
| `pnpm run setup:local` | 一键构建+注册 |

---

## 注册路径说明

### Windows 路径

**Chrome:**
- 配置文件: `%APPDATA%\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json`
- 注册表: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost`

**Chromium:**
- 配置文件: `%APPDATA%\Chromium\NativeMessagingHosts\com.chromemcp.nativehost.json`
- 注册表: `HKCU\Software\Chromium\NativeMessagingHosts\com.chromemcp.nativehost`

### Linux 路径

**Chrome:**
- 配置文件: `~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json`

**Chromium:**
- 配置文件: `~/.config/chromium/NativeMessagingHosts/com.chromemcp.nativehost.json`

### macOS 路径

**Chrome:**
- 配置文件: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json`

**Chromium:**
- 配置文件: `~/Library/Application Support/Chromium/NativeMessagingHosts/com.chromemcp.nativehost.json`

---

## 使用流程

### 首次设置

1. **构建并注册:**
   ```bash
   pnpm run setup:local
   ```

2. **加载Extension:**
   - 打开 `chrome://extensions`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择: `app/chrome-extension/.output/chrome-mv3`

3. **连接Native Host:**
   - 点击Extension图标
   - 点击"Connect"按钮
   - 查看是否成功连接

### 开发流程

#### 修改Native Server代码

```bash
# 方式1: 使用开发模式 (自动重启)
pnpm run dev:native

# 方式2: 手动构建
pnpm run build:native
# 然后在Extension中重新点击Connect
```

#### 修改Extension代码

```bash
# 方式1: 使用开发模式 (自动构建)
pnpm run dev:extension

# 方式2: 手动构建
pnpm run build:extension
# 然后在chrome://extensions中点击"重新加载"
```

---

## 验证设置

### 1. 检查配置文件

#### Windows
```powershell
# 查看Chrome配置
type "%APPDATA%\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json"

# 查看注册表
reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost"
```

#### Linux/macOS
```bash
# 查看Chrome配置
cat ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json

# 检查启动脚本权限
ls -la /path/to/project/apps/mcp-chrome/app/native-server/dist/run_host.sh
```

### 2. 测试Native Server

手动启动测试:
```bash
cd app/native-server/dist
node index.js
```

应该看到Native Messaging Host启动的日志。

### 3. 检查Extension ID

1. 打开 `chrome://extensions`
2. 查看Extension ID (如: `hbdgbgagpkpjffpklnamcljpakneikee`)
3. 确认与配置文件中的ID匹配

**如果不匹配**, 需要更新配置:
```bash
# 1. 编辑 app/native-server/src/scripts/constant.ts
export const EXTENSION_ID = '你的实际ExtensionID';

# 2. 编辑 scripts/register-local-dev.cjs
const EXTENSION_ID = '你的实际ExtensionID';

# 3. 重新构建和注册
pnpm run build:native
pnpm run register:local
```

---

## 切换版本

### 使用本地开发版本

```bash
pnpm run register:local
```

### 切换回全局版本

```bash
# 注销本地版本
pnpm run unregister:local

# 重新安装全局版本
npm install -g mcp-chrome-bridge
```

---

## 故障排查

### 问题1: Extension无法连接到Native Host

**症状:** 点击Connect后显示连接失败

**解决步骤:**

1. **检查配置文件是否存在:**
   ```powershell
   # Windows
   type "%APPDATA%\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json"
   ```

2. **检查Extension ID是否匹配:**
   - 打开 `chrome://extensions`
   - 复制Extension ID
   - 与配置文件中的 `allowed_origins` 对比

3. **检查启动脚本是否存在:**
   ```bash
   # 检查文件
   dir app\native-server\dist\run_host.bat  # Windows
   ls app/native-server/dist/run_host.sh    # Linux/macOS
   ```

4. **重新注册:**
   ```bash
   pnpm run unregister:local
   pnpm run register:local
   ```

5. **重启浏览器**

### 问题2: Native Server无法启动

**症状:** 配置正确但仍无法连接

**解决步骤:**

1. **检查Node.js路径:**
   ```bash
   where node  # Windows
   which node  # Linux/macOS
   ```

2. **检查dist目录:**
   ```bash
   ls app/native-server/dist/
   # 应该包含: index.js, run_host.bat/sh, package.json等
   ```

3. **手动测试启动:**
   ```bash
   cd app/native-server/dist
   node index.js
   ```

4. **查看Chrome错误:**
   - 打开 `chrome://extensions`
   - 点击Extension的"错误"按钮
   - 查看详细错误信息

### 问题3: 端口被占用

**症状:** 服务器启动失败，提示端口12306被占用

**解决步骤:**

1. **查找占用端口的进程:**
   ```powershell
   # Windows
   netstat -ano | findstr :12306

   # Linux/macOS
   lsof -i :12306
   ```

2. **终止进程或更换端口:**
   ```bash
   # 选项1: 终止占用端口的进程
   taskkill /PID <进程ID> /F  # Windows
   kill -9 <进程ID>           # Linux/macOS

   # 选项2: 更换端口 (修改constants.ts中的NATIVE_SERVER_PORT)
   ```

### 问题4: 权限错误 (Linux/macOS)

**症状:** 启动脚本无执行权限

**解决步骤:**

```bash
# 添加执行权限
chmod +x app/native-server/dist/run_host.sh
chmod +x app/native-server/dist/index.js
chmod +x app/native-server/dist/cli.js

# 或重新构建 (会自动设置权限)
pnpm run build:native
```

---

## 调试技巧

### 1. 查看Native Server日志

```bash
# Native Server会输出日志到stderr
# Chrome会捕获这些日志，可以在以下位置查看:
# chrome://extensions → 点击"错误"
```

### 2. 查看Extension日志

```bash
# 右键Extension图标 → "检查弹出内容"
# 或在 chrome://extensions → 点击"背景页"
```

### 3. 测试MCP连接

```bash
# 使用curl测试HTTP端点
curl http://127.0.0.1:12306/ask-extension

# 应该返回服务器响应
```

### 4. 启用详细日志

在 `app/native-server/src/server/index.ts` 中:
```typescript
this.fastify = Fastify({
  logger: true  // 启用详细日志
});
```

---

## 最佳实践

### 1. 开发工作流

```bash
# Terminal 1: 监听Native Server变化
pnpm run dev:native

# Terminal 2: 监听Extension变化
pnpm run dev:extension

# 修改代码后，Extension会自动重新加载
# Native Server需要在Extension中重新点击Connect
```

### 2. 定期清理

```bash
# 清理构建产物
pnpm run clean:dist

# 重新构建
pnpm run build:all
```

### 3. 版本控制

```bash
# 不要提交构建产物
# .gitignore 应包含:
dist/
.output/
node_modules/
```

---

## 相关文档

- [配置一致性检查清单](./CONFIGURATION_CHECKLIST.md)
- [DeepSeek实现文档](./docs/DEEPSEEK_IMPLEMENTATION_SUMMARY.md)
- [项目README](./README.md)

---

## 常用参考

### 项目结构

```
apps/mcp-chrome/
├── app/
│   ├── chrome-extension/          # Chrome扩展源码
│   │   ├── .output/chrome-mv3/   # 构建产物 (加载此目录)
│   │   └── ...
│   └── native-server/             # Native Server源码
│       ├── dist/                  # 构建产物
│       │   ├── index.js          # 主入口
│       │   ├── run_host.bat      # Windows启动脚本
│       │   └── run_host.sh       # Unix启动脚本
│       └── ...
├── packages/
│   └── shared/                    # 共享代码
├── scripts/
│   ├── register-local-dev.cjs    # 注册脚本
│   └── unregister-local-dev.cjs  # 注销脚本
└── package.json
```

### 关键文件

| 文件 | 说明 |
|------|------|
| `app/native-server/src/scripts/constant.ts` | Native Server配置 |
| `app/chrome-extension/common/constants.ts` | Extension配置 |
| `scripts/register-local-dev.cjs` | 本地注册脚本 |

---

**最后更新**: 2025-12-13
