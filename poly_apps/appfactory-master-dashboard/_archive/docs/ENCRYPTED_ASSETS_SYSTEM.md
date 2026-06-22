# Encrypted App Assets System

## Overview

完整的加密应用资源系统，包含 10 张硬编码图片的自动加密和前端解密。

## 文件结构

### Backend (加密端)

```
scripts/_daemon_tools/
├── image_encryptor.cjs           # 图片加密器 (XOR算法)
├── build_encryptor.cjs           # 通用文件加密器
└── file_watcher.js               # 文件监控器 (Node.js fs.watch)

scripts/
└── daemon.cjs                    # 主守护进程
```

### Frontend (解密端)

```
public/js/
├── image_decryptor.js            # 图片解密库 (对应 image_encryptor.cjs)
├── encrypted_app_assets.js       # 加密资源管理器
└── mock_app_data.js              # Mock 应用数据

public/
├── app_gallery.html              # 应用画廊演示页面
└── test_decrypt.html             # 解密测试页面
```

### Assets (资源文件)

**源文件目录**: `/www/_build_dir/appfactory-master-dashboard/dist/public/`
```
app_icon1.png - app_icon5.png     # 5 个应用图标 (200x200)
app_splash1.png - app_splash5.png # 5 个启动画面 (400x400)
```

**加密后目录**: `/www/programing/core_node/poly_apps/appfactory-master-dashboard/dist/public/`
```
app_icon1.en.png - app_icon5.en.png     # 加密后的图标
app_splash1.en.png - app_splash5.en.png # 加密后的启动画面
```

## 工作流程

### 1. 自动加密 (Backend)

```
daemon.cjs (监控)
    ↓
file_watcher.js (检测文件变化)
    ↓
image_encryptor.cjs (XOR加密图片)
    ↓
生成 *.en.png 文件到代码目录
```

### 2. 前端解密 (Frontend)

```
app_gallery.html
    ↓
encrypted_app_assets.js (硬编码10个文件)
    ↓
image_decryptor.js (XOR解密)
    ↓
显示解密后的图片
```

## 硬编码资源列表

### Icons (图标)
1. `app_icon1.en.png` - Photo Gallery Pro
2. `app_icon2.en.png` - Task Master
3. `app_icon3.en.png` - Fitness Tracker Plus
4. `app_icon4.en.png` - Music Studio
5. `app_icon5.en.png` - Travel Planner

### Splashes (启动画面)
1. `app_splash1.en.png` - Photo Gallery Pro
2. `app_splash2.en.png` - Task Master
3. `app_splash3.en.png` - Fitness Tracker Plus
4. `app_splash4.en.png` - Music Studio
5. `app_splash5.en.png` - Travel Planner

## Mock 数据结构

### 前端 Mock 数据（TypeScript）

在 `constants.ts` 中，前5个应用（app1-app5）已配置 icon 和 splash：

```typescript
export const MOCK_APPS: AppInstance[] = [
  {
    id: 'app1',
    name: '多聊',
    // ... other fields
    icon: 'app_icon1.en.png',      // 硬编码，对应 app_icon1.en.png
    splash: 'app_splash1.en.png',  // 硬编码，对应 app_splash1.en.png
  },
  {
    id: 'app2',
    name: '爱聊',
    // ... other fields
    icon: 'app_icon2.en.png',      // 硬编码，对应 app_icon2.en.png
    splash: 'app_splash2.en.png',  // 硬编码，对应 app_splash2.en.png
  },
  {
    id: 'app3',
    name: '夜聊',
    // ... other fields
    icon: 'app_icon3.en.png',      // 硬编码，对应 app_icon3.en.png
    splash: 'app_splash3.en.png',  // 硬编码，对应 app_splash3.en.png
  },
  {
    id: 'app4',
    name: '心聊',
    // ... other fields
    icon: 'app_icon4.en.png',      // 硬编码，对应 app_icon4.en.png
    splash: 'app_splash4.en.png',  // 硬编码，对应 app_splash4.en.png
  },
  {
    id: 'app5',
    name: '密聊',
    // ... other fields
    icon: 'app_icon5.en.png',      // 硬编码，对应 app_icon5.en.png
    splash: 'app_splash5.en.png',  // 硬编码，对应 app_splash5.en.png
  },
  // app6-app15 没有 icon/splash（只有前5个有）
];
```

