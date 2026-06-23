# 加密图片系统 - 最终配置

## 目录结构映射

### 源文件位置 (Build目录 - Git忽略)
```
/www/_build_dir/appfactory-master-dashboard/dist/public/
├── app_icon1.png
├── app_icon2.png
├── app_icon3.png
├── app_icon4.png
├── app_icon5.png
├── app_splash1.png
├── app_splash2.png
├── app_splash3.png
├── app_splash4.png
└── app_splash5.png
```

### 加密后位置 (项目目录 - 提交到Git)
```
/www/programing/core_node/poly_apps/appfactory-master-dashboard/public/
├── app_icon1.en.js    (14KB)
├── app_icon2.en.js    (15KB)
├── app_icon3.en.js    (15KB)
├── app_icon4.en.js    (19KB)
├── app_icon5.en.js    (3.2KB)
├── app_splash1.en.js  (51KB)
├── app_splash2.en.js  (22KB)
├── app_splash3.en.js  (32KB)
├── app_splash4.en.js  (74KB)
└── app_splash5.en.js  (2.8KB)
```

## 子目录结构映射规则

Daemon 自动加密逻辑 (daemon.cjs:109-115):

```
源文件: dist/public/subdir/file.png
↓
目标文件: public/subdir/file.en.js
```

- 保持 `dist/public/` 之后的所有子目录结构
- 如果没有子目录，直接放在 `public/` 根目录
- 扩展名: `.png` → `.en.js`
- 格式: PNG二进制 → Base64编码的JS模块

## 前端引用路径

文件: `public/js/encrypted_app_assets.js` (lines 27-39)

```javascript
this.ENCRYPTED_ASSETS = {
    icons: [
        '/app_icon1.en.js',
        '/app_icon2.en.js',
        '/app_icon3.en.js',
        '/app_icon4.en.js',
        '/app_icon5.en.js'
    ],
    splashes: [
        '/app_splash1.en.js',
        '/app_splash2.en.js',
        '/app_splash3.en.js',
        '/app_splash4.en.js',
        '/app_splash5.en.js'
    ]
};
```

## 密码传递方式

URL GET 参数:
```
http://localhost:PORT/?password=BuildFactoryEncryptionKey2025
http://localhost:PORT/?pwd=BuildFactoryEncryptionKey2025
```

默认: 空字符串 (会显示乱码)

## 文件格式

每个 `.en.js` 文件包含:

```javascript
// 加密图片元数据
const encrypted = "base64EncodedEncryptedData...";
const metadata = {
  "original": "app_icon1.png",
  "extension": ".png",
  "encrypted": "2026-01-04T22:59:59.420Z"
};

// Node.js解密函数
function decrypt(password) { ... }

module.exports = { encrypted, metadata, decrypt };
```

## 核心文件

### 后端加密
- `scripts/_daemon_tools/image_encryptor.cjs` - 加密算法 (XOR + Base64)
- `scripts/daemon.cjs` - 自动监听并加密文件

### 前端解密
- `public/js/image_decryptor.js` - 解密库 (XOR)
- `public/js/encrypted_app_assets.js` - 资源管理器 (硬编码路径)
- `public/test_encrypted_assets.html` - 测试页面

## 加密参数

- 算法: XOR (对称加密)
- 默认密码: `BuildFactoryEncryptionKey2025`
- 编码: Base64
- 无压缩 (图片已压缩)

## Daemon 重启

修改代码后需要重启 daemon:

```bash
sudo systemctl restart webapp-appfactory-master-dashboard-daemon.service
```

或使用重启脚本:
```bash
/www/programing/core_node/poly_apps/appfactory-master-dashboard/scripts/restart_daemon.sh
```

## 当前状态

✅ **所有10个加密文件已生成** (05:59)
✅ **文件位于正确目录** (`public/` 根目录)
✅ **前端路径已更新** (移除 `/encrypted_assets/` 前缀)
✅ **Daemon代码已更新** (保持子目录结构)
✅ **旧目录已删除** (`public/encrypted_assets/`)

⚠️  **Daemon 需要重启** 以加载新代码

## 测试方法

1. 启动 Web 服务器
2. 访问: `http://localhost:PORT/test_encrypted_assets.html`
3. 添加正确密码: `?password=BuildFactoryEncryptionKey2025`
4. 查看所有10个图片是否正确显示

## Git 状态

需要提交的文件:
```
public/app_icon1.en.js
public/app_icon2.en.js
public/app_icon3.en.js
public/app_icon4.en.js
public/app_icon5.en.js
public/app_splash1.en.js
public/app_splash2.en.js
public/app_splash3.en.js
public/app_splash4.en.js
public/app_splash5.en.js
public/js/encrypted_app_assets.js (已修改)
scripts/daemon.cjs (已修改)
```

Git 忽略:
```
dist/ (包含源文件)
```
