# Special Software Environment Manager - 使用指南

## 快速开始

### 运行方式

有三种方式可以运行此工具：

1. **作为Python模块运行**（推荐）：
   ```bash
   cd D:/programing/core_node
   python -m scripts.pytools.special_software_env_manager
   ```

2. **直接运行main.py**：
   ```bash
   cd D:/programing/core_node/scripts/pytools/special_software_env_manager
   python main.py
   ```

3. **运行主程序文件**：
   ```bash
   python D:/programing/core_node/scripts/pytools/special_software_env_manager/special_software_env_manager.py
   ```

## 系统要求

- Python 3.6 或更高版本
- 无需额外依赖（仅使用Python标准库）
- 建议以管理员/root权限运行（用于系统环境变量修改）

## 主要功能

### 1. 管理AI工具环境变量

支持以下AI工具的环境变量配置：

- **Claude AI**
  - ANTHROPIC_BASE_URL
  - ANTHROPIC_AUTH_TOKEN
  - ANTHROPIC_API_KEY

- **OpenAI**
  - OPENAI_API_BASE
  - OPENAI_API_KEY

- **Factory AI Droid**
  - DROID_API_URL
  - DROID_API_KEY

- **SSH Connection**
  - SSH_CONNECTION
  - SSH_PASSWORD

### 2. 双平台脚本生成

当你添加全局命令时，系统会自动生成两个版本的脚本：

#### Windows版本 (.ps1)
- 位置：`scripts/winenvs/`
- 功能：
  - 完整的环境变量管理
  - SecretManager集成
  - MCP服务器同步
  - 预启动和升级任务

#### Linux版本 (.sh)
- 位置：`scripts/liunxenvs/`
- 功能：
  - 简单的命令执行
  - 环境变量由`linux_path_function.sh`管理
  - 自动设置可执行权限

## 架构说明

### 核心模块

```
special_software_env_manager/
├── __init__.py                              # 包初始化
├── __main__.py                              # 模块运行入口
├── main.py                                  # 主入口脚本
├── special_software_env_manager.py          # 主程序逻辑
├── secret_read.py                           # 独立的密钥解密辅助脚本
├── utils/                                   # common_utils.py, secret_manager.py, smart_recognition.py, local_test_helper.py
├── config/                                  # config_manager.py, path_config.py
├── generators/                              # command_content_generator_windows.py, command_content_generator_linux.py
├── managers/                                # environment_variable_manager.py, script_manager.py, backup_manager.py, menu_handler.py, command_handler.py, app_scanner.py, file_number_manager.py, variable_input_handler.py, encrypted_constants_manager.py
├── script_sections/                         # env_loading_section.py, ssh_command_generator.py, backup_restore_section.py, mcp_section.py, user_directory_section.py
└── README.txt                               # 简要说明
```

### 关键设计原则

1. **平台无关的核心逻辑**
   - 菜单系统
   - 配置管理
   - 用户交互

2. **平台特定的脚本生成**
   - Windows: PowerShell脚本 + 完整功能
   - Linux: Bash脚本 + 简化功能

3. **配置驱动**
   - 所有工具配置集中管理
   - 易于添加新工具

## 与原PowerShell版本的对比

### 相同点
- 菜单交互方式
- 支持的工具和功能
- 生成的脚本格式

### 不同点
| 特性 | PowerShell版本 | Python版本 |
|------|---------------|-----------|
| 平台支持 | 仅Windows | Windows + Linux + macOS |
| 依赖 | PowerShell 5.0+ | Python 3.6+ |
| 菜单导航 | 箭头键 | 箭头键 |
| 代码维护 | PowerShell脚本 | Python代码 |
| 测试 | 手动 | 可自动化测试 |

## CommandContentGenerator 的两个版本

### Windows版本 (generators/command_content_generator_windows.py)

**唯一需要在Windows和Linux上不同的部分**

生成功能：
- PowerShell脚本 (.ps1)
- SecretManager集成
- MCP同步功能
- 环境变量加载
- 预启动脚本执行
- 升级检查和提示

代码位置：`scripts/pytools/special_software_env_manager/generators/command_content_generator_windows.py`

### Linux版本 (generators/command_content_generator_linux.py)

**唯一需要在Windows和Linux上不同的部分**

生成功能：
- Bash脚本 (.sh)
- 简单命令执行
- 环境变量由外部管理
- 无复杂逻辑

代码位置：`scripts/pytools/special_software_env_manager/generators/command_content_generator_linux.py`

## 开发说明

### 添加新的AI工具

1. 在 `config/config_manager.py` 中添加配置：
   ```python
   @staticmethod
   def get_your_tool_config() -> Dict[str, Any]:
       return {
           'Title': 'Your Tool Name',
           'Description': 'Description',
           'Common': 'toolname',
           'CommandPrefix': 'toolname',
           'DisplayName': 'Your Tool',
           'Variables': [
               {
                   'Name': 'YOUR_TOOL_VAR',
                   'DisplayName': 'YOUR_TOOL_VAR',
                   'Description': 'Description',
                   'IsSecret': True,
                   'InputType': 'Token'
               }
           ]
       }
   ```

2. 在 `_initialize_configs()` 中注册：
   ```python
   self.configs['Your Tool'] = self.get_your_tool_config()
   ```

3. 在主程序中添加action映射：
   ```python
   self.action_to_config['toolname'] = 'Your Tool'
   ```

### 待完成功能

当前实现了基础框架，以下功能需要进一步开发：

1. ☐ 完整的用户输入工作流
2. ☐ 智能识别和自动填充
3. ☐ SecretManager集成
4. ☐ 配置保存和恢复
5. ☐ 脚本列表和管理
6. ☐ 环境变量刷新

## 故障排除

### 问题：菜单不响应
**解决方案**：确保终端支持ANSI转义序列和原始输入模式

### 问题：脚本生成失败
**解决方案**：检查目标目录权限和路径设置

### 问题：环境变量未生效
**解决方案**：
- Windows: 重启终端或使用Windows路径函数
- Linux: 运行 `source ~/.bashrc` 或 `source ~/.zshrc`

## 贡献指南

欢迎贡献代码！请确保：

1. 遵循现有代码风格
2. 添加必要的注释
3. 更新相关文档
4. 测试跨平台兼容性

## 许可证

与项目主仓库保持一致。

## 联系方式

如有问题或建议，请在项目仓库中提出issue。
