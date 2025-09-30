# D3Check - Diablo III Bot Auto Control System

基于Python的自动控制Windows程序系统，专门用于管理Diablo III机器人程序的自动化运行。

## 系统架构

### 四个主要组件

1. **提供器 (Provider)** - 配置管理
2. **工具类库 (Utils)** - 核心功能实现
3. **控制器 (Controller)** - 业务逻辑控制
4. **配置文件 (config.json)** - 系统配置

## 核心功能

### 1. Bot程序管理
- 在 `$BotBaseDir` 下递归扫描 `RoS-BoT.exe`
- 自动检测和管理 `$BootExeName`（临时生成的执行文件）
- 支持多种Bot程序状态管理

### 2. 程序状态管理
- **程序开始等待重启** - 初始状态
- **运行中** - Bot正常运行
- **正常退出等待重启** - 运行时长到达后正常退出
- **错误退出等待重启** - 异常退出，需要重启Diablo

### 3. UI分析和自动化
- 自动截取程序界面
- 分析可操作UI元素
- 生成JSON格式的元素信息
- 创建带编号标注的截图
- 根据操作ID数组执行自动化操作

### 4. Battle.net集成
- 自动启动Battle.net
- 支持自定义启动参数
- 自动化操作序列
- Diablo进程管理

### 5. 程序启动和结束
- 使用 `explorer` 启动程序（支持带参数）
- 使用 `taskkill` 结束程序
- 自动生成bat文件处理复杂启动参数

## 配置说明

### 主要配置项

```json
{
    "bot_settings": {
        "bot_base_dir": "D:\\applications\\GamesBot\\ros-bot-en",
        "bot_exe_name": "RoS-BoT.exe",
        "repeat_login_time": 300,
        "run_duration": 3600,
        "operation_ids": []
    },
    "battlenet_settings": {
        "battlenet_path": "D:\\applications\\Games\\Battle.net\\Battle.net.exe",
        "battlenet_args": "--setregion=US",
        "restart_battlenet_first": true
    }
}
```

### 关键常量
- `$BotBaseDir` - Bot程序基础目录
- `$重复登陆时间` - 重启间隔时间（秒）
- `$运行时长` - 单次运行时长（秒）
- `$USERTMPDIRBYD3TMP` - 用户临时目录
- `force_restart` - 强制重启选项（新增）

## 使用方法

### 1. 推荐启动方式（新增）
```bash
# 使用启动脚本（推荐，包含完整检查）
start.bat

# 或者直接使用PowerShell（需要管理员权限）
powershell -ExecutionPolicy Bypass -File start.ps1

# 强制安装依赖并启动
powershell -ExecutionPolicy Bypass -File start.ps1 -Force
```

### 2. 传统启动方式
```bash
# 直接启动（需要手动确保依赖）
python main.py

# 测试系统
python test_system.py

# 依赖检查（新增）
python utils/dependency_checker.py
```

### 3. 配置操作ID
在 `config.json` 中设置 `operation_ids` 数组：
```json
"operation_ids": [
    "click:1",
    "click:100,200",
    "key:F7",
    "type:hello world"
]
```

操作格式：
- `click:元素ID` - 点击指定ID的UI元素
- `click:x,y` - 点击指定坐标
- `double_click:元素ID` - 双击元素
- `right_click:元素ID` - 右键点击
- `key:按键名` - 按键操作（如F7退出）
- `type:文本` - 输入文本

## 工作流程

1. **启动阶段（已优化）**
   - 扫描Bot目录，找到 `RoS-BoT.exe`
   - 确定 `$BotDir` 和潜在的 `$BootExeName`
   - **新增**: 管理员权限检查
   - **新增**: 快速依赖检查

2. **运行阶段（已优化）**
   - **优先级1**: 检查 `$BootExeName` 是否已运行，直接使用
   - **优先级2**: 尝试直接启动 `$BootExeName`
   - **优先级3**: 启动 `RoS-BoT.exe` 等待 `$BootExeName` 生成
   - **新增**: 强制重启选项，避免进程冲突

3. **自动化阶段**
   - 分析UI界面，生成元素信息
   - 根据操作ID执行自动化操作
   - 进入运行时长计时

4. **退出阶段**
   - 运行时长到达后发送F7键退出
   - 进入重复登陆时间等待
   - 如果异常退出，先重启Diablo

5. **循环重复**
   - 等待时间结束后重新开始流程

## 文件结构

```
d3check/
├── main.py                 # 主入口
├── config.json            # 配置文件
├── test_system.py         # 测试脚本
├── provider/              # 配置提供器
│   ├── __init__.py
│   └── config_provider.py
├── utils/                 # 工具类库
│   ├── __init__.py
│   ├── color_print.py     # 彩色输出
│   ├── process_manager.py # 进程管理
│   ├── bot_scanner.py     # Bot扫描器
│   ├── ui_analyzer.py     # UI分析器
│   └── automation_controller.py # 自动化控制器
└── controller/            # 控制器
    ├── __init__.py
    ├── bot_state_manager.py # 状态管理器
    └── main_controller.py   # 主控制器
```

## 依赖要求

- Python 3.7+
- psutil - 进程管理
- pywin32 - Windows API
- Pillow - 图像处理

安装依赖：
```bash
pip install psutil pywin32 Pillow
```

## 注意事项

1. **权限要求** - 需要管理员权限来控制其他程序
2. **路径配置** - 确保Bot和Battle.net路径正确
3. **防火墙** - 可能需要防火墙例外
4. **杀毒软件** - 自动化操作可能被误报

## 故障排除

### 常见问题

1. **找不到Bot程序**
   - 检查 `bot_base_dir` 配置
   - 确认 `RoS-BoT.exe` 存在

2. **UI分析失败**
   - 检查程序窗口是否可见
   - 确认程序标题匹配

3. **自动化操作失败**
   - 检查操作ID格式
   - 确认UI元素存在

4. **进程启动失败**
   - 检查程序路径
   - 确认权限设置

## 开发说明

系统采用模块化设计，各组件职责明确：

- **ConfigProvider** - 统一配置管理
- **ProcessManager** - 进程生命周期管理
- **BotScanner** - Bot程序发现和管理
- **UIAnalyzer** - UI元素分析和截图
- **AutomationController** - 自动化操作执行
- **BotStateManager** - 状态机管理
- **MainController** - 主要业务逻辑协调

每个组件都有清晰的接口和错误处理机制。
