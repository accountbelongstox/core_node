# Python pycore 开发指南

## 1. 核心开发标准

### 1.1 基本要求
- 所有代码必须用英文编写
- 基于 Python 3.10+
- 使用 pycore 包的绝对导入
- 代码和输出只使用 ASCII 字符

### 1.2 架构原则
- 所有常量集中在 pygvar 管理
- 所有日志、文件操作、网络功能使用 pyfoundations/pyutils
- 避免相对导入，使用绝对路径
- pycore 修改需保持向后兼容

### 1.3 文件管理
- 静态文件：放在根目录 `public` 文件夹
- 缓存/临时文件夹：使用 pygvar 中的目录 (CACHE_DIR, TMP_DIR)
- 使用 ColorPrint 输出错误，而不是 raise Exception

### 1.4 关键代码标准

**导入语句规则**
- 所有导入语句必须在文件顶部
- 顺序：标准库 → 第三方 → 项目内部
- 禁止：函数内部的导入语句
- 禁止：try-except 块中的导入语句

**Try-Except 块规则（AI 代码）**
- AI 生成的代码不能使用 try-except 块
- 原因：try-except 隐藏错误，调试困难
- 替代方案：条件检查、返回错误状态、使用 ColorPrint

## 2. pycore 架构

### 2.1 组件概览
- `pycore/pyfoundations` - 核心基础，仅使用 Python 标准库
- `pycore/pyutils` - 工具类，可使用第三方包，导出实例/单例
- `pycore/pyctl` - 可调用 pyutils 组织基础多功能类库
- `pycore/pyfoundations/pygvar` - 全局常量和变量
- `pyapps` - 使用 pycore 作为基础服务的应用

## 3. 模块开发规则

### 3.1 pyfoundations 规则
- 存储最基础的模块（ColorPrint, Encyclopedia, EventBus, ThreadBus, SecretManager, Commander）
- 只使用 Python 标准库，无第三方包
- 只能从其他 pyfoundations 模块导入

### 3.2 pyutils 规则
- 可引用 pyfoundations 和 pygvar
- 不要重新实现 pyfoundations 功能
- 导出实例或单例，而不是类
- 可使用第三方包
- 每个功能一个子目录

### 3.3 pygvar 使用
- 所有常量和变量的集中位置
- 导入模式：`from pycore.pyfoundations.pygvar import CONSTANT_NAME`

## 4. 应用开发标准

### 4.1 应用目录结构
```
pyapps/{appname}/
├── {appname}_main.py       # 入口点
├── {appname}_config/       # [可选]
├── {appname}_bus_keys/     # [如使用 THREAD_BUS 则必需]
├── controller/             # 业务逻辑
├── service/                # [可选]
├── model/                  # [可选]
└── scripts/
```

### 4.2 入口点约定
- 标准：`{appname}_main.py` - 入口点
- 必须定义 `start()` 或 `main()` 函数

## 5. 第三方包

### 5.1 依赖管理
- 所有第三方包必须在 `pycore/pyfoundations/third_party.py` 注册

### 5.2 延迟加载模式（必需）
- 必需：从 `pycore.pyfoundations.third_party` 导入 getter 函数
- 必需：调用 getter 函数获取包
- 禁止：直接包导入

## 6. 数据库系统

### 6.1 数据库规范
- 位置：`pycore/database/`
- 模型位置：`pycore/database/models/`
- 依赖：只有 `pygvar`, `pyfoundations`, `sqlalchemy`
- 导入：`from pycore.database import database_manager, BaseModel`

### 6.2 表命名规则
- 命名空间格式：`common`, `app_{name}`, `util_{name}`
- 表键格式：`{namespace}.{table_name}`
- 禁止：硬编码表名字符串

