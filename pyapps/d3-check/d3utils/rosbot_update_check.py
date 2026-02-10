# -*- coding: utf-8 -*-
"""
ROSBOT 更新检查：仅当战网区域已探测（亚服/国服）时执行。Downloads 找 zip（>20M、匹配区服），
创建 GameTools\\{Asia|CN}_版本号，解压后递归查找 RoS-BoT.exe，将 exe 所在目录重命名并移动到
GameTools\\{区服}_版本号\\RosBot\\，更新 CONFIG。是否更新需弹窗确认。
"""
import os
import re
import zipfile
import shutil
import threading
from pathlib import Path
from typing import List, Optional, Tuple, Any

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG
from providor.constants.d3 import (
    ROSBOT_GAMETOOLS_BASE,
    ROSBOT_ZIP_MIN_SIZE_MB,
    ROSBOT_EXE_PATTERNS,
    ROSBOT_ZIP_KEYWORDS_ASIA,
    ROSBOT_ZIP_KEYWORDS_CN,
)
from d3utils.rosbot_manager import get_rosbot_manager
from share.game_interface_data import get_game_interface_data

# 版本号：两段数字如 36.0129 -> (36, 129)；目录名用英文区服：Asia / CN
_VERSION_RE = re.compile(r"(\d{1,4})\.?(\d{2,5})")
_MIN_ZIP_BYTES = ROSBOT_ZIP_MIN_SIZE_MB * 1024 * 1024
ROSBOT_FINAL_DIR_NAME = "RosBot"  # 重命名后的目录名


def get_battlenet_region() -> Optional[str]:
    """战网已探测区域：asia | cn | None。未探测到则 None，此时不执行更新检查。"""
    return get_game_interface_data().get_battlenet_region()


def get_downloads_dir() -> str:
    """下载目录：配置或 ~/Downloads。"""
    path = CONFIG.get("paths", {}).get("downloads_dir", "").strip()
    if path and os.path.isdir(path):
        return path
    return os.path.join(os.path.expanduser("~"), "Downloads")


def _parse_version_from_name(name: str) -> Optional[Tuple[int, int]]:
    """从文件名/路径提取版本两段数字，如 36.0129 -> (36, 129)。"""
    matches = _VERSION_RE.findall(name)
    if not matches:
        return None
    a, b = matches[-1]
    return (int(a), int(b))


def _version_to_str(v: Tuple[int, int]) -> str:
    """(36, 129) -> '36.0129'（用于目录名）。"""
    return f"{v[0]}.{v[1]:04d}" if v[1] < 10000 else f"{v[0]}.{v[1]}"


def get_current_ros_dir_ctime_version() -> Tuple[Optional[str], float, Optional[Tuple[int, int]]]:
    """当前 ROS 目录、目录创建时间、路径中的版本号(若有)。"""
    mgr = get_rosbot_manager()
    exe_path = mgr.find_rosbot_exe()
    if not exe_path:
        return (None, 0.0, None)
    ros_dir = mgr.get_ros_directory()
    if not ros_dir or not os.path.isdir(ros_dir):
        return (ros_dir, 0.0, None)
    try:
        ctime = os.path.getctime(ros_dir)
    except OSError:
        ctime = 0.0
    version = _parse_version_from_name(ros_dir)
    return (ros_dir, ctime, version)


def _zip_matches_region(filename: str, region: str) -> bool:
    """zip 文件名是否匹配给定区服：asia -> 亚服/asia；cn -> 国服/cn。"""
    lower = filename.lower()
    if region == "asia":
        return any(k in filename or k.lower() in lower for k in ROSBOT_ZIP_KEYWORDS_ASIA)
    if region == "cn":
        return any(k in filename or k.lower() in lower for k in ROSBOT_ZIP_KEYWORDS_CN)
    return False


def find_rosbot_zips_in_downloads(region: str) -> List[Tuple[str, int, Optional[Tuple[int, int]]]]:
    """Downloads 下 >20M、匹配区服(亚服/国服)的 zip。返回 [(path, size, version), ...] 按版本降序。"""
    if region not in ("asia", "cn"):
        return []
    down = get_downloads_dir()
    if not os.path.isdir(down):
        return []
    out: List[Tuple[str, int, Optional[Tuple[int, int]]]] = []
    for f in os.listdir(down):
        if not f.lower().endswith(".zip"):
            continue
        if not _zip_matches_region(f, region):
            continue
        path = os.path.join(down, f)
        try:
            if not os.path.isfile(path):
                continue
            size = os.path.getsize(path)
            if size < _MIN_ZIP_BYTES:
                continue
        except OSError:
            continue
        version = _parse_version_from_name(f)
        out.append((path, size, version))
    out.sort(key=lambda x: (-(x[2][0] * 10000 + x[2][1]) if x[2] else 0))
    return out


