#!/usr/bin/env python3
"""
Variable Manager - Python 版本
统一的变量管理库，负责读写文件变量
"""

import os
import sys
import platform
from pathlib import Path
from typing import Optional, Dict


class VarManager:
    """变量管理器"""

    def __init__(self):
        """初始化变量管理器"""
        self.platform = self._detect_platform()
        self.vars_dir = self._get_vars_dir()
        self._ensure_vars_dir()

    @staticmethod
    def _detect_platform() -> str:
        """检测当前平台"""
        system = platform.system().lower()
        if system == "windows":
            return "windows"
        elif system == "darwin":
            return "darwin"
        else:
            return "linux"

    def _get_vars_dir(self) -> Path:
        """获取变量存储目录"""
        if self.platform == "windows":
            # Windows: C:\Users\用户名\.core_node\.build_global_vars
            home = Path.home()
            return home / ".core_node" / ".build_global_vars"
        else:
            # Linux/macOS: /var/_core_node/_build_global_vars/
            # 如果没有权限写入 /var，则使用用户目录
            var_dir = Path("/var/_core_node/_build_global_vars")
            if not var_dir.exists():
                try:
                    var_dir.mkdir(parents=True, exist_ok=True)
                    return var_dir
                except PermissionError:
                    # 降级到用户目录
                    home = Path.home()
                    return home / ".core_node" / ".build_global_vars"
            return var_dir

    def _ensure_vars_dir(self):
        """确保变量目录存在"""
        try:
            self.vars_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"ERROR: Failed to create vars directory: {self.vars_dir}", file=sys.stderr)
            print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)

    def set(self, key: str, value: str):
        """设置变量（写入文件）"""
        if not key:
            raise ValueError("Variable key cannot be empty")

        var_file = self.vars_dir / key
        try:
            with open(var_file, "w", encoding="utf-8") as f:
                f.write(value)
        except Exception as e:
            print(f"ERROR: Failed to write variable '{key}': {e}", file=sys.stderr)
            raise

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """获取变量（读取文件）"""
        if not key:
            raise ValueError("Variable key cannot be empty")

        var_file = self.vars_dir / key
        if not var_file.exists():
            return default

        try:
            with open(var_file, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            print(f"WARNING: Failed to read variable '{key}': {e}", file=sys.stderr)
            return default

    def delete(self, key: str):
        """删除变量（删除文件）"""
        if not key:
            raise ValueError("Variable key cannot be empty")

        var_file = self.vars_dir / key
        if var_file.exists():
            try:
                var_file.unlink()
            except Exception as e:
                print(f"WARNING: Failed to delete variable '{key}': {e}", file=sys.stderr)

    def clear_all(self):
        """清除所有变量"""
        if not self.vars_dir.exists():
            return

        for var_file in self.vars_dir.iterdir():
            if var_file.is_file():
                try:
                    var_file.unlink()
                except Exception as e:
                    print(f"WARNING: Failed to delete {var_file.name}: {e}", file=sys.stderr)

    def list_all(self) -> Dict[str, str]:
        """列出所有变量"""
        if not self.vars_dir.exists():
            return {}

        result = {}
        for var_file in self.vars_dir.iterdir():
            if var_file.is_file():
                try:
                    with open(var_file, "r", encoding="utf-8") as f:
                        result[var_file.name] = f.read()
                except Exception as e:
                    print(f"WARNING: Failed to read {var_file.name}: {e}", file=sys.stderr)

        return result

    def exists(self, key: str) -> bool:
        """检查变量是否存在"""
        if not key:
            return False
        var_file = self.vars_dir / key
        return var_file.exists()

    def get_vars_dir_path(self) -> str:
        """获取变量目录路径（字符串）"""
        return str(self.vars_dir)


# 全局单例
_instance = None


def get_instance() -> VarManager:
    """获取全局 VarManager 实例"""
    global _instance
    if _instance is None:
        _instance = VarManager()
    return _instance
