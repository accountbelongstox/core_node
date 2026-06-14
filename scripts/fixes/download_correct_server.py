#!/usr/bin/env python3
"""
下载正确的scrcpy-server文件
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from pycore.pyutils.device.scrcpy_server_manager import ScrcpyServerManager
from pycore.pyutils.device.scrcpy_init import get_initializer
from pyapps.matrix.matrix_config import Config
from pycore import ColorPrint

print("=" * 80)
ColorPrint.blue("下载正确的scrcpy-server文件")
print("=" * 80)

# 获取路径
init = get_initializer()
adb_path = init.get_adb_path()
jar_path = Config.get_scrcpy_server_jar()

ColorPrint.blue(f"目标路径: {jar_path}")

# 删除旧的损坏文件
if jar_path.exists():
    old_size = jar_path.stat().st_size
    ColorPrint.yellow(f"删除旧文件 ({old_size} bytes)...")
    jar_path.unlink()

# 创建管理器并下载
mgr = ScrcpyServerManager(str(adb_path), str(jar_path))

ColorPrint.blue("\n开始下载...")
if mgr._download_jar_from_github(jar_path):
    ColorPrint.green("\n✓ 下载成功！")

    # 验证
    if mgr._is_jar_valid(jar_path):
        file_size = jar_path.stat().st_size
        ColorPrint.green(f"✓ 文件有效: {file_size:,} bytes ({file_size/1024:.1f} KB)")
    else:
        ColorPrint.red("✗ 文件验证失败！")
        sys.exit(1)
else:
    ColorPrint.red("\n✗ 下载失败！")
    sys.exit(1)

print("\n" + "=" * 80)
ColorPrint.green("完成！现在可以推送到设备了。")
print("=" * 80)
