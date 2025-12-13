#!/usr/bin/env python3
"""
Build Orchestrator - 构建编排脚本
处理所有跨平台差异，生成构建命令和配置
不执行任何 shell 命令，只生成变量文件供 Shell 读取
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List

# 导入变量管理器和变量定义
from var_manager import get_instance as get_var_manager
from build_vars import BuildVars


class BuildOrchestrator:
    """构建编排器"""

    def __init__(self, project_root: str):
        """初始化"""
        self.project_root = Path(project_root).resolve()
        self.vm = get_var_manager()
        self.platform = self.vm.platform

        # 路径配置
        self.extension_path = self.project_root / "app" / "chrome-extension" / ".output" / "chrome-mv3"
        self.native_path = self.project_root / "app" / "native-server" / "dist"
        self.shared_path = self.project_root / "packages" / "shared" / "dist"

    def detect_environment(self):
        """检测环境并保存到变量"""
        print("Detecting environment...")

        # 基础信息
        self.vm.set(BuildVars.PROJECT_ROOT, str(self.project_root))
        self.vm.set(BuildVars.PLATFORM, self.platform)
        self.vm.set(BuildVars.VARS_DIR, self.vm.get_vars_dir_path())

        # 路径信息
        self.vm.set(BuildVars.EXTENSION_PATH, str(self.extension_path))
        self.vm.set(BuildVars.NATIVE_PATH, str(self.native_path))
        self.vm.set(BuildVars.SHARED_PATH, str(self.shared_path))

        # 检查 node_modules
        node_modules = self.project_root / "node_modules"
        self.vm.set(BuildVars.NODE_MODULES_EXISTS, "true" if node_modules.exists() else "false")

        # Native Messaging Host manifest 路径（平台特定）
        manifest_path = self._get_manifest_path()
        self.vm.set(BuildVars.MANIFEST_PATH, manifest_path)

        # 构建配置
        self.vm.set(BuildVars.BUILD_RETRY_MAX, "3")

        print(f"  Platform: {self.platform}")
        print(f"  Project Root: {self.project_root}")
        print(f"  Vars Dir: {self.vm.get_vars_dir_path()}")

    def _get_manifest_path(self) -> str:
        """获取 Native Messaging Host manifest 路径"""
        if self.platform == "windows":
            appdata = os.getenv("APPDATA", "")
            return os.path.join(appdata, "Google", "Chrome", "NativeMessagingHosts", "com.chromemcp.nativehost.json")
        elif self.platform == "darwin":
            home = str(Path.home())
            return os.path.join(home, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts", "com.chromemcp.nativehost.json")
        else:  # linux
            home = str(Path.home())
            return os.path.join(home, ".config", "google-chrome", "NativeMessagingHosts", "com.chromemcp.nativehost.json")

    def generate_commands(self):
        """生成构建命令"""
        print("Generating build commands...")

        # 依赖检查命令（仅用于显示，不执行）
        self.vm.set(BuildVars.CMD_CHECK_DEPS, "node --version && pnpm --version")

        # 安装依赖命令
        node_modules_exists = self.vm.get(BuildVars.NODE_MODULES_EXISTS) == "true"
        if node_modules_exists:
            self.vm.set(BuildVars.SHOULD_INSTALL, "false")
            self.vm.set(BuildVars.CMD_INSTALL, "")
        else:
            self.vm.set(BuildVars.SHOULD_INSTALL, "true")
            self.vm.set(BuildVars.CMD_INSTALL, "pnpm install")

        # 构建命令（跨平台相同）
        self.vm.set(BuildVars.CMD_BUILD_SHARED, "pnpm run build:shared")
        self.vm.set(BuildVars.CMD_BUILD_NATIVE, "pnpm run build:native")
        self.vm.set(BuildVars.CMD_BUILD_EXTENSION, "pnpm run build:extension")

        # 注册命令
        if self.platform == "windows":
            self.vm.set(BuildVars.CMD_REGISTER, "node scripts\\register-local-dev.cjs")
        else:
            self.vm.set(BuildVars.CMD_REGISTER, "node scripts/register-local-dev.cjs")

        print("  Commands generated successfully")

    def generate_ui_strings(self):
        """生成 UI 显示字符串"""
        if self.platform == "windows":
            title = "Chrome MCP Server - Windows Setup"
        elif self.platform == "darwin":
            title = "Chrome MCP Server - macOS Setup"
        else:
            title = "Chrome MCP Server - Linux Setup"

        self.vm.set(BuildVars.UI_TITLE, title)
        self.vm.set(BuildVars.UI_STEP_1, "Checking dependencies...")
        self.vm.set(BuildVars.UI_STEP_2, "Installing project dependencies...")
        self.vm.set(BuildVars.UI_STEP_3, "Building shared package...")
        self.vm.set(BuildVars.UI_STEP_4, "Building Native Server...")
        self.vm.set(BuildVars.UI_STEP_5, "Building Chrome Extension...")
        self.vm.set(BuildVars.UI_STEP_6, "Registering Native Messaging Host...")

    def validate_paths(self) -> bool:
        """验证路径（不执行命令，只检查路径是否合理）"""
        print("Validating paths...")

        if not self.project_root.exists():
            error = f"Project root does not exist: {self.project_root}"
            self.vm.set(BuildVars.ERROR, error)
            print(f"  ERROR: {error}")
            return False

        # 检查关键目录是否存在
        app_dir = self.project_root / "app"
        if not app_dir.exists():
            error = f"App directory does not exist: {app_dir}"
            self.vm.set(BuildVars.ERROR, error)
            print(f"  ERROR: {error}")
            return False

        print("  Paths validated successfully")
        return True

    def run(self) -> int:
        """运行编排器"""
        print("=" * 50)
        print("Build Orchestrator - Python")
        print("=" * 50)
        print()

        try:
            # 验证路径
            if not self.validate_paths():
                return 1

            # 检测环境
            self.detect_environment()

            # 生成命令
            self.generate_commands()

            # 生成 UI 字符串
            self.generate_ui_strings()

            print()
            print("=" * 50)
            print("Python processing complete!")
            print(f"Variables saved to: {self.vm.get_vars_dir_path()}")
            print("=" * 50)
            print()

            return 0

        except Exception as e:
            error = f"Python orchestrator failed: {e}"
            self.vm.set(BuildVars.ERROR, error)
            print(f"ERROR: {error}", file=sys.stderr)
            return 1


def main():
    """主函数"""
    # 获取项目根目录（脚本目录的父目录）
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    orchestrator = BuildOrchestrator(str(project_root))
    exit_code = orchestrator.run()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