### 硬编码文件映射

| App ID | App Name | Icon File | Splash File |
|--------|----------|-----------|-------------|
| app1 | 多聊 | `app_icon1.en.png` | `app_splash1.en.png` |
| app2 | 爱聊 | `app_icon2.en.png` | `app_splash2.en.png` |
| app3 | 夜聊 | `app_icon3.en.png` | `app_splash3.en.png` |
| app4 | 心聊 | `app_icon4.en.png` | `app_splash4.en.png` |
| app5 | 密聊 | `app_icon5.en.png` | `app_splash5.en.png` |

**重要**: 
- 这10个文件名是**硬编码**的，前端不能动态扫描
- 文件名必须严格按照上述格式
- 应用组合和已发布应用使用相同的 mock 数据源（`constants.ts`）

## 使用方式

### 基础用法

```javascript
// 1. 创建资源管理器
const assetsManager = new EncryptedAppAssetsManager({
    password: 'BuildFactoryEncryptionKey2025'
});

// 2. 加载单个图标
const icon1 = await assetsManager.loadIcon(1);
document.getElementById('img').src = icon1.blobUrl;

// 3. 加载单个启动画面
const splash1 = await assetsManager.loadSplash(1);

// 4. 加载所有资源
const { icons, splashes } = await assetsManager.loadAll();
```

### 配合 Mock 数据

```javascript
// 1. 加载应用和资源
const appData = await loadAppAssets(1);
console.log(appData.app);      // Mock 应用信息
console.log(appData.icon);     // 解密后的图标 URL
console.log(appData.splash);   // 解密后的启动画面 URL

// 2. 加载所有应用
const allApps = await loadAllAppAssets();
allApps.forEach(({ app, icon, splash }) => {
    // 渲染应用卡片
});
```

### 应用到 DOM 元素

```javascript
const assetsManager = new EncryptedAppAssetsManager();

// 方式 1: 直接应用
await assetsManager.applyToImageElement(
    document.getElementById('appIcon'),
    'app_icon1.en.png'
);

// 方式 2: 获取 URL
const asset = await assetsManager.loadEncryptedFile('app_icon1.en.png');
document.getElementById('appIcon').src = asset.blobUrl;
```

## 加密算法

### XOR 对称加密

```javascript
// 加密 = 解密 (相同算法)
function xorEncryptDecrypt(data, password) {
    const passwordBuffer = Buffer.from(password, 'utf8');
    const result = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ passwordBuffer[i % passwordBuffer.length];
    }

    return result;
}
```

**特性**:
- ✅ 对称加密: 加密和解密使用相同算法
- ✅ 任何密码都能解密: 错误密码 = 乱码图片
- ✅ 无需压缩: 图片本身已压缩 (PNG/JPG)
- ✅ 保留扩展名: 便于识别图片格式

## 测试步骤

### 1. 重启 Daemon 服务
```bash
sudo systemctl restart webapp-appfactory-master-dashboard-daemon
```

### 2. 查看日志确认加密
```bash
journalctl -u webapp-appfactory-master-dashboard-daemon -f
```

应该看到:
```
[FileWatcher] New file: app_icon1.png
[BATCH] Processing 1 image file(s)
[ENCRYPTED IMAGE] dist/public/app_icon1.png -> dist/public/app_icon1.en.png
```

### 3. 验证加密文件
```bash
ls -lh /www/programing/core_node/poly_apps/appfactory-master-dashboard/dist/public/app_*.en.png
```

应该看到 10 个 `.en.png` 文件。

### 4. 访问演示页面
```
http://localhost:10000/app_gallery.html
```

应该显示 5 个应用卡片，每个带有解密后的图标和启动画面。

## API 参考

### EncryptedAppAssetsManager

