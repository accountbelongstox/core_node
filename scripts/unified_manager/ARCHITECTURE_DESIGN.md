# Unified App Manager - 多文件协作架构说明

## 架构原则

**核心设计思想**: Python处理复杂逻辑,Shell只负责执行系统命令

### Python层职责 (`scripts/unified_manager/core/`)
- 文件生成 (wrapper脚本、服务文件)
- 配置生成 (动态内容、模板处理)
- 项目类型检测 (buildmanager)
- 构建命令生成
- 业务逻辑处理

### Shell层职责 (`scripts/unified_manager/unified_manager_linux.sh`)
- 执行systemctl命令 (enable, start, stop, reload)
- 执行其他系统命令 (nginx reload等)
- 读取Python生成的文件和变量
- 不生成任何复杂文件内容

## Python模块架构

```
scripts/unified_manager/
├── core/
│   ├── unified_core.py           # 主管理器,协调所有模块
│   ├── build_manager.py          # 构建管理:检测项目类型,执行构建
│   ├── service_file_generator.py # NEW: 服务文件生成器
│   ├── menu_manager.py            # 菜单管理:UI显示和用户输入
│   └── launcher_generator.py     # 启动脚本生成器(dev模式)
├── utils/
│   ├── global_variables.py       # 全局变量管理器
│   ├── variable_keys.py          # 变量键定义
│   └── platform_dirs.py          # 平台目录管理
└── modules/ (Shell辅助模块)
    ├── systemd_service_generator.sh  # NEW: SystemD工具函数
    └── wrapper_script_generator.sh   # NEW: Wrapper脚本工具函数
```

## 模块协作流程

### Build Service创建流程

#### Python层 (unified_core.py)

```python
# 1. 用户选择'B' (Build & Create service)
elif user_choice == 'B':
    # 2. 执行构建
    build_mgr = BuildManager()
    success, message, build_output = build_mgr.build_project(app.path, app.name, app.framework)

    # 3. 生成启动命令
    command = build_mgr.generate_build_start_command(app.path, build_output, app.framework, app.port)

    # 4. 使用ServiceFileGenerator生成所有文件
    service_gen = ServiceFileGenerator()
    success, service_name, message = service_gen.create_build_service(
        app_name=app.name,
        app_path=app.path,
        framework_type=app.framework,
        execute_command=command,
        service_suffix="-build"
    )

    # 5. 获取需要移除的服务列表(互斥)
    services_to_remove = service_gen.get_service_patterns_to_remove(app.name, is_build_service=True)

    # 6. 写入全局变量供Shell读取
    global_vars.write_var("BUILD_SERVICE_NAME", service_name)
    global_vars.write_var("SERVICES_TO_REMOVE", " ".join(services_to_remove))
    global_vars.write_var("ACTION", "build_service_create")
    global_vars.write_status("execute_ready")
```

#### Shell层 (unified_manager_linux.sh)

```bash
# 1. 检测action
action=$(read_global_var "ACTION")

if [[ "$action" == "build_service_create" ]]; then
    # 2. 读取Python生成的信息
    build_service_name=$(read_global_var "BUILD_SERVICE_NAME")
    services_to_remove=$(read_global_var "SERVICES_TO_REMOVE")

    # 3. 移除互斥服务
    for service in $services_to_remove; do
        systemctl stop "$service" 2>/dev/null || true
        systemctl disable "$service" 2>/dev/null || true
        rm -f "/etc/systemd/system/$service.service"
    done

    # 4. 注册新服务(文件已由Python创建)
    systemctl daemon-reload
    systemctl enable "$build_service_name"
    systemctl start "$build_service_name"
fi
```

## ServiceFileGenerator类 (service_file_generator.py)

### 核心功能

1. **generate_wrapper_script()**
   - 生成wrapper脚本
   - 处理build和dev两种模式
   - Build模式: 命令已包含完整路径
   - Dev模式: 需要cd到工作目录

2. **generate_service_file()**
   - 生成systemd服务文件
   - 设置正确的WorkingDirectory
   - 配置资源限制 (CPU, Memory)

3. **create_build_service()**
   - 组合调用上述两个方法
   - 返回服务名称供Shell使用

4. **get_service_patterns_to_remove()**
   - 生成互斥服务列表
   - Build服务替换Normal服务
   - Normal服务替换Build服务

### 互斥服务管理

```python
def get_service_patterns_to_remove(app_name: str, is_build_service: bool) -> List[str]:
    patterns = ["webapp", "nuxt", "laravel", "flutter", "app"]

    if is_build_service:
        # 创建Build服务时,移除Normal服务
        return [f"{pattern}-{app_name}" for pattern in patterns]
    else:
        # 创建Normal服务时,移除Build服务
        return [f"{pattern}-{app_name}-build" for pattern in patterns]
```

## 全局变量通信

### Python写入

```python
from global_variables import global_vars

# 写入服务信息
global_vars.write_var("BUILD_SERVICE_NAME", "webapp-myapp-build")
global_vars.write_var("SERVICES_TO_REMOVE", "webapp-myapp nuxt-myapp")
global_vars.write_var("ACTION", "build_service_create")
global_vars.write_status("execute_ready")
```

### Shell读取

```bash
# 读取全局变量
build_service_name=$(read_global_var "BUILD_SERVICE_NAME")
services_to_remove=$(read_global_var "SERVICES_TO_REMOVE")
action=$(read_global_var "ACTION")
status=$(read_global_var "STATUS")
```

## 文件生成位置

### Wrapper脚本
- 路径: `/var/_core_node/unified_manager/temp_scripts/`
- 命名: `{service_name}.sh`
- 权限: `0o755` (可执行)

### SystemD服务文件
- 路径: `/etc/systemd/system/`
- 命名: `{service_name}.service`
- 格式: INI格式systemd unit文件

## 优势

1. **职责清晰**: Python处理复杂逻辑, Shell只执行系统命令
2. **可维护性**: 文件生成逻辑集中在Python,便于修改
3. **可测试性**: Python模块可独立测试
4. **扩展性**: 新增服务类型只需修改Python,无需改Shell
5. **跨平台**: 为未来Windows支持打下基础

## 待完成工作

1. **BUILD_PROXY_CREATE handler简化** (复杂,包含nginx配置)
2. **普通服务创建也使用ServiceFileGenerator** (SERVICE_CREATE, PROXY_CREATE)
3. **测试所有场景**
   - Build服务创建
   - Build + Proxy创建
   - 互斥服务替换
   - 端口配置
   - 多域名配置

## 使用示例

```python
# Python层使用
from service_file_generator import ServiceFileGenerator

gen = ServiceFileGenerator()

# 创建build服务
success, service_name, message = gen.create_build_service(
    app_name="myapp",
    app_path="/www/apps/myapp",
    framework_type="reactStart",
    execute_command="python3 -m http.server 8000 --directory /www/_build_dir/myapp/dist",
    service_suffix="-build"
)

if success:
    print(f"Service created: {service_name}")
    # 写入全局变量供Shell使用
    global_vars.write_var("BUILD_SERVICE_NAME", service_name)
```

```bash
# Shell层使用
build_service_name=$(read_global_var "BUILD_SERVICE_NAME")

# 只负责systemctl命令
systemctl daemon-reload
systemctl enable "$build_service_name"
systemctl start "$build_service_name"
```
