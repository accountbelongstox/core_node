# MCP Chrome 配置一致性检查清单

## 配置核对时间
生成时间: 2025-12-13

## 关键配置项

### 1. Native Host Name
必须在所有地方保持一致。

**配置位置:**

| 文件路径 | 配置项 | 值 | 状态 |
|---------|--------|-----|------|
| `app/native-server/src/scripts/constant.ts` | `HOST_NAME` | `com.chromemcp.nativehost` | ✅ |
| `app/chrome-extension/common/constants.ts` | `NATIVE_HOST.NAME` | `com.chromemcp.nativehost` | ✅ |
| `scripts/register-local-dev.cjs` | `HOST_NAME` | `com.chromemcp.nativehost` | ✅ |

**结论**: ✅ 一致

---

### 2. Extension ID

Extension ID 用于 Native Messaging 的安全验证。

**当前配置的 Extension ID**: `hbdgbgagpkpjffpklnamcljpakneikee`

**配置位置:**

| 文件路径 | 配置项 | 值 | 状态 |
|---------|--------|-----|------|
| `app/native-server/src/scripts/constant.ts` | `EXTENSION_ID` | `hbdgbgagpkpjffpklnamcljpakneikee` | ⚠️ |
| `scripts/register-local-dev.cjs` | `EXTENSION_ID` | `hbdgbgagpkpjffpklnamcljpakneikee` | ⚠️ |

**⚠️ 重要提示**:
- Extension ID 是在 Chrome 中加载扩展时自动生成的
- 如果你的扩展ID与配置不同，需要更新配置文件
- 开发模式下每次重新打包可能生成不同的ID
- 推荐使用 Extension Key 来固定ID

**如何获取当前Extension ID:**
1. 打开 `chrome://extensions`
2. 启用"开发者模式"
3. 查看扩展卡片上的ID

**如何固定Extension ID:**
1. 在 `app/chrome-extension/.env` 中设置 `CHROME_EXTENSION_KEY`
2. 或者从现有扩展的 manifest.json 中复制 `key` 字段

---

### 3. Default Port

HTTP Server 的默认端口。

**配置位置:**

| 文件路径 | 配置项 | 值 | 状态 |
|---------|--------|-----|------|
| `app/native-server/src/constant/index.ts` | `NATIVE_SERVER_PORT` | `12306` | ✅ |
| `app/chrome-extension/common/constants.ts` | `NATIVE_HOST.DEFAULT_PORT` | `12306` | ✅ |

**结论**: ✅ 一致

---

### 4. 注册路径映射

Native Messaging Host 配置文件路径。

#### Windows

| 浏览器 | 路径 | 状态 |
|-------|------|------|
| Chrome | `%APPDATA%\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json` | ✅ |
| Chromium | `%APPDATA%\Chromium\NativeMessagingHosts\com.chromemcp.nativehost.json` | ✅ |

**注册表项:**
- Chrome: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost`
- Chromium: `HKCU\Software\Chromium\NativeMessagingHosts\com.chromemcp.nativehost`

**当前注册的路径:**
```json
{
  "name": "com.chromemcp.nativehost",
  "description": "Node.js Host for Browser Bridge Extension (Local Development)",
  "path": "D:\\programing\\core_node\\apps\\mcp-chrome\\app\\native-server\\dist\\run_host.bat",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/"
  ]
}
```

#### Linux

| 浏览器 | 路径 | 状态 |
|-------|------|------|
| Chrome | `~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json` | ✅ |
| Chromium | `~/.config/chromium/NativeMessagingHosts/com.chromemcp.nativehost.json` | ✅ |

**配置示例 (Linux):**
```json
{
  "name": "com.chromemcp.nativehost",
  "description": "Node.js Host for Browser Bridge Extension (Local Development)",
  "path": "/path/to/project/apps/mcp-chrome/app/native-server/dist/run_host.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/"
  ]
}
```

#### macOS

| 浏览器 | 路径 | 状态 |
|-------|------|------|
| Chrome | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json` | ✅ |
| Chromium | `~/Library/Application Support/Chromium/NativeMessagingHosts/com.chromemcp.nativehost.json` | ✅ |

---

### 5. 启动脚本路径

Native Host 启动脚本。

| 平台 | 脚本文件 | 路径 | 状态 |
|------|---------|------|------|
| Windows | `run_host.bat` | `D:\programing\core_node\apps\mcp-chrome\app\native-server\dist\run_host.bat` | ✅ |
| Linux | `run_host.sh` | `/path/to/project/apps/mcp-chrome/app/native-server/dist/run_host.sh` | ✅ |
| macOS | `run_host.sh` | `/path/to/project/apps/mcp-chrome/app/native-server/dist/run_host.sh` | ✅ |