```javascript
class EncryptedAppAssetsManager {
    constructor({ password, basePath });

    // 加载方法
    async loadIcon(index: 1-5): Promise<Asset>
    async loadSplash(index: 1-5): Promise<Asset>
    async loadEncryptedFile(filename: string): Promise<Asset>
    async loadAllIcons(): Promise<Asset[]>
    async loadAllSplashes(): Promise<Asset[]>
    async loadAll(): Promise<{ icons, splashes }>

    // DOM 操作
    async applyToImageElement(imgElement, filename)

    // 管理
    setPassword(newPassword)
    revokeAllUrls()
}
```

### Mock Data Functions

```javascript
// 获取应用信息
getAppByIndex(index: 1-5): App
getAppById(id: string): App

// 加载应用资源
async loadAppAssets(appIndex: 1-5, assetsManager?): Promise<AppWithAssets>
async loadAllAppAssets(assetsManager?): Promise<AppWithAssets[]>
```

## 注意事项

1. **硬编码文件名**: 前端不能动态扫描，必须硬编码 10 个文件名
2. **密码管理**: 默认密码在代码中，可以通过 URL/API/Constants 覆盖
3. **内存管理**: 使用完毕后调用 `revokeAllUrls()` 释放 Blob URL
4. **错误处理**: 错误密码不会报错，只是显示乱码图片
5. **格式保留**: 加密文件保留原始扩展名 (`.en.png`)

## 文件清单

### 后端文件
- `/scripts/_daemon_tools/image_encryptor.cjs` (246 行)
- `/scripts/_daemon_tools/file_watcher.js` (199 行)
- `/scripts/daemon.cjs` (修改支持图片加密)

### 前端文件
- `/public/js/image_decryptor.js` (175 行)
- `/public/js/encrypted_app_assets.js` (140 行)
- `/public/js/mock_app_data.js` (157 行)
- `/public/app_gallery.html` (完整演示页面)
- `/public/test_decrypt.html` (单图测试页面)

### 资源文件
- 源文件: `/www/_build_dir/.../dist/public/app_{icon|splash}{1-5}.png` (10 个)
- 加密文件: `.../dist/public/app_{icon|splash}{1-5}.en.png` (10 个)

## 系统要求更新 (2025-01-05)

### 新的架构要求

1. **框架职责**: 框架只负责组织图片数据，图片名称和格式必须是明文的
   - 文件名格式: `app_icon1.en.png`, `app_splash1.en.png` (明文)
   - 文件扩展名 `.png` 是明文的，用于识别图片格式
   - 框架不负责加密/解密，只负责数据组织

2. **浏览器端解密**: 所有解密操作和密码管理都在浏览器端完成
   - 密码通过 GET 参数传递: `?password=xxx` 或 `?pwd=xxx`
   - **如果没有 GET 参数，默认密码为空字符串 `""`**
   - 解密失败（错误密码）仍然显示解密后的数据（可能是乱码）
   - 密码优先级: GET 参数 > 默认空字符串

3. **始终显示解密数据**:
   - 即使密码错误导致解密后是乱码，也要显示
   - 图片名称和格式是明文的，浏览器可以根据格式正确显示
   - 不进行密码验证，任何密码都能解密（只是结果可能不对）

4. **二进制数据加载**:
   - 直接加载加密的二进制文件（不是 base64）
   - 使用 `fetch().arrayBuffer()` 获取二进制数据
   - 使用 XOR 算法解密二进制数据

### 加密端要求（必须满足）

**重要**: 如果加密端未满足以下要求，必须更新加密端实现。

#### 1. 硬编码文件列表（必须）

加密端必须处理以下10个文件（硬编码，不能动态扫描）：

**图标文件 (5个)**:
- `app_icon1.png` → `app_icon1.en.png`
- `app_icon2.png` → `app_icon2.en.png`
- `app_icon3.png` → `app_icon3.en.png`
- `app_icon4.png` → `app_icon4.en.png`
- `app_icon5.png` → `app_icon5.en.png`

