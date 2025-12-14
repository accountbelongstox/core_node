#!/usr/bin/env python3
"""
生成跨平台变量KEY定义文件
从 build_vars.py 生成 PowerShell 和 Bash 可以使用的变量KEY定义
确保所有脚本使用统一的变量KEY
"""

import sys
from pathlib import Path

# 导入变量定义
from build_vars import BuildVars


def generate_powershell_keys(output_file: Path):
    """生成 PowerShell 变量KEY定义"""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# VarKeys.ps1\n")
        f.write("# 自动生成的变量KEY定义 - 请勿手动编辑\n")
        f.write("# 由 generate_var_keys.py 从 build_vars.py 生成\n\n")

        f.write("# 变量KEY定义类\n")
        f.write("class VarKeys {\n")

        keys = BuildVars.get_all_keys()
        for key_name, key_value in sorted(keys.items()):
            # 转换为 PowerShell 风格的常量名
            f.write(f"    static [string] ${key_name} = \"{key_value}\"\n")

        f.write("}\n")

    print(f"Generated PowerShell keys: {output_file}")


def generate_bash_keys(output_file: Path):
    """生成 Bash 变量KEY定义"""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("#!/bin/bash\n")
        f.write("# var_keys.sh\n")
        f.write("# 自动生成的变量KEY定义 - 请勿手动编辑\n")
        f.write("# 由 generate_var_keys.py 从 build_vars.py 生成\n\n")

        keys = BuildVars.get_all_keys()
        for key_name, key_value in sorted(keys.items()):
            # Bash 变量名规范：全大写
            bash_var_name = f"VAR_KEY_{key_name}"
            f.write(f"readonly {bash_var_name}=\"{key_value}\"\n")

        f.write("\n# 导出所有变量KEY\n")
        for key_name, _ in sorted(keys.items()):
            bash_var_name = f"VAR_KEY_{key_name}"
            f.write(f"export {bash_var_name}\n")

    print(f"Generated Bash keys: {output_file}")


def generate_documentation(output_file: Path):
    """生成变量KEY文档"""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# 变量KEY中心\n\n")
        f.write("> **注意**: 本文档由 `generate_var_keys.py` 自动生成，请勿手动编辑\n\n")
        f.write("## 所有变量KEY定义\n\n")
        f.write("所有变量都有统一的前缀 `mcpchrome_`，以避免多项目冲突。\n\n")

        keys = BuildVars.get_all_keys()

        # 按类别分组
        categories = {
            "基础环境": ["PROJECT_ROOT", "PLATFORM", "VARS_DIR"],
            "依赖版本": ["NODE_VERSION", "PNPM_VERSION", "NODE_INSTALLED", "PNPM_INSTALLED"],
            "路径变量": ["EXTENSION_PATH", "NATIVE_PATH", "SHARED_PATH", "MANIFEST_PATH", "NODE_MODULES_EXISTS"],
            "构建命令": ["CMD_CHECK_DEPS", "CMD_INSTALL", "CMD_BUILD_SHARED", "CMD_BUILD_NATIVE", "CMD_BUILD_EXTENSION", "CMD_REGISTER"],
            "状态标记": ["ERROR", "SHOULD_INSTALL", "BUILD_RETRY_MAX"],
            "UI显示": ["UI_TITLE", "UI_STEP_1", "UI_STEP_2", "UI_STEP_3", "UI_STEP_4", "UI_STEP_5", "UI_STEP_6"],
        }

        for category, key_names in categories.items():
            f.write(f"### {category}\n\n")
            f.write("| 常量名 | 变量KEY | 说明 |\n")
            f.write("|--------|---------|------|\n")

            for key_name in key_names:
                if key_name in keys:
                    key_value = keys[key_name]
                    # 从类定义中获取注释
                    f.write(f"| `{key_name}` | `{key_value}` | |\n")

            f.write("\n")

        f.write("## 使用示例\n\n")

        f.write("### Python\n\n")
        f.write("```python\n")
        f.write("from build_vars import BuildVars\n")
        f.write("from var_manager import get_instance\n\n")
        f.write("vm = get_instance()\n")
        f.write("vm.set(BuildVars.PROJECT_ROOT, \"/path/to/project\")\n")
        f.write("root = vm.get(BuildVars.PROJECT_ROOT)\n")
        f.write("```\n\n")

        f.write("### PowerShell\n\n")
        f.write("```powershell\n")
        f.write(". .\\VarKeys.ps1\n")
        f.write("Import-Module .\\VarManager.ps1\n\n")
        f.write("Set-Var -Key ([VarKeys]::PROJECT_ROOT) -Value \"C:\\path\\to\\project\"\n")
        f.write("$root = Get-Var -Key ([VarKeys]::PROJECT_ROOT)\n")
        f.write("```\n\n")

        f.write("### Bash\n\n")
        f.write("```bash\n")
        f.write("source ./var_keys.sh\n")
        f.write("source ./var_manager.sh\n\n")
        f.write("set_var \"$VAR_KEY_PROJECT_ROOT\" \"/path/to/project\"\n")
        f.write("root=$(get_var \"$VAR_KEY_PROJECT_ROOT\")\n")
        f.write("```\n\n")

        f.write("## 添加新变量\n\n")
        f.write("1. 在 `build_vars.py` 中的 `BuildVars` 类添加新的KEY定义\n")
        f.write("2. 运行 `python generate_var_keys.py` 重新生成所有KEY文件\n")
        f.write("3. 在 `build_orchestrator.py` 中使用新KEY设置变量\n")
        f.write("4. 在 `start.ps1` 或 `start.sh` 中使用新KEY读取变量\n")

    print(f"Generated documentation: {output_file}")


def main():
    """主函数"""
    script_dir = Path(__file__).parent

    # 生成 PowerShell KEY文件
    ps_output = script_dir / "VarKeys.ps1"
    generate_powershell_keys(ps_output)

    # 生成 Bash KEY文件
    bash_output = script_dir / "var_keys.sh"
    generate_bash_keys(bash_output)

    # 生成文档
    doc_output = script_dir / "VAR_KEYS.md"
    generate_documentation(doc_output)

    print("\nAll variable key files generated successfully!")
    print("Please commit these files to version control.")


if __name__ == "__main__":
    main()