def get_best_newer_zip(region: str) -> Tuple[Optional[str], bool, Optional[str]]:
    """
    根据已探测区服找比当前更新的最佳 zip。返回 (zip_path or None, is_newer, version_str 如 '36.0129')。
    未探测到区服或当前无更新则 is_newer=False。
    """
    ros_dir, cur_ctime, cur_ver = get_current_ros_dir_ctime_version()
    candidates = find_rosbot_zips_in_downloads(region)
    if not candidates:
        return (None, False, None)
    for path, _size, zip_ver in candidates:
        if cur_ver and zip_ver:
            if (zip_ver[0], zip_ver[1]) > (cur_ver[0], cur_ver[1]):
                return (path, True, _version_to_str(zip_ver))
            continue
        if not cur_ver:
            try:
                zip_mtime = os.path.getmtime(path)
                if cur_ctime <= 0:
                    return (path, True, _version_to_str(zip_ver) if zip_ver else None)
                if zip_mtime > cur_ctime:
                    return (path, True, _version_to_str(zip_ver) if zip_ver else None)
            except OSError:
                pass
    return (None, False, None)


def _find_rosbot_exe_recursive(root_dir: str) -> Optional[str]:
    """在 root_dir 下递归查找 RoS-BoT.exe 或 ros-bot*.exe，返回首个完整路径。"""
    root = Path(root_dir)
    if not root.is_dir():
        return None
    for pattern in ROSBOT_EXE_PATTERNS:
        for p in root.rglob(pattern):
            if p.is_file():
                return str(p.resolve())
    return None


def apply_rosbot_update(zip_path: str, region: str, version_str: Optional[str] = None) -> bool:
    """
    1) 在 GameTools 下创建目录：英文区服_版本号（Asia_36.0129 或 CN_36.0129）
    2) 解压 zip 到该目录
    3) 递归查找 RoS-BoT.exe，将 exe 所在目录重命名并移动到 GameTools\\{区服}_版本号\\RosBot\\
    4) 复制旧 RoS-BoT.ini（若有），更新 CONFIG ros_directory
    """
    if not os.path.isfile(zip_path) or not zip_path.lower().endswith(".zip"):
        return False
    if region not in ("asia", "cn"):
        ColorPrint.yellow("[ROSBOTUpdate] 未探测到战网区服(亚服/国服)，跳过更新")
        return False
    region_dir = "Asia" if region == "asia" else "CN"
    if not version_str:
        v = _parse_version_from_name(os.path.basename(zip_path))
        version_str = _version_to_str(v) if v else "0.0"
    parent_name = f"{region_dir}_{version_str}"
    extract_to = os.path.join(ROSBOT_GAMETOOLS_BASE, parent_name)
    ros_dir_old, _, _ = get_current_ros_dir_ctime_version()
    try:
        os.makedirs(extract_to, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_to)
        ColorPrint.green(f"[ROSBOTUpdate] 解压到: {extract_to}")
        exe_path = _find_rosbot_exe_recursive(extract_to)
        if not exe_path:
            ColorPrint.red("[ROSBOTUpdate] 解压后未找到 RoS-BoT.exe")
            return False
        exe_dir = os.path.dirname(exe_path)
        final_dir = os.path.join(ROSBOT_GAMETOOLS_BASE, parent_name, ROSBOT_FINAL_DIR_NAME)
        if os.path.normpath(exe_dir) != os.path.normpath(final_dir):
            if os.path.exists(final_dir):
                shutil.rmtree(final_dir)
            shutil.move(exe_dir, final_dir)
            ColorPrint.green(f"[ROSBOTUpdate] 已移动至: {final_dir}")
        else:
            final_dir = exe_dir
        if ros_dir_old and os.path.isdir(ros_dir_old):
            old_ini = os.path.join(ros_dir_old, "RoS-BoT.ini")
            new_ini = os.path.join(final_dir, "RoS-BoT.ini")
            if os.path.isfile(old_ini):
                try:
                    shutil.copy2(old_ini, new_ini)
                    ColorPrint.gray("[ROSBOTUpdate] 已复制 RoS-BoT.ini")
                except OSError:
                    pass
        from providor.providor_index import set_config_value_safe
        set_config_value_safe("ros_settings.ros_directory", final_dir)
        try:
            import d3utils.rosbot_manager as _m
            _m._rosbot_manager = None
        except Exception:
            pass
        return True
    except Exception as e:
        ColorPrint.red(f"[ROSBOTUpdate] 解压/移动/更新失败: {e}")
        return False


def run_rosbot_update_check() -> Tuple[Optional[str], bool, Optional[str], Optional[str]]:
    """
    执行更新检查。仅当战网已探测为亚服/国服时检查；否则跳过。
    返回 (best_zip_path or None, is_newer, version_str or None, region or None)。
    """
    region = get_battlenet_region()
    if region not in ("asia", "cn"):
        ColorPrint.gray("[ROSBOTUpdate] 战网区服未探测(需亚服/国服)，跳过更新检查")
        return (None, False, None, None)
    zip_path, is_newer, version_str = get_best_newer_zip(region)
    return (zip_path, is_newer, version_str, region)


def ask_yes_no_on_main_thread(panel: Any, title: str, message: str) -> bool:
    """在主线程弹出 Yes/No 对话框，阻塞当前线程直到用户选择。返回 True=Yes。"""
    result = [None]
    done = threading.Event()

    def _ask():
        try:
            from tkinter import messagebox
            result[0] = messagebox.askyesno(title, message)
        except Exception:
            result[0] = False
        done.set()

    if hasattr(panel, "container") and panel.container.winfo_exists():
        panel.container.after(0, _ask)
        done.wait(timeout=60)
    return result[0] is True