**启动画面文件 (5个)**:
- `app_splash1.png` → `app_splash1.en.png`
- `app_splash2.png` → `app_splash2.en.png`
- `app_splash3.png` → `app_splash3.en.png`
- `app_splash4.png` → `app_splash4.en.png`
- `app_splash5.png` → `app_splash5.en.png`

**源文件位置**: `/www/_build_dir/appfactory-master-dashboard/dist/public/`
**加密后位置**: `/www/programing/core_node/poly_apps/appfactory-master-dashboard/dist/public/`

#### 2. 文件命名规则（必须）

- ✅ **正确**: `app_icon1.en.png` (保留原始扩展名 `.png`)
- ❌ **错误**: `app_icon1.en` (缺少扩展名)
- ❌ **错误**: `app_icon1.enc` (错误的扩展名)
- ❌ **错误**: `app_icon1.en.png.enc` (多余的扩展名)

**格式**: `{original_name}.en.{original_extension}`
- `{original_name}`: 原始文件名（不含扩展名）
- `.en`: 加密标记（固定）
- `{original_extension}`: 原始文件扩展名（`.png`, `.jpg` 等）

#### 3. 二进制加密格式（必须）

- ✅ **必须**: 加密后的文件是**二进制格式**（可以直接用 `fetch().arrayBuffer()` 读取）
- ❌ **禁止**: base64 文本格式
- ❌ **禁止**: JSON 格式
- ❌ **禁止**: 任何文本包装格式
- ❌ **禁止**: JavaScript 文件包装 (如 `const encrypted = "..."`)

**加密算法**: XOR 对称加密
```javascript
// 加密 = 解密 (相同算法)
function xorEncryptDecrypt(data, password) {
    const passwordBytes = Buffer.from(password, 'utf8');
    const result = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ passwordBytes[i % passwordBytes.length];
    }

    return result;
}

// 后端加密输出（正确）
async function encryptAndSave(inputPath, outputPath, password) {
    const imageData = await fs.promises.readFile(inputPath);
    const encryptedData = xorEncryptDecrypt(imageData, password);

    // 直接写入二进制数据，不做任何包装
    await fs.promises.writeFile(outputPath, encryptedData);
}
```

#### 4. 文件扩展名保留（必须）

- 文件扩展名必须保留，用于浏览器识别 MIME 类型
- `.png` → `image/png`
- `.jpg` / `.jpeg` → `image/jpeg`
- `.gif` → `image/gif`
- `.webp` → `image/webp`

#### 5. 密码处理（必须）

**加密端**:
- 加密端使用固定密码: `BuildFactoryEncryptionKey2025`
- 密码由加密端配置，不通过参数传递

**浏览器端**:
- 浏览器端通过 GET 参数接收密码: `?password=xxx` 或 `?pwd=xxx`
- **如果没有 GET 参数，默认密码为空字符串 `""`**
- 密码优先级: GET 参数 > 默认空字符串 `""`
- 任何密码都能解密（错误密码会产生乱码，但仍会显示）

**密码传递示例**:
```
# 使用 GET 参数传递密码
http://example.com/apps?password=mySecretKey
http://example.com/apps?pwd=anotherKey

# 不使用密码（默认空字符串）
http://example.com/apps
```

#### 6. 自动加密流程（必须）

daemon 服务必须：
1. 监控 `/www/_build_dir/appfactory-master-dashboard/dist/public/` 目录
2. 检测到上述10个文件中的任何一个时，自动加密
3. 加密后保存到 `/www/programing/core_node/poly_apps/appfactory-master-dashboard/dist/public/`
4. 保持目录结构（如果源文件在子目录中）

#### 7. 错误处理（必须）

- 如果源文件不存在，跳过（不报错）
- 如果加密失败，记录错误日志，但不中断服务
- 如果目标目录不存在，自动创建（权限 0755）

#### 8. 验证检查清单

加密端实现后，验证以下内容：

- [ ] 10个文件都能正确加密
- [ ] 加密后的文件名格式正确（`.en.png`）
- [ ] 加密后的文件是二进制格式（不是文本）
- [ ] 文件扩展名保留（`.png`）
- [ ] 可以使用 `fetch().arrayBuffer()` 读取
- [ ] 浏览器端可以正确解密显示
- [ ] 密码错误时显示乱码（但不报错）

