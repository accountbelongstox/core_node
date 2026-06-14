#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
演示如何获取 scrcpy 命令

这个脚本展示了 Matrix 如何构建 scrcpy-server 命令
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyutils.device.scrcpy_device import ScrcpyDevice
from pycore.pyutils.device.server_params import ServerParams, VideoCodec
from pyapps.matrix.matrix_config import Config

def show_scrcpy_command():
    """显示 scrcpy 命令构建过程"""

    print("=" * 70)
    print("Matrix - Scrcpy 命令构建示例")
    print("=" * 70)

    # 1. 显示配置
    print("\n1. 配置信息:")
    print(f"   scrcpy-server JAR: {Config.SCRCPY_SERVER_JAR}")
    print(f"   scrcpy 版本: {Config.SCRCPY_SERVER_VERSION}")
    print(f"   ADB 路径: {Config.get_adb_path()}")

    # 2. 创建服务器参数
    print("\n2. 服务器参数:")
    params = ServerParams(
        max_size=Config.DEFAULT_MAX_SIZE,
        bit_rate=Config.DEFAULT_BIT_RATE,
        max_fps=Config.DEFAULT_MAX_FPS,
        codec=VideoCodec(Config.DEFAULT_CODEC),
        control=True,
        locked_video_orientation=-1
    )

    print(f"   最大分辨率: {params.max_size}")
    print(f"   比特率: {params.bit_rate} ({params.bit_rate / 1_000_000} Mbps)")
    print(f"   最大帧率: {params.max_fps}")
    print(f"   编解码器: {params.codec.value}")
    print(f"   控制功能: {params.control}")
    print(f"   锁定方向: {params.locked_video_orientation} (-1=自动)")

    # 3. 创建设备实例（示例）
    print("\n3. 创建 ScrcpyDevice 实例:")
    example_serial = "EXAMPLE_DEVICE_SERIAL"
    device = ScrcpyDevice(example_serial, params, Config.get_adb_path())
    print(f"   设备序列号: {example_serial}")

    # 4. 构建命令
    print("\n4. 构建 scrcpy-server 命令:")
    example_scid = 0x1a2b3c4d  # 示例 Session ID
    server_cmd = device._build_server_command(example_scid)

    print(f"   Session ID (SCID): {example_scid:08x}")
    print(f"\n   Shell 命令参数:")
    for i, arg in enumerate(server_cmd):
        print(f"      [{i}] {arg}")

    # 5. 完整的 ADB 命令
    print("\n5. 完整的 ADB 命令:")
    adb_cmd = [
        Config.get_adb_path(),
        "-s", example_serial,
        "shell",
        *server_cmd
    ]

    full_command = ' '.join(adb_cmd)
    print(f"\n   {full_command}")

    # 6. 单行版本（便于复制）
    print("\n6. 单行版本（便于复制）:")
    shell_command_only = ' '.join(server_cmd)
    print(f"\n   adb -s <DEVICE_SERIAL> shell {shell_command_only}")

    # 7. 实际使用示例
    print("\n" + "=" * 70)
    print("实际使用步骤:")
    print("=" * 70)
    print("\n1. 确保 scrcpy-server.jar 已推送到设备:")
    print(f"   adb push {Config.SCRCPY_SERVER_JAR} /data/local/tmp/")
    print("\n2. 查找设备序列号:")
    print("   adb devices")
    print("\n3. 替换 <DEVICE_SERIAL> 为实际设备序列号，执行命令:")
    print("   (命令已在上面显示)")
    print("\n4. 或者直接使用 Matrix 的 DeviceManager:")
    print("   from pycore.pyutils.device.device_manager import DeviceManager")
    print("   manager = DeviceManager.instance()")
    print("   device = await manager.connect_device('DEVICE_SERIAL')")
    print("\n" + "=" * 70)

    # 8. 参数说明
    print("\n参数说明:")
    print("=" * 70)
    print(f"  max_size={params.max_size}")
    print("    - 限制视频短边的最大分辨率")
    print("    - 示例: 720 表示短边最大 720px (如 720x1280 或 1280x720)")
    print()
    print(f"  max_fps={params.max_fps}")
    print("    - 限制最大帧率")
    print("    - 示例: 60 表示最大 60fps")
    print()
    print(f"  video_bit_rate={params.bit_rate}")
    print("    - 视频比特率（影响画质和带宽）")
    print(f"    - 示例: {params.bit_rate} = {params.bit_rate / 1_000_000} Mbps")
    print()
    print(f"  video_codec={params.codec.value}")
    print("    - 视频编解码器")
    print("    - 可选: h264, h265, av1")
    print()
    print("  log_level=debug")
    print("    - 日志级别")
    print("    - 可选: verbose, debug, info, warn, error")
    print()
    print("  audio=false")
    print("    - 音频流（当前 Matrix 禁用）")
    print()
    print(f"  scid={example_scid:08x}")
    print("    - Session ID（每次启动随机生成）")
    print("    - 用于区分不同的 scrcpy 会话")

    print("\n" + "=" * 70)
    print("提示:")
    print("=" * 70)
    print("• 实际运行时，SCID 会随机生成（31-bit 随机数）")
    print("• Matrix 使用 REVERSE 隧道模式（更可靠）")
    print("• 查看完整文档: pyapps/matrix/docs/SCRCPY_INITIALIZATION.md")
    print("=" * 70)

if __name__ == "__main__":
    show_scrcpy_command()
