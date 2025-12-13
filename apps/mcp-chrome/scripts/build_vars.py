#!/usr/bin/env python3
"""
Build Variable Keys Definition
统一的变量中心 Key 定义，避免字符串散落各处
"""

class BuildVars:
    """构建变量 Key 中心"""

    # 变量前缀（防止多项目冲突）
    PREFIX = "mcpchrome_"

    # === 基础环境变量 ===
    PROJECT_ROOT = f"{PREFIX}project_root"           # 项目根目录
    PLATFORM = f"{PREFIX}platform"                   # 平台：windows/linux/darwin
    VARS_DIR = f"{PREFIX}vars_dir"                   # 变量存储目录

    # === 依赖版本 ===
    NODE_VERSION = f"{PREFIX}node_version"           # Node.js 版本
    PNPM_VERSION = f"{PREFIX}pnpm_version"           # pnpm 版本
    NODE_INSTALLED = f"{PREFIX}node_installed"       # Node.js 是否已安装
    PNPM_INSTALLED = f"{PREFIX}pnpm_installed"       # pnpm 是否已安装

    # === 路径变量 ===
    EXTENSION_PATH = f"{PREFIX}extension_path"       # 扩展输出路径
    NATIVE_PATH = f"{PREFIX}native_path"             # Native Server 路径
    SHARED_PATH = f"{PREFIX}shared_path"             # Shared 包路径
    MANIFEST_PATH = f"{PREFIX}manifest_path"         # Native Messaging Host manifest 路径
    NODE_MODULES_EXISTS = f"{PREFIX}node_modules_exists"  # node_modules 是否存在

    # === 构建命令 ===
    CMD_CHECK_DEPS = f"{PREFIX}cmd_check_deps"       # 检查依赖命令
    CMD_INSTALL = f"{PREFIX}cmd_install"             # 安装依赖命令
    CMD_BUILD_SHARED = f"{PREFIX}cmd_build_shared"   # 构建 shared 包命令
    CMD_BUILD_NATIVE = f"{PREFIX}cmd_build_native"   # 构建 native server 命令
    CMD_BUILD_EXTENSION = f"{PREFIX}cmd_build_extension"  # 构建扩展命令
    CMD_REGISTER = f"{PREFIX}cmd_register"           # 注册 Native Messaging Host 命令

    # === 状态标记 ===
    ERROR = f"{PREFIX}error"                         # 错误信息
    SHOULD_INSTALL = f"{PREFIX}should_install"       # 是否需要安装依赖
    BUILD_RETRY_MAX = f"{PREFIX}build_retry_max"     # 构建最大重试次数

    # === UI 显示 ===
    UI_TITLE = f"{PREFIX}ui_title"                   # UI 标题
    UI_STEP_1 = f"{PREFIX}ui_step_1"                 # 步骤 1 描述
    UI_STEP_2 = f"{PREFIX}ui_step_2"                 # 步骤 2 描述
    UI_STEP_3 = f"{PREFIX}ui_step_3"                 # 步骤 3 描述
    UI_STEP_4 = f"{PREFIX}ui_step_4"                 # 步骤 4 描述
    UI_STEP_5 = f"{PREFIX}ui_step_5"                 # 步骤 5 描述
    UI_STEP_6 = f"{PREFIX}ui_step_6"                 # 步骤 6 描述

    @classmethod
    def get_all_keys(cls):
        """获取所有变量 Key"""
        return {k: v for k, v in cls.__dict__.items()
                if not k.startswith('_') and isinstance(v, str) and v.startswith(cls.PREFIX)}