### 前端实现要求

#### 1. 密码获取（必须）

前端必须从 URL GET 参数获取密码:

```javascript
// 获取密码的标准方法
function getDecryptPassword() {
    const urlParams = new URLSearchParams(window.location.search);
    const password = urlParams.get('password') || urlParams.get('pwd') || '';
    return password;  // 默认空字符串，不是 undefined 或 null
}
```

**密码优先级**:
1. URL GET 参数 `?password=xxx`
2. URL GET 参数 `?pwd=xxx`
3. 如果都没有，使用默认空字符串 `""`

**错误处理**:
- 不验证密码是否正确
- 任何密码都能解密（错误密码 = 乱码）
- 始终显示解密结果，即使是乱码

#### 2. 二进制文件加载（必须）

前端必须使用 `fetch().arrayBuffer()` 加载加密文件：

```javascript
// 正确的加载方式
async function loadEncryptedImage(filePath) {
    const response = await fetch(filePath);

    if (!response.ok) {
        throw new Error(`Failed to load: ${filePath}`);
    }

    // 必须使用 arrayBuffer()，不是 text() 或 json()
    const encryptedData = await response.arrayBuffer();

    return encryptedData;
}
```

**禁止的加载方式**:
- ❌ `await response.text()` - 会损坏二进制数据
- ❌ `await response.json()` - 不是 JSON 格式
- ❌ `import('./encrypted_file.js')` - 不是 JavaScript 模块

#### 3. XOR 解密实现（必须）

前端的 XOR 解密必须与后端完全一致：

```javascript
function xorDecrypt(encryptedArrayBuffer, password) {
    const encryptedBytes = new Uint8Array(encryptedArrayBuffer);
    const passwordBytes = new TextEncoder().encode(password);
    const result = new Uint8Array(encryptedBytes.length);

    for (let i = 0; i < encryptedBytes.length; i++) {
        result[i] = encryptedBytes[i] ^ passwordBytes[i % passwordBytes.length];
    }

    return result;
}
```

#### 4. Blob URL 创建（必须）

解密后必须创建 Blob URL 用于显示：

```javascript
async function decryptAndDisplay(encryptedArrayBuffer, password, mimeType = 'image/png') {
    const decryptedBytes = xorDecrypt(encryptedArrayBuffer, password);
    const blob = new Blob([decryptedBytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    return blobUrl;
}

// 使用示例
const imgElement = document.getElementById('myImage');
const encryptedData = await loadEncryptedImage('/dist/public/app_icon1.en.png');
const password = getDecryptPassword();
imgElement.src = await decryptAndDisplay(encryptedData, password, 'image/png');
```

#### 5. MIME 类型识别（必须）

根据文件扩展名识别 MIME 类型：

```javascript
function extensionToMimeType(extension) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon'
    };

    return mimeTypes[extension.toLowerCase()] || 'image/png';
}
```

#### 6. 硬编码文件列表（必须）

前端不能动态扫描目录，必须硬编码 10 个文件名：

```javascript
const HARDCODED_ENCRYPTED_ASSETS = {
    icons: [
        'app_icon1.en.png',
        'app_icon2.en.png',
        'app_icon3.en.png',
        'app_icon4.en.png',
        'app_icon5.en.png'
    ],
    splashes: [
        'app_splash1.en.png',
        'app_splash2.en.png',
        'app_splash3.en.png',
        'app_splash4.en.png',
        'app_splash5.en.png'
    ]
};
```

#### 7. 完整使用示例

