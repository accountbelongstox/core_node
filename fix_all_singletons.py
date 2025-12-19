#!/usr/bin/env python3
"""批量移除singleton模式，改为模块级别导出全局实例"""

import re
from pathlib import Path

# 需要修改的文件列表
files_to_fix = [
    "pyapps/matrix/adb_device_manager/network_scanner.py",
    "pyapps/matrix/adb_device_manager/adb_executor.py",
    "pyapps/matrix/adb_device_manager/usb_monitor.py",
    "pyapps/matrix/adb_device_manager/device_table.py",
    "pycore/pyutils/device/connection_manager.py",
]

def remove_singleton_pattern(content: str, class_name: str) -> str:
    """移除singleton模式相关代码"""

    # 1. 移除 _instance 和 _instance_lock
    content = re.sub(r'\s+_instance: Optional\[.*?\] = None\n', '', content)
    content = re.sub(r'\s+_instance_lock = threading\.Lock\(\)\n', '', content)

    # 2. 移除 instance() classmethod (多行)
    pattern = r'(\s+@classmethod\s+def instance\(.*?\n(?:.*?\n)*?.*?return cls\._instance\n)'
    content = re.sub(pattern, '', content, flags=re.MULTILINE)

    # 3. 更新文档字符串，移除singleton相关提示
    content = re.sub(
        r'IMPORTANT: This is a singleton class\. Use .*?\.instance\(\) to get the global instance\.\s*\n\s*DO NOT instantiate with .*?\(\) directly\.\s*\n\s*\n',
        '',
        content
    )
    content = re.sub(r'WARNING: Do not call directly\. Use .*?\.instance\(\) instead\.\s*\n\s*\n', '', content)

    return content

def add_global_instance(content: str, class_name: str, instance_name: str, init_args: str = "") -> str:
    """在文件末尾添加全局实例"""

    # 找到 __all__ 的位置
    if '__all__' in content:
        # 在 __all__ 之前插入全局实例
        content = re.sub(
            r'(__all__ = .*?)\n',
            f'\n# ✅ 创建全局唯一实例（模块级别单例）\n{instance_name} = {class_name}({init_args})\n\n\\1, \'{instance_name}\']\n',
            content
        )
        # 修复 __all__ 格式
        content = content.replace("__all__ = [", "__all__ = [")
    else:
        # 如果没有 __all__，在文件末尾添加
        content = content.rstrip() + f'\n\n# ✅ 创建全局唯一实例（模块级别单例）\n{instance_name} = {class_name}({init_args})\n\n__all__ = [\'{class_name}\', \'{instance_name}\']\n'

    return content

# 配置：类名 -> (实例名, 初始化参数)
config = {
    "NetworkScanner": ("network_scanner", "port=5555, timeout=0.2, max_workers=100"),
    "ADBExecutor": ("adb_executor", "adb_path='adb'"),
    "USBMonitor": ("usb_monitor", "adb_executor=adb_executor, device_table=device_table, auto_convert=True, conversion_delay=2.0"),
    "DeviceTable": ("device_table", ""),
    "ConnectionManager": ("connection_manager", "# 延迟初始化，需要device_manager等"),
}

# 处理每个文件
for file_path in files_to_fix:
    full_path = Path("D:/programing/core_node") / file_path
    if not full_path.exists():
        print(f"[SKIP] {file_path} - 文件不存在")
        continue

    print(f"[Processing] {file_path}")

    # 读取文件
    content = full_path.read_text(encoding='utf-8')

    # 提取类名
    match = re.search(r'class (\w+):', content)
    if not match:
        print(f"[SKIP] {file_path} - 找不到类定义")
        continue

    class_name = match.group(1)

    if class_name not in config:
        print(f"[SKIP] {file_path} - 类{class_name}不在配置中")
        continue

    instance_name, init_args = config[class_name]

    # 移除singleton模式
    content = remove_singleton_pattern(content, class_name)

    # 添加全局实例
    if class_name != "ConnectionManager":  # ConnectionManager需要特殊处理
        content = add_global_instance(content, class_name, instance_name, init_args)

    # 写回文件
    full_path.write_text(content, encoding='utf-8')
    print(f"[DONE] {file_path}")

print("\n所有文件已处理完成！")