---

## 检查命令

### 验证配置文件

#### Windows
```powershell
# 检查 Chrome 配置
type "%APPDATA%\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json"

# 检查注册表
reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost"

# 检查启动脚本
dir "D:\programing\core_node\apps\mcp-chrome\app\native-server\dist\run_host.bat"
```

#### Linux
```bash
# 检查 Chrome 配置
cat ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json

# 检查启动脚本
ls -la /path/to/project/apps/mcp-chrome/app/native-server/dist/run_host.sh

# 检查执行权限
stat -c "%a %n" /path/to/project/apps/mcp-chrome/app/native-server/dist/run_host.sh
```

---

## 修复Extension ID不匹配问题

如果你的Extension ID与配置文件中的不同，按以下步骤修复：

### 方法1: 更新配置文件 (推荐)

1. **获取当前Extension ID:**
   - 打开 `chrome://extensions`
   - 找到你的扩展，复制ID (例如: `abc123def456...`)

2. **更新配置:**
   ```bash
   # 修改 native-server 配置
   # 编辑: app/native-server/src/scripts/constant.ts
   export const EXTENSION_ID = '你的实际ExtensionID';

   # 修改注册脚本配置
   # 编辑: scripts/register-local-dev.cjs
   const EXTENSION_ID = '你的实际ExtensionID';
   ```

3. **重新构建和注册:**
   ```bash
   cd D:\programing\core_node\apps\mcp-chrome
   pnpm run build:native
   pnpm run register:local
   ```

### 方法2: 使用Extension Key固定ID

1. **创建 .env 文件:**
   ```bash
   # 在 app/chrome-extension/ 目录下
   echo "CHROME_EXTENSION_KEY=你的Extension密钥" > .env
   ```

2. **重新构建Extension:**
   ```bash
   pnpm run build:extension
   ```

3. **重新加载扩展**

---

## 常见问题排查

### 1. Extension无法连接到Native Host

**可能原因:**
- [ ] Extension ID 不匹配
- [ ] Native Host Name 不一致
- [ ] 启动脚本路径错误
- [ ] 启动脚本没有执行权限 (Linux/macOS)

**排查步骤:**
1. 检查Chrome控制台错误: `chrome://extensions` → 点击"错误"
2. 检查Native Messaging配置文件是否存在
3. 检查Extension ID是否匹配
4. 手动运行启动脚本测试

### 2. Native Host无法启动

**可能原因:**
- [ ] Node.js路径错误
- [ ] dist目录不存在
- [ ] 文件权限问题

**排查步骤:**
```bash
# 检查dist是否存在
ls -la app/native-server/dist/

# 检查Node.js路径
which node  # Linux/macOS
where node  # Windows

# 手动测试启动
node app/native-server/dist/index.js
```

### 3. 端口冲突

**可能原因:**
- [ ] 12306端口被占用

**排查步骤:**
```bash
# Windows
netstat -ano | findstr :12306

# Linux/macOS
lsof -i :12306
```

---

## 快速修复脚本

### Windows
```powershell
# 重新注册本地开发版本
cd D:\programing\core_node\apps\mcp-chrome
pnpm run build:native
pnpm run register:local

# 重启Chrome
taskkill /F /IM chrome.exe
start chrome
```

### Linux
```bash
# 重新注册本地开发版本
cd /path/to/project/apps/mcp-chrome
pnpm run build:native
pnpm run register:local

# 重启Chrome
killall chrome
google-chrome &
```

---

## 版本信息

| 组件 | 版本 |
|------|------|
| mcp-chrome-bridge | 1.0.29 |
| chrome-mcp-server | 0.0.6 |
| chrome-mcp-shared | 1.0.1 |
| Node.js | >= 18.19.0 |

---

## 最后更新

- **日期**: 2025-12-13
- **更新内容**: 初始配置一致性检查文档
- **检查者**: Claude AI

---

## 注意事项

⚠️ **重要提示:**

1. **Extension ID 必须匹配**: 如果Extension ID改变，必须同步更新所有配置
2. **路径使用绝对路径**: 避免使用相对路径导致的问题
3. **Windows路径转义**: JSON中使用 `\\` 转义反斜杠
4. **执行权限**: Linux/macOS需要给启动脚本添加执行权限
5. **重启浏览器**: 更新配置后需要重启浏览器

---

**配置检查通过标准:**
- [x] Host Name 在所有位置一致
- [x] Extension ID 在配置文件中存在
- [x] 端口号一致
- [x] 路径映射正确
- [x] 启动脚本存在
- [ ] Extension ID 与实际扩展匹配 (需要手动验证)