```javascript
// 创建解密器
class ImageDecryptor {
    constructor() {
        this.password = this.getPasswordFromURL();
    }

    getPasswordFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('password') || urlParams.get('pwd') || '';
    }

    async loadAndDecryptBinaryFile(filePath, extension = '.png') {
        const response = await fetch(filePath);
        const encryptedData = await response.arrayBuffer();
        const mimeType = this.extensionToMimeType(extension);

        return this.decryptBinaryImage(encryptedData, mimeType);
    }

    decryptBinaryImage(encryptedArrayBuffer, mimeType) {
        const encryptedBytes = new Uint8Array(encryptedArrayBuffer);
        const passwordBytes = new TextEncoder().encode(this.password);
        const result = new Uint8Array(encryptedBytes.length);

        for (let i = 0; i < encryptedBytes.length; i++) {
            result[i] = encryptedBytes[i] ^ passwordBytes[i % passwordBytes.length];
        }

        return new Blob([result], { type: mimeType });
    }

    extensionToMimeType(extension) {
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg'
        };
        return mimeTypes[extension] || 'image/png';
    }
}

// 使用示例
const decryptor = new ImageDecryptor();
const blob = await decryptor.loadAndDecryptBinaryFile('/dist/public/app_icon1.en.png', '.png');
const blobUrl = URL.createObjectURL(blob);
document.getElementById('myImage').src = blobUrl;
```

### 前端开发检查清单

开发前端解密功能时，必须检查以下内容：

- [ ] 密码从 GET 参数获取（`?password=xxx` 或 `?pwd=xxx`）
- [ ] 如果没有 GET 参数，默认使用空字符串 `""`
- [ ] 使用 `fetch().arrayBuffer()` 加载文件
- [ ] XOR 解密算法与后端完全一致
- [ ] 正确识别文件扩展名对应的 MIME 类型
- [ ] 硬编码 10 个文件名（不能动态扫描）
- [ ] 始终显示解密结果（即使是乱码）
- [ ] 不验证密码正确性
- [ ] 不使用 base64 解码
- [ ] 不尝试加载 JavaScript 模块

### 常见错误和解决方案

#### 错误 1: 文件格式不匹配

**症状**: 前端加载失败或解密后是乱码

**原因**: 后端输出了 JavaScript 文件或 base64 格式，前端期望二进制文件

**解决**:
- 后端: 使用 `fs.promises.writeFile(path, buffer)` 直接写入二进制 Buffer
- 前端: 使用 `fetch().arrayBuffer()` 加载

#### 错误 2: 密码不匹配

**症状**: 解密后图片无法显示或显示损坏

**原因**: 前端使用的密码与后端加密时的密码不一致

**解决**:
- 检查后端加密使用的密码（默认 `BuildFactoryEncryptionKey2025`）
- 检查前端 GET 参数传递的密码
- 确保两者一致

#### 错误 3: MIME 类型错误

**症状**: 图片加载但无法显示

**原因**: Blob 创建时使用了错误的 MIME 类型

**解决**:
- 根据原始文件扩展名设置正确的 MIME 类型
- `.png` → `image/png`
- `.jpg` → `image/jpeg`

### 测试步骤

#### 1. 后端加密测试

```bash
# 创建测试图片
cp /path/to/test.png /www/_build_dir/appfactory-master-dashboard/dist/public/app_icon1.png

# 查看 daemon 日志
journalctl -u webapp-appfactory-master-dashboard-daemon -f

# 验证加密文件生成
ls -lh /www/programing/core_node/poly_apps/appfactory-master-dashboard/dist/public/app_icon1.en.png

# 验证是二进制文件（不是文本）
file /www/programing/core_node/poly_apps/appfactory-master-dashboard/dist/public/app_icon1.en.png
# 应该显示: data 而不是 ASCII text 或 JavaScript
```

#### 2. 前端解密测试

```javascript
// 在浏览器控制台测试
const decryptor = new ImageDecryptor();
const blob = await decryptor.loadAndDecryptBinaryFile('/dist/public/app_icon1.en.png', '.png');
const url = URL.createObjectURL(blob);
console.log('Decrypted URL:', url);

// 显示在页面上
const img = document.createElement('img');
img.src = url;
document.body.appendChild(img);
```

#### 3. 密码测试

```
# 测试正确密码
http://localhost:10000/apps?password=BuildFactoryEncryptionKey2025

# 测试错误密码（应该显示乱码，但不报错）
http://localhost:10000/apps?password=wrongpassword

# 测试无密码（默认空字符串）
http://localhost:10000/apps
```

