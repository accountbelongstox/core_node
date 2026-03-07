#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
在子 app GameAISDK 中通过脚本启动录制（action_sampler）。

规范：
- 运行目录：建议在 GameAISDK 根目录执行，如：python scripts/start_record.py [选项]
- 若已在 SDKTool 中对该项目做过「Config Record」并保存，则 action_sampler 的 cfg/cfg.json、cfg/action.json 已就绪，本脚本直接启动 main.py。
- 若 cfg/cfg.json 不存在，则根据 record_cfg.json 与 --project 生成最小配置（需 action_sampler/cfg/action.json 已存在，通常由 SDKTool 同步）。

停止录制：Ctrl+C 结束进程，或请求 http://127.0.0.1:<port>?method=quit
"""
from __future__ import absolute_import, print_function, unicode_literals

import sys
import os
_dir = os.path.dirname(os.path.abspath(__file__))
for _ in range(12):
    if os.path.isdir(os.path.join(_dir, "pycore")):
        if _dir not in sys.path:
            sys.path.insert(0, _dir)
        break
    _dir = os.path.dirname(_dir)

import argparse
import json
import os
import subprocess
import sys

# 脚本所在目录与 GameAISDK 根目录
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_GAMEAISDK_ROOT = os.path.dirname(_SCRIPT_DIR)
# SDKTool 根目录（与 SDKTool 内 define 约定一致：tools/SDKTool）
_SDKTOOL_ROOT = os.path.join(_GAMEAISDK_ROOT, "tools", "SDKTool")
_ACTION_SAMPLER_DIR = os.path.join(_SDKTOOL_ROOT, "src", "modules", "action_sampler")
_RECORD_CFG_PATH = os.path.join(_SDKTOOL_ROOT, "Resource", "cfg", "record_cfg.json")
_ACTION_SAMPLER_CFG_DIR = os.path.join(_ACTION_SAMPLER_DIR, "cfg")
_ACTION_SAMPLER_CFG_JSON = os.path.join(_ACTION_SAMPLER_CFG_DIR, "cfg.json")
_ACTION_SAMPLER_ACTION_JSON = os.path.join(_ACTION_SAMPLER_CFG_DIR, "action.json")

DEFAULT_PORT = 52808
DEVICE_ANDROID = "Android"
DEVICE_WINDOWS = "Windows"


def _ensure_cfg_json(project_path, frame_width, frame_height):
    """Ensure action_sampler cfg/cfg.json exists and has SavePath/frame size. When project_path is set, always update SavePath."""
    cfg = None
    if os.path.isfile(_ACTION_SAMPLER_CFG_JSON):
        try:
            with open(_ACTION_SAMPLER_CFG_JSON, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        except (OSError, ValueError, TypeError):
            cfg = None
    if cfg is None and os.path.isfile(_RECORD_CFG_PATH):
        with open(_RECORD_CFG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    if cfg is None:
        if not os.path.isfile(_RECORD_CFG_PATH):
            print("[start_record] 未找到录制模板: %s" % _RECORD_CFG_PATH, file=sys.stderr)
            return False
        with open(_RECORD_CFG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    if project_path:
        save_path = os.path.abspath(project_path)
        if not os.path.isdir(save_path):
            try:
                os.makedirs(save_path, exist_ok=True)
            except OSError as e:
                print("[start_record] 创建 SavePath 失败: %s" % e, file=sys.stderr)
                return False
        cfg["SavePath"] = save_path + os.sep
    else:
        if "SavePath" not in cfg or not cfg["SavePath"]:
            cfg["SavePath"] = os.path.join(_SDKTOOL_ROOT, "project", "output") + os.sep
    cfg["GameName"] = cfg.get("GameName", "output")
    cfg["FrameWidth"] = int(frame_width)
    cfg["FrameHeight"] = int(frame_height)
    cfg["ActionCfgFile"] = cfg.get("ActionCfgFile", "cfg/action.json")
    os.makedirs(_ACTION_SAMPLER_CFG_DIR, exist_ok=True)
    with open(_ACTION_SAMPLER_CFG_JSON, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)
    print("[start_record] cfg: %s (SavePath=%s)" % (_ACTION_SAMPLER_CFG_JSON, cfg["SavePath"]))
    return True


def main():
    parser = argparse.ArgumentParser(
        description="启动 GameAISDK 录制（action_sampler）。停止：Ctrl+C 或 curl 'http://127.0.0.1:PORT?method=quit'"
    )
    parser.add_argument(
        "--project", "-P",
        default=None,
        help="项目路径（相对 SDKTool 根或绝对路径），用于生成/校验 SavePath。默认不填则使用已有 cfg 或 project/output",
    )
    parser.add_argument(
        "--device-type", "-m",
        choices=[DEVICE_ANDROID, DEVICE_WINDOWS],
        default=DEVICE_ANDROID,
        help="设备类型：Android 或 Windows（模拟器/PC 窗口）",
    )
    parser.add_argument(
        "--serial", "-s",
        default=None,
        help="Android 设备 serial；Windows 时可为窗口句柄（由 SDKTool 通过 qpath 解析得到，脚本不解析，一般不传）",
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=DEFAULT_PORT,
        help="action_sampler 本地 HTTP 端口，用于停止录制。默认 %s" % DEFAULT_PORT,
    )
    parser.add_argument(
        "--width",
        type=int,
        default=640,
        help="仅在自动生成 cfg.json 时使用，帧宽。默认 640",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=360,
        help="仅在自动生成 cfg.json 时使用，帧高。默认 360",
    )
    parser.add_argument(
        "--continuous", "-c",
        action="store_true",
        help="Continuous record: one segment from start to quit (no F1/F2).",
    )
    args = parser.parse_args()

    if not os.path.isdir(_ACTION_SAMPLER_DIR):
        print("[start_record] 未找到 action_sampler 目录: %s" % _ACTION_SAMPLER_DIR, file=sys.stderr)
        return 2

    project_abs = None
    if args.project:
        if os.path.isabs(args.project):
            project_abs = args.project
        else:
            project_abs = os.path.join(_SDKTOOL_ROOT, args.project.replace("/", os.sep))

    if not _ensure_cfg_json(project_abs, args.width, args.height):
        return 2
    if not os.path.isfile(_ACTION_SAMPLER_ACTION_JSON):
        print(
            "[start_record] 未找到动作配置 %s，请先在 SDKTool 中打开项目并执行 Run > Train > Config Record 保存配置。"
            % _ACTION_SAMPLER_ACTION_JSON,
            file=sys.stderr,
        )
        return 2

    cmd = [sys.executable, "main.py", "-p", str(args.port), "-m", args.device_type]
    if args.serial:
        cmd.extend(["-s", str(args.serial)])
    if args.continuous:
        cmd.append("-c")

    print("[start_record] 工作目录: %s" % _ACTION_SAMPLER_DIR)
    print("[start_record] 命令: %s" % " ".join(cmd))
    print("[start_record] 停止: Ctrl+C 或 curl 'http://127.0.0.1:%s?method=quit'" % args.port)

    try:
        return subprocess.call(cmd, cwd=_ACTION_SAMPLER_DIR)
    except FileNotFoundError as e:
        print("[start_record] 执行失败: %s" % e, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
