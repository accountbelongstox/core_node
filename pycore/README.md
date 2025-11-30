# PyCore - Python Core Library

**Version**: 1.0.0
**Python Foundation Library for core_node Project**

## 核心模块

### PyFoundations (`pyfoundations/`)
核心基础工具库，提供跨项目通用功能。

#### 主要特性

**🎨 ColorPrint** - 彩色终端输出
支持多级别日志（INFO/WARNING/ERROR/SUCCESS），跨平台兼容。

**📚 Encyclopedia** - 全局缓存系统
线程安全的键值存储，支持应用间数据共享。

**📡 EventBus** - 事件总线
发布/订阅模式，实现模块间解耦通信。

**🌐 GlobalVarManager** - 全局变量管理
统一管理项目级配置和运行时状态。

**📱 Device** - 设备抽象层
支持 Android/Scrcpy 设备管理，提供分辨率、编码器等配置。

**🔐 SecretManager** (新增)
- **AES-256-GCM 加密** - 使用 Node.js disguise.js 工具
- **自动密钥管理** - 统一管理 `.secret_keys/` 目录
- **跨语言兼容** - 与 PowerShell SecretManager 互操作
- **批量解密优化** - 会话级缓存，减少重复解密
- **密钥函数**:
  - `get_secret_key()` - 获取单个密钥（自动解密）
  - `set_secret_key()` - 加密保存密钥
  - `get_all_secret_keys()` - 批量获取所有密钥
  - `encrypt_all_secrets()` - 批量加密
  - `decrypt_all_secrets()` - 批量解密

## 使用示例

```python
# 导入基础工具
from pyfoundations import ColorPrint, Encyclopedia, EventBus

# 使用加密管理
from pyfoundations import get_secret_key, set_secret_key

# 保存加密密钥
set_secret_key('api_key_1', 'secret_value_123')

# 获取密钥（自动解密）
api_key = get_secret_key('api_key_1')

# 彩色输出
ColorPrint.success("Operation completed!")

# 事件通信
EventBus.publish("app.started", {"timestamp": time.time()})
```

## 目录结构

```
pycore/
├── pyfoundations/          # 基础工具库
│   ├── color_print.py      # 彩色输出
│   ├── encyclopedia.py     # 全局缓存
│   ├── event_bus.py        # 事件总线
│   ├── secret_manager.py   # 密钥管理 (新增)
│   ├── gvar/              # 全局变量
│   └── device/            # 设备抽象
└── README.md              # 本文件
```

## 安装与集成

```python
import sys
from pathlib import Path

# 添加 pycore 到路径
pycore_path = Path('D:/programing/core_node/pycore')
sys.path.insert(0, str(pycore_path))

# 导入使用
from pyfoundations import get_secret_key
```

## 加密存储

密钥存储在项目根目录：
- `.secret_keys/already_encrypted/` - 加密文件（*.js）
- `.secret_keys/.secret_ignore/` - 解密缓存（gitignored）

**安全特性**：
- 密码派生（PBKDF2）
- 自动 gitignore 明文密钥
- 内存安全（使用后清除密码）

## 版本兼容

- Python: 3.6+
- 依赖: 标准库（加密需要 Node.js）
- 平台: Windows / Linux / WSL / macOS

## 许可

Internal use only - core_node project