### Mock 数据集成

- `AppInstance` 类型已添加 `icon` 和 `splash` 字段
- `MOCK_APPS` 中前 5 个应用已配置 icon 和 splash
- 应用组合和已发布应用使用相同的 mock 数据
- 所有数据统一从 `constants.ts` 获取，确保一致性

## 前端硬编码实现

### 硬编码文件列表

前端服务 (`encryptedImageService.ts`) 中硬编码了10个文件名：

```typescript
const HARDCODED_ENCRYPTED_ASSETS = {
  icons: [
    'app_icon1.en.png',
    'app_icon2.en.png',
    'app_icon3.en.png',
    'app_icon4.en.png',
    'app_icon5.en.png'
  ],
  splashes: [
    'app_splash1.en.png',
    'app_splash2.en.png',
    'app_splash3.en.png',
    'app_splash4.en.png',
    'app_splash5.en.png'
  ]
} as const;
```

**重要**: 
- 这10个文件名是**硬编码**的，不能动态扫描目录
- 如果加密端生成的文件名不匹配，前端无法加载
- 文件名必须严格按照上述格式

### 使用方式

```typescript
import { encryptedImageService } from '../services/encryptedImageService';

// 方式1: 通过索引加载（推荐）
const iconUrl = await encryptedImageService.loadIconByIndex(1); // app_icon1.en.png
const splashUrl = await encryptedImageService.loadSplashByIndex(1); // app_splash1.en.png

// 方式2: 通过appId和文件名加载
const iconUrl = await encryptedImageService.loadAppIcon('app1', 'app_icon1.en.png');
const splashUrl = await encryptedImageService.loadAppSplash('app1', 'app_splash1.en.png');

// 方式3: 只通过appId（会自动从MOCK_APPS获取文件名）
const iconUrl = await encryptedImageService.loadAppIcon('app1');
const splashUrl = await encryptedImageService.loadAppSplash('app1');

// 加载所有图标和启动画面
const icons = await encryptedImageService.loadAllIcons(); // [icon1, icon2, icon3, icon4, icon5]
const splashes = await encryptedImageService.loadAllSplashes(); // [splash1, splash2, splash3, splash4, splash5]
```

## 给其他 AI 的说明

此系统已完全实现并可直接使用:

1. **10 张图片已硬编码**: 
   - 前端硬编码列表: `encryptedImageService.ts` 中的 `HARDCODED_ENCRYPTED_ASSETS`
   - 文件名: `app_icon1-5.en.png` 和 `app_splash1-5.en.png`
   - 不能动态扫描，必须硬编码

2. **Mock 数据已准备**: 
   - 5 个应用的完整信息在 `constants.ts` 的 `MOCK_APPS` 数组中
   - 前5个应用（app1-app5）已包含 `icon` 和 `splash` 字段
   - 应用组合和已发布应用使用相同的 mock 数据源

3. **加密自动完成**: 
   - daemon 服务会自动加密放入 `/www/_build_dir/appfactory-master-dashboard/dist/public/` 的图片
   - 加密后保存到 `/www/programing/core_node/poly_apps/appfactory-master-dashboard/dist/public/`

4. **解密库已就绪**: 
   - 使用 `encryptedImageService` 即可加载解密图片
   - 支持 GET 参数传递密码: `?password=xxx` 或 `?pwd=xxx`
   - **如果没有 GET 参数，默认密码为空字符串 `""`**
   - 密码优先级: GET 参数 > 默认空字符串

5. **组件已集成**: 
   - `AppDetailPage` 和 `AppReleaseList` 组件已支持显示 icon 和 splash
   - 自动从 mock 数据获取文件名并解密显示

6. **数据一致性**: 
   - 所有地方使用相同的 mock 数据源（`constants.ts`）
   - 确保应用组合和已发布应用显示相同的图标和启动画面

**加密端必须满足的要求**:
- 处理上述10个硬编码文件
- 文件命名格式: `{name}.en.png`
- 二进制加密格式（不是 base64）
- 保留文件扩展名

直接引用这些文件即可使用，无需修改核心逻辑。
