#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
桌面自动化：切换桌面 -> 回归左屏 -> 从左到右逐屏 -> 每屏依次打开每个 APP 图标再关闭。
依赖：uiautomator2（pip install uiautomator2）
"""
import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    import uiautomator2 as u2
except ImportError:
    print("请安装 uiautomator2: pip install uiautomator2")
    sys.exit(1)

from pycore.pyutils.device.scrcpy_init import get_initializer
from pycore.pyutils.device.adb_commands import ADBCommands


def get_serial(adb_path: str, serial_arg: str) -> str:
    if serial_arg:
        return serial_arg
    devices = ADBCommands.get_connected_devices(adb_path)
    if not devices:
        raise SystemExit("未发现可调试设备。")
    if len(devices) > 1:
        raise SystemExit("多台设备连接，请用 -s 指定序列号。")
    return devices[0].serial


def go_home(d):
    d.press("home")
    time.sleep(1.2)


def go_leftmost(d, width: int, height: int, max_swipes: int = 15):
    """多次右滑回到最左屏。"""
    for _ in range(max_swipes):
        d.swipe(width * 2 // 10, height // 2, width * 8 // 10, height // 2, 0.2)
        time.sleep(0.3)


def swipe_to_next_page(d, width: int, height: int):
    """左滑到下一屏。"""
    d.swipe(width * 8 // 10, height // 2, width * 2 // 10, height // 2, 0.25)
    time.sleep(0.5)


def get_icon_count(d, icon_class: str) -> int:
    """当前屏内可点击的图标数量（按 className 粗筛）。"""
    try:
        sel = d(className=icon_class, clickable=True)
        return sel.count
    except Exception:
        return 0


def open_close_icons_on_current_page(d, icon_class: str, open_sec: float, close_sec: float) -> int:
    """当前屏内依次点击每个图标，打开后等待再关闭。返回点击数量。"""
    try:
        sel = d(className=icon_class, clickable=True)
        n = sel.count
        for i in range(n):
            try:
                sel[i].click()
                time.sleep(open_sec)
                d.press("back")
                time.sleep(close_sec)
                d.press("home")
                time.sleep(0.6)
            except Exception as e:
                print(f"  图标 {i+1}/{n} 操作异常: {e}")
        return n
    except Exception as e:
        print(f"  获取图标异常: {e}")
        return 0


def main():
    ap = argparse.ArgumentParser(description="桌面从左到右逐屏，依次打开每个 APP 再关闭")
    ap.add_argument("-s", "--serial", default="", help="设备序列号")
    ap.add_argument("--icon-class", default="android.widget.TextView",
                   help="桌面图标控件类名，不同启动器需调整")
    ap.add_argument("--open-sec", type=float, default=2.5, help="打开后等待秒数")
    ap.add_argument("--close-sec", type=float, default=0.5, help="关闭后等待秒数")
    ap.add_argument("--max-pages", type=int, default=15, help="最多处理屏数")
    ap.add_argument("--dry-run", action="store_true", help="仅回到桌面并到左屏，不点击")
    args = ap.parse_args()

    init = get_initializer()
    adb_path = init.get_adb_path()
    if not adb_path:
        print("ADB 未初始化。")
        return 1
    serial = get_serial(str(adb_path), args.serial.strip())

    print(f"设备: {serial}")
    print(f"图标类名: {args.icon_class}")
    print("连接 uiautomator2...")
    d = u2.connect(serial)
    try:
        w, h = d.window_size
    except Exception:
        w, h = 1080, 2340
    if not w or not h:
        w, h = 1080, 2340
    print(f"分辨率: {w}x{h}\n")

    go_home(d)
    print("回到左屏...")
    go_leftmost(d, w, h)
    if args.dry_run:
        print("dry-run 结束。")
        return 0

    total_clicks = 0
    for page in range(args.max_pages):
        cnt = get_icon_count(d, args.icon_class)
        if cnt == 0:
            print(f"第 {page + 1} 屏未发现图标（类名 {args.icon_class}），可尝试 --icon-class 或结束。")
            swipe_to_next_page(d, w, h)
            continue
        print(f"第 {page + 1} 屏: 约 {cnt} 个图标，依次打开并关闭...")
        total_clicks += open_close_icons_on_current_page(d, args.icon_class, args.open_sec, args.close_sec)
        swipe_to_next_page(d, w, h)

    print(f"\n完成，共处理约 {total_clicks} 次打开/关闭。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
